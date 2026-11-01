-- PG17 ONLY: local real GoTrue/PostgREST, not a production migration.
-- Legacy ledger has NO request_intent column. Add it ONLY to disposable
-- fixture as the required versioned typed intent storage experiment.
alter table public.encounter_command_requests
 add column request_intent jsonb;
\i sql/candidates/20261101_core_action_encounter_first_private_candidate.sql

do $acl$
begin
 if has_function_privilege('anon',
    'private.encounter_core_action_transaction_candidate_v1(uuid,text,uuid)','EXECUTE')
  or has_function_privilege('authenticated',
    'private.encounter_core_action_transaction_candidate_v1(uuid,text,uuid)','EXECUTE')
  or has_function_privilege('service_role',
    'private.encounter_core_action_transaction_candidate_v1(uuid,text,uuid)','EXECUTE')
 then raise exception 'Held private core-action candidate is directly callable'; end if;
end $acl$;

-- LOCAL SIGNED-IN ADAPTER ONLY. This is deliberately NOT in the candidate.
create or replace function public.p2_local_core_action_candidate(
  p_participant_id uuid,p_action text,p_request_id uuid
) returns jsonb language sql security definer
set search_path='pg_catalog','public','private','auth'
as $local$
select private.encounter_core_action_transaction_candidate_v1(
 p_participant_id,p_action,p_request_id)
$local$;
revoke all on function public.p2_local_core_action_candidate(uuid,text,uuid)
 from public,anon,service_role;
grant execute on function public.p2_local_core_action_candidate(uuid,text,uuid)
 to authenticated;
notify pgrst,'reload schema';
