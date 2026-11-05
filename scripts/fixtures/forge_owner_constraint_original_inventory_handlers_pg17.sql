-- EXACT ORIGINAL LIVE DnDWeb pg_get_functiondef, read-only 2026-11-05.
-- Source original inventory BEFORE row handlers for disposable Forge JWT case J78-J85.
-- DO NOT APPLY TO PRODUCTION; not a migration.

-- md5(pg_get_functiondef): private.apply_smithing_affinity_polish_v4() = 5d51cf335ff880939ae0df4c4152bdbd
CREATE OR REPLACE FUNCTION private.apply_smithing_affinity_polish_v4()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_selected jsonb;
  v_material jsonb;
  v_profile jsonb;
  v_material_profile jsonb := '{}'::jsonb;
  v_affinity text[] := '{}'::text[];
  v_initial_element text;
  v_element text;
  v_stage integer;
  v_tier text;
  v_pct numeric;
  v_multiplier numeric := 1;
  v_matching_effect_pct numeric := 0;
  v_save_dc_bonus integer := 0;
  v_is_defensive boolean;
  v_converts_base boolean := false;
  v_conversion_mode text := 'matching';
  v_smithing jsonb;
  v_rules jsonb;
  v_rule text;
  v_entries_text text;
  v_dmg1 text;
  v_dmg2 text;
  v_damage_text text;
begin
  new.card_payload := coalesce(new.card_payload, '{}'::jsonb);
  v_selected := coalesce(new.card_payload->'crafting'->'selected_materials', '[]'::jsonb);

  if jsonb_typeof(v_selected) <> 'array' or jsonb_array_length(v_selected) = 0 then
    return new;
  end if;

  v_is_defensive := lower(concat_ws(' ', new.item_type, new.card_payload->>'type', new.card_payload->>'item_type', new.card_payload->>'uiType')) ~ 'armor|shield';

  for v_material in select value from jsonb_array_elements(v_selected)
  loop
    v_profile := case when jsonb_typeof(v_material->'smithing') = 'object' then v_material->'smithing' else '{}'::jsonb end;

    if v_material_profile = '{}'::jsonb and (
      coalesce(v_material->>'slot_key', '') = 'craft-material'
      or coalesce(v_material->>'slot_type', '') = 'physical'
      or coalesce(v_profile->>'kind', '') = 'material'
    ) then
      v_material_profile := v_profile;
    end if;

    if v_material ? 'temper_stage' or v_material ? 'stage' then
      v_stage := coalesce(nullif(v_material->>'temper_stage', '')::integer, nullif(v_material->>'stage', '')::integer, 0);
      if v_stage = 0 then
        v_initial_element := lower(coalesce(
          nullif(v_material->>'temper_element', ''),
          nullif(v_material->>'element', ''),
          nullif(v_profile->>'element', ''),
          ''
        ));
      end if;
    end if;
  end loop;

  if jsonb_typeof(v_material_profile->'affinityTags') = 'array' then
    select coalesce(array_agg(lower(value)), '{}'::text[])
    into v_affinity
    from jsonb_array_elements_text(v_material_profile->'affinityTags') as tags(value)
    where lower(value) = any(array['acid','cold','fire','force','lightning','necrotic','poison','psychic','radiant','thunder']::text[]);
  end if;

  v_multiplier := greatest(1, coalesce(nullif(v_material_profile->>'matchingEffectMultiplier', '')::numeric, 1));
  v_conversion_mode := lower(coalesce(nullif(v_material_profile->>'baseDamageConversion', ''), case when coalesce(nullif(v_material_profile->>'convertsBaseDamage', '')::boolean, true) then 'matching' else 'none' end));

  for v_material in select value from jsonb_array_elements(v_selected)
  loop
    if not (v_material ? 'temper_stage' or v_material ? 'stage') then
      continue;
    end if;

    v_profile := case when jsonb_typeof(v_material->'smithing') = 'object' then v_material->'smithing' else '{}'::jsonb end;
    v_element := lower(coalesce(
      nullif(v_material->>'temper_element', ''),
      nullif(v_material->>'element', ''),
      nullif(v_profile->>'element', ''),
      ''
    ));
    if v_element = '' or not (v_element = any(v_affinity)) then
      continue;
    end if;

    v_tier := lower(coalesce(nullif(v_material->>'essence_tier', ''), nullif(v_profile->>'essenceTier', ''), ''));
    v_pct := coalesce(
      nullif(v_material->>'bonus_damage_pct', '')::numeric,
      nullif(v_profile->>'damagePct', '')::numeric,
      case v_tier when 'mote' then 25 when 'shard' then 50 when 'core' then 75 else 0 end
    );
    v_matching_effect_pct := v_matching_effect_pct + greatest(v_pct, 0) * v_multiplier;
  end loop;

  v_save_dc_bonus := floor(v_matching_effect_pct / 100.0)::integer;
  v_converts_base := not v_is_defensive
    and v_conversion_mode <> 'none'
    and nullif(v_initial_element, '') is not null
    and v_initial_element = any(v_affinity);

  if v_converts_base then
    new.card_payload := new.card_payload || jsonb_build_object(
      'dmgType', v_initial_element,
      'damageType', v_initial_element,
      'damage_type', v_initial_element,
      'primary_damage_type', v_initial_element
    );

    v_dmg1 := nullif(new.card_payload->>'dmg1', '');
    v_dmg2 := nullif(new.card_payload->>'dmg2', '');
    if v_dmg1 is not null then
      v_damage_text := v_dmg1 || ' ' || v_initial_element;
      if v_dmg2 is not null then
        v_damage_text := v_damage_text || ', versatile (' || v_dmg2 || ')';
      end if;
      new.card_payload := new.card_payload || jsonb_build_object('damageText', v_damage_text);
    end if;
  end if;

  v_smithing := case when jsonb_typeof(new.card_payload->'smithing') = 'object' then new.card_payload->'smithing' else '{}'::jsonb end;
  v_smithing := (v_smithing - 'matchingSaveDcBonus' - 'matching_save_dc_bonus' - 'convertsBaseDamage') || jsonb_build_object(
    'save_dc_per_effect_pct', 100,
    'matching_effect_pct', v_matching_effect_pct,
    'matching_save_dc_bonus', v_save_dc_bonus,
    'generic_affinity_conversion', v_converts_base,
    'primary_damage_type', case when v_converts_base then v_initial_element else v_smithing->>'primary_damage_type' end
  );
  new.card_payload := new.card_payload || jsonb_build_object('smithing', v_smithing);

  v_rules := case when jsonb_typeof(new.card_payload->'entries') = 'array' then new.card_payload->'entries' else '[]'::jsonb end;
  select coalesce(jsonb_agg(value), '[]'::jsonb)
  into v_rules
  from jsonb_array_elements(v_rules)
  where jsonb_typeof(value) <> 'string'
     or (value #>> '{}') !~ '^(Base damage conversion:|Matching saving-throw effects:)';

  if v_converts_base then
    v_rule := format('Base damage conversion: the weapon base damage type is %s because the Initial Temper matches the craft material.', initcap(v_initial_element));
    v_rules := v_rules || jsonb_build_array(v_rule);
  end if;

  if v_matching_effect_pct > 0 then
    v_rule := format(
      'Matching saving-throw effects: %s%% matched effect grants +%s Save DC (+1 per 100%%).',
      to_char(v_matching_effect_pct, 'FM999999990.##'),
      v_save_dc_bonus
    );
    v_rules := v_rules || jsonb_build_array(v_rule);
  end if;

  new.card_payload := new.card_payload || jsonb_build_object('entries', v_rules);

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
$function$;

-- md5(pg_get_functiondef): private.apply_structured_crafting_traits_v1() = 108bfc2599d75e7298f65ce326f16173
CREATE OR REPLACE FUNCTION private.apply_structured_crafting_traits_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
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

  if coalesce(v_existing_smithing->>'processed_version', '') = 'structured-materials-v4-base-dice-scaling'
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

  v_original_dmg1 := coalesce(
    nullif(v_existing_smithing->>'original_base_dmg1', ''),
    nullif(new.card_payload->'smithing_result'->>'originalBaseDamage', ''),
    nullif(new.card_payload->'smithing_result'->>'baseDamage', ''),
    nullif(new.card_payload->>'dmg1', '')
  );
  v_original_dmg2 := coalesce(
    nullif(v_existing_smithing->>'original_base_dmg2', ''),
    nullif(new.card_payload->'smithing_result'->>'originalSecondaryDamage', ''),
    nullif(new.card_payload->>'dmg2', '')
  );
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
    if v_element = any(v_affinity) then
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
      v_current := coalesce(nullif(v_absorb_investment->>v_element, '')::numeric, 0) + v_effective_pct;
      v_absorb_investment := jsonb_set(v_absorb_investment, array[v_element], to_jsonb(v_current), true);
      v_rule := format(
        '%s (%s %s): adds %s%% %s absorption investment.',
        case when v_stage = 0 then 'Initial Temper' else 'Temper +' || v_stage::text end,
        initcap(v_element),
        initcap(coalesce(nullif(v_tier, ''), 'essence')),
        to_char(v_effective_pct, 'FM999999990.##'),
        initcap(v_element)
      );
    else
      v_current := coalesce(nullif(v_riders->>v_element, '')::numeric, 0) + v_effective_pct;
      v_riders := jsonb_set(v_riders, array[v_element], to_jsonb(v_current), true);
      v_dice_text := private.smithing_scaled_dice_text_v1(v_original_dmg1, v_effective_pct);
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

    if v_original_dmg1 is not null then
      v_effective_pct := coalesce(nullif(v_riders->>v_primary_element, '')::numeric, 100);
      v_final_dmg1 := private.smithing_scaled_dice_text_v1(v_original_dmg1, v_effective_pct);
      v_final_dmg2 := case
        when v_original_dmg2 is not null then private.smithing_scaled_dice_text_v1(v_original_dmg2, v_effective_pct)
        else null
      end;
      v_damage_text := v_final_dmg1 || ' ' || v_primary_element;
      if v_final_dmg2 is not null then
        v_damage_text := v_damage_text || ', versatile (' || v_final_dmg2 || ')';
      end if;
      new.card_payload := new.card_payload || jsonb_strip_nulls(jsonb_build_object(
        'dmg1', v_final_dmg1,
        'dmg2', v_final_dmg2,
        'damageText', v_damage_text
      ));
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
      'processed_version', 'structured-materials-v4-base-dice-scaling',
      'selection_fingerprint', v_fingerprint,
      'original_base_dmg1', v_original_dmg1,
      'original_base_dmg2', v_original_dmg2,
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
$function$;
