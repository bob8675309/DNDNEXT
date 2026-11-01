-- P2 READ-ONLY live Supabase verification; no user state, mutation or casting.
-- Re-execute manually against authorized Supabase project via SELECT only.
-- Compare all 22 names + MD5/grants/order with research snapshot.
with f as (
 select p.oid,p.proname,pg_get_functiondef(p.oid) def,
        has_function_privilege('anon',p.oid,'execute') anon_execute,
        has_function_privilege('authenticated',p.oid,'execute') authenticated_execute,
        has_function_privilege('service_role',p.oid,'execute') service_execute
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'encounter_cast_%'
)
select proname,md5(def) definition_md5,anon_execute,authenticated_execute,service_execute,
  case when strpos(lower(def),'insert into public.encounter_command_requests')>0
       then 'processor-ledger-first' else 'wrapper-or-delegator' end source_family,
  strpos(lower(def),'insert into public.encounter_command_requests') ledger_insert_pos,
  strpos(lower(def),'for update') first_row_lock_pos,
  strpos(lower(def),'encounter_can_control_participant_v1(') controller_guard_pos,
  strpos(lower(def),'return coalesce(v_existing.result') cached_replay_pos
from f order by proname;

-- Inspect which catalog-specific inputs must be bound on request replay:
-- single target, chosen targets, allocated darts, area origin, facing/slot.
select p.proname,pg_get_function_identity_arguments(p.oid) args,
  has_function_privilege('authenticated',p.oid,'execute') authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'encounter_cast_%'
order by p.proname;
