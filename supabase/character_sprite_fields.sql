-- Optional: enable NPC sprite selection + scaling on the map.
-- Safe to run multiple times.

alter table public.characters
  add column if not exists sprite_key text;

alter table public.characters
  add column if not exists map_scale numeric;

-- Reasonable default if you want sprites to show smaller by default
update public.characters
set map_scale = 0.7
where map_scale is null;
