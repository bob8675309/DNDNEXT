-- DNDNext P1.3 — 2026-11-04 repeatable SOURCE INSPECTION ONLY.
-- SELECT/CTE only. No DDL, production mutations, locks, fake auth roles, or data access.
SELECT n.nspname || '.' || p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       md5(pg_get_functiondef(p.oid)) AS source_md5,
       p.prosecdef AS security_definer,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       pg_get_functiondef(p.oid) AS source_definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public','private') AND p.prokind='f'
AND p.proname IN (
  'set_character_inventory_equipment_v1','transfer_inventory_item_v1',
  'accept_trade','buy_from_merchant','complete_craft_plan_v1_impl',
  'complete_enchanting_craft_plan_v1_impl','materialize_player_forge_starting_equipment_v1',
  'materialize_player_forge_starting_equipment_trigger_v1',
  'create_player_character_v1','create_player_character_v2',
  'complete_character_level_up_base_v3','can_access_character_v1',
  'get_my_player_character_v1','get_my_player_characters_v2',
  'encounter_spellcasting_profile_v1','encounter_spellcasting_profile_v2',
  'get_character_inventory_v1','character_equipment_effects_v1')
ORDER BY 1, 2;

SELECT c.oid::regclass::text AS relation_name, t.tgname,
       pg_get_triggerdef(t.oid, true) AS trigger_definition,
       n.nspname || '.' || p.proname AS trigger_function,
       md5(pg_get_functiondef(p.oid)) AS trigger_function_md5
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace cn ON cn.oid=c.relnamespace
JOIN pg_proc p ON p.oid=t.tgfoid
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE NOT t.tgisinternal AND cn.nspname='public'
  AND c.relname IN ('character_permissions','inventory_items',
     'character_sheets','character_progression','character_spell_slots',
     'encounter_spell_slots','encounters','encounter_participants',
     'craft_plans','crafting_attempts','trade_requests')
ORDER BY 1,2;

WITH defs AS (
SELECT n.nspname AS schema_name,p.proname AS function_name,
       pg_get_functiondef(p.oid) AS body,md5(pg_get_functiondef(p.oid)) AS source_md5
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','private') AND p.prokind='f'
)
SELECT schema_name,function_name,source_md5 FROM defs
WHERE body ~* '(update|insert[[:space:]]+into|delete[[:space:]]+from)[[:space:]]+(public[.])?character_permissions'
ORDER BY 1,2;

SELECT tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies
WHERE schemaname='public'
AND tablename IN ('characters','character_sheets','character_permissions',
                  'inventory_items','character_spells','encounter_participants')
ORDER BY tablename,policyname;

SELECT has_table_privilege('authenticated','public.characters','SELECT')
       AS character_table_select,
       has_column_privilege('authenticated','public.characters','secret','SELECT')
       AS character_secret_column_select,
       has_table_privilege('authenticated','public.character_sheets','SELECT')
       AS sheet_table_select,
       has_column_privilege('authenticated','public.character_sheets','sheet','SELECT')
       AS sheet_json_column_select;
