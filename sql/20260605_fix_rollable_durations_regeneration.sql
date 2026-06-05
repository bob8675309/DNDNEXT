-- 20260605_fix_rollable_durations_regeneration.sql
-- Run this only if the earlier 20260605_alchemy_numeric_sections.sql was already executed.
-- It restores known rollable durations and gives Potion of Regeneration a concrete
-- player-facing healing amount and cadence.

BEGIN;

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS base_duration_dice_count integer,
  ADD COLUMN IF NOT EXISTS base_duration_die_size integer,
  ADD COLUMN IF NOT EXISTS base_duration_unit text,
  ADD COLUMN IF NOT EXISTS effect_cadence text;

-- Restore the two known 1d4-hour potion durations changed by the earlier migration.
UPDATE public.recipes
SET duration = '1d4 hours',
    base_duration_seconds = NULL,
    base_duration_dice_count = 1,
    base_duration_die_size = 4,
    base_duration_unit = 'hours'
WHERE lower(name) IN ('potion of growth', 'potion of diminution')
  AND lower(coalesce(duration, '')) IN ('4 hours', '1d4 hours');

-- Parse any other rollable duration strings still present in the table.
WITH parsed AS (
  SELECT id,
         regexp_match(
           lower(coalesce(duration, '')),
           '([0-9]+)\s*d\s*(4|6|8|10|12)\s*(rounds?|seconds?|minutes?|hours?|days?|weeks?)',
           'i'
         ) AS duration_match
  FROM public.recipes
  WHERE lower(coalesce(discipline, recipe_type, '')) = 'alchemy'
)
UPDATE public.recipes target
SET base_duration_dice_count = (parsed.duration_match)[1]::integer,
    base_duration_die_size = (parsed.duration_match)[2]::integer,
    base_duration_unit = CASE
      WHEN lower((parsed.duration_match)[3]) LIKE 'round%' THEN 'rounds'
      WHEN lower((parsed.duration_match)[3]) LIKE 'second%' THEN 'seconds'
      WHEN lower((parsed.duration_match)[3]) LIKE 'minute%' THEN 'minutes'
      WHEN lower((parsed.duration_match)[3]) LIKE 'hour%' THEN 'hours'
      WHEN lower((parsed.duration_match)[3]) LIKE 'day%' THEN 'days'
      WHEN lower((parsed.duration_match)[3]) LIKE 'week%' THEN 'weeks'
      ELSE lower((parsed.duration_match)[3])
    END,
    base_duration_seconds = NULL
FROM parsed
WHERE target.id = parsed.id
  AND parsed.duration_match IS NOT NULL;

UPDATE public.recipes
SET base_duration_seconds = 60,
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

COMMIT;
