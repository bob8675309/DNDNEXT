-- Model TCE Path of the Beast Bestial Soul adaptation as Short/Long-Rest runtime state.
-- The always-on magical natural-weapon clause remains source/display/combat authority;
-- only the rest-selected Swimming / Climbing / Jumping adaptation is stored here.

create or replace function private.bestial_soul_options_v1()
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  with feature as (
    select f.entries
    from public.class_feature_catalog f
    where lower(f.class_key)='barbarian'
      and upper(coalesce(f.class_source,''))='PHB'
      and lower(coalesce(f.subclass_name,''))='beast'
      and upper(coalesce(f.source,''))='TCE'
      and lower(f.name)='bestial soul'
    order by f.level,f.id
    limit 1
  ), options as (
    select distinct
      lower(node->>'name') as key,
      node->>'name' as name,
      coalesce(
        nullif(case when jsonb_typeof(node->'entries')='array' then node->'entries'->>0 else '' end,''),
        'A source-backed Bestial Soul adaptation.'
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
    'source','TCE',
    'description',description
  ) order by name),'[]'::jsonb)
  from options;
$$;

create or replace function private.bestial_soul_context_v1(p_character_id uuid)
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
  v_acquired_at timestamptz;
begin
  if p_character_id is null then
    return jsonb_build_object('eligible',false,'featureName','Bestial Soul');
  end if;
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found then return jsonb_build_object('eligible',false,'featureName','Bestial Soul'); end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found
     or lower(coalesce(v_class.class_key,''))<>'barbarian'
     or upper(coalesce(v_class.source,''))<>'PHB'
     or private.normalize_player_choice_name_v1(v_progression.subclass_name)<>'beast'
     or upper(coalesce(v_progression.subclass_source,''))<>'TCE' then
    return jsonb_build_object('eligible',false,'featureName','Bestial Soul','classSource',coalesce(v_class.source,''),'subclassName',coalesce(v_progression.subclass_name,''),'subclassSource',coalesce(v_progression.subclass_source,''));
  end if;
  select min(f.level)::integer into v_feature_level
  from public.class_feature_catalog f
  where lower(f.class_key)='barbarian' and upper(coalesce(f.class_source,''))='PHB'
    and lower(coalesce(f.subclass_name,''))='beast' and upper(coalesce(f.source,''))='TCE'
    and lower(f.name)='bestial soul';
  if v_feature_level is null or v_progression.class_level<v_feature_level then
    return jsonb_build_object('eligible',false,'featureName','Bestial Soul','classSource','PHB','subclassName','Beast','subclassSource','TCE','classLevel',v_progression.class_level,'featureLevel',v_feature_level);
  end if;
  v_acquired_at:=private.character_class_feature_acquired_at_v1(p_character_id,'barbarian','PHB',v_feature_level);
  return jsonb_build_object('eligible',true,'featureName','Bestial Soul','source','TCE','className','Barbarian','classSource','PHB','subclassName','Beast','subclassSource','TCE','classLevel',v_progression.class_level,'featureLevel',v_feature_level,'acquiredAt',v_acquired_at);
end;
$$;

create or replace function private.sync_bestial_soul_projection_v1(p_character_id uuid,p_state jsonb)
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
  if p_state is null then v_sheet:=v_sheet #- array['runtimeFeatures','bestialSoul']; else v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures,bestialSoul}',p_state,true); end if;
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
end;
$$;

create or replace function public.get_character_bestial_soul_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_context jsonb:=private.bestial_soul_context_v1(p_character_id);
  v_options jsonb:='[]'::jsonb;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_had_runtime boolean:=false;
  v_latest_rest timestamptz;
  v_acquired_at timestamptz;
  v_active boolean:=false;
  v_can_configure boolean:=false;
  v_effective_state jsonb:=jsonb_build_object('configured',false,'active',false);
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to review Bestial Soul for this character.' using errcode='42501'; end if;
  if not coalesce((v_context->>'eligible')::boolean,false) then return jsonb_build_object('available',false,'featureName','Bestial Soul','context',v_context); end if;
  begin v_acquired_at:=(v_context->>'acquiredAt')::timestamptz; exception when others then v_acquired_at:=null; end;
  select max(completed_at) into v_latest_rest from public.character_rest_log where character_id=p_character_id and rest_type in ('short_rest','long_rest');
  select * into v_runtime from public.character_runtime_feature_choices where character_id=p_character_id and feature_key='barbarian-beast-bestial-soul';
  v_had_runtime:=found;
  v_active:=v_had_runtime and coalesce((v_runtime.state->>'configured')::boolean,false) and v_runtime.replacement_anchor_at is not null and v_latest_rest is not null and v_latest_rest<=v_runtime.replacement_anchor_at;
  v_can_configure:=v_latest_rest is not null and v_acquired_at is not null and v_latest_rest>v_acquired_at and (not v_had_runtime or v_runtime.replacement_anchor_at is null or v_latest_rest>v_runtime.replacement_anchor_at);
  if v_had_runtime then v_effective_state:=v_runtime.state||jsonb_build_object('active',v_active,'expired',not v_active,'latestQualifyingRestAt',v_latest_rest); end if;
  v_options:=private.bestial_soul_options_v1();
  return jsonb_build_object('available',true,'featureKey','barbarian-beast-bestial-soul','featureName','Bestial Soul','source','TCE','cadence','short_or_long_rest','context',v_context,'latestQualifyingRestAt',v_latest_rest,'active',v_active,'canConfigure',v_can_configure,'state',v_effective_state,'options',v_options,'helper','When you finish a qualifying Short Rest or Long Rest after gaining Bestial Soul, choose one source-backed adaptation. It remains active only until your next Short Rest or Long Rest. The always-on magical natural-weapon clause is not stored as a choice.');
end;
$$;

create or replace function public.configure_character_bestial_soul_v1(p_character_id uuid,p_benefit_key text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_context jsonb:=private.bestial_soul_context_v1(p_character_id);
  v_options jsonb:='[]'::jsonb;
  v_option jsonb;
  v_key text:=lower(btrim(coalesce(p_benefit_key,'')));
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_had_runtime boolean:=false;
  v_latest_rest timestamptz;
  v_acquired_at timestamptz;
  v_state jsonb;
  v_active_encounter jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to configure Bestial Soul for this character.' using errcode='42501'; end if;
  if not coalesce((v_context->>'eligible')::boolean,false) then raise exception 'Bestial Soul requires a PHB Barbarian 6+ with the TCE Path of the Beast subclass.'; end if;
  v_active_encounter:=private.character_active_encounter_v1(p_character_id);
  if v_active_encounter is not null then raise exception 'Bestial Soul cannot be configured while this character is in an active encounter.'; end if;
  v_options:=private.bestial_soul_options_v1();
  select o.value into v_option from jsonb_array_elements(v_options) o(value) where o.value->>'key'=v_key limit 1;
  if v_option is null then raise exception 'Choose a source-backed Bestial Soul adaptation.'; end if;
  begin v_acquired_at:=(v_context->>'acquiredAt')::timestamptz; exception when others then v_acquired_at:=null; end;
  select max(completed_at) into v_latest_rest from public.character_rest_log where character_id=p_character_id and rest_type in ('short_rest','long_rest');
  if v_acquired_at is null or v_latest_rest is null or v_latest_rest<=v_acquired_at then raise exception 'Finish a Short Rest or Long Rest after acquiring Bestial Soul before choosing an adaptation.'; end if;
  select * into v_runtime from public.character_runtime_feature_choices where character_id=p_character_id and feature_key='barbarian-beast-bestial-soul' for update;
  v_had_runtime:=found;
  if v_had_runtime and v_runtime.replacement_anchor_at is not null and v_latest_rest<=v_runtime.replacement_anchor_at then raise exception 'Bestial Soul has already been configured for this Short Rest or Long Rest.'; end if;
  v_state:=jsonb_build_object('configured',true,'active',true,'featureKey','barbarian-beast-bestial-soul','featureName','Bestial Soul','source','TCE','classSource','PHB','subclassName','Beast','subclassSource','TCE','benefitKey',v_option->>'key','benefitName',v_option->>'name','benefitDescription',v_option->>'description','configuredAt',timezone('utc',now()),'configuredRestAt',v_latest_rest,'configuredBy','rest_selection','qualifyingRests',jsonb_build_array('short_rest','long_rest'),'expiresAtNextQualifyingRest',true);
  insert into public.character_runtime_feature_choices(character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at)
  values(p_character_id,'barbarian-beast-bestial-soul','Bestial Soul','TCE','short_or_long_rest',v_state,v_latest_rest,now(),now())
  on conflict(character_id,feature_key) do update set feature_name=excluded.feature_name,source=excluded.source,cadence=excluded.cadence,state=excluded.state,replacement_anchor_at=excluded.replacement_anchor_at,updated_at=now();
  perform private.sync_bestial_soul_projection_v1(p_character_id,v_state);
  return public.get_character_bestial_soul_v1(p_character_id);
end;
$$;

revoke all on function private.bestial_soul_options_v1() from public,anon,authenticated;
revoke all on function private.bestial_soul_context_v1(uuid) from public,anon,authenticated;
revoke all on function private.sync_bestial_soul_projection_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.bestial_soul_options_v1() to service_role;
grant execute on function private.bestial_soul_context_v1(uuid) to service_role;
grant execute on function private.sync_bestial_soul_projection_v1(uuid,jsonb) to service_role;
revoke all on function public.get_character_bestial_soul_v1(uuid) from public,anon;
revoke all on function public.configure_character_bestial_soul_v1(uuid,text) from public,anon;
grant execute on function public.get_character_bestial_soul_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_bestial_soul_v1(uuid,text) to authenticated,service_role;
