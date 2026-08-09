-- Model Artificer Armorer Armor Model as runtime state.
-- Initial model is available immediately at the source-defined subclass level;
-- later replacements require Smith's Tools plus a newer Short or Long Rest.
-- Also repairs the shared cadence check so the already-deployed Fiendish
-- Resilience short_or_long_rest contract can be stored as intended.

alter table public.character_runtime_feature_choices
  drop constraint if exists character_runtime_feature_choices_cadence_chk;
alter table public.character_runtime_feature_choices
  add constraint character_runtime_feature_choices_cadence_chk
  check (cadence = any (array[
    'long_rest'::text,
    'short_rest'::text,
    'short_or_long_rest'::text,
    'per_use'::text,
    'informational'::text
  ]));

create or replace function private.character_has_smiths_tools_v1(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select exists(
    select 1
    from public.inventory_items i
    where coalesce(i.quantity,0)>0
      and private.normalize_player_choice_name_v1(i.item_name)=private.normalize_player_choice_name_v1('Smith''s Tools')
      and (
        (i.owner_id=p_character_id::text and lower(coalesce(i.owner_type,'')) in ('npc','merchant','character'))
        or (
          lower(coalesce(i.owner_type,''))='player'
          and exists(
            select 1
            from public.character_permissions cp
            where cp.character_id=p_character_id
              and cp.can_edit=true
              and i.owner_id=cp.user_id::text
          )
        )
      )
  );
$$;

create or replace function private.armorer_armor_model_options_v1(p_source text)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  with feature as (
    select f.*
    from public.class_feature_catalog f
    where lower(f.class_key)='artificer'
      and upper(coalesce(f.class_source,''))=upper(btrim(coalesce(p_source,'')))
      and lower(coalesce(f.subclass_name,''))='armorer'
      and lower(f.name)='armor model'
      and upper(coalesce(f.source,''))=upper(btrim(coalesce(p_source,'')))
    order by f.level,f.id
    limit 1
  ), raw_options as (
    select distinct
      split_part(node->>'subclassFeature','|',1) as name,
      null::jsonb as node,
      true as from_ref
    from feature f,
    lateral jsonb_path_query(
      f.entries,
      '$[*] ? (@.type == "refSubclassFeature" && exists(@.subclassFeature))'
    ) node
    union
    select distinct
      node->>'name' as name,
      node,
      false as from_ref
    from feature f,
    lateral jsonb_path_query(
      f.entries,
      '$[*] ? (@.type == "entries").entries[*] ? (@.type == "entries" && exists(@.name))'
    ) node
  ), resolved as (
    select distinct on (lower(o.name))
      o.name,
      coalesce(
        nullif(sf.description,''),
        nullif(
          case when jsonb_typeof(o.node->'entries')='array'
            then o.node->'entries'->>0
            else ''
          end,
          ''
        ),
        'A source-backed Arcane Armor model.'
      ) as description
    from raw_options o
    cross join feature f
    left join public.class_feature_catalog sf
      on o.from_ref
     and lower(sf.class_key)='artificer'
     and upper(coalesce(sf.class_source,''))=upper(btrim(coalesce(p_source,'')))
     and lower(coalesce(sf.subclass_name,''))='armorer'
     and upper(coalesce(sf.source,''))=upper(btrim(coalesce(p_source,'')))
     and sf.level=f.level
     and lower(sf.name)=lower(o.name)
    where btrim(coalesce(o.name,''))<>''
    order by lower(o.name),(sf.description is not null) desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'key',lower(name),
    'name',name,
    'source',upper(btrim(coalesce(p_source,''))),
    'description',description
  ) order by name),'[]'::jsonb)
  from resolved;
$$;

create or replace function private.armorer_armor_model_context_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_feature_level integer;
  v_source text;
begin
  if p_character_id is null then
    return jsonb_build_object('eligible',false,'featureName','Armor Model');
  end if;

  select * into v_progression
  from public.character_progression
  where character_id=p_character_id;
  if not found then
    return jsonb_build_object('eligible',false,'featureName','Armor Model');
  end if;

  select * into v_class
  from public.class_catalog
  where id=v_progression.class_id;
  if not found
     or lower(coalesce(v_class.class_key,''))<>'artificer'
     or private.normalize_player_choice_name_v1(v_progression.subclass_name)<>'armorer' then
    return jsonb_build_object('eligible',false,'featureName','Armor Model');
  end if;

  v_source:=upper(btrim(coalesce(v_progression.subclass_source,'')));
  if v_source=''
     or v_source<>upper(btrim(coalesce(v_class.source,''))) then
    return jsonb_build_object(
      'eligible',false,
      'featureName','Armor Model',
      'classSource',coalesce(v_class.source,''),
      'subclassSource',coalesce(v_progression.subclass_source,'')
    );
  end if;

  select min(f.level)::integer into v_feature_level
  from public.class_feature_catalog f
  where lower(f.class_key)='artificer'
    and upper(coalesce(f.class_source,''))=v_source
    and lower(coalesce(f.subclass_name,''))='armorer'
    and lower(f.name)='armor model'
    and upper(coalesce(f.source,''))=v_source;

  if v_feature_level is null or v_progression.class_level<v_feature_level then
    return jsonb_build_object(
      'eligible',false,
      'featureName','Armor Model',
      'source',v_source,
      'classLevel',v_progression.class_level,
      'featureLevel',v_feature_level
    );
  end if;

  return jsonb_build_object(
    'eligible',true,
    'featureName','Armor Model',
    'source',v_source,
    'className','Artificer',
    'classSource',upper(coalesce(v_class.source,'')),
    'subclassName','Armorer',
    'subclassSource',v_source,
    'classLevel',v_progression.class_level,
    'featureLevel',v_feature_level,
    'hasSmithsTools',private.character_has_smiths_tools_v1(p_character_id),
    'toolsRequirementMode','inventory_possession_proxy'
  );
end;
$$;

create or replace function private.sync_armorer_armor_model_projection_v1(
  p_character_id uuid,
  p_state jsonb
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets
  where character_id=p_character_id
  for update;
  if not found then return; end if;

  if coalesce(jsonb_typeof(v_sheet->'runtimeFeatures'),'')<>'object' then
    v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures}','{}'::jsonb,true);
  end if;
  if p_state is null then
    v_sheet:=v_sheet #- array['runtimeFeatures','armorerArmorModel'];
  else
    v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures,armorerArmorModel}',p_state,true);
  end if;

  update public.character_sheets
  set sheet=v_sheet,updated_at=now()
  where character_id=p_character_id;
end;
$$;

create or replace function public.get_character_armorer_armor_model_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_context jsonb:=private.armorer_armor_model_context_v1(p_character_id);
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_had_runtime boolean:=false;
  v_latest_rest timestamptz;
  v_options jsonb:='[]'::jsonb;
  v_configured boolean:=false;
  v_has_tools boolean:=false;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Armor Model for this character.' using errcode='42501';
  end if;
  if not coalesce((v_context->>'eligible')::boolean,false) then
    return jsonb_build_object('available',false,'featureName','Armor Model','context',v_context);
  end if;

  v_has_tools:=coalesce((v_context->>'hasSmithsTools')::boolean,false);
  v_options:=private.armorer_armor_model_options_v1(v_context->>'source');

  select max(completed_at) into v_latest_rest
  from public.character_rest_log
  where character_id=p_character_id
    and rest_type in ('short_rest','long_rest');

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id
    and feature_key='artificer-armorer-armor-model';
  v_had_runtime:=found;

  v_configured:=v_had_runtime
    and coalesce((v_runtime.state->>'configured')::boolean,false)
    and exists(
      select 1
      from jsonb_array_elements(v_options) o(value)
      where o.value->>'key'=lower(coalesce(v_runtime.state->>'modelKey',''))
    );

  return jsonb_build_object(
    'available',true,
    'featureKey','artificer-armorer-armor-model',
    'featureName','Armor Model',
    'source',v_context->>'source',
    'cadence','short_or_long_rest',
    'context',v_context,
    'configured',v_configured,
    'canConfigure',not v_configured and v_has_tools,
    'canReplace',v_configured and v_has_tools and v_latest_rest is not null
      and (v_runtime.replacement_anchor_at is null or v_latest_rest>v_runtime.replacement_anchor_at),
    'latestQualifyingRestAt',v_latest_rest,
    'replacementAnchorAt',case when v_had_runtime then v_runtime.replacement_anchor_at else null end,
    'state',case when v_had_runtime then v_runtime.state else jsonb_build_object('configured',false) end,
    'options',v_options,
    'helper','Choose the initial Arcane Armor model immediately when the Armorer feature is available. Later changes require Smith''s Tools in inventory as the current schema proxy for having the tools in hand, plus a newer Short or Long Rest. This runtime state does not mutate armor inventory or resolve the model''s combat effects.'
  );
end;
$$;

create or replace function public.configure_character_armorer_armor_model_v1(
  p_character_id uuid,
  p_model_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_context jsonb:=private.armorer_armor_model_context_v1(p_character_id);
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_had_runtime boolean:=false;
  v_options jsonb:='[]'::jsonb;
  v_option jsonb;
  v_key text:=lower(btrim(coalesce(p_model_key,'')));
  v_latest_rest timestamptz;
  v_anchor timestamptz;
  v_state jsonb;
  v_active_encounter jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to configure Armor Model for this character.' using errcode='42501';
  end if;
  if not coalesce((v_context->>'eligible')::boolean,false) then
    raise exception 'Armor Model requires a source-matched Artificer 3+ with the Armorer subclass.';
  end if;
  if not private.character_has_smiths_tools_v1(p_character_id) then
    raise exception 'Smith''s Tools must be in this character''s inventory before configuring Armor Model.';
  end if;

  v_active_encounter:=private.character_active_encounter_v1(p_character_id);
  if v_active_encounter is not null then
    raise exception 'Armor Model cannot be configured while this character is in an active encounter.';
  end if;

  v_options:=private.armorer_armor_model_options_v1(v_context->>'source');
  select o.value into v_option
  from jsonb_array_elements(v_options) o(value)
  where o.value->>'key'=v_key
  limit 1;
  if v_option is null then
    raise exception 'Choose an Armor Model available to this Armorer source.';
  end if;

  select max(completed_at) into v_latest_rest
  from public.character_rest_log
  where character_id=p_character_id
    and rest_type in ('short_rest','long_rest');

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id
    and feature_key='artificer-armorer-armor-model'
  for update;
  v_had_runtime:=found;

  if v_had_runtime and coalesce((v_runtime.state->>'configured')::boolean,false) then
    if lower(coalesce(v_runtime.state->>'modelKey',''))=v_key then
      raise exception 'Choose a different Armor Model from the current model.';
    end if;
    if v_latest_rest is null
       or (v_runtime.replacement_anchor_at is not null and v_latest_rest<=v_runtime.replacement_anchor_at) then
      raise exception 'Finish a newer Short Rest or Long Rest before changing Armor Model.';
    end if;
    v_anchor:=v_latest_rest;
    v_state:=jsonb_build_object(
      'configured',true,
      'featureKey','artificer-armorer-armor-model',
      'featureName','Armor Model',
      'source',v_context->>'source',
      'modelKey',v_option->>'key',
      'modelName',v_option->>'name',
      'modelDescription',v_option->>'description',
      'configuredAt',timezone('utc',now()),
      'configuredRestAt',v_latest_rest,
      'configuredBy','rest_replacement',
      'qualifyingRests',jsonb_build_array('short_rest','long_rest'),
      'previousModel',jsonb_build_object(
        'modelKey',v_runtime.state->>'modelKey',
        'modelName',v_runtime.state->>'modelName'
      )
    );
  else
    v_anchor:=timezone('utc',now());
    v_state:=jsonb_build_object(
      'configured',true,
      'featureKey','artificer-armorer-armor-model',
      'featureName','Armor Model',
      'source',v_context->>'source',
      'modelKey',v_option->>'key',
      'modelName',v_option->>'name',
      'modelDescription',v_option->>'description',
      'configuredAt',v_anchor,
      'configuredRestAt',null,
      'configuredBy','initial_selection',
      'qualifyingRests',jsonb_build_array('short_rest','long_rest')
    );
  end if;

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    p_character_id,
    'artificer-armorer-armor-model',
    'Armor Model',
    v_context->>'source',
    'short_or_long_rest',
    v_state,
    v_anchor,
    now(),
    now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,
    source=excluded.source,
    cadence=excluded.cadence,
    state=excluded.state,
    replacement_anchor_at=excluded.replacement_anchor_at,
    updated_at=now();

  perform private.sync_armorer_armor_model_projection_v1(p_character_id,v_state);
  return public.get_character_armorer_armor_model_v1(p_character_id);
end;
$$;

revoke all on function private.character_has_smiths_tools_v1(uuid) from public,anon,authenticated;
revoke all on function private.armorer_armor_model_options_v1(text) from public,anon,authenticated;
revoke all on function private.armorer_armor_model_context_v1(uuid) from public,anon,authenticated;
revoke all on function private.sync_armorer_armor_model_projection_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.character_has_smiths_tools_v1(uuid) to service_role;
grant execute on function private.armorer_armor_model_options_v1(text) to service_role;
grant execute on function private.armorer_armor_model_context_v1(uuid) to service_role;
grant execute on function private.sync_armorer_armor_model_projection_v1(uuid,jsonb) to service_role;

revoke all on function public.get_character_armorer_armor_model_v1(uuid) from public,anon;
revoke all on function public.configure_character_armorer_armor_model_v1(uuid,text) from public,anon;
grant execute on function public.get_character_armorer_armor_model_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_armorer_armor_model_v1(uuid,text) to authenticated,service_role;
