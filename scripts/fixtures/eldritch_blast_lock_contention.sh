#!/usr/bin/env bash
set -euo pipefail
# DISPOSABLE PG16 ONLY. Model both live lock-order inversions. Never run
# against production or against a non-disposable Supabase instance.
psql -X -v ON_ERROR_STOP=1 -q -c "
 update public.encounters set status='active',active_participant_id=public.fixture_uuid(11);
 update public.character_progression set class_level=3 where character_id=public.fixture_uuid(31);
 update public.encounter_participants set action_available=true where id=public.fixture_uuid(11);
 update public.encounter_participants set q=4,r=0,is_hidden=false where id=public.fixture_uuid(21);
"
for mode in target encounter; do
  if [[ "$mode" == target ]]; then
    first_lock="select id from public.encounter_participants where id=public.fixture_uuid(21) for update;"
    second_lock="select id from public.encounters where id=public.fixture_uuid(1) for update;"
    n=610; lock_key=480610
  else
    first_lock="select id from public.encounters where id=public.fixture_uuid(1) for update;"
    second_lock="select id from public.encounter_participants where id=public.fixture_uuid(11) for update;"
    n=611; lock_key=480611
  fi
  hp_before=$(psql -X -v ON_ERROR_STOP=1 -At -c "select current_hp from public.encounter_participants where id=public.fixture_uuid(21);")
  version_before=$(psql -X -v ON_ERROR_STOP=1 -At -c "select version from public.encounters where id=public.fixture_uuid(1);")
  blocker_log=$(mktemp)
  candidate_log=$(mktemp)
  psql -X -v ON_ERROR_STOP=1 -q -c "
    begin;
    $first_lock
    select pg_advisory_lock($lock_key);
    select pg_sleep(5);
    $second_lock
    commit;
    select pg_advisory_unlock($lock_key);
  " >"$blocker_log" 2>&1 &
  blocker=$!
  trap 'kill "$blocker" 2>/dev/null || true' EXIT
  ready=0
  for attempt in $(seq 1 100); do
    if ! kill -0 "$blocker" 2>/dev/null; then
      cat "$blocker_log"; echo "Blocker exited before readiness" >&2; exit 1
    fi
    held=$(psql -X -v ON_ERROR_STOP=1 -At -c "select pg_try_advisory_lock($lock_key);")
    if [[ "$held" == f ]]; then ready=1; break; fi
    sleep 0.05
  done
  if [[ "$ready" != 1 ]]; then
    cat "$blocker_log"; echo "No deterministic lock barrier" >&2; exit 1
  fi
  set +e
  psql -X -v ON_ERROR_STOP=1 -At -c "
    select set_config('fixture.role','authenticated',false);
    select set_config('fixture.uid',public.fixture_uuid(41)::text,false);
    select private.encounter_eldritch_blast_candidate_v1(
      public.fixture_uuid(11),public.fixture_uuid(51),
      array[public.fixture_uuid(21)],public.fixture_uuid($n));
  " >"$candidate_log" 2>&1
  rc=$?
  set -e
  if [[ "$rc" == 0 ]] || ! grep -qi 'could not obtain lock' "$candidate_log"; then
    cat "$candidate_log"; echo "Contended $mode lock failed to reject immediately" >&2; exit 1
  fi
  wait "$blocker"
  trap - EXIT
  hp_after=$(psql -X -v ON_ERROR_STOP=1 -At -c "select current_hp from public.encounter_participants where id=public.fixture_uuid(21);")
  version_after=$(psql -X -v ON_ERROR_STOP=1 -At -c "select version from public.encounters where id=public.fixture_uuid(1);")
  command_count=$(psql -X -v ON_ERROR_STOP=1 -At -c "select count(*) from public.encounter_command_requests where request_id=public.fixture_uuid($n);")
  log_count=$(psql -X -v ON_ERROR_STOP=1 -At -c "select count(*) from public.encounter_combat_log where detail->>'requestId'=public.fixture_uuid($n)::text;")
  action=$(psql -X -v ON_ERROR_STOP=1 -At -c "select action_available from public.encounter_participants where id=public.fixture_uuid(11);")
  if [[ "$hp_after" != "$hp_before" || "$version_after" != "$version_before" || "$command_count" != 0 || "$log_count" != 0 || "$action" != t ]]; then
    echo "Contended $mode cast changed state: HP $hp_before/$hp_after, version $version_before/$version_after, commands=$command_count, logs=$log_count, Action=$action" >&2
    exit 1
  fi
  rm -f "$blocker_log" "$candidate_log"
  echo "PG16 $mode-row contention: immediate rejection and full rollback PASS"
done
