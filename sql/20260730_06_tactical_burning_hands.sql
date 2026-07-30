-- Phase 1Y: first directional cone spell adapter.
-- Burning Hands (XPHB) resolves a server-derived 15-foot cone on the
-- encounter-local axial grid. The reviewed hex approximation is a symmetric
-- seven-hex 1/3/3 footprint that excludes the caster's origin hex.
-- Tactical encounter only. No world/town behavior is modified.

create or replace function private.encounter_cone_15ft_hexes_v1(
  p_origin_q integer,
  p_origin_r integer,
  p_direction integer
) returns table(q integer,r integer,depth integer)
language plpgsql
immutable
security invoker
set search_path to 'pg_catalog','private'
as $$
declare
  v_offset record;
  v_q integer;
  v_r integer;
  v_next_q integer;
  v_next_r integer;
  v_rotation integer;
begin
  if p_origin_q is null or p_origin_r is null then
    raise exception 'Cone origin is required';
  end if;
  if p_direction is null or p_direction<0 or p_direction>5 then
    raise exception 'Cone direction must be an integer from 0 through 5';
  end if;

  -- Direction 0 points along axial +q. Each 60-degree rotation applies
  -- (q,r) -> (q+r,-q), matching the encounter AXIAL_DIRECTIONS order.
  for v_offset in
    select *
    from (values
      (1, 0, 1),
      (2, 0, 2),
      (2,-1, 2),
      (1, 1, 2),
      (3, 0, 3),
      (3,-1, 3),
      (2, 1, 3)
    ) as footprint(dq,dr,depth)
  loop
    v_q:=v_offset.dq;
    v_r:=v_offset.dr;
    if p_direction>0 then
      for v_rotation in 1..p_direction loop
        v_next_q:=v_q+v_r;
        v_next_r:=-v_q;
        v_q:=v_next_q;
        v_r:=v_next_r;
      end loop;
    end if;
    q:=p_origin_q+v_q;
    r:=p_origin_r+v_r;
    depth:=v_offset.depth;
    return next;
  end loop;
end;
$$;

revoke all on function private.encounter_cone_15ft_hexes_v1(integer,integer,integer) from public, anon, authenticated;
grant execute on function private.encounter_cone_15ft_hexes_v1(integer,integer,integer) to service_role;

create or replace function public.encounter_cast_directional_area_spell_v1(
  p_caster_id uuid,
  p_assignment_id uuid,
  p_direction integer,
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
  v_save_profile jsonb;
  v_damage jsonb;
  v_result jsonb;
  v_target_results jsonb:='[]'::jsonb;
  v_cone_hexes jsonb:='[]'::jsonb;
  v_inserted integer:=0;
  v_slot_count integer:=0;
  v_dice_count integer:=0;
  v_shared_damage_roll integer:=0;
  v_raw_damage integer:=0;
  v_i integer;
  v_class_name text;
  v_casting_ability text;
  v_casting_score integer;
  v_cast_mod integer;
  v_prof integer;
  v_save_dc integer;
  v_cover_bonus integer:=0;
  v_save_bonus integer:=0;
  v_save_roll integer:=0;
  v_save_total integer:=0;
  v_save_success boolean:=false;
  v_can_reveal boolean:=false;
  v_visible_target_count integer:=0;
  v_visible_success_count integer:=0;
  v_visible_failure_count integer:=0;
  v_visible_raw_damage integer:=0;
  v_visible_damage integer:=0;
  v_direction_label text;
begin
  if p_caster_id is null or p_assignment_id is null or p_request_id is null then
    raise exception 'Caster, spell assignment, and request id are required';
  end if;
  if p_direction is null or p_direction<0 or p_direction>5 then
    raise exception 'Choose a legal Burning Hands cone direction';
  end if;
  if p_slot_level is null or p_slot_level<1 or p_slot_level>9 then
    raise exception 'Choose a legal Burning Hands spell slot level';
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

  if lower(v_spell.spell_key)<>'burning-hands|xphb' then
    raise exception 'This directional-area spell remains GM-assisted; no automated tactical adapter is approved yet';
  end if;
  if lower(coalesce(v_assignment.source_type,''))<>'class' then
    raise exception 'Burning Hands automation requires a class spell assignment';
  end if;
  if v_spell.source<>'XPHB' or v_spell.level<>1 then
    raise exception 'Burning Hands must resolve from its reviewed XPHB level-1 definition';
  end if;
  if not (v_assignment.prepared or v_assignment.always_available) then
    raise exception 'Burning Hands is not currently prepared or always available';
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

  -- Burning Hands affects every creature in its cone. Until defeated-creature
  -- and condition-specific Dexterity rules are complete, fail consistently
  -- instead of silently omitting or misresolving a mandatory creature.
  if exists(
    select 1 from public.encounter_participants p
    where p.encounter_id=v_e.id and p.is_defeated
  ) or exists(
    select 1
    from public.encounter_conditions c
    join public.encounter_participants p on p.id=c.participant_id
    where p.encounter_id=v_e.id
  ) then
    raise exception 'Burning Hands remains GM-assisted while defeated or conditioned creatures are present in this encounter';
  end if;
  if exists(
    select 1
    from public.encounter_timed_effects fx
    join public.encounter_participants p on p.id=fx.participant_id
    where p.encounter_id=v_e.id
      and p.is_hidden
      and fx.effect_key='mind_sliver_save_penalty'
      and fx.remaining_target_turn_starts>0
      and v_role<>'service_role'
      and p.controller_user_id is distinct from v_uid
      and (v_uid is null or not public.is_admin(v_uid))
  ) then
    raise exception 'Directional-area save resolution remains GM-assisted while hidden saving-throw modifiers are active';
  end if;

  v_profile:=public.encounter_spellcasting_profile_v1(v_c.id);
  if not coalesce((v_profile->>'isClassCaster')::boolean,false) then
    raise exception 'This participant has no canonical class spellcasting profile';
  end if;
  v_class_name:=lower(coalesce(v_profile->>'className',''));
  if lower(coalesce(v_assignment.source_label,''))<>v_class_name then
    raise exception 'Burning Hands assignment source does not match the canonical casting class';
  end if;
  if not exists(select 1 from unnest(v_spell.classes) cls where lower(cls)=v_class_name) then
    raise exception 'Burning Hands is not on this canonical class spell list';
  end if;
  v_casting_ability:=lower(coalesce(nullif(btrim(v_assignment.casting_stat),''),v_profile->>'castingAbility',''));
  if v_casting_ability<>lower(coalesce(v_profile->>'castingAbility','')) then
    raise exception 'Burning Hands casting ability does not match the canonical class';
  end if;
  if v_casting_ability not in ('int','wis','cha') then
    raise exception 'Burning Hands casting ability is unavailable';
  end if;
  v_casting_score:=private.encounter_ability_score_v1(v_c.character_id,v_casting_ability);
  v_cast_mod:=floor((coalesce(v_casting_score,10)-10)/2.0)::integer;
  v_prof:=coalesce((v_profile->>'proficiencyBonus')::integer,2);
  v_save_dc:=coalesce(v_assignment.save_dc_override,8+v_cast_mod+v_prof);

  -- Lock every creature in the selected cone before slot, HP, Action, command
  -- result, or combat-log mutation.
  perform p.id
  from public.encounter_participants p
  where p.encounter_id=v_e.id
    and exists(
      select 1
      from private.encounter_cone_15ft_hexes_v1(v_c.q,v_c.r,p_direction) cone
      where cone.q=p.q and cone.r=p.r
    )
  order by p.id
  for update of p;

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

  v_dice_count:=p_slot_level+2;
  for v_i in 1..v_dice_count loop
    v_shared_damage_roll:=v_shared_damage_roll+floor(random()*6)::integer+1;
  end loop;

  select coalesce(jsonb_agg(
    jsonb_build_object('q',cone.q,'r',cone.r,'depth',cone.depth)
    order by cone.depth,cone.q,cone.r
  ),'[]'::jsonb)
  into v_cone_hexes
  from private.encounter_cone_15ft_hexes_v1(v_c.q,v_c.r,p_direction) cone;

  for v_t in
    select p.*
    from public.encounter_participants p
    where p.encounter_id=v_e.id
      and exists(
        select 1
        from private.encounter_cone_15ft_hexes_v1(v_c.q,v_c.r,p_direction) cone
        where cone.q=p.q and cone.r=p.r
      )
    order by p.id
  loop
    v_targeting:=private.encounter_hex_targeting_context_v1(
      v_e.id,v_c.q,v_c.r,v_t.q,v_t.r
    );
    if not coalesce((v_targeting->>'hasLineOfSight')::boolean,false) then
      continue;
    end if;

    v_cover_bonus:=coalesce((v_targeting->>'dexSaveCoverBonus')::integer,0);
    v_save_profile:=public.encounter_saving_throw_profile_internal_v1(v_t.id,'dex');
    v_save_bonus:=coalesce((v_save_profile->>'saveBonus')::integer,0);
    v_save_roll:=floor(random()*20)::integer+1;
    v_save_total:=v_save_roll+v_save_bonus+v_cover_bonus;
    v_save_success:=v_save_total>=v_save_dc;
    v_raw_damage:=case
      when v_save_success then floor(v_shared_damage_roll/2.0)::integer
      else v_shared_damage_roll
    end;
    v_damage:=public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'fire');

    v_can_reveal:=not v_t.is_hidden
      or v_role='service_role'
      or v_t.controller_user_id is not distinct from v_uid
      or (v_uid is not null and public.is_admin(v_uid));
    if v_can_reveal then
      v_visible_target_count:=v_visible_target_count+1;
      if v_save_success then
        v_visible_success_count:=v_visible_success_count+1;
      else
        v_visible_failure_count:=v_visible_failure_count+1;
      end if;
      v_visible_raw_damage:=v_visible_raw_damage+v_raw_damage;
      v_visible_damage:=v_visible_damage+coalesce((v_damage->>'damage')::integer,0);
      v_target_results:=v_target_results||jsonb_build_array(jsonb_build_object(
        'targetId',v_t.id,
        'targetName',v_t.display_name,
        'saveAbility','dex',
        'saveDc',v_save_dc,
        'saveBonus',v_save_bonus,
        'coverSaveBonus',v_cover_bonus,
        'saveRoll',v_save_roll,
        'saveTotal',v_save_total,
        'saveSuccess',v_save_success,
        'saveAdvantage',false,
        'saveProfile',v_save_profile,
        'savePenalty',coalesce((v_save_profile->>'savePenalty')::integer,0),
        'damageType','fire',
        'rawDamage',v_raw_damage,
        'damage',v_damage,
        'targetingFromCaster',v_targeting
      ));
    end if;
  end loop;

  v_direction_label:=case p_direction
    when 0 then 'east'
    when 1 then 'northeast'
    when 2 then 'northwest'
    when 3 then 'west'
    when 4 then 'southwest'
    else 'southeast'
  end;
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
    'direction',p_direction,
    'directionLabel',v_direction_label,
    'originHex',jsonb_build_object('q',v_c.q,'r',v_c.r),
    'coneHexes',v_cone_hexes,
    'areaType','cone',
    'areaLengthFt',15,
    'hexApproximation','seven-hex 1/3/3 footprint',
    'saveAbility','dex',
    'saveDc',v_save_dc,
    'damageDice',v_dice_count::text||'d6',
    'sharedDamageRoll',v_shared_damage_roll,
    'damageType','fire',
    'visibleTargetCount',v_visible_target_count,
    'visibleSuccessCount',v_visible_success_count,
    'visibleFailureCount',v_visible_failure_count,
    'visibleRawDamage',v_visible_raw_damage,
    'visibleDamage',v_visible_damage,
    'targets',v_target_results,
    'serverDerivedMembership',true,
    'simultaneous',true,
    'oneSpellSlotPerTurn',true,
    'objectIgnitionAutomated',false
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
    v_c.display_name||' cast Burning Hands toward '||v_direction_label||'.',
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

revoke all on function public.encounter_cast_directional_area_spell_v1(uuid,uuid,integer,integer,uuid) from public, anon;
grant execute on function public.encounter_cast_directional_area_spell_v1(uuid,uuid,integer,integer,uuid) to authenticated, service_role;

do $postconditions$
begin
  if not has_function_privilege(
    'authenticated',
    'public.encounter_cast_directional_area_spell_v1(uuid,uuid,integer,integer,uuid)',
    'EXECUTE'
  ) then
    raise exception 'guarded directional-area spell cast RPC missing';
  end if;
  if has_function_privilege(
    'anon',
    'public.encounter_cast_directional_area_spell_v1(uuid,uuid,integer,integer,uuid)',
    'EXECUTE'
  ) then
    raise exception 'anon must not cast reviewed directional-area spells';
  end if;
  if has_function_privilege(
    'authenticated',
    'private.encounter_cone_15ft_hexes_v1(integer,integer,integer)',
    'EXECUTE'
  ) then
    raise exception 'cone geometry helper must remain private';
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
  if to_regprocedure('public.encounter_cast_allocated_spell_v1(uuid,uuid,jsonb,integer,uuid)') is null then
    raise exception 'Magic Missile allocated RPC must remain available';
  end if;
end
$postconditions$;
