-- Read-only v9 verification.
SELECT name, rarity, alchemy_group, required_tags_any, base_dice_count, base_die_size, base_uses, base_area_feet, area_shape, save_ability
FROM public.recipes
WHERE name LIKE 'Potion of % Breath'
ORDER BY name;

SELECT name, duration, effect_text, base_dice_count, base_die_size, dice_purpose, required_tags_any, ingredient_slots
FROM public.recipes
WHERE name IN ('Potion of Growth','Potion of Diminution','Potion of Heroism')
ORDER BY name;

SELECT name, base_area_feet, area_shape, save_ability
FROM public.recipes
WHERE alchemy_section='Bombs'
ORDER BY name;

SELECT item_name,item_rarity,payload->'alchemy'->>'familyLabel' AS family,payload->'alchemy'->'brewTags' AS visible_tags
FROM public.items_catalog
WHERE item_name IN ('Holy Component','Greater Holy Component')
ORDER BY item_name;
