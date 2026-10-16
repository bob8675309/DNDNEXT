-- DNDNext merchant item balance + Petrification bomb staged-save rules.
-- 2026-10-16
BEGIN;

-- Campaign variant: elemental Rings of Resistance are uncommon protective rings.
-- Their flat 10-point reduction applies before Resistance halves the remainder.
WITH rings AS (
  SELECT
    id,
    lower(split_part(split_part(item_name, 'Ring of ', 2), ' Resistance', 1)) AS element_key,
    initcap(split_part(split_part(item_name, 'Ring of ', 2), ' Resistance', 1)) AS element_label
  FROM public.items_catalog
  WHERE item_name ~* '^Ring of (Acid|Cold|Fire|Force|Lightning|Necrotic|Poison|Psychic|Radiant|Thunder) Resistance$'
)
UPDATE public.items_catalog ic
SET
  item_type = 'Wondrous Item',
  item_rarity = 'uncommon',
  price_gp = 2000,
  merchant_tags = ARRAY(
    SELECT DISTINCT tag
    FROM unnest(coalesce(ic.merchant_tags, '{}'::text[]) || ARRAY['jeweler']::text[]) AS tag
    WHERE tag <> ALL(ARRAY['alchemy','herbalist']::text[])
  ),
  payload = coalesce(ic.payload, '{}'::jsonb) || jsonb_build_object(
    'item_type', 'Wondrous Item',
    'uiType', 'Wondrous Item',
    'uiSubKind', 'Ring',
    'rarity', 'uncommon',
    'item_rarity', 'uncommon',
    'price_gp', 2000,
    'resist', jsonb_build_array(r.element_key),
    'damageReductionByType', jsonb_build_object(r.element_key, 10),
    'damageReductionBeforeResistance', true,
    'campaignRuleVariant', 'DNDNext elemental resistance ring',
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
WHERE ic.id = r.id;

-- Repair any already-generated merchant stock for the resistance-ring family.
UPDATE public.character_stock cs
SET
  price_gp = ic.price_gp,
  card_payload = ic.payload
FROM public.items_catalog ic
WHERE lower(cs.display_name) = lower(ic.item_name)
  AND ic.item_name ~* '^Ring of (Acid|Cold|Fire|Force|Lightning|Necrotic|Poison|Psychic|Radiant|Thunder) Resistance$';

-- The source catalogue already resolves +2 Ring of Protection correctly through
-- its inherited 2024 Ring of Protection rules. Repair stale merchant stock that
-- predated copy resolution instead of weakening the canonical catalogue row.
UPDATE public.character_stock cs
SET
  price_gp = ic.price_gp,
  card_payload = ic.payload
FROM public.items_catalog ic
WHERE lower(cs.display_name) = lower(ic.item_name)
  AND ic.item_name = '+2 Ring of Protection';

-- Bomb of Petrification uses a staged save track instead of immediate petrification.
UPDATE public.recipes
SET
  description = $petrify$Initial Saving Throw

Each creature in a 10-foot-radius cloud makes a Constitution saving throw. On a success, the bomb has no effect on that creature. On a failure, the creature is Restrained as its flesh begins to harden.

Subsequent Saves

At the end of each of its turns, a Restrained creature affected by the bomb makes another Constitution saving throw. Track successes and failures independently; they do not need to be consecutive.

3 Successes

The effect ends on that creature.

3 Failures

The creature is turned to stone and gains the Petrified condition.$petrify$,
  duration = 'Until resolved',
  effect_text = $petrify$Initial Saving Throw

Each creature in a 10-foot-radius cloud makes a Constitution saving throw. On a success, the bomb has no effect on that creature. On a failure, the creature is Restrained as its flesh begins to harden.

Subsequent Saves

At the end of each of its turns, a Restrained creature affected by the bomb makes another Constitution saving throw. Track successes and failures independently; they do not need to be consecutive.

3 Successes

The effect ends on that creature.

3 Failures

The creature is turned to stone and gains the Petrified condition.$petrify$,
  rider_save = 'Constitution',
  rider_duration = 'Until resolved',
  rider_repeat_save = 'End of each turn; 3 successes end the effect, 3 failures cause Petrified',
  condition_riders = ARRAY['Restrained','Petrified']::text[],
  updated_at = timezone('utc', now())
WHERE lower(name) = 'bomb of petrification'
  AND lower(coalesce(discipline,'')) = 'alchemy';

UPDATE public.items_catalog
SET payload =
  jsonb_set(
    coalesce(payload,'{}'::jsonb) || jsonb_build_object(
      'item_description', $petrify$Initial Saving Throw

Each creature in a 10-foot-radius cloud makes a Constitution saving throw. On a success, the bomb has no effect on that creature. On a failure, the creature is Restrained as its flesh begins to harden.

Subsequent Saves

At the end of each of its turns, a Restrained creature affected by the bomb makes another Constitution saving throw. Track successes and failures independently; they do not need to be consecutive.

3 Successes

The effect ends on that creature.

3 Failures

The creature is turned to stone and gains the Petrified condition.$petrify$,
      'rulesShort', $petrify$Initial Saving Throw

Each creature in a 10-foot-radius cloud makes a Constitution saving throw. On a success, the bomb has no effect on that creature. On a failure, the creature is Restrained as its flesh begins to harden.

Subsequent Saves

At the end of each of its turns, a Restrained creature affected by the bomb makes another Constitution saving throw. Track successes and failures independently; they do not need to be consecutive.

3 Successes

The effect ends on that creature.

3 Failures

The creature is turned to stone and gains the Petrified condition.$petrify$,
      'flavor', 'Iron sphere with a stub wick; even cold, it smells of charcoal and saltpeter.',
      'duration', 'Until resolved',
      'duration_text', 'Until resolved',
      'effect', $petrify$Initial Saving Throw

Each creature in a 10-foot-radius cloud makes a Constitution saving throw. On a success, the bomb has no effect on that creature. On a failure, the creature is Restrained as its flesh begins to harden.

Subsequent Saves

At the end of each of its turns, a Restrained creature affected by the bomb makes another Constitution saving throw. Track successes and failures independently; they do not need to be consecutive.

3 Successes

The effect ends on that creature.

3 Failures

The creature is turned to stone and gains the Petrified condition.$petrify$,
      'effect_text', $petrify$Initial Saving Throw

Each creature in a 10-foot-radius cloud makes a Constitution saving throw. On a success, the bomb has no effect on that creature. On a failure, the creature is Restrained as its flesh begins to harden.

Subsequent Saves

At the end of each of its turns, a Restrained creature affected by the bomb makes another Constitution saving throw. Track successes and failures independently; they do not need to be consecutive.

3 Successes

The effect ends on that creature.

3 Failures

The creature is turned to stone and gains the Petrified condition.$petrify$
    ),
    '{alchemy}',
    coalesce(payload->'alchemy','{}'::jsonb) || jsonb_build_object(
      'effect', $petrify$Initial Saving Throw

Each creature in a 10-foot-radius cloud makes a Constitution saving throw. On a success, the bomb has no effect on that creature. On a failure, the creature is Restrained as its flesh begins to harden.

Subsequent Saves

At the end of each of its turns, a Restrained creature affected by the bomb makes another Constitution saving throw. Track successes and failures independently; they do not need to be consecutive.

3 Successes

The effect ends on that creature.

3 Failures

The creature is turned to stone and gains the Petrified condition.$petrify$,
      'duration', 'Until resolved',
      'rider_duration', 'Until resolved',
      'rider_save', 'Constitution',
      'rider_repeat_save', 'End of each turn; 3 successes end the effect, 3 failures cause Petrified',
      'condition_riders', jsonb_build_array('Restrained','Petrified'),
      'save_progression', jsonb_build_object(
        'initialFailureCondition','Restrained',
        'repeatTiming','End of each turn',
        'successesToEnd',3,
        'failuresToPetrify',3,
        'terminalFailureCondition','Petrified',
        'consecutiveRequired',false
      )
    ),
    true
  )
WHERE lower(item_name) = 'bomb of petrification';

-- Preserve each merchant's already-selected ingredients, but reconcile the
-- finished Bomb of Petrification against the new staged-save recipe.
WITH prepared AS (
  SELECT
    cs.id,
    coalesce(
      nullif(cs.card_payload->>'base_price_gp','')::numeric,
      nullif(ic.payload->>'price_gp','')::numeric,
      ic.price_gp,
      cs.price_gp
    ) AS base_price,
    jsonb_set(
      jsonb_set(
        jsonb_set(
          coalesce(cs.card_payload,'{}'::jsonb) || jsonb_build_object(
            'item_description', $petrify$Initial Saving Throw

Each creature in a 10-foot-radius cloud makes a Constitution saving throw. On a success, the bomb has no effect on that creature. On a failure, the creature is Restrained as its flesh begins to harden.

Subsequent Saves

At the end of each of its turns, a Restrained creature affected by the bomb makes another Constitution saving throw. Track successes and failures independently; they do not need to be consecutive.

3 Successes

The effect ends on that creature.

3 Failures

The creature is turned to stone and gains the Petrified condition.$petrify$,
            'effect', $petrify$Initial Saving Throw

Each creature in a 10-foot-radius cloud makes a Constitution saving throw. On a success, the bomb has no effect on that creature. On a failure, the creature is Restrained as its flesh begins to harden.

Subsequent Saves

At the end of each of its turns, a Restrained creature affected by the bomb makes another Constitution saving throw. Track successes and failures independently; they do not need to be consecutive.

3 Successes

The effect ends on that creature.

3 Failures

The creature is turned to stone and gains the Petrified condition.$petrify$,
            'effect_text', $petrify$Initial Saving Throw

Each creature in a 10-foot-radius cloud makes a Constitution saving throw. On a success, the bomb has no effect on that creature. On a failure, the creature is Restrained as its flesh begins to harden.

Subsequent Saves

At the end of each of its turns, a Restrained creature affected by the bomb makes another Constitution saving throw. Track successes and failures independently; they do not need to be consecutive.

3 Successes

The effect ends on that creature.

3 Failures

The creature is turned to stone and gains the Petrified condition.$petrify$,
            'flavor', 'Iron sphere with a stub wick; even cold, it smells of charcoal and saltpeter.',
            'duration', 'Until resolved',
            'duration_text', 'Until resolved'
          ),
          '{alchemy}',
          coalesce(cs.card_payload->'alchemy', ic.payload->'alchemy', '{}'::jsonb) || jsonb_build_object(
            'effect', $petrify$Initial Saving Throw

Each creature in a 10-foot-radius cloud makes a Constitution saving throw. On a success, the bomb has no effect on that creature. On a failure, the creature is Restrained as its flesh begins to harden.

Subsequent Saves

At the end of each of its turns, a Restrained creature affected by the bomb makes another Constitution saving throw. Track successes and failures independently; they do not need to be consecutive.

3 Successes

The effect ends on that creature.

3 Failures

The creature is turned to stone and gains the Petrified condition.$petrify$,
            'duration', 'Until resolved',
            'rider_duration', 'Until resolved',
            'rider_save', 'Constitution',
            'rider_repeat_save', 'End of each turn; 3 successes end the effect, 3 failures cause Petrified',
            'condition_riders', jsonb_build_array('Restrained','Petrified'),
            'save_progression', jsonb_build_object(
              'initialFailureCondition','Restrained',
              'repeatTiming','End of each turn',
              'successesToEnd',3,
              'failuresToPetrify',3,
              'terminalFailureCondition','Petrified',
              'consecutiveRequired',false
            )
          ),
          true
        ),
        '{alchemy_result}',
        coalesce(cs.card_payload->'alchemy_result','{}'::jsonb) || jsonb_build_object(
          'effect', $petrify$Initial Saving Throw

Each creature in a 10-foot-radius cloud makes a Constitution saving throw. On a success, the bomb has no effect on that creature. On a failure, the creature is Restrained as its flesh begins to harden.

Subsequent Saves

At the end of each of its turns, a Restrained creature affected by the bomb makes another Constitution saving throw. Track successes and failures independently; they do not need to be consecutive.

3 Successes

The effect ends on that creature.

3 Failures

The creature is turned to stone and gains the Petrified condition.$petrify$,
          'duration', 'Until resolved'
        ),
        true
      ),
      '{merchant_craft}',
      coalesce(cs.card_payload->'merchant_craft','{}'::jsonb) || jsonb_build_object(
        'duration', 'Until resolved'
      ),
      true
    ) AS payload
  FROM public.character_stock cs
  JOIN public.items_catalog ic ON lower(ic.item_name)=lower(cs.display_name)
  WHERE lower(cs.display_name)='bomb of petrification'
),
finalized AS (
  SELECT
    id,
    private.merchant_alchemy_finalize_stock_payload_v1(payload, base_price) AS payload
  FROM prepared
)
UPDATE public.character_stock cs
SET
  card_payload = f.payload,
  price_gp = coalesce(
    nullif(f.payload->>'crafted_price_gp','')::numeric,
    nullif(f.payload->>'price_gp','')::numeric,
    cs.price_gp
  )
FROM finalized f
WHERE cs.id=f.id;

COMMIT;
