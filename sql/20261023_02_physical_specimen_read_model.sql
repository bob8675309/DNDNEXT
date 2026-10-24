-- Read-only Physical Specimen runtime foundation (GrimHollowPG24 / XPHB Warlock).
-- This migration does not activate the feature, consume Bonus Actions, alter ability
-- scores, or create runtime rows. Action and stat projection require a separate,
-- reviewed integration with tactical and character-sheet authority.

create or replace function private.physical_specimen_options_v1()
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  with source_feature as (
    select f.raw_payload
    from public.class_feature_catalog f
    where f.feature_key='subclass:warlock:xphb:parasite:physical-specimen:grimhollowpg24:3'
      and lower(f.class_key)='warlock'
      and upper(f.class_source)='XPHB'
      and upper(f.source)='GRIMHOLLOWPG24'
      and f.level=3
    order by f.id
    limit 1
  ), source_list as (
    select e.value as list_node
    from source_feature f,
    lateral jsonb_array_elements(coalesce(f.raw_payload->'entries','[]'::jsonb)) e(value)
    where e.value->>'type'='list'
    limit 1
  ), options as (
    select
      case i.ordinality
        when 1 then 'enhanced-vitality'
        when 2 then 'enhanced-vision'
        when 3 then 'increased-speed'
        when 4 then 'poison-resistance-training'
        when 5 then 'enhanced-mobility'
        when 6 then 'physical-aptitude'
      end as key,
      case i.ordinality
        when 1 then 'Enhanced Vitality'
        when 2 then 'Enhanced Vision'
        when 3 then 'Increased Speed'
        when 4 then 'Poison Resistance Training'
        when 5 then 'Enhanced Mobility'
        when 6 then 'Physical Aptitude'
      end as name,
      regexp_replace(
        i.value,
        '\{@[^ ]+\s+([^}|]+)(?:\|[^}]*)?\}',
        '\1',
        'g'
      ) as description,
      i.ordinality
    from source_list l,
    lateral jsonb_array_elements_text(coalesce(l.list_node->'items','[]'::jsonb))
      with ordinality as i(value,ordinality)
    where i.ordinality between 1 and 6
  )
  select case when count(*)=6 and count(distinct key)=6
    then jsonb_agg(jsonb_build_object(
      'key',key,'name',name,'source','GrimHollowPG24',
      'description',description
    ) order by ordinality)
    else '[]'::jsonb end
  from options;
$$;

create or replace function private.physical_specimen_context_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_sheet jsonb;
  v_score integer;
  v_feature_level integer;
begin
  if p_character_id is null then
    return jsonb_build_object('eligible',false,'featureName','Physical Specimen','reason','missing_character');
  end if;
  select * into v_progression
    from public.character_progression where character_id=p_character_id;
  if not found then
    return jsonb_build_object('eligible',false,'featureName','Physical Specimen','reason','missing_progression');
  end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found
    or lower(coalesce(v_class.class_key,''))<>'warlock'
    or upper(coalesce(v_class.source,''))<>'XPHB'
    or private.normalize_player_choice_name_v1(v_progression.subclass_name)<>'theparasitepatron'
    or upper(coalesce(v_progression.subclass_source,''))<>'GRIMHOLLOWPG24' then
    return jsonb_build_object(
      'eligible',false,'featureName','Physical Specimen','reason','wrong_class_or_subclass',
      'classLevel',v_progression.class_level
    );
  end if;
  select min(f.level)::integer into v_feature_level
  from public.class_feature_catalog f
  where f.feature_key='subclass:warlock:xphb:parasite:physical-specimen:grimhollowpg24:3'
    and lower(f.class_key)='warlock'
    and upper(coalesce(f.class_source,''))='XPHB'
    and upper(coalesce(f.source,''))='GRIMHOLLOWPG24'
    and lower(f.name)='physical specimen';
  if v_feature_level is distinct from 3
    or v_progression.class_level<v_feature_level then
    return jsonb_build_object(
      'eligible',false,'featureName','Physical Specimen','reason','feature_not_acquired',
      'classLevel',v_progression.class_level,'featureLevel',v_feature_level
    );
  end if;
  select sheet into v_sheet from public.character_sheets
    where character_id=p_character_id;
  if not found
    or jsonb_typeof(v_sheet #> '{abilities,cha,score}') is distinct from 'number' then
    return jsonb_build_object(
      'eligible',false,'featureName','Physical Specimen','reason','missing_charisma_score'
    );
  end if;
  v_score:=(v_sheet #>> '{abilities,cha,score}')::integer;
  if v_score<1 or v_score>30 then
    return jsonb_build_object(
      'eligible',false,'featureName','Physical Specimen','reason','invalid_charisma_score'
    );
  end if;
  return jsonb_build_object(
    'eligible',true,
    'featureName','Physical Specimen',
    'featureKey','subclass:warlock:xphb:parasite:physical-specimen:grimhollowpg24:3',
    'runtimeFeatureKey','warlock-parasite-physical-specimen',
    'className','Warlock','classSource','XPHB',
    'subclassName','The Parasite Patron','subclassSource','GrimHollowPG24',
    'classLevel',v_progression.class_level,'featureLevel',v_feature_level,
    'charismaScore',v_score,
    'charismaModifier',floor((v_score-10)::numeric/2)::integer,
    'maxBenefits',least(6,greatest(1,floor((v_score-10)::numeric/2)::integer))
  );
end;
$$;

create or replace function public.get_character_physical_specimen_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_context jsonb;
  v_options jsonb:='[]'::jsonb;
  v_row public.character_runtime_feature_choices%rowtype;
  v_row_exists boolean:=false;
  v_active boolean:=false;
  v_valid_keys boolean:=false;
  v_keys jsonb:='[]'::jsonb;
  v_activated_at timestamptz;
  v_latest_long_rest timestamptz;
  v_latest_short_rest timestamptz;
  v_short_swap_ready boolean:=false;
  v_encounter jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Physical Specimen for this character.'
      using errcode='42501';
  end if;
  v_context:=private.physical_specimen_context_v1(p_character_id);
  if not coalesce((v_context->>'eligible')::boolean,false) then
    return jsonb_build_object(
      'available',false,'featureName','Physical Specimen','context',v_context
    );
  end if;
  v_options:=private.physical_specimen_options_v1();
  if jsonb_array_length(v_options)<>6 then
    return jsonb_build_object(
      'available',false,'featureName','Physical Specimen',
      'context',v_context,'reason','source_options_unavailable'
    );
  end if;
  select * into v_row from public.character_runtime_feature_choices
  where character_id=p_character_id
    and feature_key='warlock-parasite-physical-specimen';
  v_row_exists:=found;
  if v_row_exists then
    v_keys:=coalesce(v_row.state->'benefitKeys','[]'::jsonb);
    if jsonb_typeof(v_keys)<>'array' then v_keys:='[]'::jsonb; end if;
    begin
      v_activated_at:=(v_row.state->>'activatedAt')::timestamptz;
    exception when others then
      v_activated_at:=null;
    end;
    select
      count(*) between 1 and (v_context->>'maxBenefits')::integer
      and count(distinct k.value)=count(*)
      and count(*)=count(o.value)
      into v_valid_keys
    from jsonb_array_elements_text(v_keys) k(value)
    left join lateral (
      select item.value from jsonb_array_elements(v_options) item(value)
      where item.value->>'key'=k.value
      limit 1
    ) o on true;
  end if;
  select max(completed_at) into v_latest_long_rest
    from public.character_rest_log
    where character_id=p_character_id and rest_type='long_rest';
  select max(completed_at) into v_latest_short_rest
    from public.character_rest_log
    where character_id=p_character_id and rest_type='short_rest';
  v_active:=v_row_exists
    and coalesce((v_row.state->>'activated')::boolean,false)
    and v_activated_at is not null
    and v_valid_keys
    and (v_latest_long_rest is null or v_latest_long_rest<=v_activated_at);
  v_encounter:=private.character_active_encounter_v1(p_character_id);
  v_short_swap_ready:=v_active
    and v_latest_short_rest is not null
    and v_latest_short_rest>v_activated_at
    and (
      v_row.replacement_anchor_at is null
      or v_latest_short_rest>v_row.replacement_anchor_at
    );
  return jsonb_build_object(
    'available',true,
    'featureName','Physical Specimen',
    'featureKey','warlock-parasite-physical-specimen',
    'source','GrimHollowPG24',
    'cadence','per_use',
    'activationAction','bonus_action',
    'context',v_context,
    'options',v_options,
    'maxBenefits',v_context->'maxBenefits',
    'active',v_active,
    'state',case when v_active then v_row.state else jsonb_build_object('active',false) end,
    'activeBenefitKeys',case when v_active then v_keys else '[]'::jsonb end,
    'lastActivatedAt',v_activated_at,
    'latestLongRestAt',v_latest_long_rest,
    'latestShortRestAt',v_latest_short_rest,
    'canActivateOutsideEncounter',not v_active and v_encounter is null,
    'canSwapOutsideEncounter',v_short_swap_ready and v_encounter is null,
    'requiresActionIntegration',true,
    'effectiveStatsIntegrated',false,
    'helper','Activation is a Bonus Action once per Long Rest. Benefits end at the next Long Rest; one benefit can be replaced after each Short Rest. This first slice is read-only: it does not activate the feature or modify stats.'
  );
end;
$$;

revoke all on function private.physical_specimen_options_v1() from public,anon,authenticated;
revoke all on function private.physical_specimen_context_v1(uuid) from public,anon,authenticated;
grant execute on function private.physical_specimen_options_v1() to service_role;
grant execute on function private.physical_specimen_context_v1(uuid) to service_role;
revoke all on function public.get_character_physical_specimen_v1(uuid) from public,anon;
grant execute on function public.get_character_physical_specimen_v1(uuid) to authenticated,service_role;
