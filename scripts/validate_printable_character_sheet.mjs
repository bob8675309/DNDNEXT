import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const {
  buildPrintableCharacterSheetModel,
  formatPrintableModifier,
} = await import(pathToFileURL(path.join(root, "utils/printableCharacterSheet.js")).href);

const model = buildPrintableCharacterSheetModel({
  sheet: {
    className: "Fighter",
    level: 5,
    species: "Human",
    background: "Soldier",
    alignment: "Neutral Good",
    proficiencyBonus: 3,
    abilities: {
      str: { score: 16 },
      dex: { score: 14 },
      con: { score: 14 },
      int: { score: 10 },
      wis: { score: 12 },
      cha: { score: 8 },
    },
    proficiencies: {
      saves: { str: { proficient: true }, con: { proficient: true } },
      skills: {
        perception: { proficient: true },
        stealth: { proficient: true, expertise: true },
      },
    },
    hp: 35,
    maxHp: 40,
    tempHp: 4,
    speed: 30,
    hitDice: "5d10",
    languages: ["Common", "Dwarvish"],
    tools: ["Smith's Tools"],
    personality: { traits: "Always checks the exits.", ideals: "Duty", bonds: "Old squad", flaws: "Stubborn" },
  },
  profile: {
    name: "Print Test",
    role: "Guard Captain",
    affiliation: "North Watch",
    description: "A veteran officer.",
    motivation: "Protect the city.",
    secret: "Knows the hidden gate.",
    tags: ["guard", "veteran"],
  },
  itemBonuses: {
    ac: 1,
    initiative: 1,
    savesAll: 0,
    saves: {},
    skillsAll: 0,
    skills: { perception: 1 },
    abilities: {},
    abilityMods: {},
    advantage: { savesAll: false, saves: {}, skillsAll: false, skills: {} },
    disadvantage: { savesAll: false, saves: {}, skillsAll: false, skills: {} },
    equipment: {
      armor: { name: "Scale Mail", category: "medium", baseAc: 14 },
      shield: { name: "Shield", bonusAc: 2 },
    },
  },
  inventoryItems: [{
    id: "item-1",
    quantity: 1,
    is_equipped: true,
    equip_slot: "main_hand",
    card_payload: {
      name: "Longsword",
      uiType: "Weapon",
      item_description: "A dependable martial weapon.",
      weapon: true,
      damage: "1d8",
    },
  }],
  spellActions: [{
    id: "spell-row-1",
    prepared: true,
    spell: {
      id: "spell-1",
      name: "Light",
      level: 0,
      casting_time: "1 action",
      range_text: "Touch",
      duration_text: "1 hour",
      description: "Creates bright light.",
    },
  }],
  featureRows: [{
    id: "feature-1",
    category: "Class",
    name: "Second Wind",
    level: 1,
    description: "Recover hit points as a Bonus Action.",
    source: "XPHB",
  }],
  notes: [{ id: "note-1", scope: "private", body: "Meet the patrol at dusk.", created_at: "2026-10-19" }],
  locationLabel: "North Gate",
  equipmentBreakdown: ["Scale Mail: base AC 14", "Shield: +2 AC"],
});

assert.equal(model.profile.name, "Print Test");
assert.equal(model.profile.location, "North Gate");
assert.equal(model.profile.secret, "Knows the hidden gate.");
assert.equal(model.armorClass, 19, "print model must reuse canonical armor math");
assert.equal(model.initiative, 3, "print model must reuse canonical initiative math");
assert.equal(model.passivePerception, 15, "print model must reuse canonical passive perception math");
assert.equal(model.abilities.find((row) => row.key === "str")?.saveModifier, 6);
assert.equal(model.skills.find((row) => row.key === "stealth")?.modifier, 8);
assert.equal(model.inventory[0]?.name, "Longsword");
assert.equal(model.inventory[0]?.equipped, true);
assert.equal(model.spells[0]?.name, "Light");
assert.equal(model.features[0]?.name, "Second Wind");
assert.equal(model.notes[0]?.body, "Meet the patrol at dusk.");
assert.deepEqual(model.languages, ["Common", "Dwarvish"]);
assert.equal(formatPrintableModifier(-2), "-2");
assert.equal(formatPrintableModifier(3), "+3");

const component = read("components/PrintableCharacterSheet.js");
const panel = read("components/CharacterSheetPanel.js");
const page = read("pages/npcs.js");
const styles = read("styles/PrintableCharacterSheet.module.css");
const runner = read("scripts/vercel_build_v2.mjs");
const pkg = read("package.json");

for (const token of [
  "buildPrintableCharacterSheetModel",
  "createPortal",
  "window.print()",
  "printing-character-sheet",
  "Features & Traits",
  "Inventory & Equipment",
  "Character Details",
  "Notes",
]) assert(component.includes(token), `printable component missing ${token}`);

for (const token of [
  'import PrintableCharacterSheet from "./PrintableCharacterSheet";',
  "Print Sheet",
  "printProfile = null",
  "printNotes = null",
  "disabled={!!actionsLoading}",
  "<PrintableCharacterSheet",
]) assert(panel.includes(token), `CharacterSheetPanel print handoff missing ${token}`);

for (const token of [
  "const printableProfile = {",
  "printProfile={printableProfile}",
  "printNotes={notes}",
  "portraitUrl: selectedPortrait?.url ||",
  "secret: safeStr(details?.secret || selected?.secret)",
]) assert(page.includes(token), `NPC page printable data handoff missing ${token}`);

for (const token of [
  "@media print",
  "@page",
  "size: letter portrait",
  "body.printing-character-sheet",
  "#__next",
  "break-before: page",
]) assert(styles.includes(token), `print stylesheet missing ${token}`);

assert(!component.includes("supabase"), "print component must not start its own Supabase reads");
assert(!read("utils/printableCharacterSheet.js").includes("supabase"), "print model must remain presentation-only");
for (const forbidden of ["MapPageClient", "map_routes", "map_route_points", "advance_all_characters", "route_segment_progress"]) {
  assert(!component.includes(forbidden), `print component crossed protected map boundary: ${forbidden}`);
  assert(!read("utils/printableCharacterSheet.js").includes(forbidden), `print model crossed protected map boundary: ${forbidden}`);
}
assert(runner.includes("validate_printable_character_sheet.mjs"), "production build runner must validate printable NPC sheets");
assert(pkg.includes('"check:printable-character-sheet": "node scripts/validate_printable_character_sheet.mjs"'), "package script for printable sheet validator is missing");

console.log("Printable NPC character sheet validated: canonical combat math, authorized page-owned data handoff, full features/spells/inventory/narrative/notes print surface, Letter print CSS, and protected boundaries all pass.");
