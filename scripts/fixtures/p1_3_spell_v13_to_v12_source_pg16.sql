-- SELECT-only source private.encounter_apply_target_turn_end_effect_v1 MD5 29a1ded6e5159d38f46613a25f7c6f3d
CREATE OR REPLACE FUNCTION private.encounter_apply_target_turn_end_effect_v1(p_target_id uuid, p_source_id uuid, p_effect_key text, p_target_turn_ends integer DEFAULT 1, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_t public.encounter_participants%rowtype;
  v_s public.encounter_participants%rowtype;
  v_e public.encounters%rowtype;
  v_key text:=lower(btrim(coalesce(p_effect_key,'')));
  v_id uuid;
begin
  if p_target_id is null or v_key='' then raise exception 'Target-turn-end timed effect target and key are required'; end if;
  if p_target_turn_ends is null or p_target_turn_ends<1 then raise exception 'Timed effect duration must be at least one target turn end'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id;
  if not found then raise exception 'Timed effect target not found'; end if;
  if p_source_id is not null then
    select * into v_s from public.encounter_participants where id=p_source_id and encounter_id=v_t.encounter_id;
    if not found then raise exception 'Timed effect source is not in this encounter'; end if;
  end if;
  select * into v_e from public.encounters where id=v_t.encounter_id;
  if not found then raise exception 'Timed effect encounter not found'; end if;

  insert into public.encounter_timed_effects(
    encounter_id,participant_id,source_participant_id,effect_key,
    remaining_target_turn_starts,expiry_trigger,metadata,applied_round,applied_turn_index,updated_at
  ) values(
    v_t.encounter_id,v_t.id,p_source_id,v_key,p_target_turn_ends,'target_turn_end',
    coalesce(p_metadata,'{}'::jsonb),coalesce(v_e.round,0),coalesce(v_e.turn_index,0),timezone('utc',now())
  )
  on conflict(participant_id,effect_key) do update set
    source_participant_id=excluded.source_participant_id,
    remaining_target_turn_starts=excluded.remaining_target_turn_starts,
    expiry_trigger='target_turn_end',
    metadata=excluded.metadata,
    applied_round=excluded.applied_round,
    applied_turn_index=excluded.applied_turn_index,
    updated_at=timezone('utc',now())
  returning id into v_id;

  return jsonb_build_object(
    'effectId',v_id,'targetId',v_t.id,'sourceId',p_source_id,'effectKey',v_key,
    'expiryTrigger','target_turn_end','remainingTurnEnds',p_target_turn_ends
  );
end;
$function$;

-- SELECT-only source public.encounter_cast_spell_v12 MD5 2e8bef22f86dca97100e7299d746cef7
CREATE OR REPLACE FUNCTION public.encounter_cast_spell_v12(p_caster_id uuid, p_assignment_id uuid, p_target_id uuid, p_slot_level integer, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
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
  v_damage jsonb:=null;
  v_effect jsonb:=null;
  v_inserted integer:=0;
  v_key text;
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
  v_damage_roll integer:=0;
  v_raw_damage integer:=0;
  v_i integer;
  v_result jsonb;
begin
  if p_caster_id is null or p_assignment_id is null or p_target_id is null or p_request_id is null then
    raise exception 'Caster, spell assignment, target, and request id are required';
  end if;

  select * into v_c from public.encounter_participants where id=p_caster_id;
  if not found then raise exception 'Caster not found'; end if;
  select * into v_assignment from public.character_spells where id=p_assignment_id and character_id=v_c.character_id;
  if not found then raise exception 'Spell assignment is not in this character''s spellbook'; end if;
  select * into v_spell from public.spells_catalog where id=v_assignment.spell_id;
  if not found then raise exception 'Assigned spell definition not found'; end if;
  v_key:=lower(v_spell.spell_key);

  if v_key<>'vicious-mockery|xphb' then
    return public.encounter_cast_spell_v11(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
  end if;

  if lower(coalesce(v_assignment.source_type,''))<>'class' or lower(coalesce(v_assignment.source_label,''))<>'bard' then
    raise exception 'Vicious Mockery automation requires its reviewed Bard class assignment';
  end if;
  if v_spell.source<>'XPHB' or v_spell.level<>0 then raise exception 'Vicious Mockery must resolve from its reviewed XPHB cantrip definition'; end if;
  if p_slot_level is not null and p_slot_level<>0 then raise exception 'Cantrips do not use spell slots'; end if;
  if p_target_id=v_c.id then raise exception 'Vicious Mockery requires another creature target'; end if;

  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  values(p_request_id,v_c.encounter_id,v_c.id,'spell_cast',v_uid)
  on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select * into v_existing from public.encounter_command_requests where request_id=p_request_id;
    if not found or v_existing.command_type<>'spell_cast' or v_existing.participant_id<>v_c.id then raise exception 'Request id is already used for another command'; end if;
    return coalesce(v_existing.result,jsonb_build_object('duplicate',true,'pending',true));
  end if;

  select * into v_c from public.encounter_participants where id=p_caster_id for update;
  select * into v_e from public.encounters where id=v_c.encounter_id for update;
  if not found then raise exception 'Encounter not found'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id and encounter_id=v_c.encounter_id for update;
  if not found then raise exception 'Target not found in this encounter'; end if;

  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_c.id then raise exception 'It is not this participant''s active turn'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_c.id) then raise exception 'Not authorized to control this participant'; end if;
  if v_t.is_hidden and v_role<>'service_role' and v_t.controller_user_id is distinct from v_uid and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Target is hidden from this controller'; end if;
  if v_c.is_defeated then raise exception 'Defeated participants cannot cast spells'; end if;
  if v_t.is_defeated then raise exception 'Target is already defeated'; end if;
  if not v_c.action_available then raise exception 'Action already spent'; end if;
  if exists(select 1 from public.encounter_conditions c where c.participant_id=v_c.id and c.condition_key in ('incapacitated','paralyzed','stunned','unconscious')) then
    raise exception 'Current conditions prevent this participant from taking the Cast action';
  end if;
  if exists(select 1 from public.encounter_conditions c where c.participant_id=v_t.id) then
    raise exception 'Save spells against targets with active conditions remain GM-assisted in this slice';
  end if;

  v_profile:=public.encounter_spellcasting_profile_v1(v_c.id);
  if not coalesce((v_profile->>'isClassCaster')::boolean,false) or lower(coalesce(v_profile->>'className',''))<>'bard' then
    raise exception 'Vicious Mockery automation requires a canonical Bard spellcasting profile';
  end if;
  v_casting_ability:=lower(coalesce(nullif(btrim(v_assignment.casting_stat),''),v_profile->>'castingAbility',''));
  if v_casting_ability<>'cha' then raise exception 'Vicious Mockery automation requires the Bard Charisma casting ability'; end if;
  v_casting_score:=private.encounter_ability_score_v1(v_c.character_id,'cha');
  v_cast_mod:=floor((coalesce(v_casting_score,10)-10)/2.0)::integer;
  v_prof:=coalesce((v_profile->>'proficiencyBonus')::integer,2);
  v_save_dc:=coalesce(v_assignment.save_dc_override,8+v_cast_mod+v_prof);

  v_targeting:=public.encounter_targeting_context_internal_v1(v_c.id,v_t.id);
  if not coalesce((v_targeting->>'hasLineOfSight')::boolean,false) then
    raise exception 'Hearing-only Vicious Mockery targeting is not automated yet; this target is not visibly targetable';
  end if;
  v_dist_ft:=coalesce((v_targeting->>'distanceFt')::integer,0);
  if v_dist_ft>60 then raise exception 'Target is beyond Vicious Mockery range'; end if;

  v_save_profile:=public.encounter_saving_throw_profile_internal_v1(v_t.id,'wis');
  v_save_bonus:=coalesce((v_save_profile->>'saveBonus')::integer,0);
  v_save_roll:=floor(random()*20)::integer+1;
  v_save_total:=v_save_roll+v_save_bonus;
  v_save_success:=v_save_total>=v_save_dc;

  v_dice_count:=case
    when coalesce((v_profile->>'classLevel')::integer,1)>=17 then 4
    when coalesce((v_profile->>'classLevel')::integer,1)>=11 then 3
    when coalesce((v_profile->>'classLevel')::integer,1)>=5 then 2
    else 1
  end;

  if not v_save_success then
    for v_i in 1..v_dice_count loop v_damage_roll:=v_damage_roll+floor(random()*6)::integer+1; end loop;
    v_raw_damage:=v_damage_roll;
    v_damage:=public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'psychic');
    v_effect:=private.encounter_apply_target_turn_end_effect_v1(
      v_t.id,v_c.id,'vicious_mockery_next_attack_disadvantage',1,
      jsonb_build_object('spellKey',v_spell.spell_key,'spell',v_spell.name,'nextAttackDisadvantage',true)
    );
  else
    v_damage:=jsonb_build_object(
      'targetId',v_t.id,'damageType','psychic','rawDamage',0,
      'resistant',false,'immune',false,'vulnerable',false,'damage',0,
      'targetHp',v_t.current_hp,'targetTempHp',v_t.temp_hp,'defeated',v_t.is_defeated
    );
  end if;

  v_result:=jsonb_build_object(
    'requestId',p_request_id,'casterId',v_c.id,'targetId',v_t.id,'assignmentId',v_assignment.id,
    'spellId',v_spell.id,'spellKey',v_spell.spell_key,'spell',v_spell.name,'actionType','action','slotLevel',null,
    'distanceFt',v_dist_ft,'castingAbility','cha','castingAbilityModifier',v_cast_mod,'proficiencyBonus',v_prof,
    'saveAbility','wis','saveDc',v_save_dc,'saveBonus',v_save_bonus,'saveRoll',v_save_roll,'saveTotal',v_save_total,
    'saveSuccess',v_save_success,'saveAdvantage',false,'saveProfile',v_save_profile,
    'coverLevel',v_targeting->>'coverLevel','coverSaveBonus',0,'coverAffectsSave',false,
    'damageDice',v_dice_count::text||'d6','damageRoll',v_damage_roll,'damageType','psychic','rawDamage',v_raw_damage,'damage',v_damage,
    'nextAttackDisadvantageApplied',not v_save_success,
    'nextAttackDisadvantageUntil',case when not v_save_success then 'target_next_turn_end' else null end,
    'timedEffect',v_effect,'targeting',v_targeting,
    'hearingOnlyTargetingAutomated',false
  );

  update public.encounter_participants set action_available=false,updated_at=timezone('utc',now()) where id=v_c.id;
  insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
  values(
    v_e.id,v_e.round,v_e.turn_index,v_c.id,v_t.id,'spell_cast',
    v_c.display_name||' cast Vicious Mockery on '||v_t.display_name||case when v_save_success then ', who resisted.' else ' and imposed Disadvantage on the target''s next attack roll before the end of its next turn.' end,
    v_result
  );
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;
