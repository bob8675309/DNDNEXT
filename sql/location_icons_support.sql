-- Location icon support + marker scale for locations
-- Safe to run multiple times.

create table if not exists public.location_icons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.locations
  add column if not exists icon_id uuid null references public.location_icons(id) on delete set null;

alter table public.locations
  add column if not exists marker_scale numeric null default 1;

-- Suggested (manual in Supabase UI): create a Storage bucket named "location-icons"
-- and store your marker SVG/PNG assets there. Put the object key into location_icons.storage_path.
