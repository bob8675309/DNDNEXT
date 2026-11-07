#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGHOST" != "127.0.0.1" && "$PGHOST" != "localhost" ]] ||
   [[ "$PGDATABASE" != "p13_live_source_sandbox" ]] || [[ "$PGUSER" != "postgres" ]]; then
  echo "REFUSED: only disposable local p13_live_source_sandbox" >&2
  exit 1
fi
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
psqlq(){ psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }
assert_sql(){ psqlq -c "DO \$check\$ BEGIN IF NOT ($1) THEN RAISE EXCEPTION 'fixture: $2'; END IF; END \$check\$;"; }
p_lock_then_encounter(){
  local e="$1" p="$2" out="$3"
  psqlq -c "BEGIN;
    SET LOCAL lock_timeout='6s'; SET LOCAL deadlock_timeout='150ms';
    UPDATE public.encounter_participants SET speed_ft=15 WHERE id=public.fixture_uuid($p);
    SELECT pg_sleep(0.60);
    UPDATE public.encounters SET version=version+1 WHERE id=public.fixture_uuid($e);
    COMMIT;" >"$out" 2>&1
}
turn_start(){
 local e="$1" source="$2" out="$3"
 psqlq -c "BEGIN;
   SET LOCAL lock_timeout='6s';SET LOCAL deadlock_timeout='150ms';
   UPDATE public.encounters SET active_participant_id=public.fixture_uuid($source)
   WHERE id=public.fixture_uuid($e);
   COMMIT;" >"$out" 2>&1
}
echo "TRIGGER CASE 10: exact deployed E->X->P turn-start effect versus P->E writer"
set +e
p_lock_then_encounter 601 1602 "$tmp/negative.a" & pa=$!
sleep 0.16
turn_start 601 1601 "$tmp/negative.b" & pb=$!
wait "$pa";ra=$?
wait "$pb";rb=$?
set -e
if [[ "$ra" == "$rb" ]] || ! grep -qi "deadlock detected" "$tmp/negative.a" "$tmp/negative.b";then
  echo "Expected one PostgreSQL deadlock victim";cat "$tmp/negative.a" "$tmp/negative.b";exit 1
fi
assert_sql "(SELECT count(*)=0 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(601)) =
 (SELECT count(*)=1 FROM public.encounter_timed_effects WHERE id=public.fixture_uuid(2601))" "log/expiry rollback consistency"
echo "PASS: exact turn-start expiry trigger produced a PostgreSQL deadlock with same target P in scratch DB"
echo "TRIGGER CASE 11: E-first prelock of both paths avoids this specific cycle"
e_first_p(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';
 UPDATE public.encounters SET version=version+1 WHERE id=public.fixture_uuid(602);
 UPDATE public.encounter_participants SET speed_ft=15 WHERE id=public.fixture_uuid(1702);
 SELECT pg_sleep(0.35);
 COMMIT;" >"$tmp/positive.a" 2>&1
}
e_first_p & pa=$!
sleep 0.09
turn_start 602 1701 "$tmp/positive.b" & pb=$!
wait "$pa";wait "$pb"
assert_sql "(SELECT count(*)=0 FROM public.encounter_timed_effects WHERE id=public.fixture_uuid(2701))
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(602) AND event_type='effect_expired')
 AND (SELECT active_participant_id=public.fixture_uuid(1701) FROM public.encounters WHERE id=public.fixture_uuid(602))" "effect/log/turn commit consistency"
echo "PASS: E-first positive control committed the expiry and log, with no cycle in this pair"
echo "PASS: two real-source turn-start trigger PG16 cases. No production SQL executed."
