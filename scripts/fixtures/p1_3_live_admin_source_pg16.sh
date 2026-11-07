#!/usr/bin/env bash
set -euo pipefail
# CI SCRATCH ONLY. No Supabase or production DB connections are permitted.
if [[ "${PGHOST:-}" != '127.0.0.1' && "${PGHOST:-}" != 'localhost' ]] ||
   [[ "${PGDATABASE:-}" != 'p13_live_source_sandbox' ]] ||
   [[ "${PGUSER:-}" != 'postgres' ]]; then
  echo 'REFUSED: local scratch p13_live_source_sandbox postgres only' >&2;exit 1
fi
tmp=$(mktemp -d);trap 'rm -rf "$tmp"' EXIT
psqlq(){ psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }
start(){ psqlq -c "SELECT public.admin_start_encounter_v1(public.fixture_uuid($1))" >"$2" 2>&1; }
setstatus(){ psqlq -c "SELECT public.admin_set_encounter_status_v1(public.fixture_uuid($1),'active')" >"$2" 2>&1; }
check(){ psqlq -c "DO \$verify\$ BEGIN IF NOT ($1) THEN RAISE EXCEPTION 'fixture failure: $2'; END IF; END \$verify\$;"; }
runpair(){
 local left="$1" right="$2" tag="$3" expect="$4"
 set +e
 start "$left" "$tmp/$tag.a" & pa=$!
 start "$right" "$tmp/$tag.b" & pb=$!
 wait "$pa";ra=$?
 wait "$pb";rb=$?
 set -e
 if [[ "$expect" == both ]]; then
   [[ "$ra" == 0 && "$rb" == 0 ]] || { cat "$tmp/$tag.a" "$tmp/$tag.b";exit 1; }
 else
   [[ "$ra" != "$rb" ]] || { cat "$tmp/$tag.a" "$tmp/$tag.b";exit 1; }
   if [[ "$ra" == 0 ]]; then bad="$tmp/$tag.b";else bad="$tmp/$tag.a";fi
   grep -q TC1_CONFLICT "$bad" || { cat "$tmp/$tag.a" "$tmp/$tag.b";exit 1; }
 fi
 echo "PASS: $tag (expected $expect)"
}
echo 'CASE 1: exact source admin_start unguarded; two active encounters share one character'
runpair 101 102 unguarded-start both
check "(SELECT count(*) FROM public.encounters WHERE status='active' AND id IN (public.fixture_uuid(101),public.fixture_uuid(102)))=2" 'unguarded source gap'
echo 'CASE 2: exact source admin_set_encounter_status unguarded paused->active'
setstatus 103 "$tmp/unguarded-resume"
check "(SELECT status='active' FROM public.encounters WHERE id=public.fixture_uuid(103))" 'unguarded resume gap'
echo 'CASE 3: install test-only TC1 trigger, never production'
psql -X -v ON_ERROR_STOP=1 -q -f scripts/fixtures/p1_3_tc1_test_trigger_only.sql
echo 'CASE 4: concurrent real function calls, illustrative guard allows one'
runpair 201 202 guarded-start one
check "(SELECT count(*) FROM public.encounters WHERE status='active' AND id IN (public.fixture_uuid(201),public.fixture_uuid(202)))=1 AND (SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id IN (public.fixture_uuid(201),public.fixture_uuid(202)))=1" 'one activation and log'
echo 'CASE 5: resume and direct status UPDATE hit the same test-only gate'
set +e
setstatus 203 "$tmp/guarded-resume";rr=$?
psqlq -c "UPDATE public.encounters SET status='active' WHERE id=public.fixture_uuid(204)" >"$tmp/direct" 2>&1;rd=$?
set -e
[[ "$rr" != 0 && "$rd" != 0 ]] || { cat "$tmp/guarded-resume" "$tmp/direct";exit 1; }
grep -q TC1_CONFLICT "$tmp/guarded-resume";grep -q TC1_CONFLICT "$tmp/direct"
check "(SELECT status='paused' AND version=0 FROM public.encounters WHERE id=public.fixture_uuid(203)) AND (SELECT status='draft' AND version=0 FROM public.encounters WHERE id=public.fixture_uuid(204))" 'rejected updates unchanged'
echo 'CASE 6: two distinct characters both start through exact source'
runpair 211 212 independent both
echo 'CASE 7: forced transaction rollback of exact start function and clean retry'
set +e
psqlq -c "BEGIN; SELECT public.admin_start_encounter_v1(public.fixture_uuid(231)); SELECT 1/0; COMMIT;" >"$tmp/rollback" 2>&1;rb=$?
set -e
[[ "$rb" != 0 ]] || { cat "$tmp/rollback";exit 1; }
check "(SELECT status='draft' AND version=0 FROM public.encounters WHERE id=public.fixture_uuid(231)) AND (SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(231))=0 AND (SELECT action_available=false FROM public.encounter_participants WHERE encounter_id=public.fixture_uuid(231))" 'rollback all state'
start 231 "$tmp/retry"
check "(SELECT status='active' FROM public.encounters WHERE id=public.fixture_uuid(231)) AND (SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(231))=1" 'retry after rollback'
echo 'PASS: all 7 exact-source isolated admin Start/Resume PostgreSQL cases; real auth/triggers NOT tested.'