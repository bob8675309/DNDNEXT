#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGHOST" != '127.0.0.1' && "$PGHOST" != 'localhost' ]] || [[ "$PGDATABASE" != 'p13_live_source_sandbox' ]] || [[ "$PGUSER" != 'postgres' ]];then
 echo 'REFUSED: disposable local PostgreSQL16 only' >&2;exit 1
fi
tmp=$(mktemp -d);trap 'rm -rf "$tmp"' EXIT
psqlq(){ psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }
check(){ psqlq -c "DO \$t\$ BEGIN IF NOT ($1) THEN RAISE EXCEPTION 'guiding bolt fixture: $2'; END IF; END \$t\$;"; }
cast(){ local actor="$1" assign="$2" target="$3" slot="$4" req="$5" out="$6";psqlq -c "SELECT public.encounter_cast_spell_v13(public.fixture_uuid($actor),public.fixture_uuid($assign),public.fixture_uuid($target),$slot,public.fixture_uuid($req));" >"$out" 2>&1; }
endturn(){ psqlq -c "SELECT public.encounter_end_turn_v1(public.fixture_uuid($1),public.fixture_uuid($2));" >"$3" 2>&1; }
echo 'GUIDING CASE 36: v13->v12->v11 wrapper/processor original slotted Guiding Bolt'
cast 5970 6970 5971 1 8970 "$tmp/36.cast"
check "(SELECT slots_remaining=0 FROM public.character_spell_slots WHERE character_id=public.fixture_uuid(40))
AND (SELECT slots_remaining=0 FROM public.encounter_spell_slots WHERE id=public.fixture_uuid(4970))
AND (SELECT action_available=false FROM public.encounter_participants WHERE id=public.fixture_uuid(5970))
AND (SELECT current_hp BETWEEN 36 AND 56 FROM public.encounter_participants WHERE id=public.fixture_uuid(5971))
AND (SELECT count(*)=1 FROM public.encounter_timed_effects WHERE participant_id=public.fixture_uuid(5971) AND effect_key='guiding_bolt_next_attack_advantage' AND expiry_trigger='source_turn_end')
AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(942) AND event_type='spell_cast')
AND (SELECT result->>'spellKey'='guiding-bolt|xphb' AND (result->>'slotLevel')::integer=1 FROM public.encounter_command_requests WHERE request_id=public.fixture_uuid(8970))" "slot/resource/effect/log consistency"
echo 'PASS: real Guiding Bolt wrapper/processor spent one S/C and generated timed effect'
echo 'GUIDING CASE 37: replay changes target and slot with existing UUID'
result=$(psqlq -c "SELECT (public.encounter_cast_spell_v13(public.fixture_uuid(5970),public.fixture_uuid(6970),public.fixture_uuid(5972),2,public.fixture_uuid(8970))->>'targetId')=public.fixture_uuid(5971)::text")
[[ "$result" == 't' ]] || { echo "Unexpected replay $result";exit 1; }
set +e
cast 5970 6970 5972 1 8971 "$tmp/37.rejected";rc=$?
set -e
[[ "$rc" != 0 ]] && grep -q 'A spell slot has already been expended to cast a spell on this turn' "$tmp/37.rejected" || { cat "$tmp/37.rejected";exit 1; }
check "(SELECT current_hp=60 FROM public.encounter_participants WHERE id=public.fixture_uuid(5972))
AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(942) AND event_type='spell_cast')
AND (SELECT count(*)=1 FROM public.encounter_command_requests WHERE encounter_id=public.fixture_uuid(942))
AND (SELECT slots_remaining=0 FROM public.character_spell_slots WHERE character_id=public.fixture_uuid(40))" "replay and new request separation"
echo 'PASS: changed-target/slot request returned prior cache while new slot-spend was rejected'
echo 'GUIDING CASE 38: v11 wrapper locks E then P, End Turn locks P then E'
cast_with_encounter_held(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';SET LOCAL deadlock_timeout='150ms';
 SELECT id FROM public.encounters WHERE id=public.fixture_uuid(943) FOR UPDATE;
 SELECT pg_sleep(0.70);
 SELECT public.encounter_cast_spell_v13(public.fixture_uuid(5973),public.fixture_uuid(6973),public.fixture_uuid(5974),1,public.fixture_uuid(8973));
 COMMIT;" >"$tmp/38.cast" 2>&1
}
set +e
cast_with_encounter_held & pa=$!
sleep 0.17
endturn 5973 8974 "$tmp/38.end" & pb=$!
wait "$pa";ra=$?
wait "$pb";rb=$?
set -e
if [[ "$ra" == "$rb" ]] || ! grep -qi 'deadlock detected' "$tmp/38.cast" "$tmp/38.end";then
 echo 'Expected a PostgreSQL deadlock with one victim';cat "$tmp/38.cast" "$tmp/38.end";exit 1
fi
check "(SELECT slots_remaining FROM public.encounter_spell_slots WHERE id=public.fixture_uuid(4973))=
(SELECT slots_remaining FROM public.character_spell_slots WHERE character_id=public.fixture_uuid(43))
AND (SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(943) AND event_type='spell_cast')=
(SELECT 1-slots_remaining FROM public.character_spell_slots WHERE character_id=public.fixture_uuid(43))
AND (SELECT count(*) FROM public.encounter_command_requests WHERE encounter_id=public.fixture_uuid(943) AND command_type='spell_cast')=
(SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(943) AND event_type='spell_cast')" "deadlock abort retains slot/log/ledger consistency"
echo 'PASS: original v11 vs End Turn E/P source inversion caused a real scratch deadlock with rollback'
echo 'PASS: Guiding Bolt source cases 36-38, mocked auth/attack roll/damage; no production SQL.'
