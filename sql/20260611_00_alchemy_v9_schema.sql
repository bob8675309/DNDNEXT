-- v9 schema support for concrete areas and saving throws.
-- Safe/idempotent; run after the v8 neutral-tag migration.
BEGIN;
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS base_area_feet numeric,
  ADD COLUMN IF NOT EXISTS area_shape text,
  ADD COLUMN IF NOT EXISTS save_ability text;
COMMENT ON COLUMN public.recipes.base_area_feet IS 'Base area measurement before ingredient Area/Range bonuses.';
COMMENT ON COLUMN public.recipes.area_shape IS 'Player-facing area shape such as cone, radius burst, or radius cloud.';
COMMENT ON COLUMN public.recipes.save_ability IS 'Ability used for the brew saving throw.';
COMMIT;
