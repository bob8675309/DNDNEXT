-- DNDNext C3.3 prototype DATA PRESERVATION snapshot, read-only.
-- Run only against the specifically verified project as a SELECT-only operator preflight.
-- Does not install extensions, alter RLS, change data, or back up content.
-- Live counts and content digests can change from legitimate development edits.
-- Compare the same snapshot method immediately before and after an approved release.
SELECT 'private.character_spell_mastery' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM private.character_spell_mastery x
UNION ALL
SELECT 'public.ai_item_images' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.ai_item_images x
UNION ALL
SELECT 'public.alchemy_enhancer_effects' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.alchemy_enhancer_effects x
UNION ALL
SELECT 'public.alchemy_reagent_families' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.alchemy_reagent_families x
UNION ALL
SELECT 'public.alchemy_recipe_options' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.alchemy_recipe_options x
UNION ALL
SELECT 'public.campaign_item_pool_settings' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.campaign_item_pool_settings x
UNION ALL
SELECT 'public.character_spell_slots' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.character_spell_slots x
UNION ALL
SELECT 'public.character_spells' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.character_spells x
UNION ALL
SELECT 'public.character_stock' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.character_stock x
UNION ALL
SELECT 'public.craft_plans' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.craft_plans x
UNION ALL
SELECT 'public.crafting_attempts' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.crafting_attempts x
UNION ALL
SELECT 'public.crafting_material_effects' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.crafting_material_effects x
UNION ALL
SELECT 'public.crafting_recipe_rules' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.crafting_recipe_rules x
UNION ALL
SELECT 'public.encounter_spell_slots' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.encounter_spell_slots x
UNION ALL
SELECT 'public.inventory_items' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.inventory_items x
UNION ALL
SELECT 'public.items_catalog' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.items_catalog x
UNION ALL
SELECT 'public.npc_known_recipes' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.npc_known_recipes x
UNION ALL
SELECT 'public.player_recipes' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.player_recipes x
UNION ALL
SELECT 'public.recipes' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.recipes x
UNION ALL
SELECT 'public.spell_effects' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.spell_effects x
UNION ALL
SELECT 'public.spells_catalog' AS object_name, count(*)::bigint AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' ORDER BY md5(to_jsonb(x)::text)), '')) AS content_digest
FROM public.spells_catalog x
ORDER BY object_name;
