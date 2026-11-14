-- C34 T17 Option A compatibility CANDIDATE deliberately NON-ORIGINAL.
-- Original held #360 six source bodies and deferred DDL preserved unchanged.
-- Original private.sync_character_artificer_plan_projection_v1 MD5
-- 5ebf572db01143e9b523c7dba0d43ad5.
-- This candidate ONLY removes the cross-account legacy UPDATE; it does NOT
-- silently correct the original NULL-parent conditional (tracked separately).
-- The canonical authenticated Forge serializer supplies classFeatureChoices={}:
-- do not confuse this bounded signed path with generic legacy-sheet repair.
\set ON_ERROR_STOP on
DO $t17_safe_pre$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR md5(pg_get_functiondef('private.sync_character_artificer_plan_projection_v1(uuid)'::regprocedure))<>'5ebf572db01143e9b523c7dba0d43ad5'
 OR md5(pg_get_functiondef('private.materialize_player_forge_artificer_plans_v1()'::regprocedure))<>'67766989a466b82f170b5e00f9154e24'
 THEN RAISE EXCEPTION 'T17 Option A requires source-original Artificer RED fixture'; END IF;
END $t17_safe_pre$;

CREATE OR REPLACE FUNCTION private.sync_character_artificer_plan_projection_v1(p_character_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_sheet jsonb;
  v_selections jsonb;
  v_group jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets
  where character_id=p_character_id
  for update;
  if v_sheet is null then return; end if;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'key',o.option_key,
    'name',o.name,
    'source',o.source,
    'kind','artificer-plan',
    'instanceKey',gi.instance_key,
    'acquiredLevel',gi.acquired_level,
    'item',case when gi.choices ? 'child' then gi.choices->'child' else null end
  )) order by gi.instance_key),'[]'::jsonb)
  into v_selections
  from public.character_class_option_grant_instances gi
  join public.class_feature_option_catalog o on o.id=gi.option_catalog_id
  where gi.character_id=p_character_id
    and gi.option_type='artificer-plan';

  v_group:=jsonb_build_object(
    'label','Magic Item Plans',
    'kind','artificer-plan',
    'sourceFeature','Replicate Magic Item',
    'source','EFA',
    'level',2,
    'count',jsonb_array_length(v_selections),
    'placement','class',
    'subclassName',null,
    'cadence','creation',
    'replacementCadence','level-up',
    'selections',v_selections,
    'normalizedAuthority',true
  );

  if jsonb_typeof(v_sheet->'classFeatureChoices')<>'object' then
    v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}','{}'::jsonb,true);
  end if;
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices,artificer-magic-item-plans}',v_group,true);

  update public.character_sheets set sheet=v_sheet,updated_at=now()
  where character_id=p_character_id;
  -- T17 Option A scoped projection: account-wide players.sheet mirror REMOVED.
  -- All source-original validation, canonical sheet projection and locks remain.
end;
$function$;
REVOKE ALL ON FUNCTION private.sync_character_artificer_plan_projection_v1(uuid) FROM PUBLIC,anon,authenticated;
DO $t17_safe_post$
DECLARE d text;
BEGIN
 d:=lower(pg_get_functiondef('private.sync_character_artificer_plan_projection_v1(uuid)'::regprocedure));
 IF position('update public.players' in d)>0
 OR md5(d)='5ebf572db01143e9b523c7dba0d43ad5'
 OR md5(pg_get_functiondef('private.materialize_player_forge_artificer_plans_v1()'::regprocedure))<>'67766989a466b82f170b5e00f9154e24'
 OR has_function_privilege('authenticated','private.sync_character_artificer_plan_projection_v1(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'T17 Option A account-mirror removal or original handler drift'; END IF;
END $t17_safe_post$;
\echo 'PASS C34 T17 explicit non-original Artificer Option A helper, no players.sheet mirror (local only)'
