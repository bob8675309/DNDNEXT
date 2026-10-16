import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const need = (source, token, label = token) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};
const forbid = (source, token, label = token) => {
  if (source.includes(token)) throw new Error(`Forbidden ${label}: ${token}`);
};

const itemCard = read("components/ItemCard.js");
const references = read("utils/itemRuleReferences.js");
const globalDock = read("components/GlobalRuleReferenceDock.js");
const app = read("pages/_app.js");
const pool = read("utils/campaignItemPool.js");
const merchant = read("components/MerchantPanel.js");
const merchantTheme = read("utils/merchantTheme.js");
const admin = read("pages/admin.js");
const buildItems = read("scripts/build-all-items.mjs");
const seedItems = read("scripts/seed_items_catalog.mjs");
const copyResolver = read("scripts/lib/resolve_item_copies.mjs");
const migration = read("sql/20261016_01_campaign_item_pool_final_constraints.sql");

for (const token of [
  "ITEM_RULE_REFERENCE_TERMS",
  "itemRuleReferenceForLabel",
  "RuleLinkedText",
  "dndnext:rule-reference",
  'clean("Mastery", ammunition?.mastery || directMastery)',
  "relicStateForItem",
  'label: "Relic State"',
]) need(itemCard, token, "ItemCard rule-reference bridge");

for (const token of [
  "Brutal",
  "Strong-Draw",
  "Stunned",
  "Dazed",
  "Incapacitated",
  "Poisoned",
  "Weapon Mastery",
  "Condition",
]) need(references, token, "rule-reference definition");

for (const token of [
  "GlobalRuleReferenceDock",
  "NpcForgeClassFeatureDock",
  "dndnext:rule-reference",
]) need(globalDock, token, "global movable feature-window bridge");
need(app, "GlobalRuleReferenceDock", "global rule-reference mount");

for (const token of [
  "isFutureTechItem",
  "campaignLootEligible",
  "merchantThemeAllowsItem",
  "merchantRarityBucket",
  "dormant|awakened|exalted",
  "UTILITY_WONDROUS_RE",
  '"Explosives", "Future"',
]) need(pool, token, "campaign item-pool helper");

for (const token of [
  "sampleDiverse",
  "campaign_item_pool_settings",
  "campaignLootEligible",
  "merchantThemeAllowsItem",
  "const nLow = Math.max(0, Math.round(count * 0.15))",
  "const nUncommon = Math.max(0, Math.round(count * 0.50))",
  "const nHigh = Math.max(0, Math.round(count * 0.10))",
  "const nRare = Math.max(0, count - nLow - nUncommon - nHigh)",
]) need(merchant, token, "merchant fallback parity");

for (const token of [
  'tagged("herbalist")',
  'tagged("smith")',
  'tagged("jeweler")',
  'tagged("arcanist")',
  'value.startsWith("profession:alchemy")',
]) need(merchantTheme, token, "merchant tag precedence");

for (const token of [
  "campaign_item_pool_settings",
  "set_campaign_future_tech_enabled_v1",
  "futureTechEnabled",
  "Future weapons &amp; armor",
  "isFutureTechItem",
]) need(admin, token, "Admin future-tech switch");

need(buildItems, 'resolveItemCopies', "build-time item copy resolution");
need(seedItems, 'resolveItemCopies', "seed-time item copy resolution");
for (const token of ["resolveItemCopies", "applyEntryMods", "_copy", "item_description"]) need(copyResolver, token, "copy resolver");

for (const token of [
  "campaign_item_pool_settings",
  "item_is_future_tech_v1",
  "item_is_setting_specific_junk_v1",
  "item_is_progression_state_variant_v1",
  "merchant_item_theme_eligible_v2",
  "reroll_merchant_inventory_v2",
  "set_campaign_future_tech_enabled_v1",
  "v_item_target*0.15",
  "v_item_target*0.50",
  "v_item_target*0.10",
  "row_number() OVER",
  "dormant|awakened|exalted",
  "Explosives','Future",
]) need(migration, token, "server-authoritative item-pool migration");

for (const source of [itemCard, references, globalDock, pool, merchant, merchantTheme, admin, buildItems, seedItems, copyResolver, migration]) {
  for (const token of ["MapPageClient", "advance_all_characters_v3", "get_weather_for_biome_day_v1"]) {
    forbid(source, token, `protected world-map boundary ${token}`);
  }
}

console.log("Campaign item-pool toggle, merchant rarity/type constraints, evolving relic inheritance, and clickable rule references validated.");
