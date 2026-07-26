begin;

-- Phase 0 visual-library cleanup.
-- A sprite is now an independent reusable asset. portrait_library_id remains as optional
-- provenance (for example, the portrait the sprite was originally designed from), not a
-- requirement that the character choose that portrait.
alter table public.npc_visual_assets
  alter column portrait_library_id drop not null;

alter table public.npc_visual_assets
  drop constraint if exists npc_visual_assets_portrait_library_id_fkey;

alter table public.npc_visual_assets
  add constraint npc_visual_assets_portrait_library_id_fkey
  foreign key (portrait_library_id)
  references public.npc_portrait_library(id)
  on delete set null;

alter table public.npc_visual_assets
  add column if not exists overworld_scale numeric not null default 0.35 check (overworld_scale > 0),
  add column if not exists tactical_scale numeric not null default 1.0 check (tactical_scale > 0),
  add column if not exists species_tags text[] not null default '{}'::text[],
  add column if not exists role_tags text[] not null default '{}'::text[],
  add column if not exists theme_tags text[] not null default '{}'::text[];

-- The unified production target is an 8-direction sheet with one idle frame and a
-- three-frame walk cycle. default_scale remains for compatibility with existing character
-- fields and now follows the overworld-scale expectation for new assets.
alter table public.npc_visual_assets
  alter column sprite_format set default 'eight_direction_idle_walk_v1',
  alter column frame_width set default 64,
  alter column frame_height set default 64,
  alter column direction_order set default array['down','down-left','left','up-left','up','up-right','right','down-right']::text[],
  alter column idle_frame set default 0,
  alter column walk_frames set default array[1,2,3]::integer[],
  alter column fps set default 7,
  alter column default_scale set default 0.35,
  alter column is_default set default false;

update public.npc_visual_assets
set overworld_scale = coalesce(nullif(overworld_scale, 0), nullif(default_scale, 0), 0.35),
    tactical_scale = coalesce(nullif(tactical_scale, 0), 1.0)
where true;

create index if not exists npc_visual_assets_species_tags_gin
  on public.npc_visual_assets using gin(species_tags);
create index if not exists npc_visual_assets_role_tags_gin
  on public.npc_visual_assets using gin(role_tags);
create index if not exists npc_visual_assets_theme_tags_gin
  on public.npc_visual_assets using gin(theme_tags);

-- Suggested matches are curation hints only. They never constrain character creation.
create table if not exists public.portrait_sprite_suggestions (
  portrait_library_id uuid not null references public.npc_portrait_library(id) on delete cascade,
  visual_asset_id uuid not null references public.npc_visual_assets(id) on delete cascade,
  suggestion_rank integer not null default 100 check (suggestion_rank > 0),
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (portrait_library_id, visual_asset_id)
);

create unique index if not exists portrait_sprite_suggestions_primary_uidx
  on public.portrait_sprite_suggestions(portrait_library_id)
  where is_primary;
create index if not exists portrait_sprite_suggestions_asset_idx
  on public.portrait_sprite_suggestions(visual_asset_id, suggestion_rank);

alter table public.portrait_sprite_suggestions enable row level security;
drop policy if exists portrait_sprite_suggestions_authenticated_read on public.portrait_sprite_suggestions;
create policy portrait_sprite_suggestions_authenticated_read
  on public.portrait_sprite_suggestions
  for select to authenticated
  using (true);

revoke all on public.portrait_sprite_suggestions from public, anon, authenticated;
grant select on public.portrait_sprite_suggestions to authenticated;
grant all on public.portrait_sprite_suggestions to service_role;

comment on column public.npc_visual_assets.portrait_library_id is
  'Optional provenance/source portrait for this sprite. Character portrait selection is independent; use portrait_sprite_suggestions for curated matches.';
comment on column public.npc_visual_assets.overworld_scale is
  'Recommended visual scale when this sprite is used on the world/town map.';
comment on column public.npc_visual_assets.tactical_scale is
  'Recommended visual scale when this sprite is used on a tactical encounter board.';
comment on table public.portrait_sprite_suggestions is
  'Optional curated portrait-to-sprite recommendations. Suggestions do not enforce or imply ownership.';

-- Postconditions: the registry must be independent and the suggestion table must be readable
-- by signed-in creator/admin surfaces without granting direct writes.
do $postconditions$
declare
  v_nullable text;
  v_auth_insert boolean;
begin
  select is_nullable into v_nullable
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'npc_visual_assets'
    and column_name = 'portrait_library_id';

  if v_nullable <> 'YES' then
    raise exception 'npc_visual_assets.portrait_library_id must be nullable';
  end if;

  if to_regclass('public.portrait_sprite_suggestions') is null then
    raise exception 'portrait_sprite_suggestions was not created';
  end if;

  select has_table_privilege('authenticated', 'public.portrait_sprite_suggestions', 'INSERT') into v_auth_insert;
  if coalesce(v_auth_insert, false) then
    raise exception 'authenticated must not have direct INSERT on portrait_sprite_suggestions';
  end if;
end
$postconditions$;

commit;
