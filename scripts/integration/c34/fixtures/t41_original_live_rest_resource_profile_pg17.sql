-- Source-EXACT live pg_get_functiondef for private.character_sheet_resource_profile_json_v1(uuid).
-- Copied from held original PR #364 immutable Git blob 039868c4ac5cdd62e0efc1e46f584df2bdc34a9c.
-- Expected pg_get_functiondef MD5 2c798f8351282d80e63ab8e9e9019272.
-- Scratch-only: this is NOT a production migration, and no original body below is edited.
DO $t41guard$ BEGIN
  IF current_database()<>'postgres'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR to_regclass('auth.users') IS NULL
  OR to_regclass('private.test_admins') IS NULL
  OR to_regclass('public.character_rest_log') IS NULL
  THEN RAISE EXCEPTION 'T41 original Rest helper may run only after signed C34 local PG17 schema'; END IF;
END $t41guard$;
CREATE OR REPLACE FUNCTION private.character_sheet_resource_profile_json_v1(p_character_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_class_key text;
  v_class_name text;
  v_class_level integer;
  v_slots jsonb:='[]'::jsonb;
  v_spell_uses jsonb:='[]'::jsonb;
  v_last_short timestamptz;
  v_last_long timestamptz;
begin
  select c.class_key,c.class_name,cp.class_level
  into v_class_key,v_class_name,v_class_level
  from public.character_progression cp
  join public.class_catalog c on c.id=cp.class_id
  where cp.character_id=p_character_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'poolKey',s.pool_key,'slotLevel',s.slot_level,'max',s.slots_max,'remaining',s.slots_remaining,
    'rechargeKey',s.recharge_key,'sourceClassKey',s.source_class_key,'sourceBook',s.source_book,
    'sourceRuleset',s.source_ruleset,'sourceClassLevel',s.source_class_level
  ) order by s.pool_key,s.slot_level),'[]'::jsonb)
  into v_slots
  from public.character_spell_slots s
  where s.character_id=p_character_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId',cs.id,
    'spellId',sp.id,
    'name',sp.name,
    'resourceLabel',coalesce(nullif(cs.raw_payload->>'resourceLabel',''),sp.name),
    'resourceFeature',nullif(cs.raw_payload->>'resourceFeature',''),
    'level',sp.level,
    'max',cs.uses_max,
    'remaining',coalesce(cs.uses_remaining,cs.uses_max),
    'recharge',cs.recharge,
    'sourceType',cs.source_type,
    'sourceLabel',cs.source_label
  ) order by sp.level,sp.name,cs.created_at),'[]'::jsonb)
  into v_spell_uses
  from public.character_spells cs
  join public.spells_catalog sp on sp.id=cs.spell_id
  where cs.character_id=p_character_id and cs.uses_max is not null and cs.uses_max>0;

  select max(completed_at) filter(where rest_type='short_rest'),
         max(completed_at) filter(where rest_type='long_rest')
  into v_last_short,v_last_long
  from public.character_rest_log
  where character_id=p_character_id;

  return jsonb_build_object(
    'schemaVersion',1,
    'characterId',p_character_id,
    'classKey',v_class_key,
    'className',v_class_name,
    'classLevel',v_class_level,
    'canManage',true,
    'slots',coalesce(v_slots,'[]'::jsonb),
    'limitedSpellUses',coalesce(v_spell_uses,'[]'::jsonb),
    'lastShortRest',v_last_short,
    'lastLongRest',v_last_long
  );
end;
$function$
;
REVOKE ALL ON FUNCTION private.character_sheet_resource_profile_json_v1(uuid) FROM PUBLIC,anon,authenticated;
