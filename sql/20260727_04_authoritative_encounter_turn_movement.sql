begin;

alter table public.encounter_participants
  add column if not exists speed_ft integer not null default 30 check (speed_ft > 0),
  add column if not exists turn_started_at timestamptz;

create table if not exists public.encounter_command_requests (
  request_id uuid primary key,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  participant_id uuid references public.encounter_participants(id) on delete cascade,
  command_type text not null check (command_type in ('move','end_turn')),
  requested_by uuid,
  result jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists encounter_command_requests_encounter_idx
  on public.encounter_command_requests(encounter_id, created_at desc);

alter table public.encounter_command_requests enable row level security;
revoke all on public.encounter_command_requests from public, anon, authenticated;
grant all on public.encounter_command_requests to service_role;

create or replace function public.encounter_can_control_participant_v1(p_participant_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_participant public.encounter_participants%rowtype;
begin
  if coalesce(auth.role(), '') = 'service_role' then return true; end if;
  if v_uid is null then return false; end if;
  if public.is_admin(v_uid) then return true; end if;
  select * into v_participant from public.encounter_participants where id=p_participant_id;
  if not found then return false; end if;
  if v_participant.controller_user_id = v_uid then return true; end if;
  if v_participant.character_id is not null and exists (
    select 1 from public.character_permissions cp
    where cp.character_id=v_participant.character_id and cp.user_id=v_uid and coalesce(cp.can_edit,false)
  ) then return true; end if;
  return false;
end;
$function$;

create or replace function public.encounter_canonical_speed_ft_v1(p_character_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_raw text;
  v_speed integer;
begin
  if p_character_id is null then return 30; end if;
  select cs.sheet->>'speed' into v_raw from public.character_sheets cs where cs.character_id=p_character_id;
  if coalesce(v_raw,'') ~ '^[0-9]+$' then
    v_speed := v_raw::integer;
    if v_speed > 0 then return v_speed; end if;
  end if;
  return 30;
end;
$function$;

create or replace function public.admin_add_encounter_participant_v1(
  p_encounter_id uuid,
  p_character_id uuid,
  p_team text default 'neutral',
  p_q integer default 0,
  p_r integer default 0,
  p_controller_user_id uuid default null,
  p_state jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_character public.characters%rowtype;
  v_id uuid := gen_random_uuid();
  v_speed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Admin required'; end if;
  if p_team not in ('players','allies','enemies','neutral') then raise exception 'Invalid participant team'; end if;
  select status into v_status from public.encounters where id=p_encounter_id for update;
  if not found then raise exception 'Encounter not found'; end if;
  if v_status not in ('draft','ready','initiative') then raise exception 'Participants can only be staged before active play'; end if;
  select * into v_character from public.characters where id=p_character_id;
  if not found then raise exception 'Character not found'; end if;
  if exists(select 1 from public.encounter_participants where encounter_id=p_encounter_id and character_id=p_character_id) then raise exception 'Character is already staged in this encounter'; end if;
  v_speed := public.encounter_canonical_speed_ft_v1(p_character_id);
  insert into public.encounter_participants(id,encounter_id,character_id,display_name,team,controller_user_id,q,r,sprite_asset_id,state,speed_ft)
  values(v_id,p_encounter_id,p_character_id,v_character.name,p_team,p_controller_user_id,p_q,p_r,v_character.visual_asset_id,coalesce(p_state,'{}'::jsonb),v_speed);
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=p_encounter_id;
  return v_id;
end;
$function$;

create or replace function public.encounter_move_active_participant_v1(p_participant_id uuid,p_path jsonb,p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_participant public.encounter_participants%rowtype;
  v_encounter public.encounters%rowtype;
  v_radius integer;
  v_inserted integer := 0;
  v_existing public.encounter_command_requests%rowtype;
  v_step jsonb;
  v_q integer; v_r integer; v_prev_q integer; v_prev_r integer; v_dq integer; v_dr integer;
  v_multiplier numeric; v_step_cost integer; v_spent integer; v_speed integer; v_facing text; v_result jsonb;
begin
  if p_participant_id is null or p_request_id is null then raise exception 'Participant and request id are required'; end if;
  if jsonb_typeof(p_path) <> 'array' or jsonb_array_length(p_path)=0 then raise exception 'Movement path must contain at least one hex'; end if;
  if jsonb_array_length(p_path)>64 then raise exception 'Movement path is too long'; end if;

  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  select p_request_id,p.encounter_id,p.id,'move',v_uid from public.encounter_participants p where p.id=p_participant_id
  on conflict(request_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=0 then
    select * into v_existing from public.encounter_command_requests where request_id=p_request_id for update;
    if not found or v_existing.command_type<>'move' or v_existing.participant_id<>p_participant_id then raise exception 'Request id is already used for another command'; end if;
    return coalesce(v_existing.result,jsonb_build_object('requestId',p_request_id,'duplicate',true,'pending',true));
  end if;

  select * into v_participant from public.encounter_participants where id=p_participant_id for update;
  if not found then raise exception 'Participant not found'; end if;
  select * into v_encounter from public.encounters where id=v_participant.encounter_id for update;
  if not found then raise exception 'Encounter not found'; end if;
  if v_encounter.status<>'active' then raise exception 'Encounter is not active'; end if;
  if v_encounter.active_participant_id is distinct from v_participant.id then raise exception 'It is not this participant''s turn'; end if;
  if v_participant.is_defeated then raise exception 'Defeated participants cannot move'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_participant.id) then raise exception 'Not authorized to control this participant'; end if;
  select radius into v_radius from public.encounter_maps where id=v_encounter.map_id;
  if v_radius is null then raise exception 'Encounter map not found'; end if;

  v_speed := public.encounter_canonical_speed_ft_v1(v_participant.character_id);
  v_spent := coalesce(v_participant.movement_spent_ft,0);
  v_prev_q := v_participant.q; v_prev_r := v_participant.r;
  for v_step in select value from jsonb_array_elements(p_path) loop
    if jsonb_typeof(v_step)<>'object' or not (v_step ? 'q') or not (v_step ? 'r') or coalesce(v_step->>'q','') !~ '^-?[0-9]+$' or coalesce(v_step->>'r','') !~ '^-?[0-9]+$' then raise exception 'Each path step must contain integer q and r'; end if;
    v_q := (v_step->>'q')::integer; v_r := (v_step->>'r')::integer; v_dq := v_q-v_prev_q; v_dr := v_r-v_prev_r;
    if greatest(abs(v_dq),abs(v_dr),abs(v_dq+v_dr))<>1 then raise exception 'Movement path must be contiguous'; end if;
    if greatest(abs(v_q),abs(v_r),abs(v_q+v_r))>v_radius then raise exception 'Movement leaves the encounter map'; end if;
    if exists(select 1 from public.encounter_hex_overrides h where h.map_id=v_encounter.map_id and h.q=v_q and h.r=v_r and h.terrain_type='blocked') then raise exception 'Movement path enters blocked terrain'; end if;
    if exists(select 1 from public.encounter_map_objects o where o.map_id=v_encounter.map_id and o.q=v_q and o.r=v_r and o.blocks_movement) then raise exception 'Movement path is blocked by a map object'; end if;
    if exists(select 1 from public.encounter_participants p where p.encounter_id=v_encounter.id and p.id<>v_participant.id and not p.is_defeated and p.q=v_q and p.r=v_r) then raise exception 'Movement path enters an occupied hex'; end if;
    select coalesce(h.movement_multiplier,1) into v_multiplier from public.encounter_hex_overrides h where h.map_id=v_encounter.map_id and h.q=v_q and h.r=v_r;
    v_multiplier := coalesce(v_multiplier,1); v_step_cost := ceil(5*v_multiplier)::integer;
    if v_spent+v_step_cost>v_speed then raise exception 'Movement exceeds remaining Speed'; end if;
    v_spent := v_spent+v_step_cost;
    v_facing := case when v_dq=1 and v_dr=0 then 'east' when v_dq=1 and v_dr=-1 then 'northeast' when v_dq=0 and v_dr=-1 then 'northwest' when v_dq=-1 and v_dr=0 then 'west' when v_dq=-1 and v_dr=1 then 'southwest' when v_dq=0 and v_dr=1 then 'southeast' else v_participant.facing end;
    v_prev_q:=v_q; v_prev_r:=v_r;
  end loop;

  update public.encounter_participants set q=v_prev_q,r=v_prev_r,facing=coalesce(v_facing,facing),movement_spent_ft=v_spent,speed_ft=v_speed,updated_at=timezone('utc',now()) where id=v_participant.id;
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_encounter.id;
  v_result := jsonb_build_object('requestId',p_request_id,'duplicate',false,'participantId',v_participant.id,'q',v_prev_q,'r',v_prev_r,'speedFt',v_speed,'movementSpentFt',v_spent,'remainingFt',greatest(0,v_speed-v_spent));
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

create or replace function public.encounter_end_turn_v1(p_participant_id uuid,p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid := auth.uid(); v_role text := coalesce(auth.role(),''); v_participant public.encounter_participants%rowtype; v_encounter public.encounters%rowtype;
  v_inserted integer:=0; v_existing public.encounter_command_requests%rowtype; v_current_pos integer; v_count integer; v_next_pos integer; v_next_id uuid; v_next_speed integer; v_round integer; v_result jsonb;
begin
  if p_participant_id is null or p_request_id is null then raise exception 'Participant and request id are required'; end if;
  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  select p_request_id,p.encounter_id,p.id,'end_turn',v_uid from public.encounter_participants p where p.id=p_participant_id on conflict(request_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=0 then
    select * into v_existing from public.encounter_command_requests where request_id=p_request_id for update;
    if not found or v_existing.command_type<>'end_turn' or v_existing.participant_id<>p_participant_id then raise exception 'Request id is already used for another command'; end if;
    return coalesce(v_existing.result,jsonb_build_object('requestId',p_request_id,'duplicate',true,'pending',true));
  end if;
  select * into v_participant from public.encounter_participants where id=p_participant_id for update;
  if not found then raise exception 'Participant not found'; end if;
  select * into v_encounter from public.encounters where id=v_participant.encounter_id for update;
  if not found then raise exception 'Encounter not found'; end if;
  if v_encounter.status<>'active' then raise exception 'Encounter is not active'; end if;
  if v_encounter.active_participant_id is distinct from v_participant.id then raise exception 'It is not this participant''s turn'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_participant.id) then raise exception 'Not authorized to control this participant'; end if;

  with ordered as (
    select p.id,row_number() over(order by p.initiative desc nulls last,p.initiative_tiebreaker desc nulls last,p.created_at,p.id) rn,count(*) over() cnt
    from public.encounter_participants p where p.encounter_id=v_encounter.id and not p.is_defeated
  ) select rn,cnt into v_current_pos,v_count from ordered where id=v_participant.id;
  if v_current_pos is null or v_count=0 then raise exception 'No eligible turn order'; end if;
  v_next_pos := case when v_current_pos>=v_count then 1 else v_current_pos+1 end;
  with ordered as (
    select p.id,row_number() over(order by p.initiative desc nulls last,p.initiative_tiebreaker desc nulls last,p.created_at,p.id) rn
    from public.encounter_participants p where p.encounter_id=v_encounter.id and not p.is_defeated
  ) select id into v_next_id from ordered where rn=v_next_pos;
  if v_next_id is null then raise exception 'Could not resolve next participant'; end if;
  v_round := case when v_next_pos=1 then greatest(1,v_encounter.round)+1 else greatest(1,v_encounter.round) end;
  select public.encounter_canonical_speed_ft_v1(character_id) into v_next_speed from public.encounter_participants where id=v_next_id;
  update public.encounter_participants set movement_spent_ft=0,action_available=true,bonus_action_available=true,reaction_available=true,speed_ft=coalesce(v_next_speed,30),turn_started_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=v_next_id;
  update public.encounters set active_participant_id=v_next_id,round=v_round,turn_index=case when v_next_pos=1 then 0 else v_encounter.turn_index+1 end,version=version+1,updated_at=timezone('utc',now()) where id=v_encounter.id;
  v_result := jsonb_build_object('requestId',p_request_id,'duplicate',false,'endedParticipantId',v_participant.id,'activeParticipantId',v_next_id,'round',v_round,'turnIndex',case when v_next_pos=1 then 0 else v_encounter.turn_index+1 end);
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

revoke all on function public.encounter_can_control_participant_v1(uuid) from public, anon;
revoke all on function public.encounter_canonical_speed_ft_v1(uuid) from public, anon;
revoke all on function public.encounter_move_active_participant_v1(uuid,jsonb,uuid) from public, anon;
revoke all on function public.encounter_end_turn_v1(uuid,uuid) from public, anon;
grant execute on function public.encounter_can_control_participant_v1(uuid) to authenticated, service_role;
grant execute on function public.encounter_canonical_speed_ft_v1(uuid) to authenticated, service_role;
grant execute on function public.encounter_move_active_participant_v1(uuid,jsonb,uuid) to authenticated, service_role;
grant execute on function public.encounter_end_turn_v1(uuid,uuid) to authenticated, service_role;

do $postconditions$
begin
  if has_table_privilege('authenticated','public.encounter_command_requests','SELECT') then raise exception 'command request ledger must not be directly readable by authenticated'; end if;
  if has_function_privilege('anon','public.encounter_move_active_participant_v1(uuid,jsonb,uuid)','EXECUTE') then raise exception 'anon must not move encounter participants'; end if;
  if not has_function_privilege('authenticated','public.encounter_move_active_participant_v1(uuid,jsonb,uuid)','EXECUTE') then raise exception 'authenticated must invoke guarded movement RPC'; end if;
  if not has_function_privilege('authenticated','public.encounter_end_turn_v1(uuid,uuid)','EXECUTE') then raise exception 'authenticated must invoke guarded end-turn RPC'; end if;
end
$postconditions$;

commit;