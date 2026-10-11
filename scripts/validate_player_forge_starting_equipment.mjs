import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("sql/20260808_49_player_forge_starting_equipment_currency.sql");
const marketMigration = read("sql/20261010_01_player_forge_starting_market.sql");
const homebrewMigration = read("sql/20261011_02_player_forge_homebrew_starting_budget.sql");
const utility = read("utils/playerForgeStartingEquipment.js");
const controller = read("components/useNpcForgeController.js");
const core = read("components/NpcForgeCoreSupport.js");
const equipmentStep = read("components/NpcForgeEquipmentStep.js");
const equipmentDock = read("components/NpcForgeEquipmentSummaryDock.js");
const merchantExpansion = read("sql/20261011_03_starting_market_merchant_expansion.sql");
const merchantVariety = read("sql/20261011_04_merchant_catalog_reroll_variety.sql");
const derived = read("components/useNpcForgeDerivedModel.js");
const modal = read("components/NewNpcModalV3Refined.js");

const need = (source, token, label = token) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};
const forbid = (source, token, label = token) => {
  if (source.includes(token)) throw new Error(`Forbidden ${label}: ${token}`);
};

for (const token of [
  "create table if not exists public.character_currency",
  "character_id uuid primary key",
  "copper_value bigint not null default 0",
  "source_breakdown jsonb",
  "('artificer','EFA'",
  "('barbarian','XPHB'",
  "('bard','XPHB'",
  "('cleric','XPHB'",
  "('druid','XPHB'",
  "('fighter','XPHB'",
  "('monk','XPHB'",
  "('paladin','XPHB'",
  "('ranger','XPHB'",
  "('rogue','XPHB'",
  "('sorcerer','XPHB'",
  "('warlock','XPHB'",
  "('wizard','XPHB'",
  "'{startingEquipment,defaultData}'",
  "player_forge_equipment_choice_allowed_v1",
  "get_player_forge_starting_equipment_v1",
  "materialize_player_forge_starting_equipment_v1",
  "character_progression_materialize_player_forge_starting_equipment_v1",
  "deferrable initially deferred",
  "'character',p_character_id::text",
  "startingEquipmentSelections",
  "startingEquipmentSummary",
  "startingCurrencyCopper",
  "higherLevelMagicItemGuide",
  "private.player_forge_higher_level_wealth_v1",
  "(500+v_roll*25)*100",
  "(5000+v_roll*250)*100",
  "(20000+v_roll*250)*100",
  "jsonb_build_object('common',1,'uncommon',1)",
  "jsonb_build_object('common',2,'uncommon',3,'rare',1)",
  "jsonb_build_object('common',2,'uncommon',4,'rare',3,'veryRare',1)",
  "get_character_currency_v1",
]) need(migration, token);

forbid(migration, "player_wallets", "account wallet usage");
forbid(migration, "owner_type,'player'", "account-scoped starter inventory");
forbid(migration, "'player',p_character_id", "player owner type starter inventory");
forbid(migration, "insert into public.items_catalog", "invented catalogue items");
forbid(migration, "item_rarity in ('common','uncommon','rare','very rare')", "automatic higher-level magic item grant");
forbid(migration, "MapPageClient", "world-map crossover");
forbid(migration, "map_routes", "world-route crossover");
forbid(migration, "weather", "world-weather crossover");

for (const token of [
  "normalizeEquipmentOptions",
  "equipmentChoiceKey",
  "equipmentPartNeedsChoice",
  "higherLevelCopper",
  "higherLevelWealthRule",
  "magicAllowanceLabel",
  "startingEquipmentSelectionComplete",
  "startingCurrencyCopper",
  "formatCopper",
  "(500 + d10 * 25) * 100",
  "(5000 + d10 * 250) * 100",
  "(20000 + d10 * 250) * 100",
]) need(utility, token);

for (const token of [
  '"Spells", "Equipment", "Identity"',
  "startingEquipment: {}",
]) need(core, token);

for (const token of [
  "get_player_forge_starting_equipment_v1",
  "normalizeStartingEquipmentSelection",
  "startingEquipmentSelectionComplete",
  "equipmentModel",
  'key === "equipment"',
  "startingEquipment: {}",
]) need(controller, token);

for (const token of [
  "Starting market",
  "DNDNext starting purse",
  "Campaign merchants",
  "startingMarketBudgetCopper",
  "startingMarketRemainingCopper",
  "marketPurchases",
  'from("characters")',
  'from("character_stock")',
  "ItemCard",
  "NpcForgeEquipmentSummaryDock",
  "Roll 1d10 Starting Wealth",
  "Starting market needs this Forge draft",
  "grid-template-columns:minmax(0,1fr)",
]) need(equipmentStep, token);
forbid(equipmentStep, "npc-forge-starting-market__budgetbar", "duplicated in-workspace budget strip");

for (const token of [
  "createPortal",
  "Starting cart",
  "Total gold",
  "Spent",
  "Remaining",
  "Vanilla source purse",
  "Class source cash",
  "Background source cash",
  "DM guide only",
  "startDrag",
  "moveDrag",
  "is-collapsed",
]) need(equipmentDock, token, "floating Equipment summary dock");

for (const token of [
  "cashOnlyEquipmentOption",
  "startingEquipmentRuleset",
  "startingMarketVanillaCopper",
  "DNDNEXT_STARTING_MARKET_FLOOR_COPPER",
  "startingMarketBaseCopper",
  "startingMarketPurchases",
  "startingMarketSpentCopper",
  "startingMarketBudgetCopper",
  "startingMarketRemainingCopper",
  'mode: "market"',
]) need(utility, token, "starting-market utility");

for (const token of [
  "player_forge_cash_equipment_option_v1",
  "v_mode='market'",
  "marketPurchases",
  "for update of cs",
  "merchant.storefront_enabled is true",
  "Starting-market purchases exceed the source-backed starting purse.",
  "'startingMarket',true",
  "'character',p_character_id::text",
  "delete from public.character_stock",
  "update public.character_stock",
  "'marketSpentCopper'",
  "startingCurrencyCopper",
]) need(marketMigration, token, "starting-market server authority");

forbid(marketMigration, "player_wallets", "starting-market account wallet usage");
forbid(marketMigration, "owner_type,'player'", "starting-market account inventory");
forbid(marketMigration, "MapPageClient", "starting-market world-map crossover");
forbid(marketMigration, "map_routes", "starting-market route crossover");
forbid(marketMigration, "weather", "starting-market weather crossover");

for (const token of [
  "dndnext-homebrew",
  "30000::bigint",
  "greatest(v_package_copper,30000::bigint)",
  "'vanillaSourceCopper',v_package_copper",
  "'homebrewBaseFloorCopper',30000",
  "startingEquipmentRuleset",
  "Unknown Player Forge starting-equipment ruleset.",
]) need(homebrewMigration, token, "DNDNext homebrew starting-budget authority");

forbid(homebrewMigration, "player_wallets", "homebrew starting-budget account wallet usage");
forbid(homebrewMigration, "MapPageClient", "homebrew starting-budget world-map crossover");
forbid(homebrewMigration, "map_routes", "homebrew starting-budget route crossover");

for (const token of [
  "startingEquipmentSelections",
  "backgroundId: selectedBackground?.id || null",
]) need(derived, token);

for (const token of [
  'import NpcForgeEquipmentStep from "./NpcForgeEquipmentStep";',
  'stepKey === "equipment"',
  "equipmentModel",
  "draft.startingEquipment",
]) need(modal, token);

for (const token of [
  "Mara Ironvein",
  "Selene Quill",
  "Pell Mossgrove",
  "Brakka Wayfarer",
  "Ilyra Glasshand",
  "Torren Packswell",
  "reroll_merchant_inventory_v2",
]) need(merchantExpansion, token, "starting-market merchant expansion");

for (const token of [
  "from public.items_catalog ic",
  "v_total integer := least(greatest",
  "48",
  "row_number() over",
  "type_slot",
  "lower(coalesce(ic.item_type,'')) <> 'recipe'",
  "v_recipe_target",
  "perform * from public.reroll_merchant_inventory_v2(v.id,v.theme,36)",
]) need(merchantVariety, token, "full-catalog diversified merchant reroll");

for (const source of [utility, controller, equipmentStep, equipmentDock, derived, modal, merchantExpansion, merchantVariety]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "weather"]) forbid(source, token, `protected world boundary ${token}`);
}

console.log("Player Forge source-backed starting market, staged merchant purchases, character-scoped inventory/currency, higher-level wealth, DM-only magic guide, and protected boundaries validated.");
