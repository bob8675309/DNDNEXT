-- 2026-10-16 merchant-crafted alchemy final-stat authority + dynamic sale pricing.
-- Fixes merchant bombs/consumables that showed base recipe prose beside enhanced
-- final stats, and prices stronger merchant-crafted results above their catalog base.
BEGIN;

CREATE OR REPLACE FUNCTION private.alchemy_measure_text_v1(p_value numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO pg_catalog, public, private
AS $$
  SELECT CASE
    WHEN p_value IS NULL THEN NULL
    WHEN p_value = trunc(p_value) THEN trunc(p_value)::bigint::text
    ELSE trim(trailing '.' from trim(trailing '0' from p_value::text))
  END;
$$;

CREATE OR REPLACE FUNCTION private.merchant_alchemy_finalize_stock_payload_v1(
  p_payload jsonb,
  p_base_price numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO pg_catalog, public, private
AS $$
DECLARE
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_craft jsonb := coalesce(v_payload->'merchant_craft', '{}'::jsonb);
  v_alchemy jsonb := coalesce(v_payload->'alchemy', '{}'::jsonb);
  v_result jsonb := coalesce(v_payload->'alchemy_result', '{}'::jsonb);
  v_totals jsonb := coalesce(v_craft->'totals', v_alchemy->'totals', v_result->'totals', '{}'::jsonb);
  v_recipe public.recipes%rowtype;
  v_base_price numeric;
  v_final_price numeric;
  v_multiplier numeric := 1;
  v_effect text;
  v_base_area numeric := 0;
  v_final_area numeric := 0;
  v_base_area_text text;
  v_final_area_text text;
  v_area_shape text;
  v_area_text text;
  v_base_duration text;
  v_final_duration text;
  v_duration_pct numeric := 0;
  v_area_pct numeric := 0;
  v_extra_doses numeric := 0;
  v_save_bonus numeric := 0;
  v_die_steps numeric := 0;
  v_base_dice text;
  v_final_dice text;
  v_base_count numeric := 0;
  v_base_size numeric := 0;
  v_final_count numeric := 0;
  v_final_size numeric := 0;
  v_base_average numeric := 0;
  v_final_average numeric := 0;
  v_damage_gain numeric := 0;
  v_area_gain numeric := 0;
  v_duration_gain numeric := 0;
  v_pricing jsonb;
BEGIN
  IF lower(coalesce(v_alchemy->>'kind','')) <> 'crafted_product'
     OR NOT coalesce(
       nullif(v_payload->>'merchant_crafted','')::boolean,
       nullif(v_alchemy->>'merchantCrafted','')::boolean,
       nullif(v_craft->>'crafted','')::boolean,
       false
     ) THEN
    RETURN v_payload;
  END IF;

  IF nullif(v_craft->>'recipe_id','') IS NOT NULL THEN
    SELECT r.*
      INTO v_recipe
      FROM public.recipes r
     WHERE r.id = (v_craft->>'recipe_id')::uuid
     LIMIT 1;
  END IF;

  v_base_price := greatest(
    1,
    coalesce(
      nullif(v_payload->>'base_price_gp','')::numeric,
      p_base_price,
      nullif(v_payload->>'price_gp','')::numeric,
      1
    )
  );

  v_effect := coalesce(
    nullif(v_result->>'effect',''),
    nullif(v_alchemy->>'effect',''),
    nullif(v_payload->>'effect_text',''),
    nullif(v_payload->>'item_description',''),
    nullif(v_payload->>'effect',''),
    ''
  );

  v_base_area := greatest(
    0,
    coalesce(
      v_recipe.base_area_feet,
      nullif(v_alchemy->>'base_area_feet','')::numeric,
      0
    )
  );
  v_final_area := greatest(
    0,
    coalesce(
      nullif(v_craft->>'area_feet','')::numeric,
      nullif(v_result->>'areaFeet','')::numeric,
      nullif(v_payload->>'area_feet','')::numeric,
      nullif(v_alchemy->>'areaFeet','')::numeric,
      v_base_area
    )
  );
  v_area_shape := coalesce(
    nullif(v_recipe.area_shape,''),
    nullif(v_alchemy->>'area_shape',''),
    'area'
  );

  IF v_base_area > 0 AND v_final_area > 0 THEN
    v_base_area_text := private.alchemy_measure_text_v1(v_base_area);
    v_final_area_text := private.alchemy_measure_text_v1(v_final_area);
    v_area_text := v_final_area_text || '-foot ' || replace(v_area_shape, '_', ' ');

    IF v_final_area IS DISTINCT FROM v_base_area AND v_effect <> '' THEN
      v_effect := replace(v_effect, v_base_area_text || '-foot-radius', v_final_area_text || '-foot-radius');
      v_effect := replace(v_effect, v_base_area_text || '-foot radius', v_final_area_text || '-foot radius');
      v_effect := replace(v_effect, v_base_area_text || '-foot ', v_final_area_text || '-foot ');
    END IF;
  END IF;

  v_base_duration := coalesce(
    nullif(v_recipe.duration,''),
    nullif(v_payload->>'base_duration',''),
    nullif(v_alchemy->>'base_duration',''),
    ''
  );
  v_final_duration := coalesce(
    nullif(v_craft->>'duration',''),
    nullif(v_result->>'duration',''),
    nullif(v_payload->>'duration',''),
    nullif(v_alchemy->>'duration',''),
    v_base_duration
  );

  v_duration_pct := greatest(0, coalesce(nullif(v_totals->>'durationPct','')::numeric,0));
  v_area_pct := greatest(0, coalesce(nullif(v_totals->>'areaPct','')::numeric,0));
  v_extra_doses := greatest(0, coalesce(nullif(v_totals->>'extraDoses','')::numeric,0));
  v_save_bonus := greatest(0, coalesce(nullif(v_totals->>'saveDcBonus','')::numeric,0));
  v_die_steps := greatest(0, coalesce(nullif(v_totals->>'dieSteps','')::numeric,0));

  v_base_dice := coalesce(
    nullif(v_craft->>'base_effect_dice',''),
    CASE
      WHEN coalesce(v_recipe.base_dice_count,0) > 0 AND coalesce(v_recipe.base_die_size,0) > 0
      THEN v_recipe.base_dice_count::text || 'd' || v_recipe.base_die_size::text
      ELSE NULL
    END
  );
  v_final_dice := coalesce(
    nullif(v_craft->>'effect_dice',''),
    nullif(v_result->>'effectDice',''),
    nullif(v_payload->>'effect_dice',''),
    nullif(v_alchemy->>'effectDice','')
  );

  IF coalesce(v_base_dice,'') ~* '^\s*[0-9]+d[0-9]+'
     AND coalesce(v_final_dice,'') ~* '^\s*[0-9]+d[0-9]+' THEN
    v_base_count := split_part(lower(v_base_dice),'d',1)::numeric;
    v_base_size := regexp_replace(split_part(lower(v_base_dice),'d',2),'[^0-9].*$','','g')::numeric;
    v_final_count := split_part(lower(v_final_dice),'d',1)::numeric;
    v_final_size := regexp_replace(split_part(lower(v_final_dice),'d',2),'[^0-9].*$','','g')::numeric;

    v_base_average := v_base_count * ((v_base_size + 1) / 2.0);
    v_final_average := v_final_count * ((v_final_size + 1) / 2.0);
    IF v_base_average > 0 THEN
      v_damage_gain := greatest(0, (v_final_average / v_base_average) - 1);
    END IF;
  END IF;

  IF v_base_area > 0 AND v_final_area > v_base_area THEN
    v_area_gain := (v_final_area / v_base_area) - 1;
  END IF;

  IF nullif(v_base_duration,'') IS NOT NULL
     AND lower(v_base_duration) NOT IN ('instant','until used','until delivered')
     AND nullif(v_final_duration,'') IS NOT NULL
     AND lower(v_final_duration) <> lower(v_base_duration) THEN
    v_duration_gain := greatest(0, v_duration_pct / 100.0);
    IF v_die_steps > 0 THEN
      v_duration_gain := v_duration_gain + (v_die_steps * 0.5);
    END IF;
  END IF;

  -- Realized-stat premium:
  --   damage/output gain 60% weight
  --   area/range gain     35% weight
  --   duration gain       25% weight
  --   each extra dose     +40%
  --   each save-DC bonus  +20%
  -- Cap at 4x the catalog base price and round upward to a 5 gp shelf price.
  v_multiplier := least(
    4.0,
    greatest(
      1.0,
      1.0
      + (v_damage_gain * 0.60)
      + (v_area_gain * 0.35)
      + (v_duration_gain * 0.25)
      + (v_extra_doses * 0.40)
      + (v_save_bonus * 0.20)
    )
  );
  v_final_price := greatest(v_base_price, ceil((v_base_price * v_multiplier) / 5.0) * 5.0);

  v_pricing := jsonb_build_object(
    'version','merchant-crafted-stats-v1',
    'basePriceGp',v_base_price,
    'salePriceGp',v_final_price,
    'multiplier',round(v_multiplier,3),
    'damagePowerGain',round(v_damage_gain,3),
    'areaGain',round(v_area_gain,3),
    'durationGain',round(v_duration_gain,3),
    'extraDoses',v_extra_doses,
    'saveDcBonus',v_save_bonus
  );

  IF v_effect <> '' THEN
    v_payload := v_payload || jsonb_build_object(
      'effect',v_effect,
      'effect_text',v_effect,
      'item_description',v_effect
    );
    v_alchemy := v_alchemy || jsonb_build_object('effect',v_effect);
    v_result := v_result || jsonb_build_object('effect',v_effect);
  END IF;

  IF v_final_area > 0 THEN
    v_payload := v_payload || jsonb_build_object('area_feet',v_final_area);
    v_alchemy := v_alchemy || jsonb_build_object(
      'areaFeet',v_final_area,
      'areaText',v_area_text,
      'area_text',v_area_text
    );
    v_result := v_result || jsonb_build_object(
      'areaFeet',v_final_area,
      'areaText',v_area_text
    );
    v_craft := v_craft || jsonb_build_object(
      'area_feet',v_final_area,
      'area_text',v_area_text
    );
  END IF;

  IF nullif(v_craft->>'save_dc','') IS NOT NULL THEN
    v_alchemy := v_alchemy || jsonb_build_object(
      'saveDc',(v_craft->>'save_dc')::integer,
      'save_dc',(v_craft->>'save_dc')::integer
    );
  END IF;

  v_craft := v_craft || jsonb_build_object('pricing',v_pricing);
  v_payload := v_payload || jsonb_build_object(
    'base_price_gp',v_base_price,
    'crafted_price_gp',v_final_price,
    'price_gp',v_final_price,
    'merchant_craft',v_craft
  );
  v_payload := jsonb_set(v_payload,'{alchemy}',v_alchemy,true);
  v_payload := jsonb_set(v_payload,'{alchemy_result}',v_result,true);

  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION private.merchant_alchemy_crafted_payload_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_name text := coalesce(p_payload->>'item_name', p_payload->>'name');
  v_recipe public.recipes%rowtype;
  v_slot jsonb;
  v_ingredient jsonb;
  v_selected jsonb := '[]'::jsonb;
  v_required_tags text[];
  v_family text;
  v_role text;
  v_slot_type text;
  v_required boolean;
  v_bonuses jsonb;
  v_effect_pct numeric := 0;
  v_duration_pct numeric := 0;
  v_area_pct numeric := 0;
  v_extra_doses integer := 0;
  v_save_bonus integer := 0;
  v_die_steps integer := 0;
  v_ingredient_line text := '';
  v_duration text;
  v_use text;
  v_effect text;
  v_save_ability text;
  v_save_dc integer;
  v_has_save boolean := false;
  v_pb integer;
  v_rarity text;
  v_base_dice_count integer := 0;
  v_base_die_size integer := 0;
  v_base_flat_bonus integer := 0;
  v_final_dice_count integer := 0;
  v_final_die_size integer := 0;
  v_final_flat_bonus integer := 0;
  v_die_sizes integer[] := array[4,6,8,10,12];
  v_die_index integer;
  v_base_dice_text text;
  v_effect_dice text;
  v_final_area numeric;
  v_alchemy jsonb;
  v_result jsonb;
  v_merchant_craft jsonb;
begin
  if v_name is null
     or lower(coalesce(v_payload->'alchemy'->>'kind', '')) <> 'crafted_product' then
    return v_payload;
  end if;

  select r.*
  into v_recipe
  from public.recipes r
  where lower(r.name) = lower(v_name)
    and lower(coalesce(r.discipline, '')) = 'alchemy'
  order by r.updated_at desc nulls last
  limit 1;

  if not found then
    return v_payload;
  end if;

  for v_slot in
    select value
    from jsonb_array_elements(coalesce(v_recipe.ingredient_slots, '[]'::jsonb))
  loop
    v_required := coalesce((v_slot->>'required')::boolean, false);
    if not v_required and random() >= 0.20 then
      continue;
    end if;

    v_family := coalesce(nullif(v_slot->>'family', ''), 'any');
    v_role := coalesce(nullif(v_slot->>'role', ''), 'Ingredient');
    v_slot_type := coalesce(nullif(v_slot->>'slot_type', ''), case when v_required then 'core' else 'modifier' end);

    select coalesce(array_agg(value), '{}'::text[])
    into v_required_tags
    from jsonb_array_elements_text(coalesce(v_slot->'required_tags_any', '[]'::jsonb));

    v_ingredient := private.merchant_alchemy_pick_ingredient_v1(v_family, v_required_tags);
    if v_ingredient is null then
      continue;
    end if;

    v_ingredient := v_ingredient || jsonb_build_object(
      'slot_role', v_role,
      'slot_type', v_slot_type,
      'required', v_required
    );
    v_selected := v_selected || jsonb_build_array(v_ingredient);

    v_bonuses := coalesce(v_ingredient->'bonuses', '{}'::jsonb);
    v_effect_pct := v_effect_pct + coalesce(nullif(v_bonuses->>'effectPct', '')::numeric, 0);
    v_duration_pct := v_duration_pct + coalesce(nullif(v_bonuses->>'durationPct', '')::numeric, 0);
    v_area_pct := v_area_pct + coalesce(nullif(v_bonuses->>'areaPct', '')::numeric, 0);
    v_extra_doses := v_extra_doses + coalesce(nullif(v_bonuses->>'extraDoses', '')::integer, 0);
    v_save_bonus := v_save_bonus + coalesce(nullif(v_bonuses->>'saveDcBonus', '')::integer, 0);
    v_die_steps := v_die_steps + coalesce(nullif(v_bonuses->>'dieSteps', '')::integer, 0);

    v_ingredient_line := v_ingredient_line
      || case when v_ingredient_line = '' then '' else '; ' end
      || v_role || ': ' || (v_ingredient->>'name')
      || ' (' || coalesce(v_ingredient->>'family_label', v_ingredient->>'family', 'Ingredient')
      || ', ' || coalesce(v_ingredient->>'rarity', 'Common') || ')';
  end loop;

  v_rarity := coalesce(nullif(v_recipe.rarity, ''), nullif(v_payload->>'item_rarity', ''), nullif(v_payload->>'rarity', ''), 'Common');
  v_pb := case lower(replace(v_rarity, ' ', ''))
    when 'common' then 2
    when 'uncommon' then 3
    when 'rare' then 4
    when 'veryrare' then 5
    when 'legendary' then 6
    else 2
  end;

  v_use := coalesce(nullif(v_recipe.use_text, ''), nullif(v_payload->'alchemy'->>'use', ''), nullif(v_payload->>'use', ''), 'Bonus Action to use or apply');
  v_duration := private.merchant_alchemy_duration_v1(
    coalesce(nullif(v_recipe.duration, ''), nullif(v_payload->'alchemy'->>'duration', ''), nullif(v_payload->>'duration', ''), 'Until used'),
    v_duration_pct,
    v_die_steps
  );
  v_effect := coalesce(nullif(v_recipe.effect_text, ''), nullif(v_payload->'alchemy'->>'effect', ''), nullif(v_payload->>'effect_text', ''), nullif(v_payload->>'item_description', ''), 'See item text.');
  v_effect := replace(replace(v_effect, 'for Until', 'until'), 'for until', 'until');
  if nullif(v_recipe.duration, '') is not null and v_duration is distinct from v_recipe.duration then
    v_effect := replace(v_effect, v_recipe.duration, v_duration);
  end if;

  -- Match the player crafting preview for formulas with stored effect dice:
  -- percentage bonuses add only complete dice and scale the attached flat bonus
  -- proportionally; die-step bonuses change die size before display.
  v_base_dice_count := greatest(0, coalesce(v_recipe.base_dice_count, 0));
  v_base_die_size := greatest(0, coalesce(v_recipe.base_die_size, 0));
  v_base_flat_bonus := coalesce(v_recipe.base_flat_bonus, 0);
  if v_base_dice_count > 0 and v_base_die_size > 0 then
    v_final_dice_count := v_base_dice_count + floor(v_base_dice_count * v_effect_pct / 100.0)::integer;
    v_die_index := coalesce(array_position(v_die_sizes, v_base_die_size), 1);
    v_die_index := greatest(1, least(array_length(v_die_sizes, 1), v_die_index + greatest(0, v_die_steps)));
    v_final_die_size := v_die_sizes[v_die_index];
    v_final_flat_bonus := v_base_flat_bonus + floor(abs(v_base_flat_bonus) * v_effect_pct / 100.0)::integer * case when v_base_flat_bonus < 0 then -1 else 1 end;
    v_base_dice_text := v_base_dice_count::text || 'd' || v_base_die_size::text;
    v_effect_dice := v_final_dice_count::text || 'd' || v_final_die_size::text
      || case
        when v_final_flat_bonus > 0 then ' + ' || v_final_flat_bonus::text
        when v_final_flat_bonus < 0 then ' - ' || abs(v_final_flat_bonus)::text
        else ''
      end;

    if v_base_flat_bonus > 0 then
      v_effect := replace(v_effect, v_base_dice_text || ' + ' || v_base_flat_bonus::text, v_effect_dice);
      v_effect := replace(v_effect, v_base_dice_text || '+' || v_base_flat_bonus::text, v_effect_dice);
    elsif v_base_flat_bonus < 0 then
      v_effect := replace(v_effect, v_base_dice_text || ' - ' || abs(v_base_flat_bonus)::text, v_effect_dice);
      v_effect := replace(v_effect, v_base_dice_text || '-' || abs(v_base_flat_bonus)::text, v_effect_dice);
    else
      v_effect := replace(v_effect, v_base_dice_text, v_effect_dice);
    end if;
  end if;

  if coalesce(v_recipe.base_area_feet, 0) > 0 then
    v_final_area := v_recipe.base_area_feet * (1 + v_area_pct / 100.0);
  end if;

  v_save_ability := coalesce(
    nullif(v_recipe.save_ability, ''),
    nullif(v_recipe.rider_save, ''),
    nullif(v_payload->>'save_ability', ''),
    nullif(v_payload->'alchemy'->>'saveAbility', '')
  );
  v_has_save := v_save_ability is not null or v_effect ~* '(saving throw|(^|[^a-z])save([^a-z]|$))';
  if v_has_save then
    v_save_ability := coalesce(v_save_ability, 'Dexterity');
    v_save_dc := 8 + (v_pb * 2) + v_save_bonus;
  end if;

  v_merchant_craft := jsonb_strip_nulls(jsonb_build_object(
    'version', 'merchant-alchemy-v1',
    'crafted', true,
    'recipe_id', v_recipe.id,
    'recipe_name', v_recipe.name,
    'formula_rarity', v_rarity,
    'proficiency_bonus', v_pb,
    'save_dc', v_save_dc,
    'save_ability', v_save_ability,
    'duration', v_duration,
    'use', v_use,
    'effect_dice', v_effect_dice,
    'base_effect_dice', v_base_dice_text,
    'area_feet', v_final_area,
    'doses', 1 + v_extra_doses,
    'ingredients', v_selected,
    'ingredient_line', nullif(v_ingredient_line, ''),
    'ingredient_rarity_weights', jsonb_build_object('Common', 55, 'Uncommon', 40, 'Rare', 5),
    'totals', jsonb_build_object(
      'effectPct', v_effect_pct,
      'durationPct', v_duration_pct,
      'areaPct', v_area_pct,
      'extraDoses', v_extra_doses,
      'saveDcBonus', v_save_bonus,
      'dieSteps', v_die_steps
    )
  ));

  v_alchemy := coalesce(v_payload->'alchemy', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'merchantCrafted', true,
    'merchantCraftVersion', 'merchant-alchemy-v1',
    'use', v_use,
    'duration', v_duration,
    'effect', v_effect,
    'effectDice', v_effect_dice,
    'areaFeet', v_final_area,
    'doses', 1 + v_extra_doses,
    'saveDc', v_save_dc,
    'saveAbility', v_save_ability,
    'selectedIngredients', v_selected,
    'ingredientLine', nullif(v_ingredient_line, ''),
    'totals', v_merchant_craft->'totals'
  ));

  v_result := coalesce(v_payload->'alchemy_result', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'use', v_use,
    'duration', v_duration,
    'effect', v_effect,
    'effectDice', v_effect_dice,
    'areaFeet', v_final_area,
    'doses', 1 + v_extra_doses,
    'saveDcPreview', case when v_save_dc is null then null else jsonb_build_object(
      'dc', v_save_dc,
      'saveAbility', v_save_ability,
      'formula', '8 + (merchant proficiency × 2) + ingredient bonuses'
    ) end,
    'selectedIngredients', v_selected,
    'ingredientLine', nullif(v_ingredient_line, ''),
    'totals', v_merchant_craft->'totals'
  ));

  v_payload := v_payload || jsonb_strip_nulls(jsonb_build_object(
    'duration', v_duration,
    'duration_text', v_duration,
    'use', v_use,
    'use_text', v_use,
    'effect', v_effect,
    'effect_text', v_effect,
    'item_description', v_effect,
    'effect_dice', v_effect_dice,
    'area_feet', v_final_area,
    'charges', 1 + v_extra_doses,
    'save_dc', v_save_dc,
    'save_ability', v_save_ability,
    'selected_ingredients', v_selected,
    'ingredient_line', nullif(v_ingredient_line, ''),
    'merchant_crafted', true,
    'merchant_craft_version', 'merchant-alchemy-v1',
    'merchant_craft', v_merchant_craft
  ));

  v_payload := jsonb_set(v_payload, '{alchemy}', v_alchemy, true);
  v_payload := jsonb_set(v_payload, '{alchemy_result}', v_result, true);
  return private.merchant_alchemy_finalize_stock_payload_v1(
    v_payload,
    coalesce(
      nullif(v_payload->>'base_price_gp', '')::numeric,
      nullif(p_payload->>'base_price_gp', '')::numeric,
      nullif(p_payload->>'price_gp', '')::numeric,
      1
    )
  );
end;
$function$
;


CREATE OR REPLACE FUNCTION private.character_stock_sync_crafted_price_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public, private
AS $$
DECLARE
  v_price numeric;
BEGIN
  IF lower(coalesce(NEW.card_payload->'alchemy'->>'kind',''))='crafted_product'
     AND coalesce(
       nullif(NEW.card_payload->>'merchant_crafted','')::boolean,
       nullif(NEW.card_payload->'alchemy'->>'merchantCrafted','')::boolean,
       nullif(NEW.card_payload->'merchant_craft'->>'crafted','')::boolean,
       false
     ) THEN
    v_price := coalesce(
      nullif(NEW.card_payload->>'crafted_price_gp','')::numeric,
      nullif(NEW.card_payload->>'price_gp','')::numeric
    );
    IF v_price IS NOT NULL AND v_price > 0 THEN
      NEW.price_gp := v_price;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS character_stock_sync_crafted_price_v1 ON public.character_stock;
CREATE TRIGGER character_stock_sync_crafted_price_v1
BEFORE INSERT OR UPDATE OF card_payload
ON public.character_stock
FOR EACH ROW
EXECUTE FUNCTION private.character_stock_sync_crafted_price_v1();

-- Preserve the current random ingredient rolls; only reconcile final text and
-- price from the already-generated merchant_craft/alchemy_result payload.
UPDATE public.character_stock cs
SET card_payload = private.merchant_alchemy_finalize_stock_payload_v1(
  cs.card_payload,
  coalesce(
    nullif(cs.card_payload->>'base_price_gp','')::numeric,
    nullif(cs.card_payload->>'price_gp','')::numeric,
    cs.price_gp
  )
)
WHERE jsonb_typeof(cs.card_payload)='object'
  AND lower(coalesce(cs.card_payload->'alchemy'->>'kind',''))='crafted_product'
  AND coalesce(
    nullif(cs.card_payload->>'merchant_crafted','')::boolean,
    nullif(cs.card_payload->'alchemy'->>'merchantCrafted','')::boolean,
    nullif(cs.card_payload->'merchant_craft'->>'crafted','')::boolean,
    false
  );

COMMIT;
