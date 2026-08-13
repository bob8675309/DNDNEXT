-- Model XPHB Hunter Defensive Tactics as persistent Short/Long-Rest runtime state.
-- PHB Defensive Tactics remains permanent Character Forge/progression authority.
-- This slice stores the selected XPHB option only; combat effects remain action-layer consumers.

create or replace function private.defensive_tactics_options_v1()
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  with feature as (
    select f.entries
    from public.class_feature_catalog f
    where lower(f.class_key)='ranger'
      and upper(coalesce(f.class_source,''))='XPHB'
      and lower(coalesce(f.subclass_name,''))='hunter'
      and upper(coalesce(f.source,''))='XPHB'
      and lower(f.name)='defensive tactics'
    order by f.level,f.id
    limit 1
  ), options as (
    select distinct
      lower(node->>'name') as key,
      node->>'name' as name,
      regexp_replace(
        coalesce(case when jsonb_typeof(node->'entries')='array' then node->'entries'->>0 else '' end,''),
        '\{@[^ ]+\s+([^}|]+)(?:\|[^}]*)?\}',
        '\1',
        'g'
      ) as description
    from feature f,
    lateral jsonb_path_query(
      f.entries,
      '$[*] ? (@.type == "entries").entries[*] ? (@.type == "entries" && exists(@.name))'
    ) node
    where btrim(coalesce(node->>'name',''))<>''
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'key',key,
    'name',name,
    'source','XPHB',
    'description',description
  ) order by name),'[]'::jsonb)
  from options;
$$;

create or replace function private.defensive_tactics_context_v1(p_character_id uuid)
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
begin
  if p_character_id is null then
    return jsonb_build_object('eligible',false,'featureName','Defensive Tactics');
  end if;
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found then return jsonb_build_object('eligible',false,'featureName','Defensive Tactics'); end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found
     or lower(coalesce(v_class.class_key,''))<>'ranger'
     or upper(coalesce(v_class.source,''))<>'XPHB'
     or private.normalize_player_choice_name_v1(v_progression.subclass_name)<>'hunter'
     or upper(coalesce(v_progression.subclass_source,''))<>'XPHB' then
    return jsonb_build_object('eligible',false,'featureName','Defensive Tactics','classSource',coalesce(v_class.source,''),'subclassName',coalesce(v_progression.subclass_name,''),'subclassSource',coalesce(v_progression.subclass_source,''));
  end if;
  select min(f.level)::integer into v_feature_level
  from public.class_feature_catalog f
  where lower(f.class_key)='ranger'
    and upper(coalesce(f.class_source,''))='XPHB'
    and lower(coalesce(f.subclass_name,''))='hunter'
    and upper(coalesce(f.source,''))='XPHB'
    and lower(f.name)='defensive tactics';
  if v_feature_level is null or v_progression.class_level<v_feature_level then
    return jsonb_build_object('eligible',false,'featureName','Defensive Tactics','source','XPHB','classLevel',v_progression.class_level,'featureLevel',v_feature_level);
  end if;
  return jsonb_build_object('eligible',true,'featureName','Defensive Tactics','source','XPHB','className','Ranger','classSource','XPHB','subclassName','Hunter','subclassSource','XPHB','classLevel',v_progression.class_level,'featureLevel',v_feature_level);
end;
$$;

create or replace function private.sync_defensive_tactics_projection_v1(p_character_id uuid,p_state jsonb)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare v_sheet jsonb:='{}'::jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  if not found then return; end if;
  if coalesce(jsonb_typeof(v_sheet->'runtimeFeatures'),'')<>'object' then v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures}','{}'::jsonb,true); end if;
  if p_state is null then v_sheet:=v_sheet #- array['runtimeFeatures','defensiveTactics']; else v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures,defensiveTactics}',p_state,true); end if;
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
end;
$$;

create or replace function public.get_character_defensive_tactics_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_context jsonb:=private.defensive_tactics_context_v1(p_character_id);
  v_options jsonb:='[]'::jsonb;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_had_runtime boolean:=false;
  v_configured boolean:=false;
  v_latest_rest timestamptz;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to review Defensive Tactics for this character.' using errcode='42501'; end if;
  if not coalesce((v_context->>'eligible')::boolean,false) then return jsonb_build_object('available',false,'featureName','Defensive Tactics','context',v_context); end if;
  v_options:=private.defensive_tactics_options_v1();
  select max(completed_at) into v_latest_rest from public.character_rest_log where character_id=p_character_id and rest_type in ('short_rest','long_rest');
  select * into v_runtime from public.character_runtime_feature_choices where character_id=p_character_id and feature_key='ranger-hunter-defensive-tactics';
  v_had_runtime:=found;
  v_configured:=v_had_runtime and coalesce((v_runtime.state->>'configured')::boolean,false)
    and exists(select 1 from jsonb_array_elements(v_options) o(value) where o.value->>'key'=lower(coalesce(v_runtime.state->>'tacticKey','')));
  return jsonb_build_object(
    'available',true,'featureKey','ranger-hunter-defensive-tactics','featureName','Defensive Tactics','source','XPHB','cadence','short_or_long_rest','context',v_context,
    'configured',v_configured,'active',v_configured,'canConfigure',not v_configured,
    'canReplace',v_configured and v_latest_rest is not null and (v_runtime.replacement_anchor_at is null or v_latest_rest>v_runtime.replacement_anchor_at),
    'latestQualifyingRestAt',v_latest_rest,'replacementAnchorAt',case when v_had_runtime then v_runtime.replacement_anchor_at else null end,
    'state',case when v_had_runtime then v_runtime.state else jsonb_build_object('configured',false) end,'options',v_options,
    'helper','Choose the initial XPHB Defensive Tactics option immediately when the feature is available. A later Short Rest or Long Rest can authorize one change; if you do not change it, the current option remains active. The PHB Defensive Tactics choice remains permanent Forge/progression authority and is not managed by this runtime.'
  );
end;
$$;

create or replace function public.configure_character_defensive_tactics_v1(p_character_id uuid,p_tactic_key text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_context jsonb:=private.defensive_tactics_context_v1(p_character_id);
  v_options jsonb:='[]'::jsonb;
  v_option jsonb;
  v_key text:=lower(btrim(coalesce(p_tactic_key,'')));
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_had_runtime boolean:=false;
  v_latest_rest timestamptz;
  v_anchor timestamptz;
  v_state jsonb;
  v_active_encounter jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to configure Defensive Tactics for this character.' using errcode='42501'; end if;
  if not coalesce((v_context->>'eligible')::boolean,false) then raise exception 'Runtime Defensive Tactics requires an XPHB Ranger 7+ with the XPHB Hunter subclass.'; end if;
  v_active_encounter:=private.character_active_encounter_v1(p_character_id);
  if v_active_encounter is not null then raise exception 'Defensive Tactics cannot be configured while this character is in an active encounter.'; end if;
  v_options:=private.defensive_tactics_options_v1();
  select o.value into v_option from jsonb_array_elements(v_options) o(value) where o.value->>'key'=v_key limit 1;
  if v_option is null then raise exception 'Choose a source-backed XPHB Defensive Tactics option.'; end if;
  select max(completed_at) into v_latest_rest from public.character_rest_log where character_id=p_character_id and rest_type in ('short_rest','long_rest');
  select * into v_runtime from public.character_runtime_feature_choices where character_id=p_character_id and feature_key='ranger-hunter-defensive-tactics' for update;
  v_had_runtime:=found;
  if v_had_runtime and coalesce((v_runtime.state->>'configured')::boolean,false) then
    if lower(coalesce(v_runtime.state->>'tacticKey',''))=v_key then raise exception 'Choose the other Defensive Tactics option from the current option.'; end if;
    if v_latest_rest is null or (v_runtime.replacement_anchor_at is not null and v_latest_rest<=v_runtime.replacement_anchor_at) then raise exception 'Finish a newer Short Rest or Long Rest before changing Defensive Tactics.'; end if;
    v_anchor:=v_latest_rest;
    v_state:=jsonb_build_object(
      'configured',true,'active',true,'featureKey','ranger-hunter-defensive-tactics','featureName','Defensive Tactics','source','XPHB','classSource','XPHB','subclassName','Hunter','subclassSource','XPHB',
      'tacticKey',v_option->>'key','tacticName',v_option->>'name','tacticDescription',v_option->>'description','configuredAt',timezone('utc',now()),'configuredRestAt',v_latest_rest,'configuredBy','rest_replacement',
      'qualifyingRests',jsonb_build_array('short_rest','long_rest'),'previousTactic',jsonb_build_object('tacticKey',v_runtime.state->>'tacticKey','tacticName',v_runtime.state->>'tacticName')
    );
  else
    v_anchor:=timezone('utc',now());
    v_state:=jsonb_build_object(
      'configured',true,'active',true,'featureKey','ranger-hunter-defensive-tactics','featureName','Defensive Tactics','source','XPHB','classSource','XPHB','subclassName','Hunter','subclassSource','XPHB',
      'tacticKey',v_option->>'key','tacticName',v_option->>'name','tacticDescription',v_option->>'description','configuredAt',v_anchor,'configuredRestAt',null,'configuredBy','initial_selection','qualifyingRests',jsonb_build_array('short_rest','long_rest')
    );
  end if;
  insert into public.character_runtime_feature_choices(character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at)
  values(p_character_id,'ranger-hunter-defensive-tactics','Defensive Tactics','XPHB','short_or_long_rest',v_state,v_anchor,now(),now())
  on conflict(character_id,feature_key) do update set feature_name=excluded.feature_name,source=excluded.source,cadence=excluded.cadence,state=excluded.state,replacement_anchor_at=excluded.replacement_anchor_at,updated_at=now();
  perform private.sync_defensive_tactics_projection_v1(p_character_id,v_state);
  return public.get_character_defensive_tactics_v1(p_character_id);
end;
$$;

revoke all on function private.defensive_tactics_options_v1() from public,anon,authenticated;
revoke all on function private.defensive_tactics_context_v1(uuid) from public,anon,authenticated;
revoke all on function private.sync_defensive_tactics_projection_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.defensive_tactics_options_v1() to service_role;
grant execute on function private.defensive_tactics_context_v1(uuid) to service_role;
grant execute on function private.sync_defensive_tactics_projection_v1(uuid,jsonb) to service_role;
revoke all on function public.get_character_defensive_tactics_v1(uuid) from public,anon;
revoke all on function public.configure_character_defensive_tactics_v1(uuid,text) from public,anon;
grant execute on function public.get_character_defensive_tactics_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_defensive_tactics_v1(uuid,text) to authenticated,service_role;
