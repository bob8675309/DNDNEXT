-- I1-L SELECT-only-extracted source candidate; research-only single-condition correction.
-- ONLY for disposable local PG17 *after* genuine signed original-source RED reproducer.
-- Original full source in i1l_artificer_original_plan_materializer_pg17.sql is unchanged.
\set ON_ERROR_STOP on
DO $candidate_pre$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR md5(pg_get_functiondef('private.sync_character_artificer_plan_projection_v1(uuid)'::regprocedure))<>'5ebf572db01143e9b523c7dba0d43ad5'
 OR md5(pg_get_functiondef('private.materialize_player_forge_artificer_plans_v1()'::regprocedure))<>'67766989a466b82f170b5e00f9154e24'
 THEN RAISE EXCEPTION 'I1-L candidate only after unchanged original source repro in disposable local PG17'; END IF;
END $candidate_pre$;

-- One and only one change compared with original pg_get_functiondef:
-- ORIGINAL: if jsonb_typeof(v_sheet->'classFeatureChoices')<>'object' then
-- CANDIDATE: if coalesce(jsonb_typeof(v_sheet->'classFeatureChoices'),'')<>'object' then
-- This repairs SQL NULL three-valued logic while preserving original content.
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

  if coalesce(jsonb_typeof(v_sheet->'classFeatureChoices'),'')<>'object' then
    v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}','{}'::jsonb,true);
  end if;
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices,artificer-magic-item-plans}',v_group,true);

  update public.character_sheets set sheet=v_sheet,updated_at=now()
  where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(
    select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id
  );
end;
$function$;
DO $candidate_post$
DECLARE v_body text;
BEGIN
 v_body:=pg_get_functiondef('private.sync_character_artificer_plan_projection_v1(uuid)'::regprocedure);
 IF md5(v_body)='5ebf572db01143e9b523c7dba0d43ad5'
 OR md5(replace(v_body,
 'if coalesce(jsonb_typeof(v_sheet->''classFeatureChoices''),'''')<>''object'' then',
 'if jsonb_typeof(v_sheet->''classFeatureChoices'')<>''object'' then')) <> '5ebf572db01143e9b523c7dba0d43ad5'
 OR md5(pg_get_functiondef('private.materialize_player_forge_artificer_plans_v1()'::regprocedure))<>'67766989a466b82f170b5e00f9154e24'
 THEN RAISE EXCEPTION 'I1-L candidate must differ from exact original by one NULL-safe parent check only'; END IF;
END $candidate_post$;
\echo 'PASS I1L-CANDIDATE: disposable-only NULL-safe classFeatureChoices parent initializer, original Artificer trigger/validator/eligibility unchanged'
