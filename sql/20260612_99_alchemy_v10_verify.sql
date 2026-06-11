-- v10 verification queries.
SELECT name,rarity,duration,base_dice_count,base_die_size,required_tags_any,tag_label,effect_text
FROM public.recipes
WHERE name IN ('Healing Potion','Potion of Anchoring','Potion of Night Vision','Potion of Physical Prowess','Potion of Growth','Potion of Diminution','Potion of Heroism','Potion of Flying','Potion of Invulnerability','Potion of Quickstep','Potion of Breath','Potion of Storm Giant Transformation')
ORDER BY name;

SELECT name,rarity,base_dice_count,base_die_size,base_area_feet,area_shape,save_ability
FROM public.recipes WHERE alchemy_group='Elemental Breath Potions' ORDER BY name;

SELECT item_name,item_rarity,payload->'alchemy'->>'familyLabel' AS family,payload->'alchemy'->'brewTags' AS tags
FROM public.items_catalog WHERE item_name IN ('Holy Component','Greater Holy Component','Storm Giant Blood') ORDER BY item_name;
