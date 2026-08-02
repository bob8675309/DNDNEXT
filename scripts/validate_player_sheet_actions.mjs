import fs from "node:fs";
import path from "node:path";
import {
  buildCharacterSheetActions,
  formatInventoryEquipmentText,
  resolveCharacterSheetActionMode,
  rollCharacterSheetDamage,
} from "../utils/characterSheetActions.js";
import { mergeKnownCharacterOptions } from "../utils/characterOptionPresentation.js";
import { buildCharacterSheetFeatures } from "../utils/characterSheetFeatures.js";

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
    card_payload: { type: "S", dmg1: "1d6", dmgType: "P", property: ["T"], rangeText: "Thrown 30/120 ft." },
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
  sheet: {
    meta: { classKey: "barbarian" },
    speciesTraits: ["Long-Limbed"],
    rages: 3,
    rageDamageBonus: 2,
  },
  inventoryRows: vargesInventory,
  featureRows: [{ category: "Class", name: "Rage", description: "Enter Rage as a Bonus Action." }],
  abilityModifiers: { str: 5, dex: 2, con: 3, int: -1, wis: 1, cha: 0 },
  proficiencyBonus: 3,
});
expectEqual(vargesActions.length, 3, "Varges receives Rage plus one row for each physical weapon");
expectEqual(vargesActions[0].label, "Rage", "activatable Rage sorts into the Abilities group first");
expectEqual(vargesActions[0].usesRemaining, 3, "Rage defaults to all uses remaining");
expectEqual(vargesActions[1].label, "Greataxe", "equipped weapon sorts first");
expectEqual(vargesActions[1].attackBonus, 8, "Varges Greataxe attack bonus");
expectEqual(vargesActions[1].damage, "1d12+5 slashing", "Varges Greataxe damage");
expectEqual(vargesActions[1].damageFormula, "1d12+5", "weapon damage keeps a rollable formula separate from its type");
expect(vargesActions[1].detail.includes("Reach 10 ft."), "Long-Limbed applies to Varges's melee Greataxe action");
const javelinAction = vargesActions[2];
expectEqual(javelinAction.label, "Javelin", "Javelin occupies one weapon row");
expectEqual(javelinAction.modes.length, 2, "Javelin exposes melee and thrown profiles on one row");
const javelinMelee = resolveCharacterSheetActionMode(javelinAction, "melee");
const javelinThrown = resolveCharacterSheetActionMode(javelinAction, "thrown");
expectEqual(javelinMelee.mode, "melee", "Javelin pill resolves its melee mode");
expect(javelinMelee.detail.includes("Reach 10 ft."), "Long-Limbed applies to Varges's melee Javelin action");
expectEqual(javelinThrown.mode, "thrown", "Javelin pill resolves its thrown mode");
expect(javelinThrown.detail.includes("Thrown 30/120 ft."), "Varges Javelin thrown range");

const deterministicDamageSamples = [0, 0.5];
const deterministicDamage = rollCharacterSheetDamage("2d6+3", () => deterministicDamageSamples.shift());
expectEqual(deterministicDamage?.rolls.join(","), "1,4", "damage roller records every die result");
expectEqual(deterministicDamage?.total, 8, "damage roller adds the flat modifier to the same-click roll");
expectEqual(rollCharacterSheetDamage("not dice"), null, "damage roller rejects unsupported formulas");

const ragingActions = buildCharacterSheetActions({
  sheet: {
    meta: { classKey: "barbarian" },
    speciesTraits: ["Long-Limbed"],
    rages: 3,
    rageDamageBonus: 2,
    actionState: { rage: { active: true, usesRemaining: 2, usesMax: 3 } },
  },
  inventoryRows: vargesInventory,
  featureRows: [{ category: "Class", name: "Rage" }],
  abilityModifiers: { str: 5, dex: 2, con: 3, int: -1, wis: 1, cha: 0 },
  proficiencyBonus: 3,
});
expectEqual(ragingActions.find((action) => action.label === "Greataxe")?.damage, "1d12+7 slashing", "active Rage updates Strength weapon damage");
expectEqual(resolveCharacterSheetActionMode(ragingActions.find((action) => action.label === "Javelin"), "thrown")?.damage, "1d6+7 piercing", "active Rage updates Strength-based thrown damage");

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
expectEqual(eldritchBlast?.damageFormula, "1d10", "spell attacks expose their simultaneous damage formula");
expectEqual(eldritchBlast?.damageType, "force", "spell attacks expose their damage type");
expectEqual(witchBolt?.group, "Prepared Spells", "prepared spell action grouping");
expectEqual(witchBolt?.attackBonus, 7, "prepared spell attack bonus");
expect(witchBolt?.detail.includes("2 level-3 pact slots"), "prepared pact spell shows slot availability");
expect(!lesoActions.some((action) => action.label === "Unprepared Spell"), "unprepared leveled spells stay off the quick-action list");

const knownOptions = mergeKnownCharacterOptions({
  catalog: [
    { id: "savage", option_type: "feat", name: "Savage Attacker", source: "XPHB" },
    { id: "tough", option_type: "feat", name: "Tough", source: "XPHB" },
    { id: "gwm", option_type: "feat", name: "Great Weapon Master", source: "XPHB" },
  ],
  sheetFeats: ["Savage Attacker", "Tough", "Great Weapon Master"],
  grants: [
    { id: "grant-savage", optionId: "savage", optionType: "feat", name: "Savage Attacker", notes: "Soldier Origin feat." },
    { id: "grant-tough", optionId: "tough", optionType: "feat", name: "Tough", notes: "Campaign bonus feat." },
    { id: "grant-gwm", optionId: "gwm", optionType: "feat", name: "Great Weapon Master", notes: "Level 4 feat." },
  ],
});
expectEqual(knownOptions.length, 3, "sheet feats and matching grant records render once each");
expect(knownOptions.every((option) => option.sheetBacked && !option.removable), "sheet-backed duplicate grants cannot be partially removed");

const vargesFeatures = buildCharacterSheetFeatures({
  sheet: {
    level: 5,
    classKey: "barbarian",
    classSource: "XPHB",
    species: "Bugbear",
    speciesTraits: ["Long-Limbed", "Powerful Build"],
    feats: ["Savage Attacker", "Tough", "Great Weapon Master"],
  },
  grantedOptions: [
    { id: "grant-savage", optionType: "feat", name: "Savage Attacker", description: "Feat description" },
    { id: "grant-tough", optionType: "feat", name: "Tough", description: "Feat description" },
    { id: "grant-gwm", optionType: "feat", name: "Great Weapon Master", description: "Feat description" },
  ],
  progression: { class_level: 5, subclass_name: "World Tree", subclass_source: "XPHB" },
  classRow: { class_key: "barbarian", class_name: "Barbarian", source: "XPHB" },
  classFeatureRows: [
    { id: "rage", feature_type: "class", class_source: "XPHB", source: "XPHB", level: 1, name: "Rage", description: "Rage description" },
    { id: "extra", feature_type: "class", class_source: "XPHB", source: "XPHB", level: 5, name: "Extra Attack", description: "Extra Attack description" },
    { id: "world-intro", feature_type: "subclass", class_source: "XPHB", source: "XPHB", subclass_name: "World Tree", subclass_short_name: "World Tree", level: 3, name: "Path of the World Tree", description: "Subclass introduction", raw_payload: { header: null } },
    { id: "vitality", feature_type: "subclass", class_source: "XPHB", source: "XPHB", subclass_name: "World Tree", subclass_short_name: "World Tree", level: 3, name: "Vitality of the Tree", description: "Vitality description", raw_payload: { header: 1 } },
    { id: "branches", feature_type: "subclass", class_source: "XPHB", source: "XPHB", subclass_name: "World Tree", subclass_short_name: "World Tree", level: 6, name: "Branches of the Tree", description: "Branches description", raw_payload: { header: 2 } },
  ],
  speciesOption: {
    name: "Bugbear",
    source: "MPMM",
    metadata: { traits: [
      { name: "Long-Limbed", entries: ["Your melee reach is 5 feet greater on your turn."] },
      { name: "Powerful Build", entries: ["You count as one size larger for carrying capacity."] },
    ] },
  },
});
expectEqual(vargesFeatures.filter((row) => row.category === "Feat").length, 3, "Feats & Traits receives unique Feats & Boons grants");
expect(vargesFeatures.some((row) => row.category === "Species" && row.name === "Long-Limbed"), "Feats & Traits receives species features");
expect(vargesFeatures.some((row) => row.category === "Class" && row.name === "Rage"), "Feats & Traits receives acquired base-class features");
expect(vargesFeatures.some((row) => row.category === "Subclass" && row.name === "Vitality of the Tree"), "Feats & Traits receives acquired subclass features");
expect(!vargesFeatures.some((row) => row.name === "Branches of the Tree"), "future subclass features stay off the current sheet");
expect(!vargesFeatures.some((row) => row.name === "Path of the World Tree"), "subclass introduction rows stay out of Feats & Traits");

const npcPanelSource = fs.readFileSync(path.join(root, "components/NpcPanel.js"), "utf8");
const rollResultSource = fs.readFileSync(path.join(root, "components/CharacterSheetRollResult.js"), "utf8");
const sheetSource = fs.readFileSync(path.join(root, "components/CharacterSheet5e.js"), "utf8");
const enhancementSource = fs.readFileSync(path.join(root, "components/CharacterSheetEnhancements.js"), "utf8");
const enhancementStyles = fs.readFileSync(path.join(root, "styles/character-sheet-enhancements.css"), "utf8");
const actionStyles = fs.readFileSync(path.join(root, "styles/character-sheet-actions.css"), "utf8");
const globalStyles = fs.readFileSync(path.join(root, "styles/globals.scss"), "utf8");
const profilePageSource = fs.readFileSync(path.join(root, "pages/profile.js"), "utf8");
const migrationSource = fs.readFileSync(path.join(root, "sql/20260802_01_player_character_inventory_and_sheet_actions.sql"), "utf8");
const featureActionMigrationSource = fs.readFileSync(path.join(root, "sql/20260802_02_character_sheet_feature_actions.sql"), "utf8");

for (const token of [
  'supabase.rpc("get_character_inventory_v1"',
  'supabase.rpc("set_character_inventory_equipment_v1"',
  'from("character_spells")',
  'from("spells_catalog")',
  "formatInventoryEquipmentText(inventoryRows)",
  "inventoryItems={inventoryRows}",
  "spellActions={spellActions}",
  "featureRows={sheetFeatures}",
  'supabase.rpc("update_character_sheet_action_state_v1"',
]) expect(npcPanelSource.includes(token), `NPC/player panel missing ${JSON.stringify(token)}`);

for (const token of [
  "buildCharacterSheetActions({",
  "resolveClassUnarmoredDefense(s, abilityMods)",
  "groupedSheetActions.map",
  "resolveSheetAction(action)",
  "resolveCharacterSheetActionMode(action, selectedMode)",
  "rollCharacterSheetDamage(action.damageFormula)",
  "cycleActionMode(action)",
  "csheet-action-mode-pill",
  "csheet-action-details-button",
  "onActionCommand(action, \"reset\")",
]) expect(sheetSource.includes(token), `character sheet action surface missing ${JSON.stringify(token)}`);
expect(!sheetSource.includes("Combat notes"), "legacy Combat notes must be removed from the quick-action surface");
expect(!sheetSource.includes('<div className="csheet-section-title">Equipment</div>'), "legacy Equipment section must stay off Sheet & Rolls");
expect(!sheetSource.includes('className="csheet-hint"'), "legacy calculation instructions must stay off the bottom of Sheet & Rolls");
expect(sheetSource.includes('<CollapsibleSheetSection title="Feats & Traits" className="csheet-section--traits">'), "Feats & Traits must move into the former Equipment position");
expect(sheetSource.includes('className="csheet-traits-scroll"'), "Feats & Traits must retain its feature-list target while growing with the page");
expect(sheetSource.includes('className="csheet-left-workspace"'), "abilities, checks, and the wide Description section must share the left workspace");
expect(sheetSource.includes('className="csheet-section--description"'), "Description must span and fill the left workspace beneath abilities and skills");
expect(sheetSource.indexOf('className="csheet-description-slot"') > sheetSource.indexOf('<CollapsibleSheetSection title="Skills">'), "description slot must follow Skills");

for (const title of [
  "Saving Throws",
  "Skills",
  "Description",
  "Combat",
  "Attacks & Spellcasting",
  "Feats & Traits",
]) expect(sheetSource.includes(`<CollapsibleSheetSection title="${title}"`), `${title} must be independently collapsible`);

for (const token of [
  "function CollapsibleSheetSection(",
  "const [expanded, setExpanded] = useState(true)",
  'aria-expanded={expanded}',
  'className="csheet-section-body" hidden={!expanded}',
]) expect(sheetSource.includes(token), `sheet collapsible-section contract missing ${JSON.stringify(token)}`);

for (const token of [
  'root.querySelector(".csheet-description-slot")',
  'traitSection?.querySelector(".csheet-traits-scroll")',
  "descriptionTarget ? createPortal(",
]) expect(enhancementSource.includes(token), `sheet description/trait portal missing ${JSON.stringify(token)}`);

for (const token of [
  ".csheet-traits-scroll",
  "max-height: none",
  "overflow: visible",
  ".csheet-description-slot .csheet-pinned-description",
  ".csheet-section--description",
  "grid-column: 1 / -1",
  ".csheet-section-toggle",
  '.csheet-section-toggle[aria-expanded="false"]',
  ".csheet-section-body[hidden]",
]) expect(enhancementStyles.includes(token), `sheet layout styles missing ${JSON.stringify(token)}`);
expect(!enhancementStyles.includes("max-height: 16rem"), "Feats & Traits must no longer use the old fixed-height scroller");

for (const token of [
  ".csheet-action-mode-pill.is-melee",
  ".csheet-action-mode-pill.is-thrown",
  ".sheet-last-roll.has-damage",
  "grid-template-columns: minmax(0, 1fr) auto",
]) expect(actionStyles.includes(token), `sheet action styles missing ${JSON.stringify(token)}`);

for (const token of [
  ".csheet-left-workspace",
  "grid-template-columns: minmax(390px, 42%) minmax(0, 1fr)",
  "grid-template-rows: max-content minmax(12rem, 1fr)",
]) expect(globalStyles.includes(token), `sheet workspace styles missing ${JSON.stringify(token)}`);

expect(npcPanelSource.includes('<CharacterSheetRollResult roll={lastRoll}'), "NPC/player panel must use the shared roll-result component");
for (const token of [
  "sheet-last-roll__attack",
  "sheet-last-roll__damage",
  "formatCharacterSheetDamage",
]) expect(rollResultSource.includes(token), `shared combined attack/damage roll banner missing ${JSON.stringify(token)}`);

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

for (const token of [
  "update_character_sheet_action_state_v1",
  "private.can_manage_character_progression_v1(p_character_id)",
  "v_operation not in ('activate','deactivate','reset')",
  "Rage is only available to a Barbarian sheet",
  "revoke all on function public.update_character_sheet_action_state_v1(uuid,text,text) from public, anon",
  "grant execute on function public.update_character_sheet_action_state_v1(uuid,text,text) to authenticated, service_role",
  "Encounter state must use encounter RPCs",
]) expect(featureActionMigrationSource.includes(token), `feature-action migration missing ${JSON.stringify(token)}`);

if (failures.length) {
  console.error("Player sheet action validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Player sheet action validation passed.");
