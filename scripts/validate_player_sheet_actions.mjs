import fs from "node:fs";
import path from "node:path";
import {
  buildCharacterSheetActions,
  formatInventoryEquipmentText,
} from "../utils/characterSheetActions.js";

const root = process.cwd();
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function expectEqual(actual, expected, message) {
  expect(Object.is(actual, expected), `${message}: expected ${expected}, received ${actual}`);
}

const vargesInventory = [
  {
    id: "greataxe",
    item_name: "Greataxe",
    item_type: "Martial Melee Weapon",
    quantity: 1,
    is_equipped: true,
    equip_slot: "weapon_1",
    card_payload: { type: "M", dmg1: "1d12", dmgType: "S" },
  },
  {
    id: "javelin",
    item_name: "Javelin",
    item_type: "Simple Melee Weapon",
    quantity: 4,
    is_equipped: false,
    card_payload: { type: "S", dmg1: "1d6", dmgType: "P", range: "30/120 ft." },
  },
  {
    id: "pack",
    item_name: "Explorer's Pack",
    item_type: "Adventuring Gear",
    quantity: 1,
    is_equipped: false,
  },
];

const vargesActions = buildCharacterSheetActions({
  sheet: { meta: { classKey: "barbarian" } },
  inventoryRows: vargesInventory,
  abilityModifiers: { str: 5, dex: 2, con: 3, int: -1, wis: 1, cha: 0 },
  proficiencyBonus: 3,
});
expectEqual(vargesActions.length, 2, "only Varges's weapons become attack actions");
expectEqual(vargesActions[0].label, "Greataxe", "equipped weapon sorts first");
expectEqual(vargesActions[0].attackBonus, 8, "Varges Greataxe attack bonus");
expectEqual(vargesActions[0].damage, "1d12+5 slashing", "Varges Greataxe damage");
expectEqual(vargesActions[1].label, "Javelin", "Varges carried Javelin action");
expectEqual(vargesActions[1].attackBonus, 8, "Varges Javelin attack bonus");
expect(vargesActions[1].detail.includes("30/120 ft."), "Varges Javelin range");

const equipmentText = formatInventoryEquipmentText(vargesInventory);
expect(equipmentText.includes("Greataxe (equipped)"), "equipment summary marks equipped gear");
expect(equipmentText.includes("Javelin ×4"), "equipment summary preserves quantities");
expect(equipmentText.includes("Explorer's Pack"), "equipment summary includes carried non-weapons");

const lesoActions = buildCharacterSheetActions({
  sheet: {
    meta: { classKey: "warlock", subclass: "Hexblade", spellcastingAbility: "cha" },
    classFeatures: ["Pact of the Blade"],
    spellcasting: { pactSlots: 2, pactSlotLevel: 3 },
  },
  inventoryRows: [{
    id: "pact-longsword",
    item_name: "Pact Longsword",
    item_type: "Martial Melee Weapon",
    is_equipped: true,
    card_payload: { type: "M", dmg1: "1d8", dmgType: "S" },
  }],
  spellRows: [
    {
      id: "known-cantrip",
      prepared: false,
      always_available: false,
      casting_stat: "cha",
      attack_bonus_override: null,
      save_dc_override: null,
      spell: { id: "eldritch-blast", name: "Eldritch Blast", level: 0, attack_type: "ranged", damage_dice: "1d10", damage_types: ["force"], range_text: "120 ft." },
    },
    {
      id: "prepared-spell",
      prepared: true,
      casting_stat: "cha",
      attack_bonus_override: null,
      save_dc_override: null,
      spell: { id: "witch-bolt", name: "Witch Bolt", level: 1, attack_type: "ranged", damage_dice: "2d12", damage_types: ["lightning"], range_text: "60 ft." },
    },
    {
      id: "unprepared-spell",
      prepared: false,
      spell: { id: "unprepared", name: "Unprepared Spell", level: 2, attack_type: "ranged" },
    },
  ],
  abilityModifiers: { str: 0, dex: 2, con: 3, int: 1, wis: 1, cha: 4 },
  proficiencyBonus: 3,
});
const pactWeapon = lesoActions.find((action) => action.id === "weapon:pact-longsword");
const eldritchBlast = lesoActions.find((action) => action.label === "Eldritch Blast");
const witchBolt = lesoActions.find((action) => action.label === "Witch Bolt");
expectEqual(pactWeapon?.ability, "cha", "Hexblade pact weapon uses Charisma");
expectEqual(pactWeapon?.attackBonus, 7, "Hexblade pact weapon attack bonus");
expectEqual(eldritchBlast?.group, "Cantrips", "cantrip action grouping");
expectEqual(eldritchBlast?.attackBonus, 7, "null spell override falls back to casting math");
expectEqual(witchBolt?.group, "Prepared Spells", "prepared spell action grouping");
expectEqual(witchBolt?.attackBonus, 7, "prepared spell attack bonus");
expect(witchBolt?.detail.includes("2 level-3 pact slots"), "prepared pact spell shows slot availability");
expect(!lesoActions.some((action) => action.label === "Unprepared Spell"), "unprepared leveled spells stay off the quick-action list");

const npcPanelSource = fs.readFileSync(path.join(root, "components/NpcPanel.js"), "utf8");
const sheetSource = fs.readFileSync(path.join(root, "components/CharacterSheet5e.js"), "utf8");
const profilePageSource = fs.readFileSync(path.join(root, "pages/profile.js"), "utf8");
const migrationSource = fs.readFileSync(path.join(root, "sql/20260802_01_player_character_inventory_and_sheet_actions.sql"), "utf8");

for (const token of [
  'supabase.rpc("get_character_inventory_v1"',
  'supabase.rpc("set_character_inventory_equipment_v1"',
  'from("character_spells")',
  'from("spells_catalog")',
  "formatInventoryEquipmentText(inventoryRows)",
  "inventoryItems={inventoryRows}",
  "spellActions={spellActions}",
]) expect(npcPanelSource.includes(token), `NPC/player panel missing ${JSON.stringify(token)}`);

for (const token of [
  "buildCharacterSheetActions({",
  "resolveClassUnarmoredDefense(s, abilityMods)",
  "groupedSheetActions.map",
  "resolveSheetAction(action)",
  "Combat notes",
]) expect(sheetSource.includes(token), `character sheet action surface missing ${JSON.stringify(token)}`);

expect(profilePageSource.includes('import { supabase } from "../utils/supabaseClient";'), "profile page must use the shared auth client");
expect(profilePageSource.includes("Open character panel"), "profile page must expose an explicit panel button");
expect(!profilePageSource.includes("createClient("), "profile page must not create a second auth client");

for (const token of [
  "security definer",
  "private.can_access_character_v1(p_character_id, 'inventory')",
  "revoke all on function public.get_character_inventory_v1(uuid) from public, anon",
  "grant execute on function public.get_character_inventory_v1(uuid) to authenticated, service_role",
  "when 'barbarian' then 10+v_dex_mod",
  "when 'monk' then 10+v_dex_mod",
]) expect(migrationSource.includes(token), `sheet/inventory migration missing ${JSON.stringify(token)}`);

if (failures.length) {
  console.error("Player sheet action validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Player sheet action validation passed.");
