-- 20260605_alchemy_rollable_sections.sql
-- Adds player-facing Alchemy sections and concrete, modifiable brew bases.
-- Safe/idempotent: adds missing columns and backfills existing Alchemy recipes.
--
-- Important design rules:
--   * Fixed durations use base_duration_seconds.
--   * Rollable durations such as 1d4 hours remain rollable and use the
--     base_duration_dice_* columns. They are never converted to a fixed maximum.
--   * Effect dice remain rollable. Die Step upgrades the die before Effect %.
--   * Potion of Regeneration heals 1d4 at the start of each turn for 1 minute.

BEGIN;

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS alchemy_section text,
  ADD COLUMN IF NOT EXISTS base_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS base_duration_dice_count integer,
  ADD COLUMN IF NOT EXISTS base_duration_die_size integer,
  ADD COLUMN IF NOT EXISTS base_duration_unit text,
  ADD COLUMN IF NOT EXISTS base_dice_count integer,
  ADD COLUMN IF NOT EXISTS base_die_size integer,
  ADD COLUMN IF NOT EXISTS base_flat_bonus integer,
  ADD COLUMN IF NOT EXISTS base_uses integer,
  ADD COLUMN IF NOT EXISTS dice_purpose text,
  ADD COLUMN IF NOT EXISTS effect_cadence text;

COMMENT ON COLUMN public.recipes.alchemy_section IS
  'Player-facing Alchemy section: Potions, Poisons, Bombs, or Elixirs.';
COMMENT ON COLUMN public.recipes.base_duration_seconds IS
  'Fixed base duration before ingredient Duration percentage bonuses. Zero means Instant. Null when duration is rollable or open-ended.';
COMMENT ON COLUMN public.recipes.base_duration_dice_count IS
  'Number of dice rolled for a rollable duration such as 1d4 hours.';
COMMENT ON COLUMN public.recipes.base_duration_die_size IS
  'Die size for a rollable duration such as 1d4 hours.';
COMMENT ON COLUMN public.recipes.base_duration_unit IS
  'Unit for a rollable duration: rounds, seconds, minutes, hours, days, or weeks. Die Step promotes minutes to hours, hours to days, and days to weeks in the player-facing preview.';
COMMENT ON COLUMN public.recipes.base_dice_count IS
  'Number of primary effect dice before Die Step and Effect percentage bonuses.';
COMMENT ON COLUMN public.recipes.base_die_size IS
  'Primary effect die size (4,6,8,10,12) before Die Step bonuses.';
COMMENT ON COLUMN public.recipes.base_flat_bonus IS
  'Flat modifier attached to the primary effect dice, such as +2 in 2d4+2.';
COMMENT ON COLUMN public.recipes.base_uses IS
  'Fixed number of uses when a brew has a use count in addition to duration.';
COMMENT ON COLUMN public.recipes.dice_purpose IS
  'Purpose of the effect dice: healing, healing_per_turn, damage, ability_buff, ability_damage, or another supported key.';
COMMENT ON COLUMN public.recipes.effect_cadence IS
  'Player-facing repeat timing for recurring effects, such as at the start of each turn.';

-- Classify existing alchemy recipes. Explicit values are preserved.
UPDATE public.recipes
SET alchemy_section = CASE
  WHEN lower(coalesce(name, '')) ~ '\m(elixir)\M' THEN 'Elixirs'
  WHEN lower(coalesce(name, '')) ~ '\m(bomb|grenade|explosive)\M'
    OR lower(coalesce(name, '')) LIKE '%alchemist''s fire%'
    OR lower(coalesce(name, '')) LIKE '%smoke flask%'
    OR lower(coalesce(name, '')) LIKE '%acid flask%'
    THEN 'Bombs'
  WHEN lower(coalesce(name, '')) ~ '\m(poison|toxin|venom|weakening)\M'
    AND lower(coalesce(name, '')) NOT LIKE '%resistance%'
    AND lower(coalesce(name, '')) NOT LIKE '%antitoxin%'
    THEN 'Poisons'
  ELSE 'Potions'
END
WHERE (lower(coalesce(discipline, '')) = 'alchemy' OR lower(coalesce(recipe_type, '')) = 'alchemy')
  AND coalesce(alchemy_section, '') = '';

-- Preserve and parse rollable duration expressions such as 1d4 hours.
WITH parsed AS (
  SELECT id,
         regexp_match(
           lower(coalesce(duration, '')),
           '([0-9]+)\s*d\s*(4|6|8|10|12)\s*(rounds?|seconds?|minutes?|hours?|days?|weeks?)',
           'i'
         ) AS duration_match
  FROM public.recipes
  WHERE (lower(coalesce(discipline, '')) = 'alchemy' OR lower(coalesce(recipe_type, '')) = 'alchemy')
)
UPDATE public.recipes target
SET base_duration_dice_count = coalesce(target.base_duration_dice_count, (parsed.duration_match)[1]::integer),
    base_duration_die_size = coalesce(target.base_duration_die_size, (parsed.duration_match)[2]::integer),
    base_duration_unit = coalesce(
      nullif(target.base_duration_unit, ''),
      CASE
        WHEN lower((parsed.duration_match)[3]) LIKE 'round%' THEN 'rounds'
        WHEN lower((parsed.duration_match)[3]) LIKE 'second%' THEN 'seconds'
        WHEN lower((parsed.duration_match)[3]) LIKE 'minute%' THEN 'minutes'
        WHEN lower((parsed.duration_match)[3]) LIKE 'hour%' THEN 'hours'
        WHEN lower((parsed.duration_match)[3]) LIKE 'day%' THEN 'days'
        WHEN lower((parsed.duration_match)[3]) LIKE 'week%' THEN 'weeks'
        ELSE lower((parsed.duration_match)[3])
      END
    ),
    base_duration_seconds = NULL
FROM parsed
WHERE target.id = parsed.id
  AND parsed.duration_match IS NOT NULL;

-- Parse only fixed durations into seconds. Rollable durations remain null here.
UPDATE public.recipes
SET base_duration_seconds = CASE
  WHEN lower(coalesce(duration, '')) LIKE '%instant%' THEN 0
  WHEN lower(coalesce(duration, '')) ~ '([0-9]+(?:\.[0-9]+)?)\s*weeks?'
    THEN round((regexp_match(lower(duration), '([0-9]+(?:\.[0-9]+)?)\s*weeks?'))[1]::numeric * 604800)::integer
  WHEN lower(coalesce(duration, '')) ~ '([0-9]+(?:\.[0-9]+)?)\s*days?'
    THEN round((regexp_match(lower(duration), '([0-9]+(?:\.[0-9]+)?)\s*days?'))[1]::numeric * 86400)::integer
  WHEN lower(coalesce(duration, '')) ~ '([0-9]+(?:\.[0-9]+)?)\s*hours?'
    THEN round((regexp_match(lower(duration), '([0-9]+(?:\.[0-9]+)?)\s*hours?'))[1]::numeric * 3600)::integer
  WHEN lower(coalesce(duration, '')) ~ '([0-9]+(?:\.[0-9]+)?)\s*minutes?'
    THEN round((regexp_match(lower(duration), '([0-9]+(?:\.[0-9]+)?)\s*minutes?'))[1]::numeric * 60)::integer
  WHEN lower(coalesce(duration, '')) ~ '([0-9]+(?:\.[0-9]+)?)\s*rounds?'
    THEN round((regexp_match(lower(duration), '([0-9]+(?:\.[0-9]+)?)\s*rounds?'))[1]::numeric * 6)::integer
  WHEN lower(coalesce(duration, '')) ~ '([0-9]+(?:\.[0-9]+)?)\s*seconds?'
    THEN round((regexp_match(lower(duration), '([0-9]+(?:\.[0-9]+)?)\s*seconds?'))[1]::numeric)::integer
  ELSE base_duration_seconds
END
WHERE (lower(coalesce(discipline, '')) = 'alchemy' OR lower(coalesce(recipe_type, '')) = 'alchemy')
  AND base_duration_dice_count IS NULL
  AND base_duration_seconds IS NULL;

-- Parse the first concrete primary effect dice expression.
WITH parsed AS (
  SELECT id,
         regexp_match(
           coalesce(effect_text, description, ''),
           '([0-9]+)\s*d\s*(4|6|8|10|12)(?:\s*\+\s*([0-9]+))?',
           'i'
         ) AS dice_match
  FROM public.recipes
  WHERE (lower(coalesce(discipline, '')) = 'alchemy' OR lower(coalesce(recipe_type, '')) = 'alchemy')
)
UPDATE public.recipes target
SET base_dice_count = coalesce(target.base_dice_count, (parsed.dice_match)[1]::integer),
    base_die_size = coalesce(target.base_die_size, (parsed.dice_match)[2]::integer),
    base_flat_bonus = coalesce(target.base_flat_bonus, nullif((parsed.dice_match)[3], '')::integer, 0)
FROM parsed
WHERE target.id = parsed.id
  AND parsed.dice_match IS NOT NULL;

-- Parse a fixed use count such as "1 hour or 3 uses".
UPDATE public.recipes
SET base_uses = (regexp_match(lower(coalesce(duration, '') || ' ' || coalesce(use_text, '')), '([0-9]+)\s*uses?'))[1]::integer
WHERE (lower(coalesce(discipline, '')) = 'alchemy' OR lower(coalesce(recipe_type, '')) = 'alchemy')
  AND base_uses IS NULL
  AND lower(coalesce(duration, '') || ' ' || coalesce(use_text, '')) ~ '([0-9]+)\s*uses?';

-- Canonical concrete bases for dynamic formula families.
UPDATE public.recipes
SET alchemy_section = 'Potions',
    base_duration_seconds = 0,
    base_duration_dice_count = NULL,
    base_duration_die_size = NULL,
    base_duration_unit = NULL,
    base_dice_count = 2,
    base_die_size = 4,
    base_flat_bonus = 2,
    dice_purpose = 'healing',
    effect_cadence = NULL,
    duration = 'Instant'
WHERE lower(name) IN ('potion of healing', 'healing draught', 'potion of greater healing', 'potion of superior healing', 'potion of supreme healing');

UPDATE public.recipes
SET alchemy_section = 'Potions',
    base_duration_seconds = 60,
    base_duration_dice_count = NULL,
    base_duration_die_size = NULL,
    base_duration_unit = NULL,
    base_dice_count = 1,
    base_die_size = 4,
    base_flat_bonus = 0,
    dice_purpose = 'healing_per_turn',
    effect_cadence = 'at the start of each of the drinker''s turns',
    duration = '1 minute',
    effect_text = 'For 1 minute, at the start of each of the drinker''s turns, the drinker regains 1d4 hit points.'
WHERE lower(name) = 'potion of regeneration';

UPDATE public.recipes
SET alchemy_section = 'Potions',
    base_duration_seconds = 3600,
    base_duration_dice_count = NULL,
    base_duration_die_size = NULL,
    base_duration_unit = NULL,
    duration = '1 hour'
WHERE lower(name) ~ '^potion of .+ resistance$'
   OR lower(name) IN ('potion of resistance', 'potion of x resistance');

UPDATE public.recipes
SET alchemy_section = 'Elixirs',
    base_duration_seconds = 3600,
    base_duration_dice_count = NULL,
    base_duration_die_size = NULL,
    base_duration_unit = NULL,
    base_dice_count = 1,
    base_die_size = 4,
    base_flat_bonus = 0,
    dice_purpose = 'ability_buff',
    effect_cadence = NULL,
    duration = '1 hour'
WHERE lower(name) ~ '^elixir of (strength|dexterity|constitution|intelligence|wisdom|charisma)$';

UPDATE public.recipes
SET alchemy_section = 'Poisons',
    base_duration_seconds = 3600,
    base_duration_dice_count = NULL,
    base_duration_die_size = NULL,
    base_duration_unit = NULL,
    base_dice_count = 1,
    base_die_size = 6,
    base_flat_bonus = 0,
    dice_purpose = 'ability_damage',
    effect_cadence = NULL,
    duration = '1 hour'
WHERE lower(name) ~ '^poison of (strength|dexterity|constitution|intelligence|wisdom|charisma) weakening$';

-- Repair known rollable potion durations if the earlier fixed-duration migration ran.
UPDATE public.recipes
SET duration = '1d4 hours',
    base_duration_seconds = NULL,
    base_duration_dice_count = 1,
    base_duration_die_size = 4,
    base_duration_unit = 'hours'
WHERE lower(name) IN ('potion of growth', 'potion of diminution')
  AND lower(coalesce(duration, '')) IN ('4 hours', '1d4 hours');

CREATE INDEX IF NOT EXISTS recipes_alchemy_section_idx
  ON public.recipes (alchemy_section)
  WHERE alchemy_section IS NOT NULL;

COMMIT;

-- Verification:
-- SELECT name, rarity, alchemy_section, duration, base_duration_seconds,
--        base_duration_dice_count, base_duration_die_size, base_duration_unit,
--        base_dice_count, base_die_size, base_flat_bonus, dice_purpose, effect_cadence
-- FROM public.recipes
-- WHERE lower(coalesce(discipline, recipe_type, '')) = 'alchemy'
-- ORDER BY alchemy_section, rarity, name;
