-- DNDNext crafting materials v2
-- Idempotently seeds the Smithing catalog and enriches completed crafted items
-- with structured physical-material and elemental-temper rules.

create or replace function private.apply_structured_crafting_traits_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_selected jsonb := coalesce(new.card_payload->'crafting'->'selected_materials', '[]'::jsonb);
  v_rules jsonb := case when jsonb_typeof(new.card_payload->'entries') = 'array' then new.card_payload->'entries' else '[]'::jsonb end;
  v_traits jsonb := case when jsonb_typeof(new.card_payload->'material_traits') = 'array' then new.card_payload->'material_traits' else '[]'::jsonb end;
  v_materials jsonb := '[]'::jsonb;
  v_tempering jsonb := '[]'::jsonb;
  v_existing_smithing jsonb := case when jsonb_typeof(new.card_payload->'smithing') = 'object' then new.card_payload->'smithing' else '{}'::jsonb end;
  v_material jsonb;
  v_profile jsonb;
  v_name text;
  v_kind_blob text := lower(concat_ws(' ', new.item_type, new.card_payload->>'type', new.card_payload->>'item_type', new.card_payload->>'uiType'));
  v_effect text;
  v_rule text;
  v_trait text;
  v_element text;
  v_primary_element text;
  v_stage integer;
  v_primary_stage integer := 999;
  v_pct integer;
  v_total_pct integer := 0;
  v_entries_text text;
  v_damage_text text;
begin
  new.card_payload := coalesce(new.card_payload, '{}'::jsonb);
  v_selected := coalesce(new.card_payload->'crafting'->'selected_materials', '[]'::jsonb);

  if jsonb_typeof(v_selected) <> 'array' then
    return new;
  end if;
  if jsonb_array_length(v_selected) = 0 then
    return new;
  end if;
  if coalesce(new.card_payload->'smithing'->>'processed_version', '') = 'structured-materials-v1' then
    return new;
  end if;

  for v_material in select value from jsonb_array_elements(v_selected)
  loop
    v_name := coalesce(nullif(v_material->>'name', ''), 'Selected Material');
    v_profile := coalesce(v_material->'smithing', '{}'::jsonb);

    if jsonb_typeof(v_profile) = 'object' and v_profile <> '{}'::jsonb then
      v_effect := case
        when v_kind_blob ~ 'armor|shield' then nullif(v_profile->>'defensive', '')
        else nullif(v_profile->>'offensive', '')
      end;

      v_materials := v_materials || jsonb_build_array(jsonb_build_object(
        'name', v_name,
        'material_class', nullif(v_profile->>'materialClass', ''),
        'effect', v_effect,
        'offensive', nullif(v_profile->>'offensive', ''),
        'defensive', nullif(v_profile->>'defensive', ''),
        'risk', nullif(v_profile->>'risk', ''),
        'dc_modifier', coalesce(nullif(v_profile->>'dcModifier', '')::integer, 0)
      ));

      v_trait := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
      if v_trait <> '' and not (v_traits ? v_trait) then
        v_traits := v_traits || jsonb_build_array(v_trait);
      end if;

      -- Adamantine, mithral, and silver already receive established fallback
      -- rules in complete_craft_plan_v1_impl. Avoid duplicating those lines.
      if v_effect is not null and lower(v_name) !~ 'adamant|mithral|silver' then
        v_rule := v_name || ': ' || v_effect;
        if not (v_rules @> jsonb_build_array(v_rule)) then
          v_rules := v_rules || jsonb_build_array(v_rule);
        end if;
      end if;
    end if;

    v_stage := coalesce(nullif(v_material->>'temper_stage', '')::integer, 0);
    v_element := lower(coalesce(nullif(v_material->>'temper_element', ''), ''));
    v_pct := coalesce(nullif(v_material->>'bonus_damage_pct', '')::integer, greatest(v_stage, 0) * 25);

    if v_stage > 0 and v_element <> '' then
      v_total_pct := v_total_pct + greatest(v_pct, 0);
      if v_stage < v_primary_stage then
        v_primary_stage := v_stage;
        v_primary_element := v_element;
      end if;

      v_tempering := v_tempering || jsonb_build_array(jsonb_build_object(
        'stage', v_stage,
        'element', v_element,
        'bonus_damage_pct', greatest(v_pct, 0),
        'source_material', v_name
      ));

      v_trait := format('temper:%s:%s', v_stage, v_element);
      if not (v_traits ? v_trait) then
        v_traits := v_traits || jsonb_build_array(v_trait);
      end if;

      if v_stage = 1 then
        v_rule := format(
          'Temper +1 (%s): the weapon''s primary damage type becomes %s, and each hit deals bonus %s damage equal to %s%% of the weapon''s base damage.',
          initcap(v_element), initcap(v_element), initcap(v_element), greatest(v_pct, 0)
        );
      else
        v_rule := format(
          'Temper +%s (%s): each hit gains an additional %s damage rider equal to %s%% of the weapon''s base damage. This stacks with earlier temper stages.',
          v_stage, initcap(v_element), initcap(v_element), greatest(v_pct, 0)
        );
      end if;
      if not (v_rules @> jsonb_build_array(v_rule)) then
        v_rules := v_rules || jsonb_build_array(v_rule);
      end if;
    end if;
  end loop;

  new.card_payload := new.card_payload || jsonb_build_object(
    'entries', v_rules,
    'material_traits', v_traits,
    'smithing', v_existing_smithing || jsonb_build_object(
      'processed_version', 'structured-materials-v1',
      'materials', v_materials,
      'tempering', v_tempering,
      'primary_damage_type', v_primary_element,
      'temper_total_bonus_pct', v_total_pct
    )
  );

  if v_primary_element is not null then
    new.card_payload := new.card_payload || jsonb_build_object(
      'dmgType', v_primary_element,
      'damageType', v_primary_element,
      'damage_type', v_primary_element,
      'primary_damage_type', v_primary_element
    );

    if nullif(new.card_payload->>'dmg1', '') is not null then
      v_damage_text := (new.card_payload->>'dmg1') || ' ' || v_primary_element;
      if nullif(new.card_payload->>'dmg2', '') is not null then
        v_damage_text := v_damage_text || ', versatile (' || (new.card_payload->>'dmg2') || ')';
      end if;
      new.card_payload := new.card_payload || jsonb_build_object('damageText', v_damage_text);
    end if;
  end if;

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

with material_seed(item_key, item_name, item_type, item_rarity, price_gp, merchant_tags, description, material_class, offensive, defensive, dc_modifier, risk) as (
  values
    ('smithing:material:mithral-ingot', 'Mithral Ingot', 'Ore / Metal', 'Rare', 2500::numeric, array['smithing','material','ore','metal','mithral','rare'], 'A lightweight ingot of shimmering silver metal that remains extraordinarily strong.', 'Legendary Metal', 'Lightens a weapon without weakening it. Heavy weapons become easier to ready, and agile weapon designs retain full strength.', 'Halves the finished item''s weight and removes normal Strength requirements and Stealth disadvantage caused by the armor.', 2, 'Requires exact heat control; overheating ruins its flexibility.'),
    ('Adamantine Bar|WDH', 'Adamantine Bar', 'Ore / Metal', 'Very Rare', 1000::numeric, array['smithing','material','ore','metal','adamantine','very-rare'], 'An ultra-dense bar of nearly unbreakable metal used for weapons, armor, and shields.', 'Legendary Metal', 'Creates an exceptionally hard edge or striking face suited to sundering objects, armor, and reinforced structures.', 'Reinforces armor and shields against catastrophic impacts and critical-hit deformation.', 3, 'Extremely difficult to shape; failed work can damage tools or waste the stock.'),
    ('smithing:material:orichalcum-ingot', 'Orichalcum Ingot', 'Ore / Metal', 'Very Rare', 12000::numeric, array['smithing','material','ore','metal','orichalcum','arcane','very-rare'], 'A glowing gold-red ingot associated with lost civilizations and deep arcane channels.', 'Legendary Metal', 'Channels spell energy through the weapon, making it an excellent foundation for elemental and radiant tempering.', 'Holds a stable arcane ward that improves resistance to magical strain and later enchantment binding.', 4, 'Stored magic can discharge if the alloy is worked unevenly.'),
    ('smithing:material:cold-iron-ingot', 'Cold Iron Ingot', 'Ore / Metal', 'Rare', 3500::numeric, array['smithing','material','ore','metal','cold-iron','fey','rare'], 'Iron mined from the deep earth and pressure-worked without ordinary forge heat.', 'Legendary Metal', 'Its deep-forged edge disrupts fey glamour and planar protections.', 'Dampens fey influence, charm effects, and hostile planar resonance around the wearer.', 3, 'Never expose it to ordinary forge heat; it must be pressure-worked and rune-cooled.'),
    ('smithing:material:dragonhide', 'Dragonhide', 'Monster Part', 'Very Rare', 10000::numeric, array['smithing','material','monster-part','dragonhide','very-rare'], 'The magically resilient hide of a dragon, retaining traces of its elemental nature.', 'Organic & Botanical', 'A dragon-derived grip, lash, bow limb, or striking surface can carry the damage type associated with the harvested dragon.', 'Armor or shields retain a measure of the dragon''s elemental resilience, keyed to the harvested dragon.', 4, 'Mismatched essences can make the material brittle or violently reactive.'),
    ('smithing:material:ironwood-heartwood', 'Ironwood Heartwood', 'Material', 'Rare', 3000::numeric, array['smithing','material','wood','ironwood','nature','rare'], 'Dense magical heartwood that works like metal while remaining alive to nature magic.', 'Organic & Botanical', 'Produces dense wooden weapons that strike like steel while remaining compatible with druidic and nature magic.', 'Can replace metal plates or shield faces with a lighter, nonmetal defense of comparable strength.', 2, 'Must be cured slowly; hurried drying causes hidden internal splits.'),
    ('smithing:material:deep-coral-plate', 'Deep Coral Plate', 'Monster Part', 'Rare', 2800::numeric, array['smithing','material','monster-part','coral','aquatic','rare'], 'Pressure-hardened coral harvested from dangerous underwater realms.', 'Organic & Botanical', 'Forms barbed aquatic points that resist corrosion and maintain a keen edge underwater.', 'Creates pressure-resistant armor and shields suited to deep water and aquatic environments.', 3, 'Dries and fractures unless kept mineral-treated throughout shaping.'),
    ('smithing:material:umbral-chitin', 'Umbral Chitin', 'Monster Part', 'Uncommon', 600::numeric, array['smithing','material','monster-part','chitin','umbral','uncommon'], 'Dark layered chitin from subterranean or shadow-touched arthropods.', 'Organic & Botanical', 'Creates light serrated blades, spikes, and ammunition with excellent cutting geometry.', 'Builds lightweight layered armor that spreads impact without the weight of forged plate.', 2, 'Heat destroys its structure; it must be cut, laminated, and resin-bound.'),
    ('smithing:material:obsidian-edgeglass', 'Obsidian Edgeglass', 'Material', 'Uncommon', 450::numeric, array['smithing','material','crystal','obsidian','uncommon'], 'Arcane volcanic glass capable of holding a supernatural razor edge.', 'Crystal & Mineral', 'Takes a supernatural razor edge suited to slashing, piercing, and critical-hit focused weapons.', 'Reflective plates resist heat and magical glare but remain vulnerable to repeated blunt impact.', 2, 'Exceptionally sharp and brittle; failed shaping can shatter the full piece.'),
    ('smithing:material:blood-glass', 'Blood Glass', 'Material', 'Rare', 4000::numeric, array['smithing','material','crystal','blood-glass','necrotic','curse','rare'], 'Deep crimson glass tempered with blood and ritual salts.', 'Crystal & Mineral', 'Serves as a powerful conduit for necrotic, curse, and life-draining enchantments.', 'Can redirect a portion of necrotic or curse energy into the glass instead of the bearer.', 4, 'Responds to blood and hostile magic; careless work can awaken a lingering curse.'),
    ('smithing:material:star-metal', 'Star Metal', 'Ore / Metal', 'Very Rare', 15000::numeric, array['smithing','material','ore','metal','star-metal','radiant','force','very-rare'], 'Celestial metal recovered from a fallen star, holding a faint cosmic charge.', 'Crystal & Mineral', 'Carries cosmic force through the weapon and readily accepts radiant, force, or extraplanar enchantments.', 'Forms a stable ward against force, radiant pressure, and hostile planar energies.', 4, 'Its internal charge shifts with celestial cycles and can arc during forging.'),
    ('smithing:material:stygian-iron', 'Stygian Iron', 'Ore / Metal', 'Very Rare', 14000::numeric, array['smithing','material','ore','metal','stygian','necrotic','fire','very-rare'], 'Underworld iron that holds heat and shadow long after leaving the forge.', 'Esoteric & Magical', 'Binds hellfire and necrotic energy into cruel, soul-searing weapon channels.', 'Can ward against fire and necrotic power while anchoring the wearer against forced planar movement.', 5, 'Carries corruptive resonance and should always receive a visible warning on the finished item.'),
    ('smithing:material:moonsilver', 'Moonsilver', 'Ore / Metal', 'Very Rare', 16000::numeric, array['smithing','material','ore','metal','moonsilver','radiant','psychic','very-rare'], 'Luminous silver that subtly shifts with the phases of the moon.', 'Esoteric & Magical', 'A phase-shifting edge readily carries radiant or psychic tempering and bites through illusion-shrouded defenses.', 'Creates nearly weightless armor that glimmers against shapechanging, illusion, and ethereal intrusion.', 4, 'Waxes and wanes with lunar phases; unstable work can partially phase out of its fittings.'),
    ('smithing:material:riverine', 'Riverine', 'Material', 'Legendary', 50000::numeric, array['smithing','material','riverine','force','water','legendary'], 'Elemental water trapped inside a transparent force lattice.', 'Esoteric & Magical', 'A force-contained water edge cannot rust and can deliver pressure-like force through a strike.', 'Forms a transparent, watertight force shell with extraordinary resilience and almost no conventional weight.', 6, 'A damaged containment lattice releases the bound water and collapses the crafted section.')
)
insert into public.items_catalog(item_key, item_name, item_type, item_rarity, price_gp, merchant_tags, payload)
select
  item_key,
  item_name,
  item_type,
  item_rarity,
  price_gp,
  merchant_tags,
  jsonb_build_object(
    'name', item_name,
    'item_name', item_name,
    'item_id', item_key,
    'item_key', item_key,
    'type', item_type,
    'item_type', item_type,
    'uiType', item_type,
    'rarity', item_rarity,
    'item_rarity', item_rarity,
    'source', 'DNDNext Smithing Catalog',
    'flavor', description,
    'item_description', description,
    'tags', to_jsonb(merchant_tags),
    'smithing', jsonb_build_object(
      'kind', 'material',
      'materialClass', material_class,
      'offensive', offensive,
      'defensive', defensive,
      'dcModifier', dc_modifier,
      'risk', risk
    )
  )
from material_seed
on conflict (item_key) do update
set item_name = excluded.item_name,
    item_type = excluded.item_type,
    item_rarity = excluded.item_rarity,
    price_gp = excluded.price_gp,
    merchant_tags = (
      select array_agg(distinct tag order by tag)
      from unnest(coalesce(public.items_catalog.merchant_tags, '{}'::text[]) || excluded.merchant_tags) as tag
    ),
    payload = coalesce(public.items_catalog.payload, '{}'::jsonb) || excluded.payload;

with essence_seed(item_key, item_name, item_rarity, price_gp, element, brew_tags, flavor) as (
  values
    ('alchemy:modifier:fire-essence', 'Fire Essence', 'Uncommon', 250::numeric, 'fire', array['Fire'], 'A red-orange essence that flickers like a banked coal.'),
    ('alchemy:modifier:frost-essence', 'Frost Essence', 'Uncommon', 250::numeric, 'cold', array['Cold'], 'A pale blue essence rimed with frost.'),
    ('alchemy:modifier:storm-essence', 'Storm Essence', 'Rare', 750::numeric, 'lightning', array['Lightning','Thunder'], 'A violet-blue essence crawling with tiny sparks.'),
    ('alchemy:modifier:acid-essence', 'Acid Essence', 'Uncommon', 250::numeric, 'acid', array['Acid'], 'A yellow-green essence that etches faint trails into untreated glass.'),
    ('alchemy:modifier:poison-essence', 'Poison Essence', 'Uncommon', 250::numeric, 'poison', array['Poison','Venom'], 'A dark green essence with a bitter metallic scent.'),
    ('alchemy:modifier:radiant-essence', 'Radiant Essence', 'Rare', 750::numeric, 'radiant', array['Radiant','Holy'], 'A warm golden essence that brightens nearby liquid.'),
    ('alchemy:modifier:shadow-essence', 'Shadow Essence', 'Rare', 750::numeric, 'necrotic', array['Necrotic','Shadow'], 'A smoke-dark essence that dims nearby reflections.'),
    ('alchemy:modifier:force-essence', 'Force Essence', 'Rare', 750::numeric, 'force', array['Force'], 'A clear essence that presses outward against its container.'),
    ('alchemy:modifier:psychic-essence', 'Psychic Essence', 'Rare', 750::numeric, 'psychic', array['Psychic','Mind'], 'A clear violet essence that seems to move when unobserved.'),
    ('alchemy:modifier:thunder-essence', 'Thunder Essence', 'Uncommon', 250::numeric, 'thunder', array['Thunder','Resonant'], 'A silver-gray essence that hums against the glass.')
)
insert into public.items_catalog(item_key, item_name, item_type, item_rarity, price_gp, merchant_tags, payload)
select
  item_key,
  item_name,
  'Reagent / Catalyst',
  item_rarity,
  price_gp,
  array['alchemy','reagent','essence','elemental','smithing','smithing-temper',element,lower(replace(item_rarity, ' ', '-'))],
  jsonb_build_object(
    'name', item_name,
    'item_name', item_name,
    'item_id', item_key,
    'item_key', item_key,
    'type', 'Reagent / Catalyst',
    'item_type', 'Reagent / Catalyst',
    'uiType', 'Reagent / Catalyst',
    'rarity', item_rarity,
    'item_rarity', item_rarity,
    'source', 'DNDNext Crafting Catalog',
    'flavor', flavor,
    'item_description', flavor,
    'tags', to_jsonb(array['alchemy','reagent','essence','elemental','smithing','smithing-temper',element]),
    'alchemy', jsonb_build_object(
      'kind', 'modifier',
      'family', 'essence',
      'familyLabel', 'Essence',
      'rarity', item_rarity,
      'slotType', 'modifier',
      'brewTags', to_jsonb(brew_tags),
      'bonuses', jsonb_build_object('typeDirection', element),
      'craftDcReduction', 0
    ),
    'smithing', jsonb_build_object(
      'kind', 'temper',
      'materialClass', 'Elemental Essence',
      'element', element,
      'tags', to_jsonb(array['elemental','smithing-temper',element])
    )
  )
from essence_seed
on conflict (item_key) do nothing;

with essence_update(item_key, element) as (
  values
    ('alchemy:modifier:fire-essence', 'fire'),
    ('alchemy:modifier:frost-essence', 'cold'),
    ('alchemy:modifier:storm-essence', 'lightning'),
    ('alchemy:modifier:acid-essence', 'acid'),
    ('alchemy:modifier:poison-essence', 'poison'),
    ('alchemy:modifier:radiant-essence', 'radiant'),
    ('alchemy:modifier:shadow-essence', 'necrotic'),
    ('alchemy:modifier:force-essence', 'force'),
    ('alchemy:modifier:psychic-essence', 'psychic'),
    ('alchemy:modifier:thunder-essence', 'thunder')
)
update public.items_catalog as catalog
set merchant_tags = (
      select array_agg(distinct tag order by tag)
      from unnest(coalesce(catalog.merchant_tags, '{}'::text[]) || array['smithing','smithing-temper',essence_update.element]) as tag
    ),
    payload = coalesce(catalog.payload, '{}'::jsonb)
      || jsonb_build_object(
        'tags', coalesce(catalog.payload->'tags', '[]'::jsonb) || to_jsonb(array['smithing','smithing-temper',essence_update.element]),
        'smithing', jsonb_build_object(
          'kind', 'temper',
          'materialClass', 'Elemental Essence',
          'element', essence_update.element,
          'tags', to_jsonb(array['elemental','smithing-temper',essence_update.element])
        )
      )
from essence_update
where catalog.item_key = essence_update.item_key;
