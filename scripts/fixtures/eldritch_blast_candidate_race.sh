#!/usr/bin/env bash
set -euo pipefail
# TWO SEPARATE DB clients; only mock claims, not real Supabase JWTs.
psql -X -v ON_ERROR_STOP=1 -q -c "
update public.encounters set status='active',active_participant_id=public.fixture_uuid(11);
update public.encounter_participants set action_available=true where id=public.fixture_uuid(11);
update public.character_progression set class_level=3 where character_id=public.fixture_uuid(31);
delete from public.fixture_rolls;
"
sql="select set_config('fixture.role','authenticated',false);
select set_config('fixture.uid',public.fixture_uuid(41)::text,false);
select private.encounter_eldritch_blast_candidate_v1(
 public.fixture_uuid(11),public.fixture_uuid(51),
 array[public.fixture_uuid(21)],public.fixture_uuid(200))::text;"
psql -X -v ON_ERROR_STOP=1 -At -c "$sql" >/tmp/eb-cast1 2>&1 &
p1=$!
psql -X -v ON_ERROR_STOP=1 -At -c "$sql" >/tmp/eb-cast2 2>&1 &
p2=$!
wait "$p1" || { cat /tmp/eb-cast1; exit 1; }
wait "$p2" || { cat /tmp/eb-cast2; exit 1; }
tail -n 1 /tmp/eb-cast1 >/tmp/eb-res1
tail -n 1 /tmp/eb-cast2 >/tmp/eb-res2
cmp /tmp/eb-res1 /tmp/eb-res2
psql -X -v ON_ERROR_STOP=1 -c "do \$t\$
begin
if (select count(*) from public.encounter_command_requests
    where request_id=public.fixture_uuid(200))<>1
or (select count(*) from public.encounter_combat_log
    where detail->>'requestId'=public.fixture_uuid(200)::text)<>1
or (select action_available from public.encounter_participants
    where id=public.fixture_uuid(11)) is distinct from false
then raise exception 'Concurrent duplicate attack mutated twice';end if;
end \$t\$;"
echo "Two-client identical request: one damage/log/action, matching result PASS"
