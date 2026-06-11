-- Canonical potion renames and legendary consolidation.
BEGIN;
UPDATE public.recipes SET name='Healing Potion' WHERE lower(name) IN ('healing draught','potion of healing');
UPDATE public.recipes SET name='Potion of Anchoring' WHERE lower(name)='ironroot salve';
UPDATE public.recipes SET name='Potion of Night Vision' WHERE lower(name)='night-eye drops';
UPDATE public.recipes SET name='Potion of Physical Prowess' WHERE lower(name)='potion of climbing';
UPDATE public.recipes SET name='Potion of Quickstep' WHERE lower(name)='quickstep tonic';
UPDATE public.recipes SET name='Potion of Breath' WHERE lower(name)='potion of water breathing';
DELETE FROM public.recipes WHERE lower(name) IN ('potion of giant size','potion of storm giant strength');
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY lower(name) ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id) AS rn
  FROM public.recipes
  WHERE lower(name) IN ('healing potion','potion of anchoring','potion of night vision','potion of physical prowess','potion of quickstep','potion of breath')
)
DELETE FROM public.recipes r USING ranked x WHERE r.id=x.id AND x.rn>1;
COMMIT;
