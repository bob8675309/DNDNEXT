-- Correct the staged Circle of the Land source parser before live deployment.
-- Migration 58 intentionally parses the imported XPHB table instead of baking a
-- remembered spell list. This follow-up fixes PostgreSQL record-column handling
-- and level-filtered spell deduplication discovered during pre-deploy review.

create or replace function private.circle_land_spell_matrix_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_table jsonb:=private.circle_land_source_table_v1();
  v_level_col integer;
  v_land record;
  v_land_col integer;
  v_row jsonb;
  v_level integer;
  v_cell jsonb;
  v_spell_name text;
  v_spell public.spells_catalog%rowtype;
  v_spells jsonb;
  v_unlocks jsonb;
  v_result jsonb:='[]'::jsonb;
begin
  select ordinality-1 into v_level_col
  from jsonb_array_elements_text(v_table->'colLabels') with ordinality c(label,ordinality)
  where lower(c.label) like '%druid%' and lower(c.label) like '%level%'
  limit 1;
  if v_level_col is null then v_level_col:=0; end if;

  for v_land in
    select * from (values
      ('arid','Arid'),('polar','Polar'),('temperate','Temperate'),('tropical','Tropical')
    ) as lands(key,name)
  loop
    select ordinality-1 into v_land_col
    from jsonb_array_elements_text(v_table->'colLabels') with ordinality c(label,ordinality)
    where lower(btrim(c.label))=lower(v_land.name)
    limit 1;
    if v_land_col is null then
      raise exception 'Circle Spells source table is missing the % column.',v_land.name;
    end if;

    v_unlocks:='[]'::jsonb;
    for v_row in select value from jsonb_array_elements(v_table->'rows') loop
      if jsonb_typeof(v_row)<>'array' or jsonb_array_length(v_row)<=greatest(v_level_col,v_land_col) then continue; end if;
      v_level:=nullif(regexp_replace(coalesce(v_row->>v_level_col,''),'[^0-9]','','g'),'')::integer;
      if v_level is null then continue; end if;
      v_cell:=v_row->v_land_col;
      v_spells:='[]'::jsonb;
      foreach v_spell_name in array private.circle_land_spell_names_from_cell_v1(v_cell) loop
        select * into v_spell
        from public.spells_catalog_preferred
        where lower(name)=lower(v_spell_name) and source='XPHB'
        limit 1;
        if not found then
          raise exception 'Circle Spells source spell % could not be resolved to a preferred XPHB catalogue row.',v_spell_name;
        end if;
        if not exists(
          select 1 from jsonb_array_elements(v_spells) existing
          where existing->>'spellId'=v_spell.id::text
        ) then
          v_spells:=v_spells||jsonb_build_array(jsonb_build_object(
            'spellId',v_spell.id,'name',v_spell.name,'spellLevel',v_spell.level,'source',v_spell.source
          ));
        end if;
      end loop;
      if jsonb_array_length(v_spells)=0 then
        raise exception 'Circle Spells source table produced no spells for % at Druid level %.',v_land.name,v_level;
      end if;
      v_unlocks:=v_unlocks||jsonb_build_array(jsonb_build_object('druidLevel',v_level,'spells',v_spells));
    end loop;
    if jsonb_array_length(v_unlocks)=0 then
      raise exception 'Circle Spells source table produced no unlock rows for %.',v_land.name;
    end if;
    v_result:=v_result||jsonb_build_array(jsonb_build_object('key',v_land.key,'name',v_land.name,'source','XPHB','unlocks',v_unlocks));
  end loop;

  return v_result;
end;
$$;

create or replace function public.get_character_circle_land_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_latest_long_rest timestamptz;
  v_acquired_at timestamptz;
  v_level integer;
  v_configured boolean:=false;
  v_can_configure boolean:=false;
  v_matrix jsonb:=private.circle_land_spell_matrix_v1();
  v_options jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Circle of the Land spells for this character.' using errcode='42501';
  end if;
  if not private.character_has_circle_land_spells_v1(p_character_id) then
    return jsonb_build_object('available',false,'reason','Circle Spells requires an XPHB Druid with Circle of the Land at the feature level.');
  end if;

  select cp.class_level into v_level from public.character_progression cp where cp.character_id=p_character_id;
  v_acquired_at:=private.circle_land_spells_acquired_at_v1(p_character_id);
  select max(completed_at) into v_latest_long_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type='long_rest';

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='circle-of-the-land';

  v_configured:=found
    and coalesce((v_runtime.state->>'configured')::boolean,false)
    and coalesce(v_runtime.state->>'landKey','') in ('arid','polar','temperate','tropical')
    and v_latest_long_rest is not null
    and nullif(v_runtime.state->>'configuredRestAt','')::timestamptz=v_latest_long_rest;

  v_can_configure:=not v_configured
    and v_latest_long_rest is not null
    and v_acquired_at is not null
    and v_latest_long_rest>v_acquired_at;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',land->>'key','name',land->>'name','source','XPHB',
    'spells',coalesce((
      select jsonb_agg(d.spell order by d.spell->>'name')
      from (
        select distinct on (spell->>'spellId') spell
        from jsonb_array_elements(land->'unlocks') unlock
        cross join lateral jsonb_array_elements(unlock->'spells') spell
        where (unlock->>'druidLevel')::integer<=v_level
        order by spell->>'spellId',spell->>'name'
      ) d
    ),'[]'::jsonb)
  ) order by land->>'name'),'[]'::jsonb) into v_options
  from jsonb_array_elements(v_matrix) land;

  return jsonb_build_object(
    'available',true,'featureKey','circle-of-the-land','featureName','Circle Spells','source','XPHB','cadence','long_rest',
    'configured',v_configured,'canConfigure',v_can_configure,'acquiredAt',v_acquired_at,'latestLongRestAt',v_latest_long_rest,
    'state',case when found then v_runtime.state else jsonb_build_object('configured',false) end,
    'options',v_options,
    'helper','Whenever you finish a Long Rest, choose Arid, Polar, Temperate, or Tropical. The prior land spell package ends at that Long Rest; choose the new package for the current rest cycle. Circle Spells are always prepared and do not replace ordinary Druid prepared-spell authority.'
  );
end;
$$;

revoke all on function private.circle_land_spell_matrix_v1() from public,anon,authenticated;
grant execute on function private.circle_land_spell_matrix_v1() to service_role;
revoke all on function public.get_character_circle_land_v1(uuid) from public,anon;
grant execute on function public.get_character_circle_land_v1(uuid) to authenticated,service_role;
