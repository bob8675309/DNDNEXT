-- 2026-10-16 shared portrait-library semantic metadata backfill.
-- Uses existing portrait assets; no portrait assignment or binary image is replaced.
BEGIN;

WITH classified AS (
  SELECT
    id,
    lower(concat_ws(' ', name, category, array_to_string(tags,' '), array_to_string(theme_tags,' '))) AS hay
  FROM public.npc_portrait_library
),
derived AS (
  SELECT
    id,
    (
      '{}'::text[]
      || CASE WHEN hay ~ '\\m(merchant|shopkeeper|trader|broker)\\M' THEN ARRAY['merchant','merchant-friendly']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\m(smith|forge|weaponsmith|armorer)\\M' THEN ARRAY['smith','merchant-friendly']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\mapothecary\\M' THEN ARRAY['apothecary','merchant-friendly']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\mherbalist\\M' THEN ARRAY['herbalist','merchant-friendly']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\malchemist\\M' THEN ARRAY['alchemist','merchant-friendly']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\mjeweler\\M' THEN ARRAY['jeweler','merchant-friendly']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\m(scribe|clerk|scholar)\\M' THEN ARRAY['scribe','merchant-friendly']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\m(cook|tavernkeeper|innkeeper)\\M' THEN ARRAY['hospitality','merchant-friendly']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\m(potter|candlemaker)\\M' THEN ARRAY['artisan','merchant-friendly']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\m(courier|dockworker|caravan|outfitter|stablemaster)\\M' THEN ARRAY['travel']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\mguard\\M' THEN ARRAY['guard']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\m(hunter|scout)\\M' THEN ARRAY['hunter']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\m(priest|temple)\\M' THEN ARRAY['priest']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\m(noble|chieftain|matriarch)\\M' THEN ARRAY['noble']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\m(warlock|wizard|mage)\\M' THEN ARRAY['arcane-practitioner']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\mlaborer\\M' THEN ARRAY['laborer']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\mbard\\M' THEN ARRAY['bard']::text[] ELSE '{}'::text[] END
    ) AS profession_add,
    (
      '{}'::text[]
      || CASE WHEN hay ~ '\\m(merchant|shopkeeper|trader|broker)\\M' THEN ARRAY['market']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\m(smith|forge|weaponsmith|armorer)\\M' THEN ARRAY['forge']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\m(apothecary|herbalist)\\M' THEN ARRAY['herbal']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\m(alchemist|warlock|wizard|mage)\\M' THEN ARRAY['arcane']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\mjeweler\\M' THEN ARRAY['jewelry']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\mforest\\M' THEN ARRAY['forest']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\mdesert\\M' THEN ARRAY['desert']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\munderworld\\M' THEN ARRAY['underworld']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\mstreet\\M' THEN ARRAY['urban']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\mtemple\\M' THEN ARRAY['temple']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\mtavern\\M' THEN ARRAY['tavern']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\mswamp\\M' THEN ARRAY['swamp']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\mnoble\\M' THEN ARRAY['noble']::text[] ELSE '{}'::text[] END
      || CASE WHEN hay ~ '\\mghost\\M' THEN ARRAY['ghostly']::text[] ELSE '{}'::text[] END
    ) AS theme_add
  FROM classified
)
UPDATE public.npc_portrait_library p
SET
  profession_tags = ARRAY(
    SELECT DISTINCT value
    FROM unnest(coalesce(p.profession_tags,'{}'::text[]) || d.profession_add) AS value
    WHERE nullif(btrim(value),'') IS NOT NULL
    ORDER BY value
  ),
  theme_tags = ARRAY(
    SELECT DISTINCT value
    FROM unnest(coalesce(p.theme_tags,'{}'::text[]) || d.theme_add) AS value
    WHERE nullif(btrim(value),'') IS NOT NULL
    ORDER BY value
  ),
  updated_at = now()
FROM derived d
WHERE p.id=d.id
  AND (
    cardinality(d.profession_add) > 0
    OR cardinality(d.theme_add) > 0
  );

COMMIT;
