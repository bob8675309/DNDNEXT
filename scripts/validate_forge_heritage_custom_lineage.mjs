import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const speciesChoices = read("utils/playerForgeSpeciesChoices.js");
const runtimeChoices = read("utils/playerForgeSpeciesRuntimeChoices.js");
const presentation = read("utils/speciesForgePresentation.js");
const embedded = read("components/NpcForgeEmbeddedSourceChoices.js");
const picker = read("components/NpcForgeHeritageTraitPicker.js");
const subchoices = read("utils/playerForgeHeritageSubchoices.js");

assert(speciesChoices.includes('Array.from({ length: 8 }'), "Custom Lineage must expose exactly eight Heritage Trait pick fields.");
assert(speciesChoices.includes('heritageTraitGroup: true'), "Heritage Trait group marker is missing.");
assert(!speciesChoices.includes('CUSTOM_LINEAGE_STANDARD'), "Legacy Standard Custom Lineage mode must not remain selectable.");
assert(speciesChoices.includes('if (!isCustomLineage(species)) groups.push(...speciesLanguageGroups(species));'), "Legacy Tasha Custom Lineage language choice must stay suppressed.");
assert(speciesChoices.includes('["feat", "variable trait"].includes(key)'), "Legacy Tasha Feat/Variable Trait suppression is missing.");

assert(runtimeChoices.includes('label: "Seasonal Fey Step"'), "Eladrin runtime group must be named Seasonal Fey Step.");
assert(runtimeChoices.includes('label: "Starting season"'), "Eladrin must require a starting season.");
assert(runtimeChoices.includes('replacementCadence: "long-rest"'), "Eladrin season must remain replaceable after a Long Rest.");
assert(presentation.includes('name: "Seasonal Fey Step"'), "Eladrin presentation must use Seasonal Fey Step.");
assert(!presentation.includes('name: "Eladrin Seasons"'), "Redundant Eladrin Seasons presentation must be removed.");

assert(embedded.includes("NpcForgeHeritageTraitPicker"), "Heritage Trait picker is not wired into the canonical embedded source-choice renderer.");
assert(picker.includes('const CATEGORY_ORDER = ["C", "E", "R"]'), "Heritage Trait categories are not organized as Combat/Exploration/Roleplaying.");
assert(picker.includes("formatPlayerFacingText"), "Heritage Trait player-facing text sanitizer is not wired.");
assert(picker.includes("buildHeritageTraitSubchoiceGroups"), "Heritage acquisition subchoices are not registered from the Heritage picker.");

for (const trait of [
  "breath weapon",
  "damage resistance",
  "magical fortification",
  "weapon aptitude",
  "environmental awareness",
  "natural camouflage",
  "natural movement",
  "artisanal focus",
  "instrumentalist",
  "masterful aptitude",
  "polyglot",
  "magical savvy",
]) {
  assert(subchoices.includes(`norm(traitName) === "${trait}"`) || subchoices.includes(`["environmental awareness", "natural camouflage", "natural movement"].includes(norm(traitName))`), `Missing Heritage subchoice coverage for ${trait}.`);
}
assert(subchoices.includes("pistol|musket|firearm"), "Campaign firearm exclusion must remain in Heritage Weapon Aptitude choices.");
assert(subchoices.includes("Your first Magical Savvy pick must be a cantrip."), "Magical Savvy first-pick rule is missing.");
assert(subchoices.includes("priorLists.includes(classKey)"), "Magical Savvy level-1 spell-list dependency is missing.");

console.log("Heritage Custom Lineage and Seasonal Fey Step static validation passed.");
