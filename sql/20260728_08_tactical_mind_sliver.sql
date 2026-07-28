-- Phase 1R: one-shot saving-throw modifiers + reviewed XPHB Mind Sliver adapter.
-- Additive/versioned: v1-v9 remain available; v10 delegates all prior reviewed spells to v9.

create or replace function public.encounter_saving_throw_profile_internal_v1(p_participant_id uuid,p_ability text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_p public.encounter_participants%rowtype;
  v_snapshot jsonb;
  v_key text:=lower(coalesce(p_ability,''));
  v_score integer;
  v_mod integer;
  v_prof integer;
  v_proficient boolean:=false;
  v_base_bonus integer;
  v_penalty integer:=0;
  v_fx public.encounter_timed_effects%rowtype;
  v_e public.encounters%rowtype;
  v_effect_id uuid:=null;
  v_effect_source uuid:=null;
begin
  if v_key not in ('str','dex','con','int','wis','cha') then raise exception 'Unsupported saving throw ability'; end if;
  select * into v_p from public.encounter_participants where id=p_participant_id;
  if not found then raise exception 'Participant not found'; end if;

  v_snapshot:=public.encounter_canonical_combat_snapshot_v1(v_p.character_id);
  v_score:=coalesce((v_snapshot->>v_key)::integer,10);
  v_mod:=floor((v_score-10)/2.0)::integer;
  v_prof:=coalesce((v_snapshot->>'prof')::integer,2);

  case v_key
    when 'str' then v_proficient:=coalesce((v_snapshot->'saveProficiencies'->>'str')::boolean,false);
    when 'dex' then v_proficient:=coalesce((v_snapshot->'saveProficiencies'->>'dex')::boolean,false);
    when 'con' then v_proficient:=coalesce((v_snapshot->'saveProficiencies'->>'con')::boolean,false);
    when 'int' then v_proficient:=coalesce((v_snapshot->'saveProficiencies'->>'int')::boolean,false);
    when 'wis' then v_proficient:=coalesce((v_snapshot->'saveProficiencies'->>'wis')::boolean,false);
    when 'cha' then v_proficient:=coalesce((v_snapshot->'saveProficiencies'->>'cha')::boolean,false);
  end case;

  v_base_bonus:=v_mod+case when v_proficient then v_prof else 0 end;

  select * into v_fx
  from public.encounter_timed_effects e
  where e.participant_id=v_p.id
    and e.effect_key='mind_sliver_save_penalty'
    and e.remaining_target_turn_starts>0
  order by e.created_at,e.id
  limit 1
  for update;

  if found then
    v_penalty:=floor(random()*4)::integer+1;
    v_effect_id:=v_fx.id;
    v_effect_source:=v_fx.source_participant_id;
    delete from public.encounter_timed_effects where id=v_fx.id;

    select * into v_e from public.encounters where id=v_p.encounter_id;
    if found then
      insert into public.encounter_combat_log(
        encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail
      ) values (
        v_e.id,v_e.round,v_e.turn_index,v_effect_source,v_p.id,'effect_consumed',
        'Mind Sliver reduced '||v_p.display_name||'''s '||upper(v_key)||' save by '||v_penalty||'.',
        jsonb_build_object(
          'effectId',v_effect_id,
          'effectKey','mind_sliver_save_penalty',
          'sourceParticipantId',v_effect_source,
          'targetParticipantId',v_p.id,
          'ability',v_key,
          'savePenalty',v_penalty,
          'consumed',true
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'ability',v_key,
    'score',v_score,
    'modifier',v_mod,
    'proficiencyBonus',v_prof,
    'proficient',v_proficient,
    'baseSaveBonus',v_base_bonus,
    'savePenalty',v_penalty,
    'savePenaltyEffectId',v_effect_id,
    'savePenaltySourceId',v_effect_source,
    'saveBonus',v_base_bonus-v_penalty
  );
end;
$function$;

revoke all on function public.encounter_saving_throw_profile_internal_v1(uuid,text) from public, anon, authenticated;
grant execute on function public.encounter_saving_throw_profile_internal_v1(uuid,text) to service_role;

create or replace function public.encounter_cast_spell_v10(
  p_caster_id uuid,
  p_assignment_id uuid,
  p_target_id uuid,
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
  v_die_size integer:=6;
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
  if v_key in (
    'fire-bolt|xphb','cure-wounds|xphb','sacred-flame|xphb','toll-the-dead|xphb',
    'poison-spray|xphb','false-life|xphb','inflict-wounds|xphb','shocking-grasp|xphb',
    'ray-of-frost|xphb','chill-touch|xphb'
  ) then
    return public.encounter_cast_spell_v9(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
  end if;

  if v_key<>'mind-sliver|xphb' then raise exception 'This spell remains GM-assisted; no automated tactical adapter is approved yet'; end if;
  if lower(coalesce(v_assignment.source_type,''))<>'class' then raise exception 'Only class spell assignments are automated in this casting slice'; end if;
  if v_spell.source<>'XPHB' then raise exception 'Only reviewed XPHB spell versions are automated in this casting slice'; end if;
  if v_spell.level<>0 then raise exception 'Mind Sliver must resolve from its reviewed cantrip definition'; end if;
  if p_slot_level is not null and p_slot_level<>0 then raise exception 'Cantrips do not use spell slots'; end if;
  if p_target_id=v_c.id then raise exception 'Mind Sliver requires another creature target'; end if;

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
  if exists(
    select 1 from public.encounter_conditions c
    where c.participant_id=v_c.id and c.condition_key in ('incapacitated','paralyzed','stunned','unconscious')
  ) then raise exception 'Current conditions prevent this participant from taking the Cast action'; end if;
  if exists(select 1 from public.encounter_conditions c where c.participant_id=v_t.id) then
    raise exception 'Save spells against targets with active conditions remain GM-assisted in this slice';
  end if;

  v_profile:=public.encounter_spellcasting_profile_v1(v_c.id);
  if not coalesce((v_profile->>'isClassCaster')::boolean,false) then raise exception 'This participant has no canonical class spellcasting profile'; end if;
  v_casting_ability:=lower(coalesce(nullif(btrim(v_assignment.casting_stat),''),v_profile->>'castingAbility',''));
  if v_casting_ability not in ('str','dex','con','int','wis','cha') then raise exception 'Casting ability is unavailable'; end if;
  v_casting_score:=private.encounter_ability_score_v1(v_c.character_id,v_casting_ability);
  v_cast_mod:=floor((coalesce(v_casting_score,10)-10)/2.0)::integer;
  v_prof:=coalesce((v_profile->>'proficiencyBonus')::integer,2);
  v_save_dc:=coalesce(v_assignment.save_dc_override,8+v_cast_mod+v_prof);

  v_targeting:=public.encounter_targeting_context_internal_v1(v_c.id,v_t.id);
  if not coalesce((v_targeting->>'hasLineOfSight')::boolean,false) then raise exception 'Target is blocked by total cover or line-of-sight obstruction'; end if;
  v_dist_ft:=coalesce((v_targeting->>'distanceFt')::integer,0);
  if v_dist_ft>60 then raise exception 'Target is beyond Mind Sliver range'; end if;

  v_save_profile:=public.encounter_saving_throw_profile_internal_v1(v_t.id,'int');
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
    for v_i in 1..v_dice_count loop
      v_damage_roll:=v_damage_roll+floor(random()*v_die_size)::integer+1;
    end loop;
    v_raw_damage:=v_damage_roll;
    v_damage:=public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'psychic');
    v_effect:=private.encounter_apply_source_turn_end_effect_v1(
      v_t.id,v_c.id,'mind_sliver_save_penalty',2,
      jsonb_build_object('spellKey',v_spell.spell_key,'spell',v_spell.name,'nextSavePenaltyDice','1d4')
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
    'distanceFt',v_dist_ft,'castingAbility',v_casting_ability,'castingAbilityModifier',v_cast_mod,'proficiencyBonus',v_prof,
    'saveAbility','int','saveDc',v_save_dc,'saveBonus',v_save_bonus,'saveRoll',v_save_roll,'saveTotal',v_save_total,
    'saveSuccess',v_save_success,'saveAdvantage',false,'saveProfile',v_save_profile,
    'coverLevel',v_targeting->>'coverLevel','coverSaveBonus',0,'coverAffectsSave',false,
    'damageDice',v_dice_count::text||'d6','damageRoll',v_damage_roll,'damageType','psychic','rawDamage',v_raw_damage,'damage',v_damage,
    'nextSavePenaltyApplied',not v_save_success,'nextSavePenaltyDice',case when not v_save_success then '1d4' else null end,
    'nextSavePenaltyUntil',case when not v_save_success then 'source_next_turn_end' else null end,
    'timedEffect',v_effect,'targeting',v_targeting
  );

  update public.encounter_participants set action_available=false,updated_at=timezone('utc',now()) where id=v_c.id;
  insert into public.encounter_combat_log(
    encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail
  ) values (
    v_e.id,v_e.round,v_e.turn_index,v_c.id,v_t.id,'spell_cast',
    v_c.display_name||' cast Mind Sliver on '||v_t.display_name||case when v_save_success then ', who resisted.' else ' and imposed a 1d4 penalty on the next saving throw before the end of the caster''s next turn.' end,
    v_result
  );
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

revoke all on function public.encounter_cast_spell_v10(uuid,uuid,uuid,integer,uuid) from public, anon;
grant execute on function public.encounter_cast_spell_v10(uuid,uuid,uuid,integer,uuid) to authenticated, service_role;

do $postconditions$
begin
  if not has_function_privilege('authenticated','public.encounter_cast_spell_v10(uuid,uuid,uuid,integer,uuid)','EXECUTE') then raise exception 'guarded Mind Sliver cast RPC missing'; end if;
  if has_function_privilege('anon','public.encounter_cast_spell_v10(uuid,uuid,uuid,integer,uuid)','EXECUTE') then raise exception 'anon must not cast Mind Sliver'; end if;
  if to_regprocedure('public.encounter_cast_spell_v9(uuid,uuid,uuid,integer,uuid)') is null then raise exception 'Phase 1Q cast RPC must remain available'; end if;
  if has_function_privilege('authenticated','public.encounter_saving_throw_profile_internal_v1(uuid,text)','EXECUTE') then raise exception 'saving throw profile must remain private'; end if;
  if not has_function_privilege('service_role','public.encounter_saving_throw_profile_internal_v1(uuid,text)','EXECUTE') then raise exception 'saving throw profile service-role access missing'; end if;
end
$postconditions$;
