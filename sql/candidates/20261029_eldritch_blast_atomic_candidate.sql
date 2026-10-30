-- EXPERIMENTAL ONLY. Do not apply to production until the signed-in invocation
-- boundary, 2-session authorization tests and complete beam regressions pass.
-- No EXECUTE grant: not callable from the browser or service role.
create or replace function private.encounter_eldritch_blast_candidate_v1(
  p_caster_id uuid, p_assignment_id uuid, p_target_ids uuid[], p_request_id uuid
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private,auth
as $candidate$
declare
  v_uid uuid:=auth.uid();
  v_role text:=coalesce(auth.role(),'');
  v_c public.encounter_participants%rowtype;
  v_t public.encounter_participants%rowtype;
  v_e public.encounters%rowtype;
  v_assignment public.character_spells%rowtype;
  v_spell public.spells_catalog%rowtype;
  v_prev public.encounter_command_requests%rowtype;
  v_profile jsonb;
  v_targeting jsonb;
  v_roll_data jsonb;
  v_damage jsonb;
  v_results jsonb:='[]'::jsonb;
  v_result jsonb;
  v_targets integer:=coalesce(cardinality(p_target_ids),0);
  v_level integer;
  v_beams integer;
  v_cha_score integer;
  v_cha_mod integer;
  v_agonizing boolean:=false;
  v_spell_bonus integer;
  v_target_ac integer;
  v_natural integer;
  v_total integer;
  v_hit boolean;
  v_crit boolean;
  v_raw integer;
  v_dice integer;
  v_base_disadvantage boolean;
  v_i integer;
  v_die integer;
  v_inserted integer;
  v_target_id uuid;
begin
  if p_caster_id is null or p_assignment_id is null or p_request_id is null
     or v_targets not between 1 and 4 or array_position(p_target_ids,null) is not null
  then
    raise exception 'Caster, spell assignment, one to four target beams, and request id required'
      using errcode='22023';
  end if;
  -- A service-role RPC impersonating a user is never an authenticated user.
  -- No role has been granted EXECUTE: this candidate is intentionally held.
  if v_role<>'authenticated' or v_uid is null then
    raise exception 'A verified signed-in execution context is required'
      using errcode='42501';
  end if;

  select * into v_c from public.encounter_participants where id=p_caster_id for update;
  if not found or v_c.character_id is null then
    raise exception 'Caster must be a linked encounter character' using errcode='22023';
  end if;
  select * into v_e from public.encounters where id=v_c.encounter_id for update;
  if not found then raise exception 'Encounter not found'; end if;
  if v_c.controller_user_id is distinct from v_uid
     and not public.is_admin(v_uid)
     and not exists (
       select 1 from public.character_permissions cp
       where cp.character_id=v_c.character_id and cp.user_id=v_uid and coalesce(cp.can_edit,false)
       for share
     )
  then
    raise exception 'Not authorized to cast with this participant' using errcode='42501';
  end if;
  -- Authorized idempotent replay is valid even after the Action was spent
  -- or the turn advanced. Only the same authenticated user/actor/type can
  -- retrieve an existing result; replay does not mutate combat state.
  select * into v_prev from public.encounter_command_requests
    where request_id=p_request_id for update;
  if found then
    if v_prev.command_type<>'spell_cast'
      or v_prev.participant_id<>v_c.id or v_prev.requested_by is distinct from v_uid
      or lower(coalesce(v_prev.result->>'spellKey',''))<>'eldritch-blast|xphb'
      or coalesce(v_prev.result->>'assignmentId','')<>p_assignment_id::text
      or v_prev.result->'targetIds' is distinct from to_jsonb(p_target_ids)
    then raise exception 'Request id belongs to another command or changed cast intent'
      using errcode='42501'; end if;
    return coalesce(v_prev.result,jsonb_build_object('duplicate',true,'pending',true));
  end if;
  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_c.id then
    raise exception 'Not the active encounter turn';
  end if;
  if v_c.is_defeated or not v_c.action_available then
    raise exception 'Caster is defeated or Action is unavailable';
  end if;
  if exists (
    select 1 from public.encounter_conditions c
    where c.participant_id=v_c.id and c.condition_key in
      ('incapacitated','paralyzed','stunned','unconscious')
  ) then
    raise exception 'An active condition prevents the Cast action';
  end if;

  select * into v_assignment from public.character_spells
  where id=p_assignment_id and character_id=v_c.character_id;
  if not found or lower(coalesce(v_assignment.source_type,''))<>'class'
     or lower(coalesce(v_assignment.source_label,''))<>'warlock' then
    raise exception 'A canonical Warlock Eldritch Blast assignment is required';
  end if;
  select * into v_spell from public.spells_catalog where id=v_assignment.spell_id;
  if not found or lower(v_spell.spell_key)<>'eldritch-blast|xphb'
     or v_spell.source<>'XPHB' or v_spell.level<>0 then
    raise exception 'Only the canonical XPHB Eldritch Blast cantrip is supported';
  end if;
  v_profile:=public.encounter_spellcasting_profile_v1(v_c.id);
  if lower(coalesce(v_profile->>'className',''))<>'warlock'
     or lower(coalesce(v_profile->>'castingAbility',''))<>'cha'
     or not coalesce((v_profile->>'isClassCaster')::boolean,false) then
    raise exception 'Caster must have a canonical Charisma Warlock profile';
  end if;
  select cp.class_level into v_level
    from public.character_progression cp where cp.character_id=v_c.character_id;
  if v_level is null or v_level<1 or v_level>20 then
    raise exception 'Character level is not available for cantrip scaling';
  end if;
  -- Current DNDNext progression has one class level per character.
  -- Multiclass total-level support must be checked before general release.
  v_beams:=case when v_level>=17 then 4 when v_level>=11 then 3
                when v_level>=5 then 2 else 1 end;
  if v_targets<>v_beams then
    raise exception 'Eldritch Blast requires exactly % independently targeted beams at level %',
      v_beams,v_level using errcode='22023';
  end if;

  v_cha_score:=private.encounter_ability_score_v1(v_c.character_id,'cha');
  v_cha_mod:=floor((coalesce(v_cha_score,10)-10)/2.0)::integer;
  v_spell_bonus:=coalesce((v_profile->>'spellAttackBonus')::integer,0);
  -- One signed-off invocation with the *specific chosen cantrip*; no global
  -- bonus to all spells or trusting a client-provided damage modifier.
  select exists (
    select 1 from public.character_class_option_grant_instances grant_row
    join public.class_feature_option_catalog catalog
      on catalog.id=grant_row.option_catalog_id
    where grant_row.character_id=v_c.character_id
      and grant_row.option_type='eldritch-invocation'
      and lower(catalog.option_key)='optional-feature:agonizing-blast|xphb'
      and catalog.source='XPHB'
      and grant_row.acquired_level<=v_level
      and lower(coalesce(grant_row.choices#>>'{child,metadata,spellKey}',''))
           = 'eldritch-blast|xphb'
  ) into v_agonizing;

  -- Sort all referenced target locks once, before dealing any damage. Never
  -- touch the world/town map. Only existing encounter creatures are targets.
  for v_target_id in
    select distinct unnest(p_target_ids) order by 1
  loop
    select * into v_t from public.encounter_participants
      where id=v_target_id and encounter_id=v_e.id for update;
    if not found or v_t.is_defeated or v_target_id=v_c.id then
      raise exception 'Each beam must target another active encounter creature';
    end if;
    if v_t.is_hidden and v_t.controller_user_id is distinct from v_uid
       and not public.is_admin(v_uid) then
      raise exception 'Hidden target is not authorized' using errcode='42501';
    end if;
  end loop;

  insert into public.encounter_command_requests(
    request_id,encounter_id,participant_id,command_type,requested_by
  ) values(p_request_id,v_e.id,v_c.id,'spell_cast',v_uid)
  on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select * into v_prev from public.encounter_command_requests
      where request_id=p_request_id for update;
    if not found or v_prev.command_type<>'spell_cast'
       or v_prev.participant_id<>v_c.id or v_prev.requested_by is distinct from v_uid
       or lower(coalesce(v_prev.result->>'spellKey',''))<>'eldritch-blast|xphb'
       or coalesce(v_prev.result->>'assignmentId','')<>p_assignment_id::text
       or v_prev.result->'targetIds' is distinct from to_jsonb(p_target_ids)
    then
      raise exception 'Request id belongs to another command' using errcode='42501';
    end if;
    return coalesce(v_prev.result,jsonb_build_object('duplicate',true,'pending',true));
  end if;

  for v_i in 1..v_beams loop
    v_target_id:=p_target_ids[v_i];
    select * into v_t from public.encounter_participants where id=v_target_id;
    v_targeting:=public.encounter_targeting_context_internal_v1(v_c.id,v_target_id);
    if not coalesce((v_targeting->>'hasLineOfSight')::boolean,false)
       or coalesce((v_targeting->>'distanceFt')::integer,99999)>120 then
      raise exception 'Eldritch Blast target is out of range or behind total cover';
    end if;
    -- A visible, non-incapacitated enemy within 5 ft imposes disadvantage
    -- on any ranged attack roll, independent of the chosen target.
    v_base_disadvantage:=exists (
      select 1 from public.encounter_participants near
      where near.encounter_id=v_e.id and near.id<>v_c.id and not near.is_defeated
        and public.encounter_are_hostile_internal_v1(near.team,v_c.team)
        and greatest(abs(near.q-v_c.q),abs(near.r-v_c.r),
                     abs((near.q-v_c.q)+(near.r-v_c.r)))<=1
        and not exists (
          select 1 from public.encounter_conditions nc
          where nc.participant_id=near.id and nc.condition_key in
            ('incapacitated','paralyzed','stunned','unconscious')
        )
        and coalesce(
          (public.encounter_targeting_context_internal_v1(v_c.id,near.id)
            ->>'hasLineOfSight')::boolean,false)
    );
    v_roll_data:=private.encounter_resolve_attack_roll_v1(
      v_c.id,v_target_id,v_base_disadvantage
    );
    v_natural:=(v_roll_data->>'roll')::integer;
    v_total:=v_natural+v_spell_bonus;
    v_target_ac:=v_t.ac+coalesce((v_targeting->>'coverAcBonus')::integer,0);
    v_crit:=v_natural=20;
    v_hit:=v_crit or (v_natural<>1 and v_total>=v_target_ac);
    v_raw:=0;
    v_damage:=null;
    if v_hit then
      v_dice:=case when v_crit then 2 else 1 end;
      for v_die in 1..v_dice loop
        v_raw:=v_raw+floor(random()*10)::integer+1;
      end loop;
      if v_agonizing then v_raw:=greatest(0,v_raw+v_cha_mod); end if;
      v_damage:=public.encounter_apply_damage_internal_v1(v_target_id,v_raw,'force');
    end if;
    v_results:=v_results||jsonb_build_array(jsonb_build_object(
      'beam',v_i,'targetId',v_target_id,'targetName',v_t.display_name,
      'attackRoll',v_roll_data,'attackBonus',v_spell_bonus,'total',v_total,
      'targetAc',v_target_ac,'natural',v_natural,'hit',v_hit,'critical',v_crit,
      'rawDamage',v_raw,'damage',v_damage,'targeting',v_targeting,
      'agonizingBlastApplied',v_agonizing and v_hit,
      'agonizingBlastDamageModifier',case when v_agonizing and v_hit then v_cha_mod else 0 end
    ));
  end loop;
  update public.encounter_participants
  set action_available=false,updated_at=timezone('utc',now())
  where id=v_c.id;
  v_result:=jsonb_build_object(
    'requestId',p_request_id,'casterId',v_c.id,'assignmentId',v_assignment.id,
    'spellId',v_spell.id,'spellKey',v_spell.spell_key,'spell','Eldritch Blast',
    'targetIds',to_jsonb(p_target_ids),
    'actionType','action','slotLevel',null,'beamCount',v_beams,'beams',v_results,
    'characterLevel',v_level,'castingAbilityModifier',v_cha_mod,
    'agonizingBlastBoundToEldritchBlast',v_agonizing
  );
  insert into public.encounter_combat_log(
    encounter_id,round,turn_index,actor_participant_id,
    target_participant_id,event_type,summary,detail
  ) values(
    v_e.id,v_e.round,v_e.turn_index,v_c.id,p_target_ids[1],'spell_cast',
    v_c.display_name||' cast Eldritch Blast ('||v_beams||' beams).',v_result
  );
  update public.encounters set version=version+1,updated_at=timezone('utc',now())
    where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$candidate$;
-- Private schema not exposed through PostgREST; even privileged service
-- execution is intentionally withheld until a verified user-bound bridge.
revoke all on function private.encounter_eldritch_blast_candidate_v1(uuid,uuid,uuid[],uuid)
  from public,anon,authenticated,service_role;
