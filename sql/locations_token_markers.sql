-- Location marker tokens (Option 2): icons + token-like transforms
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

alter table public.locations
  add column if not exists marker_anchor_x numeric null default 0.5;

alter table public.locations
  add column if not exists marker_anchor_y numeric null default 1;

alter table public.locations
  add column if not exists marker_rotation_deg numeric null default 0;

-- Recommended:
-- 1) Create a Storage bucket named: location-icons
-- 2) Upload your SVG/PNG assets.
-- 3) Insert rows into location_icons with storage_path set to the object key in that bucket.
