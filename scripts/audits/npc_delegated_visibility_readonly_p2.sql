-- 2026-11-01 P2 NPC controller SOURCE/SECURITY review.
-- SELECT ONLY: never invoke production casting or assignment RPCs.
-- Reverify before release; these are dated read-only observations.
select n.nspname||'.'||p.proname function_name,
  pg_get_function_identity_arguments(p.oid) parameters,
  md5(pg_get_functiondef(p.oid)) body_md5,
  has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
  has_function_privilege('anon',p.oid,'EXECUTE') anonymous_execute,
  strpos(lower(pg_get_functiondef(p.oid)),'cp.can_control') can_control_reference,
  strpos(lower(pg_get_functiondef(p.oid)),'cp.can_edit') edit_reference,
  strpos(lower(pg_get_functiondef(p.oid)),'jsonb_agg') profile_aggregation
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='private' and p.proname='can_access_character_v1')
   or (n.nspname='public' and p.proname in (
       'encounter_can_control_participant_v1',
       'encounter_spellcasting_profile_v1','is_admin'))
order by function_name,parameters;

select c.relname table_name,c.relrowsecurity rls_enabled,
 has_table_privilege('authenticated',c.oid,'SELECT') authenticated_select,
 has_table_privilege('authenticated',c.oid,'UPDATE') authenticated_update,
 has_table_privilege('anon',c.oid,'SELECT') anonymous_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in (
 'characters','character_sheets','character_spells','character_permissions',
 'encounter_participants','inventory_items','user_profiles','players')
order by c.relname;

select c.relname table_name,pol.polname policy_name,pol.polcmd command,
 pg_get_expr(pol.polqual,pol.polrelid) using_expression,
 pg_get_expr(pol.polwithcheck,pol.polrelid) with_check_expression
from pg_policy pol join pg_class c on c.oid=pol.polrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in (
 'characters','character_sheets','character_spells','character_permissions',
 'encounter_participants','inventory_items')
order by c.relname,pol.polname;

-- Inspect profile's actual filtering rather than assuming it returns only
-- prepared/known spells. Private action authorization and hidden sheet access
-- are distinct from the tactical spellcasting profile.
select p.proname,
 position('from public.character_spells a' in lower(pg_get_functiondef(p.oid))) > 0
  as source_spells_join_present,
 position('where a.character_id=v_participant.character_id' in
  lower(pg_get_functiondef(p.oid))) > 0 as assignment_character_filter_present,
 position('and a.known' in lower(pg_get_functiondef(p.oid))) > 0 as known_predicate_present,
 position('and a.prepared' in lower(pg_get_functiondef(p.oid))) > 0 as prepared_predicate_present
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='encounter_spellcasting_profile_v1';
