import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const need = (source, token, label = token) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};
const forbid = (source, token, label = token) => {
  if (source.includes(token)) throw new Error(`Forbidden ${label}: ${token}`);
};

const itemCard = read("components/ItemCard.js");
const migration = read("sql/20261016_04_merchant_alchemy_final_stats_pricing.sql");

for (const token of [
  "craftedAlchemyFlavorText",
  "!looksMechanicalItemText(stored)",
  'flavorIndex.get(familyName)',
  "alchemyResult.effect, merchantCraft.effect, alchemy.effect",
  "const sourceFlavorText = craftedAlchemy",
]) need(itemCard, token, "merchant-crafted presentation authority");

for (const token of [
  "merchant_alchemy_finalize_stock_payload_v1",
  "merchant-crafted-stats-v1",
  "character_stock_sync_crafted_price_v1",
  "'base_price_gp'",
  "'crafted_price_gp'",
  "'salePriceGp'",
  "v_damage_gain * 0.60",
  "v_area_gain * 0.35",
  "v_duration_gain * 0.25",
  "v_extra_doses * 0.40",
  "v_save_bonus * 0.20",
  "least(",
  "4.0",
  "replace(v_effect, v_base_area_text || '-foot-radius'",
  "'areaText',v_area_text",
  "'save_dc',(v_craft->>'save_dc')::integer",
  "Preserve the current random ingredient rolls",
]) need(migration, token, "merchant-crafted final-stat/pricing migration");

for (const source of [itemCard, migration]) {
  for (const token of ["MapPageClient", "advance_all_characters_v3", "get_weather_for_biome_day_v1"]) {
    forbid(source, token, `protected world-map boundary ${token}`);
  }
}

console.log("Merchant-crafted alchemy final-stat authority and realized-stat pricing validated.");
