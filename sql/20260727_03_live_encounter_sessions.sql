begin;

create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.encounter_maps(id) on delete restrict,
  name text not null,
  status text not null default 'draft' check (status in ('draft','ready','initiative','active','paused','resolved','archived')),
  round integer not null default 0 check (round >= 0),
  turn_index integer not null default 0 check (turn_index >= 0),
  active_participant_id uuid,
  phase text not null default 'staging',
  gm_user_id uuid,
  settings jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  started_at timestamptz,
  resolved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.encounter_participants (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  character_id uuid references public.characters(id) on delete restrict,
  display_name text not null,
  team text not null default 'neutral' check (team in ('players','allies','enemies','neutral')),
  controller_user_id uuid,
  q integer not null default 0,
  r integer not null default 0,
  facing text not null default 'south' check (facing in ('north','northeast','east','southeast','south','southwest','west','northwest')),
  initiative numeric,
  initiative_tiebreaker numeric,
  current_hp integer,
  temp_hp integer not null default 0 check (temp_hp >= 0),
  movement_spent_ft integer not null default 0 check (movement_spent_ft >= 0),
  action_available boolean not null default true,
  bonus_action_available boolean not null default true,
  reaction_available boolean not null default true,
  is_hidden boolean not null default false,
  is_defeated boolean not null default false,
  sprite_asset_id uuid references public.npc_visual_assets(id) on delete set null,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint encounter_participant_character_name check (character_id is not null or length(btrim(display_name)) > 0)
);

create unique index encounter_participants_character_unique
  on public.encounter_participants(encounter_id, character_id)
  where character_id is not null;
create index encounter_participants_encounter_idx on public.encounter_participants(encounter_id);
create index encounter_participants_initiative_idx on public.encounter_participants(encounter_id, initiative desc nulls last, initiative_tiebreaker desc nulls last, created_at);
create index encounters_map_idx on public.encounters(map_id);
create index encounters_status_idx on public.encounters(status, updated_at desc);

alter table public.encounters
  add constraint encounters_active_participant_fk
  foreign key (active_participant_id) references public.encounter_participants(id) on delete set null;

alter table public.encounters enable row level security;
alter table public.encounter_participants enable row level security;
alter table public.encounters replica identity full;
alter table public.encounter_participants replica identity full;

revoke all on public.encounters from public, anon, authenticated;
revoke all on public.encounter_participants from public, anon, authenticated;
grant select on public.encounters to authenticated;
grant select on public.encounter_participants to authenticated;
grant all on public.encounters to service_role;
grant all on public.encounter_participants to service_role;

drop policy if exists encounters_authenticated_read on public.encounters;
create policy encounters_authenticated_read on public.encounters
for select to authenticated using (
  status <> 'archived' or public.is_admin(auth.uid())
);

drop policy if exists encounter_participants_authenticated_read on public.encounter_participants;
create policy encounter_participants_authenticated_read on public.encounter_participants
for select to authenticated using (
  not is_hidden
  or controller_user_id = auth.uid()
  or public.is_admin(auth.uid())
);

create or replace function public.admin_create_encounter_v1(
  p_map_id uuid,
  p_name text,
  p_settings jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_id uuid := gen_random_uuid();
begin
  if coalesce(auth.role(), '') <> 'service_role' and (v_uid is null or not public.is_admin(v_uid)) then
    raise exception 'Admin required';
  end if;
  if p_map_id is null or not exists(select 1 from public.encounter_maps where id = p_map_id and is_active) then
    raise exception 'Active encounter map not found';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'Encounter name is required'; end if;

  insert into public.encounters(id,map_id,name,gm_user_id,settings,created_by)
  values(v_id,p_map_id,btrim(p_name),v_uid,coalesce(p_settings,'{}'::jsonb),v_uid);
  return v_id;
end;
$function$;

create or replace function public.admin_set_encounter_status_v1(
  p_encounter_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_current text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Admin required'; end if;
  if p_status not in ('draft','ready','initiative','active','paused','resolved','archived') then raise exception 'Invalid encounter status'; end if;

  select status into v_current from public.encounters where id=p_encounter_id for update;
  if not found then raise exception 'Encounter not found'; end if;
  if v_current='archived' and p_status <> 'archived' then raise exception 'Archived encounters cannot be reopened'; end if;
  if p_status='active' and not exists(select 1 from public.encounter_participants where encounter_id=p_encounter_id) then raise exception 'Add at least one participant before activation'; end if;

  update public.encounters
  set status=p_status,
      phase=case p_status when 'draft' then 'staging' when 'ready' then 'staging' when 'initiative' then 'initiative' when 'active' then 'turns' when 'paused' then 'paused' when 'resolved' then 'resolved' else 'archived' end,
      round=case when p_status='active' and round=0 then 1 else round end,
      started_at=case when p_status='active' then coalesce(started_at,timezone('utc',now())) else started_at end,
      resolved_at=case when p_status='resolved' then timezone('utc',now()) when p_status not in ('resolved','archived') then null else resolved_at end,
      version=version+1,
      updated_at=timezone('utc',now())
  where id=p_encounter_id;
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
begin
  if coalesce(auth.role(), '') <> 'service_role' and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Admin required'; end if;
  if p_team not in ('players','allies','enemies','neutral') then raise exception 'Invalid participant team'; end if;
  select status into v_status from public.encounters where id=p_encounter_id for update;
  if not found then raise exception 'Encounter not found'; end if;
  if v_status not in ('draft','ready','initiative') then raise exception 'Participants can only be staged before active play'; end if;
  select * into v_character from public.characters where id=p_character_id;
  if not found then raise exception 'Character not found'; end if;
  if exists(select 1 from public.encounter_participants where encounter_id=p_encounter_id and character_id=p_character_id) then raise exception 'Character is already staged in this encounter'; end if;

  insert into public.encounter_participants(
    id,encounter_id,character_id,display_name,team,controller_user_id,q,r,sprite_asset_id,state
  ) values(
    v_id,p_encounter_id,p_character_id,v_character.name,p_team,p_controller_user_id,p_q,p_r,v_character.visual_asset_id,coalesce(p_state,'{}'::jsonb)
  );
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=p_encounter_id;
  return v_id;
end;
$function$;

create or replace function public.admin_update_encounter_participant_staging_v1(
  p_participant_id uuid,
  p_q integer default null,
  p_r integer default null,
  p_team text default null,
  p_controller_user_id uuid default null,
  p_initiative numeric default null,
  p_initiative_tiebreaker numeric default null,
  p_is_hidden boolean default null,
  p_state jsonb default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_encounter_id uuid;
  v_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Admin required'; end if;
  select p.encounter_id,e.status into v_encounter_id,v_status
  from public.encounter_participants p join public.encounters e on e.id=p.encounter_id
  where p.id=p_participant_id for update of p;
  if not found then raise exception 'Participant not found'; end if;
  if v_status not in ('draft','ready','initiative') then raise exception 'Staging changes are locked after active play begins'; end if;
  if p_team is not null and p_team not in ('players','allies','enemies','neutral') then raise exception 'Invalid participant team'; end if;

  update public.encounter_participants
  set q=coalesce(p_q,q), r=coalesce(p_r,r), team=coalesce(p_team,team),
      controller_user_id=p_controller_user_id,
      initiative=p_initiative, initiative_tiebreaker=p_initiative_tiebreaker,
      is_hidden=coalesce(p_is_hidden,is_hidden), state=coalesce(p_state,state),
      updated_at=timezone('utc',now())
  where id=p_participant_id;
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_encounter_id;
end;
$function$;

create or replace function public.admin_remove_encounter_participant_v1(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_encounter_id uuid;
  v_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Admin required'; end if;
  select p.encounter_id,e.status into v_encounter_id,v_status
  from public.encounter_participants p join public.encounters e on e.id=p.encounter_id
  where p.id=p_participant_id for update of p;
  if not found then return; end if;
  if v_status not in ('draft','ready','initiative') then raise exception 'Participants cannot be removed after active play begins'; end if;
  delete from public.encounter_participants where id=p_participant_id;
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_encounter_id;
end;
$function$;

create or replace function public.admin_set_encounter_turn_marker_v1(
  p_encounter_id uuid,
  p_participant_id uuid default null,
  p_round integer default null,
  p_turn_index integer default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare v_uid uuid := auth.uid();
begin
  if coalesce(auth.role(), '') <> 'service_role' and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Admin required'; end if;
  if not exists(select 1 from public.encounters where id=p_encounter_id) then raise exception 'Encounter not found'; end if;
  if p_participant_id is not null and not exists(select 1 from public.encounter_participants where id=p_participant_id and encounter_id=p_encounter_id) then raise exception 'Participant does not belong to encounter'; end if;
  if coalesce(p_round,0) < 0 or coalesce(p_turn_index,0) < 0 then raise exception 'Round and turn index must be nonnegative'; end if;
  update public.encounters
  set active_participant_id=p_participant_id,
      round=coalesce(p_round,round), turn_index=coalesce(p_turn_index,turn_index),
      version=version+1, updated_at=timezone('utc',now())
  where id=p_encounter_id;
end;
$function$;

revoke all on function public.admin_create_encounter_v1(uuid,text,jsonb) from public, anon;
revoke all on function public.admin_set_encounter_status_v1(uuid,text) from public, anon;
revoke all on function public.admin_add_encounter_participant_v1(uuid,uuid,text,integer,integer,uuid,jsonb) from public, anon;
revoke all on function public.admin_update_encounter_participant_staging_v1(uuid,integer,integer,text,uuid,numeric,numeric,boolean,jsonb) from public, anon;
revoke all on function public.admin_remove_encounter_participant_v1(uuid) from public, anon;
revoke all on function public.admin_set_encounter_turn_marker_v1(uuid,uuid,integer,integer) from public, anon;
grant execute on function public.admin_create_encounter_v1(uuid,text,jsonb) to authenticated, service_role;
grant execute on function public.admin_set_encounter_status_v1(uuid,text) to authenticated, service_role;
grant execute on function public.admin_add_encounter_participant_v1(uuid,uuid,text,integer,integer,uuid,jsonb) to authenticated, service_role;
grant execute on function public.admin_update_encounter_participant_staging_v1(uuid,integer,integer,text,uuid,numeric,numeric,boolean,jsonb) to authenticated, service_role;
grant execute on function public.admin_remove_encounter_participant_v1(uuid) to authenticated, service_role;
grant execute on function public.admin_set_encounter_turn_marker_v1(uuid,uuid,integer,integer) to authenticated, service_role;

do $realtime$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='encounters') then
      execute 'alter publication supabase_realtime add table public.encounters';
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='encounter_participants') then
      execute 'alter publication supabase_realtime add table public.encounter_participants';
    end if;
  end if;
end
$realtime$;

do $postconditions$
begin
  if has_table_privilege('anon','public.encounters','SELECT') then raise exception 'anon must not read encounters'; end if;
  if has_table_privilege('authenticated','public.encounters','INSERT') then raise exception 'authenticated must not directly insert encounters'; end if;
  if has_table_privilege('authenticated','public.encounter_participants','UPDATE') then raise exception 'authenticated must not directly update participants'; end if;
  if has_function_privilege('anon','public.admin_create_encounter_v1(uuid,text,jsonb)','EXECUTE') then raise exception 'anon must not invoke encounter admin RPCs'; end if;
  if not has_function_privilege('authenticated','public.admin_add_encounter_participant_v1(uuid,uuid,text,integer,integer,uuid,jsonb)','EXECUTE') then raise exception 'authenticated role must be able to invoke guarded participant staging RPC'; end if;
end
$postconditions$;

commit;
