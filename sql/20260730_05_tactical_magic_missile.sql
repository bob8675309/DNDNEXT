-- Phase 1X: first allocated multi-target spell adapter.
-- Magic Missile (XPHB) allocates a slot-derived number of independently rolled
-- darts among one or more visible creatures within 120 feet.
-- Tactical encounter only. No world/town behavior is modified.

create or replace function public.encounter_cast_allocated_spell_v1(
  p_caster_id uuid,
  p_assignment_id uuid,
  p_allocations jsonb,
  p_slot_level integer,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $$
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
  v_damage jsonb;
  v_result jsonb;
  v_target_results jsonb:='[]'::jsonb;
  v_target_dart_results jsonb;
  v_item jsonb;
  v_target_ids uuid[]:='{}'::uuid[];
  v_dart_counts integer[]:='{}'::integer[];
  v_target_id uuid;
  v_inserted integer:=0;
  v_locked_count integer:=0;
  v_slot_count integer:=0;
  v_target_count integer:=0;
  v_total_darts integer:=0;
  v_expected_darts integer:=0;
  v_target_raw_total integer:=0;
  v_target_damage_total integer:=0;
  v_all_raw_total integer:=0;
  v_all_damage_total integer:=0;
  v_dist_ft integer:=0;
  v_index integer;
  v_dart_index integer;
  v_raw_damage integer;
  v_class_name text;
  v_casting_ability text;
begin
  if p_caster_id is null or p_assignment_id is null or p_request_id is null then
    raise exception 'Caster, spell assignment, and request id are required';
  end if;
  if p_slot_level is null or p_slot_level<1 or p_slot_level>9 then
    raise exception 'Choose a legal Magic Missile spell slot level';
  end if;
  if jsonb_typeof(coalesce(p_allocations,'null'::jsonb))<>'array' then
    raise exception 'Magic Missile allocations must be a JSON array';
  end if;
  if jsonb_array_length(p_allocations)=0 then
    raise exception 'Magic Missile requires at least one target allocation';
  end if;

  v_expected_darts:=p_slot_level+2;
  for v_item in select value from jsonb_array_elements(p_allocations) loop
    if jsonb_typeof(v_item)<>'object'
       or jsonb_typeof(v_item->'targetId')<>'string'
       or jsonb_typeof(v_item->'darts')<>'number'
       or coalesce(v_item->>'darts','') !~ '^[1-9][0-9]*$' then
      raise exception 'Each Magic Missile allocation requires a target id and a positive whole-number dart count';
    end if;
    if (v_item->>'darts')::numeric>v_expected_darts then
      raise exception 'A Magic Missile target cannot receive more darts than the spell creates';
    end if;
    begin
      v_target_id:=(v_item->>'targetId')::uuid;
    exception when invalid_text_representation then
      raise exception 'Each Magic Missile allocation requires a valid target id';
    end;
    if array_position(v_target_ids,v_target_id) is not null then
      raise exception 'Magic Missile target allocations must be unique';
    end if;
    v_target_ids:=array_append(v_target_ids,v_target_id);
    v_dart_counts:=array_append(v_dart_counts,(v_item->>'darts')::integer);
    v_total_darts:=v_total_darts+(v_item->>'darts')::integer;
  end loop;

  v_target_count:=coalesce(array_length(v_target_ids,1),0);
  if v_total_darts<>v_expected_darts then
    raise exception 'Magic Missile must allocate exactly % darts for the selected slot level',v_expected_darts;
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

  if lower(v_spell.spell_key)<>'magic-missile|xphb' then
    raise exception 'This allocated spell remains GM-assisted; no automated tactical adapter is approved yet';
  end if;
  if lower(coalesce(v_assignment.source_type,''))<>'class' then
    raise exception 'Magic Missile automation requires a class spell assignment';
  end if;
  if v_spell.source<>'XPHB' or v_spell.level<>1 then
    raise exception 'Magic Missile must resolve from its reviewed XPHB level-1 definition';
  end if;
  if not (v_assignment.prepared or v_assignment.always_available) then
    raise exception 'Magic Missile is not currently prepared or always available';
  end if;

  insert into public.encounter_command_requests(
    request_id,encounter_id,participant_id,command_type,requested_by
  ) values (
    p_request_id,v_c.encounter_id,v_c.id,'spell_cast',v_uid
  ) on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select * into v_existing
    from public.encounter_command_requests
    where request_id=p_request_id;
    if not found
       or v_existing.command_type<>'spell_cast'
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
  v_class_name:=lower(coalesce(v_profile->>'className',''));
  if lower(coalesce(v_assignment.source_label,''))<>v_class_name then
    raise exception 'Magic Missile assignment source does not match the canonical casting class';
  end if;
  if not exists(select 1 from unnest(v_spell.classes) cls where lower(cls)=v_class_name) then
    raise exception 'Magic Missile is not on this canonical class spell list';
  end if;
  v_casting_ability:=lower(coalesce(nullif(btrim(v_assignment.casting_stat),''),v_profile->>'castingAbility',''));
  if v_casting_ability<>lower(coalesce(v_profile->>'castingAbility','')) then
    raise exception 'Magic Missile casting ability does not match the canonical class';
  end if;
  if v_casting_ability not in ('int','wis','cha') then
    raise exception 'Magic Missile casting ability is unavailable';
  end if;

  -- Lock the entire allocation set in a stable order before validating any
  -- target or mutating HP, spell slots, action economy, or combat history.
  perform p.id
  from public.encounter_participants p
  where p.encounter_id=v_e.id and p.id=any(v_target_ids)
  order by p.id
  for update;
  get diagnostics v_locked_count=row_count;
  if v_locked_count<>v_target_count then
    raise exception 'Magic Missile target is unavailable in this encounter';
  end if;

  for v_index in 1..v_target_count loop
    select * into v_t
    from public.encounter_participants p
    where p.id=v_target_ids[v_index]
      and p.encounter_id=v_e.id
      and (
        not p.is_hidden
        or v_role='service_role'
        or p.controller_user_id is not distinct from v_uid
        or (v_uid is not null and public.is_admin(v_uid))
      );
    if not found then raise exception 'Magic Missile target is unavailable in this encounter'; end if;
    if v_t.is_defeated then
      raise exception 'Defeated participants are not automated Magic Missile targets';
    end if;
    v_targeting:=public.encounter_targeting_context_internal_v1(v_c.id,v_t.id);
    if not coalesce((v_targeting->>'hasLineOfSight')::boolean,false) then
      raise exception 'Every Magic Missile target must be visible and not behind Total Cover';
    end if;
    v_dist_ft:=coalesce((v_targeting->>'distanceFt')::integer,0);
    if v_dist_ft>120 then
      raise exception 'Every Magic Missile target must be within 120 feet';
    end if;
  end loop;

  perform private.encounter_enforce_spell_slot_cast_turn_v1(v_c.id,v_assignment.id,p_request_id);
  select count(*) into v_slot_count
  from public.encounter_spell_slots s
  where s.participant_id=v_c.id
    and s.slot_level=p_slot_level
    and s.slots_remaining>0;
  if v_slot_count=0 then raise exception 'No remaining spell slot at the selected level'; end if;
  if v_slot_count>1 then raise exception 'Multiple eligible spell-slot pools are not automated yet'; end if;
  select * into v_slot
  from public.encounter_spell_slots s
  where s.participant_id=v_c.id
    and s.slot_level=p_slot_level
    and s.slots_remaining>0
  for update;

  -- Each dart is its own damage instance. This preserves per-dart Force
  -- resistance, immunity, and vulnerability rounding while the transaction
  -- commits every allocated dart simultaneously as one spell_cast command.
  for v_index in 1..v_target_count loop
    select * into v_t
    from public.encounter_participants
    where id=v_target_ids[v_index] and encounter_id=v_e.id;
    v_targeting:=public.encounter_targeting_context_internal_v1(v_c.id,v_t.id);
    v_dist_ft:=coalesce((v_targeting->>'distanceFt')::integer,0);
    v_target_dart_results:='[]'::jsonb;
    v_target_raw_total:=0;
    v_target_damage_total:=0;

    for v_dart_index in 1..v_dart_counts[v_index] loop
      v_raw_damage:=floor(random()*4)::integer+2;
      v_damage:=public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'force');
      v_target_raw_total:=v_target_raw_total+v_raw_damage;
      v_target_damage_total:=v_target_damage_total+coalesce((v_damage->>'damage')::integer,0);
      v_target_dart_results:=v_target_dart_results||jsonb_build_array(jsonb_build_object(
        'dartIndex',v_dart_index,
        'rawDamage',v_raw_damage,
        'damage',v_damage
      ));
    end loop;

    v_all_raw_total:=v_all_raw_total+v_target_raw_total;
    v_all_damage_total:=v_all_damage_total+v_target_damage_total;
    v_target_results:=v_target_results||jsonb_build_array(jsonb_build_object(
      'targetId',v_t.id,
      'targetName',v_t.display_name,
      'distanceFt',v_dist_ft,
      'dartCount',v_dart_counts[v_index],
      'rawDamage',v_target_raw_total,
      'damage',v_target_damage_total,
      'targetHp',coalesce((v_damage->>'targetHp')::integer,v_t.current_hp),
      'targetTempHp',coalesce((v_damage->>'targetTempHp')::integer,v_t.temp_hp),
      'defeated',coalesce((v_damage->>'defeated')::boolean,v_t.is_defeated),
      'darts',v_target_dart_results,
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
    'slotLevel',p_slot_level,
    'slotPool',v_slot.pool_key,
    'castingAbility',v_casting_ability,
    'dartCount',v_expected_darts,
    'targetCount',v_target_count,
    'allocations',p_allocations,
    'damageDice','1d4+1 per dart',
    'damageType','force',
    'rawDamage',v_all_raw_total,
    'damage',v_all_damage_total,
    'targets',v_target_results,
    'simultaneous',true,
    'oneSpellSlotPerTurn',true,
    'shieldReactionAutomated',false
  );

  update public.encounter_spell_slots
  set slots_remaining=slots_remaining-1,updated_at=timezone('utc',now())
  where id=v_slot.id;
  v_result:=v_result||jsonb_build_object(
    'slotRemaining',v_slot.slots_remaining-1,
    'slotMax',v_slot.slots_max,
    'slotRechargeKey',v_slot.recharge_key
  );
  update public.encounter_participants
  set action_available=false,updated_at=timezone('utc',now())
  where id=v_c.id;

  insert into public.encounter_combat_log(
    encounter_id,round,turn_index,actor_participant_id,event_type,summary,detail
  ) values (
    v_e.id,v_e.round,v_e.turn_index,v_c.id,'spell_cast',
    v_c.display_name||' cast Magic Missile, allocating '||v_expected_darts||
      ' dart'||case when v_expected_darts=1 then '' else 's' end||
      ' across '||v_target_count||' creature'||case when v_target_count=1 then '.' else 's.' end,
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
$$;

revoke all on function public.encounter_cast_allocated_spell_v1(uuid,uuid,jsonb,integer,uuid) from public, anon;
grant execute on function public.encounter_cast_allocated_spell_v1(uuid,uuid,jsonb,integer,uuid) to authenticated, service_role;

do $postconditions$
begin
  if not has_function_privilege(
    'authenticated',
    'public.encounter_cast_allocated_spell_v1(uuid,uuid,jsonb,integer,uuid)',
    'EXECUTE'
  ) then
    raise exception 'guarded allocated spell cast RPC missing';
  end if;
  if has_function_privilege(
    'anon',
    'public.encounter_cast_allocated_spell_v1(uuid,uuid,jsonb,integer,uuid)',
    'EXECUTE'
  ) then
    raise exception 'anon must not cast reviewed allocated spells';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.encounter_apply_damage_internal_v1(uuid,integer,text)',
    'EXECUTE'
  ) then
    raise exception 'generic damage helper must remain private';
  end if;
  if has_function_privilege(
    'authenticated',
    'private.encounter_enforce_spell_slot_cast_turn_v1(uuid,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'slotted-spell turn guard must remain private';
  end if;
  if to_regprocedure('public.encounter_cast_spell_v13(uuid,uuid,uuid,integer,uuid)') is null then
    raise exception 'Healing Word v13 must remain available';
  end if;
  if to_regprocedure('public.encounter_cast_area_spell_v1(uuid,uuid,uuid[],integer,uuid)') is null then
    raise exception 'Word of Radiance area RPC must remain available';
  end if;
  if to_regprocedure('public.encounter_cast_point_area_spell_v1(uuid,uuid,integer,integer,integer,uuid)') is null then
    raise exception 'Acid Splash point-area RPC must remain available';
  end if;
end
$postconditions$;
