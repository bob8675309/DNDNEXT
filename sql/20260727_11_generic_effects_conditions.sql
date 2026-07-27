begin;

alter table public.encounter_participants
  add column if not exists max_hp integer check (max_hp is null or max_hp >= 0);

create or replace function private.guard_encounter_participant_max_hp_v1()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
as $function$
declare v_sheet jsonb; v_max integer;
begin
  if new.max_hp is null then
    select cs.sheet into v_sheet from public.character_sheets cs where cs.character_id=new.character_id;
    begin v_max:=coalesce(nullif(v_sheet->>'maxHp','')::integer,nullif(v_sheet->>'hp','')::integer,new.current_hp,1); exception when others then v_max:=coalesce(new.current_hp,1); end;
    new.max_hp:=greatest(0,coalesce(v_max,1));
  end if;
  if new.current_hp is not null and new.max_hp is not null and new.current_hp>new.max_hp then new.current_hp:=new.max_hp; end if;
  return new;
end;
$function$;

drop trigger if exists encounter_participant_max_hp_guard on public.encounter_participants;
create trigger encounter_participant_max_hp_guard
before insert or update of character_id,current_hp,max_hp on public.encounter_participants
for each row execute function private.guard_encounter_participant_max_hp_v1();

update public.encounter_participants p
set max_hp=coalesce(p.max_hp, x.max_hp, p.current_hp, 1)
from (
  select c.id as character_id,
    case when coalesce(cs.sheet->>'maxHp','') ~ '^[0-9]+$' then (cs.sheet->>'maxHp')::integer
         when coalesce(cs.sheet->>'hp','') ~ '^[0-9]+$' then (cs.sheet->>'hp')::integer
         else null end as max_hp
  from public.characters c left join public.character_sheets cs on cs.character_id=c.id
) x
where p.character_id=x.character_id and p.max_hp is null;

create table if not exists public.encounter_conditions (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  participant_id uuid not null references public.encounter_participants(id) on delete cascade,
  source_participant_id uuid references public.encounter_participants(id) on delete set null,
  condition_key text not null,
  remaining_target_turn_ends integer check (remaining_target_turn_ends is null or remaining_target_turn_ends > 0),
  metadata jsonb not null default '{}'::jsonb,
  applied_round integer not null default 0,
  applied_turn_index integer not null default 0,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  unique(participant_id,condition_key)
);
create index if not exists encounter_conditions_encounter_idx on public.encounter_conditions(encounter_id,participant_id);

alter table public.encounter_conditions enable row level security;
revoke all on public.encounter_conditions from public, anon, authenticated;
grant select on public.encounter_conditions to authenticated;
grant all on public.encounter_conditions to service_role;

drop policy if exists encounter_conditions_authenticated_read on public.encounter_conditions;
create policy encounter_conditions_authenticated_read on public.encounter_conditions
for select to authenticated using (
  public.is_admin(auth.uid())
  or public.encounter_can_control_participant_v1(participant_id)
  or exists(select 1 from public.encounter_participants p where p.id=participant_id and not p.is_hidden)
);

alter table public.encounter_conditions replica identity full;
do $realtime$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='encounter_conditions') then
    alter publication supabase_realtime add table public.encounter_conditions;
  end if;
end $realtime$;

create or replace function public.encounter_apply_healing_internal_v1(p_target_id uuid,p_amount integer)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare v_t public.encounter_participants%rowtype; v_before integer; v_after integer; v_max integer; v_applied integer;
begin
  if p_amount is null or p_amount<0 then raise exception 'Healing amount must be non-negative'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id for update;
  if not found then raise exception 'Healing target not found'; end if;
  v_before:=coalesce(v_t.current_hp,0); v_max:=greatest(v_before,coalesce(v_t.max_hp,v_before));
  v_after:=least(v_max,v_before+p_amount); v_applied:=greatest(0,v_after-v_before);
  update public.encounter_participants set current_hp=v_after,is_defeated=false,updated_at=timezone('utc',now()) where id=v_t.id;
  return jsonb_build_object('targetId',v_t.id,'requestedHealing',p_amount,'healing',v_applied,'targetHp',v_after,'maxHp',v_max);
end;
$function$;
revoke all on function public.encounter_apply_healing_internal_v1(uuid,integer) from public, anon, authenticated;
grant execute on function public.encounter_apply_healing_internal_v1(uuid,integer) to service_role;

create or replace function public.encounter_roll_save_internal_v1(
  p_participant_id uuid,p_ability text,p_dc integer,p_source_participant_id uuid default null
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_p public.encounter_participants%rowtype; v_profile jsonb; v_context jsonb:=null;
  v_cover integer:=0; v_roll integer; v_total integer;
begin
  if p_dc<1 or p_dc>40 then raise exception 'Save DC must be between 1 and 40'; end if;
  select * into v_p from public.encounter_participants where id=p_participant_id;
  if not found then raise exception 'Participant not found'; end if;
  v_profile:=public.encounter_saving_throw_profile_internal_v1(v_p.id,p_ability);
  if p_source_participant_id is not null then
    if not exists(select 1 from public.encounter_participants s where s.id=p_source_participant_id and s.encounter_id=v_p.encounter_id) then raise exception 'Save source is not in this encounter'; end if;
    v_context:=public.encounter_targeting_context_internal_v1(p_source_participant_id,v_p.id);
    if lower(p_ability)='dex' and coalesce((v_context->>'hasLineOfSight')::boolean,false) then v_cover:=coalesce((v_context->>'dexSaveCoverBonus')::integer,0); end if;
  end if;
  v_roll:=floor(random()*20)::integer+1;
  v_total:=v_roll+coalesce((v_profile->>'saveBonus')::integer,0)+v_cover;
  return jsonb_build_object('participantId',v_p.id,'ability',lower(p_ability),'dc',p_dc,'roll',v_roll,'saveBonus',(v_profile->>'saveBonus')::integer,'coverBonus',v_cover,'total',v_total,'success',v_total>=p_dc,'profile',v_profile,'sourceParticipantId',p_source_participant_id,'targeting',v_context);
end;
$function$;
revoke all on function public.encounter_roll_save_internal_v1(uuid,text,integer,uuid) from public, anon, authenticated;
grant execute on function public.encounter_roll_save_internal_v1(uuid,text,integer,uuid) to service_role;

create or replace function public.encounter_roll_save_v1(p_participant_id uuid,p_ability text,p_dc integer,p_request_id uuid,p_source_participant_id uuid default null)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid:=auth.uid(); v_role text:=coalesce(auth.role(),''); v_p public.encounter_participants%rowtype; v_e public.encounters%rowtype;
  v_existing public.encounter_command_requests%rowtype; v_inserted integer:=0; v_result jsonb;
begin
  if p_participant_id is null or p_request_id is null then raise exception 'Participant and request id are required'; end if;
  select * into v_p from public.encounter_participants where id=p_participant_id;
  if not found then raise exception 'Participant not found'; end if;
  select * into v_e from public.encounters where id=v_p.encounter_id;
  if not found or v_e.status not in ('active','paused') then raise exception 'Encounter is not available for saving throws'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_p.id) then raise exception 'Not authorized to roll this participant''s save'; end if;
  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  values(p_request_id,v_p.encounter_id,v_p.id,'save',v_uid) on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select * into v_existing from public.encounter_command_requests where request_id=p_request_id;
    if not found or v_existing.command_type<>'save' or v_existing.participant_id<>v_p.id then raise exception 'Request id is already used for another command'; end if;
    return coalesce(v_existing.result,jsonb_build_object('duplicate',true,'pending',true));
  end if;
  v_result:=public.encounter_roll_save_internal_v1(v_p.id,p_ability,p_dc,p_source_participant_id) || jsonb_build_object('requestId',p_request_id);
  insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
  values(v_e.id,v_e.round,v_e.turn_index,p_source_participant_id,v_p.id,'saving_throw',v_p.display_name||' rolled a '||upper(lower(p_ability))||' save: '||(v_result->>'total')||' vs DC '||p_dc||'.',v_result);
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

create or replace function public.encounter_apply_condition_internal_v1(
  p_target_id uuid,p_source_id uuid,p_condition_key text,p_duration_target_turns integer default null,p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_t public.encounter_participants%rowtype; v_s public.encounter_participants%rowtype; v_e public.encounters%rowtype;
  v_key text:=lower(btrim(coalesce(p_condition_key,''))); v_id uuid;
begin
  if v_key not in ('blinded','charmed','deafened','frightened','grappled','incapacitated','invisible','paralyzed','poisoned','prone','restrained','stunned','unconscious') then raise exception 'Unsupported condition'; end if;
  if p_duration_target_turns is not null and p_duration_target_turns<1 then raise exception 'Condition duration must be at least one target turn'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id;
  if not found then raise exception 'Condition target not found'; end if;
  if p_source_id is not null then
    select * into v_s from public.encounter_participants where id=p_source_id and encounter_id=v_t.encounter_id;
    if not found then raise exception 'Condition source is not in this encounter'; end if;
  end if;
  select * into v_e from public.encounters where id=v_t.encounter_id;
  insert into public.encounter_conditions(encounter_id,participant_id,source_participant_id,condition_key,remaining_target_turn_ends,metadata,applied_round,applied_turn_index,updated_at)
  values(v_t.encounter_id,v_t.id,p_source_id,v_key,p_duration_target_turns,coalesce(p_metadata,'{}'::jsonb),coalesce(v_e.round,0),coalesce(v_e.turn_index,0),timezone('utc',now()))
  on conflict(participant_id,condition_key) do update set source_participant_id=excluded.source_participant_id,remaining_target_turn_ends=excluded.remaining_target_turn_ends,metadata=excluded.metadata,applied_round=excluded.applied_round,applied_turn_index=excluded.applied_turn_index,updated_at=timezone('utc',now())
  returning id into v_id;
  return jsonb_build_object('conditionId',v_id,'targetId',v_t.id,'condition',v_key,'remainingTargetTurnEnds',p_duration_target_turns);
end;
$function$;
revoke all on function public.encounter_apply_condition_internal_v1(uuid,uuid,text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.encounter_apply_condition_internal_v1(uuid,uuid,text,integer,jsonb) to service_role;

create or replace function public.encounter_resolve_effect_internal_v1(p_source_id uuid,p_target_id uuid,p_effect jsonb)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_t public.encounter_participants%rowtype; v_s public.encounter_participants%rowtype;
  v_save_spec jsonb:=coalesce(p_effect->'save','{}'::jsonb); v_damage_spec jsonb:=coalesce(p_effect->'damage','{}'::jsonb);
  v_condition_spec jsonb:=coalesce(p_effect->'condition','{}'::jsonb); v_healing_spec jsonb:=coalesce(p_effect->'healing','{}'::jsonb);
  v_save jsonb:=null; v_damage jsonb:=null; v_healing jsonb:=null; v_condition jsonb:=null;
  v_save_success boolean:=false; v_on_success text:='none'; v_amount integer:=0; v_damage_type text:='untyped';
  v_condition_key text; v_duration integer; v_apply_condition boolean:=true;
begin
  if p_effect is null or jsonb_typeof(p_effect)<>'object' then raise exception 'Effect payload must be an object'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id for update;
  if not found then raise exception 'Effect target not found'; end if;
  if p_source_id is not null then select * into v_s from public.encounter_participants where id=p_source_id and encounter_id=v_t.encounter_id; if not found then raise exception 'Effect source is not in this encounter'; end if; end if;

  if jsonb_typeof(v_save_spec)='object' and v_save_spec ? 'ability' and v_save_spec ? 'dc' then
    v_save:=public.encounter_roll_save_internal_v1(v_t.id,v_save_spec->>'ability',(v_save_spec->>'dc')::integer,p_source_id);
    v_save_success:=coalesce((v_save->>'success')::boolean,false);
    v_on_success:=lower(coalesce(v_save_spec->>'onSuccess','none'));
    if v_on_success not in ('none','half','negate') then raise exception 'Save onSuccess must be none, half, or negate'; end if;
  end if;

  if jsonb_typeof(v_damage_spec)='object' and v_damage_spec ? 'amount' then
    v_amount:=greatest(0,(v_damage_spec->>'amount')::integer);
    v_damage_type:=lower(coalesce(v_damage_spec->>'type','untyped'));
    if v_save_success and v_on_success='half' then v_amount:=floor(v_amount/2.0)::integer; end if;
    if v_save_success and v_on_success='negate' then v_amount:=0; end if;
    v_damage:=public.encounter_apply_damage_internal_v1(v_t.id,v_amount,v_damage_type);
  end if;

  if jsonb_typeof(v_healing_spec)='object' and v_healing_spec ? 'amount' then
    v_healing:=public.encounter_apply_healing_internal_v1(v_t.id,greatest(0,(v_healing_spec->>'amount')::integer));
  end if;

  if jsonb_typeof(v_condition_spec)='object' and v_condition_spec ? 'key' then
    v_condition_key:=v_condition_spec->>'key';
    v_duration:=case when coalesce(v_condition_spec->>'durationTargetTurns','') ~ '^[0-9]+$' then (v_condition_spec->>'durationTargetTurns')::integer else null end;
    if v_save_success and v_on_success='negate' then v_apply_condition:=false; end if;
    if v_apply_condition then v_condition:=public.encounter_apply_condition_internal_v1(v_t.id,p_source_id,v_condition_key,v_duration,coalesce(v_condition_spec->'metadata','{}'::jsonb)); end if;
  end if;

  return jsonb_build_object('sourceParticipantId',p_source_id,'targetParticipantId',v_t.id,'save',v_save,'damage',v_damage,'healing',v_healing,'condition',v_condition,'effect',p_effect);
end;
$function$;
revoke all on function public.encounter_resolve_effect_internal_v1(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.encounter_resolve_effect_internal_v1(uuid,uuid,jsonb) to service_role;

create or replace function public.admin_apply_encounter_effect_v1(p_source_participant_id uuid,p_target_participant_id uuid,p_effect jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid:=auth.uid(); v_role text:=coalesce(auth.role(),''); v_t public.encounter_participants%rowtype; v_e public.encounters%rowtype;
  v_existing public.encounter_command_requests%rowtype; v_inserted integer:=0; v_result jsonb;
begin
  if v_role<>'service_role' and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Admin required'; end if;
  if p_target_participant_id is null or p_request_id is null then raise exception 'Target and request id are required'; end if;
  select * into v_t from public.encounter_participants where id=p_target_participant_id;
  if not found then raise exception 'Effect target not found'; end if;
  select * into v_e from public.encounters where id=v_t.encounter_id;
  if not found or v_e.status not in ('active','paused') then raise exception 'Encounter is not available for effects'; end if;
  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  values(p_request_id,v_e.id,v_t.id,'effect',v_uid) on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select * into v_existing from public.encounter_command_requests where request_id=p_request_id;
    if not found or v_existing.command_type<>'effect' or v_existing.participant_id<>v_t.id then raise exception 'Request id is already used for another command'; end if;
    return coalesce(v_existing.result,jsonb_build_object('duplicate',true,'pending',true));
  end if;
  v_result:=public.encounter_resolve_effect_internal_v1(p_source_participant_id,v_t.id,p_effect) || jsonb_build_object('requestId',p_request_id);
  insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
  values(v_e.id,v_e.round,v_e.turn_index,p_source_participant_id,v_t.id,'effect',coalesce((select display_name from public.encounter_participants where id=p_source_participant_id),'Encounter')||' applied an effect to '||v_t.display_name||'.',v_result);
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;
revoke all on function public.admin_apply_encounter_effect_v1(uuid,uuid,jsonb,uuid) from public, anon;
grant execute on function public.admin_apply_encounter_effect_v1(uuid,uuid,jsonb,uuid) to authenticated, service_role;

create or replace function public.admin_remove_encounter_condition_v1(p_condition_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare v_uid uuid:=auth.uid(); v_role text:=coalesce(auth.role(),'');
begin
  if v_role<>'service_role' and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Admin required'; end if;
  delete from public.encounter_conditions where id=p_condition_id;
end;
$function$;
revoke all on function public.admin_remove_encounter_condition_v1(uuid) from public, anon;
grant execute on function public.admin_remove_encounter_condition_v1(uuid) to authenticated, service_role;

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
  select public.encounter_canonical_speed_ft_v1(character_id) into v_next_speed from public.encounter_participants where id=v_next_id;
  update public.encounter_participants set disengaged=false,movement_bonus_ft=0,updated_at=timezone('utc',now()) where id=v_p.id;
  update public.encounter_participants set movement_spent_ft=0,movement_bonus_ft=0,action_available=true,bonus_action_available=true,reaction_available=true,disengaged=false,dodging=false,speed_ft=v_next_speed,turn_started_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=v_next_id;
  update public.encounters set active_participant_id=v_next_id,round=v_round,turn_index=v_next_pos-1,version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  v_result:=jsonb_build_object('requestId',p_request_id,'nextParticipantId',v_next_id,'round',v_round,'turnIndex',v_next_pos-1);
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

revoke all on function public.encounter_roll_save_v1(uuid,text,integer,uuid,uuid) from public, anon;
grant execute on function public.encounter_roll_save_v1(uuid,text,integer,uuid,uuid) to authenticated, service_role;

do $postconditions$
begin
  if has_table_privilege('authenticated','public.encounter_conditions','INSERT') then raise exception 'authenticated must not directly write conditions'; end if;
  if has_function_privilege('authenticated','public.encounter_resolve_effect_internal_v1(uuid,uuid,jsonb)','EXECUTE') then raise exception 'generic effect helper must remain private'; end if;
  if has_function_privilege('authenticated','public.encounter_roll_save_internal_v1(uuid,text,integer,uuid)','EXECUTE') then raise exception 'internal save helper must remain private'; end if;
  if not has_function_privilege('authenticated','public.admin_apply_encounter_effect_v1(uuid,uuid,jsonb,uuid)','EXECUTE') then raise exception 'guarded effect RPC missing'; end if;
end;
$postconditions$;

commit;