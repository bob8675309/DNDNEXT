-- DNDNext Smithing Material Quality v5
-- Adds Normal/HQ material variants, balanced two-element affinity pairs,
-- quality-aware catalog payloads, and consistent persisted temper scaling.

create or replace function private.smithing_material_profile_v5(
  p_base_name text,
  p_material_class text,
  p_quality_model text,
  p_quality text,
  p_bonus_pct integer,
  p_dc integer,
  p_affinity text[],
  p_allowed_kinds text[],
  p_allowed_families text[],
  p_risk text
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, public, private
as $$
declare
  v_quality text := case when lower(coalesce(p_quality, 'normal')) = 'hq' then 'HQ' else 'Normal' end;
  v_quality_key text := case when lower(coalesce(p_quality, 'normal')) = 'hq' then 'hq' else 'normal' end;
  v_bonus integer := case when lower(coalesce(p_quality, 'normal')) = 'hq' then 50 else 25 end;
  v_affinity text[] := coalesce(p_affinity, '{}'::text[]);
  v_all_elements text[] := array['acid','cold','fire','force','lightning','necrotic','poison','psychic','radiant','thunder'];
  v_pair_label text := '';
  v_absorption jsonb := '{}'::jsonb;
  v_profile jsonb;
  v_die_steps integer;
  v_weight numeric;
begin
  if cardinality(v_affinity) > 0 then
    select string_agg(initcap(value), ' and ' order by ordinality)
    into v_pair_label
    from unnest(v_affinity) with ordinality as tags(value, ordinality);

    select coalesce(jsonb_object_agg(value, v_bonus), '{}'::jsonb)
    into v_absorption
    from unnest(v_affinity) as tags(value);
  end if;

  v_profile := jsonb_build_object(
    'kind', 'material',
    'profileVersion', 5,
    'baseName', p_base_name,
    'materialClass', p_material_class,
    'qualityModel', p_quality_model,
    'quality', v_quality,
    'qualityKey', v_quality_key,
    'qualityBonusPct', v_bonus,
    'dcModifier', coalesce(p_dc, 0),
    'risk', p_risk,
    'allowedItemKinds', to_jsonb(coalesce(p_allowed_kinds, '{}'::text[])),
    'allowedWeaponFamilies', to_jsonb(coalesce(p_allowed_families, '{}'::text[]))
  );

  if p_quality_model = 'elemental' then
    v_profile := v_profile || jsonb_build_object(
      'affinityTags', to_jsonb(v_affinity),
      'displayAffinityTags', to_jsonb(v_affinity),
      'matchingEffectMultiplier', 1 + v_bonus / 100.0,
      'saveDcPerEffectPct', 100,
      'convertsBaseDamage', true,
      'baseDamageConversion', 'matching',
      'offensive', v_pair_label || ' damage effects are increased by ' || v_bonus || '%.',
      'defensive', 'Provides ' || v_bonus || '% ' || initcap(v_affinity[1]) || ' and ' || v_bonus || '% ' || initcap(v_affinity[2]) || ' absorption investment.',
      'armorAbsorption', v_absorption
    );
  elsif p_quality_model in ('dragon', 'dragon-scale') then
    v_profile := v_profile || jsonb_build_object(
      'affinityTags', to_jsonb(v_affinity),
      'displayAffinityTags', to_jsonb(v_affinity),
      'offensive', 'Not suitable as a weapon''s primary material.',
      'defensive', 'Provides ' || v_bonus || '% ' || initcap(v_affinity[1]) || ' absorption investment' || case when p_quality_model = 'dragon-scale' then ' and +1 AC for a complete suit or shield face' else '' end || '.',
      'armorAbsorption', v_absorption,
      'armorMechanics', case when p_quality_model = 'dragon-scale' then jsonb_build_object('acBonus', 1) else '{}'::jsonb end,
      'convertsBaseDamage', false,
      'baseDamageConversion', 'none'
    );
  elsif p_quality_model = 'adamantine' then
    v_die_steps := case when v_quality_key = 'hq' then 2 else 1 end;
    v_profile := v_profile || jsonb_build_object(
      'affinityTags', '[]'::jsonb,
      'displayAffinityTags', '[]'::jsonb,
      'specialTag', 'Die Step',
      'offensive', 'Increase the weapon''s base damage die by ' || case when v_die_steps = 1 then 'one step.' else 'two steps.' end,
      'defensive', case when v_quality_key = 'hq' then 'Critical hits against the bearer become normal hits.' else 'Critical hits against the bearer deal one fewer weapon damage die.' end,
      'weaponMechanics', jsonb_build_object('dieSteps', v_die_steps),
      'armorMechanics', case when v_quality_key = 'hq' then jsonb_build_object('criticalHitImmunity', true) else jsonb_build_object('criticalDamageDieReduction', 1) end,
      'convertsBaseDamage', false,
      'baseDamageConversion', 'none'
    );
  elsif p_quality_model = 'mithral' then
    v_weight := case when v_quality_key = 'hq' then 0.5 else 0.75 end;
    v_profile := v_profile || jsonb_build_object(
      'affinityTags', '[]'::jsonb,
      'displayAffinityTags', '[]'::jsonb,
      'specialTag', 'Lightweight',
      'offensive', case when v_quality_key = 'hq' then 'Halve the weapon''s weight. Heavy weapons lose the Heavy property.' else 'Reduce the weapon''s weight by 25%.' end,
      'defensive', case when v_quality_key = 'hq' then 'Halve the item''s weight and remove its Strength requirement and Stealth disadvantage.' else 'Reduce the item''s weight by 25% and remove its Strength requirement.' end,
      'weaponMechanics', case when v_quality_key = 'hq' then jsonb_build_object('weightMultiplier', v_weight, 'removeProperties', jsonb_build_array('Heavy')) else jsonb_build_object('weightMultiplier', v_weight) end,
      'armorMechanics', case when v_quality_key = 'hq' then jsonb_build_object('weightMultiplier', v_weight, 'removeStrengthRequirement', true, 'removeStealthDisadvantage', true) else jsonb_build_object('weightMultiplier', v_weight, 'removeStrengthRequirement', true) end,
      'convertsBaseDamage', false,
      'baseDamageConversion', 'none'
    );
  elsif p_quality_model = 'ironwood' then
    v_weight := case when v_quality_key = 'hq' then 0.5 else 0.75 end;
    v_profile := v_profile || jsonb_build_object(
      'affinityTags', '[]'::jsonb,
      'displayAffinityTags', '[]'::jsonb,
      'specialTag', 'Living Material',
      'offensive', case when v_quality_key = 'hq' then 'The weapon is nonmetal, weighs 50% less, cannot rust, and can serve as a druidic spellcasting focus.' else 'The weapon is nonmetal, weighs 25% less, and can serve as a druidic spellcasting focus.' end,
      'defensive', case when v_quality_key = 'hq' then 'The item is nonmetal, weighs 50% less, and cannot rust or corrode.' else 'The item is nonmetal and weighs 25% less without reducing Armor Class.' end,
      'weaponMechanics', jsonb_build_object('nonmetal', true, 'druidicFocus', true, 'weightMultiplier', v_weight, 'immuneToRust', v_quality_key = 'hq'),
      'armorMechanics', jsonb_build_object('nonmetal', true, 'weightMultiplier', v_weight, 'immuneToRust', v_quality_key = 'hq'),
      'convertsBaseDamage', false,
      'baseDamageConversion', 'none'
    );
  elsif p_quality_model = 'adaptive' then
    v_profile := v_profile || jsonb_build_object(
      'affinityTags', to_jsonb(v_all_elements),
      'displayAffinityTags', '[]'::jsonb,
      'specialTag', 'Adaptive',
      'matchingEffectMultiplier', 1 + v_bonus / 100.0,
      'saveDcPerEffectPct', 100,
      'convertsBaseDamage', true,
      'baseDamageConversion', 'adaptive',
      'offensive', 'The Initial Temper sets this material''s affinity. Matching elemental effects are increased by ' || v_bonus || '%.',
      'defensive', 'The first elemental temper sets this material''s affinity. Matching absorption contributions are increased by ' || v_bonus || '%.'
    );
  elsif p_quality_model = 'universal' then
    v_profile := v_profile || jsonb_build_object(
      'affinityTags', to_jsonb(v_all_elements),
      'displayAffinityTags', '[]'::jsonb,
      'specialTag', 'Universal',
      'matchingEffectMultiplier', 1 + v_bonus / 100.0,
      'saveDcPerEffectPct', 100,
      'convertsBaseDamage', false,
      'baseDamageConversion', 'none',
      'offensive', 'All elemental Essence effects are increased by ' || v_bonus || '%. The weapon keeps its original base damage type.',
      'defensive', 'All elemental Essence absorption contributions are increased by ' || v_bonus || '%.'
    );
  end if;

  return v_profile;
end;
$$;

-- Patch the structured material trigger so matching material bonuses apply to
-- defensive Essence contributions as well as weapon damage contributions.
do $patch_structured_materials$
declare
  v_definition text;
  v_original text;
begin
  select pg_get_functiondef('private.apply_structured_crafting_traits_v1()'::regprocedure)
  into v_definition;
  v_original := v_definition;

  if position('structured-materials-v3' in v_definition) = 0 then
    v_definition := replace(v_definition, 'structured-materials-v2', 'structured-materials-v3');
    v_definition := replace(
      v_definition,
      'if not v_is_defensive and v_element = any(v_affinity) then',
      'if v_element = any(v_affinity) then'
    );
    v_definition := replace(
      v_definition,
      'v_current := coalesce(nullif(v_absorb_investment->>v_element, '''')::numeric, 0) + v_pct;',
      'v_current := coalesce(nullif(v_absorb_investment->>v_element, '''')::numeric, 0) + v_effective_pct;'
    );
    v_definition := replace(
      v_definition,
      'to_char(v_pct, ''FM999999990.##''),\n        initcap(v_element)',
      'to_char(v_effective_pct, ''FM999999990.##''),\n        initcap(v_element)'
    );

    if v_definition = v_original then
      raise exception 'Could not patch private.apply_structured_crafting_traits_v1';
    end if;
    execute v_definition;
  end if;
end;
$patch_structured_materials$;

-- Respect materials such as Refined Mana Crystal that amplify every Essence
-- but intentionally never convert the weapon's base damage type.
do $patch_affinity_conversion$
declare
  v_definition text;
  v_original text;
begin
  select pg_get_functiondef('private.apply_smithing_affinity_polish_v4()'::regprocedure)
  into v_definition;
  v_original := v_definition;

  if position('v_conversion_mode' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      'v_converts_base boolean := false;',
      'v_converts_base boolean := false;\n  v_conversion_mode text := ''matching'';'
    );
    v_definition := replace(
      v_definition,
      'v_multiplier := greatest(1, coalesce(nullif(v_material_profile->>''matchingEffectMultiplier'', '''')::numeric, 1));',
      'v_multiplier := greatest(1, coalesce(nullif(v_material_profile->>''matchingEffectMultiplier'', '''')::numeric, 1));\n  v_conversion_mode := lower(coalesce(nullif(v_material_profile->>''baseDamageConversion'', ''''), case when coalesce(nullif(v_material_profile->>''convertsBaseDamage'', '''')::boolean, true) then ''matching'' else ''none'' end));'
    );
    v_definition := replace(
      v_definition,
      'v_converts_base := not v_is_defensive\n    and nullif(v_initial_element, '''') is not null',
      'v_converts_base := not v_is_defensive\n    and v_conversion_mode <> ''none''\n    and nullif(v_initial_element, '''') is not null'
    );

    if v_definition = v_original then
      raise exception 'Could not patch private.apply_smithing_affinity_polish_v4';
    end if;
    execute v_definition;
  end if;
end;
$patch_affinity_conversion$;

with material_defs(
  normal_key, slug, base_name, category, rarity, dc, material_class,
  quality_model, flavor, risk, affinity_tags, allowed_kinds, allowed_families
) as (
  values
    ('smithing:material:mithral-ingot', 'mithral-ingot', 'Mithral Ingot', 'Ore / Metal', 'Rare', 2, 'Legendary Metal', 'mithral', 'A moon-bright ingot that feels almost weightless, yet rings like tempered steel when struck.', 'Requires exact heat control; overheating ruins its flexibility.', '{}'::text[], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('Adamantine Bar|WDH', 'adamantine-bar', 'Adamantine Bar', 'Ore / Metal', 'Very Rare', 3, 'Legendary Metal', 'adamantine', 'A dense charcoal-black bar whose surface resists scratches, sparks, and even the bite of lesser tools.', 'Extremely difficult to shape; failed work can damage tools or waste the stock.', '{}'::text[], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:orichalcum-ingot', 'orichalcum-ingot', 'Orichalcum Ingot', 'Ore / Metal', 'Very Rare', 4, 'Legendary Metal', 'adaptive', 'Gold-red metal threaded with quiet light; nearby runes brighten when it is brought close.', 'Stored magic can discharge if the alloy is worked unevenly.', '{}'::text[], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:cold-iron-ingot', 'cold-iron-ingot', 'Cold Iron Ingot', 'Ore / Metal', 'Rare', 3, 'Legendary Metal', 'elemental', 'Dull gray iron worked without ordinary flame; it leaves a winter-cold ache in bare hands.', 'Never expose it to ordinary forge heat; it must be pressure-worked and rune-cooled.', array['cold','force'], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:ironwood-heartwood', 'ironwood-heartwood', 'Ironwood Heartwood', 'Material', 'Rare', 2, 'Organic & Botanical', 'ironwood', 'Dark living heartwood with a grain like folded iron; fresh cuts bead with amber-green sap.', 'Must be cured slowly; hurried drying causes hidden internal splits.', '{}'::text[], array['weapon','armor','shield'], array['ranged','hafted','blunt']),
    ('smithing:material:deep-coral-plate', 'deep-coral-plate', 'Deep Coral Plate', 'Monster Part', 'Rare', 3, 'Organic & Botanical', 'elemental', 'Blue-black coral grown under crushing depths, still cool and faintly damp far from the sea.', 'Dries and fractures unless kept mineral-treated throughout shaping.', array['cold','poison'], array['armor','shield'], '{}'::text[]),
    ('smithing:material:umbral-chitin', 'umbral-chitin', 'Umbral Chitin', 'Monster Part', 'Uncommon', 2, 'Organic & Botanical', 'elemental', 'Layered midnight chitin that drinks in torchlight and clicks softly when its plates flex.', 'Heat destroys its structure; it must be cut, laminated, and resin-bound.', array['necrotic','thunder'], array['ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:obsidian-edgeglass', 'obsidian-edgeglass', 'Obsidian Edgeglass', 'Material', 'Uncommon', 2, 'Crystal & Mineral', 'elemental', 'Smoky volcanic glass with an impossibly thin edge that catches light in blood-red lines.', 'Exceptionally sharp and brittle; failed shaping can shatter the full piece.', array['fire','acid'], array['weapon','ammunition'], array['blade','piercing','ammunition']),
    ('smithing:material:blood-glass', 'blood-glass', 'Blood Glass', 'Material', 'Rare', 4, 'Crystal & Mineral', 'elemental', 'Deep crimson glass with slow-moving shadows suspended beneath its polished surface.', 'Responds to blood and hostile magic; careless work can awaken a lingering curse.', array['poison','psychic'], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:star-metal', 'star-metal', 'Star Metal', 'Ore / Metal', 'Very Rare', 4, 'Crystal & Mineral', 'elemental', 'Silver-black meteoric metal dusted with pinpricks of light that drift like a distant night sky.', 'Its internal charge shifts with celestial cycles and can arc during forging.', array['force','lightning'], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:stygian-iron', 'stygian-iron', 'Stygian Iron', 'Ore / Metal', 'Very Rare', 5, 'Esoteric & Magical', 'elemental', 'Pitch-dark iron veined with ember-red and grave-violet light; its warmth fades when no one is watching.', 'Carries corruptive resonance and should always receive a visible warning on the finished item.', array['fire','necrotic'], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:moonsilver', 'moonsilver', 'Moonsilver', 'Ore / Metal', 'Very Rare', 4, 'Esoteric & Magical', 'elemental', 'Pale silver that waxes from translucent to mirror-bright as moonlight crosses its surface.', 'Waxes and wanes with lunar phases; unstable work can partially phase out of its fittings.', array['radiant','cold'], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:riverine', 'riverine', 'Riverine', 'Material', 'Legendary', 6, 'Esoteric & Magical', 'elemental', 'A ribbon of living water held inside a flawless transparent force lattice, flowing without spilling.', 'A damaged containment lattice releases the bound water and collapses the crafted section.', array['force','thunder'], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:iron-ore', 'iron-ore', 'Iron Ore', 'Ore / Metal', 'Mundane', 1, 'Base Metal', 'elemental', 'Rust-red ore shot through with dark metallic veins and coarse stone.', 'Impurities must be driven out before the ore can hold an elemental temper.', array['acid','thunder'], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:steel-ingot', 'steel-ingot', 'Steel Ingot', 'Ore / Metal', 'Mundane', 1, 'Base Metal', 'elemental', 'A clean gray ingot with blue temper lines and a clear bell-like ring.', 'Uneven carbon and heat leave weak seams that split under magical stress.', array['fire','lightning'], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:silver-ingot', 'silver-ingot', 'Silver Ingot', 'Ore / Metal', 'Uncommon', 1, 'Special Metal', 'elemental', 'A bright white ingot that stays cool beside the forge and tarnishes only at the edges.', 'Silver softens quickly and must be alloyed without muddying its magical resonance.', array['radiant','psychic'], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:ruidium-shard', 'ruidium-shard', 'Ruidium Shard', 'Material', 'Very Rare', 4, 'Crystal & Mineral', 'elemental', 'A translucent crimson crystal-metal shard that pulses with unsettling psychic heat.', 'Its corruptive pulse can imprint on tools, stock, and careless smiths.', array['psychic','necrotic'], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:generic-monster-part', 'generic-monster-part', 'Generic Monster Part', 'Monster Part', 'Common', 1, 'Monster Material', 'elemental', 'A sorted bundle of horn, bone, tooth, and hide harvested from common beasts.', 'Mixed tissues cure at different rates and can separate if prepared carelessly.', array['acid','poison'], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:dire-beast-hide', 'dire-beast-hide', 'Dire Beast Hide', 'Monster Part', 'Uncommon', 2, 'Monster Hide', 'elemental', 'Thick scarred hide with coarse fur still caught along its armored grain.', 'The hide must be stretched along its natural grain or it twists as it dries.', array['lightning','poison'], array['armor','shield'], '{}'::text[]),
    ('smithing:material:troll-heart', 'troll-heart', 'Troll Heart', 'Monster Part', 'Rare', 3, 'Monster Organ', 'elemental', 'A preserved green-black heart whose torn fibers slowly pull themselves together.', 'Regenerating tissue can overgrow bindings and must be cauterized during every stage.', array['fire','poison'], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:cursed-bone', 'cursed-bone', 'Cursed Bone', 'Monster Part', 'Uncommon', 2, 'Monster Bone', 'elemental', 'Ash-gray bone marked by hairline black runes that seem deeper whenever no one is looking.', 'The curse can migrate into tools or unfinished gear if its runes are broken.', array['acid','necrotic'], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:giant-bone', 'giant-bone', 'Giant Bone', 'Monster Part', 'Uncommon', 2, 'Monster Bone', 'elemental', 'A massive ivory section with dense growth rings and the weight of quarried stone.', 'Hidden stress fractures spread rapidly unless the bone is cut along its growth rings.', array['cold','thunder'], array['weapon','ammunition','armor','shield'], '{}'::text[]),
    ('smithing:material:refined-mana-crystal', 'refined-mana-crystal', 'Refined Mana Crystal', 'Catalyst', 'Rare', 2, 'Arcane Catalyst', 'universal', 'A clear blue crystal cut to hold a steady reservoir of arcane charge.', 'A fractured crystal releases its stored charge through the unfinished item.', '{}'::text[], array['weapon','ammunition','armor','shield'], '{}'::text[])
), qualities(quality_key, quality_label, bonus_pct) as (
  values ('normal', 'Normal', 25), ('hq', 'HQ', 50)
), variants as (
  select
    case when q.quality_key = 'normal' then d.normal_key else 'smithing:material:' || d.slug || ':hq' end as item_key,
    case when q.quality_key = 'hq' then 'HQ ' || d.base_name else d.base_name end as item_name,
    d.base_name,
    d.category,
    d.rarity,
    d.material_class,
    d.quality_model,
    q.quality_key,
    q.quality_label,
    q.bonus_pct,
    case when q.quality_key = 'hq' then d.flavor || ' This high-quality piece is unusually pure and responsive to careful work.' else d.flavor end as flavor,
    d.risk,
    d.affinity_tags,
    d.allowed_kinds,
    d.allowed_families,
    private.smithing_material_profile_v5(
      d.base_name, d.material_class, d.quality_model, q.quality_label, q.bonus_pct,
      d.dc, d.affinity_tags, d.allowed_kinds, d.allowed_families, d.risk
    ) as smithing
  from material_defs d
  cross join qualities q
)
insert into public.items_catalog as catalog (
  id, item_name, item_type, item_rarity, price_gp, merchant_tags, payload, item_key
)
select
  gen_random_uuid(),
  v.item_name,
  v.category,
  v.rarity,
  null,
  array['smithing','material',v.quality_key],
  jsonb_build_object(
    'name', v.item_name,
    'item_name', v.item_name,
    'item_type', v.category,
    'type', v.category,
    'rarity', v.rarity,
    'item_rarity', v.rarity,
    'quality', v.quality_label,
    'base_name', v.base_name,
    'crafting_category', v.category,
    'flavor', v.flavor,
    'item_description', v.flavor,
    'tags', to_jsonb(array['smithing','material',v.quality_key] || v.affinity_tags),
    'smithing', v.smithing || jsonb_build_object('flavor', v.flavor)
  ),
  v.item_key
from variants v
on conflict (item_key) do update
set item_name = excluded.item_name,
    item_type = excluded.item_type,
    item_rarity = excluded.item_rarity,
    merchant_tags = excluded.merchant_tags,
    payload = coalesce(catalog.payload, '{}'::jsonb) || excluded.payload;

-- Dragon materials retain their ancestral single element but now also have
-- Normal (25%) and HQ (50%) quality variants.
with dragon_defs as (
  select
    item_key as normal_key,
    regexp_replace(item_key, '^smithing:material:', '') as slug,
    item_name as base_name,
    item_type as category,
    item_rarity as rarity,
    coalesce(payload->'smithing'->>'materialClass', 'Dragonhide') as material_class,
    case when coalesce(payload->'smithing'->>'materialClass', '') = 'Dragon Scale' then 'dragon-scale' else 'dragon' end as quality_model,
    coalesce(payload->>'flavor', payload->>'item_description', item_name || ' dragon material.') as flavor,
    coalesce(payload->'smithing'->>'risk', 'Mismatched elemental work can make the material brittle or violently reactive.') as risk,
    array[lower(payload->'smithing'->>'element')]::text[] as affinity_tags,
    array['armor','shield']::text[] as allowed_kinds,
    '{}'::text[] as allowed_families,
    coalesce(nullif(payload->'smithing'->>'dcModifier', '')::integer, case when coalesce(payload->'smithing'->>'materialClass', '') = 'Dragon Scale' then 5 else 4 end) as dc
  from public.items_catalog
  where item_key like 'smithing:material:%-dragonhide'
     or item_key like 'smithing:material:%-dragon-scale'
), qualities(quality_key, quality_label, bonus_pct) as (
  values ('normal', 'Normal', 25), ('hq', 'HQ', 50)
), dragon_variants as (
  select
    case when q.quality_key = 'normal' then d.normal_key else d.normal_key || ':hq' end as item_key,
    case when q.quality_key = 'hq' then 'HQ ' || d.base_name else d.base_name end as item_name,
    d.base_name,
    d.category,
    d.rarity,
    d.material_class,
    d.quality_model,
    q.quality_key,
    q.quality_label,
    q.bonus_pct,
    case when q.quality_key = 'hq' then d.flavor || ' This high-quality piece is unusually pure and responsive to careful work.' else d.flavor end as flavor,
    d.affinity_tags,
    private.smithing_material_profile_v5(
      d.base_name, d.material_class, d.quality_model, q.quality_label, q.bonus_pct,
      d.dc, d.affinity_tags, d.allowed_kinds, d.allowed_families, d.risk
    ) as smithing
  from dragon_defs d
  cross join qualities q
)
insert into public.items_catalog as catalog (
  id, item_name, item_type, item_rarity, price_gp, merchant_tags, payload, item_key
)
select
  gen_random_uuid(),
  v.item_name,
  v.category,
  v.rarity,
  null,
  array['smithing','material','dragon',v.quality_key],
  jsonb_build_object(
    'name', v.item_name,
    'item_name', v.item_name,
    'item_type', v.category,
    'type', v.category,
    'rarity', v.rarity,
    'item_rarity', v.rarity,
    'quality', v.quality_label,
    'base_name', v.base_name,
    'crafting_category', v.category,
    'flavor', v.flavor,
    'item_description', v.flavor,
    'tags', to_jsonb(array['smithing','material','dragon',v.quality_key] || v.affinity_tags),
    'smithing', v.smithing || jsonb_build_object('flavor', v.flavor, 'element', v.affinity_tags[1])
  ),
  v.item_key
from dragon_variants v
on conflict (item_key) do update
set item_name = excluded.item_name,
    item_type = excluded.item_type,
    item_rarity = excluded.item_rarity,
    merchant_tags = excluded.merchant_tags,
    payload = coalesce(catalog.payload, '{}'::jsonb) || excluded.payload;
