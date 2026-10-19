-- Follow-up correction for elemental key extraction in the resistance-ring balance migration.
BEGIN;

WITH rings AS (
  SELECT
    id,
    lower(split_part(split_part(item_name, 'Ring of ', 2), ' Resistance', 1)) AS element_key,
    initcap(split_part(split_part(item_name, 'Ring of ', 2), ' Resistance', 1)) AS element_label
  FROM public.items_catalog
  WHERE item_name ~* '^Ring of (Acid|Cold|Fire|Force|Lightning|Necrotic|Poison|Psychic|Radiant|Thunder) Resistance$'
)
UPDATE public.items_catalog ic
SET payload = coalesce(ic.payload,'{}'::jsonb) || jsonb_build_object(
  'resist', jsonb_build_array(r.element_key),
  'damageReductionByType', jsonb_build_object(r.element_key, 10),
  'item_description',
    'While wearing this ring, you have Resistance to ' || r.element_label || E' damage.\n\n'
    || 'Each time you take ' || r.element_label
    || ' damage, reduce that damage by 10 (minimum 0), then apply Resistance to the remaining damage.',
  'rulesShort',
    'While wearing this ring, you have Resistance to ' || r.element_label || E' damage.\n\n'
    || 'Each time you take ' || r.element_label
    || ' damage, reduce that damage by 10 (minimum 0), then apply Resistance to the remaining damage.'
)
FROM rings r
WHERE ic.id=r.id;

UPDATE public.character_stock cs
SET price_gp=ic.price_gp, card_payload=ic.payload
FROM public.items_catalog ic
WHERE lower(cs.display_name)=lower(ic.item_name)
  AND ic.item_name ~* '^Ring of (Acid|Cold|Fire|Force|Lightning|Necrotic|Poison|Psychic|Radiant|Thunder) Resistance$';

COMMIT;
