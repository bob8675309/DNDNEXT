-- DNDNext Smithing card polish v4
-- Scales matching save DC at +1 per 100% effective matching effect,
-- converts base damage when Initial Temper matches a material element tag,
-- and refreshes concise material mechanics and unique flavor text.

create or replace function private.apply_smithing_affinity_polish_v4()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
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
$$;

drop trigger if exists zz_inventory_items_apply_smithing_affinity_polish_v4 on public.inventory_items;
create trigger zz_inventory_items_apply_smithing_affinity_polish_v4
before insert or update of card_payload on public.inventory_items
for each row
execute function private.apply_smithing_affinity_polish_v4();

with material_updates(item_key, flavor, offensive, defensive, save_dc_per_effect_pct) as (
  values
    ('smithing:material:mithral-ingot', 'A moon-bright ingot that feels almost weightless, yet rings like tempered steel when struck.', 'Halve the weapon''s weight. Heavy weapons lose the Heavy property.', 'Halve the item''s weight and remove its Strength requirement and Stealth disadvantage.', 100),
    ('Adamantine Bar|WDH', 'A dense charcoal-black bar whose surface resists scratches, sparks, and even the bite of lesser tools.', 'Increase the weapon''s base damage die by two steps.', 'Critical hits against the bearer become normal hits.', 100),
    ('smithing:material:orichalcum-ingot', 'Gold-red metal threaded with quiet light; nearby runes brighten when it is brought close.', 'Radiant and Force damage effects are increased by 25%.', 'Provides 25% Radiant and 25% Force absorption investment.', 100),
    ('smithing:material:cold-iron-ingot', 'Dull gray iron worked without ordinary flame; it leaves a winter-cold ache in bare hands.', 'Deals 25% additional base weapon damage against Fey creatures.', 'Grants Advantage against Fey charm and forced planar movement.', 100),
    ('smithing:material:ironwood-heartwood', 'Dark living heartwood with a grain like folded iron; fresh cuts bead with amber-green sap.', 'The weapon is nonmetal and can serve as a druidic spellcasting focus.', 'The item is nonmetal and weighs 25% less without reducing Armor Class.', 100),
    ('smithing:material:deep-coral-plate', 'Blue-black coral grown under crushing depths, still cool and faintly damp far from the sea.', 'Not suitable as a weapon''s primary material.', 'Provides 25% Cold absorption and ignores deep-water pressure penalties.', 100),
    ('smithing:material:umbral-chitin', 'Layered midnight chitin that drinks in torchlight and clicks softly when its plates flex.', 'Ammunition gains 25% Necrotic base-damage investment.', 'Reduce weight by 25% and add 25% Necrotic absorption investment.', 100),
    ('smithing:material:obsidian-edgeglass', 'Smoky volcanic glass with an impossibly thin edge that catches light in blood-red lines.', 'Increase the weapon''s base damage die by one step. A natural 1 damages the edge until repaired.', 'Not suitable as armor or shield stock.', 100),
    ('smithing:material:blood-glass', 'Deep crimson glass with slow-moving shadows suspended beneath its polished surface.', 'Necrotic and Corruption effects are increased by 25%.', 'Provides 25% Necrotic absorption and Advantage against Corruption effects.', 100),
    ('smithing:material:star-metal', 'Silver-black meteoric metal dusted with pinpricks of light that drift like a distant night sky.', 'Force and Radiant damage effects are increased by 25%.', 'Provides 25% Force and 25% Radiant absorption investment.', 100),
    ('smithing:material:stygian-iron', 'Pitch-dark iron veined with ember-red and grave-violet light; its warmth fades when no one is watching.', 'Fire and Necrotic damage effects are increased by 50%.', 'Provides 50% Fire and 50% Necrotic absorption and Advantage against Corruption.', 100),
    ('smithing:material:moonsilver', 'Pale silver that waxes from translucent to mirror-bright as moonlight crosses its surface.', 'Radiant and Psychic damage effects are increased by 25%.', 'Provides 25% Radiant and 25% Psychic absorption and resists forced phasing.', 100),
    ('smithing:material:riverine', 'A ribbon of living water held inside a flawless transparent force lattice, flowing without spilling.', 'Force damage effects are increased by 50%. The weapon cannot rust or corrode.', 'Provides 75% Force absorption and forms a watertight protective shell.', 100)
)
update public.items_catalog as catalog
set payload = coalesce(catalog.payload, '{}'::jsonb) || jsonb_build_object(
  'flavor', material_updates.flavor,
  'smithing', ((coalesce(catalog.payload->'smithing', '{}'::jsonb) - 'matchingSaveDcBonus' - 'convertsBaseDamage') || jsonb_build_object(
    'flavor', material_updates.flavor,
    'offensive', material_updates.offensive,
    'defensive', material_updates.defensive,
    'saveDcPerEffectPct', material_updates.save_dc_per_effect_pct
  ))
)
from material_updates
where catalog.item_key = material_updates.item_key;

with element_flavors(element, detail) as (
  values
    ('acid', 'caustic green light beads across its surface like fresh etching'),
    ('cold', 'white-blue rime forms around it even beside a hot forge'),
    ('fire', 'orange sparks curl inside it like a flame trapped beneath glass'),
    ('force', 'clear pressure ripples distort the air around its edges'),
    ('lightning', 'violet arcs crawl across it with the smell of rain and ozone'),
    ('necrotic', 'grave-purple haze coils within it and dulls nearby reflections'),
    ('poison', 'emerald vapor clings to it with a bitter metallic scent'),
    ('psychic', 'rose-violet patterns shift when viewed from the corner of the eye'),
    ('radiant', 'warm gold-white light gathers inside it without casting a shadow'),
    ('thunder', 'silver-blue rings pulse through it with a low distant hum')
), tier_flavors(tier, prefix) as (
  values
    ('mote', 'A dust-fine elemental mote'),
    ('shard', 'A faceted elemental shard with enough power to vibrate against its wrapping'),
    ('core', 'A dense elemental core that beats with a slow magical pulse')
), essence_flavors as (
  select
    'smithing:essence:' || element_flavors.element || ':' || tier_flavors.tier as item_key,
    tier_flavors.prefix || '; ' || element_flavors.detail || '.' as flavor
  from element_flavors cross join tier_flavors
)
update public.items_catalog as catalog
set payload = coalesce(catalog.payload, '{}'::jsonb) || jsonb_build_object(
  'flavor', essence_flavors.flavor,
  'smithing', coalesce(catalog.payload->'smithing', '{}'::jsonb) || jsonb_build_object('flavor', essence_flavors.flavor)
)
from essence_flavors
where catalog.item_key = essence_flavors.item_key;

with dragon_flavors as (
  select
    item_key,
    case
      when item_key like '%-dragonhide' then
        'Supple ' || lower(replace(split_part(item_key, ':', 3), '-dragonhide', '')) || ' dragonhide with ' || initcap(coalesce(payload->'smithing'->>'element', 'elemental')) || ' energy moving beneath the scales like a slow pulse.'
      else
        'A rigid ' || lower(replace(split_part(item_key, ':', 3), '-dragon-scale', '')) || ' dragon scale whose polished ridges shimmer with contained ' || initcap(coalesce(payload->'smithing'->>'element', 'elemental')) || ' power.'
    end as flavor
  from public.items_catalog
  where item_key like 'smithing:material:%-dragonhide'
     or item_key like 'smithing:material:%-dragon-scale'
)
update public.items_catalog as catalog
set payload = coalesce(catalog.payload, '{}'::jsonb) || jsonb_build_object(
  'flavor', dragon_flavors.flavor,
  'smithing', coalesce(catalog.payload->'smithing', '{}'::jsonb) || jsonb_build_object('flavor', dragon_flavors.flavor)
)
from dragon_flavors
where catalog.item_key = dragon_flavors.item_key;
