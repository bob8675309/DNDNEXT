-- Phase 1P: source-turn-start timed tactical effects + reviewed XPHB Ray of Frost adapter.
-- Additive/versioned: v1-v7 remain available; v8 delegates all prior reviewed spells to v7.

alter table public.encounter_timed_effects
  add column if not exists expiry_trigger text not null default 'target_turn_start';

alter table public.encounter_timed_effects
  drop constraint if exists encounter_timed_effects_expiry_trigger_check;
alter table public.encounter_timed_effects
  add constraint encounter_timed_effects_expiry_trigger_check
  check (expiry_trigger in ('target_turn_start','source_turn_start'));

create index if not exists encounter_timed_effects_source_expiry_idx
  on public.encounter_timed_effects(encounter_id,source_participant_id,expiry_trigger)
  where source_participant_id is not null;

create or replace function private.encounter_apply_target_turn_start_effect_v1(
  p_target_id uuid,
  p_source_id uuid,
  p_effect_key text,
  p_target_turn_starts integer default 1,
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
  if p_target_id is null or v_key='' then raise exception 'Timed effect target and key are required'; end if;
  if p_target_turn_starts is null or p_target_turn_starts<1 then raise exception 'Timed effect duration must be at least one target turn start'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id;
  if not found then raise exception 'Timed effect target not found'; end if;
  if p_source_id is not null then
    select * into v_s from public.encounter_participants where id=p_source_id and encounter_id=v_t.encounter_id;
    if not found then raise exception 'Timed effect source is not in this encounter'; end if;
  end if;
  select * into v_e from public.encounters where id=v_t.encounter_id;
  if not found then raise exception 'Timed effect encounter not found'; end if;

  insert into public.encounter_timed_effects(
    encounter_id,participant_id,source_participant_id,effect_key,remaining_target_turn_starts,
    expiry_trigger,metadata,applied_round,applied_turn_index,updated_at
  ) values (
    v_t.encounter_id,v_t.id,p_source_id,v_key,p_target_turn_starts,
    'target_turn_start',coalesce(p_metadata,'{}'::jsonb),coalesce(v_e.round,0),coalesce(v_e.turn_index,0),timezone('utc',now())
  )
  on conflict(participant_id,effect_key) do update set
    source_participant_id=excluded.source_participant_id,
    remaining_target_turn_starts=excluded.remaining_target_turn_starts,
    expiry_trigger='target_turn_start',
    metadata=excluded.metadata,
    applied_round=excluded.applied_round,
    applied_turn_index=excluded.applied_turn_index,
    updated_at=timezone('utc',now())
  returning id into v_id;

  return jsonb_build_object(
    'effectId',v_id,'targetId',v_t.id,'sourceId',p_source_id,'effectKey',v_key,
    'expiryTrigger','target_turn_start','remainingTurnStarts',p_target_turn_starts
  );
end;
$function$;

revoke all on function private.encounter_apply_target_turn_start_effect_v1(uuid,uuid,text,integer,jsonb) from public, anon, authenticated;
grant execute on function private.encounter_apply_target_turn_start_effect_v1(uuid,uuid,text,integer,jsonb) to service_role;

create or replace function private.encounter_apply_source_turn_start_effect_v1(
  p_target_id uuid,
  p_source_id uuid,
  p_effect_key text,
  p_source_turn_starts integer default 1,
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
  if p_target_id is null or p_source_id is null or v_key='' then raise exception 'Source-turn timed effect target, source, and key are required'; end if;
  if p_source_turn_starts is null or p_source_turn_starts<1 then raise exception 'Timed effect duration must be at least one source turn start'; end if;
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
    v_t.encounter_id,v_t.id,v_s.id,v_key,p_source_turn_starts,
    'source_turn_start',coalesce(p_metadata,'{}'::jsonb),coalesce(v_e.round,0),coalesce(v_e.turn_index,0),timezone('utc',now())
  )
  on conflict(participant_id,effect_key) do update set
    source_participant_id=excluded.source_participant_id,
    remaining_target_turn_starts=excluded.remaining_target_turn_starts,
    expiry_trigger='source_turn_start',
    metadata=excluded.metadata,
    applied_round=excluded.applied_round,
    applied_turn_index=excluded.applied_turn_index,
    updated_at=timezone('utc',now())
  returning id into v_id;

  return jsonb_build_object(
    'effectId',v_id,'targetId',v_t.id,'sourceId',v_s.id,'effectKey',v_key,
    'expiryTrigger','source_turn_start','remainingTurnStarts',p_source_turn_starts
  );
end;
$function$;

revoke all on function private.encounter_apply_source_turn_start_effect_v1(uuid,uuid,text,integer,jsonb) from public, anon, authenticated;
grant execute on function private.encounter_apply_source_turn_start_effect_v1(uuid,uuid,text,integer,jsonb) to service_role;

create or replace function private.encounter_timed_speed_penalty_ft_v1(p_participant_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  select greatest(0,coalesce(max(
    case
      when coalesce(e.metadata->>'speedPenaltyFt','') ~ '^[0-9]+$' then (e.metadata->>'speedPenaltyFt')::integer
      else 0
    end
  ),0))::integer
  from public.encounter_timed_effects e
  where e.participant_id=p_participant_id
    and e.remaining_target_turn_starts>0;
$function$;

revoke all on function private.encounter_timed_speed_penalty_ft_v1(uuid) from public, anon, authenticated;
grant execute on function private.encounter_timed_speed_penalty_ft_v1(uuid) to service_role;

create or replace function private.expire_encounter_timed_effects_on_turn_start_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_fx public.encounter_timed_effects%rowtype;
  v_name text;
  v_speed integer;
begin
  if new.active_participant_id is null
     or new.active_participant_id is not distinct from old.active_participant_id then
    return new;
  end if;

  select display_name into v_name
  from public.encounter_participants
  where id=new.active_participant_id;

  for v_fx in
    select * from public.encounter_timed_effects
    where encounter_id=new.id
      and expiry_trigger='target_turn_start'
      and participant_id=new.active_participant_id
      and remaining_target_turn_starts=1
    for update
  loop
    insert into public.encounter_combat_log(
      encounter_id,round,turn_index,target_participant_id,event_type,summary,detail
    ) values (
      new.id,new.round,new.turn_index,new.active_participant_id,'effect_expired',
      initcap(replace(v_fx.effect_key,'_',' '))||' expired on '||coalesce(v_name,'participant')||' at target turn start.',
      jsonb_build_object('effectId',v_fx.id,'effectKey',v_fx.effect_key,'expiry','target_turn_start')
    );
    delete from public.encounter_timed_effects where id=v_fx.id;
  end loop;

  update public.encounter_timed_effects
  set remaining_target_turn_starts=remaining_target_turn_starts-1,
      updated_at=timezone('utc',now())
  where encounter_id=new.id
    and expiry_trigger='target_turn_start'
    and participant_id=new.active_participant_id
    and remaining_target_turn_starts>1;

  for v_fx in
    select * from public.encounter_timed_effects
    where encounter_id=new.id
      and expiry_trigger='source_turn_start'
      and source_participant_id=new.active_participant_id
      and remaining_target_turn_starts=1
    for update
  loop
    delete from public.encounter_timed_effects where id=v_fx.id;
    select greatest(0,public.encounter_canonical_speed_ft_v1(p.character_id)-private.encounter_timed_speed_penalty_ft_v1(p.id))
      into v_speed
      from public.encounter_participants p where p.id=v_fx.participant_id;
    update public.encounter_participants
      set speed_ft=v_speed,updated_at=timezone('utc',now())
      where id=v_fx.participant_id;
    insert into public.encounter_combat_log(
      encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail
    ) values (
      new.id,new.round,new.turn_index,new.active_participant_id,v_fx.participant_id,'effect_expired',
      initcap(replace(v_fx.effect_key,'_',' '))||' expired at the source participant''s turn start.',
      jsonb_build_object('effectId',v_fx.id,'effectKey',v_fx.effect_key,'expiry','source_turn_start','sourceParticipantId',new.active_participant_id)
    );
  end loop;

  update public.encounter_timed_effects
  set remaining_target_turn_starts=remaining_target_turn_starts-1,
      updated_at=timezone('utc',now())
  where encounter_id=new.id
    and expiry_trigger='source_turn_start'
    and source_participant_id=new.active_participant_id
    and remaining_target_turn_starts>1;

  return new;
end;
$function$;

revoke all on function private.expire_encounter_timed_effects_on_turn_start_v1() from public, anon, authenticated;

create or replace function public.encounter_move_active_participant_v1(p_participant_id uuid,p_path jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid:=auth.uid(); v_role text:=coalesce(auth.role(),'');
  v_participant public.encounter_participants%rowtype; v_encounter public.encounters%rowtype;
  v_radius integer; v_inserted integer:=0; v_existing public.encounter_command_requests%rowtype;
  v_step jsonb; v_q integer; v_r integer; v_prev_q integer; v_prev_r integer; v_dq integer; v_dr integer;
  v_multiplier numeric; v_step_cost integer; v_spent integer; v_speed integer; v_allowance integer; v_facing text;
  v_result jsonb; v_reactor record; v_reach integer; v_from_dist integer; v_to_dist integer; v_context jsonb;
  v_window_id uuid; v_prior_steps integer:=0;
begin
  if p_participant_id is null or p_request_id is null then raise exception 'Participant and request id are required'; end if;
  if jsonb_typeof(p_path)<>'array' or jsonb_array_length(p_path)=0 then raise exception 'Movement path must contain at least one hex'; end if;
  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
    select p_request_id,p.encounter_id,p.id,'move',v_uid from public.encounter_participants p where p.id=p_participant_id on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select * into v_existing from public.encounter_command_requests where request_id=p_request_id;
    if not found or v_existing.command_type<>'move' or v_existing.participant_id<>p_participant_id then raise exception 'Request id is already used for another command'; end if;
    return coalesce(v_existing.result,jsonb_build_object('duplicate',true,'pending',true));
  end if;
  select * into v_participant from public.encounter_participants where id=p_participant_id for update;
  if not found then raise exception 'Participant not found'; end if;
  select * into v_encounter from public.encounters where id=v_participant.encounter_id for update;
  if not found then raise exception 'Encounter not found'; end if;
  if v_encounter.status<>'active' or v_encounter.active_participant_id is distinct from v_participant.id then raise exception 'It is not this participant''s active turn'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_participant.id) then raise exception 'Not authorized to control this participant'; end if;
  if v_participant.is_defeated then raise exception 'Defeated participants cannot move'; end if;
  if exists(select 1 from public.encounter_reaction_windows w where w.encounter_id=v_encounter.id and w.mover_participant_id=v_participant.id and w.status='pending') then raise exception 'Resolve the pending reaction before continuing movement'; end if;

  select radius into v_radius from public.encounter_maps where id=v_encounter.map_id;
  v_speed:=greatest(0,public.encounter_canonical_speed_ft_v1(v_participant.character_id)-private.encounter_timed_speed_penalty_ft_v1(v_participant.id));
  v_allowance:=v_speed+coalesce(v_participant.movement_bonus_ft,0);
  v_spent:=coalesce(v_participant.movement_spent_ft,0);
  v_prev_q:=v_participant.q; v_prev_r:=v_participant.r;

  for v_step in select value from jsonb_array_elements(p_path) loop
    if coalesce(v_step->>'q','')!~'^-?[0-9]+$' or coalesce(v_step->>'r','')!~'^-?[0-9]+$' then raise exception 'Each path step must contain integer q and r'; end if;
    v_q:=(v_step->>'q')::integer; v_r:=(v_step->>'r')::integer;
    v_dq:=v_q-v_prev_q; v_dr:=v_r-v_prev_r;
    if greatest(abs(v_dq),abs(v_dr),abs(v_dq+v_dr))<>1 then raise exception 'Movement path must be contiguous'; end if;
    if greatest(abs(v_q),abs(v_r),abs(v_q+v_r))>v_radius then raise exception 'Movement leaves the encounter map'; end if;
    if exists(select 1 from public.encounter_hex_overrides h where h.map_id=v_encounter.map_id and h.q=v_q and h.r=v_r and h.terrain_type='blocked')
      or exists(select 1 from public.encounter_map_objects o where o.map_id=v_encounter.map_id and o.q=v_q and o.r=v_r and o.blocks_movement) then raise exception 'Movement path is blocked'; end if;
    if exists(select 1 from public.encounter_participants p where p.encounter_id=v_encounter.id and p.id<>v_participant.id and not p.is_defeated and p.q=v_q and p.r=v_r) then raise exception 'Movement path enters an occupied hex'; end if;
    select coalesce(h.movement_multiplier,1) into v_multiplier from public.encounter_hex_overrides h where h.map_id=v_encounter.map_id and h.q=v_q and h.r=v_r;
    v_step_cost:=ceil(5*coalesce(v_multiplier,1))::integer;
    if v_spent+v_step_cost>v_allowance then raise exception 'Movement exceeds remaining Speed'; end if;

    if not coalesce(v_participant.disengaged,false) then
      for v_reactor in
        select p.id,p.team,p.q,p.r,p.initiative,p.initiative_tiebreaker,p.created_at
        from public.encounter_participants p
        where p.encounter_id=v_encounter.id and p.id<>v_participant.id and not p.is_defeated and p.reaction_available
          and public.encounter_are_hostile_internal_v1(p.team,v_participant.team)
        order by p.initiative desc nulls last,p.initiative_tiebreaker desc nulls last,p.created_at,p.id
      loop
        v_reach:=public.encounter_threat_reach_ft_internal_v1(v_reactor.id);
        v_from_dist:=greatest(abs(v_prev_q-v_reactor.q),abs(v_prev_r-v_reactor.r),abs((v_prev_q-v_reactor.q)+(v_prev_r-v_reactor.r)))*5;
        v_to_dist:=greatest(abs(v_q-v_reactor.q),abs(v_r-v_reactor.r),abs((v_q-v_reactor.q)+(v_r-v_reactor.r)))*5;
        if v_reach>0 and v_from_dist<=v_reach and v_to_dist>v_reach then
          if exists(select 1 from public.encounter_reaction_windows w where w.encounter_id=v_encounter.id and w.mover_participant_id=v_participant.id and w.reactor_participant_id=v_reactor.id and w.round=v_encounter.round and w.turn_index=v_encounter.turn_index and w.from_q=v_prev_q and w.from_r=v_prev_r and w.to_q=v_q and w.to_r=v_r and w.status in ('resolved','cancelled')) then continue; end if;
          v_context:=public.encounter_targeting_context_internal_v1(v_reactor.id,v_participant.id);
          if not coalesce((v_context->>'hasLineOfSight')::boolean,false) then continue; end if;
          select id into v_window_id from public.encounter_reaction_windows w where w.encounter_id=v_encounter.id and w.mover_participant_id=v_participant.id and w.reactor_participant_id=v_reactor.id and w.round=v_encounter.round and w.turn_index=v_encounter.turn_index and w.from_q=v_prev_q and w.from_r=v_prev_r and w.to_q=v_q and w.to_r=v_r and w.status='pending' limit 1;
          if v_window_id is null then
            insert into public.encounter_reaction_windows(encounter_id,mover_participant_id,reactor_participant_id,round,turn_index,from_q,from_r,to_q,to_r)
            values(v_encounter.id,v_participant.id,v_reactor.id,v_encounter.round,v_encounter.turn_index,v_prev_q,v_prev_r,v_q,v_r)
            returning id into v_window_id;
          end if;
          update public.encounter_participants set q=v_prev_q,r=v_prev_r,facing=coalesce(v_facing,facing),movement_spent_ft=v_spent,speed_ft=v_speed,updated_at=timezone('utc',now()) where id=v_participant.id;
          update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_encounter.id;
          v_result:=jsonb_build_object('requestId',p_request_id,'participantId',v_participant.id,'q',v_prev_q,'r',v_prev_r,'speedFt',v_speed,'movementBonusFt',coalesce(v_participant.movement_bonus_ft,0),'movementSpentFt',v_spent,'remainingFt',greatest(0,v_allowance-v_spent),'partialMove',v_prior_steps>0,'reactionRequired',true,'reactionWindowId',v_window_id,'reactorParticipantId',v_reactor.id,'blockedStep',jsonb_build_object('q',v_q,'r',v_r));
          update public.encounter_command_requests set result=v_result where request_id=p_request_id;
          return v_result;
        end if;
      end loop;
    end if;

    v_spent:=v_spent+v_step_cost;
    v_facing:=case when v_dq=1 and v_dr=0 then 'east' when v_dq=1 and v_dr=-1 then 'northeast' when v_dq=0 and v_dr=-1 then 'northwest' when v_dq=-1 and v_dr=0 then 'west' when v_dq=-1 and v_dr=1 then 'southwest' when v_dq=0 and v_dr=1 then 'southeast' else v_participant.facing end;
    v_prev_q:=v_q; v_prev_r:=v_r; v_prior_steps:=v_prior_steps+1;
  end loop;
  update public.encounter_participants set q=v_prev_q,r=v_prev_r,facing=coalesce(v_facing,facing),movement_spent_ft=v_spent,speed_ft=v_speed,updated_at=timezone('utc',now()) where id=v_participant.id;
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_encounter.id;
  v_result:=jsonb_build_object('requestId',p_request_id,'participantId',v_participant.id,'q',v_prev_q,'r',v_prev_r,'speedFt',v_speed,'movementBonusFt',coalesce(v_participant.movement_bonus_ft,0),'movementSpentFt',v_spent,'remainingFt',greatest(0,v_allowance-v_spent),'reactionRequired',false);
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

create or replace function public.encounter_end_turn_v1(p_participant_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid:=auth.uid(); v_role text:=coalesce(auth.role(),''); v_p public.encounter_participants%rowtype; v_e public.encounters%rowtype;
  v_existing public.encounter_command_requests%rowtype; v_inserted integer:=0; v_current_pos integer; v_count integer; v_next_pos integer; v_next_id uuid; v_next_speed integer; v_round integer; v_result jsonb; v_c record;
begin
  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by) select p_request_id,p.encounter_id,p.id,'end_turn',v_uid from public.encounter_participants p where p.id=p_participant_id on conflict(request_id) do nothing; get diagnostics v_inserted=row_count;
  if v_inserted=0 then select * into v_existing from public.encounter_command_requests where request_id=p_request_id; if not found or v_existing.command_type<>'end_turn' then raise exception 'Request id is already used'; end if; return coalesce(v_existing.result,jsonb_build_object('duplicate',true)); end if;
  select * into v_p from public.encounter_participants where id=p_participant_id for update; if not found then raise exception 'Participant not found'; end if;
  select * into v_e from public.encounters where id=v_p.encounter_id for update;
  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_p.id then raise exception 'It is not this participant''s active turn'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_p.id) then raise exception 'Not authorized'; end if;
  if exists(select 1 from public.encounter_reaction_windows w where w.encounter_id=v_e.id and w.mover_participant_id=v_p.id and w.status='pending') then raise exception 'Resolve the pending reaction before ending the turn'; end if;

  for v_c in select * from public.encounter_conditions where participant_id=v_p.id and remaining_target_turn_ends=1 for update loop
    insert into public.encounter_combat_log(encounter_id,round,turn_index,target_participant_id,event_type,summary,detail)
    values(v_e.id,v_e.round,v_e.turn_index,v_p.id,'condition_expired',initcap(v_c.condition_key)||' expired on '||v_p.display_name||'.',jsonb_build_object('conditionId',v_c.id,'condition',v_c.condition_key));
    delete from public.encounter_conditions where id=v_c.id;
  end loop;
  update public.encounter_conditions set remaining_target_turn_ends=remaining_target_turn_ends-1,updated_at=timezone('utc',now()) where participant_id=v_p.id and remaining_target_turn_ends>1;

  with ordered as (select p.id,row_number() over(order by p.initiative desc nulls last,p.initiative_tiebreaker desc nulls last,p.created_at,p.id) rn,count(*) over() cnt from public.encounter_participants p where p.encounter_id=v_e.id and not p.is_defeated) select rn,cnt into v_current_pos,v_count from ordered where id=v_p.id;
  v_next_pos:=case when v_current_pos>=v_count then 1 else v_current_pos+1 end;
  with ordered as (select p.id,row_number() over(order by p.initiative desc nulls last,p.initiative_tiebreaker desc nulls last,p.created_at,p.id) rn from public.encounter_participants p where p.encounter_id=v_e.id and not p.is_defeated) select id into v_next_id from ordered where rn=v_next_pos;
  v_round:=case when v_next_pos=1 then greatest(1,v_e.round)+1 else greatest(1,v_e.round) end;
  select greatest(0,public.encounter_canonical_speed_ft_v1(character_id)-private.encounter_timed_speed_penalty_ft_v1(id)) into v_next_speed from public.encounter_participants where id=v_next_id;
  update public.encounter_participants set disengaged=false,movement_bonus_ft=0,updated_at=timezone('utc',now()) where id=v_p.id;
  update public.encounter_participants set movement_spent_ft=0,movement_bonus_ft=0,action_available=true,bonus_action_available=true,reaction_available=true,disengaged=false,dodging=false,speed_ft=v_next_speed,turn_started_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=v_next_id;
  update public.encounters set active_participant_id=v_next_id,round=v_round,turn_index=v_next_pos-1,version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  v_result:=jsonb_build_object('requestId',p_request_id,'nextParticipantId',v_next_id,'round',v_round,'turnIndex',v_next_pos-1,'nextSpeedFt',v_next_speed);
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

create or replace function public.encounter_cast_spell_v8(
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
  v_roll1 integer; v_roll2 integer; v_roll integer; v_total integer;
  v_target_ac integer;
  v_disadvantage boolean:=false;
  v_hit boolean:=false; v_crit boolean:=false;
  v_dice_count integer:=0; v_die_size integer:=8;
  v_damage_roll integer:=0; v_raw_damage integer:=0; v_i integer;
  v_speed_before integer; v_speed_after integer;
  v_result jsonb;
begin
  if p_caster_id is null or p_assignment_id is null or p_target_id is null or p_request_id is null then raise exception 'Caster, spell assignment, target, and request id are required'; end if;
  select * into v_c from public.encounter_participants where id=p_caster_id;
  if not found then raise exception 'Caster not found'; end if;
  select * into v_assignment from public.character_spells where id=p_assignment_id and character_id=v_c.character_id;
  if not found then raise exception 'Spell assignment is not in this character''s spellbook'; end if;
  select * into v_spell from public.spells_catalog where id=v_assignment.spell_id;
  if not found then raise exception 'Assigned spell definition not found'; end if;

  v_key:=lower(v_spell.spell_key);
  if v_key in (
    'fire-bolt|xphb','cure-wounds|xphb','sacred-flame|xphb','toll-the-dead|xphb',
    'poison-spray|xphb','false-life|xphb','inflict-wounds|xphb','shocking-grasp|xphb'
  ) then return public.encounter_cast_spell_v7(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id); end if;

  if v_key<>'ray-of-frost|xphb' then raise exception 'This spell remains GM-assisted; no automated tactical adapter is approved yet'; end if;
  if lower(coalesce(v_assignment.source_type,''))<>'class' then raise exception 'Only class spell assignments are automated in this casting slice'; end if;
  if v_spell.source<>'XPHB' then raise exception 'Only reviewed XPHB spell versions are automated in this casting slice'; end if;
  if v_spell.level<>0 then raise exception 'Ray of Frost must resolve from its reviewed cantrip definition'; end if;
  if p_slot_level is not null and p_slot_level<>0 then raise exception 'Cantrips do not use spell slots'; end if;
  if p_target_id=v_c.id then raise exception 'Ray of Frost requires another creature target'; end if;

  if exists(
    select 1 from public.encounter_timed_effects fx
    where fx.participant_id=p_target_id and fx.effect_key='ray_of_frost_speed_reduction'
      and fx.remaining_target_turn_starts>0 and fx.source_participant_id is distinct from p_caster_id
  ) then raise exception 'Overlapping Ray of Frost speed reductions from different casters remain GM-assisted'; end if;

  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  values(p_request_id,v_c.encounter_id,v_c.id,'spell_cast',v_uid) on conflict(request_id) do nothing;
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
  if exists(select 1 from public.encounter_conditions c where c.participant_id=v_c.id and c.condition_key in ('incapacitated','paralyzed','stunned','unconscious')) then raise exception 'Current conditions prevent this participant from taking the Cast action'; end if;

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
  if v_dist_ft>60 then raise exception 'Target is beyond Ray of Frost range'; end if;
  if exists(
    select 1 from public.encounter_participants p where p.encounter_id=v_c.encounter_id and p.id<>v_c.id and not p.is_defeated
      and public.encounter_are_hostile_internal_v1(v_c.team,p.team)
      and greatest(abs(p.q-v_c.q),abs(p.r-v_c.r),abs((p.q-v_c.q)+(p.r-v_c.r)))<=1
  ) then raise exception 'Close-quarters ranged spell attacks remain GM-assisted in this slice'; end if;
  if exists(select 1 from public.encounter_conditions c where c.participant_id in (v_c.id,v_t.id)) then raise exception 'Spell attacks with active conditions on caster or target remain GM-assisted in this slice'; end if;

  v_dice_count:=case when coalesce((v_profile->>'classLevel')::integer,1)>=17 then 4 when coalesce((v_profile->>'classLevel')::integer,1)>=11 then 3 when coalesce((v_profile->>'classLevel')::integer,1)>=5 then 2 else 1 end;
  v_disadvantage:=coalesce(v_t.dodging,false);
  v_roll1:=floor(random()*20)::integer+1; v_roll2:=floor(random()*20)::integer+1;
  v_roll:=case when v_disadvantage then least(v_roll1,v_roll2) else v_roll1 end;
  v_total:=v_roll+v_attack_bonus;
  v_target_ac:=coalesce(v_t.armor_class,10)+coalesce((v_targeting->>'coverAcBonus')::integer,0);
  v_crit:=v_roll=20;
  v_hit:=case when v_roll=1 then false when v_crit then true else v_total>=v_target_ac end;
  if v_crit then v_dice_count:=v_dice_count*2; end if;

  v_speed_before:=greatest(0,public.encounter_canonical_speed_ft_v1(v_t.character_id)-private.encounter_timed_speed_penalty_ft_v1(v_t.id));
  if v_hit then
    for v_i in 1..v_dice_count loop v_damage_roll:=v_damage_roll+floor(random()*v_die_size)::integer+1; end loop;
    v_raw_damage:=v_damage_roll;
    v_damage:=public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'cold');
    v_effect:=private.encounter_apply_source_turn_start_effect_v1(
      v_t.id,v_c.id,'ray_of_frost_speed_reduction',1,
      jsonb_build_object('spellKey',v_spell.spell_key,'spell',v_spell.name,'speedPenaltyFt',10)
    );
    v_speed_after:=greatest(0,public.encounter_canonical_speed_ft_v1(v_t.character_id)-private.encounter_timed_speed_penalty_ft_v1(v_t.id));
    update public.encounter_participants set speed_ft=v_speed_after,updated_at=timezone('utc',now()) where id=v_t.id;
  else
    v_speed_after:=v_speed_before;
    v_damage:=jsonb_build_object('targetId',v_t.id,'damageType','cold','rawDamage',0,'resistant',false,'immune',false,'vulnerable',false,'damage',0,'targetHp',v_t.current_hp,'targetTempHp',v_t.temp_hp,'defeated',v_t.is_defeated);
  end if;

  v_result:=jsonb_build_object(
    'requestId',p_request_id,'casterId',v_c.id,'targetId',v_t.id,'assignmentId',v_assignment.id,
    'spellId',v_spell.id,'spellKey',v_spell.spell_key,'spell',v_spell.name,'actionType','action','slotLevel',null,
    'distanceFt',v_dist_ft,'castingAbility',v_casting_ability,'castingAbilityModifier',v_cast_mod,'proficiencyBonus',v_prof,
    'attackBonus',v_attack_bonus,'roll',v_roll,'secondRoll',case when v_disadvantage then v_roll2 else null end,'disadvantage',v_disadvantage,
    'baseTargetAc',coalesce(v_t.armor_class,10),'coverAcBonus',coalesce((v_targeting->>'coverAcBonus')::integer,0),'targetAc',v_target_ac,
    'hit',v_hit,'critical',v_crit,'damageDice',v_dice_count::text||'d8','damageRoll',v_damage_roll,'damageType','cold','rawDamage',v_raw_damage,'damage',v_damage,
    'speedPenaltyFt',case when v_hit then 10 else 0 end,'targetSpeedBeforeFt',v_speed_before,'targetSpeedAfterFt',v_speed_after,
    'speedReductionUntil','source_next_turn_start','timedEffect',v_effect,'targeting',v_targeting
  );

  update public.encounter_participants set action_available=false,updated_at=timezone('utc',now()) where id=v_c.id;
  insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
  values(v_e.id,v_e.round,v_e.turn_index,v_c.id,v_t.id,'spell_cast',v_c.display_name||' cast Ray of Frost on '||v_t.display_name||case when v_hit then ' and reduced Speed by 10 feet until the caster''s next turn starts.' else ' and missed.' end,v_result);
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

revoke all on function public.encounter_cast_spell_v8(uuid,uuid,uuid,integer,uuid) from public, anon;
grant execute on function public.encounter_cast_spell_v8(uuid,uuid,uuid,integer,uuid) to authenticated, service_role;

do $postconditions$
begin
  if not has_function_privilege('authenticated','public.encounter_cast_spell_v8(uuid,uuid,uuid,integer,uuid)','EXECUTE') then raise exception 'guarded Ray of Frost cast RPC missing'; end if;
  if has_function_privilege('anon','public.encounter_cast_spell_v8(uuid,uuid,uuid,integer,uuid)','EXECUTE') then raise exception 'anon must not cast Ray of Frost'; end if;
  if to_regprocedure('public.encounter_cast_spell_v7(uuid,uuid,uuid,integer,uuid)') is null then raise exception 'Phase 1O cast RPC must remain available'; end if;
  if has_function_privilege('authenticated','private.encounter_apply_source_turn_start_effect_v1(uuid,uuid,text,integer,jsonb)','EXECUTE') then raise exception 'source-turn effect helper must remain private'; end if;
  if has_function_privilege('authenticated','private.encounter_timed_speed_penalty_ft_v1(uuid)','EXECUTE') then raise exception 'timed speed helper must remain private'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='encounter_timed_effects' and column_name='expiry_trigger') then raise exception 'timed effect expiry trigger column missing'; end if;
end
$postconditions$;
