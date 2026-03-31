create table if not exists public.town_map_labels (
  id uuid primary key default gen_random_uuid(),
  location_id bigint not null references public.locations(id) on delete cascade,
  key text,
  name text not null,
  x double precision not null,
  y double precision not null,
  tone text not null default 'stone',
  target_panel text,
  category text,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.town_map_flags (
  id uuid primary key default gen_random_uuid(),
  location_id bigint not null references public.locations(id) on delete cascade,
  name text not null,
  x double precision not null,
  y double precision not null,
  tone text not null default 'amber',
  notes text,
  category text,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists town_map_labels_location_idx on public.town_map_labels(location_id, sort_order);
create index if not exists town_map_flags_location_idx on public.town_map_flags(location_id, sort_order);

create or replace function public.set_updated_at_town_map_labels()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end $$;

create or replace function public.set_updated_at_town_map_flags()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end $$;

 drop trigger if exists trg_town_map_labels_updated_at on public.town_map_labels;
create trigger trg_town_map_labels_updated_at
before update on public.town_map_labels
for each row execute function public.set_updated_at_town_map_labels();

 drop trigger if exists trg_town_map_flags_updated_at on public.town_map_flags;
create trigger trg_town_map_flags_updated_at
before update on public.town_map_flags
for each row execute function public.set_updated_at_town_map_flags();

alter table public.town_map_labels enable row level security;
alter table public.town_map_flags enable row level security;

do $$ begin
  create policy town_map_labels_read on public.town_map_labels
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy town_map_flags_read on public.town_map_flags
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy town_map_labels_admin_write on public.town_map_labels
    for all to authenticated
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy town_map_flags_admin_write on public.town_map_flags
    for all to authenticated
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
