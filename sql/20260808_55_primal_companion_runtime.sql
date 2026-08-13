-- XPHB Ranger / Beast Master Primal Companion runtime authority.
-- Initial companion selection is available immediately when the feature exists.
-- The current companion persists until changed. A newer Long Rest permits one
-- replacement; Long Rest itself does not auto-expire the current companion.

create or replace function private.character_has_primal_companion_v1(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select exists(
    select 1
    from public.character_progression cp
    join public.class_catalog c on c.id=cp.class_id
    where cp.character_id=p_character_id
      and lower(c.class_key)='ranger'
      and upper(c.source)='XPHB'
      and cp.class_level>=3
      and private.normalize_player_choice_name_v1(cp.subclass_name)='beastmaster'
      and upper(btrim(coalesce(cp.subclass_source,'')))='XPHB'
  );
$$;

create or replace function private.primal_companion_options_v1()
returns jsonb
language sql
immutable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select jsonb_build_array(
    jsonb_build_object('key','land','name','Beast of the Land','source','XPHB'),
    jsonb_build_object('key','sea','name','Beast of the Sea','source','XPHB'),
    jsonb_build_object('key','sky','name','Beast of the Sky','source','XPHB')
  );
$$;

create or replace function public.get_character_primal_companion_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_latest_long_rest timestamptz;
  v_configured boolean:=false;
  v_can_replace boolean:=false;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Primal Companion for this character.' using errcode='42501';
  end if;
  if not private.character_has_primal_companion_v1(p_character_id) then
    return jsonb_build_object('available',false,'reason','Primal Companion requires an XPHB Ranger 3+ with the Beast Master subclass.');
  end if;

  select max(completed_at) into v_latest_long_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type='long_rest';

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='primal-companion';

  v_configured:=found
    and coalesce((v_runtime.state->>'configured')::boolean,false)
    and coalesce(v_runtime.state->>'statBlockKey','') in ('land','sea','sky')
    and btrim(coalesce(v_runtime.state->>'appearance',''))<>'';

  v_can_replace:=v_configured
    and v_latest_long_rest is not null
    and (v_runtime.replacement_anchor_at is null or v_latest_long_rest>v_runtime.replacement_anchor_at);

  return jsonb_build_object(
    'available',true,
    'featureKey','primal-companion',
    'featureName','Primal Companion',
    'source','XPHB',
    'cadence','long_rest',
    'configured',v_configured,
    'canConfigure',not v_configured,
    'canReplace',v_can_replace,
    'latestLongRestAt',v_latest_long_rest,
    'replacementAnchorAt',case when found then v_runtime.replacement_anchor_at else null end,
    'state',case when found then v_runtime.state else jsonb_build_object('configured',false) end,
    'options',private.primal_companion_options_v1(),
    'helper','Choose the initial Primal Companion immediately. The current beast persists until you replace it. After a newer Long Rest, you may replace it once with Beast of the Land, Sea, or Sky and choose its appearance.'
  );
end;
$$;

create or replace function public.configure_character_primal_companion_v1(
  p_character_id uuid,
  p_stat_block_key text,
  p_appearance text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_key text:=lower(btrim(coalesce(p_stat_block_key,'')));
  v_appearance text:=btrim(regexp_replace(coalesce(p_appearance,''),'[\r\n\t]+',' ','g'));
  v_option jsonb;
  v_latest_long_rest timestamptz;
  v_state jsonb;
  v_sheet jsonb:='{}'::jsonb;
  v_anchor timestamptz;
  v_active_encounter jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to configure Primal Companion for this character.' using errcode='42501';
  end if;
  if not private.character_has_primal_companion_v1(p_character_id) then
    raise exception 'Primal Companion requires an XPHB Ranger 3+ with the Beast Master subclass.';
  end if;

  v_active_encounter:=private.character_active_encounter_v1(p_character_id);
  if v_active_encounter is not null then
    raise exception 'Primal Companion cannot be changed while this character is in an active encounter.';
  end if;

  select entry.value into v_option
  from jsonb_array_elements(private.primal_companion_options_v1()) entry(value)
  where entry.value->>'key'=v_key
  limit 1;
  if v_option is null then
    raise exception 'Choose Beast of the Land, Beast of the Sea, or Beast of the Sky.';
  end if;
  if char_length(v_appearance)<1 or char_length(v_appearance)>80 then
    raise exception 'Primal Companion appearance must be between 1 and 80 characters.';
  end if;

  select max(completed_at) into v_latest_long_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type='long_rest';

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='primal-companion'
  for update;

  if found and coalesce((v_runtime.state->>'configured')::boolean,false) then
    if v_latest_long_rest is null or (v_runtime.replacement_anchor_at is not null and v_latest_long_rest<=v_runtime.replacement_anchor_at) then
      raise exception 'Finish a newer Long Rest before replacing the current Primal Companion.';
    end if;
    v_anchor:=v_latest_long_rest;
    v_state:=jsonb_build_object(
      'configured',true,
      'statBlockKey',v_key,
      'statBlockName',v_option->>'name',
      'appearance',v_appearance,
      'configuredAt',timezone('utc',now()),
      'configuredRestAt',v_latest_long_rest,
      'previousCompanion',jsonb_build_object(
        'statBlockKey',v_runtime.state->>'statBlockKey',
        'statBlockName',v_runtime.state->>'statBlockName',
        'appearance',v_runtime.state->>'appearance'
      )
    );
  else
    -- Initial feature acquisition does not require a prior rest. Anchor the
    -- current selection at configuration time so only a future Long Rest can
    -- authorize its first replacement.
    v_anchor:=timezone('utc',now());
    v_state:=jsonb_build_object(
      'configured',true,
      'statBlockKey',v_key,
      'statBlockName',v_option->>'name',
      'appearance',v_appearance,
      'configuredAt',v_anchor,
      'configuredRestAt',v_latest_long_rest
    );
  end if;

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    p_character_id,'primal-companion','Primal Companion','XPHB','long_rest',v_state,v_anchor,now(),now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,
    source=excluded.source,
    cadence=excluded.cadence,
    state=excluded.state,
    replacement_anchor_at=excluded.replacement_anchor_at,
    updated_at=now();

  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=p_character_id for update;
  if not found then raise exception 'Character sheet is unavailable.'; end if;
  v_sheet:=jsonb_set(v_sheet,'{runtimeCompanions,primalCompanion}',v_state,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;

  return public.get_character_primal_companion_v1(p_character_id);
end;
$$;

revoke all on function private.character_has_primal_companion_v1(uuid) from public,anon,authenticated;
revoke all on function private.primal_companion_options_v1() from public,anon,authenticated;
grant execute on function private.character_has_primal_companion_v1(uuid) to service_role;
grant execute on function private.primal_companion_options_v1() to service_role;
revoke all on function public.get_character_primal_companion_v1(uuid) from public,anon;
revoke all on function public.configure_character_primal_companion_v1(uuid,text,text) from public,anon;
grant execute on function public.get_character_primal_companion_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_primal_companion_v1(uuid,text,text) to authenticated,service_role;
