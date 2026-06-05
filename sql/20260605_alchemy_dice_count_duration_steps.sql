-- 20260605_alchemy_dice_count_duration_steps.sql
-- Documents the player-facing dice scaling rules used by the Alchemy preview.
-- Safe/idempotent: no destructive data changes.
--
-- Rules implemented in pages/items.js:
--   * Every complete Effect +100% adds another full set of the formula's
--     base effect dice. Example: 1d4 -> 2d4.
--   * Die step applies after dice-count growth. Example: 2d4 -> 2d6.
--   * Every complete Duration +100% adds another full set of rollable
--     duration dice. Example: 1d4 minutes -> 2d4 minutes.
--   * Die step promotes duration units: minutes -> hours -> days -> weeks.
--   * Partial 25/50/75% bonuses remain banked in the preview until another
--     ingredient completes the next +100% block.

BEGIN;

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS base_duration_dice_count integer,
  ADD COLUMN IF NOT EXISTS base_duration_die_size integer,
  ADD COLUMN IF NOT EXISTS base_duration_unit text,
  ADD COLUMN IF NOT EXISTS base_dice_count integer,
  ADD COLUMN IF NOT EXISTS base_die_size integer,
  ADD COLUMN IF NOT EXISTS base_flat_bonus integer;

COMMENT ON COLUMN public.recipes.base_duration_dice_count IS
  'Base number of rollable duration dice. Each complete Duration +100% adds another full set of these dice.';
COMMENT ON COLUMN public.recipes.base_duration_die_size IS
  'Base duration die size. Duration Die Step promotes the duration unit rather than this die size.';
COMMENT ON COLUMN public.recipes.base_duration_unit IS
  'Rollable duration unit. Player-facing Die Step promotes minutes to hours, hours to days, and days to weeks.';
COMMENT ON COLUMN public.recipes.base_dice_count IS
  'Base number of primary effect dice. Each complete Effect +100% adds another full set of these dice.';
COMMENT ON COLUMN public.recipes.base_die_size IS
  'Primary effect die size before Die Step (d4, d6, d8, d10, or d12).';
COMMENT ON COLUMN public.recipes.base_flat_bonus IS
  'Flat modifier attached to the primary effect dice; Effect percentage increases dice count and does not multiply this flat modifier.';

UPDATE public.recipes
SET base_duration_unit = 'weeks'
WHERE lower(coalesce(base_duration_unit, '')) IN ('week', 'weeks');

COMMIT;
