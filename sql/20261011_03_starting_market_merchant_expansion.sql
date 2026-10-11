-- Expand the Character Forge starting market with additional campaign storefronts.
--
-- These are storefront-only merchant characters for now: hidden from world-map presentation,
-- no location/route assignment, and no movement authority changes. Starting Equipment already
-- discovers enabled storefronts from public.characters and reads their live character_stock.
--
-- Stock generation deliberately uses public.reroll_merchant_inventory_v2. That function reads
-- directly from the complete public.items_catalog and falls back to the whole catalogue when a
-- theme pool cannot fill the requested shelf. No static/sample item list is introduced here.

with seed(name, role, description, tags, storefront_title, storefront_tagline, theme) as (
  values
    ('Mara Ironvein', 'Arms and armor merchant',
      'A practical smith-merchant who keeps weapons, armor, ammunition, and useful metalwork close at hand.',
      array['merchant','smith','weapons']::text[],
      'Ironvein Arms & Armor', 'Weapons, armor, shields, ammunition, and smithing supplies.', 'smith'),
    ('Selene Quill', 'Arcane goods merchant',
      'A meticulous dealer in arcane implements, scrollwork, focuses, and curious enchanted objects.',
      array['merchant','arcanist','scribe']::text[],
      'The Quill & Aether', 'Arcane focuses, scrollwork, wands, curios, and magical implements.', 'arcanist'),
    ('Pell Mossgrove', 'Herbalist and apothecary',
      'A field herbalist who buys, dries, distills, and trades useful plants, reagents, and prepared remedies.',
      array['merchant','herbalist','alchemy']::text[],
      'Mossgrove Apothecary', 'Herbs, reagents, potions, oils, poisons, and alchemical supplies.', 'herbalist'),
    ('Brakka Wayfarer', 'Caravan outfitter',
      'A veteran caravan quartermaster specializing in travel gear, trade goods, tools, and hard-to-find expedition supplies.',
      array['merchant','caravan','general']::text[],
      'Wayfarer Outfitters', 'Travel gear, tools, trade goods, vehicles, and expedition supplies.', 'caravan'),
    ('Ilyra Glasshand', 'Jeweler and relic dealer',
      'A jeweler and appraiser who trades ornaments, relics, unusual valuables, and select enchanted pieces.',
      array['merchant','jeweler','arcanist']::text[],
      'Glasshand Relics', 'Jewelry, relics, wondrous curios, and carefully appraised treasures.', 'jeweler'),
    ('Torren Packswell', 'General goods merchant',
      'A broad-stock general merchant whose shelves favor practical adventuring equipment but can turn up almost anything.',
      array['merchant','general']::text[],
      'Packswell General Goods', 'Adventuring gear, tools, common supplies, and a rotating general catalogue.', 'general')
),
inserted as (
  insert into public.characters(
    name, role, description, tags, kind, storefront_enabled,
    storefront_title, storefront_tagline, is_hidden, state
  )
  select
    s.name, s.role, s.description, s.tags, 'merchant', true,
    s.storefront_title, s.storefront_tagline, true, 'resting'
  from seed s
  where not exists (
    select 1 from public.characters c where lower(c.name)=lower(s.name)
  )
  returning id,name
),
enabled as (
  update public.characters c
     set kind='merchant',
         storefront_enabled=true,
         storefront_title=s.storefront_title,
         storefront_tagline=s.storefront_tagline,
         role=s.role,
         description=s.description,
         tags=s.tags,
         is_hidden=true,
         state=case when c.state='moving' then 'resting' else c.state end,
         updated_at=timezone('utc',now())
    from seed s
   where lower(c.name)=lower(s.name)
  returning c.id,c.name
)
select 1;

do $$
declare
  v record;
begin
  for v in
    select c.id, s.theme
      from public.characters c
      join (values
        ('Mara Ironvein','smith'),
        ('Selene Quill','arcanist'),
        ('Pell Mossgrove','herbalist'),
        ('Brakka Wayfarer','caravan'),
        ('Ilyra Glasshand','jeweler'),
        ('Torren Packswell','general')
      ) as s(name,theme) on lower(s.name)=lower(c.name)
  loop
    -- 24 is the current reroll authority's supported shelf maximum.
    perform * from public.reroll_merchant_inventory_v2(v.id, v.theme, 24);
  end loop;
end
$$;
