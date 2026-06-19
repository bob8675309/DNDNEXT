-- Enrich finished alchemy product payloads with recipe-derived card metadata.
-- Idempotent. Applies to items_catalog and existing merchant stock rows.
-- The card can render save, area/range, use, duration, and hidden component metadata.

with source_rows as (
  select
    ic.id,
    r.use_text,
    r.duration,
    r.effect_text,
    coalesce(r.save_ability, r.rider_save) as resolved_save_ability,
    case when coalesce(r.save_ability, r.rider_save) is not null then 14 else null end as resolved_save_dc,
    case when r.base_area_feet is not null and r.area_shape is not null then concat(r.base_area_feet::text, '-foot ', r.area_shape) else null end as resolved_area_text,
    r.base_area_feet,
    r.area_shape,
    r.condition_riders,
    r.cures_conditions,
    r.grants_immunities,
    r.rider_save,
    r.rider_duration,
    r.rider_repeat_save,
    r.base_dice_count,
    r.base_die_size,
    r.base_flat_bonus,
    r.base_uses,
    r.dice_purpose,
    r.required_tags_any,
    r.tag_label,
    r.template_key,
    r.formula_family,
    r.alchemy_group,
    r.alchemy_section,
    r.rarity
  from public.items_catalog ic
  join public.recipes r on lower(r.name) = lower(ic.item_name)
  where ic.payload->'alchemy'->>'kind' = 'crafted_product'
), catalog_patch as (
  update public.items_catalog ic
  set
    item_type = coalesce(ic.item_type, source_rows.alchemy_section),
    item_rarity = coalesce(ic.item_rarity, source_rows.rarity),
    payload = jsonb_strip_nulls(
      ic.payload
      || jsonb_build_object(
        'use', source_rows.use_text,
        'duration', source_rows.duration,
        'effect', source_rows.effect_text,
        'item_description', source_rows.effect_text,
        'save_ability', source_rows.resolved_save_ability,
        'saveAbility', source_rows.resolved_save_ability,
        'save_dc', source_rows.resolved_save_dc,
        'saveDc', source_rows.resolved_save_dc,
        'area_text', source_rows.resolved_area_text,
        'areaText', source_rows.resolved_area_text,
        'base_area_feet', source_rows.base_area_feet,
        'area_shape', source_rows.area_shape
      )
      || jsonb_build_object(
        'alchemy', coalesce(ic.payload->'alchemy', '{}'::jsonb)
          || jsonb_strip_nulls(jsonb_build_object(
            'use', source_rows.use_text,
            'duration', source_rows.duration,
            'effect', source_rows.effect_text,
            'save_ability', source_rows.resolved_save_ability,
            'saveAbility', source_rows.resolved_save_ability,
            'save_dc', source_rows.resolved_save_dc,
            'saveDc', source_rows.resolved_save_dc,
            'area_text', source_rows.resolved_area_text,
            'areaText', source_rows.resolved_area_text,
            'base_area_feet', source_rows.base_area_feet,
            'area_shape', source_rows.area_shape,
            'condition_riders', source_rows.condition_riders,
            'cures_conditions', source_rows.cures_conditions,
            'grants_immunities', source_rows.grants_immunities,
            'rider_save', source_rows.rider_save,
            'rider_duration', source_rows.rider_duration,
            'rider_repeat_save', source_rows.rider_repeat_save,
            'base_dice_count', source_rows.base_dice_count,
            'base_die_size', source_rows.base_die_size,
            'base_flat_bonus', source_rows.base_flat_bonus,
            'base_uses', source_rows.base_uses,
            'dice_purpose', source_rows.dice_purpose,
            'requiredTagsAny', source_rows.required_tags_any,
            'tag_label', source_rows.tag_label,
            'templateKey', source_rows.template_key,
            'formulaFamily', source_rows.formula_family,
            'group', source_rows.alchemy_group,
            'section', source_rows.alchemy_section,
            'recipe_component_profile', jsonb_build_object(
              'core_families', coalesce((ic.payload->'alchemy'->'cores'), '[]'::jsonb),
              'required_tags_any', to_jsonb(source_rows.required_tags_any),
              'tag_label', coalesce(source_rows.tag_label, ''),
              'template_key', source_rows.template_key
            )
          ))
      )
      || jsonb_build_object(
        'merchant_craft', jsonb_strip_nulls(jsonb_build_object(
          'source', 'DNDNext Alchemy Codex',
          'quality', 'standard merchant stock',
          'save_dc', source_rows.resolved_save_dc,
          'save_ability', source_rows.resolved_save_ability,
          'area_text', source_rows.resolved_area_text,
          'use', source_rows.use_text,
          'duration', source_rows.duration,
          'effect', source_rows.effect_text,
          'component_profile', jsonb_build_object(
            'core_families', coalesce((ic.payload->'alchemy'->'cores'), '[]'::jsonb),
            'required_tags_any', to_jsonb(source_rows.required_tags_any),
            'tag_label', coalesce(source_rows.tag_label, ''),
            'template_key', source_rows.template_key
          )
        ))
      )
    )
  from source_rows
  where ic.id = source_rows.id
  returning ic.id
), stock_source as (
  select cs.id, cs.price_gp, cs.qty, ic.item_key, ic.item_name, ic.item_type, ic.item_rarity, ic.payload
  from public.character_stock cs
  join public.items_catalog ic on lower(ic.item_name) = lower(cs.display_name)
  where ic.payload->'alchemy'->>'kind' = 'crafted_product'
), stock_patch as (
  update public.character_stock cs
  set
    item_id = coalesce(cs.item_id, stock_source.item_key),
    card_payload = jsonb_strip_nulls(
      stock_source.payload
      || jsonb_build_object(
        'item_id', coalesce(cs.item_id, stock_source.item_key),
        'item_key', stock_source.item_key,
        'item_name', stock_source.item_name,
        'name', stock_source.item_name,
        'item_type', stock_source.item_type,
        'item_rarity', stock_source.item_rarity,
        'price_gp', cs.price_gp,
        'stock_qty', cs.qty
      )
    ),
    updated_at = now()
  from stock_source
  where cs.id = stock_source.id
  returning cs.id
)
select
  (select count(*) from catalog_patch) as enriched_catalog_rows,
  (select count(*) from stock_patch) as enriched_stock_rows;
