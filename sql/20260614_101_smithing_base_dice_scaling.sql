-- DNDNext smithing base-dice scaling v4
-- Elemental temper damage always scales from the original weapon dice.
-- Example: 225% of a Battleaxe's 1d8 / 1d10 becomes 3d8 / 3d10.

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
    return to_char(coalesce(p_percent, 0), 'FM999999990.##') || '% of base weapon damage';
  end if;

  v_match := regexp_match(p_expression, '(\d+)\s*d\s*(4|6|8|10|12)', 'i');
  if v_match is null then
    return to_char(p_percent, 'FM999999990.##') || '% of base weapon damage';
  end if;

  v_count := v_match[1]::numeric;
  v_size := v_match[2]::integer;
  v_scaled := v_count * p_percent / 100.0;

  if v_scaled > 0 then
    return greatest(1, ceil(v_scaled - 0.000000001)::integer)::text || 'd' || v_size::text;
  end if;

  return to_char(p_percent, 'FM999999990.##') || '% of ' || v_match[1] || 'd' || v_size::text;
end;
$$;

do $smithing_base_dice_patch$
declare
  v_definition text;
  v_old_original text;
  v_new_original text;
  v_old_conversion text;
  v_new_conversion text;
  v_old_version_fields text;
  v_new_version_fields text;
begin
  select pg_get_functiondef('private.apply_structured_crafting_traits_v1()'::regprocedure)
  into v_definition;

  v_definition := replace(v_definition, E'\r\n', E'\n');

  if position('structured-materials-v4-base-dice-scaling' in v_definition) = 0 then
    if position('structured-materials-v3' in v_definition) = 0 then
      raise exception 'Unexpected structured smithing function version';
    end if;

    v_definition := replace(v_definition, 'structured-materials-v3', 'structured-materials-v4-base-dice-scaling');

    v_old_original := $old_original$
  v_original_dmg1 := nullif(new.card_payload->>'dmg1', '');
  v_original_dmg2 := nullif(new.card_payload->>'dmg2', '');
  v_final_dmg1 := v_original_dmg1;
  v_final_dmg2 := v_original_dmg2;
$old_original$;

    v_new_original := $new_original$
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
$new_original$;

    if position(v_old_original in v_definition) = 0 then
      raise exception 'Could not locate original damage initialization block';
    end if;
    v_definition := replace(v_definition, v_old_original, v_new_original);

    if position('v_dice_text := private.smithing_scaled_dice_text_v1(v_final_dmg1, v_effective_pct);' in v_definition) = 0 then
      raise exception 'Could not locate rider damage scaling call';
    end if;
    v_definition := replace(
      v_definition,
      'v_dice_text := private.smithing_scaled_dice_text_v1(v_final_dmg1, v_effective_pct);',
      'v_dice_text := private.smithing_scaled_dice_text_v1(v_original_dmg1, v_effective_pct);'
    );

    v_old_conversion := $old_conversion$
    if v_final_dmg1 is not null then
      v_damage_text := v_final_dmg1 || ' ' || v_primary_element;
      if v_final_dmg2 is not null then
        v_damage_text := v_damage_text || ', versatile (' || v_final_dmg2 || ')';
      end if;
      new.card_payload := new.card_payload || jsonb_build_object('damageText', v_damage_text);
    end if;
$old_conversion$;

    v_new_conversion := $new_conversion$
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
$new_conversion$;

    if position(v_old_conversion in v_definition) = 0 then
      raise exception 'Could not locate base conversion output block';
    end if;
    v_definition := replace(v_definition, v_old_conversion, v_new_conversion);

    v_old_version_fields := $old_version_fields$
      'processed_version', 'structured-materials-v4-base-dice-scaling',
      'selection_fingerprint', v_fingerprint,
$old_version_fields$;

    v_new_version_fields := $new_version_fields$
      'processed_version', 'structured-materials-v4-base-dice-scaling',
      'selection_fingerprint', v_fingerprint,
      'original_base_dmg1', v_original_dmg1,
      'original_base_dmg2', v_original_dmg2,
$new_version_fields$;

    if position(v_old_version_fields in v_definition) = 0 then
      raise exception 'Could not locate smithing version fields';
    end if;
    v_definition := replace(v_definition, v_old_version_fields, v_new_version_fields);

    if position('v_dice_text := private.smithing_scaled_dice_text_v1(v_original_dmg1, v_effective_pct);' in v_definition) = 0
       or position('v_final_dmg1 := private.smithing_scaled_dice_text_v1(v_original_dmg1, v_effective_pct);' in v_definition) = 0
       or position('''original_base_dmg2'', v_original_dmg2' in v_definition) = 0 then
      raise exception 'Structured smithing base-dice patch validation failed';
    end if;

    execute v_definition;
  end if;
end;
$smithing_base_dice_patch$;

with catalog_base as (
  select
    i.id,
    coalesce(
      nullif(i.card_payload->'smithing_result'->>'originalBaseDamage', ''),
      nullif(i.card_payload->'smithing_result'->>'baseDamage', ''),
      nullif(c.payload->>'dmg1', '')
    ) as original_dmg1,
    coalesce(
      nullif(i.card_payload->'smithing_result'->>'originalSecondaryDamage', ''),
      nullif(c.payload->>'dmg2', '')
    ) as original_dmg2
  from public.inventory_items i
  left join public.items_catalog c
    on c.item_key = regexp_replace(i.item_id, '^forge:(.*):[^|]+\|(.*)$', '\1|\2')
  where jsonb_typeof(i.card_payload->'smithing') = 'object'
    and coalesce(i.card_payload->'smithing'->>'processed_version', '') like 'structured-materials-%'
)
update public.inventory_items i
set card_payload = i.card_payload || jsonb_build_object(
  'smithing',
  coalesce(i.card_payload->'smithing', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'original_base_dmg1', b.original_dmg1,
    'original_base_dmg2', b.original_dmg2
  ))
)
from catalog_base b
where i.id = b.id
  and b.original_dmg1 is not null
  and (
    coalesce(i.card_payload->'smithing'->>'original_base_dmg1', '') = ''
    or (b.original_dmg2 is not null and coalesce(i.card_payload->'smithing'->>'original_base_dmg2', '') = '')
  );
