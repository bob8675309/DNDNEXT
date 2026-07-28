begin;

create or replace function public.encounter_cast_spell_v4(
  p_caster_id uuid,
  p_assignment_id uuid,
  p_target_id uuid,
  p_slot_level integer,
  p_request_id uuid
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, private, auth
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
  v_die_size integer:=12;
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

  select * into v_assignment
  from public.character_spells
  where id=p_assignment_id and character_id=v_c.character_id;
  if not found then raise exception 'Spell assignment is not in this character''s spellbook'; end if;

  select * into v_spell from public.spells_catalog where id=v_assignment.spell_id;
  if not found then raise exception 'Assigned spell definition not found'; end if;

  v_key:=lower(v_spell.spell_key);
  if v_key in ('fire-bolt|xphb','cure-wounds|xphb','sacred-flame|xphb','toll-the-dead|xphb') then
    return public.encounter_cast_spell_v3(
      p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id
    );
  end if;

  if v_key<>'poison-spray|xphb' then
    raise exception 'This spell remains GM-assisted; no automated tactical adapter is approved yet';
  end if;
  if lower(coalesce(v_assignment.source_type,''))<>'class' then
    raise exception 'Only class spell assignments are automated in this casting slice';
  end if;
  if v_spell.source<>'XPHB' then
    raise exception 'Only reviewed XPHB spell versions are automated in this casting slice';
  end if;
  if v_spell.level<>0 then
    raise exception 'Poison Spray must resolve from its reviewed cantrip definition';
  end if;
  if p_slot_level is not null and p_slot_level<>0 then
    raise exception 'Cantrips do not use spell slots';
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
  if p_target_id=v_c.id then
    v_t:=v_c;
  else
    select * into v_t
    from public.encounter_participants
    where id=p_target_id and encounter_id=v_c.encounter_id
    for update;
    if not found then raise exception 'Target not found in this encounter'; end if;
  end if;

  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_c.id then
    raise exception 'It is not this participant''s active turn';
  end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_c.id) then
    raise exception 'Not authorized to control this participant';
  end if;
  if v_t.is_hidden
     and v_role<>'service_role'
     and v_t.controller_user_id is distinct from v_uid
     and (v_uid is null or not public.is_admin(v_uid)) then
    raise exception 'Target is hidden from this controller';
  end if;
  if v_c.is_defeated then raise exception 'Defeated participants cannot cast spells'; end if;
  if p_target_id=v_c.id then raise exception 'Poison Spray requires another creature target'; end if;
  if v_t.is_defeated then raise exception 'Target is already defeated'; end if;
  if not v_c.action_available then raise exception 'Action already spent'; end if;
  if exists (
    select 1 from public.encounter_conditions c
    where c.participant_id=v_c.id
      and c.condition_key in ('incapacitated','paralyzed','stunned','unconscious')
  ) then
    raise exception 'Current conditions prevent this participant from taking the Cast action';
  end if;

  v_profile:=public.encounter_spellcasting_profile_v1(v_c.id);
  if not coalesce((v_profile->>'isClassCaster')::boolean,false) then
    raise exception 'This participant has no canonical class spellcasting profile';
  end if;
  v_casting_ability:=lower(coalesce(nullif(btrim(v_assignment.casting_stat),''),v_profile->>'castingAbility',''));
  if v_casting_ability not in ('str','dex','con','int','wis','cha') then raise exception 'Casting ability is unavailable'; end if;
  v_casting_score:=private.encounter_ability_score_v1(v_c.character_id,v_casting_ability);
  v_cast_mod:=floor((coalesce(v_casting_score,10)-10)/2.0)::integer;
  v_prof:=coalesce((v_profile->>'proficiencyBonus')::integer,2);
  v_attack_bonus:=coalesce(v_assignment.attack_bonus_override,v_cast_mod+v_prof);

  v_targeting:=public.encounter_targeting_context_internal_v1(v_c.id,v_t.id);
  if not coalesce((v_targeting->>'hasLineOfSight')::boolean,false) then
    raise exception 'Target is blocked by total cover or line-of-sight obstruction';
  end if;
  v_dist_ft:=coalesce((v_targeting->>'distanceFt')::integer,0);
  if v_dist_ft>30 then raise exception 'Target is beyond Poison Spray range'; end if;

  if exists (
    select 1 from public.encounter_participants p
    where p.encounter_id=v_c.encounter_id
      and p.id<>v_c.id
      and not p.is_defeated
      and public.encounter_are_hostile_internal_v1(v_c.team,p.team)
      and greatest(abs(p.q-v_c.q),abs(p.r-v_c.r),abs((p.q-v_c.q)+(p.r-v_c.r)))<=1
  ) then
    raise exception 'Close-quarters ranged spell attacks remain GM-assisted in this slice';
  end if;
  if exists (
    select 1 from public.encounter_conditions c
    where c.participant_id in (v_c.id,v_t.id)
  ) then
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
    v_damage:=public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'poison');
  else
    v_damage:=jsonb_build_object(
      'targetId',v_t.id,'damageType','poison','rawDamage',0,
      'resistant',false,'immune',false,'vulnerable',false,'damage',0,
      'targetHp',v_t.current_hp,'targetTempHp',v_t.temp_hp,'defeated',v_t.is_defeated
    );
  end if;

  v_result:=jsonb_build_object(
    'requestId',p_request_id,
    'casterId',v_c.id,
    'targetId',v_t.id,
    'assignmentId',v_assignment.id,
    'spellId',v_spell.id,
    'spellKey',v_spell.spell_key,
    'spell',v_spell.name,
    'actionType','action',
    'slotLevel',null,
    'distanceFt',v_dist_ft,
    'castingAbility',v_casting_ability,
    'castingAbilityModifier',v_cast_mod,
    'proficiencyBonus',v_prof,
    'attackBonus',v_attack_bonus,
    'roll',v_roll,
    'secondRoll',case when v_disadvantage then v_roll2 else null end,
    'disadvantage',v_disadvantage,
    'baseTargetAc',coalesce(v_t.armor_class,10),
    'coverAcBonus',coalesce((v_targeting->>'coverAcBonus')::integer,0),
    'targetAc',v_target_ac,
    'hit',v_hit,
    'critical',v_crit,
    'damageDice',v_dice_count::text||'d'||v_die_size::text,
    'damageRoll',v_damage_roll,
    'damageType','poison',
    'rawDamage',v_raw_damage,
    'damage',v_damage,
    'targeting',v_targeting
  );

  update public.encounter_participants
  set action_available=false,updated_at=timezone('utc',now())
  where id=v_c.id;

  insert into public.encounter_combat_log(
    encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail
  ) values (
    v_e.id,v_e.round,v_e.turn_index,v_c.id,v_t.id,'spell_cast',
    v_c.display_name||' cast Poison Spray on '||v_t.display_name||case when v_hit then ' and hit.' else ' and missed.' end,
    v_result
  );
  update public.encounters
  set version=version+1,updated_at=timezone('utc',now())
  where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

revoke all on function public.encounter_cast_spell_v4(uuid,uuid,uuid,integer,uuid) from public, anon;
grant execute on function public.encounter_cast_spell_v4(uuid,uuid,uuid,integer,uuid) to authenticated, service_role;

do $postconditions$
begin
  if not has_function_privilege('authenticated','public.encounter_cast_spell_v4(uuid,uuid,uuid,integer,uuid)','EXECUTE') then
    raise exception 'guarded Poison Spray cast RPC missing';
  end if;
  if has_function_privilege('anon','public.encounter_cast_spell_v4(uuid,uuid,uuid,integer,uuid)','EXECUTE') then
    raise exception 'anon must not cast Poison Spray';
  end if;
  if not has_function_privilege('authenticated','public.encounter_cast_spell_v3(uuid,uuid,uuid,integer,uuid)','EXECUTE') then
    raise exception 'Phase 1K cast RPC must remain available';
  end if;
  if not has_function_privilege('authenticated','public.encounter_cast_spell_v2(uuid,uuid,uuid,integer,uuid)','EXECUTE') then
    raise exception 'Phase 1J cast RPC must remain available';
  end if;
  if not has_function_privilege('authenticated','public.encounter_cast_spell_v1(uuid,uuid,uuid,integer,uuid)','EXECUTE') then
    raise exception 'Phase 1I cast RPC must remain available';
  end if;
end;
$postconditions$;

commit;
