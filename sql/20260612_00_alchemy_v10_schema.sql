-- DNDNext Alchemy v10 schema guard. Safe/idempotent.
BEGIN;
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS base_area_feet integer,
  ADD COLUMN IF NOT EXISTS area_shape text,
  ADD COLUMN IF NOT EXISTS save_ability text,
  ADD COLUMN IF NOT EXISTS required_tags_any text[],
  ADD COLUMN IF NOT EXISTS tag_label text,
  ADD COLUMN IF NOT EXISTS alchemy_group text,
  ADD COLUMN IF NOT EXISTS template_key text;
COMMIT;
