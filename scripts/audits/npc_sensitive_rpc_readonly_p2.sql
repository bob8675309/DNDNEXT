-- P2 SELECT-ONLY. Re-run against connected production; no RPC is invoked.
-- MD5 values and grants below are historical evidence, NOT migrations.
with functions as (
 select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,
   p.prosecdef security_definer,pg_get_function_result(p.oid) result_type,
   md5(pg_get_functiondef(p.oid)) definition_md5,
   has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_exec,
   has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,
   lower(pg_get_functiondef(p.oid)) definition
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prokind='f'
)
select proname,args,result_type,definition_md5,security_definer,
 authenticated_exec,anon_exec,
 position('character_sheets' in definition)>0 references_character_sheets,
 position('character_spells' in definition)>0 references_character_spells,
 position('encounter_spellcasting_profile_v1' in definition)>0 calls_v1,
 position('private.can_access_character_v1' in definition)>0 source_access_guard,
 position('private.can_manage_character_progression_v1' in definition)>0 progression_guard,
 position('encounter_can_control_participant_v1' in definition)>0 controller_guard
from functions
where authenticated_exec and security_definer and (
 proname in ('encounter_spellcasting_profile_v1',
             'encounter_spellcasting_profile_v2',
             'get_character_secrets_v1',
             'get_my_player_character_v1',
             'get_my_player_characters_v2',
             'get_character_inventory_v1',
             'get_character_currency_v1',
             'get_character_invocation_recovery_v1')
 or definition like '%encounter_spellcasting_profile_v1%'
 or definition like '%character_sheets%'
 or definition like '%character_spells%'
)
order by proname,args;

with functions as (
select p.oid,p.prosecdef security_definer,
has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_exec,
has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,
lower(pg_get_functiondef(p.oid)) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f')
select count(*) filter(where security_definer and authenticated_exec) authenticated_definer_count,
count(*) filter(where security_definer and authenticated_exec and definition like '%character_sheets%') direct_sheet_reference_count,
count(*) filter(where security_definer and authenticated_exec and definition like '%character_spells%') direct_spell_assignment_reference_count,
count(*) filter(where security_definer and authenticated_exec and definition like '%encounter_spellcasting_profile_v1%') v1_profile_caller_count,
count(*) filter(where security_definer and anon_exec) anonymous_definer_count
from functions;

select c.relname table_name,c.relrowsecurity rls_enabled,
has_table_privilege('authenticated',c.oid,'SELECT') authenticated_select,
has_table_privilege('anon',c.oid,'SELECT') anonymous_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('characters','character_permissions','character_sheets','character_spells',
  'inventory_items','encounter_participants','character_spell_slots',
  'encounter_spell_slots')
order by table_name;

select t.relname table_name,p.polname policy_name,p.polcmd command,
pg_get_expr(p.polqual,p.polrelid) using_clause,
pg_get_expr(p.polwithcheck,p.polrelid) with_check
from pg_policy p join pg_class t on t.oid=p.polrelid
join pg_namespace n on n.oid=t.relnamespace
where n.nspname='public' and t.relname in
 ('characters','character_permissions','character_sheets',
  'character_spells','encounter_participants')
order by table_name,policy_name;
