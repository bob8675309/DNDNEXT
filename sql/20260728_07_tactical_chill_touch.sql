-- Phase 1Q: source-turn-end timed effects + healing prevention + reviewed XPHB Chill Touch adapter.
-- Additive/versioned: v1-v8 remain available; v9 delegates all prior reviewed spells to v8.

alter table public.encounter_timed_effects
  drop constraint if exists encounter_timed_effects_expiry_trigger_check;
alter table public.encounter_timed_effects
  add constraint encounter_timed_effects_expiry_trigger_check
  check (expiry_trigger in ('target_turn_start','source_turn_start','source_turn_end'));

create or replace function private.encounter_apply_source_turn_end_effect_v1(
  p_target_id uuid,
  p_source_id uuid,
  p_effect_key text,
  p_source_turn_ends integer default 2,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_t public.encounter_participants%rowtype;
  v_s public.encounter_participants%rowtype;
  v_e public.encounters%rowtype;
  v_key text:=lower(btrim(coalesce(p_effect_key,'')));
  v_id uuid;
begin
  if p_target_id is null or p_source_id is null or v_key='' then
    raise exception 'Source-turn-end timed effect target, source, and key are required';
  end if;
  if p_source_turn_ends is null or p_source_turn_ends<1 then
    raise exception 'Timed effect duration must be at least one source turn end';
  end if;

  select * into v_t from public.encounter_participants where id=p_target_id;
  if not found then raise exception 'Timed effect target not found'; end if;
  select * into v_s from public.encounter_participants where id=p_source_id and encounter_id=v_t.encounter_id;
  if not found then raise exception 'Timed effect source is not in this encounter'; end if;
  select * into v_e from public.encounters where id=v_t.encounter_id;
  if not found then raise exception 'Timed effect encounter not found'; end if;

  insert into public.encounter_timed_effects(
    encounter_id,participant_id,source_participant_id,effect_key,remaining_target_turn_starts,
    expiry_trigger,metadata,applied_round,applied_turn_index,updated_at
  ) values (
    v_t.encounter_id,v_t.id,v_s.id,v_key,p_source_turn_ends,
    'source_turn_end',coalesce(p_metadata,'{}'::jsonb),coalesce(v_e.round,0),coalesce(v_e.turn_index,0),timezone('utc',now())
  )
  on conflict(participant_id,effect_key) do update set
    source_participant_id=excluded.source_participant_id,
    remaining_target_turn_starts=excluded.remaining_target_turn_starts,
    expiry_trigger='source_turn_end',
    metadata=excluded.metadata,
    applied_round=excluded.applied_round,
    applied_turn_index=excluded.applied_turn_index,
    updated_at=timezone('utc',now())
  returning id into v_id;

  return jsonb_build_object(
    'effectId',v_id,'targetId',v_t.id,'sourceId',v_s.id,'effectKey',v_key,
    'expiryTrigger','source_turn_end','remainingTurnEnds',p_source_turn_ends
  );
end;
$function$;

revoke all on function private.encounter_apply_source_turn_end_effect_v1(uuid,uuid,text,integer,jsonb) from public, anon, authenticated;
grant execute on function private.encounter_apply_source_turn_end_effect_v1(uuid,uuid,text,integer,jsonb) to service_role;

create or replace function public.encounter_apply_healing_internal_v1(p_target_id uuid,p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_t public.encounter_participants%rowtype;
  v_before integer;
  v_after integer;
  v_max integer;
  v_applied integer;
  v_block public.encounter_timed_effects%rowtype;
begin
  if p_amount is null or p_amount<0 then raise exception 'Healing amount must be non-negative'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id for update;
  if not found then raise exception 'Healing target not found'; end if;

  v_before:=coalesce(v_t.current_hp,0);
  v_max:=greatest(v_before,coalesce(v_t.max_hp,v_before));

  select * into v_block
  from public.encounter_timed_effects e
  where e.participant_id=v_t.id
    and e.effect_key='chill_touch_no_healing'
    and e.remaining_target_turn_starts>0
  order by e.created_at desc,e.id
  limit 1;

  if found then
    return jsonb_build_object(
      'targetId',v_t.id,
      'requestedHealing',p_amount,
      'healing',0,
      'targetHp',v_before,
      'maxHp',v_max,
      'healingPrevented',true,
      'preventionEffectId',v_block.id,
      'preventionEffectKey',v_block.effect_key,
      'preventionSourceId',v_block.source_participant_id,
      'targetDefeated',v_t.is_defeated
    );
  end if;

  v_after:=least(v_max,v_before+p_amount);
  v_applied:=greatest(0,v_after-v_before);
  update public.encounter_participants
  set current_hp=v_after,is_defeated=false,updated_at=timezone('utc',now())
  where id=v_t.id;
  return jsonb_build_object(
    'targetId',v_t.id,'requestedHealing',p_amount,'healing',v_applied,
    'targetHp',v_after,'maxHp',v_max,'healingPrevented',false
  );
end;
$function$;

revoke all on function public.encounter_apply_healing_internal_v1(uuid,integer) from public, anon, authenticated;
grant execute on function public.encounter_apply_healing_internal_v1(uuid,integer) to service_role;

create or replace function public.encounter_end_turn_v1(p_participant_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text:=coalesce(auth.role(),'');
  v_p public.encounter_participants%rowtype;
  v_e public.encounters%rowtype;
  v_existing public.encounter_command_requests%rowtype;
  v_inserted integer:=0;
  v_current_pos integer;
  v_count integer;
  v_next_pos integer;
  v_next_id uuid;
  v_next_speed integer;
  v_round integer;
  v_result jsonb;
  v_c record;
  v_fx public.encounter_timed_effects%rowtype;
begin
  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  select p_request_id,p.encounter_id,p.id,'end_turn',v_uid from public.encounter_participants p where p.id=p_participant_id
  on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select * into v_existing from public.encounter_command_requests where request_id=p_request_id;
    if not found or v_existing.command_type<>'end_turn' then raise exception 'Request id is already used'; end if;
    return coalesce(v_existing.result,jsonb_build_object('duplicate',true));
  end if;

  select * into v_p from public.encounter_participants where id=p_participant_id for update;
  if not found then raise exception 'Participant not found'; end if;
  select * into v_e from public.encounters where id=v_p.encounter_id for update;
  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_p.id then raise exception 'It is not this participant''s active turn'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_p.id) then raise exception 'Not authorized'; end if;
  if exists(select 1 from public.encounter_reaction_windows w where w.encounter_id=v_e.id and w.mover_participant_id=v_p.id and w.status='pending') then raise exception 'Resolve the pending reaction before ending the turn'; end if;

  for v_c in
    select * from public.encounter_conditions where participant_id=v_p.id and remaining_target_turn_ends=1 for update
  loop
    insert into public.encounter_combat_log(encounter_id,round,turn_index,target_participant_id,event_type,summary,detail)
    values(v_e.id,v_e.round,v_e.turn_index,v_p.id,'condition_expired',initcap(v_c.condition_key)||' expired on '||v_p.display_name||'.',jsonb_build_object('conditionId',v_c.id,'condition',v_c.condition_key));
    delete from public.encounter_conditions where id=v_c.id;
  end loop;
  update public.encounter_conditions
  set remaining_target_turn_ends=remaining_target_turn_ends-1,updated_at=timezone('utc',now())
  where participant_id=v_p.id and remaining_target_turn_ends>1;

  for v_fx in
    select * from public.encounter_timed_effects
    where encounter_id=v_e.id
      and expiry_trigger='source_turn_end'
      and source_participant_id=v_p.id
      and remaining_target_turn_starts=1
    for update
  loop
    insert into public.encounter_combat_log(
      encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail
    ) values (
      v_e.id,v_e.round,v_e.turn_index,v_p.id,v_fx.participant_id,'effect_expired',
      initcap(replace(v_fx.effect_key,'_',' '))||' expired at '||v_p.display_name||'''s turn end.',
      jsonb_build_object('effectId',v_fx.id,'effectKey',v_fx.effect_key,'expiry','source_turn_end','sourceParticipantId',v_p.id)
    );
    delete from public.encounter_timed_effects where id=v_fx.id;
  end loop;
  update public.encounter_timed_effects
  set remaining_target_turn_starts=remaining_target_turn_starts-1,updated_at=timezone('utc',now())
  where encounter_id=v_e.id
    and expiry_trigger='source_turn_end'
    and source_participant_id=v_p.id
    and remaining_target_turn_starts>1;

  with ordered as (
    select p.id,row_number() over(order by p.initiative desc nulls last,p.initiative_tiebreaker desc nulls last,p.created_at,p.id) rn,count(*) over() cnt
    from public.encounter_participants p where p.encounter_id=v_e.id and not p.is_defeated
  ) select rn,cnt into v_current_pos,v_count from ordered where id=v_p.id;
  v_next_pos:=case when v_current_pos>=v_count then 1 else v_current_pos+1 end;
  with ordered as (
    select p.id,row_number() over(order by p.initiative desc nulls last,p.initiative_tiebreaker desc nulls last,p.created_at,p.id) rn
    from public.encounter_participants p where p.encounter_id=v_e.id and not p.is_defeated
  ) select id into v_next_id from ordered where rn=v_next_pos;
  v_round:=case when v_next_pos=1 then greatest(1,v_e.round)+1 else greatest(1,v_e.round) end;
  select greatest(0,public.encounter_canonical_speed_ft_v1(character_id)-private.encounter_timed_speed_penalty_ft_v1(id))
    into v_next_speed from public.encounter_participants where id=v_next_id;

  update public.encounter_participants
  set disengaged=false,movement_bonus_ft=0,updated_at=timezone('utc',now())
  where id=v_p.id;
  update public.encounter_participants
  set movement_spent_ft=0,movement_bonus_ft=0,action_available=true,bonus_action_available=true,
      reaction_available=true,disengaged=false,dodging=false,speed_ft=v_next_speed,
      turn_started_at=timezone('utc',now()),updated_at=timezone('utc',now())
  where id=v_next_id;
  update public.encounters
  set active_participant_id=v_next_id,round=v_round,turn_index=v_next_pos-1,version=version+1,updated_at=timezone('utc',now())
  where id=v_e.id;

  v_result:=jsonb_build_object(
    'requestId',p_request_id,'nextParticipantId',v_next_id,'round',v_round,'turnIndex',v_next_pos-1,'nextSpeedFt',v_next_speed
  );
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

create or replace function public.encounter_cast_spell_v9(
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
  v_damage jsonb:=null;
  v_effect jsonb:=null;
  v_inserted integer:=0;
  v_key text;
  v_dist_ft integer:=0;
  v_casting_ability text;
  v_casting_score integer;
  v_cast_mod integer;
  v_prof integer;
  v_attack_bonus integer;
  v_roll1 integer;
  v_roll2 integer;
  v_roll integer;
  v_total integer;
  v_target_ac integer;
  v_disadvantage boolean:=false;
  v_hit boolean:=false;
  v_crit boolean:=false;
  v_dice_count integer:=0;
  v_die_size integer:=10;
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
    'poison-spray|xphb','false-life|xphb','inflict-wounds|xphb','shocking-grasp|xphb','ray-of-frost|xphb'
  ) then
    return public.encounter_cast_spell_v8(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
  end if;

  if v_key<>'chill-touch|xphb' then raise exception 'This spell remains GM-assisted; no automated tactical adapter is approved yet'; end if;
  if lower(coalesce(v_assignment.source_type,''))<>'class' then raise exception 'Only class spell assignments are automated in this casting slice'; end if;
  if v_spell.source<>'XPHB' then raise exception 'Only reviewed XPHB spell versions are automated in this casting slice'; end if;
  if v_spell.level<>0 then raise exception 'Chill Touch must resolve from its reviewed cantrip definition'; end if;
  if p_slot_level is not null and p_slot_level<>0 then raise exception 'Cantrips do not use spell slots'; end if;
  if p_target_id=v_c.id then raise exception 'Chill Touch requires another creature target'; end if;

  if exists(
    select 1 from public.encounter_timed_effects fx
    where fx.participant_id=p_target_id
      and fx.effect_key='chill_touch_no_healing'
      and fx.remaining_target_turn_starts>0
      and fx.source_participant_id is distinct from p_caster_id
  ) then
    raise exception 'Overlapping Chill Touch healing locks from different casters remain GM-assisted';
  end if;

  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  values(p_request_id,v_c.encounter_id,v_c.id,'spell_cast',v_uid)
  on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select * into v_existing from public.encounter_command_requests where request_id=p_request_id;
    if not found or v_existing.command_type<>'spell_cast' or v_existing.participant_id<>v_c.id then
      raise exception 'Request id is already used for another command';
    end if;
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

  v_profile:=public.encounter_spellcasting_profile_v1(v_c.id);
  if not coalesce((v_profile->>'isClassCaster')::boolean,false) then raise exception 'This participant has no canonical class spellcasting profile'; end if;
  v_casting_ability:=lower(coalesce(nullif(btrim(v_assignment.casting_stat),''),v_profile->>'castingAbility',''));
  if v_casting_ability not in ('str','dex','con','int','wis','cha') then raise exception 'Casting ability is unavailable'; end if;
  v_casting_score:=private.encounter_ability_score_v1(v_c.character_id,v_casting_ability);
  v_cast_mod:=floor((coalesce(v_casting_score,10)-10)/2.0)::integer;
  v_prof:=coalesce((v_profile->>'proficiencyBonus')::integer,2);
  v_attack_bonus:=coalesce(v_assignment.attack_bonus_override,v_cast_mod+v_prof);

  v_targeting:=public.encounter_targeting_context_internal_v1(v_c.id,v_t.id);
  if not coalesce((v_targeting->>'hasLineOfSight')::boolean,false) then raise exception 'Target is blocked by total cover or line-of-sight obstruction'; end if;
  v_dist_ft:=coalesce((v_targeting->>'distanceFt')::integer,0);
  if v_dist_ft>5 then raise exception 'Target is beyond Chill Touch reach'; end if;
  if exists(select 1 from public.encounter_conditions c where c.participant_id in (v_c.id,v_t.id)) then
    raise exception 'Spell attacks with active conditions on caster or target remain GM-assisted in this slice';
  end if;

  v_dice_count:=case
    when coalesce((v_profile->>'classLevel')::integer,1)>=17 then 4
    when coalesce((v_profile->>'classLevel')::integer,1)>=11 then 3
    when coalesce((v_profile->>'classLevel')::integer,1)>=5 then 2
    else 1
  end;
  v_disadvantage:=coalesce(v_t.dodging,false);
  v_roll1:=floor(random()*20)::integer+1;
  v_roll2:=floor(random()*20)::integer+1;
  v_roll:=case when v_disadvantage then least(v_roll1,v_roll2) else v_roll1 end;
  v_total:=v_roll+v_attack_bonus;
  v_target_ac:=coalesce(v_t.armor_class,10)+coalesce((v_targeting->>'coverAcBonus')::integer,0);
  v_crit:=v_roll=20;
  v_hit:=case when v_roll=1 then false when v_crit then true else v_total>=v_target_ac end;
  if v_crit then v_dice_count:=v_dice_count*2; end if;

  if v_hit then
    for v_i in 1..v_dice_count loop
      v_damage_roll:=v_damage_roll+floor(random()*v_die_size)::integer+1;
    end loop;
    v_raw_damage:=v_damage_roll;
    v_damage:=public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'necrotic');
    v_effect:=private.encounter_apply_source_turn_end_effect_v1(
      v_t.id,v_c.id,'chill_touch_no_healing',2,
      jsonb_build_object('spellKey',v_spell.spell_key,'spell',v_spell.name,'preventsHealing',true)
    );
  else
    v_damage:=jsonb_build_object(
      'targetId',v_t.id,'damageType','necrotic','rawDamage',0,
      'resistant',false,'immune',false,'vulnerable',false,'damage',0,
      'targetHp',v_t.current_hp,'targetTempHp',v_t.temp_hp,'defeated',v_t.is_defeated
    );
  end if;

  v_result:=jsonb_build_object(
    'requestId',p_request_id,'casterId',v_c.id,'targetId',v_t.id,'assignmentId',v_assignment.id,
    'spellId',v_spell.id,'spellKey',v_spell.spell_key,'spell',v_spell.name,'actionType','action','slotLevel',null,
    'distanceFt',v_dist_ft,'castingAbility',v_casting_ability,'castingAbilityModifier',v_cast_mod,'proficiencyBonus',v_prof,
    'attackBonus',v_attack_bonus,'roll',v_roll,'secondRoll',case when v_disadvantage then v_roll2 else null end,'disadvantage',v_disadvantage,
    'baseTargetAc',coalesce(v_t.armor_class,10),'coverAcBonus',coalesce((v_targeting->>'coverAcBonus')::integer,0),'targetAc',v_target_ac,
    'hit',v_hit,'critical',v_crit,'damageDice',v_dice_count::text||'d10','damageRoll',v_damage_roll,
    'damageType','necrotic','rawDamage',v_raw_damage,'damage',v_damage,
    'healingPrevented',v_hit,'healingPreventedUntil','source_next_turn_end','timedEffect',v_effect,'targeting',v_targeting
  );

  update public.encounter_participants set action_available=false,updated_at=timezone('utc',now()) where id=v_c.id;
  insert into public.encounter_combat_log(
    encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail
  ) values (
    v_e.id,v_e.round,v_e.turn_index,v_c.id,v_t.id,'spell_cast',
    v_c.display_name||' cast Chill Touch on '||v_t.display_name||case when v_hit then ' and prevented Hit Point recovery until the end of the caster''s next turn.' else ' and missed.' end,
    v_result
  );
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

revoke all on function public.encounter_cast_spell_v9(uuid,uuid,uuid,integer,uuid) from public, anon;
grant execute on function public.encounter_cast_spell_v9(uuid,uuid,uuid,integer,uuid) to authenticated, service_role;

do $postconditions$
begin
  if not has_function_privilege('authenticated','public.encounter_cast_spell_v9(uuid,uuid,uuid,integer,uuid)','EXECUTE') then raise exception 'guarded Chill Touch cast RPC missing'; end if;
  if has_function_privilege('anon','public.encounter_cast_spell_v9(uuid,uuid,uuid,integer,uuid)','EXECUTE') then raise exception 'anon must not cast Chill Touch'; end if;
  if to_regprocedure('public.encounter_cast_spell_v8(uuid,uuid,uuid,integer,uuid)') is null then raise exception 'Phase 1P cast RPC must remain available'; end if;
  if has_function_privilege('authenticated','private.encounter_apply_source_turn_end_effect_v1(uuid,uuid,text,integer,jsonb)','EXECUTE') then raise exception 'source-turn-end effect helper must remain private'; end if;
  if has_function_privilege('authenticated','public.encounter_apply_healing_internal_v1(uuid,integer)','EXECUTE') then raise exception 'healing helper must remain private'; end if;
end
$postconditions$;
