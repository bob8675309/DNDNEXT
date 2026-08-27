import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const step = read("components/NpcForgeStepContent.js");
const catalog = read("components/NpcForgeClassCatalog.js");
const guide = read("components/NpcForgeClassGuide.js");
const dock = read("components/NpcForgeClassFeatureDock.js");
const artwork = read("utils/classes/classArtwork.js");
const presentation = read("utils/classes/classPresentation.js");
const catalogWrapper = read("utils/npcForgeCatalog.js");
const polish = read("styles/character-forge-browser-review-polish.css");

assert(step.includes('import NpcForgeClassCatalog from "./NpcForgeClassCatalog"'), "Class step must use the dedicated Class catalogue.");
assert(step.includes("<NpcForgeClassCatalog query={classQuery}"), "Class step does not render the dedicated Class catalogue.");
assert(!step.includes('<CatalogList label="Classes"'), "Legacy flat Class CatalogList is still rendered in parallel.");

for (const token of [
  "isSidekickClass",
  "const sidekicks = rows.filter(isSidekickClass)",
  "const regular = rows.filter((row) => !isSidekickClass(row))",
  'aria-label="Sidekick classes"',
  "setSidekicksOpen",
  "NpcForgeClassCatalog",
  "ClassChoiceRow",
]) assert(catalog.includes(token), `Sidekick Class catalogue grouping is missing ${token}`);
assert(catalog.includes("onClick={() => setSidekicksOpen"), "Sidekick parent must expand/collapse rather than select a synthetic class.");
assert(catalog.includes("onSelect?.(row)"), "Real Sidekick child rows must keep the existing class-selection callback.");

for (const [key, image] of Object.entries({
  civilian: "adventurer",
  "monster-hunter": "ranger",
  mystic: "sorcerer",
  "expert-sidekick": "rogue",
  "warrior-sidekick": "fighter",
  "spellcaster-sidekick": "wizard",
})) assert(artwork.includes(`\"${key}\": \"${image}\"`) || artwork.includes(`${key}: \"${image}\"`), `Class artwork mapping missing ${key} → ${image}`);

for (const token of [
  '"monster-hunter"',
  "Monster Grimoire",
  "Studied Response",
  "Carver, Devourer, Occultist, or Trapper Guild",
  "mystic:",
  "psi points",
  "Avatar, Awakened, Immortal, Nomad, Soul Knife, or Wu Jen",
  '"expert-sidekick"',
  '"warrior-sidekick"',
  '"spellcaster-sidekick"',
  'if (keyFor(classRow) === "mystic") return ["int"]',
  'if (key === "mystic") return "Psionics • Intelligence"',
]) assert(presentation.includes(token), `Special Class presentation is missing ${token}`);

for (const token of [
  "mergePreferredClasses as refinedMergePreferredClasses",
  "classPresentationSummary",
  "classPrimaryAbilities",
  "export function mergePreferredClasses",
  "refinedMergePreferredClasses(rows).map(presentClass)",
  "primary_abilities: primaryAbilities.length ? primaryAbilities",
]) assert(catalogWrapper.includes(token), `Forge class normalization is missing ${token}`);

for (const token of [
  "classMagicPresentation",
  "classPresentationSummary",
  "classPrimaryAbilities",
  '"Primary Ability"',
  '"Power System"',
]) assert(guide.includes(token), `Class guide presentation is missing ${token}`);
assert(dock.includes("classPresentationSummary(selectedClass)"), "Bottom Class feature dock must use the richer selected-Class overview copy.");

for (const token of [
  "grid-template-rows: auto auto minmax(240px, 1fr) auto",
  ".npc-forge-class-catalog-list",
  ".npc-forge-class-feature-dock",
  "position: static !important",
  "align-self: end !important",
]) assert(polish.includes(token), `Full-height Class workspace layout is missing ${token}`);

const protectedSources = `${step}\n${catalog}\n${guide}\n${dock}\n${artwork}\n${presentation}\n${catalogWrapper}\n${polish}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "mappageclient", "townsheet", "world travel"]) {
  assert(!protectedSources.includes(token), `Class browser patch unexpectedly references protected map/town behavior: ${token}`);
}

console.log("Class browser polish validation passed: full-height left rail, bottom feature dock, nested Sidekick catalogue, distinct special-Class art, Mystic Intelligence normalization, and source-grounded Mystic/Monster Hunter presentation are intact.");
