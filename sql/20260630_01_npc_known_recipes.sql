-- Normalized NPC/crafter known recipe access.
-- Keeps crafter recipe gating out of characters.tags and avoids changing crafting rules.

create table if not exists public.npc_known_recipes (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  created_by uuid default auth.uid(),
  constraint npc_known_recipes_character_recipe_key unique (character_id, recipe_id)
);

create index if not exists npc_known_recipes_character_id_idx
  on public.npc_known_recipes(character_id);

create index if not exists npc_known_recipes_recipe_id_idx
  on public.npc_known_recipes(recipe_id);

alter table public.npc_known_recipes enable row level security;

drop policy if exists npc_known_recipes_select_public on public.npc_known_recipes;
create policy npc_known_recipes_select_public
  on public.npc_known_recipes
  for select
  to anon, authenticated
  using (true);

drop policy if exists npc_known_recipes_insert_admin on public.npc_known_recipes;
create policy npc_known_recipes_insert_admin
  on public.npc_known_recipes
  for insert
  to authenticated
  with check (public.is_admin((select auth.uid())));

drop policy if exists npc_known_recipes_delete_admin on public.npc_known_recipes;
create policy npc_known_recipes_delete_admin
  on public.npc_known_recipes
  for delete
  to authenticated
  using (public.is_admin((select auth.uid())));

drop policy if exists npc_known_recipes_update_admin on public.npc_known_recipes;
create policy npc_known_recipes_update_admin
  on public.npc_known_recipes
  for update
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));
