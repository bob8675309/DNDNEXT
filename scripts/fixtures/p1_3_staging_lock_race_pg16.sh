#!/usr/bin/env bash
set -euo pipefail
# This is ONLY for an already initialized scratch PostgreSQL16 environment.
if [[ "${PGHOST:-}" != '127.0.0.1' && "${PGHOST:-}" != 'localhost' ]] ||
   [[ "${PGDATABASE:-}" != 'p13_live_source_sandbox' ]] ||
   [[ "${PGUSER:-}" != 'postgres' ]]; then
  echo 'REFUSED: scratch localhost p13_live_source_sandbox postgres only' >&2
  exit 1
fi
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
psqlq(){ psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }
assert_sql(){
  psqlq -c "DO \$test\$ BEGIN IF NOT ($1) THEN RAISE EXCEPTION 'STAGING_FIXTURE_FAIL: $2'; END IF; END \$test\$;"
}
lock_encounter_then_start(){
  local enc="$1" delay="$2" out="$3"
  psqlq -c "BEGIN;
    SET LOCAL deadlock_timeout='200ms';
    SET LOCAL lock_timeout='8s';
    SELECT id FROM public.encounters WHERE id=public.fixture_uuid($enc) FOR UPDATE;
    SELECT pg_sleep($delay);
    SELECT public.admin_start_encounter_v1(public.fixture_uuid($enc));
    COMMIT;" >"$out" 2>&1
}
stage_without_prefix_lock(){
  local id="$1" out="$2"
  psqlq -c "BEGIN;
    SET LOCAL deadlock_timeout='200ms';
    SET LOCAL lock_timeout='8s';
    SELECT public.admin_update_encounter_participant_staging_v1(
      p_participant_id=>public.fixture_uuid($id),p_q=>1);
    COMMIT;" >"$out" 2>&1
}
stage_with_encounter_prefix_lock(){
  local enc="$1" part="$2" out="$3"
  psqlq -c "BEGIN;
    SET LOCAL deadlock_timeout='200ms';
    SET LOCAL lock_timeout='8s';
    SELECT id FROM public.encounters WHERE id=public.fixture_uuid($enc) FOR UPDATE;
    SELECT public.admin_update_encounter_participant_staging_v1(
      p_participant_id=>public.fixture_uuid($part),p_q=>1);
    COMMIT;" >"$out" 2>&1
}
echo 'RACE CASE 8: deployed Start (E->P) vs deployed staging update (P->E) — expected deadlock in scratch PG16'
set +e
lock_encounter_then_start 611 1.1 "$work/start.611" & first=$!
sleep 0.20
stage_without_prefix_lock 1611 "$work/stage.611" & second=$!
wait "$first";rc1=$?
wait "$second";rc2=$?
set -e
if [[ "$rc1" == "$rc2" ]] || ! grep -qi 'deadlock detected' "$work/start.611" "$work/stage.611"; then
  echo 'FAILED: expected exact-source mixed-order deadlock and one survivor in scratch only' >&2
  cat "$work/start.611" "$work/stage.611" >&2
  exit 1
fi
assert_sql "(SELECT count(*) FROM public.encounters WHERE id=public.fixture_uuid(611) AND status='active')
 = (SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(611))" \
  'status and start log must roll back together'
echo 'PASS: real PostgreSQL deadlock detected from exact deployed Start/Staging function bodies in isolated test schema'

echo 'RACE CASE 9: common E-first prelock serializes the same two function bodies (positive control only)'
set +e
lock_encounter_then_start 612 0.75 "$work/start.612" & first=$!
sleep 0.20
stage_with_encounter_prefix_lock 612 1612 "$work/stage.612" & second=$!
wait "$first";rc1=$?
wait "$second";rc2=$?
set -e
if [[ "$rc1" != 0 || "$rc2" == 0 ]] ||
   ! grep -q 'Staging changes are locked after active play begins' "$work/stage.612" ||
   grep -qi 'deadlock detected' "$work/start.612" "$work/stage.612"; then
  echo 'FAILED: E-first positive control did not serialize correctly' >&2
  cat "$work/start.612" "$work/stage.612" >&2
  exit 1
fi
assert_sql "(SELECT status='active' FROM public.encounters WHERE id=public.fixture_uuid(612))
 AND (SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(612))=1
 AND (SELECT q=0 FROM public.encounter_participants WHERE id=public.fixture_uuid(1612))" \
  'E-first should commit Start once and reject post-active staging'
echo 'PASS: common E-first prelock serialized Start and Staging in isolated test; not globally approved for DnDNext'
echo 'PASS: both source-derived P/E concurrency cases completed. Live Supabase was never modified.'