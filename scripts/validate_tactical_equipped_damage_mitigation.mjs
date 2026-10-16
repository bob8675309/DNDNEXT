import fs from "node:fs";

const source = fs.readFileSync("sql/20261016_07_equipped_item_damage_mitigation.sql", "utf8");

const need = (token, label = token) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};
const forbid = (token, label = token) => {
  if (source.includes(token)) throw new Error(`Forbidden ${label}: ${token}`);
};

for (const token of [
  "private.encounter_equipped_damage_mitigation_v1",
  "ii.is_equipped is true",
  "character_permissions",
  "card_payload->>'item_key'",
  "damageReductionByType",
  "damage_reduction_by_type",
  "jsonb_array_elements_text(v_payload->'resist')",
  "v_flat_reduction := greatest(v_flat_reduction, v_reduction)",
  "public.encounter_apply_damage_internal_v1",
  "v_adjusted := greatest(0, v_adjusted - v_flat_reduction)",
  "v_after_flat := v_adjusted",
  "if v_res then",
  "v_adjusted := floor(v_adjusted / 2.0)::integer",
  "flatReductionApplied",
  "damageAfterFlatReduction",
  "equipmentResistance",
  "mitigationSources",
]) need(token);

const flatIndex = source.indexOf("v_adjusted := greatest(0, v_adjusted - v_flat_reduction)");
const resistanceIndex = source.indexOf("v_adjusted := floor(v_adjusted / 2.0)::integer");
if (flatIndex < 0 || resistanceIndex < 0 || flatIndex >= resistanceIndex) {
  throw new Error("Flat elemental reduction must be applied before Resistance.");
}

for (const token of [
  "item_description",
  "rulesShort",
  "MapPageClient",
  "advance_all_characters_v3",
  "get_weather_for_biome_day_v1",
]) forbid(token, "protected/prose inference boundary");

console.log("Structured equipped-item damage mitigation and reduction-before-Resistance order validated.");
