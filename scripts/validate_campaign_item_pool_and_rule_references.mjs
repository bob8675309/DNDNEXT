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
const balanceMigration = read("sql/20261016_05_resistance_rings_petrification_rules.sql");
const balanceFixMigration = read("sql/20261016_06_fix_resistance_ring_element_labels.sql");
const resistanceOrderMigration = read("sql/20261016_08_resistance_before_flat_reduction.sql");
const campaignOverrides = read("scripts/lib/campaign_item_overrides.mjs");
const forgeMerchant = read("components/NpcForgeMerchantMarket.js");
const itemCardText = read("utils/itemCardText.js");


const { resolveItemCopies } = await import("./lib/resolve_item_copies.mjs");
const { applyCampaignItemRuleOverrides } = await import("./lib/campaign_item_overrides.mjs");

const fireRingFixture = applyCampaignItemRuleOverrides({
  name: "Ring of Fire Resistance",
  source: "XDMG",
  uiType: "Wondrous Item",
  rarity: "rare",
  item_rarity: "rare",
  price_gp: 5000,
  resist: ["fire"],
  item_description: "{#itemEntry Ring of Resistance|XDMG}",
});
if (fireRingFixture.item_rarity !== "uncommon" || Number(fireRingFixture.price_gp) !== 2000) {
  throw new Error("DNDNext Resistance Ring rarity/economy override failed.");
}
if (Number(fireRingFixture?.damageReductionByType?.fire) !== 10 || fireRingFixture.damageReductionBeforeResistance !== false) {
  throw new Error("DNDNext Resistance Ring flat reduction override failed.");
}
if (!/apply Resistance first/i.test(fireRingFixture.item_description || "") || !/reduce the remaining damage by 10/i.test(fireRingFixture.item_description || "")) {
  throw new Error("DNDNext Resistance Ring player-facing rule text failed.");
}

const petrificationFixture = applyCampaignItemRuleOverrides({
  item_name: "Bomb of Petrification",
  payload: {
    item_name: "Bomb of Petrification",
    alchemy: { kind: "crafted_product", condition_riders: ["Petrified"] },
    item_description: "Immediate petrification placeholder.",
  },
});
if (!/Initial Saving Throw/.test(petrificationFixture?.payload?.item_description || "")
    || !/3 Successes/.test(petrificationFixture?.payload?.item_description || "")
    || !/3 Failures/.test(petrificationFixture?.payload?.item_description || "")
    || petrificationFixture?.payload?.alchemy?.condition_riders?.join("|") !== "Restrained|Petrified") {
  throw new Error("Bomb of Petrification staged-save campaign override failed.");
}

const copyFixture = resolveItemCopies([
  {
    name: "Quest Plate (Dormant)",
    source: "TEST",
    uiType: "Armor",
    rarity: "legendary",
    item_rarity: "legendary",
    price_gp: 15000,
    item_description: "Dormant rules.",
  },
  {
    name: "Quest Plate (Awakened)",
    source: "TEST",
    item_rarity: "mundane",
    price_gp: 1,
    _copy: {
      name: "Quest Plate (Dormant)",
      source: "TEST",
      _mod: { entries: [{ mode: "appendArr", items: [{ name: "Awakened", entries: ["Awakened rules."] }] }] },
    },
  },
  {
    name: "Quest Plate (Exalted)",
    source: "TEST",
    item_rarity: "mundane",
    price_gp: 1,
    _copy: {
      name: "Quest Plate (Awakened)",
      source: "TEST",
      _mod: { entries: [{ mode: "appendArr", items: [{ name: "Exalted", entries: ["Exalted rules."] }] }] },
    },
  },
], { warn: () => {} });
const awakenedFixture = copyFixture.find((row) => row.name.endsWith("(Awakened)"));
const exaltedFixture = copyFixture.find((row) => row.name.endsWith("(Exalted)"));
if (awakenedFixture?.item_rarity !== "legendary" || Number(awakenedFixture?.price_gp) !== 15000) {
  throw new Error("Awakened copy did not inherit base rarity/economy.");
}
if (!/Dormant rules/.test(awakenedFixture?.item_description || "") || !/Awakened rules/.test(awakenedFixture?.item_description || "")) {
  throw new Error("Awakened copy did not retain Dormant rules plus its appended state rules.");
}
if (!/Dormant rules/.test(exaltedFixture?.item_description || "") || !/Awakened rules/.test(exaltedFixture?.item_description || "") || !/Exalted rules/.test(exaltedFixture?.item_description || "")) {
  throw new Error("Exalted copy chain did not accumulate all progression-state rules.");
}

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

for (const token of [
  "applyCampaignItemRuleOverrides",
  "damageReductionByType",
  "damageReductionBeforeResistance",
  "DNDNext elemental resistance ring",
  "bomb of petrification",
  "Initial Saving Throw",
  "3 Successes",
  "3 Failures",
]) need(campaignOverrides, token, "campaign item-rule overrides");

for (const token of [
  "onReferenceDetail: openRuleDetail",
  "NpcForgeClassFeatureDock",
  "__itemCardInstance",
]) need(forgeMerchant, token, "Forge Equipment direct rule-reference window");

for (const token of [
  "Damage Reduction",
  "damageReductionByType",
  "structureKnownItemRuleText",
  "Trap a Creature",
  "Release or Command",
  "Identify the Contents",
]) need(itemCardText, token, "ItemCard structured rule presentation");

for (const token of [
  "+2 Ring of Protection",
  "damageReductionByType",
  "damageReductionBeforeResistance",
  "Bomb of Petrification",
  "Restrained",
  "Petrified",
  "3 successes end the effect",
]) need(balanceMigration, token, "ring/bomb balance migration");
need(balanceFixMigration, "split_part(split_part(item_name, 'Ring of ', 2), ' Resistance', 1)", "resistance-ring element hotfix");

for (const source of [itemCard, references, globalDock, pool, merchant, merchantTheme, admin, buildItems, seedItems, copyResolver, migration, balanceMigration, balanceFixMigration, resistanceOrderMigration, campaignOverrides, forgeMerchant, itemCardText]) {
  for (const token of ["MapPageClient", "advance_all_characters_v3", "get_weather_for_biome_day_v1"]) {
    forbid(source, token, `protected world-map boundary ${token}`);
  }
}

console.log("Campaign item-pool toggle, merchant rarity/type constraints, evolving relic inheritance, and clickable rule references validated.");
