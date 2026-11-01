-- P2 RESEARCH ONLY / NOT A DEPLOYABLE MIGRATION.
-- Source body equals live public.encounter_cast_spell_v11_pre_1v (verified 2026-10-31).
-- Actual transactional candidate: all original attack-family operations preserved,
-- but auth/source/intent checks moved under locked action and authoritative ledger.
-- DO NOT INSTALL ON LIVE. This candidate is ungranted in private schema.

create or replace function private.encounter_cast_spell_v11_transaction_candidate_v1(
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
  v_slot public.encounter_spell_slots%rowtype;
  v_profile jsonb;
  v_targeting jsonb;
  v_attack_roll jsonb;
  v_damage jsonb:=null;
  v_effect jsonb:=null;
  v_inserted integer:=0;
  v_slot_count integer:=0;
  v_key text;
  v_dist_ft integer:=0;
  v_range_ft integer:=0;
  v_casting_ability text;
  v_casting_score integer;
  v_cast_mod integer;
  v_prof integer;
  v_attack_bonus integer;
  v_roll integer;
  v_roll2 integer;
  v_total integer;
  v_target_ac integer;
  v_base_disadvantage boolean:=false;
  v_disadvantage boolean:=false;
  v_advantage boolean:=false;
  v_ranged_attack boolean:=false;
  v_hit boolean:=false;
  v_crit boolean:=false;
  v_dice_count integer:=0;
  v_die_size integer:=0;
  v_damage_type text;
  v_damage_roll integer:=0;
  v_raw_damage integer:=0;
  v_i integer;
  v_speed_before integer:=null;
  v_speed_after integer:=null;
  v_result jsonb;
begin
  if p_caster_id is null or p_assignment_id is null or p_target_id is null or p_request_id is null then
    raise exception 'Caster, spell assignment, target, and request id are required';
  end if;

  -- HELD transaction-integrated candidate: acquire caster lock before any
  -- idempotency/command ledger operation so same-caster casts serialize.
  select * into v_c from public.encounter_participants where id=p_caster_id for update;
  if not found then raise exception 'Caster not found'; end if;
  select * into v_assignment from public.character_spells where id=p_assignment_id and character_id=v_c.character_id for share;
  if not found then raise exception 'Spell assignment is not in this character''s spellbook'; end if;
  select * into v_spell from public.spells_catalog where id=v_assignment.spell_id;
  if not found then raise exception 'Assigned spell definition not found'; end if;

  v_key:=lower(v_spell.spell_key);
  if v_key not in (
    'fire-bolt|xphb','poison-spray|xphb','shocking-grasp|xphb','ray-of-frost|xphb','chill-touch|xphb','guiding-bolt|xphb'
  ) then
    return public.encounter_cast_spell_v10(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
  end if;

  if lower(coalesce(v_assignment.source_type,''))<>'class' then raise exception 'Only class spell assignments are automated in this casting slice'; end if;
  -- Only Fire Bolt receives the new canonical source-grant gate in P2.
  -- Other reviewed attack spell families remain behaviorally unchanged here.
  if v_key='fire-bolt|xphb' then
    if not coalesce(v_assignment.known,false) then
      raise exception 'Fire Bolt class grant is not currently known' using errcode='42501';
    end if;
    if not exists (
      select 1 from public.character_progression cp
      join public.class_catalog cc on cc.id=cp.class_id
      where cp.character_id=v_c.character_id
        and upper(cc.source)='XPHB'
        and lower(btrim(coalesce(v_assignment.source_key,'')))=lower(cc.class_key)
        and lower(btrim(coalesce(v_assignment.source_label,'')))=lower(cc.class_key)
        and exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) listed
                   where lower(btrim(listed))=lower(cc.class_name))
    ) then
      raise exception 'Fire Bolt class-source grant is not canonical' using errcode='42501';
    end if;
  end if;
  if v_spell.source<>'XPHB' then raise exception 'Only reviewed XPHB spell versions are automated in this casting slice'; end if;
  if p_target_id=v_c.id then raise exception 'This spell attack requires another creature target'; end if;

  if v_key='guiding-bolt|xphb' then
    if v_spell.level<>1 then raise exception 'Guiding Bolt must resolve from its reviewed level 1 definition'; end if;
    if lower(coalesce(v_assignment.source_label,''))<>'cleric' then raise exception 'Guiding Bolt automation requires its reviewed Cleric class assignment'; end if;
    if not (v_assignment.prepared or v_assignment.always_available) then raise exception 'Guiding Bolt is not currently prepared or always available'; end if;
  else
    if v_spell.level<>0 then raise exception 'Reviewed cantrip spell attacks must resolve from their cantrip definitions'; end if;
    if p_slot_level is not null and p_slot_level<>0 then raise exception 'Cantrips do not use spell slots'; end if;
  end if;

  -- Lock order: caster (above) -> encounter -> target -> command ledger.
  -- Control and visibility apply to fresh commands AND cached replay.
  select * into v_e from public.encounters where id=v_c.encounter_id for update;
  if not found then raise exception 'Encounter not found'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id and encounter_id=v_c.encounter_id for update;
  if not found then raise exception 'Target not found in this encounter'; end if;
  if v_role<>'service_role' and (v_uid is null or not public.encounter_can_control_participant_v1(v_c.id)) then
    raise exception 'Not authorized to control this participant' using errcode='42501';
  end if;
  if v_t.is_hidden and v_role<>'service_role'
     and v_t.controller_user_id is distinct from v_uid
     and (v_uid is null or not public.is_admin(v_uid)) then
    raise exception 'Target is hidden from this controller' using errcode='42501';
  end if;

  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  values(p_request_id,v_c.encounter_id,v_c.id,'spell_cast',v_uid)
  on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select * into v_existing from public.encounter_command_requests where request_id=p_request_id;
    if not found or v_existing.command_type<>'spell_cast'
       or v_existing.participant_id is distinct from v_c.id
       or v_existing.encounter_id is distinct from v_e.id then
      raise exception 'Request id is already used for another command' using errcode='42501';
    end if;
    if v_existing.requested_by is distinct from v_uid then
      raise exception 'Request belongs to another controller' using errcode='42501';
    end if;
    if v_existing.result is null or jsonb_typeof(v_existing.result)<>'object'
       or (v_existing.result->>'requestId') is distinct from p_request_id::text
       or (v_existing.result->>'casterId') is distinct from v_c.id::text
       or (v_existing.result->>'targetId') is distinct from v_t.id::text
       or (v_existing.result->>'assignmentId') is distinct from v_assignment.id::text
       or (v_existing.result->>'spellId') is distinct from v_spell.id::text
       or (v_existing.result->>'spellKey') is distinct from v_spell.spell_key
       or (v_existing.result->>'slotLevel') is distinct from
          (case when v_key='guiding-bolt|xphb' then p_slot_level::text else null end)
    then
      raise exception 'Request intent changed or cached result unbound' using errcode='42501';
    end if;
    -- A valid replay occurs after authorization while action/turn may
    -- already have changed due to the original completed cast.
    return v_existing.result;
  end if;

  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_c.id then raise exception 'It is not this participant''s active turn'; end if;
  if v_c.is_defeated then raise exception 'Defeated participants cannot cast spells'; end if;
  if v_t.is_defeated then raise exception 'Target is already defeated'; end if;
  if not v_c.action_available then raise exception 'Action already spent'; end if;
  if exists(
    select 1 from public.encounter_conditions c
    where c.participant_id=v_c.id and c.condition_key in ('incapacitated','paralyzed','stunned','unconscious')
  ) then raise exception 'Current conditions prevent this participant from taking the Cast action'; end if;
  if exists(select 1 from public.encounter_conditions c where c.participant_id in (v_c.id,v_t.id)) then
    raise exception 'Spell attacks with active conditions on caster or target remain GM-assisted in this slice';
  end if;

  v_profile:=public.encounter_spellcasting_profile_v1(v_c.id);
  if not coalesce((v_profile->>'isClassCaster')::boolean,false) then raise exception 'This participant has no canonical class spellcasting profile'; end if;
  if v_key='guiding-bolt|xphb' and lower(coalesce(v_profile->>'className',''))<>'cleric' then
    raise exception 'Guiding Bolt automation requires a canonical Cleric spellcasting profile';
  end if;
  v_casting_ability:=lower(coalesce(nullif(btrim(v_assignment.casting_stat),''),v_profile->>'castingAbility',''));
  if v_casting_ability not in ('str','dex','con','int','wis','cha') then raise exception 'Casting ability is unavailable'; end if;
  v_casting_score:=private.encounter_ability_score_v1(v_c.character_id,v_casting_ability);
  v_cast_mod:=floor((coalesce(v_casting_score,10)-10)/2.0)::integer;
  v_prof:=coalesce((v_profile->>'proficiencyBonus')::integer,2);
  v_attack_bonus:=coalesce(v_assignment.attack_bonus_override,v_cast_mod+v_prof);

  if v_key='guiding-bolt|xphb' then
    if p_slot_level is null or p_slot_level<1 or p_slot_level>9 then raise exception 'Choose a legal Guiding Bolt spell slot level'; end if;
    select count(*) into v_slot_count
    from public.encounter_spell_slots s
    where s.participant_id=v_c.id and s.slot_level=p_slot_level and s.slots_remaining>0;
    if v_slot_count=0 then raise exception 'No remaining spell slot at the selected level'; end if;
    if v_slot_count>1 then raise exception 'Multiple eligible spell-slot pools are not automated yet'; end if;
    select * into v_slot
    from public.encounter_spell_slots s
    where s.participant_id=v_c.id and s.slot_level=p_slot_level and s.slots_remaining>0
    for update;
  end if;

  v_targeting:=public.encounter_targeting_context_internal_v1(v_c.id,v_t.id);
  if not coalesce((v_targeting->>'hasLineOfSight')::boolean,false) then raise exception 'Target is blocked by total cover or line-of-sight obstruction'; end if;
  v_dist_ft:=coalesce((v_targeting->>'distanceFt')::integer,0);

  v_range_ft:=case
    when v_key in ('fire-bolt|xphb','guiding-bolt|xphb') then 120
    when v_key='poison-spray|xphb' then 30
    when v_key='ray-of-frost|xphb' then 60
    else 5
  end;
  if v_dist_ft>v_range_ft then raise exception 'Target is beyond this reviewed spell attack range'; end if;

  v_ranged_attack:=v_key in ('fire-bolt|xphb','poison-spray|xphb','ray-of-frost|xphb','guiding-bolt|xphb');
  if v_ranged_attack and exists(
    select 1 from public.encounter_participants p
    where p.encounter_id=v_c.encounter_id
      and p.id<>v_c.id
      and not p.is_defeated
      and public.encounter_are_hostile_internal_v1(v_c.team,p.team)
      and greatest(abs(p.q-v_c.q),abs(p.r-v_c.r),abs((p.q-v_c.q)+(p.r-v_c.r)))<=1
  ) then
    raise exception 'Close-quarters ranged spell attacks remain GM-assisted in this slice';
  end if;

  if v_key='fire-bolt|xphb' then
    v_die_size:=10; v_damage_type:='fire';
    v_dice_count:=case when coalesce((v_profile->>'classLevel')::integer,1)>=17 then 4 when coalesce((v_profile->>'classLevel')::integer,1)>=11 then 3 when coalesce((v_profile->>'classLevel')::integer,1)>=5 then 2 else 1 end;
  elsif v_key='poison-spray|xphb' then
    v_die_size:=12; v_damage_type:='poison';
    v_dice_count:=case when coalesce((v_profile->>'classLevel')::integer,1)>=17 then 4 when coalesce((v_profile->>'classLevel')::integer,1)>=11 then 3 when coalesce((v_profile->>'classLevel')::integer,1)>=5 then 2 else 1 end;
  elsif v_key in ('shocking-grasp|xphb','ray-of-frost|xphb') then
    v_die_size:=8; v_damage_type:=case when v_key='shocking-grasp|xphb' then 'lightning' else 'cold' end;
    v_dice_count:=case when coalesce((v_profile->>'classLevel')::integer,1)>=17 then 4 when coalesce((v_profile->>'classLevel')::integer,1)>=11 then 3 when coalesce((v_profile->>'classLevel')::integer,1)>=5 then 2 else 1 end;
  elsif v_key='chill-touch|xphb' then
    v_die_size:=10; v_damage_type:='necrotic';
    v_dice_count:=case when coalesce((v_profile->>'classLevel')::integer,1)>=17 then 4 when coalesce((v_profile->>'classLevel')::integer,1)>=11 then 3 when coalesce((v_profile->>'classLevel')::integer,1)>=5 then 2 else 1 end;
  else
    v_die_size:=6; v_damage_type:='radiant'; v_dice_count:=4+greatest(0,p_slot_level-1);
  end if;

  if v_key='ray-of-frost|xphb' then
    if exists(select 1 from public.encounter_timed_effects fx where fx.participant_id=v_t.id and fx.effect_key='ray_of_frost_speed_reduction' and fx.remaining_target_turn_starts>0 and fx.source_participant_id is distinct from v_c.id) then
      raise exception 'Overlapping Ray of Frost speed reductions from different casters remain GM-assisted';
    end if;
    v_speed_before:=greatest(0,public.encounter_canonical_speed_ft_v1(v_t.character_id)-private.encounter_timed_speed_penalty_ft_v1(v_t.id));
  end if;
  if v_key='chill-touch|xphb' and exists(
    select 1 from public.encounter_timed_effects fx
    where fx.participant_id=v_t.id and fx.effect_key='chill_touch_no_healing' and fx.remaining_target_turn_starts>0 and fx.source_participant_id is distinct from v_c.id
  ) then
    raise exception 'Overlapping Chill Touch healing locks from different casters remain GM-assisted';
  end if;

  v_base_disadvantage:=coalesce(v_t.dodging,false);
  v_attack_roll:=private.encounter_resolve_attack_roll_v1(v_c.id,v_t.id,v_base_disadvantage);
  v_roll:=coalesce((v_attack_roll->>'roll')::integer,1);
  v_roll2:=nullif(v_attack_roll->>'secondRoll','')::integer;
  v_advantage:=coalesce((v_attack_roll->>'advantage')::boolean,false);
  v_disadvantage:=coalesce((v_attack_roll->>'disadvantage')::boolean,false);
  v_total:=v_roll+v_attack_bonus;
  v_target_ac:=coalesce(v_t.armor_class,10)+coalesce((v_targeting->>'coverAcBonus')::integer,0);
  v_crit:=v_roll=20;
  v_hit:=case when v_roll=1 then false when v_crit then true else v_total>=v_target_ac end;
  if v_crit then v_dice_count:=v_dice_count*2; end if;

  if v_hit then
    for v_i in 1..v_dice_count loop v_damage_roll:=v_damage_roll+floor(random()*v_die_size)::integer+1; end loop;
    v_raw_damage:=v_damage_roll;
    v_damage:=public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,v_damage_type);

    if v_key='shocking-grasp|xphb' then
      v_effect:=private.encounter_apply_target_turn_start_effect_v1(
        v_t.id,v_c.id,'opportunity_attack_suppressed',1,
        jsonb_build_object('spellKey',v_spell.spell_key,'spell',v_spell.name,'reason','Shocking Grasp')
      );
    elsif v_key='ray-of-frost|xphb' then
      v_effect:=private.encounter_apply_source_turn_start_effect_v1(
        v_t.id,v_c.id,'ray_of_frost_speed_reduction',1,
        jsonb_build_object('spellKey',v_spell.spell_key,'spell',v_spell.name,'speedPenaltyFt',10)
      );
      v_speed_after:=greatest(0,public.encounter_canonical_speed_ft_v1(v_t.character_id)-private.encounter_timed_speed_penalty_ft_v1(v_t.id));
      update public.encounter_participants set speed_ft=v_speed_after,updated_at=timezone('utc',now()) where id=v_t.id;
    elsif v_key='chill-touch|xphb' then
      v_effect:=private.encounter_apply_source_turn_end_effect_v1(
        v_t.id,v_c.id,'chill_touch_no_healing',2,
        jsonb_build_object('spellKey',v_spell.spell_key,'spell',v_spell.name,'preventsHealing',true)
      );
    elsif v_key='guiding-bolt|xphb' then
      v_effect:=private.encounter_apply_source_turn_end_effect_v1(
        v_t.id,v_c.id,'guiding_bolt_next_attack_advantage',2,
        jsonb_build_object('spellKey',v_spell.spell_key,'spell',v_spell.name,'nextAttackAdvantage',true)
      );
    end if;
  else
    if v_key='ray-of-frost|xphb' then v_speed_after:=v_speed_before; end if;
    v_damage:=jsonb_build_object(
      'targetId',v_t.id,'damageType',v_damage_type,'rawDamage',0,
      'resistant',false,'immune',false,'vulnerable',false,'damage',0,
      'targetHp',v_t.current_hp,'targetTempHp',v_t.temp_hp,'defeated',v_t.is_defeated
    );
  end if;

  v_result:=jsonb_build_object(
    'requestId',p_request_id,'casterId',v_c.id,'targetId',v_t.id,'assignmentId',v_assignment.id,
    'spellId',v_spell.id,'spellKey',v_spell.spell_key,'spell',v_spell.name,'actionType','action',
    'slotLevel',case when v_key='guiding-bolt|xphb' then p_slot_level else null end,
    'distanceFt',v_dist_ft,'castingAbility',v_casting_ability,'castingAbilityModifier',v_cast_mod,'proficiencyBonus',v_prof,
    'attackBonus',v_attack_bonus,'roll',v_roll,'secondRoll',v_roll2,'advantage',v_advantage,'disadvantage',v_disadvantage,
    'guidingBoltAdvantage',coalesce((v_attack_roll->>'guidingBoltAdvantage')::boolean,false),
    'guidingBoltEffectConsumed',coalesce((v_attack_roll->>'guidingBoltEffectConsumed')::boolean,false),
    'advantageCanceledByDisadvantage',coalesce((v_attack_roll->>'advantageCanceledByDisadvantage')::boolean,false),
    'baseTargetAc',coalesce(v_t.armor_class,10),'coverAcBonus',coalesce((v_targeting->>'coverAcBonus')::integer,0),'targetAc',v_target_ac,
    'hit',v_hit,'critical',v_crit,'damageDice',v_dice_count::text||'d'||v_die_size::text,
    'damageRoll',v_damage_roll,'damageType',v_damage_type,'rawDamage',v_raw_damage,'damage',v_damage,
    'opportunityAttackSuppressed',v_key='shocking-grasp|xphb' and v_hit,
    'speedPenaltyFt',case when v_key='ray-of-frost|xphb' and v_hit then 10 else 0 end,
    'targetSpeedBeforeFt',v_speed_before,'targetSpeedAfterFt',v_speed_after,
    'healingPrevented',v_key='chill-touch|xphb' and v_hit,
    'nextAttackAdvantageApplied',v_key='guiding-bolt|xphb' and v_hit,
    'nextAttackAdvantageUntil',case when v_key='guiding-bolt|xphb' and v_hit then 'source_next_turn_end' else null end,
    'timedEffect',v_effect,'targeting',v_targeting,'attackRoll',v_attack_roll
  );

  if v_key='guiding-bolt|xphb' then
    update public.encounter_spell_slots set slots_remaining=slots_remaining-1,updated_at=timezone('utc',now()) where id=v_slot.id;
    v_result:=v_result||jsonb_build_object('slotRemaining',v_slot.slots_remaining-1,'slotMax',v_slot.slots_max,'slotRechargeKey',v_slot.recharge_key);
  end if;

  update public.encounter_participants set action_available=false,updated_at=timezone('utc',now()) where id=v_c.id;
  insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
  values(
    v_e.id,v_e.round,v_e.turn_index,v_c.id,v_t.id,'spell_cast',
    v_c.display_name||' cast '||v_spell.name||' on '||v_t.display_name||case
      when v_hit and v_key='guiding-bolt|xphb' then ' and granted Advantage on the next attack roll against the target.'
      when v_hit then ' and hit.'
      else ' and missed.'
    end,
    v_result
  );
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

revoke all on function private.encounter_cast_spell_v11_transaction_candidate_v1(uuid,uuid,uuid,integer,uuid)
 from public,anon,authenticated,service_role;
