-- DNDNext P1.1 read-only SQL inventory. SELECT statements only; no calls to mutating RPCs.
-- Run on DnDWeb with a suitable read-only database session.
-- NEVER copy a historical function body back into production.

-- Public authenticated direct command-ledger writers, including role grants and definition fingerprints.
with funcs as (
 select p.oid, p.proname,
   pg_get_function_identity_arguments(p.oid) as signature,
   pg_get_functiondef(p.oid) as def
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'
)
select proname,signature,md5(def) as definition_md5,
 has_function_privilege('authenticated',oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('anon',oid,'EXECUTE') as anon_execute,
 position('v_existing.requested_by' in def)>0 as compares_original_requested_by
from funcs where def ~* 'insert[[:space:]]+into[[:space:]]+public[.]encounter_command_requests'
order by proname;

-- All visible public cast versions, including wrapper and historical direct variants.
select p.proname,pg_get_function_identity_arguments(p.oid) as signature,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 md5(pg_get_functiondef(p.oid)) as definition_md5
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'encounter_cast_%'
order by p.proname;

-- Authenticated public routines with direct encounter/character spell writes.
with funcs as (
 select p.oid,p.proname,pg_get_functiondef(p.oid) as def
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and has_function_privilege('authenticated',p.oid,'EXECUTE')
)
select proname,
 def ~* '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.]encounter' as direct_encounter_write,
 def ~* '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.]character_spell' as direct_character_spell_write
from funcs
where def ~* '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public\\.(encounter|character_spell)'
order by proname;

-- Ledger structure, grants and table RLS (never print live user data).
select c.relname,c.relrowsecurity,
 has_table_privilege('authenticated',c.oid,'SELECT') as auth_select,
 has_table_privilege('authenticated',c.oid,'INSERT') as auth_insert,
 has_table_privilege('authenticated',c.oid,'UPDATE') as auth_update
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p')
and c.relname in ('encounter_command_requests','encounter_participants','encounters','encounter_spell_slots','character_spell_slots','character_spells','character_rest_log')
order by c.relname;

select conrelid::regclass::text as table_name,conname,pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid='public.encounter_command_requests'::regclass
order by conname;

-- Trigger graph for shared state. Definition text, not row data.
select t.tgrelid::regclass::text as table_name,t.tgname,pg_get_triggerdef(t.oid) as definition
from pg_trigger t where not t.tgisinternal
and t.tgrelid in ('public.encounter_participants'::regclass,
'public.encounters'::regclass,'public.encounter_spell_slots'::regclass,
'public.character_spell_slots'::regclass,'public.character_spells'::regclass,
'public.character_rest_log'::regclass)
order by 1,2;

-- Aggregate evidence ONLY; no actor IDs or protected campaign details.
select count(distinct e.id) as active_encounters,
 count(*) as active_character_participations,
 count(distinct p.character_id) as distinct_active_characters,
 (select count(*) from (select p2.character_id from public.encounter_participants p2
  join public.encounters e2 on e2.id=p2.encounter_id
  where e2.status='active' and p2.character_id is not null
  group by p2.character_id having count(distinct e2.id)>1) x) as characters_in_multiple_active_encounters
from public.encounter_participants p join public.encounters e on e.id=p.encounter_id
where e.status='active' and p.character_id is not null;
