-- Seed recipe/formula/pattern items into items_catalog.
-- Idempotent: updates matching item_key rows and inserts missing rows.
-- Buying these records currently creates an inventory item; a later pass can convert purchase into player_recipes unlocks.

with recipe_rows as (
  select
    r.id,
    'recipe:' || r.id::text as item_key,
    'Recipe: ' || r.name as item_name,
    coalesce(nullif(r.rarity, ''), 'Common') as item_rarity,
    case lower(coalesce(nullif(r.rarity, ''), 'common'))
      when 'common' then 50
      when 'uncommon' then 150
      when 'rare' then 500
      when 'very rare' then 2000
      when 'legendary' then 10000
      else 100
    end::numeric as price_gp,
    array_remove(array[
      'recipe', 'formula', lower(coalesce(r.discipline, 'recipe')),
      lower(coalesce(r.alchemy_section, '')), lower(coalesce(r.alchemy_group, '')), lower(coalesce(r.template_key, '')),
      case when lower(coalesce(r.discipline, '')) = 'alchemy' then 'alchemist' end,
      case when lower(coalesce(r.discipline, '')) = 'smithing' then 'blacksmith' end,
      case when lower(coalesce(r.discipline, '')) = 'enchanting' then 'enchanter' end,
      case when lower(coalesce(r.discipline, '')) = 'scribe' then 'scribe' end
    ], null)::text[] as merchant_tags,
    jsonb_strip_nulls(jsonb_build_object(
      'item_key', 'recipe:' || r.id::text,
      'item_id', 'recipe:' || r.id::text,
      'item_name', 'Recipe: ' || r.name,
      'name', 'Recipe: ' || r.name,
      'item_type', 'Recipe',
      'uiType', 'Recipe',
      'item_rarity', coalesce(nullif(r.rarity, ''), 'Common'),
      'rarity', coalesce(nullif(r.rarity, ''), 'Common'),
      'source', 'DNDNext Recipe Catalog',
      'flavor', 'A teachable crafting formula, pattern, or set of workshop notes.',
      'item_description', concat('Teaches or records the ', coalesce(r.discipline, 'crafting'), ' recipe: ', r.name, '.'),
      'recipe_item', true,
      'price_gp', case lower(coalesce(nullif(r.rarity, ''), 'common')) when 'common' then 50 when 'uncommon' then 150 when 'rare' then 500 when 'very rare' then 2000 when 'legendary' then 10000 else 100 end,
      'recipe_unlock', jsonb_build_object(
        'recipe_id', r.id,
        'recipe_name', r.name,
        'discipline', r.discipline,
        'recipe_type', r.recipe_type,
        'rarity', r.rarity,
        'alchemy_section', r.alchemy_section,
        'alchemy_group', r.alchemy_group,
        'template_key', r.template_key,
        'base_dc', r.base_dc
      )
    )) as payload
  from public.recipes r
), updated as (
  update public.items_catalog ic
  set item_name = rr.item_name,
      item_type = 'Recipe',
      item_rarity = rr.item_rarity,
      price_gp = rr.price_gp,
      merchant_tags = rr.merchant_tags,
      payload = rr.payload
  from recipe_rows rr
  where ic.item_key = rr.item_key
  returning ic.id
), inserted as (
  insert into public.items_catalog (item_key, item_name, item_type, item_rarity, price_gp, merchant_tags, payload)
  select rr.item_key, rr.item_name, 'Recipe', rr.item_rarity, rr.price_gp, rr.merchant_tags, rr.payload
  from recipe_rows rr
  where not exists (select 1 from public.items_catalog ic where ic.item_key = rr.item_key)
  returning id
)
select
  (select count(*) from updated) as updated_recipe_items,
  (select count(*) from inserted) as inserted_recipe_items;
