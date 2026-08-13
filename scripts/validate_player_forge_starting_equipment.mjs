import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("sql/20260808_49_player_forge_starting_equipment_currency.sql");
const utility = read("utils/playerForgeStartingEquipment.js");
const controller = read("components/useNpcForgeController.js");
const core = read("components/NpcForgeCoreSupport.js");
const equipmentStep = read("components/NpcForgeEquipmentStep.js");
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
  "Starting gear & character currency",
  "PackageGroup",
  "Roll 1d10 Starting Wealth",
  "startingCurrencyCopper",
  "magicAllowanceLabel",
  "DM guide only",
  "not randomly or automatically granted",
]) need(equipmentStep, token);

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

for (const source of [utility, controller, equipmentStep, derived, modal]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "weather"]) forbid(source, token, `protected world boundary ${token}`);
}

console.log("Player Forge source-backed class/background starting equipment, character-scoped inventory/currency, higher-level wealth, DM-only magic guide, Equipment step, and protected boundaries validated.");
