-- Phase 1S: first reviewed multi-target area spell adapter.
-- Word of Radiance (XPHB) uses a caster-centered 5-foot Emanation.
-- The caller explicitly selects affected creatures; selected origin/caster inclusion is allowed.
-- Damage is rolled once for all simultaneous saving throws.

create or replace function public.encounter_cast_area_spell_v1(
  p_caster_id uuid,
  p_assignment_id uuid,
  p_target_ids uuid[],
  p_slot_level integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text:=coalesce(auth.role(),'');
  v_c public.encounter_participants%rowtype;
  v_t public.encounter_participants%rowtype;
  v_e public.encounters%rowtype;
  v_assignment public.character_spells%rowtype;
  v_spell public.spells_catalog%rowtype;
  v_existing public.encounter_command_requests%rowtype;
  v_profile jsonb;
  v_targeting jsonb;
  v_save_profile jsonb;
  v_damage jsonb;
  v_result jsonb;
  v_target_results jsonb:='[]'::jsonb;
  v_inserted integer:=0;
  v_target_count integer:=0;
  v_unique_count integer:=0;
  v_target_id uuid;
  v_dist_ft integer:=0;
  v_casting_ability text;
  v_casting_score integer;
  v_cast_mod integer;
  v_prof integer;
  v_save_dc integer;
  v_save_bonus integer;
  v_save_roll integer;
  v_save_total integer;
  v_save_success boolean:=false;
  v_dice_count integer:=0;
  v_die_size integer:=6;
  v_shared_damage_roll integer:=0;
  v_i integer;
  v_success_count integer:=0;
  v_failure_count integer:=0;
begin
  if p_caster_id is null or p_assignment_id is null or p_request_id is null then
    raise exception 'Caster, spell assignment, and request id are required';
  end if;
  if p_target_ids is null or cardinality(p_target_ids)=0 then
    raise exception 'Choose at least one creature for this area spell';
  end if;
  select count(*),count(distinct x)
  into v_target_count,v_unique_count
  from unnest(p_target_ids) as u(x);
  if v_target_count<>v_unique_count then
    raise exception 'Area spell target list contains duplicates';
  end if;

  select * into v_c
  from public.encounter_participants
  where id=p_caster_id;
  if not found then raise exception 'Caster not found'; end if;

  select * into v_assignment
  from public.character_spells
  where id=p_assignment_id and character_id=v_c.character_id;
  if not found then raise exception 'Spell assignment is not in this character''s spellbook'; end if;

  select * into v_spell
  from public.spells_catalog
  where id=v_assignment.spell_id;
  if not found then raise exception 'Assigned spell definition not found'; end if;

  if lower(v_spell.spell_key)<>'word-of-radiance|xphb' then
    raise exception 'This area spell remains GM-assisted; no automated tactical adapter is approved yet';
  end if;
  if lower(coalesce(v_assignment.source_type,''))<>'class' then
    raise exception 'Only class spell assignments are automated in this casting slice';
  end if;
  if lower(coalesce(v_assignment.source_label,''))<>'cleric' then
    raise exception 'Word of Radiance automation requires its reviewed Cleric class assignment';
  end if;
  if v_spell.source<>'XPHB' then
    raise exception 'Only the reviewed XPHB spell version is automated in this casting slice';
  end if;
  if v_spell.level<>0 then
    raise exception 'Word of Radiance must resolve from its reviewed cantrip definition';
  end if;
  if p_slot_level is not null and p_slot_level<>0 then
    raise exception 'Cantrips do not use spell slots';
  end if;

  insert into public.encounter_command_requests(
    request_id,encounter_id,participant_id,command_type,requested_by
  ) values (
    p_request_id,v_c.encounter_id,v_c.id,'area_spell_cast',v_uid
  ) on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select * into v_existing
    from public.encounter_command_requests
    where request_id=p_request_id;
    if not found
       or v_existing.command_type<>'area_spell_cast'
       or v_existing.participant_id<>v_c.id then
      raise exception 'Request id is already used for another command';
    end if;
    return coalesce(v_existing.result,jsonb_build_object('duplicate',true,'pending',true));
  end if;

  select * into v_c
  from public.encounter_participants
  where id=p_caster_id
  for update;
  select * into v_e
  from public.encounters
  where id=v_c.encounter_id
  for update;
  if not found then raise exception 'Encounter not found'; end if;

  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_c.id then
    raise exception 'It is not this participant''s active turn';
  end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_c.id) then
    raise exception 'Not authorized to control this participant';
  end if;
  if v_c.is_defeated then raise exception 'Defeated participants cannot cast spells'; end if;
  if not v_c.action_available then raise exception 'Action already spent'; end if;
  if exists(
    select 1
    from public.encounter_conditions c
    where c.participant_id=v_c.id
      and c.condition_key in ('incapacitated','paralyzed','stunned','unconscious')
  ) then
    raise exception 'Current conditions prevent this participant from taking the Cast action';
  end if;

  v_profile:=public.encounter_spellcasting_profile_v1(v_c.id);
  if not coalesce((v_profile->>'isClassCaster')::boolean,false) then
    raise exception 'This participant has no canonical class spellcasting profile';
  end if;
  if lower(coalesce(v_profile->>'className',''))<>'cleric' then
    raise exception 'Word of Radiance automation requires a canonical Cleric spellcasting profile';
  end if;
  v_casting_ability:=lower(coalesce(nullif(btrim(v_assignment.casting_stat),''),v_profile->>'castingAbility',''));
  if v_casting_ability not in ('str','dex','con','int','wis','cha') then
    raise exception 'Casting ability is unavailable';
  end if;
  v_casting_score:=private.encounter_ability_score_v1(v_c.character_id,v_casting_ability);
  v_cast_mod:=floor((coalesce(v_casting_score,10)-10)/2.0)::integer;
  v_prof:=coalesce((v_profile->>'proficiencyBonus')::integer,2);
  v_save_dc:=coalesce(v_assignment.save_dc_override,8+v_cast_mod+v_prof);

  -- Validate and lock the entire chosen target set before any save, effect consumption,
  -- damage, Action spend, or log write occurs.
  foreach v_target_id in array p_target_ids loop
    if v_target_id=v_c.id then
      v_t:=v_c;
      v_dist_ft:=0;
    else
      select * into v_t
      from public.encounter_participants
      where id=v_target_id and encounter_id=v_c.encounter_id
      for update;
      if not found then raise exception 'Area spell target not found in this encounter'; end if;
      if v_t.is_hidden
         and v_role<>'service_role'
         and v_t.controller_user_id is distinct from v_uid
         and (v_uid is null or not public.is_admin(v_uid)) then
        raise exception 'Area spell target is hidden from this controller';
      end if;
      v_targeting:=public.encounter_targeting_context_internal_v1(v_c.id,v_t.id);
      if not coalesce((v_targeting->>'hasLineOfSight')::boolean,false) then
        raise exception 'Every selected Word of Radiance target must be visible from the caster';
      end if;
      v_dist_ft:=coalesce((v_targeting->>'distanceFt')::integer,0);
      if v_dist_ft>5 then
        raise exception 'Every selected Word of Radiance target must be inside the 5-foot Emanation';
      end if;
    end if;
    if v_t.is_defeated then
      raise exception 'Defeated participants are not automated targets for Word of Radiance';
    end if;
    if exists(select 1 from public.encounter_conditions c where c.participant_id=v_t.id) then
      raise exception 'Word of Radiance against targets with active conditions remains GM-assisted in this slice';
    end if;
  end loop;

  v_dice_count:=case
    when coalesce((v_profile->>'classLevel')::integer,1)>=17 then 4
    when coalesce((v_profile->>'classLevel')::integer,1)>=11 then 3
    when coalesce((v_profile->>'classLevel')::integer,1)>=5 then 2
    else 1
  end;

  -- XPHB damage-via-save rule: one simultaneous damage roll is shared by all targets.
  for v_i in 1..v_dice_count loop
    v_shared_damage_roll:=v_shared_damage_roll+floor(random()*v_die_size)::integer+1;
  end loop;

  foreach v_target_id in array p_target_ids loop
    if v_target_id=v_c.id then
      v_t:=v_c;
      v_dist_ft:=0;
      v_targeting:=jsonb_build_object(
        'distanceFt',0,
        'hasLineOfSight',true,
        'coverLevel','none',
        'originIncluded',true
      );
    else
      select * into v_t
      from public.encounter_participants
      where id=v_target_id and encounter_id=v_c.encounter_id;
      v_targeting:=public.encounter_targeting_context_internal_v1(v_c.id,v_t.id);
      v_dist_ft:=coalesce((v_targeting->>'distanceFt')::integer,0);
    end if;

    v_save_profile:=public.encounter_saving_throw_profile_internal_v1(v_t.id,'con');
    v_save_bonus:=coalesce((v_save_profile->>'saveBonus')::integer,0);
    v_save_roll:=floor(random()*20)::integer+1;
    v_save_total:=v_save_roll+v_save_bonus;
    v_save_success:=v_save_total>=v_save_dc;

    if v_save_success then
      v_success_count:=v_success_count+1;
      v_damage:=jsonb_build_object(
        'targetId',v_t.id,'damageType','radiant','rawDamage',0,
        'resistant',false,'immune',false,'vulnerable',false,'damage',0,
        'targetHp',v_t.current_hp,'targetTempHp',v_t.temp_hp,'defeated',v_t.is_defeated
      );
    else
      v_failure_count:=v_failure_count+1;
      v_damage:=public.encounter_apply_damage_internal_v1(v_t.id,v_shared_damage_roll,'radiant');
    end if;

    v_target_results:=v_target_results||jsonb_build_array(jsonb_build_object(
      'targetId',v_t.id,
      'targetName',v_t.display_name,
      'distanceFt',v_dist_ft,
      'originIncluded',v_t.id=v_c.id,
      'saveAbility','con',
      'saveDc',v_save_dc,
      'saveBonus',v_save_bonus,
      'saveRoll',v_save_roll,
      'saveTotal',v_save_total,
      'saveSuccess',v_save_success,
      'saveAdvantage',false,
      'saveProfile',v_save_profile,
      'savePenalty',coalesce((v_save_profile->>'savePenalty')::integer,0),
      'coverAffectsSave',false,
      'damageType','radiant',
      'rawDamage',case when v_save_success then 0 else v_shared_damage_roll end,
      'damage',v_damage,
      'targeting',v_targeting
    ));
  end loop;

  v_result:=jsonb_build_object(
    'requestId',p_request_id,
    'casterId',v_c.id,
    'assignmentId',v_assignment.id,
    'spellId',v_spell.id,
    'spellKey',v_spell.spell_key,
    'spell',v_spell.name,
    'actionType','action',
    'slotLevel',null,
    'areaType','emanation',
    'areaRadiusFt',5,
    'originParticipantId',v_c.id,
    'selectedTargetCount',v_target_count,
    'saveAbility','con',
    'saveDc',v_save_dc,
    'damageDice',v_dice_count::text||'d6',
    'sharedDamageRoll',v_shared_damage_roll,
    'damageType','radiant',
    'successCount',v_success_count,
    'failureCount',v_failure_count,
    'targets',v_target_results
  );

  update public.encounter_participants
  set action_available=false,updated_at=timezone('utc',now())
  where id=v_c.id;

  insert into public.encounter_combat_log(
    encounter_id,round,turn_index,actor_participant_id,event_type,summary,detail
  ) values (
    v_e.id,v_e.round,v_e.turn_index,v_c.id,'spell_cast',
    v_c.display_name||' cast Word of Radiance on '||v_target_count||' chosen creature'||case when v_target_count=1 then '.' else 's.' end,
    v_result
  );

  update public.encounters
  set version=version+1,updated_at=timezone('utc',now())
  where id=v_e.id;
  update public.encounter_command_requests
  set result=v_result
  where request_id=p_request_id;

  return v_result;
end;
$function$;

revoke all on function public.encounter_cast_area_spell_v1(uuid,uuid,uuid[],integer,uuid) from public, anon;
grant execute on function public.encounter_cast_area_spell_v1(uuid,uuid,uuid[],integer,uuid) to authenticated, service_role;

do $postconditions$
begin
  if not has_function_privilege('authenticated','public.encounter_cast_area_spell_v1(uuid,uuid,uuid[],integer,uuid)','EXECUTE') then
    raise exception 'guarded area spell cast RPC missing';
  end if;
  if has_function_privilege('anon','public.encounter_cast_area_spell_v1(uuid,uuid,uuid[],integer,uuid)','EXECUTE') then
    raise exception 'anon must not cast reviewed area spells';
  end if;
  if to_regprocedure('public.encounter_cast_spell_v10(uuid,uuid,uuid,integer,uuid)') is null then
    raise exception 'Phase 1R single-target cast RPC must remain available';
  end if;
end
$postconditions$;