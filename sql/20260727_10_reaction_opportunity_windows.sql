begin;

alter table public.encounter_command_requests
  drop constraint if exists encounter_command_requests_command_type_check;
alter table public.encounter_command_requests
  add constraint encounter_command_requests_command_type_check
  check (command_type in ('move','end_turn','core_action','attack','weapon_attack','save','reaction','effect'));

create table if not exists public.encounter_reaction_windows (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  mover_participant_id uuid not null references public.encounter_participants(id) on delete cascade,
  reactor_participant_id uuid not null references public.encounter_participants(id) on delete cascade,
  trigger_type text not null default 'opportunity_attack' check (trigger_type in ('opportunity_attack')),
  round integer not null,
  turn_index integer not null,
  from_q integer not null,
  from_r integer not null,
  to_q integer not null,
  to_r integer not null,
  status text not null default 'pending' check (status in ('pending','resolved','cancelled')),
  choice text check (choice in ('attack','pass','cancelled')),
  weapon_inventory_item_id uuid,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc',now()),
  resolved_at timestamptz
);
create index if not exists encounter_reaction_windows_encounter_status_idx on public.encounter_reaction_windows(encounter_id,status,created_at);
create index if not exists encounter_reaction_windows_reactor_idx on public.encounter_reaction_windows(reactor_participant_id,status);
create unique index if not exists encounter_reaction_windows_pending_edge_uidx
  on public.encounter_reaction_windows(encounter_id,mover_participant_id,reactor_participant_id,round,turn_index,from_q,from_r,to_q,to_r)
  where status='pending';

alter table public.encounter_reaction_windows enable row level security;
revoke all on public.encounter_reaction_windows from public, anon, authenticated;
grant select on public.encounter_reaction_windows to authenticated;
grant all on public.encounter_reaction_windows to service_role;

drop policy if exists encounter_reaction_windows_read on public.encounter_reaction_windows;
create policy encounter_reaction_windows_read on public.encounter_reaction_windows
for select to authenticated using (
  public.is_admin(auth.uid())
  or public.encounter_can_control_participant_v1(mover_participant_id)
  or public.encounter_can_control_participant_v1(reactor_participant_id)
);

alter table public.encounter_reaction_windows replica identity full;
do $realtime$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='encounter_reaction_windows'
  ) then
    alter publication supabase_realtime add table public.encounter_reaction_windows;
  end if;
end $realtime$;

create or replace function public.encounter_are_hostile_internal_v1(p_left_team text,p_right_team text)
returns boolean language sql immutable
set search_path = pg_catalog, public
as $function$
  select case
    when lower(coalesce(p_left_team,''))='enemies' and lower(coalesce(p_right_team,'')) in ('players','allies') then true
    when lower(coalesce(p_right_team,''))='enemies' and lower(coalesce(p_left_team,'')) in ('players','allies') then true
    else false
  end;
$function$;
revoke all on function public.encounter_are_hostile_internal_v1(text,text) from public, anon, authenticated;
grant execute on function public.encounter_are_hostile_internal_v1(text,text) to service_role;

create or replace function public.encounter_threat_reach_ft_internal_v1(p_participant_id uuid)
returns integer
language plpgsql stable security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_p public.encounter_participants%rowtype;
  v_row record;
  v_profile jsonb;
  v_reach integer:=5;
begin
  select * into v_p from public.encounter_participants where id=p_participant_id;
  if not found or v_p.is_defeated then return 0; end if;
  for v_row in
    select distinct i.id
    from public.inventory_items i
    where i.is_equipped and (
      (i.owner_id=v_p.character_id::text and lower(coalesce(i.owner_type,'')) in ('npc','merchant','character'))
      or (lower(coalesce(i.owner_type,''))='player' and exists(
        select 1 from public.character_permissions cp
        where cp.character_id=v_p.character_id and cp.can_edit and i.owner_id=cp.user_id::text
      ))
    )
  loop
    v_profile:=public.encounter_weapon_profile_internal_v1(v_p.id,v_row.id);
    if v_profile is not null and not coalesce((v_profile->>'isRanged')::boolean,false) then
      v_reach:=greatest(v_reach,coalesce((v_profile->>'reachFt')::integer,5));
    end if;
  end loop;
  return v_reach;
end;
$function$;
revoke all on function public.encounter_threat_reach_ft_internal_v1(uuid) from public, anon, authenticated;
grant execute on function public.encounter_threat_reach_ft_internal_v1(uuid) to service_role;

create or replace function public.encounter_opportunity_attack_internal_v1(
  p_reactor_id uuid,p_mover_id uuid,p_inventory_item_id uuid default null
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_r public.encounter_participants%rowtype;
  v_m public.encounter_participants%rowtype;
  v_profile jsonb;
  v_context jsonb;
  v_snapshot jsonb;
  v_dist_ft integer;
  v_reach integer:=5;
  v_attack_bonus integer:=0;
  v_ability_mod integer:=0;
  v_magic_bonus integer:=0;
  v_dice_count integer:=1;
  v_die_size integer:=1;
  v_damage_type text:='bludgeoning';
  v_weapon text:='Unarmed Strike';
  v_roll1 integer; v_roll2 integer; v_roll integer; v_total integer;
  v_hit boolean; v_crit boolean; v_disadvantage boolean:=false;
  v_i integer; v_damage_roll integer:=0; v_raw_damage integer:=0;
  v_damage jsonb; v_target_ac integer; v_result jsonb;
begin
  select * into v_r from public.encounter_participants where id=p_reactor_id for update;
  if not found then raise exception 'Reaction attacker not found'; end if;
  select * into v_m from public.encounter_participants where id=p_mover_id and encounter_id=v_r.encounter_id for update;
  if not found then raise exception 'Reaction target not found'; end if;
  if v_r.is_defeated then raise exception 'Defeated participant cannot react'; end if;
  if v_m.is_defeated then raise exception 'Target is already defeated'; end if;
  if not v_r.reaction_available then raise exception 'Reaction already spent'; end if;
  if not public.encounter_are_hostile_internal_v1(v_r.team,v_m.team) then raise exception 'Opportunity attack requires hostile participants'; end if;

  v_context:=public.encounter_targeting_context_internal_v1(v_r.id,v_m.id);
  if not coalesce((v_context->>'hasLineOfSight')::boolean,false) then raise exception 'Opportunity attack requires line of sight'; end if;
  v_dist_ft:=coalesce((v_context->>'distanceFt')::integer,9999);

  if p_inventory_item_id is not null then
    v_profile:=public.encounter_weapon_profile_internal_v1(v_r.id,p_inventory_item_id);
    if v_profile is null then raise exception 'Selected opportunity weapon is not equipped or unsupported'; end if;
    if coalesce((v_profile->>'isRanged')::boolean,false) then raise exception 'Opportunity attacks require a melee weapon or Unarmed Strike'; end if;
    v_reach:=coalesce((v_profile->>'reachFt')::integer,5);
    if v_dist_ft>v_reach then raise exception 'Target is beyond the selected weapon reach'; end if;
    v_weapon:=coalesce(v_profile->>'name','Weapon');
    v_attack_bonus:=coalesce((v_profile->>'attackBonus')::integer,0);
    v_ability_mod:=coalesce((v_profile->>'abilityMod')::integer,0);
    v_magic_bonus:=coalesce((v_profile->>'magicBonus')::integer,0);
    v_damage_type:=coalesce(v_profile->>'damageType','untyped');
    v_dice_count:=split_part(v_profile->>'damageDice','d',1)::integer;
    v_die_size:=split_part(v_profile->>'damageDice','d',2)::integer;
  else
    if v_dist_ft>5 then raise exception 'Unarmed Strike opportunity attack requires 5-foot reach'; end if;
    v_snapshot:=public.encounter_canonical_combat_snapshot_v1(v_r.character_id);
    v_ability_mod:=floor((coalesce((v_snapshot->>'str')::integer,10)-10)/2.0)::integer;
    v_attack_bonus:=v_ability_mod+coalesce((v_snapshot->>'prof')::integer,2);
  end if;

  v_target_ac:=coalesce(v_m.armor_class,10)+coalesce((v_context->>'coverAcBonus')::integer,0);
  v_disadvantage:=coalesce(v_m.dodging,false);
  v_roll1:=floor(random()*20)::integer+1;
  v_roll2:=floor(random()*20)::integer+1;
  v_roll:=case when v_disadvantage then least(v_roll1,v_roll2) else v_roll1 end;
  v_total:=v_roll+v_attack_bonus;
  v_crit:=v_roll=20;
  v_hit:=case when v_roll=1 then false when v_crit then true else v_total>=v_target_ac end;
  if v_hit then
    if p_inventory_item_id is null then
      v_raw_damage:=greatest(0,1+v_ability_mod);
    else
      if v_crit then v_dice_count:=v_dice_count*2; end if;
      for v_i in 1..v_dice_count loop v_damage_roll:=v_damage_roll+floor(random()*v_die_size)::integer+1; end loop;
      v_raw_damage:=greatest(0,v_damage_roll+v_ability_mod+v_magic_bonus);
    end if;
  end if;
  v_damage:=public.encounter_apply_damage_internal_v1(v_m.id,v_raw_damage,v_damage_type);
  update public.encounter_participants set reaction_available=false,updated_at=timezone('utc',now()) where id=v_r.id;
  v_result:=jsonb_build_object(
    'reactorId',v_r.id,'moverId',v_m.id,'weapon',v_weapon,'inventoryItemId',p_inventory_item_id,
    'distanceFt',v_dist_ft,'roll',v_roll,'secondRoll',case when v_disadvantage then v_roll2 else null end,
    'disadvantage',v_disadvantage,'attackBonus',v_attack_bonus,'total',v_total,'targetAc',v_target_ac,
    'hit',v_hit,'critical',v_crit,'rawDamage',v_raw_damage,'damageType',v_damage_type,'damage',v_damage
  );
  return v_result;
end;
$function$;
revoke all on function public.encounter_opportunity_attack_internal_v1(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.encounter_opportunity_attack_internal_v1(uuid,uuid,uuid) to service_role;

create or replace function public.encounter_resolve_opportunity_reaction_v1(
  p_window_id uuid,p_choice text,p_inventory_item_id uuid default null,p_request_id uuid default null
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, private, auth
as $function$
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
revoke all on function public.encounter_resolve_opportunity_reaction_v1(uuid,text,uuid,uuid) from public, anon;
grant execute on function public.encounter_resolve_opportunity_reaction_v1(uuid,text,uuid,uuid) to authenticated, service_role;

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
  v_speed:=public.encounter_canonical_speed_ft_v1(v_participant.character_id);
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
          if exists(select 1 from public.encounter_reaction_windows w where w.encounter_id=v_encounter.id and w.mover_participant_id=v_participant.id and w.reactor_participant_id=v_reactor.id and w.round=v_encounter.round and w.turn_index=v_encounter.turn_index and w.from_q=v_prev_q and w.from_r=v_prev_r and w.to_q=v_q and w.to_r=v_r and w.status in ('resolved','cancelled')) then
            continue;
          end if;
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
declare v_uid uuid:=auth.uid(); v_role text:=coalesce(auth.role(),''); v_p public.encounter_participants%rowtype; v_e public.encounters%rowtype; v_existing public.encounter_command_requests%rowtype; v_inserted integer:=0; v_current_pos integer; v_count integer; v_next_pos integer; v_next_id uuid; v_next_speed integer; v_round integer; v_result jsonb;
begin
  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by) select p_request_id,p.encounter_id,p.id,'end_turn',v_uid from public.encounter_participants p where p.id=p_participant_id on conflict(request_id) do nothing; get diagnostics v_inserted=row_count;
  if v_inserted=0 then select * into v_existing from public.encounter_command_requests where request_id=p_request_id; if not found or v_existing.command_type<>'end_turn' then raise exception 'Request id is already used'; end if; return coalesce(v_existing.result,jsonb_build_object('duplicate',true)); end if;
  select * into v_p from public.encounter_participants where id=p_participant_id for update; if not found then raise exception 'Participant not found'; end if;
  select * into v_e from public.encounters where id=v_p.encounter_id for update;
  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_p.id then raise exception 'It is not this participant''s active turn'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_p.id) then raise exception 'Not authorized'; end if;
  if exists(select 1 from public.encounter_reaction_windows w where w.encounter_id=v_e.id and w.mover_participant_id=v_p.id and w.status='pending') then raise exception 'Resolve the pending reaction before ending the turn'; end if;
  with ordered as (select p.id,row_number() over(order by p.initiative desc nulls last,p.initiative_tiebreaker desc nulls last,p.created_at,p.id) rn,count(*) over() cnt from public.encounter_participants p where p.encounter_id=v_e.id and not p.is_defeated) select rn,cnt into v_current_pos,v_count from ordered where id=v_p.id;
  v_next_pos:=case when v_current_pos>=v_count then 1 else v_current_pos+1 end;
  with ordered as (select p.id,row_number() over(order by p.initiative desc nulls last,p.initiative_tiebreaker desc nulls last,p.created_at,p.id) rn from public.encounter_participants p where p.encounter_id=v_e.id and not p.is_defeated) select id into v_next_id from ordered where rn=v_next_pos;
  v_round:=case when v_next_pos=1 then greatest(1,v_e.round)+1 else greatest(1,v_e.round) end;
  select public.encounter_canonical_speed_ft_v1(character_id) into v_next_speed from public.encounter_participants where id=v_next_id;
  update public.encounter_participants set disengaged=false,movement_bonus_ft=0,updated_at=timezone('utc',now()) where id=v_p.id;
  update public.encounter_participants set movement_spent_ft=0,movement_bonus_ft=0,action_available=true,bonus_action_available=true,reaction_available=true,disengaged=false,dodging=false,speed_ft=v_next_speed,turn_started_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=v_next_id;
  update public.encounters set active_participant_id=v_next_id,round=v_round,turn_index=v_next_pos-1,version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  v_result:=jsonb_build_object('requestId',p_request_id,'nextParticipantId',v_next_id,'round',v_round,'turnIndex',v_next_pos-1);
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

revoke all on function public.encounter_move_active_participant_v1(uuid,jsonb,uuid) from public, anon;
revoke all on function public.encounter_end_turn_v1(uuid,uuid) from public, anon;
grant execute on function public.encounter_move_active_participant_v1(uuid,jsonb,uuid) to authenticated, service_role;
grant execute on function public.encounter_end_turn_v1(uuid,uuid) to authenticated, service_role;

do $postconditions$
begin
  if has_table_privilege('authenticated','public.encounter_reaction_windows','INSERT') then raise exception 'authenticated must not directly create reaction windows'; end if;
  if not has_function_privilege('authenticated','public.encounter_resolve_opportunity_reaction_v1(uuid,text,uuid,uuid)','EXECUTE') then raise exception 'reaction resolution RPC missing'; end if;
  if has_function_privilege('anon','public.encounter_resolve_opportunity_reaction_v1(uuid,text,uuid,uuid)','EXECUTE') then raise exception 'anon must not resolve reactions'; end if;
  if has_function_privilege('authenticated','public.encounter_threat_reach_ft_internal_v1(uuid)','EXECUTE') then raise exception 'threat helper must remain private'; end if;
end;
$postconditions$;

commit;