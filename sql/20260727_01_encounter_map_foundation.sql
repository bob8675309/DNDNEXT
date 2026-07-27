begin;

create table if not exists public.encounter_maps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_bucket text,
  image_path text,
  hex_orientation text not null default 'pointy' check (hex_orientation in ('pointy')),
  hex_size integer not null default 38 check (hex_size between 18 and 120),
  radius integer not null default 5 check (radius between 2 and 30),
  origin_x numeric not null default 0,
  origin_y numeric not null default 0,
  width_hexes integer,
  height_hexes integer,
  default_environment jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.encounter_hex_overrides (
  map_id uuid not null references public.encounter_maps(id) on delete cascade,
  q integer not null,
  r integer not null,
  terrain_type text not null default 'normal' check (terrain_type in ('normal','difficult','blocked')),
  movement_multiplier numeric not null default 1 check (movement_multiplier >= 1),
  elevation integer not null default 0,
  hazard_key text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (map_id, q, r)
);

create table if not exists public.encounter_map_objects (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.encounter_maps(id) on delete cascade,
  object_type text not null,
  q integer not null,
  r integer not null,
  footprint jsonb not null default '[]'::jsonb,
  blocks_movement boolean not null default false,
  blocks_los boolean not null default false,
  cover_level text not null default 'none' check (cover_level in ('none','half','three_quarters','total')),
  hidden_by_default boolean not null default false,
  interaction_type text,
  state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists encounter_map_objects_map_idx on public.encounter_map_objects(map_id);
create index if not exists encounter_map_objects_hex_idx on public.encounter_map_objects(map_id, q, r);
create index if not exists encounter_hex_overrides_map_idx on public.encounter_hex_overrides(map_id);

alter table public.encounter_maps enable row level security;
alter table public.encounter_hex_overrides enable row level security;
alter table public.encounter_map_objects enable row level security;

revoke all on public.encounter_maps from public, anon;
revoke all on public.encounter_hex_overrides from public, anon;
revoke all on public.encounter_map_objects from public, anon;
grant select on public.encounter_maps to authenticated, service_role;
grant select on public.encounter_hex_overrides to authenticated, service_role;
grant select on public.encounter_map_objects to authenticated, service_role;
grant all on public.encounter_maps to service_role;
grant all on public.encounter_hex_overrides to service_role;
grant all on public.encounter_map_objects to service_role;

drop policy if exists encounter_maps_authenticated_read on public.encounter_maps;
create policy encounter_maps_authenticated_read on public.encounter_maps
for select to authenticated using (is_active = true or public.is_admin(auth.uid()));

drop policy if exists encounter_hex_authenticated_read on public.encounter_hex_overrides;
create policy encounter_hex_authenticated_read on public.encounter_hex_overrides
for select to authenticated using (
  exists (
    select 1 from public.encounter_maps m
    where m.id = map_id and (m.is_active = true or public.is_admin(auth.uid()))
  )
);

drop policy if exists encounter_objects_authenticated_read on public.encounter_map_objects;
create policy encounter_objects_authenticated_read on public.encounter_map_objects
for select to authenticated using (
  exists (
    select 1 from public.encounter_maps m
    where m.id = map_id and (m.is_active = true or public.is_admin(auth.uid()))
  )
);

create or replace function public.admin_upsert_encounter_map_v1(
  p_map_id uuid default null,
  p_name text default null,
  p_description text default null,
  p_hex_size integer default 38,
  p_radius integer default 5,
  p_image_bucket text default null,
  p_image_path text default null,
  p_is_active boolean default true,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_id uuid := coalesce(p_map_id, gen_random_uuid());
begin
  if coalesce(auth.role(), '') <> 'service_role' and (v_uid is null or not public.is_admin(v_uid)) then
    raise exception 'Admin required';
  end if;
  if nullif(btrim(coalesce(p_name,'')), '') is null then raise exception 'Map name is required'; end if;
  if p_hex_size not between 18 and 120 then raise exception 'Hex size out of range'; end if;
  if p_radius not between 2 and 30 then raise exception 'Map radius out of range'; end if;

  insert into public.encounter_maps (
    id,name,description,image_bucket,image_path,hex_size,radius,metadata,is_active,created_by,updated_at
  ) values (
    v_id,btrim(p_name),nullif(btrim(coalesce(p_description,'')),''),nullif(btrim(coalesce(p_image_bucket,'')),''),nullif(btrim(coalesce(p_image_path,'')),''),p_hex_size,p_radius,coalesce(p_metadata,'{}'::jsonb),coalesce(p_is_active,true),v_uid,timezone('utc',now())
  )
  on conflict (id) do update set
    name=excluded.name,
    description=excluded.description,
    image_bucket=excluded.image_bucket,
    image_path=excluded.image_path,
    hex_size=excluded.hex_size,
    radius=excluded.radius,
    metadata=excluded.metadata,
    is_active=excluded.is_active,
    updated_at=timezone('utc',now());

  return v_id;
end;
$function$;

create or replace function public.admin_set_encounter_hex_v1(
  p_map_id uuid,
  p_q integer,
  p_r integer,
  p_terrain_type text default 'normal',
  p_movement_multiplier numeric default 1,
  p_elevation integer default 0,
  p_hazard_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare v_uid uuid := auth.uid();
begin
  if coalesce(auth.role(), '') <> 'service_role' and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Admin required'; end if;
  if not exists (select 1 from public.encounter_maps where id=p_map_id) then raise exception 'Encounter map not found'; end if;
  if p_terrain_type not in ('normal','difficult','blocked') then raise exception 'Invalid terrain type'; end if;
  if coalesce(p_movement_multiplier,1) < 1 then raise exception 'Movement multiplier must be at least 1'; end if;

  if p_terrain_type='normal' and coalesce(p_movement_multiplier,1)=1 and coalesce(p_elevation,0)=0 and nullif(btrim(coalesce(p_hazard_key,'')),'') is null and coalesce(p_metadata,'{}'::jsonb)='{}'::jsonb then
    delete from public.encounter_hex_overrides where map_id=p_map_id and q=p_q and r=p_r;
    return;
  end if;

  insert into public.encounter_hex_overrides(map_id,q,r,terrain_type,movement_multiplier,elevation,hazard_key,metadata,updated_at)
  values(p_map_id,p_q,p_r,p_terrain_type,coalesce(p_movement_multiplier,1),coalesce(p_elevation,0),nullif(btrim(coalesce(p_hazard_key,'')),''),coalesce(p_metadata,'{}'::jsonb),timezone('utc',now()))
  on conflict(map_id,q,r) do update set
    terrain_type=excluded.terrain_type,
    movement_multiplier=excluded.movement_multiplier,
    elevation=excluded.elevation,
    hazard_key=excluded.hazard_key,
    metadata=excluded.metadata,
    updated_at=timezone('utc',now());
end;
$function$;

create or replace function public.admin_upsert_encounter_map_object_v1(
  p_object_id uuid default null,
  p_map_id uuid default null,
  p_object_type text default null,
  p_q integer default 0,
  p_r integer default 0,
  p_blocks_movement boolean default false,
  p_blocks_los boolean default false,
  p_cover_level text default 'none',
  p_hidden_by_default boolean default false,
  p_interaction_type text default null,
  p_state jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_id uuid := coalesce(p_object_id, gen_random_uuid());
begin
  if coalesce(auth.role(), '') <> 'service_role' and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Admin required'; end if;
  if p_map_id is null or not exists (select 1 from public.encounter_maps where id=p_map_id) then raise exception 'Encounter map not found'; end if;
  if nullif(btrim(coalesce(p_object_type,'')),'') is null then raise exception 'Object type is required'; end if;
  if p_cover_level not in ('none','half','three_quarters','total') then raise exception 'Invalid cover level'; end if;

  insert into public.encounter_map_objects(id,map_id,object_type,q,r,blocks_movement,blocks_los,cover_level,hidden_by_default,interaction_type,state,metadata,updated_at)
  values(v_id,p_map_id,btrim(p_object_type),p_q,p_r,coalesce(p_blocks_movement,false),coalesce(p_blocks_los,false),p_cover_level,coalesce(p_hidden_by_default,false),nullif(btrim(coalesce(p_interaction_type,'')),''),coalesce(p_state,'{}'::jsonb),coalesce(p_metadata,'{}'::jsonb),timezone('utc',now()))
  on conflict(id) do update set
    map_id=excluded.map_id,
    object_type=excluded.object_type,
    q=excluded.q,
    r=excluded.r,
    blocks_movement=excluded.blocks_movement,
    blocks_los=excluded.blocks_los,
    cover_level=excluded.cover_level,
    hidden_by_default=excluded.hidden_by_default,
    interaction_type=excluded.interaction_type,
    state=excluded.state,
    metadata=excluded.metadata,
    updated_at=timezone('utc',now());
  return v_id;
end;
$function$;

create or replace function public.admin_delete_encounter_map_object_v1(p_object_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare v_uid uuid := auth.uid();
begin
  if coalesce(auth.role(), '') <> 'service_role' and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Admin required'; end if;
  delete from public.encounter_map_objects where id=p_object_id;
end;
$function$;

revoke all on function public.admin_upsert_encounter_map_v1(uuid,text,text,integer,integer,text,text,boolean,jsonb) from public, anon;
revoke all on function public.admin_set_encounter_hex_v1(uuid,integer,integer,text,numeric,integer,text,jsonb) from public, anon;
revoke all on function public.admin_upsert_encounter_map_object_v1(uuid,uuid,text,integer,integer,boolean,boolean,text,boolean,text,jsonb,jsonb) from public, anon;
revoke all on function public.admin_delete_encounter_map_object_v1(uuid) from public, anon;
grant execute on function public.admin_upsert_encounter_map_v1(uuid,text,text,integer,integer,text,text,boolean,jsonb) to authenticated, service_role;
grant execute on function public.admin_set_encounter_hex_v1(uuid,integer,integer,text,numeric,integer,text,jsonb) to authenticated, service_role;
grant execute on function public.admin_upsert_encounter_map_object_v1(uuid,uuid,text,integer,integer,boolean,boolean,text,boolean,text,jsonb,jsonb) to authenticated, service_role;
grant execute on function public.admin_delete_encounter_map_object_v1(uuid) to authenticated, service_role;

do $postconditions$
begin
  if has_table_privilege('anon','public.encounter_maps','SELECT') then raise exception 'anon must not read encounter maps'; end if;
  if has_function_privilege('anon','public.admin_upsert_encounter_map_v1(uuid,text,text,integer,integer,text,text,boolean,jsonb)','EXECUTE') then raise exception 'anon must not edit encounter maps'; end if;
  if not has_function_privilege('authenticated','public.admin_set_encounter_hex_v1(uuid,integer,integer,text,numeric,integer,text,jsonb)','EXECUTE') then raise exception 'authenticated role must be able to invoke guarded map edit RPC'; end if;
end
$postconditions$;

commit;
