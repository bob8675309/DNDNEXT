-- 2026-11-02 SELECT-only live pg_get_functiondef: encounter_are_hostile_internal_v1 md5 4c0b1321182f6a86425bdd03e1634102
CREATE OR REPLACE FUNCTION public.encounter_are_hostile_internal_v1(p_left_team text, p_right_team text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select case
    when lower(coalesce(p_left_team,''))='enemies' and lower(coalesce(p_right_team,'')) in ('players','allies') then true
    when lower(coalesce(p_right_team,''))='enemies' and lower(coalesce(p_left_team,'')) in ('players','allies') then true
    else false
  end;
$function$;

-- 2026-11-02 SELECT-only live pg_get_functiondef: encounter_end_turn_v1 md5 2785f688af8e200f64f18b6c421f19a6
CREATE OR REPLACE FUNCTION public.encounter_end_turn_v1(p_participant_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
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

  for v_c in select * from public.encounter_conditions where participant_id=v_p.id and remaining_target_turn_ends=1 for update loop
    insert into public.encounter_combat_log(encounter_id,round,turn_index,target_participant_id,event_type,summary,detail)
    values(v_e.id,v_e.round,v_e.turn_index,v_p.id,'condition_expired',initcap(v_c.condition_key)||' expired on '||v_p.display_name||'.',jsonb_build_object('conditionId',v_c.id,'condition',v_c.condition_key));
    delete from public.encounter_conditions where id=v_c.id;
  end loop;
  update public.encounter_conditions set remaining_target_turn_ends=remaining_target_turn_ends-1,updated_at=timezone('utc',now()) where participant_id=v_p.id and remaining_target_turn_ends>1;

  for v_fx in select * from public.encounter_timed_effects where encounter_id=v_e.id and expiry_trigger='target_turn_end' and participant_id=v_p.id and remaining_target_turn_starts=1 for update loop
    insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
    values(v_e.id,v_e.round,v_e.turn_index,v_fx.source_participant_id,v_p.id,'effect_expired',initcap(replace(v_fx.effect_key,'_',' '))||' expired at '||v_p.display_name||'''s turn end.',jsonb_build_object('effectId',v_fx.id,'effectKey',v_fx.effect_key,'expiry','target_turn_end','sourceParticipantId',v_fx.source_participant_id));
    delete from public.encounter_timed_effects where id=v_fx.id;
  end loop;
  update public.encounter_timed_effects set remaining_target_turn_starts=remaining_target_turn_starts-1,updated_at=timezone('utc',now()) where encounter_id=v_e.id and expiry_trigger='target_turn_end' and participant_id=v_p.id and remaining_target_turn_starts>1;

  for v_fx in select * from public.encounter_timed_effects where encounter_id=v_e.id and expiry_trigger='source_turn_end' and source_participant_id=v_p.id and remaining_target_turn_starts=1 for update loop
    insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
    values(v_e.id,v_e.round,v_e.turn_index,v_p.id,v_fx.participant_id,'effect_expired',initcap(replace(v_fx.effect_key,'_',' '))||' expired at '||v_p.display_name||'''s turn end.',jsonb_build_object('effectId',v_fx.id,'effectKey',v_fx.effect_key,'expiry','source_turn_end','sourceParticipantId',v_p.id));
    delete from public.encounter_timed_effects where id=v_fx.id;
  end loop;
  update public.encounter_timed_effects set remaining_target_turn_starts=remaining_target_turn_starts-1,updated_at=timezone('utc',now()) where encounter_id=v_e.id and expiry_trigger='source_turn_end' and source_participant_id=v_p.id and remaining_target_turn_starts>1;

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
  select greatest(0,public.encounter_canonical_speed_ft_v1(character_id)-private.encounter_timed_speed_penalty_ft_v1(id)) into v_next_speed from public.encounter_participants where id=v_next_id;

  update public.encounter_participants set disengaged=false,movement_bonus_ft=0,updated_at=timezone('utc',now()) where id=v_p.id;
  update public.encounter_participants set movement_spent_ft=0,movement_bonus_ft=0,action_available=true,bonus_action_available=true,reaction_available=true,disengaged=false,dodging=false,speed_ft=v_next_speed,turn_started_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=v_next_id;
  update public.encounters set active_participant_id=v_next_id,round=v_round,turn_index=v_next_pos-1,version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;

  v_result:=jsonb_build_object('requestId',p_request_id,'nextParticipantId',v_next_id,'round',v_round,'turnIndex',v_next_pos-1,'nextSpeedFt',v_next_speed);
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

-- 2026-11-02 SELECT-only live pg_get_functiondef: encounter_move_active_participant_v1 md5 1f7fc81b307800f70ab412872473aa14
CREATE OR REPLACE FUNCTION public.encounter_move_active_participant_v1(p_participant_id uuid, p_path jsonb, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_uid uuid:=auth.uid(); v_role text:=coalesce(auth.role(),''); v_participant public.encounter_participants%rowtype; v_encounter public.encounters%rowtype;
  v_radius integer; v_inserted integer:=0; v_existing public.encounter_command_requests%rowtype; v_step jsonb; v_q integer; v_r integer; v_prev_q integer; v_prev_r integer; v_dq integer; v_dr integer;
  v_multiplier numeric; v_step_cost integer; v_spent integer; v_speed integer; v_allowance integer; v_facing text; v_result jsonb; v_reactor record; v_reach integer; v_from_dist integer; v_to_dist integer; v_context jsonb; v_window_id uuid; v_prior_steps integer:=0;
begin
  if p_participant_id is null or p_request_id is null then raise exception 'Participant and request id are required'; end if;
  if jsonb_typeof(p_path)<>'array' or jsonb_array_length(p_path)=0 then raise exception 'Movement path must contain at least one hex'; end if;
  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by) select p_request_id,p.encounter_id,p.id,'move',v_uid from public.encounter_participants p where p.id=p_participant_id on conflict(request_id) do nothing; get diagnostics v_inserted=row_count;
  if v_inserted=0 then select * into v_existing from public.encounter_command_requests where request_id=p_request_id; if not found or v_existing.command_type<>'move' or v_existing.participant_id<>p_participant_id then raise exception 'Request id is already used for another command'; end if; return coalesce(v_existing.result,jsonb_build_object('duplicate',true,'pending',true)); end if;
  select * into v_participant from public.encounter_participants where id=p_participant_id for update; if not found then raise exception 'Participant not found'; end if;
  select * into v_encounter from public.encounters where id=v_participant.encounter_id for update; if not found then raise exception 'Encounter not found'; end if;
  if v_encounter.status<>'active' or v_encounter.active_participant_id is distinct from v_participant.id then raise exception 'It is not this participant''s active turn'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_participant.id) then raise exception 'Not authorized to control this participant'; end if;
  if v_participant.is_defeated then raise exception 'Defeated participants cannot move'; end if;
  if exists(select 1 from public.encounter_reaction_windows w where w.encounter_id=v_encounter.id and w.mover_participant_id=v_participant.id and w.status='pending') then raise exception 'Resolve the pending reaction before continuing movement'; end if;
  select radius into v_radius from public.encounter_maps where id=v_encounter.map_id;
  v_speed:=greatest(0,public.encounter_canonical_speed_ft_v1(v_participant.character_id)-private.encounter_timed_speed_penalty_ft_v1(v_participant.id));
  v_allowance:=v_speed+coalesce(v_participant.movement_bonus_ft,0); v_spent:=coalesce(v_participant.movement_spent_ft,0); v_prev_q:=v_participant.q; v_prev_r:=v_participant.r;
  for v_step in select value from jsonb_array_elements(p_path) loop
    if coalesce(v_step->>'q','')!~'^-?[0-9]+$' or coalesce(v_step->>'r','')!~'^-?[0-9]+$' then raise exception 'Each path step must contain integer q and r'; end if;
    v_q:=(v_step->>'q')::integer; v_r:=(v_step->>'r')::integer; v_dq:=v_q-v_prev_q; v_dr:=v_r-v_prev_r;
    if greatest(abs(v_dq),abs(v_dr),abs(v_dq+v_dr))<>1 then raise exception 'Movement path must be contiguous'; end if;
    if greatest(abs(v_q),abs(v_r),abs(v_q+v_r))>v_radius then raise exception 'Movement leaves the encounter map'; end if;
    if exists(select 1 from public.encounter_hex_overrides h where h.map_id=v_encounter.map_id and h.q=v_q and h.r=v_r and h.terrain_type='blocked') or exists(select 1 from public.encounter_map_objects o where o.map_id=v_encounter.map_id and o.q=v_q and o.r=v_r and o.blocks_movement) then raise exception 'Movement path is blocked'; end if;
    if exists(select 1 from public.encounter_participants p where p.encounter_id=v_encounter.id and p.id<>v_participant.id and not p.is_defeated and p.q=v_q and p.r=v_r) then raise exception 'Movement path enters an occupied hex'; end if;
    select coalesce(h.movement_multiplier,1) into v_multiplier from public.encounter_hex_overrides h where h.map_id=v_encounter.map_id and h.q=v_q and h.r=v_r;
    v_step_cost:=ceil(5*coalesce(v_multiplier,1))::integer; if v_spent+v_step_cost>v_allowance then raise exception 'Movement exceeds remaining Speed'; end if;
    if not coalesce(v_participant.disengaged,false) then
      for v_reactor in select p.id,p.team,p.q,p.r,p.initiative,p.initiative_tiebreaker,p.created_at from public.encounter_participants p where p.encounter_id=v_encounter.id and p.id<>v_participant.id and not p.is_defeated and p.reaction_available and public.encounter_are_hostile_internal_v1(p.team,v_participant.team) order by p.initiative desc nulls last,p.initiative_tiebreaker desc nulls last,p.created_at,p.id loop
        v_reach:=public.encounter_threat_reach_ft_internal_v1(v_reactor.id); v_from_dist:=greatest(abs(v_prev_q-v_reactor.q),abs(v_prev_r-v_reactor.r),abs((v_prev_q-v_reactor.q)+(v_prev_r-v_reactor.r)))*5; v_to_dist:=greatest(abs(v_q-v_reactor.q),abs(v_r-v_reactor.r),abs((v_q-v_reactor.q)+(v_r-v_reactor.r)))*5;
        if v_reach>0 and v_from_dist<=v_reach and v_to_dist>v_reach then
          if exists(select 1 from public.encounter_reaction_windows w where w.encounter_id=v_encounter.id and w.mover_participant_id=v_participant.id and w.reactor_participant_id=v_reactor.id and w.round=v_encounter.round and w.turn_index=v_encounter.turn_index and w.from_q=v_prev_q and w.from_r=v_prev_r and w.to_q=v_q and w.to_r=v_r and w.status in ('resolved','cancelled')) then continue; end if;
          v_context:=public.encounter_targeting_context_internal_v1(v_reactor.id,v_participant.id); if not coalesce((v_context->>'hasLineOfSight')::boolean,false) then continue; end if;
          select id into v_window_id from public.encounter_reaction_windows w where w.encounter_id=v_encounter.id and w.mover_participant_id=v_participant.id and w.reactor_participant_id=v_reactor.id and w.round=v_encounter.round and w.turn_index=v_encounter.turn_index and w.from_q=v_prev_q and w.from_r=v_prev_r and w.to_q=v_q and w.to_r=v_r and w.status='pending' limit 1;
          if v_window_id is null then insert into public.encounter_reaction_windows(encounter_id,mover_participant_id,reactor_participant_id,round,turn_index,from_q,from_r,to_q,to_r) values(v_encounter.id,v_participant.id,v_reactor.id,v_encounter.round,v_encounter.turn_index,v_prev_q,v_prev_r,v_q,v_r) returning id into v_window_id; end if;
          update public.encounter_participants set q=v_prev_q,r=v_prev_r,facing=coalesce(v_facing,facing),movement_spent_ft=v_spent,speed_ft=v_speed,updated_at=timezone('utc',now()) where id=v_participant.id;
          update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_encounter.id;
          v_result:=jsonb_build_object('requestId',p_request_id,'participantId',v_participant.id,'q',v_prev_q,'r',v_prev_r,'speedFt',v_speed,'movementBonusFt',coalesce(v_participant.movement_bonus_ft,0),'movementSpentFt',v_spent,'remainingFt',greatest(0,v_allowance-v_spent),'partialMove',v_prior_steps>0,'reactionRequired',true,'reactionWindowId',v_window_id,'reactorParticipantId',v_reactor.id,'blockedStep',jsonb_build_object('q',v_q,'r',v_r)); update public.encounter_command_requests set result=v_result where request_id=p_request_id; return v_result;
        end if;
      end loop;
    end if;
    v_spent:=v_spent+v_step_cost; v_facing:=case when v_dq=1 and v_dr=0 then 'east' when v_dq=1 and v_dr=-1 then 'northeast' when v_dq=0 and v_dr=-1 then 'northwest' when v_dq=-1 and v_dr=0 then 'west' when v_dq=-1 and v_dr=1 then 'southwest' when v_dq=0 and v_dr=1 then 'southeast' else v_participant.facing end; v_prev_q:=v_q; v_prev_r:=v_r; v_prior_steps:=v_prior_steps+1;
  end loop;
  update public.encounter_participants set q=v_prev_q,r=v_prev_r,facing=coalesce(v_facing,facing),movement_spent_ft=v_spent,speed_ft=v_speed,updated_at=timezone('utc',now()) where id=v_participant.id;
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_encounter.id;
  v_result:=jsonb_build_object('requestId',p_request_id,'participantId',v_participant.id,'q',v_prev_q,'r',v_prev_r,'speedFt',v_speed,'movementBonusFt',coalesce(v_participant.movement_bonus_ft,0),'movementSpentFt',v_spent,'remainingFt',greatest(0,v_allowance-v_spent),'reactionRequired',false); update public.encounter_command_requests set result=v_result where request_id=p_request_id; return v_result;
end;$function$;

-- 2026-11-02 SELECT-only live pg_get_functiondef: encounter_resolve_opportunity_reaction_v1 md5 70cbfda404644c1000a6541ce8bf9c30
CREATE OR REPLACE FUNCTION public.encounter_resolve_opportunity_reaction_v1(p_window_id uuid, p_choice text, p_inventory_item_id uuid DEFAULT NULL::uuid, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_uid uuid:=auth.uid(); v_role text:=coalesce(auth.role(),'');
  v_w public.encounter_reaction_windows%rowtype;
  v_r public.encounter_participants%rowtype;
  v_m public.encounter_participants%rowtype;
  v_e public.encounters%rowtype;
  v_existing public.encounter_command_requests%rowtype;
  v_inserted integer:=0;
  v_attack jsonb:=null; v_result jsonb;
begin
  if p_window_id is null or p_request_id is null then raise exception 'Reaction window and request id are required'; end if;
  if p_choice not in ('attack','pass') then raise exception 'Reaction choice must be attack or pass'; end if;
  select * into v_w from public.encounter_reaction_windows where id=p_window_id for update;
  if not found then raise exception 'Reaction window not found'; end if;
  if v_w.status<>'pending' then return coalesce(v_w.result,jsonb_build_object('windowId',v_w.id,'status',v_w.status,'choice',v_w.choice)); end if;
  select * into v_r from public.encounter_participants where id=v_w.reactor_participant_id for update;
  select * into v_m from public.encounter_participants where id=v_w.mover_participant_id for update;
  select * into v_e from public.encounters where id=v_w.encounter_id for update;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_r.id) then raise exception 'Not authorized to resolve this reaction'; end if;
  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_m.id then raise exception 'Reaction window is no longer on the active mover turn'; end if;
  if v_m.q<>v_w.from_q or v_m.r<>v_w.from_r then raise exception 'Reaction window is stale because the mover changed position'; end if;

  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  values(p_request_id,v_e.id,v_r.id,'reaction',v_uid) on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select * into v_existing from public.encounter_command_requests where request_id=p_request_id;
    if not found or v_existing.command_type<>'reaction' or v_existing.participant_id<>v_r.id then raise exception 'Request id is already used for another command'; end if;
    return coalesce(v_existing.result,jsonb_build_object('duplicate',true,'pending',true));
  end if;

  if p_choice='attack' then
    v_attack:=public.encounter_opportunity_attack_internal_v1(v_r.id,v_m.id,p_inventory_item_id);
  end if;
  v_result:=jsonb_build_object('requestId',p_request_id,'windowId',v_w.id,'choice',p_choice,'attack',v_attack,'reactionSpent',p_choice='attack');
  update public.encounter_reaction_windows set status='resolved',choice=p_choice,weapon_inventory_item_id=p_inventory_item_id,result=v_result,resolved_at=timezone('utc',now()) where id=v_w.id;
  insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
  values(v_e.id,v_e.round,v_e.turn_index,v_r.id,v_m.id,case when p_choice='attack' then 'opportunity_attack' else 'reaction_pass' end,
    case when p_choice='attack' then v_r.display_name||' used an opportunity attack against '||v_m.display_name||'.' else v_r.display_name||' passed an opportunity attack against '||v_m.display_name||'.' end,
    v_result);
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

-- 2026-11-02 SELECT-only live pg_get_functiondef: encounter_use_core_action_v1 md5 74a43a001247f5fa491b057c97ca4014
CREATE OR REPLACE FUNCTION public.encounter_use_core_action_v1(p_participant_id uuid, p_action text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare v_uid uuid:=auth.uid(); v_role text:=coalesce(auth.role(),''); v_p public.encounter_participants%rowtype; v_e public.encounters%rowtype; v_existing public.encounter_command_requests%rowtype; v_inserted integer:=0; v_result jsonb;
begin
  if p_participant_id is null or p_request_id is null then raise exception 'Participant and request id are required'; end if;
  if p_action not in ('dash','disengage','dodge') then raise exception 'Unsupported core action'; end if;
  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  select p_request_id,p.encounter_id,p.id,'core_action',v_uid from public.encounter_participants p where p.id=p_participant_id on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then select * into v_existing from public.encounter_command_requests where request_id=p_request_id; if not found or v_existing.command_type<>'core_action' or v_existing.participant_id<>p_participant_id then raise exception 'Request id is already used for another command'; end if; return coalesce(v_existing.result,jsonb_build_object('duplicate',true,'pending',true)); end if;
  select * into v_p from public.encounter_participants where id=p_participant_id for update; if not found then raise exception 'Participant not found'; end if;
  select * into v_e from public.encounters where id=v_p.encounter_id for update; if not found then raise exception 'Encounter not found'; end if;
  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_p.id then raise exception 'It is not this participant''s active turn'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_p.id) then raise exception 'Not authorized to control this participant'; end if;
  if v_p.is_defeated then raise exception 'Defeated participants cannot act'; end if;
  if not v_p.action_available then raise exception 'Action already spent'; end if;
  update public.encounter_participants set action_available=false,
    movement_bonus_ft=case when p_action='dash' then movement_bonus_ft+speed_ft else movement_bonus_ft end,
    disengaged=case when p_action='disengage' then true else disengaged end,
    dodging=case when p_action='dodge' then true else dodging end,
    updated_at=timezone('utc',now()) where id=v_p.id;
  insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,event_type,summary,detail)
  values(v_e.id,v_e.round,v_e.turn_index,v_p.id,'core_action',v_p.display_name||' used '||initcap(p_action)||'.',jsonb_build_object('action',p_action));
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  select jsonb_build_object('requestId',p_request_id,'action',p_action,'actionAvailable',action_available,'movementBonusFt',movement_bonus_ft,'disengaged',disengaged,'dodging',dodging) into v_result from public.encounter_participants where id=v_p.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;$function$;
