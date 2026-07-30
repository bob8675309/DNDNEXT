-- Phase 1W: first point-targeted area spell adapter.
-- Acid Splash (XPHB) creates a 5-foot-radius Sphere at a point within 60 feet.
-- The server derives every affected creature from the selected tactical hex.
-- Tactical encounter only. No world/town behavior is modified.

create or replace function private.encounter_hex_targeting_context_v1(
  p_encounter_id uuid,
  p_from_q integer,
  p_from_r integer,
  p_to_q integer,
  p_to_r integer
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_e public.encounters%rowtype;
  v_map public.encounter_maps%rowtype;
  v_line jsonb;
  v_cell jsonb;
  v_index integer:=0;
  v_q integer;
  v_r integer;
  v_cover_rank integer:=0;
  v_cover text:='none';
  v_blocked boolean:=false;
  v_block_object uuid:=null;
  v_block_q integer:=null;
  v_block_r integer:=null;
  v_obj record;
  v_distance_hex integer;
  v_from_map_distance integer;
  v_to_map_distance integer;
begin
  if p_encounter_id is null
     or p_from_q is null or p_from_r is null
     or p_to_q is null or p_to_r is null then
    raise exception 'Encounter and both tactical hexes are required';
  end if;

  select * into v_e from public.encounters where id=p_encounter_id;
  if not found then raise exception 'Encounter not found'; end if;
  select * into v_map from public.encounter_maps where id=v_e.map_id;
  if not found then raise exception 'Encounter map not found'; end if;

  v_from_map_distance:=greatest(abs(p_from_q),abs(p_from_r),abs(p_from_q+p_from_r));
  v_to_map_distance:=greatest(abs(p_to_q),abs(p_to_r),abs(p_to_q+p_to_r));
  if v_from_map_distance>v_map.radius or v_to_map_distance>v_map.radius then
    raise exception 'Tactical point is outside the encounter map';
  end if;

  v_distance_hex:=greatest(
    abs(p_to_q-p_from_q),
    abs(p_to_r-p_from_r),
    abs((p_to_q-p_from_q)+(p_to_r-p_from_r))
  );
  v_line:=public.encounter_hex_line_internal_v1(p_from_q,p_from_r,p_to_q,p_to_r);

  for v_cell in select value from jsonb_array_elements(v_line) loop
    v_index:=v_index+1;
    if v_index=1 then continue; end if;
    v_q:=(v_cell->>'q')::integer;
    v_r:=(v_cell->>'r')::integer;

    for v_obj in
      select id,blocks_los,cover_level
      from public.encounter_map_objects
      where map_id=v_e.map_id and q=v_q and r=v_r
      order by
        case cover_level when 'total' then 3 when 'three_quarters' then 2 when 'half' then 1 else 0 end desc,
        blocks_los desc,
        id
    loop
      if v_obj.blocks_los or v_obj.cover_level='total' then
        v_blocked:=true;
        v_block_object:=v_obj.id;
        v_block_q:=v_q;
        v_block_r:=v_r;
        exit;
      end if;
      if v_obj.cover_level='three_quarters' then
        v_cover_rank:=greatest(v_cover_rank,2);
      elsif v_obj.cover_level='half' then
        v_cover_rank:=greatest(v_cover_rank,1);
      end if;
    end loop;
    exit when v_blocked;
  end loop;

  if v_cover_rank=2 then
    v_cover:='three_quarters';
  elsif v_cover_rank=1 then
    v_cover:='half';
  end if;

  return jsonb_build_object(
    'encounterId',v_e.id,
    'fromHex',jsonb_build_object('q',p_from_q,'r',p_from_r),
    'toHex',jsonb_build_object('q',p_to_q,'r',p_to_r),
    'distanceHex',v_distance_hex,
    'distanceFt',v_distance_hex*5,
    'line',v_line,
    'hasLineOfSight',not v_blocked,
    'coverLevel',case when v_blocked then 'total' else v_cover end,
    'coverAcBonus',case when v_blocked then 0 when v_cover='three_quarters' then 5 when v_cover='half' then 2 else 0 end,
    'dexSaveCoverBonus',case when v_blocked then 0 when v_cover='three_quarters' then 5 when v_cover='half' then 2 else 0 end,
    'blockingObjectId',v_block_object,
    'blockingHex',case when v_blocked then jsonb_build_object('q',v_block_q,'r',v_block_r) else null end
  );
end;
$$;

revoke all on function private.encounter_hex_targeting_context_v1(uuid,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function private.encounter_hex_targeting_context_v1(uuid,integer,integer,integer,integer) to service_role;

create or replace function public.encounter_cast_point_area_spell_v1(
  p_caster_id uuid,
  p_assignment_id uuid,
  p_origin_q integer,
  p_origin_r integer,
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
  v_profile jsonb;
  v_origin_targeting jsonb;
  v_area_targeting jsonb;
  v_save_profile jsonb;
  v_damage jsonb;
  v_result jsonb;
  v_target_results jsonb:='[]'::jsonb;
  v_inserted integer:=0;
  v_class_name text;
  v_casting_ability text;
  v_casting_score integer;
  v_cast_mod integer;
  v_prof integer;
  v_save_dc integer;
  v_origin_distance_ft integer:=0;
  v_target_distance_hex integer:=0;
  v_cover_bonus integer:=0;
  v_save_bonus integer:=0;
  v_save_roll integer:=0;
  v_save_total integer:=0;
  v_save_success boolean:=false;
  v_can_reveal boolean:=false;
  v_dice_count integer:=0;
  v_die_size integer:=6;
  v_shared_damage_roll integer:=0;
  v_i integer;
  v_visible_target_count integer:=0;
  v_visible_success_count integer:=0;
  v_visible_failure_count integer:=0;
begin
  if p_caster_id is null or p_assignment_id is null
     or p_origin_q is null or p_origin_r is null or p_request_id is null then
    raise exception 'Caster, spell assignment, point of origin, and request id are required';
  end if;

  select * into v_c from public.encounter_participants where id=p_caster_id;
  if not found then raise exception 'Caster not found'; end if;
  select * into v_assignment
  from public.character_spells
  where id=p_assignment_id and character_id=v_c.character_id;
  if not found then raise exception 'Spell assignment is not in this character''s spellbook'; end if;
  select * into v_spell from public.spells_catalog where id=v_assignment.spell_id;
  if not found then raise exception 'Assigned spell definition not found'; end if;

  if lower(v_spell.spell_key)<>'acid-splash|xphb' then
    raise exception 'This point-area spell remains GM-assisted; no automated tactical adapter is approved yet';
  end if;
  if lower(coalesce(v_assignment.source_type,''))<>'class' then
    raise exception 'Acid Splash automation requires a class spell assignment';
  end if;
  if v_spell.source<>'XPHB' or v_spell.level<>0 then
    raise exception 'Acid Splash must resolve from its reviewed XPHB cantrip definition';
  end if;
  if p_slot_level is not null and p_slot_level<>0 then
    raise exception 'Cantrips do not use spell slots';
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

  -- Until defeated-creature and condition-specific area interactions are
  -- modeled, fail the whole encounter consistently instead of omitting a
  -- server-derived creature or exposing its position through point probes.
  if exists(
    select 1 from public.encounter_participants p
    where p.encounter_id=v_e.id and p.is_defeated
  ) or exists(
    select 1
    from public.encounter_conditions c
    join public.encounter_participants p on p.id=c.participant_id
    where p.encounter_id=v_e.id
  ) then
    raise exception 'Acid Splash remains GM-assisted while defeated or conditioned creatures are present in this encounter';
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
    raise exception 'Point-area save resolution remains GM-assisted while hidden saving-throw modifiers are active';
  end if;

  v_profile:=public.encounter_spellcasting_profile_v1(v_c.id);
  if not coalesce((v_profile->>'isClassCaster')::boolean,false) then
    raise exception 'This participant has no canonical class spellcasting profile';
  end if;
  v_class_name:=lower(coalesce(v_profile->>'className',''));
  if lower(coalesce(v_assignment.source_label,''))<>v_class_name then
    raise exception 'Acid Splash assignment source does not match the canonical casting class';
  end if;
  if not exists(select 1 from unnest(v_spell.classes) cls where lower(cls)=v_class_name) then
    raise exception 'Acid Splash is not on this canonical class spell list';
  end if;

  v_casting_ability:=lower(coalesce(nullif(btrim(v_assignment.casting_stat),''),v_profile->>'castingAbility',''));
  if v_casting_ability<>lower(coalesce(v_profile->>'castingAbility','')) then
    raise exception 'Acid Splash casting ability does not match the canonical class';
  end if;
  if v_casting_ability not in ('int','wis','cha') then
    raise exception 'Acid Splash casting ability is unavailable';
  end if;
  v_casting_score:=private.encounter_ability_score_v1(v_c.character_id,v_casting_ability);
  v_cast_mod:=floor((coalesce(v_casting_score,10)-10)/2.0)::integer;
  v_prof:=coalesce((v_profile->>'proficiencyBonus')::integer,2);
  v_save_dc:=coalesce(v_assignment.save_dc_override,8+v_cast_mod+v_prof);

  v_origin_targeting:=private.encounter_hex_targeting_context_v1(
    v_e.id,v_c.q,v_c.r,p_origin_q,p_origin_r
  );
  if not coalesce((v_origin_targeting->>'hasLineOfSight')::boolean,false) then
    raise exception 'Acid Splash point of origin is blocked by total cover or line-of-sight obstruction';
  end if;
  v_origin_distance_ft:=coalesce((v_origin_targeting->>'distanceFt')::integer,0);
  if v_origin_distance_ft>60 then raise exception 'Acid Splash point of origin is beyond range'; end if;

  v_dice_count:=case
    when coalesce((v_profile->>'classLevel')::integer,1)>=17 then 4
    when coalesce((v_profile->>'classLevel')::integer,1)>=11 then 3
    when coalesce((v_profile->>'classLevel')::integer,1)>=5 then 2
    else 1
  end;
  for v_i in 1..v_dice_count loop
    v_shared_damage_roll:=v_shared_damage_roll+floor(random()*v_die_size)::integer+1;
  end loop;

  -- All participants in the 5-foot tactical radius are derived and locked by
  -- the server. Total Cover from the Sphere origin excludes a creature from
  -- the effect; lesser cover contributes to its Dexterity save.
  for v_t in
    select p.*
    from public.encounter_participants p
    where p.encounter_id=v_e.id
      and greatest(
        abs(p.q-p_origin_q),
        abs(p.r-p_origin_r),
        abs((p.q-p_origin_q)+(p.r-p_origin_r))
      )<=1
    order by p.id
    for update
  loop
    v_target_distance_hex:=greatest(
      abs(v_t.q-p_origin_q),
      abs(v_t.r-p_origin_r),
      abs((v_t.q-p_origin_q)+(v_t.r-p_origin_r))
    );
    v_area_targeting:=private.encounter_hex_targeting_context_v1(
      v_e.id,p_origin_q,p_origin_r,v_t.q,v_t.r
    );
    if not coalesce((v_area_targeting->>'hasLineOfSight')::boolean,false) then
      continue;
    end if;

    v_cover_bonus:=coalesce((v_area_targeting->>'dexSaveCoverBonus')::integer,0);
    v_save_profile:=public.encounter_saving_throw_profile_internal_v1(v_t.id,'dex');
    v_save_bonus:=coalesce((v_save_profile->>'saveBonus')::integer,0);
    v_save_roll:=floor(random()*20)::integer+1;
    v_save_total:=v_save_roll+v_save_bonus+v_cover_bonus;
    v_save_success:=v_save_total>=v_save_dc;

    if v_save_success then
      v_damage:=jsonb_build_object(
        'targetId',v_t.id,'damageType','acid','rawDamage',0,
        'resistant',false,'immune',false,'vulnerable',false,'damage',0,
        'targetHp',v_t.current_hp,'targetTempHp',v_t.temp_hp,'defeated',v_t.is_defeated
      );
    else
      v_damage:=public.encounter_apply_damage_internal_v1(v_t.id,v_shared_damage_roll,'acid');
    end if;

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
      v_target_results:=v_target_results||jsonb_build_array(jsonb_build_object(
        'targetId',v_t.id,
        'targetName',v_t.display_name,
        'distanceFromOriginFt',v_target_distance_hex*5,
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
        'damageType','acid',
        'rawDamage',case when v_save_success then 0 else v_shared_damage_roll end,
        'damage',v_damage,
        'targetingFromOrigin',v_area_targeting
      ));
    end if;
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
    'originHex',jsonb_build_object('q',p_origin_q,'r',p_origin_r),
    'originDistanceFt',v_origin_distance_ft,
    'areaType','sphere',
    'areaRadiusFt',5,
    'saveAbility','dex',
    'saveDc',v_save_dc,
    'damageDice',v_dice_count::text||'d6',
    'sharedDamageRoll',v_shared_damage_roll,
    'damageType','acid',
    'visibleTargetCount',v_visible_target_count,
    'visibleSuccessCount',v_visible_success_count,
    'visibleFailureCount',v_visible_failure_count,
    'targets',v_target_results,
    'originTargeting',v_origin_targeting,
    'serverDerivedMembership',true
  );

  update public.encounter_participants
  set action_available=false,updated_at=timezone('utc',now())
  where id=v_c.id;

  insert into public.encounter_combat_log(
    encounter_id,round,turn_index,actor_participant_id,event_type,summary,detail
  ) values (
    v_e.id,v_e.round,v_e.turn_index,v_c.id,'spell_cast',
    v_c.display_name||' cast Acid Splash at tactical hex '||p_origin_q||','||p_origin_r||'.',
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

revoke all on function public.encounter_cast_point_area_spell_v1(uuid,uuid,integer,integer,integer,uuid) from public, anon;
grant execute on function public.encounter_cast_point_area_spell_v1(uuid,uuid,integer,integer,integer,uuid) to authenticated, service_role;

do $postconditions$
begin
  if not has_function_privilege(
    'authenticated',
    'public.encounter_cast_point_area_spell_v1(uuid,uuid,integer,integer,integer,uuid)',
    'EXECUTE'
  ) then
    raise exception 'guarded point-area spell cast RPC missing';
  end if;
  if has_function_privilege(
    'anon',
    'public.encounter_cast_point_area_spell_v1(uuid,uuid,integer,integer,integer,uuid)',
    'EXECUTE'
  ) then
    raise exception 'anon must not cast reviewed point-area spells';
  end if;
  if has_function_privilege(
    'authenticated',
    'private.encounter_hex_targeting_context_v1(uuid,integer,integer,integer,integer)',
    'EXECUTE'
  ) then
    raise exception 'hex targeting helper must remain private';
  end if;
  if to_regprocedure('public.encounter_cast_area_spell_v1(uuid,uuid,uuid[],integer,uuid)') is null then
    raise exception 'Word of Radiance area RPC must remain available';
  end if;
  if to_regprocedure('public.encounter_cast_spell_v13(uuid,uuid,uuid,integer,uuid)') is null then
    raise exception 'Healing Word v13 must remain available';
  end if;
end
$postconditions$;
