import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read("pages/_app.js");
const css = read("styles/character-forge-class-final-browser-fix.css");
const catalog = read("components/NpcForgeClassCatalog.js");
const guide = read("components/NpcForgeClassGuide.js");
const dock = read("components/NpcForgeClassFeatureDock.js");

assert(app.includes('import "../styles/character-forge-class-final-browser-fix.css"'), "Final Class browser fix stylesheet is not loaded.");

for (const token of [
  "overflow: hidden !important",
  "grid-template-rows: auto minmax(0, 1fr)",
  "max-height: none !important",
  ".npc-forge-class-catalog-row[data-class-key] .npc-forge-class-catalog-portrait",
  "background-image: none !important",
  "opacity: 1 !important",
  "height: 166px !important",
  "grid-template-columns: minmax(0, 1fr) 286px",
  "grid-template-columns: 42px 43px minmax(165px, 1.95fr) 55px 74px minmax(92px, .95fr)",
  "body:not(:has(.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2))",
  ".npc-forge-class-feature-dock.is-viewport-floating.is-placeholder",
  "width: min(308px, calc(100vw - 24px))",
]) assert(css.includes(token), `Final Class browser fix is missing ${token}`);

for (const token of [
  "NpcForgeClassCatalog",
  "selectedId={draft.classOptionId}",
  "onSelect={chooseClass}",
]) assert(read("components/NpcForgeStepContent.js").includes(token), `Class selection behavior regressed: ${token}`);

for (const token of ["ForgeSubclassSelection", "ProgressionTable", "Class Overview", "Detailed Guide"]) {
  assert(guide.includes(token), `Class guide behavior regressed: ${token}`);
}

for (const token of ["handleDragStart", "handleDragMove", "handleDragEnd", "setClosedDetailKey(currentDetailKey)"]) {
  assert(dock.includes(token), `Feature inspector behavior regressed: ${token}`);
}

assert(catalog.includes("classArtworkFor(classKey)"), "Class catalogue must continue using dedicated class artwork.");

const protectedSource = `${css}\n${catalog}\n${guide}\n${dock}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "mappageclient", "townsheet", "encounter_weapon_attack", "crafting_recipe"]) {
  assert(!protectedSource.includes(token), `Class browser correction crossed protected boundary: ${token}`);
}

console.log("Final Class browser correction validated: full-height catalogue, real class portraits, contained progression, contextual inspector lifecycle, and preserved Class mechanics.");
