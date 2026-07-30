-- Phase 1T final server hardening: preserve legacy public spell RPCs while ensuring
-- every reviewed attack-roll spell reaches encounter_cast_spell_v11 and the shared
-- one-shot attack-roll modifier authority path.

-- v1 remains the legacy owner for Cure Wounds. Fire Bolt is redirected to v11
-- before any command ledger, Action, slot, or damage mutation occurs.
create or replace function public.encounter_cast_spell_v1(
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
  v_healing jsonb:=null;
  v_inserted integer:=0;
  v_slot_count integer:=0;
  v_key text;
  v_dist_ft integer:=0;
  v_casting_ability text;
  v_casting_score integer;
  v_cast_mod integer;
  v_prof integer;
  v_dice_count integer:=0;
  v_die_size integer:=8;
  v_heal_roll integer:=0;
  v_heal_total integer:=0;
  v_i integer;
  v_result jsonb;
begin
  if p_caster_id is null or p_assignment_id is null or p_target_id is null or p_request_id is null then
    raise exception 'Caster, spell assignment, target, and request id are required';
  end if;

  -- Resolve only enough metadata to redirect the legacy Fire Bolt entry point.
  select lower(s.spell_key)
  into v_key
  from public.encounter_participants p
  join public.character_spells cs on cs.character_id=p.character_id and cs.id=p_assignment_id
  join public.spells_catalog s on s.id=cs.spell_id
  where p.id=p_caster_id;

  if v_key='fire-bolt|xphb' then
    return public.encounter_cast_spell_v11(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
  end if;

  select * into v_c from public.encounter_participants where id=p_caster_id;
  if not found then raise exception 'Caster not found'; end if;

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
  if not v_c.action_available then raise exception 'Action already spent'; end if;
  if exists(
    select 1 from public.encounter_conditions c
    where c.participant_id=v_c.id
      and c.condition_key in ('incapacitated','paralyzed','stunned','unconscious')
  ) then
    raise exception 'Current conditions prevent this participant from taking the Cast action';
  end if;

  select * into v_assignment
  from public.character_spells
  where id=p_assignment_id and character_id=v_c.character_id;
  if not found then raise exception 'Spell assignment is not in this character''s spellbook'; end if;
  select * into v_spell from public.spells_catalog where id=v_assignment.spell_id;
  if not found then raise exception 'Assigned spell definition not found'; end if;
  if lower(coalesce(v_assignment.source_type,''))<>'class' then
    raise exception 'Only class spell assignments are automated in this casting slice';
  end if;
  if v_spell.source<>'XPHB' then
    raise exception 'Only reviewed XPHB spell versions are automated in this casting slice';
  end if;

  v_key:=lower(v_spell.spell_key);
  if v_key<>'cure-wounds|xphb' then
    raise exception 'This spell remains GM-assisted; no automated tactical adapter is approved yet';
  end if;
  if not (v_assignment.prepared or v_assignment.always_available) then
    raise exception 'This leveled spell is not currently prepared or always available';
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

  v_targeting:=public.encounter_targeting_context_internal_v1(v_c.id,v_t.id);
  if not coalesce((v_targeting->>'hasLineOfSight')::boolean,false) then
    raise exception 'Target is blocked by total cover or line-of-sight obstruction';
  end if;
  v_dist_ft:=coalesce((v_targeting->>'distanceFt')::integer,0);

  if p_slot_level is null or p_slot_level<v_spell.level or p_slot_level>9 then raise exception 'Choose a legal spell slot level'; end if;
  select count(*) into v_slot_count
  from public.encounter_spell_slots s
  where s.participant_id=v_c.id and s.slot_level=p_slot_level and s.slots_remaining>0;
  if v_slot_count=0 then raise exception 'No remaining spell slot at the selected level'; end if;
  if v_slot_count>1 then raise exception 'Multiple eligible spell-slot pools are not automated yet'; end if;
  select * into v_slot
  from public.encounter_spell_slots s
  where s.participant_id=v_c.id and s.slot_level=p_slot_level and s.slots_remaining>0
  for update;

  if v_dist_ft>5 then raise exception 'Cure Wounds requires a target within 5 feet'; end if;
  v_dice_count:=2*p_slot_level;
  for v_i in 1..v_dice_count loop
    v_heal_roll:=v_heal_roll+floor(random()*v_die_size)::integer+1;
  end loop;
  v_heal_total:=greatest(0,v_heal_roll+v_cast_mod);
  v_healing:=public.encounter_apply_healing_internal_v1(v_t.id,v_heal_total);
  v_result:=jsonb_build_object(
    'requestId',p_request_id,'casterId',v_c.id,'targetId',v_t.id,'assignmentId',v_assignment.id,'spellId',v_spell.id,'spellKey',v_spell.spell_key,'spell',v_spell.name,
    'actionType','action','slotLevel',p_slot_level,'slotPool',v_slot.pool_key,'distanceFt',v_dist_ft,'castingAbility',v_casting_ability,'castingAbilityModifier',v_cast_mod,
    'healingDice',v_dice_count::text||'d'||v_die_size::text,'healingRoll',v_heal_roll,'healingRequested',v_heal_total,'healing',v_healing,'targeting',v_targeting
  );

  update public.encounter_spell_slots set slots_remaining=slots_remaining-1,updated_at=timezone('utc',now()) where id=v_slot.id;
  v_result:=v_result||jsonb_build_object('slotRemaining',v_slot.slots_remaining-1,'slotMax',v_slot.slots_max,'slotRechargeKey',v_slot.recharge_key);

  update public.encounter_participants set action_available=false,updated_at=timezone('utc',now()) where id=v_c.id;
  insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
  values(v_e.id,v_e.round,v_e.turn_index,v_c.id,v_t.id,'spell_cast',v_c.display_name||' cast '||v_spell.name||' on '||v_t.display_name||'.',v_result);
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

revoke all on function public.encounter_cast_spell_v1(uuid,uuid,uuid,integer,uuid) from public, anon;
grant execute on function public.encounter_cast_spell_v1(uuid,uuid,uuid,integer,uuid) to authenticated, service_role;

-- Each later legacy attack owner remains a public compatibility entry point, but
-- its owned attack spell is redirected to v11. Older non-attack/prior-version
-- spells continue down the historical chain unchanged.
create or replace function public.encounter_cast_spell_v4(
  p_caster_id uuid,p_assignment_id uuid,p_target_id uuid,p_slot_level integer,p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare v_key text;
begin
  select lower(s.spell_key) into v_key
  from public.encounter_participants p
  join public.character_spells cs on cs.character_id=p.character_id and cs.id=p_assignment_id
  join public.spells_catalog s on s.id=cs.spell_id
  where p.id=p_caster_id;
  if v_key='poison-spray|xphb' then
    return public.encounter_cast_spell_v11(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
  end if;
  return public.encounter_cast_spell_v3(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
end;
$function$;
revoke all on function public.encounter_cast_spell_v4(uuid,uuid,uuid,integer,uuid) from public, anon;
grant execute on function public.encounter_cast_spell_v4(uuid,uuid,uuid,integer,uuid) to authenticated, service_role;

create or replace function public.encounter_cast_spell_v7(
  p_caster_id uuid,p_assignment_id uuid,p_target_id uuid,p_slot_level integer,p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare v_key text;
begin
  select lower(s.spell_key) into v_key
  from public.encounter_participants p
  join public.character_spells cs on cs.character_id=p.character_id and cs.id=p_assignment_id
  join public.spells_catalog s on s.id=cs.spell_id
  where p.id=p_caster_id;
  if v_key='shocking-grasp|xphb' then
    return public.encounter_cast_spell_v11(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
  end if;
  return public.encounter_cast_spell_v6(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
end;
$function$;
revoke all on function public.encounter_cast_spell_v7(uuid,uuid,uuid,integer,uuid) from public, anon;
grant execute on function public.encounter_cast_spell_v7(uuid,uuid,uuid,integer,uuid) to authenticated, service_role;

create or replace function public.encounter_cast_spell_v8(
  p_caster_id uuid,p_assignment_id uuid,p_target_id uuid,p_slot_level integer,p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare v_key text;
begin
  select lower(s.spell_key) into v_key
  from public.encounter_participants p
  join public.character_spells cs on cs.character_id=p.character_id and cs.id=p_assignment_id
  join public.spells_catalog s on s.id=cs.spell_id
  where p.id=p_caster_id;
  if v_key='ray-of-frost|xphb' then
    return public.encounter_cast_spell_v11(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
  end if;
  return public.encounter_cast_spell_v7(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
end;
$function$;
revoke all on function public.encounter_cast_spell_v8(uuid,uuid,uuid,integer,uuid) from public, anon;
grant execute on function public.encounter_cast_spell_v8(uuid,uuid,uuid,integer,uuid) to authenticated, service_role;

create or replace function public.encounter_cast_spell_v9(
  p_caster_id uuid,p_assignment_id uuid,p_target_id uuid,p_slot_level integer,p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare v_key text;
begin
  select lower(s.spell_key) into v_key
  from public.encounter_participants p
  join public.character_spells cs on cs.character_id=p.character_id and cs.id=p_assignment_id
  join public.spells_catalog s on s.id=cs.spell_id
  where p.id=p_caster_id;
  if v_key='chill-touch|xphb' then
    return public.encounter_cast_spell_v11(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
  end if;
  return public.encounter_cast_spell_v8(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
end;
$function$;
revoke all on function public.encounter_cast_spell_v9(uuid,uuid,uuid,integer,uuid) from public, anon;
grant execute on function public.encounter_cast_spell_v9(uuid,uuid,uuid,integer,uuid) to authenticated, service_role;

do $postconditions$
begin
  if to_regprocedure('public.encounter_cast_spell_v11(uuid,uuid,uuid,integer,uuid)') is null then raise exception 'v11 canonical resolver missing'; end if;
  if not has_function_privilege('authenticated','public.encounter_cast_spell_v1(uuid,uuid,uuid,integer,uuid)','EXECUTE') then raise exception 'v1 compatibility grant missing'; end if;
  if not has_function_privilege('authenticated','public.encounter_cast_spell_v4(uuid,uuid,uuid,integer,uuid)','EXECUTE') then raise exception 'v4 compatibility grant missing'; end if;
  if not has_function_privilege('authenticated','public.encounter_cast_spell_v7(uuid,uuid,uuid,integer,uuid)','EXECUTE') then raise exception 'v7 compatibility grant missing'; end if;
  if not has_function_privilege('authenticated','public.encounter_cast_spell_v8(uuid,uuid,uuid,integer,uuid)','EXECUTE') then raise exception 'v8 compatibility grant missing'; end if;
  if not has_function_privilege('authenticated','public.encounter_cast_spell_v9(uuid,uuid,uuid,integer,uuid)','EXECUTE') then raise exception 'v9 compatibility grant missing'; end if;
  if has_function_privilege('anon','public.encounter_cast_spell_v1(uuid,uuid,uuid,integer,uuid)','EXECUTE')
     or has_function_privilege('anon','public.encounter_cast_spell_v4(uuid,uuid,uuid,integer,uuid)','EXECUTE')
     or has_function_privilege('anon','public.encounter_cast_spell_v7(uuid,uuid,uuid,integer,uuid)','EXECUTE')
     or has_function_privilege('anon','public.encounter_cast_spell_v8(uuid,uuid,uuid,integer,uuid)','EXECUTE')
     or has_function_privilege('anon','public.encounter_cast_spell_v9(uuid,uuid,uuid,integer,uuid)','EXECUTE') then
    raise exception 'legacy attack compatibility RPCs must remain unavailable to anon';
  end if;
end;
$postconditions$;
