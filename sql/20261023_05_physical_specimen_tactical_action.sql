-- Physical Specimen tactical Bonus Action -- STAGED / NO UI CALLERS.
-- Depends on 20261023_02, _03, _04.
-- Extends the encounter command allowlist without changing existing command types.
-- This atomic command spends a Bonus Action and adjusts the encounter's HP and
-- Speed snapshot once. Other nonnumeric benefits are recorded as effective
-- feature metadata but are NOT yet consumed by all tactical resolution paths.
-- Keep draft/unexposed until complete downstream gameplay integration.

alter table public.encounter_command_requests
  drop constraint if exists encounter_command_requests_command_type_check;
alter table public.encounter_command_requests
  add constraint encounter_command_requests_command_type_check
  check (command_type in (
    'move','end_turn','core_action','attack','weapon_attack',
    'save','reaction','effect','spell_cast','feature_action'
  ));

create or replace function public.encounter_activate_physical_specimen_v1(
  p_participant_id uuid,p_benefit_keys text[],p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_uid uuid:=auth.uid();
  v_participant public.encounter_participants%rowtype;
  v_encounter public.encounters%rowtype;
  v_existing_request public.encounter_command_requests%rowtype;
  v_progression_locked boolean;
  v_options jsonb;
  v_context jsonb;
  v_old public.character_runtime_feature_choices%rowtype;
  v_old_activated timestamptz;
  v_last_long_rest timestamptz;
  v_spent boolean:=false;
  v_activated_at timestamptz;
  v_state jsonb;
  v_hp_bonus integer:=0;
  v_speed_bonus integer:=0;
  v_new_max_hp integer;
  v_new_speed integer;
  v_effect_metadata jsonb;
  v_result jsonb;
  v_inserted integer;
begin
  if p_participant_id is null or p_request_id is null then
    raise exception 'Participant and request ID are required.' using errcode='22023';
  end if;
  -- Reject unknown/noncontrolled participants *before* reading an idempotency
  -- result: request UUID alone must not reveal anyone else's combat result.
  select * into v_participant
  from public.encounter_participants where id=p_participant_id;
  if not found or v_participant.character_id is null then
    raise exception 'An eligible character participant is required.' using errcode='22023';
  end if;
  if not public.encounter_can_control_participant_v1(p_participant_id)
     or not private.can_manage_character_progression_v1(v_participant.character_id) then
    raise exception 'Not authorized to activate this character feature in combat.'
      using errcode='42501';
  end if;
  insert into public.encounter_command_requests(
    request_id,encounter_id,participant_id,command_type,requested_by
  ) values (
    p_request_id,v_participant.encounter_id,p_participant_id,'feature_action',v_uid
  ) on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select * into v_existing_request from public.encounter_command_requests
      where request_id=p_request_id;
    if not found
      or v_existing_request.command_type<>'feature_action'
      or v_existing_request.participant_id is distinct from p_participant_id
      or v_existing_request.encounter_id is distinct from v_participant.encounter_id
      or v_existing_request.result is null
      or v_existing_request.result->>'featureKey'<>'warlock-parasite-physical-specimen'
      or v_existing_request.result->'benefitKeys' is distinct from to_jsonb(p_benefit_keys)
      or v_existing_request.result->>'requestId' is distinct from p_request_id::text then
      raise exception 'Request ID was used for another operation or choice set.'
        using errcode='22023';
    end if;
    return v_existing_request.result;
  end if;

  select * into v_participant from public.encounter_participants
    where id=p_participant_id for update;
  if not found or v_participant.character_id is null then
    raise exception 'Character participant no longer exists.' using errcode='22023';
  end if;
  select * into v_encounter from public.encounters
    where id=v_participant.encounter_id for update;
  if not found or v_encounter.status<>'active'
    or v_encounter.active_participant_id is distinct from p_participant_id then
    raise exception 'Physical Specimen is only available on the active participant turn.'
      using errcode='55000';
  end if;
  if not public.encounter_can_control_participant_v1(p_participant_id)
     or not private.can_manage_character_progression_v1(v_participant.character_id) then
    raise exception 'Not authorized to activate this character feature in combat.'
      using errcode='42501';
  end if;
  if v_participant.is_defeated or not v_participant.bonus_action_available then
    raise exception 'A living participant with an available Bonus Action is required.'
      using errcode='55000';
  end if;
  if exists(select 1 from public.encounter_conditions c
      where c.participant_id=p_participant_id
        and c.condition_key in ('incapacitated','paralyzed','stunned','unconscious','petrified')) then
    raise exception 'Current conditions prevent Bonus Actions.' using errcode='55000';
  end if;
  if jsonb_typeof(v_participant.state)='object'
     and v_participant.state ? 'physicalSpecimen' then
    raise exception 'Existing Physical Specimen combat snapshot needs reconciliation.'
      using errcode='55000';
  end if;
  -- Match the progression row lock used by the out-of-combat activation RPC.
  select true into v_progression_locked from public.character_progression
    where character_id=v_participant.character_id for update;
  if not coalesce(v_progression_locked,false) then
    raise exception 'Canonical progression is not available.' using errcode='22023';
  end if;
  v_context:=private.physical_specimen_context_v1(v_participant.character_id);
  v_options:=private.physical_specimen_options_v1();
  if not coalesce((v_context->>'eligible')::boolean,false) or
     jsonb_array_length(v_options)<>6 or
     not coalesce(private.physical_specimen_valid_benefit_keys_v1(
       p_benefit_keys,v_options,(v_context->>'maxBenefits')::integer),false) then
    raise exception 'Physical Specimen selection is not legal for this character.'
      using errcode='22023';
  end if;
  select max(completed_at) into v_last_long_rest
    from public.character_rest_log
    where character_id=v_participant.character_id and rest_type='long_rest';
  select * into v_old from public.character_runtime_feature_choices
    where character_id=v_participant.character_id
      and feature_key='warlock-parasite-physical-specimen'
    for update;
  if found then
    -- A malformed already-used activation cannot be silently reset.
    if coalesce((v_old.state->>'activated')::boolean,false) then
      begin
        v_old_activated:=nullif(v_old.state->>'activatedAt','')::timestamptz;
      exception when others then
        raise exception 'Previously activated Physical Specimen requires reconciliation.'
          using errcode='22023';
      end;
      if v_old_activated is null then
        raise exception 'Previously activated Physical Specimen requires reconciliation.'
          using errcode='22023';
      end if;
      v_spent:=(v_last_long_rest is null or v_last_long_rest<=v_old_activated);
      if v_spent then
        raise exception 'Physical Specimen has already been used this Long Rest.'
          using errcode='22023';
      end if;
    end if;
  end if;

  if v_participant.max_hp is null or v_participant.max_hp<1
    or v_participant.speed_ft<1 then
    raise exception 'Tactical HP and Speed snapshot must be initialized.'
      using errcode='22023';
  end if;

  v_hp_bonus:=case when 'enhanced-vitality'=any(p_benefit_keys)
    then (v_context->>'classLevel')::integer else 0 end;
  v_speed_bonus:=case when 'increased-speed'=any(p_benefit_keys) then 5 else 0 end;
  v_new_max_hp:=v_participant.max_hp+v_hp_bonus;
  v_new_speed:=v_participant.speed_ft+v_speed_bonus;
  v_activated_at:=clock_timestamp();
  v_state:=jsonb_build_object(
    'activated',true,'active',true,
    'featureKey','warlock-parasite-physical-specimen',
    'featureName','Physical Specimen','source','GrimHollowPG24',
    'classSource','XPHB','subclassName','The Parasite Patron',
    'benefitKeys',to_jsonb(p_benefit_keys),'activatedAt',v_activated_at,
    'activatedBy','tactical_bonus_action','activatedLongRestAt',v_last_long_rest,
    'shortRestSwapsUsed',0,'lastSwapAt',null,'lastSwapRestAt',null
  );
  v_effect_metadata:=jsonb_build_object(
    'featureKey','warlock-parasite-physical-specimen',
    'benefitKeys',to_jsonb(p_benefit_keys),
    'activatedAt',v_activated_at,
    'maxHpDeltaApplied',v_hp_bonus,'speedDeltaAppliedFt',v_speed_bonus,
    'enhancedVision','enhanced-vision'=any(p_benefit_keys),
    'poisonedSaveAdvantage','poison-resistance-training'=any(p_benefit_keys),
    'jumpDistanceMultiplier',case when 'enhanced-mobility'=any(p_benefit_keys) then 3 else 1 end,
    'climbSpeedEqualsSpeed','enhanced-mobility'=any(p_benefit_keys),
    'physicalAptitudeBonus',case when 'physical-aptitude'=any(p_benefit_keys)
      then (v_context->>'charismaModifier')::integer else 0 end,
    'downstreamRulesPending',true
  );
  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,
    replacement_anchor_at,created_at,updated_at
  ) values (
    v_participant.character_id,'warlock-parasite-physical-specimen',
    'Physical Specimen','GrimHollowPG24','per_use',v_state,
    null,now(),now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,source=excluded.source,
    cadence=excluded.cadence,state=excluded.state,
    replacement_anchor_at=null,updated_at=now();

  -- HP is *not* healed when maximum HP increases. This write applies only to
  -- the encounter snapshot; permanent character_sheets remain unchanged.
  update public.encounter_participants
    set bonus_action_available=false,
        max_hp=v_new_max_hp,
        speed_ft=v_new_speed,
        state=coalesce(v_participant.state,'{}'::jsonb) ||
          jsonb_build_object('physicalSpecimen',v_effect_metadata),
        updated_at=timezone('utc',now())
    where id=p_participant_id;
  v_result:=jsonb_build_object(
    'requestId',p_request_id,'participantId',p_participant_id,
    'featureKey','warlock-parasite-physical-specimen',
    'benefitKeys',to_jsonb(p_benefit_keys),
    'actionType','bonus_action','bonusActionAvailable',false,
    'currentHp',v_participant.current_hp,
    'maxHp',v_new_max_hp,'speedFt',v_new_speed,
    'activatedAt',v_activated_at,
    'downstreamRulesPending',true,'effectsFullyIntegrated',false
  );
  insert into public.encounter_combat_log(
    encounter_id,round,turn_index,actor_participant_id,
    event_type,summary,detail
  ) values (
    v_encounter.id,v_encounter.round,v_encounter.turn_index,
    p_participant_id,'feature_action',
    v_participant.display_name||' activated Physical Specimen.',
    v_result
  );
  update public.encounters set version=version+1,updated_at=timezone('utc',now())
    where id=v_encounter.id;
  update public.encounter_command_requests set result=v_result
    where request_id=p_request_id;
  return v_result;
end;
$$;

revoke all on function public.encounter_activate_physical_specimen_v1(uuid,text[],uuid)
  from public,anon;
grant execute on function public.encounter_activate_physical_specimen_v1(uuid,text[],uuid)
  to authenticated,service_role;
