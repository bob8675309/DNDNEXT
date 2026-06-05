-- 20260606_alchemy_brew_quality_and_formula_guide.sql
-- Idempotent synchronization for the 44 player-facing brew formulas.
-- Brew Quality rarity/DC calculation remains application-side and is saved in craft plan JSON.
BEGIN;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS alchemy_section text;

UPDATE public.recipes
SET ingredient_slots = '[{"key":"antitoxin_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"antitoxin_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"antitoxin_core_3","role":"Core ingredient 3","family":"flower","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"antitoxin_modifier","role":"Optional fourth slot: purifying enhancer, holy component, or antivenom monster part.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","holy_vital","monster_fluid"]}]'::jsonb,
    family_formula = 'Root + Mineral / Salt / Ash + Flower',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('antitoxin')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"ironroot-salve_core_1","role":"Core ingredient 1","family":"thorn_bark_wood","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"ironroot-salve_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"ironroot-salve_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"ironroot-salve_modifier","role":"Optional fourth slot: defensive enhancer, earth essence, or reinforcing monster component.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","essence","monster_fluid"]}]'::jsonb,
    family_formula = 'Thorn / Bark / Wood + Root + Sap / Resin',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('ironroot salve')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"night-eye-drops_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"night-eye-drops_core_2","role":"Core ingredient 2","family":"moss_lichen","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"night-eye-drops_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"night-eye-drops_modifier","role":"Optional fourth slot: shadow, moon, or sensory essence.","family":"any","required":false,"slot_type":"modifier","allowed_families":["essence","enhancer","monster_fluid"]}]'::jsonb,
    family_formula = 'Flower + Moss / Lichen + Mineral / Salt / Ash',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('night-eye drops')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"oil-of-etherealness_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"oil-of-etherealness_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"oil-of-etherealness_core_3","role":"Core ingredient 3","family":"flower","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"oil-of-etherealness_modifier","role":"Required fourth slot: phase residue, ethereal essence, or another planar component.","family":"any","required":true,"slot_type":"modifier","allowed_families":["essence","monster_fluid","enhancer"]}]'::jsonb,
    family_formula = 'Sap / Resin + Mineral / Salt / Ash + Flower',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('oil of etherealness')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"oil-of-sharpness_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"oil-of-sharpness_core_2","role":"Core ingredient 2","family":"thorn_bark_wood","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"oil-of-sharpness_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"oil-of-sharpness_modifier","role":"Optional fourth slot: concentrating enhancer or monster-derived cutting agent.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","monster_fluid","essence"]}]'::jsonb,
    family_formula = 'Sap / Resin + Thorn / Bark / Wood + Mineral / Salt / Ash',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('oil of sharpness')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"philter-of-love_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"philter-of-love_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"philter-of-love_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"philter-of-love_modifier","role":"Optional fourth slot: fey, psychic, or glamour essence.","family":"any","required":false,"slot_type":"modifier","allowed_families":["essence","enhancer","monster_fluid"]}]'::jsonb,
    family_formula = 'Flower + Flower + Sap / Resin',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('philter of love')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-animal-friendship_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-animal-friendship_core_2","role":"Core ingredient 2","family":"leaf_vine","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-animal-friendship_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-animal-friendship_modifier","role":"Optional fourth slot: fey essence or beast-derived component.","family":"any","required":false,"slot_type":"modifier","allowed_families":["essence","monster_fluid","enhancer"]}]'::jsonb,
    family_formula = 'Flower + Leaf / Vine + Root',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of animal friendship')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-clairvoyance_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-clairvoyance_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-clairvoyance_core_3","role":"Core ingredient 3","family":"moss_lichen","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-clairvoyance_modifier","role":"Optional fourth slot: psychic, crystal, or remote-sensing essence.","family":"any","required":false,"slot_type":"modifier","allowed_families":["essence","enhancer","monster_fluid"]}]'::jsonb,
    family_formula = 'Flower + Mineral / Salt / Ash + Moss / Lichen',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of clairvoyance')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-climbing_core_1","role":"Core ingredient 1","family":"leaf_vine","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"potion-of-climbing_core_2","role":"Core ingredient 2","family":"moss_lichen","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"potion-of-climbing_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"potion-of-climbing_modifier","role":"Optional fourth slot: spider, gecko, earth, or mobility component.","family":"any","required":false,"slot_type":"modifier","allowed_families":["monster_fluid","essence","enhancer"]}]'::jsonb,
    family_formula = 'Leaf / Vine + Moss / Lichen + Root',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of climbing')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-comprehension_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"potion-of-comprehension_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"potion-of-comprehension_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"potion-of-comprehension_modifier","role":"Optional fourth slot: psychic, linguistic, or scribe-aligned essence.","family":"any","required":false,"slot_type":"modifier","allowed_families":["essence","enhancer","monster_fluid"]}]'::jsonb,
    family_formula = 'Flower + Mineral / Salt / Ash + Root',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of comprehension')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-diminution_core_1","role":"Core ingredient 1","family":"mushroom","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-diminution_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-diminution_core_3","role":"Core ingredient 3","family":"flower","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-diminution_modifier","role":"Optional fourth slot: transmutation enhancer or size-altering essence.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","essence","monster_fluid"]}]'::jsonb,
    family_formula = 'Mushroom + Root + Flower',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of diminution')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-dragon-s-majesty_core_1","role":"Core ingredient 1","family":"mushroom","min_rarity":"Legendary","required":true,"slot_type":"core"},{"key":"potion-of-dragon-s-majesty_core_2","role":"Core ingredient 2","family":"thorn_bark_wood","min_rarity":"Legendary","required":true,"slot_type":"core"},{"key":"potion-of-dragon-s-majesty_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Legendary","required":true,"slot_type":"core"},{"key":"potion-of-dragon-s-majesty_modifier","role":"Required fourth slot: dragon gland, blood, scale essence, or another draconic component.","family":"any","required":true,"slot_type":"modifier","allowed_families":["monster_fluid","essence"]}]'::jsonb,
    family_formula = 'Mushroom + Thorn / Bark / Wood + Mineral / Salt / Ash',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of dragon''s majesty')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-fire-breath_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-fire-breath_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-fire-breath_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-fire-breath_modifier","role":"Required fourth slot: fire essence or dragon gland.","family":"any","required":true,"slot_type":"modifier","allowed_families":["essence","monster_fluid"]}]'::jsonb,
    family_formula = 'Mineral / Salt / Ash + Sap / Resin + Thorn / Bark / Wood',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of fire breath')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-flying_core_1","role":"Core ingredient 1","family":"leaf_vine","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"potion-of-flying_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"potion-of-flying_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"potion-of-flying_modifier","role":"Optional fourth slot: air essence, wing membrane, or flight enhancer.","family":"any","required":false,"slot_type":"modifier","allowed_families":["essence","monster_fluid","enhancer"]}]'::jsonb,
    family_formula = 'Leaf / Vine + Flower + Sap / Resin',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of flying')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-gaseous-form_core_1","role":"Core ingredient 1","family":"leaf_vine","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-gaseous-form_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-gaseous-form_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-gaseous-form_modifier","role":"Optional fourth slot: air, mist, or phase essence.","family":"any","required":false,"slot_type":"modifier","allowed_families":["essence","enhancer","monster_fluid"]}]'::jsonb,
    family_formula = 'Leaf / Vine + Flower + Mineral / Salt / Ash',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of gaseous form')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-giant-size_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Legendary","required":true,"slot_type":"core"},{"key":"potion-of-giant-size_core_2","role":"Core ingredient 2","family":"thorn_bark_wood","min_rarity":"Legendary","required":true,"slot_type":"core"},{"key":"potion-of-giant-size_core_3","role":"Core ingredient 3","family":"mushroom","min_rarity":"Legendary","required":true,"slot_type":"core"},{"key":"potion-of-giant-size_modifier","role":"Required fourth slot: giant blood, giant marrow, or mythic growth catalyst.","family":"any","required":true,"slot_type":"modifier","allowed_families":["monster_fluid","enhancer","essence"]}]'::jsonb,
    family_formula = 'Root + Thorn / Bark / Wood + Mushroom',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of giant size')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-growth_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-growth_core_2","role":"Core ingredient 2","family":"thorn_bark_wood","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-growth_core_3","role":"Core ingredient 3","family":"mushroom","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-growth_modifier","role":"Optional fourth slot: giant blood or transmutation enhancer.","family":"any","required":false,"slot_type":"modifier","allowed_families":["monster_fluid","enhancer","essence"]}]'::jsonb,
    family_formula = 'Root + Thorn / Bark / Wood + Mushroom',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of growth')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-healing_core_1","role":"Core ingredient 1","family":"mushroom","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"potion-of-healing_core_2","role":"Core ingredient 2","family":"mushroom","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"potion-of-healing_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"potion-of-healing_modifier","role":"Optional fourth slot: holy/vital component, distillation agent, or restorative monster component.","family":"any","required":false,"slot_type":"modifier","allowed_families":["holy_vital","enhancer","essence","monster_fluid"]}]'::jsonb,
    family_formula = 'Mushroom + Mushroom + Root',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of healing', 'healing draught', 'potion of greater healing', 'potion of superior healing', 'potion of supreme healing')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-heroism_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-heroism_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-heroism_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-heroism_modifier","role":"Optional fourth slot: holy/vital component or courage-aligned essence.","family":"any","required":false,"slot_type":"modifier","allowed_families":["holy_vital","essence","enhancer"]}]'::jsonb,
    family_formula = 'Root + Flower + Thorn / Bark / Wood',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of heroism')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-invisibility_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"potion-of-invisibility_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"potion-of-invisibility_core_3","role":"Core ingredient 3","family":"leaf_vine","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"potion-of-invisibility_modifier","role":"Optional fourth slot: shadow, phase, or light-bending essence.","family":"any","required":false,"slot_type":"modifier","allowed_families":["essence","enhancer","monster_fluid"]}]'::jsonb,
    family_formula = 'Moss / Lichen + Flower + Leaf / Vine',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of invisibility')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-invulnerability_core_1","role":"Core ingredient 1","family":"thorn_bark_wood","min_rarity":"Legendary","required":true,"slot_type":"core"},{"key":"potion-of-invulnerability_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Legendary","required":true,"slot_type":"core"},{"key":"potion-of-invulnerability_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Legendary","required":true,"slot_type":"core"},{"key":"potion-of-invulnerability_modifier","role":"Optional fourth slot: holy, force, diamond, or mythic warding component.","family":"any","required":false,"slot_type":"modifier","allowed_families":["holy_vital","essence","enhancer","monster_fluid"]}]'::jsonb,
    family_formula = 'Thorn / Bark / Wood + Root + Mineral / Salt / Ash',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of invulnerability')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-mind-reading_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-mind-reading_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-mind-reading_core_3","role":"Core ingredient 3","family":"moss_lichen","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-mind-reading_modifier","role":"Optional fourth slot: psychic essence or telepathic monster component.","family":"any","required":false,"slot_type":"modifier","allowed_families":["essence","monster_fluid","enhancer"]}]'::jsonb,
    family_formula = 'Flower + Mineral / Salt / Ash + Moss / Lichen',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of mind reading')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


INSERT INTO public.recipes (name, description, recipe_type, discipline, rarity, base_dc, source, duration, use_text, effect_text, output_quantity, ingredient_slots, family_formula, alchemy_section)
SELECT 'Potion of Regeneration', 'At the start of each of the drinker''s turns, the drinker regains 1d4 HP for the duration.', 'Alchemy', 'Alchemy', 'Rare', 28, 'DNDNext Alchemy Formula Guide v4', '1 minute', 'Bonus Action to use or apply', 'At the start of each of the drinker''s turns, the drinker regains 1d4 HP for the duration.', 1, '[{"key":"potion-of-regeneration_core_1","role":"Core ingredient 1","family":"mushroom","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-regeneration_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-regeneration_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-regeneration_modifier","role":"Optional fourth slot: holy/vital component, troll blood, or regeneration enhancer.","family":"any","required":false,"slot_type":"modifier","allowed_families":["holy_vital","monster_fluid","enhancer","essence"]}]'::jsonb, 'Mushroom + Sap / Resin + Root', 'Potions'
WHERE NOT EXISTS (SELECT 1 FROM public.recipes WHERE lower(name) = lower('Potion of Regeneration'));


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-regeneration_core_1","role":"Core ingredient 1","family":"mushroom","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-regeneration_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-regeneration_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"potion-of-regeneration_modifier","role":"Optional fourth slot: holy/vital component, troll blood, or regeneration enhancer.","family":"any","required":false,"slot_type":"modifier","allowed_families":["holy_vital","monster_fluid","enhancer","essence"]}]'::jsonb,
    family_formula = 'Mushroom + Sap / Resin + Root',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of regeneration')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-resistance_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-resistance_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-resistance_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-resistance_modifier","role":"Required fourth slot: essence or monster component that determines the damage type.","family":"any","required":true,"slot_type":"modifier","allowed_families":["essence","monster_fluid","mineral_salt_ash"]}]'::jsonb,
    family_formula = 'Moss / Lichen + Root + Mineral / Salt / Ash',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of resistance')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-speed_core_1","role":"Core ingredient 1","family":"leaf_vine","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"potion-of-speed_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"potion-of-speed_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"potion-of-speed_modifier","role":"Optional fourth slot: haste enhancer, lightning essence, or quickening monster component.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","essence","monster_fluid"]}]'::jsonb,
    family_formula = 'Leaf / Vine + Flower + Sap / Resin',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of speed')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-storm-giant-strength_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Legendary","required":true,"slot_type":"core"},{"key":"potion-of-storm-giant-strength_core_2","role":"Core ingredient 2","family":"thorn_bark_wood","min_rarity":"Legendary","required":true,"slot_type":"core"},{"key":"potion-of-storm-giant-strength_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Legendary","required":true,"slot_type":"core"},{"key":"potion-of-storm-giant-strength_modifier","role":"Required fourth slot: storm giant blood, storm essence, or giant-derived component.","family":"any","required":true,"slot_type":"modifier","allowed_families":["monster_fluid","essence"]}]'::jsonb,
    family_formula = 'Root + Thorn / Bark / Wood + Mineral / Salt / Ash',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of storm giant strength')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-watchful-rest_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"potion-of-watchful-rest_core_2","role":"Core ingredient 2","family":"moss_lichen","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"potion-of-watchful-rest_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"potion-of-watchful-rest_modifier","role":"Optional fourth slot: dream, moon, or vigilance essence.","family":"any","required":false,"slot_type":"modifier","allowed_families":["essence","enhancer","monster_fluid"]}]'::jsonb,
    family_formula = 'Flower + Moss / Lichen + Root',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of watchful rest')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-water-breathing_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-water-breathing_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-water-breathing_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-water-breathing_modifier","role":"Optional fourth slot: aquatic essence, gill, mucus, or water-aligned monster component.","family":"any","required":false,"slot_type":"modifier","allowed_families":["essence","monster_fluid","enhancer"]}]'::jsonb,
    family_formula = 'Flower + Sap / Resin + Mineral / Salt / Ash',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of water breathing')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


INSERT INTO public.recipes (name, description, recipe_type, discipline, rarity, base_dc, source, duration, use_text, effect_text, output_quantity, ingredient_slots, family_formula, alchemy_section)
SELECT 'Potion of X Resistance', 'The drinker gains resistance to the damage type set by the fourth-slot component.', 'Alchemy', 'Alchemy', 'Uncommon', 22, 'DNDNext Alchemy Formula Guide v4', '1 hour', 'Bonus Action to use or apply', 'The drinker gains resistance to the damage type set by the fourth-slot component.', 1, '[{"key":"potion-of-x-resistance_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-x-resistance_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-x-resistance_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-x-resistance_modifier","role":"Required fourth slot: essence or monster component that sets X.","family":"any","required":true,"slot_type":"modifier","allowed_families":["essence","monster_fluid","mineral_salt_ash"]}]'::jsonb, 'Moss / Lichen + Root + Mineral / Salt / Ash', 'Potions'
WHERE NOT EXISTS (SELECT 1 FROM public.recipes WHERE lower(name) = lower('Potion of X Resistance'));


UPDATE public.recipes
SET ingredient_slots = '[{"key":"potion-of-x-resistance_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-x-resistance_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-x-resistance_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"potion-of-x-resistance_modifier","role":"Required fourth slot: essence or monster component that sets X.","family":"any","required":true,"slot_type":"modifier","allowed_families":["essence","monster_fluid","mineral_salt_ash"]}]'::jsonb,
    family_formula = 'Moss / Lichen + Root + Mineral / Salt / Ash',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('potion of x resistance', 'potion of poison resistance', 'potion of fire resistance', 'potion of cold resistance', 'potion of acid resistance', 'potion of lightning resistance', 'potion of thunder resistance', 'potion of radiant resistance', 'potion of necrotic resistance', 'potion of psychic resistance', 'potion of force resistance')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"quickstep-tonic_core_1","role":"Core ingredient 1","family":"leaf_vine","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"quickstep-tonic_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"quickstep-tonic_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"quickstep-tonic_modifier","role":"Optional fourth slot: quickening enhancer or lightning/air essence.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","essence","monster_fluid"]}]'::jsonb,
    family_formula = 'Leaf / Vine + Flower + Sap / Resin',
    alchemy_section = 'Potions',
    updated_at = now()
WHERE lower(name) IN ('quickstep tonic')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"basic-poison_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"basic-poison_core_2","role":"Core ingredient 2","family":"mushroom","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"basic-poison_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true,"slot_type":"core"},{"key":"basic-poison_modifier","role":"Optional fourth slot: monster venom, elemental essence, or poison enhancer.","family":"any","required":false,"slot_type":"modifier","allowed_families":["monster_fluid","essence","enhancer"]}]'::jsonb,
    family_formula = 'Venom / Poison Plant + Mushroom + Root',
    alchemy_section = 'Poisons',
    updated_at = now()
WHERE lower(name) IN ('basic poison')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


INSERT INTO public.recipes (name, description, recipe_type, discipline, rarity, base_dc, source, duration, use_text, effect_text, output_quantity, ingredient_slots, family_formula, alchemy_section)
SELECT 'Poison of Charisma Weakening', 'The target chooses Constitution or Charisma before rolling. On a failed save, Charisma is reduced by 1d6 temporarily.', 'Alchemy', 'Alchemy', 'Rare', 28, 'DNDNext Alchemy Formula Guide v4', '1 hour', 'Bonus Action to use or apply', 'The target chooses Constitution or Charisma before rolling. On a failed save, Charisma is reduced by 1d6 temporarily.', 1, '[{"key":"poison-of-charisma-weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-charisma-weakening_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-charisma-weakening_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-charisma-weakening_modifier","role":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","family":"any","required":false,"slot_type":"modifier","allowed_families":["monster_fluid","essence","enhancer"]}]'::jsonb, 'Venom / Poison Plant + Flower + Sap / Resin', 'Poisons'
WHERE NOT EXISTS (SELECT 1 FROM public.recipes WHERE lower(name) = lower('Poison of Charisma Weakening'));


UPDATE public.recipes
SET ingredient_slots = '[{"key":"poison-of-charisma-weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-charisma-weakening_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-charisma-weakening_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-charisma-weakening_modifier","role":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","family":"any","required":false,"slot_type":"modifier","allowed_families":["monster_fluid","essence","enhancer"]}]'::jsonb,
    family_formula = 'Venom / Poison Plant + Flower + Sap / Resin',
    alchemy_section = 'Poisons',
    updated_at = now()
WHERE lower(name) IN ('poison of charisma weakening')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


INSERT INTO public.recipes (name, description, recipe_type, discipline, rarity, base_dc, source, duration, use_text, effect_text, output_quantity, ingredient_slots, family_formula, alchemy_section)
SELECT 'Poison of Constitution Weakening', 'The target chooses Constitution or Constitution before rolling. On a failed save, Constitution is reduced by 1d6 temporarily.', 'Alchemy', 'Alchemy', 'Rare', 28, 'DNDNext Alchemy Formula Guide v4', '1 hour', 'Bonus Action to use or apply', 'The target chooses Constitution or Constitution before rolling. On a failed save, Constitution is reduced by 1d6 temporarily.', 1, '[{"key":"poison-of-constitution-weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-constitution-weakening_core_2","role":"Core ingredient 2","family":"mushroom","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-constitution-weakening_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-constitution-weakening_modifier","role":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","family":"any","required":false,"slot_type":"modifier","allowed_families":["monster_fluid","essence","enhancer"]}]'::jsonb, 'Venom / Poison Plant + Mushroom + Root', 'Poisons'
WHERE NOT EXISTS (SELECT 1 FROM public.recipes WHERE lower(name) = lower('Poison of Constitution Weakening'));


UPDATE public.recipes
SET ingredient_slots = '[{"key":"poison-of-constitution-weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-constitution-weakening_core_2","role":"Core ingredient 2","family":"mushroom","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-constitution-weakening_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-constitution-weakening_modifier","role":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","family":"any","required":false,"slot_type":"modifier","allowed_families":["monster_fluid","essence","enhancer"]}]'::jsonb,
    family_formula = 'Venom / Poison Plant + Mushroom + Root',
    alchemy_section = 'Poisons',
    updated_at = now()
WHERE lower(name) IN ('poison of constitution weakening')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


INSERT INTO public.recipes (name, description, recipe_type, discipline, rarity, base_dc, source, duration, use_text, effect_text, output_quantity, ingredient_slots, family_formula, alchemy_section)
SELECT 'Poison of Dexterity Weakening', 'The target chooses Constitution or Dexterity before rolling. On a failed save, Dexterity is reduced by 1d6 temporarily.', 'Alchemy', 'Alchemy', 'Rare', 28, 'DNDNext Alchemy Formula Guide v4', '1 hour', 'Bonus Action to use or apply', 'The target chooses Constitution or Dexterity before rolling. On a failed save, Dexterity is reduced by 1d6 temporarily.', 1, '[{"key":"poison-of-dexterity-weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-dexterity-weakening_core_2","role":"Core ingredient 2","family":"leaf_vine","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-dexterity-weakening_core_3","role":"Core ingredient 3","family":"flower","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-dexterity-weakening_modifier","role":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","family":"any","required":false,"slot_type":"modifier","allowed_families":["monster_fluid","essence","enhancer"]}]'::jsonb, 'Venom / Poison Plant + Leaf / Vine + Flower', 'Poisons'
WHERE NOT EXISTS (SELECT 1 FROM public.recipes WHERE lower(name) = lower('Poison of Dexterity Weakening'));


UPDATE public.recipes
SET ingredient_slots = '[{"key":"poison-of-dexterity-weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-dexterity-weakening_core_2","role":"Core ingredient 2","family":"leaf_vine","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-dexterity-weakening_core_3","role":"Core ingredient 3","family":"flower","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-dexterity-weakening_modifier","role":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","family":"any","required":false,"slot_type":"modifier","allowed_families":["monster_fluid","essence","enhancer"]}]'::jsonb,
    family_formula = 'Venom / Poison Plant + Leaf / Vine + Flower',
    alchemy_section = 'Poisons',
    updated_at = now()
WHERE lower(name) IN ('poison of dexterity weakening')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


INSERT INTO public.recipes (name, description, recipe_type, discipline, rarity, base_dc, source, duration, use_text, effect_text, output_quantity, ingredient_slots, family_formula, alchemy_section)
SELECT 'Poison of Intelligence Weakening', 'The target chooses Constitution or Intelligence before rolling. On a failed save, Intelligence is reduced by 1d6 temporarily.', 'Alchemy', 'Alchemy', 'Rare', 28, 'DNDNext Alchemy Formula Guide v4', '1 hour', 'Bonus Action to use or apply', 'The target chooses Constitution or Intelligence before rolling. On a failed save, Intelligence is reduced by 1d6 temporarily.', 1, '[{"key":"poison-of-intelligence-weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-intelligence-weakening_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-intelligence-weakening_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-intelligence-weakening_modifier","role":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","family":"any","required":false,"slot_type":"modifier","allowed_families":["monster_fluid","essence","enhancer"]}]'::jsonb, 'Venom / Poison Plant + Flower + Mineral / Salt / Ash', 'Poisons'
WHERE NOT EXISTS (SELECT 1 FROM public.recipes WHERE lower(name) = lower('Poison of Intelligence Weakening'));


UPDATE public.recipes
SET ingredient_slots = '[{"key":"poison-of-intelligence-weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-intelligence-weakening_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-intelligence-weakening_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-intelligence-weakening_modifier","role":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","family":"any","required":false,"slot_type":"modifier","allowed_families":["monster_fluid","essence","enhancer"]}]'::jsonb,
    family_formula = 'Venom / Poison Plant + Flower + Mineral / Salt / Ash',
    alchemy_section = 'Poisons',
    updated_at = now()
WHERE lower(name) IN ('poison of intelligence weakening')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


INSERT INTO public.recipes (name, description, recipe_type, discipline, rarity, base_dc, source, duration, use_text, effect_text, output_quantity, ingredient_slots, family_formula, alchemy_section)
SELECT 'Poison of Strength Weakening', 'The target chooses Constitution or Strength before rolling. On a failed save, Strength is reduced by 1d6 temporarily.', 'Alchemy', 'Alchemy', 'Rare', 28, 'DNDNext Alchemy Formula Guide v4', '1 hour', 'Bonus Action to use or apply', 'The target chooses Constitution or Strength before rolling. On a failed save, Strength is reduced by 1d6 temporarily.', 1, '[{"key":"poison-of-strength-weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-strength-weakening_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-strength-weakening_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-strength-weakening_modifier","role":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","family":"any","required":false,"slot_type":"modifier","allowed_families":["monster_fluid","essence","enhancer"]}]'::jsonb, 'Venom / Poison Plant + Root + Thorn / Bark / Wood', 'Poisons'
WHERE NOT EXISTS (SELECT 1 FROM public.recipes WHERE lower(name) = lower('Poison of Strength Weakening'));


UPDATE public.recipes
SET ingredient_slots = '[{"key":"poison-of-strength-weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-strength-weakening_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-strength-weakening_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-strength-weakening_modifier","role":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","family":"any","required":false,"slot_type":"modifier","allowed_families":["monster_fluid","essence","enhancer"]}]'::jsonb,
    family_formula = 'Venom / Poison Plant + Root + Thorn / Bark / Wood',
    alchemy_section = 'Poisons',
    updated_at = now()
WHERE lower(name) IN ('poison of strength weakening')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


INSERT INTO public.recipes (name, description, recipe_type, discipline, rarity, base_dc, source, duration, use_text, effect_text, output_quantity, ingredient_slots, family_formula, alchemy_section)
SELECT 'Poison of Wisdom Weakening', 'The target chooses Constitution or Wisdom before rolling. On a failed save, Wisdom is reduced by 1d6 temporarily.', 'Alchemy', 'Alchemy', 'Rare', 28, 'DNDNext Alchemy Formula Guide v4', '1 hour', 'Bonus Action to use or apply', 'The target chooses Constitution or Wisdom before rolling. On a failed save, Wisdom is reduced by 1d6 temporarily.', 1, '[{"key":"poison-of-wisdom-weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-wisdom-weakening_core_2","role":"Core ingredient 2","family":"moss_lichen","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-wisdom-weakening_core_3","role":"Core ingredient 3","family":"flower","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-wisdom-weakening_modifier","role":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","family":"any","required":false,"slot_type":"modifier","allowed_families":["monster_fluid","essence","enhancer"]}]'::jsonb, 'Venom / Poison Plant + Moss / Lichen + Flower', 'Poisons'
WHERE NOT EXISTS (SELECT 1 FROM public.recipes WHERE lower(name) = lower('Poison of Wisdom Weakening'));


UPDATE public.recipes
SET ingredient_slots = '[{"key":"poison-of-wisdom-weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-wisdom-weakening_core_2","role":"Core ingredient 2","family":"moss_lichen","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-wisdom-weakening_core_3","role":"Core ingredient 3","family":"flower","min_rarity":"Rare","required":true,"slot_type":"core"},{"key":"poison-of-wisdom-weakening_modifier","role":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","family":"any","required":false,"slot_type":"modifier","allowed_families":["monster_fluid","essence","enhancer"]}]'::jsonb,
    family_formula = 'Venom / Poison Plant + Moss / Lichen + Flower',
    alchemy_section = 'Poisons',
    updated_at = now()
WHERE lower(name) IN ('poison of wisdom weakening')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


UPDATE public.recipes
SET ingredient_slots = '[{"key":"purple-worm-poison_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"purple-worm-poison_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"purple-worm-poison_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Very Rare","required":true,"slot_type":"core"},{"key":"purple-worm-poison_modifier","role":"Required fourth slot: Purple Worm venom or an equivalent legendary monster toxin.","family":"any","required":true,"slot_type":"modifier","allowed_families":["monster_fluid"]}]'::jsonb,
    family_formula = 'Venom / Poison Plant + Root + Sap / Resin',
    alchemy_section = 'Poisons',
    updated_at = now()
WHERE lower(name) IN ('purple worm poison')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


INSERT INTO public.recipes (name, description, recipe_type, discipline, rarity, base_dc, source, duration, use_text, effect_text, output_quantity, ingredient_slots, family_formula, alchemy_section)
SELECT 'Elixir of Charisma', 'Charisma increases by 1d4 for the duration.', 'Alchemy', 'Alchemy', 'Uncommon', 22, 'DNDNext Alchemy Formula Guide v4', '1 hour', 'Bonus Action to use or apply', 'Charisma increases by 1d4 for the duration.', 1, '[{"key":"elixir-of-charisma_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-charisma_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-charisma_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-charisma_modifier","role":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","holy_vital","essence","monster_fluid"]}]'::jsonb, 'Flower + Sap / Resin + Mineral / Salt / Ash', 'Elixirs'
WHERE NOT EXISTS (SELECT 1 FROM public.recipes WHERE lower(name) = lower('Elixir of Charisma'));


UPDATE public.recipes
SET ingredient_slots = '[{"key":"elixir-of-charisma_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-charisma_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-charisma_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-charisma_modifier","role":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","holy_vital","essence","monster_fluid"]}]'::jsonb,
    family_formula = 'Flower + Sap / Resin + Mineral / Salt / Ash',
    alchemy_section = 'Elixirs',
    updated_at = now()
WHERE lower(name) IN ('elixir of charisma')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


INSERT INTO public.recipes (name, description, recipe_type, discipline, rarity, base_dc, source, duration, use_text, effect_text, output_quantity, ingredient_slots, family_formula, alchemy_section)
SELECT 'Elixir of Constitution', 'Constitution increases by 1d4 for the duration.', 'Alchemy', 'Alchemy', 'Uncommon', 22, 'DNDNext Alchemy Formula Guide v4', '1 hour', 'Bonus Action to use or apply', 'Constitution increases by 1d4 for the duration.', 1, '[{"key":"elixir-of-constitution_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-constitution_core_2","role":"Core ingredient 2","family":"mushroom","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-constitution_core_3","role":"Core ingredient 3","family":"moss_lichen","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-constitution_modifier","role":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","holy_vital","essence","monster_fluid"]}]'::jsonb, 'Root + Mushroom + Moss / Lichen', 'Elixirs'
WHERE NOT EXISTS (SELECT 1 FROM public.recipes WHERE lower(name) = lower('Elixir of Constitution'));


UPDATE public.recipes
SET ingredient_slots = '[{"key":"elixir-of-constitution_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-constitution_core_2","role":"Core ingredient 2","family":"mushroom","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-constitution_core_3","role":"Core ingredient 3","family":"moss_lichen","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-constitution_modifier","role":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","holy_vital","essence","monster_fluid"]}]'::jsonb,
    family_formula = 'Root + Mushroom + Moss / Lichen',
    alchemy_section = 'Elixirs',
    updated_at = now()
WHERE lower(name) IN ('elixir of constitution')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


INSERT INTO public.recipes (name, description, recipe_type, discipline, rarity, base_dc, source, duration, use_text, effect_text, output_quantity, ingredient_slots, family_formula, alchemy_section)
SELECT 'Elixir of Dexterity', 'Dexterity increases by 1d4 for the duration.', 'Alchemy', 'Alchemy', 'Uncommon', 22, 'DNDNext Alchemy Formula Guide v4', '1 hour', 'Bonus Action to use or apply', 'Dexterity increases by 1d4 for the duration.', 1, '[{"key":"elixir-of-dexterity_core_1","role":"Core ingredient 1","family":"leaf_vine","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-dexterity_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-dexterity_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-dexterity_modifier","role":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","holy_vital","essence","monster_fluid"]}]'::jsonb, 'Leaf / Vine + Flower + Sap / Resin', 'Elixirs'
WHERE NOT EXISTS (SELECT 1 FROM public.recipes WHERE lower(name) = lower('Elixir of Dexterity'));


UPDATE public.recipes
SET ingredient_slots = '[{"key":"elixir-of-dexterity_core_1","role":"Core ingredient 1","family":"leaf_vine","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-dexterity_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-dexterity_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-dexterity_modifier","role":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","holy_vital","essence","monster_fluid"]}]'::jsonb,
    family_formula = 'Leaf / Vine + Flower + Sap / Resin',
    alchemy_section = 'Elixirs',
    updated_at = now()
WHERE lower(name) IN ('elixir of dexterity')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


INSERT INTO public.recipes (name, description, recipe_type, discipline, rarity, base_dc, source, duration, use_text, effect_text, output_quantity, ingredient_slots, family_formula, alchemy_section)
SELECT 'Elixir of Intelligence', 'Intelligence increases by 1d4 for the duration.', 'Alchemy', 'Alchemy', 'Uncommon', 22, 'DNDNext Alchemy Formula Guide v4', '1 hour', 'Bonus Action to use or apply', 'Intelligence increases by 1d4 for the duration.', 1, '[{"key":"elixir-of-intelligence_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-intelligence_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-intelligence_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-intelligence_modifier","role":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","holy_vital","essence","monster_fluid"]}]'::jsonb, 'Flower + Mineral / Salt / Ash + Root', 'Elixirs'
WHERE NOT EXISTS (SELECT 1 FROM public.recipes WHERE lower(name) = lower('Elixir of Intelligence'));


UPDATE public.recipes
SET ingredient_slots = '[{"key":"elixir-of-intelligence_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-intelligence_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-intelligence_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-intelligence_modifier","role":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","holy_vital","essence","monster_fluid"]}]'::jsonb,
    family_formula = 'Flower + Mineral / Salt / Ash + Root',
    alchemy_section = 'Elixirs',
    updated_at = now()
WHERE lower(name) IN ('elixir of intelligence')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


INSERT INTO public.recipes (name, description, recipe_type, discipline, rarity, base_dc, source, duration, use_text, effect_text, output_quantity, ingredient_slots, family_formula, alchemy_section)
SELECT 'Elixir of Strength', 'Strength increases by 1d4 for the duration.', 'Alchemy', 'Alchemy', 'Uncommon', 22, 'DNDNext Alchemy Formula Guide v4', '1 hour', 'Bonus Action to use or apply', 'Strength increases by 1d4 for the duration.', 1, '[{"key":"elixir-of-strength_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-strength_core_2","role":"Core ingredient 2","family":"thorn_bark_wood","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-strength_core_3","role":"Core ingredient 3","family":"mushroom","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-strength_modifier","role":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","holy_vital","essence","monster_fluid"]}]'::jsonb, 'Root + Thorn / Bark / Wood + Mushroom', 'Elixirs'
WHERE NOT EXISTS (SELECT 1 FROM public.recipes WHERE lower(name) = lower('Elixir of Strength'));


UPDATE public.recipes
SET ingredient_slots = '[{"key":"elixir-of-strength_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-strength_core_2","role":"Core ingredient 2","family":"thorn_bark_wood","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-strength_core_3","role":"Core ingredient 3","family":"mushroom","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-strength_modifier","role":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","holy_vital","essence","monster_fluid"]}]'::jsonb,
    family_formula = 'Root + Thorn / Bark / Wood + Mushroom',
    alchemy_section = 'Elixirs',
    updated_at = now()
WHERE lower(name) IN ('elixir of strength')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);


INSERT INTO public.recipes (name, description, recipe_type, discipline, rarity, base_dc, source, duration, use_text, effect_text, output_quantity, ingredient_slots, family_formula, alchemy_section)
SELECT 'Elixir of Wisdom', 'Wisdom increases by 1d4 for the duration.', 'Alchemy', 'Alchemy', 'Uncommon', 22, 'DNDNext Alchemy Formula Guide v4', '1 hour', 'Bonus Action to use or apply', 'Wisdom increases by 1d4 for the duration.', 1, '[{"key":"elixir-of-wisdom_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-wisdom_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-wisdom_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-wisdom_modifier","role":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","holy_vital","essence","monster_fluid"]}]'::jsonb, 'Moss / Lichen + Flower + Root', 'Elixirs'
WHERE NOT EXISTS (SELECT 1 FROM public.recipes WHERE lower(name) = lower('Elixir of Wisdom'));


UPDATE public.recipes
SET ingredient_slots = '[{"key":"elixir-of-wisdom_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-wisdom_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-wisdom_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Uncommon","required":true,"slot_type":"core"},{"key":"elixir-of-wisdom_modifier","role":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","family":"any","required":false,"slot_type":"modifier","allowed_families":["enhancer","holy_vital","essence","monster_fluid"]}]'::jsonb,
    family_formula = 'Moss / Lichen + Flower + Root',
    alchemy_section = 'Elixirs',
    updated_at = now()
WHERE lower(name) IN ('elixir of wisdom')
  AND (lower(coalesce(discipline, recipe_type, '')) = 'alchemy' OR discipline IS NULL);

COMMIT;

-- Verification:
-- SELECT alchemy_section, name, rarity, family_formula FROM public.recipes WHERE lower(coalesce(discipline, recipe_type, ''))='alchemy' ORDER BY alchemy_section, name;