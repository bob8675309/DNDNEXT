from pathlib import Path

path = Path("sql/20260613_98_smithing_material_quality_v5.sql")
text = path.read_text()


def replace_between(start_marker: str, end_marker: str, replacement: str, label: str) -> None:
    global text
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f"{label}: start marker not found")
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f"{label}: end marker not found")
    text = text[:start] + replacement.rstrip() + "\n\n" + text[end:]


structured = r"""do $patch_structured_materials$
declare
  v_definition text;
begin
  select pg_get_functiondef('private.apply_structured_crafting_traits_v1()'::regprocedure)
  into v_definition;

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
    v_definition := regexp_replace(
      v_definition,
      'to_char\(v_pct, ''FM999999990\.##''\),[[:space:]]+initcap\(v_element\)',
      E'to_char(v_effective_pct, ''FM999999990.##''),\n        initcap(v_element)'
    );

    if position('structured-materials-v3' in v_definition) = 0
       or position('if not v_is_defensive and v_element = any(v_affinity) then' in v_definition) > 0
       or position('v_current := coalesce(nullif(v_absorb_investment->>v_element, '''')::numeric, 0) + v_pct;' in v_definition) > 0 then
      raise exception 'Could not safely patch private.apply_structured_crafting_traits_v1';
    end if;

    execute v_definition;
  end if;
end;
$patch_structured_materials$;"""

conversion = r"""do $patch_affinity_conversion$
declare
  v_definition text;
begin
  select pg_get_functiondef('private.apply_smithing_affinity_polish_v4()'::regprocedure)
  into v_definition;

  if position('v_conversion_mode' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      'v_converts_base boolean := false;',
      E'v_converts_base boolean := false;\n  v_conversion_mode text := ''matching'';'
    );
    v_definition := replace(
      v_definition,
      'v_multiplier := greatest(1, coalesce(nullif(v_material_profile->>''matchingEffectMultiplier'', '''')::numeric, 1));',
      E'v_multiplier := greatest(1, coalesce(nullif(v_material_profile->>''matchingEffectMultiplier'', '''')::numeric, 1));\n  v_conversion_mode := lower(coalesce(nullif(v_material_profile->>''baseDamageConversion'', ''''), case when coalesce(nullif(v_material_profile->>''convertsBaseDamage'', '''')::boolean, true) then ''matching'' else ''none'' end));'
    );
    v_definition := regexp_replace(
      v_definition,
      'v_converts_base := not v_is_defensive[[:space:]]+and nullif\(v_initial_element, ''''\) is not null',
      E'v_converts_base := not v_is_defensive\n    and v_conversion_mode <> ''none''\n    and nullif(v_initial_element, '''') is not null'
    );

    if position('v_conversion_mode text' in v_definition) = 0
       or position('v_conversion_mode := lower' in v_definition) = 0
       or position('and v_conversion_mode <> ''none''' in v_definition) = 0 then
      raise exception 'Could not safely patch private.apply_smithing_affinity_polish_v4';
    end if;

    execute v_definition;
  end if;
end;
$patch_affinity_conversion$;"""

replace_between(
    "do $patch_structured_materials$",
    "-- Respect materials such as Refined Mana Crystal",
    structured,
    "structured trigger patch",
)
replace_between(
    "do $patch_affinity_conversion$",
    "with material_defs(",
    conversion,
    "affinity conversion patch",
)

marker = "-- SQL_PATCH_V5_HARDENED"
if marker not in text:
    text = text.replace(
        "-- quality-aware catalog payloads, and consistent persisted temper scaling.",
        "-- quality-aware catalog payloads, and consistent persisted temper scaling.\n" + marker,
        1,
    )

price_marker = "-- SQL_PRICE_V5_FIXED"
if price_marker not in text:
    item_name_line = "    case when q.quality_key = 'hq' then 'HQ ' || d.base_name else d.base_name end as item_name,"
    if text.count(item_name_line) != 2:
        raise RuntimeError(f"price patch: expected two variant item-name lines, found {text.count(item_name_line)}")
    text = text.replace(item_name_line, item_name_line + "\n    d.normal_key,", 2)

    price_expression = """  coalesce(
    (select existing.price_gp from public.items_catalog existing where existing.item_key = v.normal_key limit 1),
    case v.rarity
      when 'Mundane' then 5
      when 'Common' then 15
      when 'Uncommon' then 75
      when 'Rare' then 500
      when 'Very Rare' then 2500
      when 'Legendary' then 10000
      else 25
    end
  ) * case when v.quality_key = 'hq' then 2 else 1 end,"""
    if text.count("  null,\n  array['smithing','material'") != 2:
        raise RuntimeError("price patch: expected two null smithing material price expressions")
    text = text.replace("  null,\n  array['smithing','material'", price_expression + "\n  array['smithing','material'", 2)
    text = text.replace(marker, marker + "\n" + price_marker, 1)

required = [
    "SQL_PATCH_V5_HARDENED",
    "SQL_PRICE_V5_FIXED",
    "regexp_replace(",
    "E'v_converts_base boolean := false;\\n  v_conversion_mode",
    "Could not safely patch private.apply_structured_crafting_traits_v1",
    "Could not safely patch private.apply_smithing_affinity_polish_v4",
    "existing.item_key = v.normal_key",
]
for token in required:
    if token not in text:
        raise RuntimeError(f"verification token missing: {token}")

path.write_text(text)
print("hardened smithing material quality v5 SQL", len(text), text.count("\n") + 1)
