import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const requireToken = (text, token, label) => { if (!text.includes(token)) throw new Error(`Character Forge spell sources: ${label} is missing ${token}`); };

const spellStep = read("components/NpcForgeSpellStep.js");
const spellSources = read("utils/playerForgeSpellSources.js");
const spellCard = read("components/SpellCard.js");
const spellCardCss = read("styles/spell-card.css");
const playerFacingText = read("utils/playerFacingText.js");

for (const token of [
  "subclassStartingSpellSelectionModel",
  "spellAllowedForStartingModel",
  "startingSpellSourceForRow",
  "selectedSubclass = null",
  "expandedSpellNames = []",
  "Background-expanded access",
]) requireToken(spellStep, token, "spell-selection UI");

for (const token of [
  "selectionLimitFor",
  "canAddSpell",
  "selectionLimitMessage",
  "npc-forge-spell-table-head",
  'function spellStatus(spell, selections = {}, mode = "")',
  'mode !== "known"',
  "spellStatus(spell, selections, model.mode)",
  "grid-template-columns:minmax(0,1fr) 58px 74px",
  "button:nth-child(3)",
  "overflow-x:hidden",
  "sortKey",
  "sortDirection",
  "scaling_text,scaling_json,raw_payload",
  "compressed",
]) requireToken(spellStep, token, "bounded sortable spell browser");

for (const token of [
  'import SourceRuleContent from "./SourceRuleContent";',
  "spell-card__progression",
  "Spell Progression",
  "scalingProfile",
  "raw_payload?.entries",
  "entriesHigherLevel",
]) requireToken(spellCard, token, "structured player-facing spell card");

for (const token of [
  ".spell-card__body",
  ".spell-card--compressed",
  ".spell-card__progression",
  "scrollbar-gutter: stable",
]) requireToken(spellCardCss, token, "single-scroll compact spell presentation");

for (const token of [
  "ITEM_PROPERTY_LABELS",
  'L: "Light"',
  'F: "Finesse"',
  'R: "Reach"',
  "itemPropertyLabel",
]) requireToken(playerFacingText, token, "player-facing imported property expansion");

if (spellStep.includes("groupByLevel") || spellStep.includes("npc-forge-spell-catalogue-level")) {
  throw new Error("Character Forge spell sources: Forge Spells regressed to stacked level-group cards instead of the compact sortable table.");
}

if ((spellStep.match(/spellStatus\(spell, selections, model\.mode\)/g) || []).length < 2) {
  throw new Error("Character Forge spell sources: known/prepared status authority must be shared by both row rendering and Status sorting.");
}

if (!spellStep.includes("button:nth-child(3)") || !spellStep.includes("span:nth-child(3)") || !spellStep.includes("overflow-x:hidden")) {
  throw new Error("Character Forge spell sources: narrow-phone spell rows must hide School/Source and prevent independent horizontal row scrolling.");
}

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
