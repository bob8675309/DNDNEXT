-- DNDNext Smithing Temper v3
-- Tiered elemental essences, typed dragon materials, concrete material mechanics,
-- and persistent Initial Temper / Temper +1..+3 metadata.

create or replace function private.smithing_step_die_v1(p_expression text, p_steps integer)
returns text
language plpgsql
immutable
set search_path = pg_catalog, public, private
as $$
declare
  v_match text[];
  v_sizes integer[] := array[4, 6, 8, 10, 12];
  v_index integer;
  v_new_size integer;
begin
  if nullif(p_expression, '') is null or coalesce(p_steps, 0) <= 0 then
    return p_expression;
  end if;

  v_match := regexp_match(p_expression, '(\d+)\s*d\s*(4|6|8|10|12)', 'i');
  if v_match is null then
    return p_expression;
  end if;

  v_index := array_position(v_sizes, v_match[2]::integer);
  if v_index is null then
    return p_expression;
  end if;

  v_new_size := v_sizes[least(array_length(v_sizes, 1), v_index + p_steps)];
  return regexp_replace(
    p_expression,
    '(\d+)\s*d\s*(4|6|8|10|12)',
    v_match[1] || 'd' || v_new_size::text,
    'i'
  );
end;
$$;

create or replace function private.smithing_scaled_dice_text_v1(p_expression text, p_percent numeric)
returns text
language plpgsql
immutable
set search_path = pg_catalog, public, private
as $$
declare
  v_match text[];
  v_count numeric;
  v_size integer;
  v_scaled numeric;
begin
  if nullif(p_expression, '') is null or coalesce(p_percent, 0) <= 0 then
    return coalesce(p_percent, 0)::text || '% of base weapon damage';
  end if;

  v_match := regexp_match(p_expression, '(\d+)\s*d\s*(4|6|8|10|12)', 'i');
  if v_match is null then
    return p_percent::text || '% of base weapon damage';
  end if;

  v_count := v_match[1]::numeric;
  v_size := v_match[2]::integer;
  v_scaled := v_count * p_percent / 100.0;

  if v_scaled > 0 and v_scaled = trunc(v_scaled) then
    return trunc(v_scaled)::integer::text || 'd' || v_size::text;
  end if;

  return to_char(p_percent, 'FM999999990.##') || '% of ' || v_match[1] || 'd' || v_size::text;
end;
$$;

create or replace function private.apply_structured_crafting_traits_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_selected jsonb;
  v_rules jsonb;
  v_traits jsonb;
  v_materials jsonb := '[]'::jsonb;
  v_tempering jsonb := '[]'::jsonb;
  v_existing_smithing jsonb;
  v_material jsonb;
  v_profile jsonb;
  v_material_profile jsonb := '{}'::jsonb;
  v_material_name text;
  v_material_existing boolean := false;
  v_name text;
  v_kind_blob text;
  v_is_defensive boolean;
  v_effect text;
  v_rule text;
  v_trait text;
  v_element text;
  v_initial_element text;
  v_primary_element text;
  v_stage integer;
  v_has_stage boolean;
  v_tier text;
  v_pct numeric;
  v_effective_pct numeric;
  v_total_pct numeric := 0;
  v_effective_total_pct numeric := 0;
  v_multiplier numeric := 1;
  v_save_dc_bonus integer := 0;
  v_converts_base boolean := false;
  v_affinity text[] := '{}'::text[];
  v_riders jsonb := '{}'::jsonb;
  v_absorb_investment jsonb := '{}'::jsonb;
  v_absorption jsonb := '{}'::jsonb;
  v_current numeric;
  v_effective numeric;
  v_key text;
  v_value text;
  v_entries_text text;
  v_damage_text text;
  v_original_dmg1 text;
  v_original_dmg2 text;
  v_final_dmg1 text;
  v_final_dmg2 text;
  v_die_steps integer := 0;
  v_fingerprint text;
  v_existing_fingerprint text;
  v_dice_text text;
begin
  new.card_payload := coalesce(new.card_payload, '{}'::jsonb);
  v_selected := coalesce(new.card_payload->'crafting'->'selected_materials', '[]'::jsonb);

  if jsonb_typeof(v_selected) <> 'array' or jsonb_array_length(v_selected) = 0 then
    return new;
  end if;

  v_fingerprint := md5(v_selected::text);
  v_existing_smithing := case
    when jsonb_typeof(new.card_payload->'smithing') = 'object' then new.card_payload->'smithing'
    else '{}'::jsonb
  end;
  v_existing_fingerprint := nullif(v_existing_smithing->>'selection_fingerprint', '');

  if coalesce(v_existing_smithing->>'processed_version', '') = 'structured-materials-v2'
     and v_existing_fingerprint = v_fingerprint then
    return new;
  end if;

  v_rules := case when jsonb_typeof(new.card_payload->'entries') = 'array' then new.card_payload->'entries' else '[]'::jsonb end;
  v_traits := case when jsonb_typeof(new.card_payload->'material_traits') = 'array' then new.card_payload->'material_traits' else '[]'::jsonb end;
  v_kind_blob := lower(concat_ws(' ', new.item_type, new.card_payload->>'type', new.card_payload->>'item_type', new.card_payload->>'uiType'));
  v_is_defensive := v_kind_blob ~ 'armor|shield';

  select coalesce(jsonb_agg(value), '[]'::jsonb)
  into v_rules
  from jsonb_array_elements(v_rules)
  where jsonb_typeof(value) <> 'string'
     or (value #>> '{}') !~ '^(Initial Temper|Temper \+[123]|Elemental absorption:|Base damage conversion:)';

  for v_material in select value from jsonb_array_elements(v_selected)
  loop
    if coalesce(nullif(v_material->>'name', ''), nullif(v_material->>'temper_element', ''), nullif(v_material->>'element', '')) is null then
      continue;
    end if;

    v_profile := case when jsonb_typeof(v_material->'smithing') = 'object' then v_material->'smithing' else '{}'::jsonb end;

    if coalesce(v_material->>'slot_key', '') = 'craft-material'
       or coalesce(v_material->>'slot_type', '') = 'physical'
       or coalesce(v_profile->>'kind', '') = 'material' then
      if v_material_profile = '{}'::jsonb then
        v_material_profile := v_profile;
        v_material_name := coalesce(nullif(v_material->>'name', ''), 'Selected Material');
        v_material_existing := coalesce(nullif(v_material->>'existing_work', '')::boolean, false);
      end if;
    end if;

    v_has_stage := v_material ? 'temper_stage' or v_material ? 'stage';
    if v_has_stage then
      v_stage := coalesce(nullif(v_material->>'temper_stage', '')::integer, nullif(v_material->>'stage', '')::integer, 0);
      v_element := lower(coalesce(nullif(v_material->>'temper_element', ''), nullif(v_material->>'element', ''), nullif(v_profile->>'element', ''), ''));
      if v_stage = 0 and v_element <> '' then
        v_initial_element := v_element;
      end if;
    end if;
  end loop;

  if jsonb_typeof(v_material_profile->'affinityTags') = 'array' then
    select coalesce(array_agg(lower(value)), '{}'::text[])
    into v_affinity
    from jsonb_array_elements_text(v_material_profile->'affinityTags');
  end if;

  v_multiplier := greatest(1, coalesce(nullif(v_material_profile->>'matchingEffectMultiplier', '')::numeric, 1));
  v_save_dc_bonus := coalesce(nullif(v_material_profile->>'matchingSaveDcBonus', '')::integer, 0);
  v_converts_base := coalesce(nullif(v_material_profile->>'convertsBaseDamage', '')::boolean, false);
  v_die_steps := coalesce(nullif(v_material_profile->'weaponMechanics'->>'dieSteps', '')::integer, 0);

  v_original_dmg1 := nullif(new.card_payload->>'dmg1', '');
  v_original_dmg2 := nullif(new.card_payload->>'dmg2', '');
  v_final_dmg1 := v_original_dmg1;
  v_final_dmg2 := v_original_dmg2;

  if not v_is_defensive and not v_material_existing and v_die_steps > 0 then
    v_final_dmg1 := private.smithing_step_die_v1(v_original_dmg1, v_die_steps);
    v_final_dmg2 := private.smithing_step_die_v1(v_original_dmg2, v_die_steps);
    new.card_payload := new.card_payload || jsonb_strip_nulls(jsonb_build_object(
      'dmg1', v_final_dmg1,
      'dmg2', v_final_dmg2
    ));

    v_damage_text := coalesce(new.card_payload->>'damageText', '');
    if v_damage_text <> '' and v_original_dmg1 is not null and v_final_dmg1 is not null then
      v_damage_text := replace(v_damage_text, v_original_dmg1, v_final_dmg1);
    end if;
    if v_damage_text <> '' and v_original_dmg2 is not null and v_final_dmg2 is not null then
      v_damage_text := replace(v_damage_text, v_original_dmg2, v_final_dmg2);
    end if;
    if v_damage_text <> '' then
      new.card_payload := new.card_payload || jsonb_build_object('damageText', v_damage_text);
    end if;
  end if;

  if v_material_profile <> '{}'::jsonb then
    v_effect := case
      when v_is_defensive then nullif(v_material_profile->>'defensive', '')
      else nullif(v_material_profile->>'offensive', '')
    end;

    v_materials := jsonb_build_array(jsonb_build_object(
      'name', v_material_name,
      'material_class', nullif(v_material_profile->>'materialClass', ''),
      'effect', v_effect,
      'offensive', nullif(v_material_profile->>'offensive', ''),
      'defensive', nullif(v_material_profile->>'defensive', ''),
      'risk', nullif(v_material_profile->>'risk', ''),
      'dc_modifier', coalesce(nullif(v_material_profile->>'dcModifier', '')::integer, 0),
      'affinity_tags', to_jsonb(v_affinity),
      'weapon_mechanics', coalesce(v_material_profile->'weaponMechanics', '{}'::jsonb),
      'armor_mechanics', coalesce(v_material_profile->'armorMechanics', '{}'::jsonb),
      'existing_work', v_material_existing
    ));

    v_trait := trim(both '-' from regexp_replace(lower(coalesce(v_material_name, 'material')), '[^a-z0-9]+', '-', 'g'));
    if v_trait <> '' and not (v_traits ? v_trait) then
      v_traits := v_traits || jsonb_build_array(v_trait);
    end if;

    if v_effect is not null then
      v_rule := coalesce(v_material_name, 'Craft Material') || ': ' || v_effect;
      if not (v_rules @> jsonb_build_array(v_rule)) then
        v_rules := v_rules || jsonb_build_array(v_rule);
      end if;
    end if;

    if v_is_defensive and jsonb_typeof(v_material_profile->'armorAbsorption') = 'object' then
      for v_key, v_value in select key, value from jsonb_each_text(v_material_profile->'armorAbsorption')
      loop
        v_current := coalesce(nullif(v_absorb_investment->>lower(v_key), '')::numeric, 0) + coalesce(nullif(v_value, '')::numeric, 0);
        v_absorb_investment := jsonb_set(v_absorb_investment, array[lower(v_key)], to_jsonb(v_current), true);
      end loop;
    end if;
  end if;

  for v_material in select value from jsonb_array_elements(v_selected)
  loop
    if coalesce(nullif(v_material->>'name', ''), nullif(v_material->>'temper_element', ''), nullif(v_material->>'element', '')) is null then
      continue;
    end if;

    v_profile := case when jsonb_typeof(v_material->'smithing') = 'object' then v_material->'smithing' else '{}'::jsonb end;
    v_has_stage := v_material ? 'temper_stage' or v_material ? 'stage';
    if not v_has_stage then
      continue;
    end if;

    v_stage := coalesce(nullif(v_material->>'temper_stage', '')::integer, nullif(v_material->>'stage', '')::integer, 0);
    if v_stage < 0 or v_stage > 3 then
      continue;
    end if;

    v_element := lower(coalesce(nullif(v_material->>'temper_element', ''), nullif(v_material->>'element', ''), nullif(v_profile->>'element', ''), ''));
    if v_element = '' then
      continue;
    end if;

    v_tier := lower(coalesce(nullif(v_material->>'essence_tier', ''), nullif(v_profile->>'essenceTier', ''), ''));
    v_pct := coalesce(
      nullif(v_material->>'bonus_damage_pct', '')::numeric,
      nullif(v_profile->>'damagePct', '')::numeric,
      case v_tier when 'mote' then 25 when 'shard' then 50 when 'core' then 75 else 0 end
    );
    if v_pct <= 0 then
      continue;
    end if;

    v_effective_pct := v_pct;
    if not v_is_defensive and v_element = any(v_affinity) then
      v_effective_pct := v_pct * v_multiplier;
    end if;

    v_total_pct := v_total_pct + v_pct;
    v_effective_total_pct := v_effective_total_pct + v_effective_pct;
    v_name := coalesce(nullif(v_material->>'name', ''), initcap(v_element) || ' Essence');

    v_tempering := v_tempering || jsonb_build_array(jsonb_build_object(
      'stage', v_stage,
      'slot', case when v_stage = 0 then 'initial-temper' else 'temper-' || v_stage::text end,
      'element', v_element,
      'essence_tier', nullif(v_tier, ''),
      'bonus_damage_pct', v_pct,
      'effective_bonus_damage_pct', v_effective_pct,
      'essence_dc_modifier', coalesce(nullif(v_material->>'essence_dc_modifier', '')::integer, nullif(v_profile->>'dcModifier', '')::integer, 0),
      'source_material', v_name,
      'existing_work', coalesce(nullif(v_material->>'existing_work', '')::boolean, false)
    ));

    v_trait := format('temper:%s:%s', v_stage, v_element);
    if not (v_traits ? v_trait) then
      v_traits := v_traits || jsonb_build_array(v_trait);
    end if;

    if v_is_defensive then
      v_current := coalesce(nullif(v_absorb_investment->>v_element, '')::numeric, 0) + v_pct;
      v_absorb_investment := jsonb_set(v_absorb_investment, array[v_element], to_jsonb(v_current), true);
      v_rule := format(
        '%s (%s %s): adds %s%% %s absorption investment.',
        case when v_stage = 0 then 'Initial Temper' else 'Temper +' || v_stage::text end,
        initcap(v_element),
        initcap(coalesce(nullif(v_tier, ''), 'essence')),
        to_char(v_pct, 'FM999999990.##'),
        initcap(v_element)
      );
    else
      v_current := coalesce(nullif(v_riders->>v_element, '')::numeric, 0) + v_effective_pct;
      v_riders := jsonb_set(v_riders, array[v_element], to_jsonb(v_current), true);
      v_dice_text := private.smithing_scaled_dice_text_v1(v_final_dmg1, v_effective_pct);
      v_rule := format(
        '%s (%s %s): adds %s %s damage (%s%% of base weapon damage%s).',
        case when v_stage = 0 then 'Initial Temper' else 'Temper +' || v_stage::text end,
        initcap(v_element),
        initcap(coalesce(nullif(v_tier, ''), 'essence')),
        v_dice_text,
        initcap(v_element),
        to_char(v_effective_pct, 'FM999999990.##'),
        case when v_effective_pct <> v_pct then ', enhanced by material affinity' else '' end
      );
    end if;

    if not (v_rules @> jsonb_build_array(v_rule)) then
      v_rules := v_rules || jsonb_build_array(v_rule);
    end if;
  end loop;

  if not v_is_defensive and v_converts_base and v_initial_element is not null and v_initial_element = any(v_affinity) then
    v_primary_element := v_initial_element;
    v_rule := format('Base damage conversion: the weapon''s base damage type is %s.', initcap(v_primary_element));
    if not (v_rules @> jsonb_build_array(v_rule)) then
      v_rules := v_rules || jsonb_build_array(v_rule);
    end if;

    new.card_payload := new.card_payload || jsonb_build_object(
      'dmgType', v_primary_element,
      'damageType', v_primary_element,
      'damage_type', v_primary_element,
      'primary_damage_type', v_primary_element
    );

    if v_final_dmg1 is not null then
      v_damage_text := v_final_dmg1 || ' ' || v_primary_element;
      if v_final_dmg2 is not null then
        v_damage_text := v_damage_text || ', versatile (' || v_final_dmg2 || ')';
      end if;
      new.card_payload := new.card_payload || jsonb_build_object('damageText', v_damage_text);
    end if;
  end if;

  if v_is_defensive then
    for v_key, v_value in select key, value from jsonb_each_text(v_absorb_investment)
    loop
      v_current := coalesce(nullif(v_value, '')::numeric, 0);
      v_effective := case when v_current <= 100 then v_current else 100 + (v_current - 100) / 2 end;
      v_absorption := jsonb_set(v_absorption, array[v_key], jsonb_build_object(
        'investment', v_current,
        'effective_percent', v_effective,
        'healing_percent', greatest(v_effective - 100, 0),
        'outcome', case
          when v_effective < 100 then to_char(v_effective, 'FM999999990.##') || '% damage reduction'
          when v_effective = 100 then 'Immunity'
          else 'Immunity; heal ' || to_char(v_effective - 100, 'FM999999990.##') || '% of incoming damage'
        end
      ), true);

      v_rule := format(
        'Elemental absorption: %s has %s%% investment — %s.',
        initcap(v_key),
        to_char(v_current, 'FM999999990.##'),
        v_absorption->v_key->>'outcome'
      );
      if not (v_rules @> jsonb_build_array(v_rule)) then
        v_rules := v_rules || jsonb_build_array(v_rule);
      end if;
    end loop;
  end if;

  new.card_payload := new.card_payload || jsonb_build_object(
    'entries', v_rules,
    'material_traits', v_traits,
    'smithing', v_existing_smithing || jsonb_build_object(
      'processed_version', 'structured-materials-v2',
      'selection_fingerprint', v_fingerprint,
      'materials', v_materials,
      'tempering', v_tempering,
      'affinity_tags', to_jsonb(v_affinity),
      'matching_effect_multiplier', v_multiplier,
      'matching_save_dc_bonus', v_save_dc_bonus,
      'base_damage_type', coalesce(v_primary_element, new.card_payload->>'damageType', new.card_payload->>'dmgType'),
      'primary_damage_type', v_primary_element,
      'elemental_riders', v_riders,
      'elemental_absorption', v_absorption,
      'temper_total_bonus_pct', v_total_pct,
      'temper_effective_bonus_pct', v_effective_total_pct,
      'material_die_steps', v_die_steps
    )
  );

  select string_agg(value #>> '{}', E'\n')
  into v_entries_text
  from jsonb_array_elements(v_rules)
  where jsonb_typeof(value) = 'string';

  if v_entries_text is not null then
    new.item_description := v_entries_text;
    new.card_payload := new.card_payload || jsonb_build_object('item_description', v_entries_text);
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_items_apply_structured_crafting_traits_v1 on public.inventory_items;
create trigger inventory_items_apply_structured_crafting_traits_v1
before insert or update of card_payload on public.inventory_items
for each row
execute function private.apply_structured_crafting_traits_v1();

update public.items_catalog
set merchant_tags = array_remove(array_remove(coalesce(merchant_tags, '{}'::text[]), 'smithing'), 'smithing-temper'),
    payload = coalesce(payload, '{}'::jsonb) - 'smithing'
where item_key in (
  'alchemy:modifier:fire-essence',
  'alchemy:modifier:frost-essence',
  'alchemy:modifier:storm-essence',
  'alchemy:modifier:acid-essence',
  'alchemy:modifier:poison-essence',
  'alchemy:modifier:radiant-essence',
  'alchemy:modifier:shadow-essence',
  'alchemy:modifier:force-essence',
  'alchemy:modifier:psychic-essence',
  'alchemy:modifier:thunder-essence'
);

delete from public.items_catalog where item_key = 'smithing:material:dragonhide';

with profiles(item_key, profile) as (
  values
  ('smithing:material:mithral-ingot', '{"kind":"material","materialClass":"Legendary Metal","allowedItemKinds":["weapon","ammunition","armor","shield"],"affinityTags":[],"offensive":"Reduce the finished weapon weight by half. A Heavy weapon loses the Heavy property.","defensive":"Halve the finished armor or shield weight; remove its Strength requirement and Stealth disadvantage.","weaponMechanics":{"weightMultiplier":0.5,"removeProperties":["Heavy"]},"armorMechanics":{"weightMultiplier":0.5,"removeStrengthRequirement":true,"removeStealthDisadvantage":true},"dcModifier":2,"risk":"Requires exact heat control; overheating ruins its flexibility."}'::jsonb),
  ('Adamantine Bar|WDH', '{"kind":"material","materialClass":"Legendary Metal","allowedItemKinds":["weapon","ammunition","armor","shield"],"affinityTags":[],"offensive":"Increase the weapon base damage die by two steps (d4 to d8, d6 to d10, d8/d10/d12 to d12).","defensive":"Critical hits against the bearer become normal hits.","weaponMechanics":{"dieSteps":2},"armorMechanics":{"criticalHitImmunity":true},"dcModifier":3,"risk":"Extremely difficult to shape; failed work can damage tools or waste the stock."}'::jsonb),
  ('smithing:material:orichalcum-ingot', '{"kind":"material","materialClass":"Legendary Metal","allowedItemKinds":["weapon","ammunition","armor","shield"],"affinityTags":["radiant","force"],"offensive":"Radiant or Force damage riders are increased by 25%; matching saving-throw effects gain +1 Save DC instead.","defensive":"Provides 25% Radiant and 25% Force absorption investment.","matchingEffectMultiplier":1.25,"matchingSaveDcBonus":1,"armorAbsorption":{"radiant":25,"force":25},"dcModifier":4,"risk":"Stored magic can discharge if the alloy is worked unevenly."}'::jsonb),
  ('smithing:material:cold-iron-ingot', '{"kind":"material","materialClass":"Legendary Metal","allowedItemKinds":["weapon","ammunition","armor","shield"],"affinityTags":["fey","planar"],"offensive":"The weapon counts as Cold Iron and deals 25% additional base weapon damage against Fey creatures.","defensive":"The bearer has Advantage on saving throws against Fey charm and forced planar movement.","weaponMechanics":{"targetBonusPct":25,"targetTags":["fey"]},"armorMechanics":{"saveAdvantageTags":["fey charm","forced planar movement"]},"dcModifier":3,"risk":"Never expose it to ordinary forge heat; it must be pressure-worked and rune-cooled."}'::jsonb),
  ('smithing:material:ironwood-heartwood', '{"kind":"material","materialClass":"Organic & Botanical","allowedItemKinds":["weapon","armor","shield"],"allowedWeaponFamilies":["ranged","hafted","blunt"],"affinityTags":["nature"],"offensive":"The weapon is nonmetal, retains normal durability, and can serve as a druidic spellcasting focus.","defensive":"The armor or shield is nonmetal and weighs 25% less without reducing its Armor Class.","weaponMechanics":{"nonmetal":true,"druidicFocus":true},"armorMechanics":{"nonmetal":true,"weightMultiplier":0.75},"dcModifier":2,"risk":"Must be cured slowly; hurried drying causes hidden internal splits."}'::jsonb),
  ('smithing:material:deep-coral-plate', '{"kind":"material","materialClass":"Organic & Botanical","allowedItemKinds":["armor","shield"],"affinityTags":["cold","water"],"offensive":"Not valid as the structural body of a weapon.","defensive":"Provides 25% Cold absorption investment and removes environmental penalties caused by deep-water pressure.","armorAbsorption":{"cold":25},"armorMechanics":{"deepWaterAdapted":true},"dcModifier":3,"risk":"Dries and fractures unless kept mineral-treated throughout shaping."}'::jsonb),
  ('smithing:material:umbral-chitin', '{"kind":"material","materialClass":"Organic & Botanical","allowedItemKinds":["ammunition","armor","shield"],"affinityTags":["necrotic","shadow"],"offensive":"Ammunition made from the chitin gains 25% Necrotic base-damage investment.","defensive":"Reduce the finished armor weight by 25% and add 25% Necrotic absorption investment.","weaponMechanics":{"damageInvestment":{"necrotic":25}},"armorAbsorption":{"necrotic":25},"armorMechanics":{"weightMultiplier":0.75},"dcModifier":2,"risk":"Heat destroys its structure; it must be cut, laminated, and resin-bound."}'::jsonb),
  ('smithing:material:obsidian-edgeglass', '{"kind":"material","materialClass":"Crystal & Mineral","allowedItemKinds":["weapon","ammunition"],"allowedWeaponFamilies":["blade","piercing","ammunition"],"affinityTags":[],"offensive":"Increase the weapon base damage die by one step, but a natural 1 damages the edge until repaired.","defensive":"Not valid as the structural body of armor or a shield.","weaponMechanics":{"dieSteps":1,"fragileOnNaturalOne":true},"dcModifier":2,"risk":"Exceptionally sharp and brittle; failed shaping can shatter the full piece."}'::jsonb),
  ('smithing:material:blood-glass', '{"kind":"material","materialClass":"Crystal & Mineral","allowedItemKinds":["weapon","ammunition","armor","shield"],"affinityTags":["necrotic","corruption"],"offensive":"Necrotic or Corruption damage riders are increased by 25%; matching saving-throw effects gain +1 Save DC instead.","defensive":"Provides 25% Necrotic absorption investment and Advantage on saves against Corruption effects.","matchingEffectMultiplier":1.25,"matchingSaveDcBonus":1,"armorAbsorption":{"necrotic":25},"armorMechanics":{"saveAdvantageTags":["corruption"]},"dcModifier":4,"risk":"Responds to blood and hostile magic; careless work can awaken a lingering curse."}'::jsonb),
  ('smithing:material:star-metal', '{"kind":"material","materialClass":"Crystal & Mineral","allowedItemKinds":["weapon","ammunition","armor","shield"],"affinityTags":["force","radiant"],"offensive":"Force or Radiant damage riders are increased by 25%; matching saving-throw effects gain +1 Save DC instead.","defensive":"Provides 25% Force and 25% Radiant absorption investment.","matchingEffectMultiplier":1.25,"matchingSaveDcBonus":1,"armorAbsorption":{"force":25,"radiant":25},"dcModifier":4,"risk":"Its internal charge shifts with celestial cycles and can arc during forging."}'::jsonb),
  ('smithing:material:stygian-iron', '{"kind":"material","materialClass":"Esoteric & Magical","allowedItemKinds":["weapon","ammunition","armor","shield"],"affinityTags":["fire","necrotic","corruption"],"offensive":"The Initial Temper chooses Fire or Necrotic as the weapon base damage type. Matching damage effects are increased by 50%; matching saving-throw effects gain +2 Save DC instead.","defensive":"Provides 50% Fire and 50% Necrotic absorption investment and Advantage on saves against Corruption.","convertsBaseDamage":true,"matchingEffectMultiplier":1.5,"matchingSaveDcBonus":2,"armorAbsorption":{"fire":50,"necrotic":50},"armorMechanics":{"saveAdvantageTags":["corruption"]},"dcModifier":5,"risk":"Carries corruptive resonance and should always receive a visible warning on the finished item."}'::jsonb),
  ('smithing:material:moonsilver', '{"kind":"material","materialClass":"Esoteric & Magical","allowedItemKinds":["weapon","ammunition","armor","shield"],"affinityTags":["radiant","psychic"],"offensive":"Radiant or Psychic damage riders are increased by 25%; matching saving-throw effects gain +1 Save DC instead.","defensive":"Provides 25% Radiant and 25% Psychic absorption investment; the item cannot be forcibly phased out of the bearer possession.","matchingEffectMultiplier":1.25,"matchingSaveDcBonus":1,"armorAbsorption":{"radiant":25,"psychic":25},"dcModifier":4,"risk":"Waxes and wanes with lunar phases; unstable work can partially phase out of its fittings."}'::jsonb),
  ('smithing:material:riverine', '{"kind":"material","materialClass":"Esoteric & Magical","allowedItemKinds":["weapon","ammunition","armor","shield"],"affinityTags":["force","water"],"offensive":"Force damage riders are increased by 50%, and the weapon cannot rust or be corroded.","defensive":"Provides 75% Force absorption investment and creates a watertight protective shell.","matchingEffectMultiplier":1.5,"matchingSaveDcBonus":2,"armorAbsorption":{"force":75},"armorMechanics":{"watertight":true},"dcModifier":6,"risk":"A damaged containment lattice releases the bound water and collapses the crafted section."}'::jsonb)
)
update public.items_catalog as catalog
set payload = coalesce(catalog.payload, '{}'::jsonb) || jsonb_build_object(
      'smithing', profiles.profile,
      'tags', coalesce(catalog.payload->'tags', '[]'::jsonb) || coalesce(profiles.profile->'affinityTags', '[]'::jsonb)
    ),
    merchant_tags = (
      select array_agg(distinct tag order by tag)
      from unnest(coalesce(catalog.merchant_tags, '{}'::text[]) || array['smithing','material']) as tag
    )
from profiles
where catalog.item_key = profiles.item_key;

with elements(label, element, description) as (
  values
    ('Acid', 'acid', 'caustic elemental power'),
    ('Frost', 'cold', 'cold and ice'),
    ('Fire', 'fire', 'fire and heat'),
    ('Force', 'force', 'force and arcane pressure'),
    ('Storm', 'lightning', 'lightning and storm charge'),
    ('Shadow', 'necrotic', 'death, shadow, and necrotic power'),
    ('Poison', 'poison', 'toxin and venom power'),
    ('Psychic', 'psychic', 'mind and psychic pressure'),
    ('Radiant', 'radiant', 'radiant, sun, and holy power'),
    ('Thunder', 'thunder', 'thunder and resonant force')
), tiers(tier, tier_label, rarity, damage_pct, dc_modifier, price_gp) as (
  values
    ('mote', 'Mote', 'Uncommon', 25, 2, 250::numeric),
    ('shard', 'Shard', 'Rare', 50, 4, 750::numeric),
    ('core', 'Core', 'Very Rare', 75, 6, 2500::numeric)
), essence_seed as (
  select
    'smithing:essence:' || elements.element || ':' || tiers.tier as item_key,
    elements.label || ' ' || tiers.tier_label as item_name,
    tiers.rarity,
    tiers.price_gp,
    elements.element,
    tiers.tier,
    tiers.tier_label,
    tiers.damage_pct,
    tiers.dc_modifier,
    elements.description
  from elements cross join tiers
)
insert into public.items_catalog(item_key, item_name, item_type, item_rarity, price_gp, merchant_tags, payload)
select
  item_key,
  item_name,
  'Reagent / Catalyst',
  rarity,
  price_gp,
  array['smithing','smithing-temper','essence',tier,element,lower(replace(rarity, ' ', '-'))],
  jsonb_build_object(
    'name', item_name,
    'item_name', item_name,
    'item_id', item_key,
    'item_key', item_key,
    'type', 'Reagent / Catalyst',
    'item_type', 'Reagent / Catalyst',
    'uiType', 'Reagent / Catalyst',
    'rarity', rarity,
    'item_rarity', rarity,
    'source', 'DNDNext Smithing Catalog',
    'flavor', tier_label || ' of ' || description || '.',
    'item_description', tier_label || ' of ' || description || '. Adds ' || damage_pct || '% of base weapon damage or ' || damage_pct || '% elemental absorption investment.',
    'tags', to_jsonb(array['smithing','smithing-temper','essence',tier,element]),
    'alchemy', jsonb_build_object(
      'kind', 'modifier',
      'family', 'essence',
      'familyLabel', 'Essence',
      'rarity', rarity,
      'slotType', 'modifier',
      'brewTags', jsonb_build_array(initcap(element)),
      'bonuses', jsonb_build_object('typeDirection', element),
      'craftDcReduction', 0
    ),
    'smithing', jsonb_build_object(
      'kind', 'temper',
      'materialClass', 'Elemental Essence',
      'essenceTier', tier,
      'element', element,
      'damagePct', damage_pct,
      'dcModifier', dc_modifier,
      'tags', to_jsonb(array['elemental','smithing-temper',tier,element])
    )
  )
from essence_seed
on conflict (item_key) do update
set item_name = excluded.item_name,
    item_type = excluded.item_type,
    item_rarity = excluded.item_rarity,
    price_gp = excluded.price_gp,
    merchant_tags = excluded.merchant_tags,
    payload = excluded.payload;

with dragons(dragon, element) as (
  values
    ('Black', 'acid'),
    ('White', 'cold'),
    ('Red', 'fire'),
    ('Gold', 'fire'),
    ('Brass', 'fire'),
    ('Amethyst', 'force'),
    ('Blue', 'lightning'),
    ('Bronze', 'lightning'),
    ('Topaz', 'necrotic'),
    ('Green', 'poison'),
    ('Emerald', 'psychic'),
    ('Crystal', 'radiant'),
    ('Sapphire', 'thunder')
), forms(form_key, form_name, dc_modifier, price_gp, ac_bonus) as (
  values
    ('dragonhide', 'Dragonhide', 4, 10000::numeric, 0),
    ('dragon-scale', 'Dragon Scale', 5, 12000::numeric, 1)
), dragon_seed as (
  select
    'smithing:material:' || lower(dragons.dragon) || '-' || forms.form_key as item_key,
    dragons.dragon || ' ' || forms.form_name as item_name,
    dragons.dragon,
    dragons.element,
    forms.form_key,
    forms.form_name,
    forms.dc_modifier,
    forms.price_gp,
    forms.ac_bonus
  from dragons cross join forms
)
insert into public.items_catalog(item_key, item_name, item_type, item_rarity, price_gp, merchant_tags, payload)
select
  item_key,
  item_name,
  'Monster Part',
  'Very Rare',
  price_gp,
  array['smithing','material','monster-part',form_key,element,'dragon','very-rare'],
  jsonb_build_object(
    'name', item_name,
    'item_name', item_name,
    'item_id', item_key,
    'item_key', item_key,
    'type', 'Monster Part',
    'item_type', 'Monster Part',
    'uiType', 'Monster Part',
    'rarity', 'Very Rare',
    'item_rarity', 'Very Rare',
    'source', 'DNDNext Smithing Catalog',
    'flavor', 'Elementally resonant ' || lower(form_name) || ' harvested from a ' || lower(dragon) || ' dragon.',
    'item_description', case
      when form_key = 'dragonhide' then 'Provides 50% ' || initcap(element) || ' absorption investment when used in armor or a shield.'
      else 'Provides 50% ' || initcap(element) || ' absorption investment and +1 AC when used for a complete suit or shield face.'
    end,
    'tags', to_jsonb(array['smithing','material','monster-part',form_key,element,'dragon']),
    'smithing', jsonb_build_object(
      'kind', 'material',
      'materialClass', form_name,
      'allowedItemKinds', jsonb_build_array('armor','shield'),
      'affinityTags', jsonb_build_array(element,'dragon'),
      'element', element,
      'offensive', 'Not valid as the structural body of a weapon.',
      'defensive', case
        when form_key = 'dragonhide' then 'Provides 50% ' || initcap(element) || ' absorption investment.'
        else 'Provides 50% ' || initcap(element) || ' absorption investment and +1 AC when used for a complete suit or shield face.'
      end,
      'armorAbsorption', jsonb_build_object(element, 50),
      'armorMechanics', case when ac_bonus > 0 then jsonb_build_object('acBonus', ac_bonus) else '{}'::jsonb end,
      'dcModifier', dc_modifier,
      'risk', case
        when form_key = 'dragonhide' then 'Mismatched elemental work can make the hide brittle or violently reactive.'
        else 'Scales must be aligned to their natural grain or they shear under impact.'
      end
    )
  )
from dragon_seed
on conflict (item_key) do update
set item_name = excluded.item_name,
    item_type = excluded.item_type,
    item_rarity = excluded.item_rarity,
    price_gp = excluded.price_gp,
    merchant_tags = excluded.merchant_tags,
    payload = excluded.payload;
