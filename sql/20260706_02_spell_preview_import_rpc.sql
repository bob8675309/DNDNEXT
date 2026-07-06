-- Controlled admin-only import path for reviewed spell preview JSON.
-- Expects the preview shape produced by scripts/import_5etools_spells.mjs:
-- { "summary": ..., "rows": [...], "effects": [...] }

create or replace function public.import_spell_preview_batch(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_eff jsonb;
  v_rows_count integer := coalesce(jsonb_array_length(coalesce(p_payload->'rows', '[]'::jsonb)), 0);
  v_effects_count integer := coalesce(jsonb_array_length(coalesce(p_payload->'effects', '[]'::jsonb)), 0);
  v_spell_id uuid;
  v_spell_key text;
  v_spell_count integer := 0;
  v_effect_count integer := 0;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Admin access is required to import spells.' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_payload->'rows', 'null'::jsonb)) <> 'array' then
    raise exception 'Payload must contain a rows array.';
  end if;

  if v_rows_count = 0 then
    raise exception 'Payload contains no spell rows.';
  end if;

  if v_rows_count > 250 then
    raise exception 'Import batch too large: %, maximum 250 spells per reviewed import.', v_rows_count;
  end if;

  if v_effects_count > 750 then
    raise exception 'Import batch too large: %, maximum 750 effects per reviewed import.', v_effects_count;
  end if;

  for v_row in select value from jsonb_array_elements(p_payload->'rows') loop
    v_spell_key := nullif(v_row->>'spell_key', '');
    if v_spell_key is null then
      raise exception 'Every spell row must include spell_key.';
    end if;

    insert into public.spells_catalog (
      spell_key, slug, name, source, source_file, page, level, school_code, school,
      classes, subclasses, ritual, concentration,
      casting_time, casting_time_json,
      range_text, range_type, range_distance, range_unit, range_json,
      area_type, area_size, area_unit,
      components_v, components_s, components_m, material_text, components_json,
      duration_text, duration_json,
      saving_throw_abilities, attack_type, damage_dice, damage_types, healing_dice,
      scaling_text, scaling_json, description, higher_level_text,
      tags, misc_tags, area_tags, raw_payload, imported_at, updated_at
    ) values (
      v_spell_key,
      coalesce(nullif(v_row->>'slug', ''), split_part(v_spell_key, '|', 1)),
      coalesce(nullif(v_row->>'name', ''), 'Unknown Spell'),
      coalesce(nullif(v_row->>'source', ''), 'UNK'),
      nullif(v_row->>'source_file', ''),
      nullif(v_row->>'page', '')::integer,
      coalesce(nullif(v_row->>'level', '')::integer, 0),
      nullif(v_row->>'school_code', ''),
      nullif(v_row->>'school', ''),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'classes', '[]'::jsonb))), '{}'),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'subclasses', '[]'::jsonb))), '{}'),
      coalesce((v_row->>'ritual')::boolean, false),
      coalesce((v_row->>'concentration')::boolean, false),
      nullif(v_row->>'casting_time', ''),
      coalesce(v_row->'casting_time_json', '[]'::jsonb),
      nullif(v_row->>'range_text', ''),
      nullif(v_row->>'range_type', ''),
      nullif(v_row->>'range_distance', '')::numeric,
      nullif(v_row->>'range_unit', ''),
      coalesce(v_row->'range_json', '{}'::jsonb),
      nullif(v_row->>'area_type', ''),
      nullif(v_row->>'area_size', '')::numeric,
      nullif(v_row->>'area_unit', ''),
      coalesce((v_row->>'components_v')::boolean, false),
      coalesce((v_row->>'components_s')::boolean, false),
      coalesce((v_row->>'components_m')::boolean, false),
      nullif(v_row->>'material_text', ''),
      coalesce(v_row->'components_json', '{}'::jsonb),
      nullif(v_row->>'duration_text', ''),
      coalesce(v_row->'duration_json', '[]'::jsonb),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'saving_throw_abilities', '[]'::jsonb))), '{}'),
      nullif(v_row->>'attack_type', ''),
      nullif(v_row->>'damage_dice', ''),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'damage_types', '[]'::jsonb))), '{}'),
      nullif(v_row->>'healing_dice', ''),
      nullif(v_row->>'scaling_text', ''),
      coalesce(v_row->'scaling_json', '{}'::jsonb),
      nullif(v_row->>'description', ''),
      nullif(v_row->>'higher_level_text', ''),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'tags', '[]'::jsonb))), '{}'),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'misc_tags', '[]'::jsonb))), '{}'),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'area_tags', '[]'::jsonb))), '{}'),
      coalesce(v_row->'raw_payload', '{}'::jsonb),
      now(),
      now()
    )
    on conflict (spell_key) do update set
      slug = excluded.slug,
      name = excluded.name,
      source = excluded.source,
      source_file = excluded.source_file,
      page = excluded.page,
      level = excluded.level,
      school_code = excluded.school_code,
      school = excluded.school,
      classes = excluded.classes,
      subclasses = excluded.subclasses,
      ritual = excluded.ritual,
      concentration = excluded.concentration,
      casting_time = excluded.casting_time,
      casting_time_json = excluded.casting_time_json,
      range_text = excluded.range_text,
      range_type = excluded.range_type,
      range_distance = excluded.range_distance,
      range_unit = excluded.range_unit,
      range_json = excluded.range_json,
      area_type = excluded.area_type,
      area_size = excluded.area_size,
      area_unit = excluded.area_unit,
      components_v = excluded.components_v,
      components_s = excluded.components_s,
      components_m = excluded.components_m,
      material_text = excluded.material_text,
      components_json = excluded.components_json,
      duration_text = excluded.duration_text,
      duration_json = excluded.duration_json,
      saving_throw_abilities = excluded.saving_throw_abilities,
      attack_type = excluded.attack_type,
      damage_dice = excluded.damage_dice,
      damage_types = excluded.damage_types,
      healing_dice = excluded.healing_dice,
      scaling_text = excluded.scaling_text,
      scaling_json = excluded.scaling_json,
      description = excluded.description,
      higher_level_text = excluded.higher_level_text,
      tags = excluded.tags,
      misc_tags = excluded.misc_tags,
      area_tags = excluded.area_tags,
      raw_payload = excluded.raw_payload,
      imported_at = now(),
      updated_at = now()
    returning id into v_spell_id;

    delete from public.spell_effects where spell_id = v_spell_id;

    for v_eff in select value from jsonb_array_elements(coalesce(p_payload->'effects', '[]'::jsonb)) where value->>'spell_key' = v_spell_key loop
      insert into public.spell_effects (
        spell_id, effect_index, effect_kind, damage_type, dice_formula, save_ability,
        save_effect, condition, duration_text, area_type, area_size, area_unit,
        targeting_text, scaling_formula, effect_text, tags, raw_payload
      ) values (
        v_spell_id,
        coalesce(nullif(v_eff->>'effect_index', '')::integer, 0),
        coalesce(nullif(v_eff->>'effect_kind', ''), 'utility'),
        nullif(v_eff->>'damage_type', ''),
        nullif(v_eff->>'dice_formula', ''),
        nullif(v_eff->>'save_ability', ''),
        nullif(v_eff->>'save_effect', ''),
        nullif(v_eff->>'condition', ''),
        nullif(v_eff->>'duration_text', ''),
        nullif(v_eff->>'area_type', ''),
        nullif(v_eff->>'area_size', '')::numeric,
        nullif(v_eff->>'area_unit', ''),
        nullif(v_eff->>'targeting_text', ''),
        nullif(v_eff->>'scaling_formula', ''),
        nullif(v_eff->>'effect_text', ''),
        coalesce(array(select jsonb_array_elements_text(coalesce(v_eff->'tags', '[]'::jsonb))), '{}'),
        coalesce(v_eff->'raw_payload', '{}'::jsonb)
      );
      v_effect_count := v_effect_count + 1;
    end loop;

    v_spell_count := v_spell_count + 1;
  end loop;

  return jsonb_build_object('spells', v_spell_count, 'effects', v_effect_count);
end;
$$;

revoke all on function public.import_spell_preview_batch(jsonb) from public;
grant execute on function public.import_spell_preview_batch(jsonb) to authenticated;
