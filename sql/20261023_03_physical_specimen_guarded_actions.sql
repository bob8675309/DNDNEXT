-- Physical Specimen: guarded outside-encounter activation and Short-Rest swaps.
-- Depends on sql/20261023_02_physical_specimen_read_model.sql.
-- These RPCs never update character_sheets, character_progression or combat turns.
-- Active-encounter Bonus Action activation is a separate tactical implementation.

create or replace function private.physical_specimen_valid_benefit_keys_v1(
  p_keys text[],p_options jsonb,p_max integer
) returns boolean
language sql immutable
set search_path=pg_catalog
as $$
  select p_keys is not null
    and cardinality(p_keys) between 1 and least(6,coalesce(p_max,0))
    and cardinality(p_keys)=(select count(distinct k.value)::integer
      from unnest(p_keys) k(value))
    and not exists(
      select 1 from unnest(p_keys) k(value)
      where k.value is null or not exists (
        select 1 from jsonb_array_elements(coalesce(p_options,'[]'::jsonb)) o(value)
        where o.value->>'key'=k.value
      )
    );
$$;

create or replace function public.activate_character_physical_specimen_v1(
  p_character_id uuid,p_benefit_keys text[]
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_locked boolean;
  v_context jsonb;
  v_options jsonb;
  v_row public.character_runtime_feature_choices%rowtype;
  v_had_row boolean:=false;
  v_old_activated timestamptz;
  v_latest_long_rest timestamptz;
  v_at timestamptz;
  v_state jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to activate Physical Specimen for this character.'
      using errcode='42501';
  end if;
  -- Serialize activations even when a runtime row doesn't exist yet.
  select true into v_locked from public.character_progression
    where character_id=p_character_id for update;
  if not coalesce(v_locked,false) then
    raise exception 'Character progression is unavailable.' using errcode='22023';
  end if;
  v_context:=private.physical_specimen_context_v1(p_character_id);
  if not coalesce((v_context->>'eligible')::boolean,false) then
    raise exception 'Physical Specimen requires an eligible level 3+ XPHB Warlock with the GrimHollowPG24 Parasite Patron.'
      using errcode='22023';
  end if;
  if private.character_active_encounter_v1(p_character_id) is not null then
    raise exception 'Physical Specimen activation during a tactical encounter must use the encounter Bonus Action command.'
      using errcode='55000';
  end if;
  v_options:=private.physical_specimen_options_v1();
  if jsonb_array_length(v_options)<>6
    or not private.physical_specimen_valid_benefit_keys_v1(
      p_benefit_keys,v_options,(v_context->>'maxBenefits')::integer
    ) then
    raise exception 'Choose between 1 and the allowed number of distinct Physical Specimen benefits from the source options.'
      using errcode='22023';
  end if;
  select max(completed_at) into v_latest_long_rest
    from public.character_rest_log where character_id=p_character_id and rest_type='long_rest';
  select * into v_row from public.character_runtime_feature_choices
    where character_id=p_character_id and feature_key='warlock-parasite-physical-specimen'
    for update;
  v_had_row:=found;
  if v_had_row and coalesce((v_row.state->>'activated')::boolean,false) then
    -- Invalid timestamps must never grant a second use.
    begin
      v_old_activated:=nullif(v_row.state->>'activatedAt','')::timestamptz;
    exception when others then
      raise exception 'Physical Specimen activation record needs reconciliation before reuse.'
        using errcode='22023';
    end;
    if v_old_activated is null then
      raise exception 'Physical Specimen activation record needs reconciliation before reuse.'
        using errcode='22023';
    end if;
    if v_latest_long_rest is null or v_latest_long_rest<=v_old_activated then
      raise exception 'Physical Specimen has already been activated since the last Long Rest.'
        using errcode='22023';
    end if;
  end if;
  v_at:=clock_timestamp();
  v_state:=jsonb_build_object(
    'activated',true,'active',true,
    'featureKey','warlock-parasite-physical-specimen',
    'featureName','Physical Specimen','source','GrimHollowPG24',
    'classSource','XPHB','subclassName','The Parasite Patron',
    'benefitKeys',to_jsonb(p_benefit_keys),
    'activatedAt',v_at,'activatedBy','outside_encounter_bonus_action',
    'activatedLongRestAt',v_latest_long_rest,
    'shortRestSwapsUsed',0,
    'lastSwapAt',null,'lastSwapRestAt',null
  );
  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,
    replacement_anchor_at,created_at,updated_at
  ) values (
    p_character_id,'warlock-parasite-physical-specimen',
    'Physical Specimen','GrimHollowPG24','per_use',v_state,
    null,now(),now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,source=excluded.source,
    cadence=excluded.cadence,state=excluded.state,
    replacement_anchor_at=null,updated_at=now();
  return jsonb_build_object('saved',true,'active',true,
    'featureKey','warlock-parasite-physical-specimen',
    'activationAction','bonus_action','activationMode','outside_encounter',
    'benefitKeys',to_jsonb(p_benefit_keys),
    'activatedAt',v_at,'latestLongRestAt',v_latest_long_rest,
    'effectsIntegrated',false,'state',v_state);
end;
$$;

create or replace function public.swap_character_physical_specimen_benefit_v1(
  p_character_id uuid,p_previous_key text,p_next_key text
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_locked boolean;
  v_context jsonb;
  v_options jsonb;
  v_row public.character_runtime_feature_choices%rowtype;
  v_old_keys text[];
  v_next_keys text[];
  v_activated_at timestamptz;
  v_latest_short_rest timestamptz;
  v_latest_long_rest timestamptz;
  v_state jsonb;
  v_now timestamptz;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to change Physical Specimen for this character.'
      using errcode='42501';
  end if;
  select true into v_locked from public.character_progression
    where character_id=p_character_id for update;
  if not coalesce(v_locked,false) then
    raise exception 'Character progression is unavailable.' using errcode='22023';
  end if;
  v_context:=private.physical_specimen_context_v1(p_character_id);
  if not coalesce((v_context->>'eligible')::boolean,false) then
    raise exception 'The character is not eligible for Physical Specimen.'
      using errcode='22023';
  end if;
  if private.character_active_encounter_v1(p_character_id) is not null then
    raise exception 'Physical Specimen benefits cannot be swapped during an active tactical encounter.'
      using errcode='55000';
  end if;
  v_options:=private.physical_specimen_options_v1();
  if jsonb_array_length(v_options)<>6 then
    raise exception 'Physical Specimen source options are not available.'
      using errcode='22023';
  end if;
  select * into v_row from public.character_runtime_feature_choices
    where character_id=p_character_id and feature_key='warlock-parasite-physical-specimen'
    for update;
  if not found or not coalesce((v_row.state->>'activated')::boolean,false) then
    raise exception 'Activate Physical Specimen before replacing a selected benefit.'
      using errcode='22023';
  end if;
  begin
    v_activated_at:=nullif(v_row.state->>'activatedAt','')::timestamptz;
  exception when others then
    raise exception 'Physical Specimen activation record needs reconciliation.'
      using errcode='22023';
  end;
  if v_activated_at is null or jsonb_typeof(v_row.state->'benefitKeys')<>'array' then
    raise exception 'Physical Specimen saved state is incomplete.'
      using errcode='22023';
  end if;
  select array_agg(k.value order by k.ordinality) into v_old_keys
    from jsonb_array_elements_text(v_row.state->'benefitKeys') with ordinality k(value,ordinality);
  if not private.physical_specimen_valid_benefit_keys_v1(
    v_old_keys,v_options,(v_context->>'maxBenefits')::integer
  ) then
    raise exception 'Physical Specimen saved choices require reconciliation.'
      using errcode='22023';
  end if;
  select max(completed_at) into v_latest_long_rest
    from public.character_rest_log where character_id=p_character_id and rest_type='long_rest';
  if v_latest_long_rest is not null and v_latest_long_rest>v_activated_at then
    raise exception 'Physical Specimen expired at the latest Long Rest; activate it again.'
      using errcode='22023';
  end if;
  select max(completed_at) into v_latest_short_rest
    from public.character_rest_log where character_id=p_character_id and rest_type='short_rest';
  if v_latest_short_rest is null or v_latest_short_rest<=v_activated_at then
    raise exception 'Finish a Short Rest after activation before replacing a benefit.'
      using errcode='22023';
  end if;
  if v_row.replacement_anchor_at is not null
    and v_latest_short_rest<=v_row.replacement_anchor_at then
    raise exception 'A benefit was already replaced after this Short Rest.'
      using errcode='22023';
  end if;
  if p_previous_key is null or p_next_key is null
    or p_previous_key=p_next_key
    or not (p_previous_key=any(v_old_keys))
    or p_next_key=any(v_old_keys)
    or not exists(select 1 from jsonb_array_elements(v_options) o(value)
                  where o.value->>'key'=p_next_key) then
    raise exception 'Choose exactly one selected benefit to replace with a different unselected source benefit.'
      using errcode='22023';
  end if;
  v_next_keys:=array_replace(v_old_keys,p_previous_key,p_next_key);
  if not private.physical_specimen_valid_benefit_keys_v1(
    v_next_keys,v_options,(v_context->>'maxBenefits')::integer
  ) then
    raise exception 'The requested Physical Specimen replacement is invalid.'
      using errcode='22023';
  end if;
  v_now:=clock_timestamp();
  v_state:=jsonb_set(v_row.state,'{benefitKeys}',to_jsonb(v_next_keys),true)
    ||jsonb_build_object(
      'lastSwapAt',v_now,'lastSwapRestAt',v_latest_short_rest,
      'lastSwapFrom',p_previous_key,'lastSwapTo',p_next_key,
      'shortRestSwapsUsed',coalesce((v_row.state->>'shortRestSwapsUsed')::integer,0)+1
    );
  update public.character_runtime_feature_choices
    set state=v_state,replacement_anchor_at=v_latest_short_rest,updated_at=now()
    where character_id=p_character_id and feature_key='warlock-parasite-physical-specimen';
  return jsonb_build_object('saved',true,'active',true,
    'featureKey','warlock-parasite-physical-specimen',
    'benefitKeys',to_jsonb(v_next_keys),'lastSwapAt',v_now,
    'lastSwapRestAt',v_latest_short_rest,
    'effectsIntegrated',false,'state',v_state);
end;
$$;

-- Pure read-only projection for later adoption by the existing paper-style
-- sheet/roll pipeline. This returns deltas without modifying base stats.
create or replace function public.get_character_physical_specimen_effects_v1(
  p_character_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_profile jsonb:=public.get_character_physical_specimen_v1(p_character_id);
  v_active boolean;
  v_keys jsonb;
  v_class_level integer;
  v_cha_modifier integer;
begin
  v_active:=coalesce((v_profile->>'active')::boolean,false);
  if not coalesce((v_profile->>'available')::boolean,false) then
    return jsonb_build_object('available',false,'active',false,
      'effectsIntegrated',false);
  end if;
  v_keys:=case when v_active then v_profile->'activeBenefitKeys' else '[]'::jsonb end;
  v_class_level:=(v_profile #>> '{context,classLevel}')::integer;
  v_cha_modifier:=(v_profile #>> '{context,charismaModifier}')::integer;
  return jsonb_build_object(
    'available',true,'active',v_active,'effectsIntegrated',false,
    'hpMaxBonus',case when v_keys ? 'enhanced-vitality' then v_class_level else 0 end,
    'darkvisionGrantedMinFt',case when v_keys ? 'enhanced-vision' then 60 else 0 end,
    'darkvisionExtraFt',case when v_keys ? 'enhanced-vision' then 60 else 0 end,
    'speedBonusFt',case when v_keys ? 'increased-speed' then 5 else 0 end,
    'poisonedSaveAdvantage',v_keys ? 'poison-resistance-training',
    'jumpDistanceMultiplier',case when v_keys ? 'enhanced-mobility' then 3 else 1 end,
    'climbSpeedEqualsEffectiveSpeed',v_keys ? 'enhanced-mobility',
    'athleticsCheckBonus',case when v_keys ? 'physical-aptitude' then v_cha_modifier else 0 end,
    'acrobaticsCheckBonus',case when v_keys ? 'physical-aptitude' then v_cha_modifier else 0 end
  );
end;
$$;

revoke all on function private.physical_specimen_valid_benefit_keys_v1(text[],jsonb,integer)
  from public,anon,authenticated;
grant execute on function private.physical_specimen_valid_benefit_keys_v1(text[],jsonb,integer)
  to service_role;
revoke all on function public.activate_character_physical_specimen_v1(uuid,text[])
  from public,anon;
revoke all on function public.swap_character_physical_specimen_benefit_v1(uuid,text,text)
  from public,anon;
revoke all on function public.get_character_physical_specimen_effects_v1(uuid)
  from public,anon;
grant execute on function public.activate_character_physical_specimen_v1(uuid,text[])
  to authenticated,service_role;
grant execute on function public.swap_character_physical_specimen_benefit_v1(uuid,text,text)
  to authenticated,service_role;
grant execute on function public.get_character_physical_specimen_effects_v1(uuid)
  to authenticated,service_role;
