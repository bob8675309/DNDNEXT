-- DNDNext Resistance Ring order correction.
-- 2026-10-16
--
-- Campaign rule: Resistance is applied before the ring's flat elemental
-- reduction. Example: 30 Fire -> 15 after Resistance -> 5 after DR 10.

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
  'damageReductionBeforeResistance', false,
  'item_description',
    'While wearing this ring, you have Resistance to ' || r.element_label || E' damage.\n\n'
    || 'Each time you take ' || r.element_label
    || ' damage, apply Resistance first, then reduce the remaining damage by 10 (minimum 0).',
  'rulesShort',
    'While wearing this ring, you have Resistance to ' || r.element_label || E' damage.\n\n'
    || 'Each time you take ' || r.element_label
    || ' damage, apply Resistance first, then reduce the remaining damage by 10 (minimum 0).'
)
FROM rings r
WHERE ic.id=r.id;

UPDATE public.character_stock cs
SET
  price_gp=ic.price_gp,
  card_payload=ic.payload
FROM public.items_catalog ic
WHERE lower(cs.display_name)=lower(ic.item_name)
  AND ic.item_name ~* '^Ring of (Acid|Cold|Fire|Force|Lightning|Necrotic|Poison|Psychic|Radiant|Thunder) Resistance$';

CREATE OR REPLACE FUNCTION public.encounter_apply_damage_internal_v1(
  p_target_id uuid,
  p_amount integer,
  p_damage_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $function$
DECLARE
  v_t public.encounter_participants%rowtype;
  v_type text := lower(btrim(coalesce(p_damage_type,'untyped')));
  v_adjusted integer := greatest(0,coalesce(p_amount,0));
  v_after_resistance integer := greatest(0,coalesce(p_amount,0));
  v_after_flat integer := greatest(0,coalesce(p_amount,0));
  v_temp integer;
  v_hp integer;
  v_res boolean := false;
  v_imm boolean := false;
  v_vul boolean := false;
  v_equipment jsonb := '{}'::jsonb;
  v_equipment_res boolean := false;
  v_flat_reduction integer := 0;
  v_flat_applied integer := 0;
BEGIN
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Damage amount must be non-negative';
  END IF;

  SELECT *
  INTO v_t
  FROM public.encounter_participants
  WHERE id=p_target_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Damage target not found';
  END IF;

  IF v_t.character_id IS NOT NULL THEN
    v_equipment := private.encounter_equipped_damage_mitigation_v1(v_t.character_id,v_type);
    v_equipment_res := coalesce((v_equipment->>'resistant')::boolean,false);
    v_flat_reduction := greatest(0,coalesce((v_equipment->>'flatReduction')::integer,0));
  END IF;

  v_res := v_type=any(coalesce(v_t.damage_resistances,'{}'::text[]))
           OR v_equipment_res;
  v_imm := v_type=any(coalesce(v_t.damage_immunities,'{}'::text[]));
  v_vul := v_type=any(coalesce(v_t.damage_vulnerabilities,'{}'::text[]));

  IF v_imm THEN
    v_adjusted := 0;
    v_after_resistance := 0;
    v_after_flat := 0;
  ELSE
    -- DNDNext campaign order: Resistance first, then flat typed reduction.
    IF v_res THEN
      v_adjusted := floor(v_adjusted/2.0)::integer;
    END IF;
    v_after_resistance := v_adjusted;

    v_flat_applied := least(v_adjusted,v_flat_reduction);
    v_adjusted := greatest(0,v_adjusted-v_flat_reduction);
    v_after_flat := v_adjusted;

    IF v_vul THEN
      v_adjusted := v_adjusted*2;
    END IF;
  END IF;

  v_temp := coalesce(v_t.temp_hp,0);
  v_hp := coalesce(v_t.current_hp,1);

  IF v_adjusted > 0 THEN
    IF v_temp >= v_adjusted THEN
      v_temp := v_temp-v_adjusted;
    ELSE
      v_hp := greatest(0,v_hp-(v_adjusted-v_temp));
      v_temp := 0;
    END IF;
  END IF;

  UPDATE public.encounter_participants
  SET
    current_hp=v_hp,
    temp_hp=v_temp,
    is_defeated=(v_hp<=0),
    updated_at=timezone('utc',now())
  WHERE id=v_t.id;

  RETURN jsonb_build_object(
    'targetId',v_t.id,
    'damageType',v_type,
    'rawDamage',p_amount,
    'equipmentResistance',v_equipment_res,
    'damageAfterResistance',v_after_resistance,
    'flatReductionAvailable',v_flat_reduction,
    'flatReductionApplied',v_flat_applied,
    'damageAfterFlatReduction',v_after_flat,
    'mitigationSources',coalesce(v_equipment->'sources','[]'::jsonb),
    'resistant',v_res,
    'immune',v_imm,
    'vulnerable',v_vul,
    'damage',v_adjusted,
    'targetHp',v_hp,
    'targetTempHp',v_temp,
    'defeated',v_hp<=0
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.encounter_apply_damage_internal_v1(uuid,integer,text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encounter_apply_damage_internal_v1(uuid,integer,text)
  TO service_role;

COMMIT;
