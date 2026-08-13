-- Defensive follow-up for legacy sheets that might not yet have a classFeatureChoices object.
create or replace function private.sync_character_artificer_plan_projection_v1(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
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
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(
    select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id
  );
end;
$$;

revoke all on function private.sync_character_artificer_plan_projection_v1(uuid) from public;
grant execute on function private.sync_character_artificer_plan_projection_v1(uuid) to service_role;
