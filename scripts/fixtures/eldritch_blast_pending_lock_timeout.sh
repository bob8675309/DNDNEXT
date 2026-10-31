#!/usr/bin/env bash
set -euo pipefail
# PostgreSQL 16 CI fixture only. Never run on hosted Supabase.
if [[ "${PGHOST:-}" != localhost && "${PGHOST:-}" != 127.0.0.1 ]] || [[ "${PGDATABASE:-}" != postgres ]]; then
  echo "Refusing non-local or non-fixture Postgres" >&2; exit 1
fi
psql -X -v ON_ERROR_STOP=1 -q -c "
 update public.encounters set status='active',active_participant_id=public.fixture_uuid(11);
 update public.character_progression set class_level=3 where character_id=public.fixture_uuid(31);
 update public.encounter_participants set action_available=true where id=public.fixture_uuid(11);
 update public.encounter_participants set q=4,r=0,is_hidden=false where id=public.fixture_uuid(21);
"
for mode in caster request; do
  if [[ "$mode" == caster ]]; then
    lock_sql="select id from public.encounter_participants where id=public.fixture_uuid(11) for update;"
    n=620; barrier=480620
  else
    lock_sql="insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by) values(public.fixture_uuid(621),public.fixture_uuid(1),public.fixture_uuid(21),'weapon_attack',public.fixture_uuid(42));"
    n=621; barrier=480621
  fi
  hp_before=$(psql -X -v ON_ERROR_STOP=1 -At -c "select current_hp from public.encounter_participants where id=public.fixture_uuid(21);")
  version_before=$(psql -X -v ON_ERROR_STOP=1 -At -c "select version from public.encounters where id=public.fixture_uuid(1);")
  blocker_log=$(mktemp); candidate_log=$(mktemp)
  psql -X -v ON_ERROR_STOP=1 -q -c "
    BEGIN;
    $lock_sql
    select pg_advisory_lock($barrier);
    select pg_sleep(5);
    ROLLBACK;
    select pg_advisory_unlock($barrier);
  " >"$blocker_log" 2>&1 &
  blocker=$!
  trap 'kill "$blocker" 2>/dev/null || true; rm -f "$blocker_log" "$candidate_log"' EXIT
  ready=0
  for attempt in $(seq 1 100); do
    if ! kill -0 "$blocker" 2>/dev/null; then
      cat "$blocker_log"; echo "Blocker exited early" >&2; exit 1
    fi
    held=$(psql -X -v ON_ERROR_STOP=1 -At -c "select pg_try_advisory_lock($barrier);")
    if [[ "$held" == f ]]; then ready=1; break; fi
    sleep 0.05
  done
  if [[ "$ready" != 1 ]]; then echo "Lock barrier failed" >&2; exit 1; fi
  set +e
  psql -X -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -At -c "
    select set_config('fixture.role','authenticated',false);
    select set_config('fixture.uid',public.fixture_uuid(41)::text,false);
    select private.encounter_eldritch_blast_candidate_v1(
      public.fixture_uuid(11),public.fixture_uuid(51),
      array[public.fixture_uuid(21)],public.fixture_uuid($n));
  " >"$candidate_log" 2>&1
  rc=$?
  set -e
  if [[ "$rc" == 0 ]] || ! grep -q 55P03 "$candidate_log" ||
     ! grep -qi 'canceling statement due to lock timeout' "$candidate_log"; then
    cat "$candidate_log"; echo "$mode did not hit function-scoped lock timeout" >&2; exit 1
  fi
  wait "$blocker"; trap - EXIT
  hp_after=$(psql -X -v ON_ERROR_STOP=1 -At -c "select current_hp from public.encounter_participants where id=public.fixture_uuid(21);")
  version_after=$(psql -X -v ON_ERROR_STOP=1 -At -c "select version from public.encounters where id=public.fixture_uuid(1);")
  command_count=$(psql -X -v ON_ERROR_STOP=1 -At -c "select count(*) from public.encounter_command_requests where request_id=public.fixture_uuid($n);")
  log_count=$(psql -X -v ON_ERROR_STOP=1 -At -c "select count(*) from public.encounter_combat_log where detail->>'requestId'=public.fixture_uuid($n)::text;")
  action=$(psql -X -v ON_ERROR_STOP=1 -At -c "select action_available from public.encounter_participants where id=public.fixture_uuid(11);")
  if [[ "$hp_after" != "$hp_before" || "$version_after" != "$version_before" ||
        "$command_count" != 0 || "$log_count" != 0 || "$action" != t ]]; then
    echo "Partial combat state mutation in $mode" >&2; exit 1
  fi
  rm -f "$blocker_log" "$candidate_log"
  echo "PG16 held-$mode: bounded 55P03 and no writes PASS"
done
