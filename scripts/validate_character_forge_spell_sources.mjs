import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const requireToken = (text, token, label) => { if (!text.includes(token)) throw new Error(`Character Forge spell sources: ${label} is missing ${token}`); };

const spellStep = read("components/NpcForgeSpellStep.js");
const spellSources = read("utils/playerForgeSpellSources.js");

for (const token of [
  "subclassStartingSpellSelectionModel",
  "spellAllowedForStartingModel",
  "startingSpellSourceForRow",
  "selectedSubclass = null",
  "expandedSpellNames = []",
  "Background-expanded access",
]) requireToken(spellStep, token, "spell-selection UI");

for (const token of [
  "THIRD_CASTER_SLOTS",
  "THIRD_CASTER_PREPARED",
  'classKey === "fighter"',
  'subclassName === "eldritch knight"',
  'classKey === "rogue"',
  'subclassName === "arcane trickster"',
  'name: "Mage Hand"',
  'spellListClass: "Wizard"',
  'sourceType: "subclass"',
  "serializeStartingMagicSelections",
]) requireToken(spellSources, token, "subclass spell-source model");

console.log("Character Forge subclass spellcasting and background-expanded spell access contracts validated.");
