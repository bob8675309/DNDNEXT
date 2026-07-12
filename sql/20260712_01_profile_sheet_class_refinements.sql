-- Source-backed class-feature descriptions and permission-aware quick HP adjustments.

create table if not exists public.class_feature_catalog (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null unique,
  feature_type text not null check (feature_type in ('class','subclass')),
  name text not null,
  source text not null,
  class_key text not null,
  class_name text not null,
  class_source text not null,
  subclass_name text,
  subclass_short_name text,
  level smallint not null check (level between 1 and 20),
  description text,
  entries jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists class_feature_catalog_lookup_idx
  on public.class_feature_catalog(class_key, class_source, feature_type, level);
create index if not exists class_feature_catalog_subclass_idx
  on public.class_feature_catalog(class_key, class_source, lower(coalesce(subclass_name,'')), level);

alter table public.class_feature_catalog enable row level security;

drop policy if exists class_feature_catalog_authenticated_read on public.class_feature_catalog;
create policy class_feature_catalog_authenticated_read
  on public.class_feature_catalog
  for select
  to authenticated
  using (true);

revoke all on table public.class_feature_catalog from public, anon;
grant select on table public.class_feature_catalog to authenticated;

create or replace function public.import_class_feature_batch_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access is required to import class features.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb)) <> 'object'
     or jsonb_typeof(p_payload->'rows') <> 'array' then
    raise exception 'Class feature payload must contain a rows array.';
  end if;
  v_count := jsonb_array_length(p_payload->'rows');
  if v_count < 1 or v_count > 500 then
    raise exception 'Class feature batches must contain between 1 and 500 rows.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_payload->'rows') row(value)
    where nullif(btrim(value->>'feature_key'),'') is null
       or nullif(btrim(value->>'feature_type'),'') is null
       or nullif(btrim(value->>'name'),'') is null
       or nullif(btrim(value->>'source'),'') is null
       or nullif(btrim(value->>'class_key'),'') is null
       or nullif(btrim(value->>'class_name'),'') is null
       or nullif(btrim(value->>'class_source'),'') is null
       or coalesce((value->>'level')::integer,0) not between 1 and 20
  ) then
    raise exception 'Each class feature row needs a key, type, name, source, class, class source, and level 1-20.';
  end if;

  insert into public.class_feature_catalog(
    feature_key, feature_type, name, source, class_key, class_name, class_source,
    subclass_name, subclass_short_name, level, description, entries, raw_payload, updated_at
  )
  select
    btrim(x.feature_key),
    lower(btrim(x.feature_type)),
    btrim(x.name),
    btrim(x.source),
    lower(btrim(x.class_key)),
    btrim(x.class_name),
    btrim(x.class_source),
    nullif(btrim(x.subclass_name),''),
    nullif(btrim(x.subclass_short_name),''),
    x.level,
    nullif(btrim(x.description),''),
    coalesce(x.entries,'[]'::jsonb),
    coalesce(x.raw_payload,'{}'::jsonb),
    now()
  from jsonb_to_recordset(p_payload->'rows') as x(
    feature_key text,
    feature_type text,
    name text,
    source text,
    class_key text,
    class_name text,
    class_source text,
    subclass_name text,
    subclass_short_name text,
    level integer,
    description text,
    entries jsonb,
    raw_payload jsonb
  )
  on conflict (feature_key) do update set
    feature_type = excluded.feature_type,
    name = excluded.name,
    source = excluded.source,
    class_key = excluded.class_key,
    class_name = excluded.class_name,
    class_source = excluded.class_source,
    subclass_name = excluded.subclass_name,
    subclass_short_name = excluded.subclass_short_name,
    level = excluded.level,
    description = excluded.description,
    entries = excluded.entries,
    raw_payload = excluded.raw_payload,
    updated_at = now();

  return jsonb_build_object('features',v_count);
end;
$$;

revoke all on function public.import_class_feature_batch_v1(jsonb) from public, anon;
grant execute on function public.import_class_feature_batch_v1(jsonb) to authenticated;

create or replace function public.adjust_character_hit_points_v1(
  p_character_id uuid,
  p_amount integer default 0,
  p_temp_hp integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_sheet jsonb;
  v_max integer;
  v_current integer;
  v_temp integer;
  v_damage integer;
  v_absorbed integer;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to change this character''s hit points.' using errcode = '42501';
  end if;
  if abs(coalesce(p_amount,0)) > 100000 then
    raise exception 'Hit point changes are limited to 100000 at a time.';
  end if;
  if p_temp_hp is not null and (p_temp_hp < 0 or p_temp_hp > 100000) then
    raise exception 'Temporary hit points must be between 0 and 100000.';
  end if;

  select sheet into v_sheet
  from public.character_sheets
  where character_id = p_character_id
  for update;

  if v_sheet is null then
    raise exception 'No character sheet exists for this character.' using errcode = 'P0002';
  end if;

  begin
    v_max := greatest(0,coalesce(nullif(v_sheet->>'maxHp','')::integer,nullif(v_sheet->>'hp','')::integer,0));
    v_current := greatest(0,least(v_max,coalesce(nullif(v_sheet->>'hp','')::integer,v_max)));
    v_temp := greatest(0,coalesce(nullif(v_sheet->>'tempHp','')::integer,0));
  exception when others then
    raise exception 'The character sheet contains invalid hit point values.';
  end;

  if coalesce(p_amount,0) < 0 then
    v_damage := abs(p_amount);
    v_absorbed := least(v_temp,v_damage);
    v_temp := v_temp - v_absorbed;
    v_current := greatest(0,v_current-(v_damage-v_absorbed));
  elsif coalesce(p_amount,0) > 0 then
    v_current := least(v_max,v_current+p_amount);
  end if;

  if p_temp_hp is not null then
    v_temp := p_temp_hp;
  end if;

  v_sheet := jsonb_set(v_sheet,'{hp}',to_jsonb(v_current),true);
  v_sheet := jsonb_set(v_sheet,'{maxHp}',to_jsonb(v_max),true);
  v_sheet := jsonb_set(v_sheet,'{tempHp}',to_jsonb(v_temp),true);

  update public.character_sheets
  set sheet=v_sheet,updated_at=now()
  where character_id=p_character_id;

  update public.players p
  set sheet=v_sheet,updated_at=now()
  where p.user_id in (
    select cp.user_id
    from public.character_permissions cp
    where cp.character_id=p_character_id and cp.can_edit
  );

  return jsonb_build_object(
    'characterId',p_character_id,
    'currentHp',v_current,
    'maxHp',v_max,
    'tempHp',v_temp,
    'sheet',v_sheet
  );
end;
$$;

revoke all on function public.adjust_character_hit_points_v1(uuid,integer,integer) from public, anon;
grant execute on function public.adjust_character_hit_points_v1(uuid,integer,integer) to authenticated;
