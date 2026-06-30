-- Let NPC/crafter recipe access track generated/local recipes as well as DB-backed recipes.
-- recipe_id remains optional for recipes that have a UUID row in public.recipes.
-- recipe_key is the stable client key used by generated forge, tempering, alchemy, and enchanting rows.

alter table public.npc_known_recipes
  add column if not exists recipe_key text;

update public.npc_known_recipes
set recipe_key = lower(coalesce(recipe_key, recipe_id::text))
where recipe_key is null or btrim(recipe_key) = '';

alter table public.npc_known_recipes
  alter column recipe_id drop not null;

alter table public.npc_known_recipes
  alter column recipe_key set not null;

alter table public.npc_known_recipes
  drop constraint if exists npc_known_recipes_recipe_key_nonempty;

alter table public.npc_known_recipes
  add constraint npc_known_recipes_recipe_key_nonempty check (btrim(recipe_key) <> '');

create unique index if not exists npc_known_recipes_character_recipe_key_uidx
  on public.npc_known_recipes(character_id, recipe_key);

create index if not exists npc_known_recipes_recipe_key_idx
  on public.npc_known_recipes(recipe_key);
