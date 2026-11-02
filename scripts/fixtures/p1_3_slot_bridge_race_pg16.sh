#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGHOST" != "127.0.0.1" && "$PGHOST" != "localhost" ]] ||
   [[ "$PGDATABASE" != "p13_live_source_sandbox" ]] || [[ "$PGUSER" != "postgres" ]]; then
 echo "REFUSED: disposable local p13_live_source_sandbox postgres role only" >&2;exit 1
fi
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
psqlq(){ psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }
check(){ psqlq -c "DO \$assert\$ BEGIN IF NOT ($1) THEN RAISE EXCEPTION 'slot fixture failed: $2'; END IF; END \$assert\$;"; }
spend(){
 local sid="$1" out="$2"
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';SET LOCAL deadlock_timeout='150ms';
 UPDATE public.encounter_spell_slots SET slots_remaining=slots_remaining-1
 WHERE id=public.fixture_uuid($sid) AND slots_remaining>0;
 COMMIT;" >"$out" 2>&1
}
echo "SLOT CASE 12: same canonical character, two historical active encounters, only 1 persistent slot"
set +e
spend 3701 "$tmp/shortage.a" & pa=$!
spend 3702 "$tmp/shortage.b" & pb=$!
wait "$pa";ra=$?
wait "$pb";rb=$?
set -e
if [[ "$ra" == "$rb" ]]; then cat "$tmp/shortage.a" "$tmp/shortage.b";exit 1;fi
if [[ "$ra" == 0 ]]; then bad="$tmp/shortage.b";else bad="$tmp/shortage.a";fi
grep -q "Persistent character spell resources have only" "$bad"
check "(SELECT slots_remaining=0 FROM public.character_spell_slots WHERE character_id=public.fixture_uuid(8))
 AND (SELECT sum(slots_remaining)=1 FROM public.encounter_spell_slots WHERE id IN(public.fixture_uuid(3701),public.fixture_uuid(3702)))" "insufficient slots rollback and exactly one spend"
echo "PASS: shortage rejected one snapshot spend; persistent C spent only once"
echo "SLOT CASE 13: two concurrent snapshots and two real persistent slots"
spend 3801 "$tmp/two.a" & pa=$!
spend 3802 "$tmp/two.b" & pb=$!
wait "$pa";wait "$pb"
check "(SELECT slots_remaining=0 FROM public.character_spell_slots WHERE character_id=public.fixture_uuid(9))
 AND (SELECT sum(slots_remaining)=0 FROM public.encounter_spell_slots WHERE id IN(public.fixture_uuid(3801),public.fixture_uuid(3802)))" "both spends serialized and accounted"
echo "PASS: two snapshot spends synchronized to canonical resource C"
echo "SLOT CASE 14: exact deployed S->sync(C) trigger vs C-first maintenance-style scratch writer"
c_first(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';SET LOCAL deadlock_timeout='150ms';
 SELECT slots_remaining FROM public.character_spell_slots
 WHERE character_id=public.fixture_uuid(10) AND pool_key='spellcasting' AND slot_level=1 FOR UPDATE;
 SELECT pg_sleep(0.70);
 SELECT slots_remaining FROM public.encounter_spell_slots
 WHERE id=public.fixture_uuid(3803) FOR UPDATE;
 COMMIT;" >"$tmp/inverted.a" 2>&1
}
set +e
c_first & pa=$!
sleep 0.20
spend 3803 "$tmp/inverted.b" & pb=$!
wait "$pa";ra=$?
wait "$pb";rb=$?
set -e
if [[ "$ra" == "$rb" ]] || ! grep -qi "deadlock detected" "$tmp/inverted.a" "$tmp/inverted.b";then
 echo "Expected source-trigger/synthetic-maintenance deadlock";cat "$tmp/inverted.a" "$tmp/inverted.b";exit 1
fi
check "((SELECT slots_remaining FROM public.character_spell_slots WHERE character_id=public.fixture_uuid(10)) =
 (SELECT slots_remaining FROM public.encounter_spell_slots WHERE id=public.fixture_uuid(3803)))" "S/C aborted transaction leaves consistent remaining slots"
echo "PASS: PG detected deadlock between real S->C trigger and synthetic C->S writer; rollback consistent"
echo "PASS source-derived spell sync cases 12-14. TC1 overlap is test-only; no production SQL."
