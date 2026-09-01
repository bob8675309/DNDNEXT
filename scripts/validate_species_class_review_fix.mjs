import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read("pages/_app.js");
const css = read("styles/character-forge-species-class-review-fix.css");
const guide = read("components/NpcForgeClassGuide.js");

assert(app.includes('import "../styles/character-forge-species-class-review-fix.css"'), "Species/Class browser review stylesheet is not loaded.");

for (const token of [
  ".npc-forge-species-hero .npc-forge-species-artwork",
  "height: 410px !important",
  "max-height: 410px !important",
  "overflow-y: scroll !important",
  "scrollbar-color:",
  ".npc-forge-class-guide__overview-layout",
  "grid-template-columns: minmax(0, 1fr) !important",
  ".npc-forge-class-guide__dock-lane",
  "display: none !important",
  "height: 196px !important",
  ".npc-forge-class-guide__subclass-grid",
  "repeat(auto-fit, minmax(126px, 1fr))",
]) assert(css.includes(token), `Browser review stylesheet is missing ${token}`);

assert(guide.includes("model.options.map((option) => <SubclassButton"), "Every subclass must render directly in the visible subclass grid.");
assert(!guide.includes("model.options.slice(0, 4)"), "Subclass grid must not collapse after four entries.");
assert(!guide.includes("npc-forge-class-guide__subclass-more"), "The Class overview must not hide subclasses behind a More disclosure.");
assert(guide.includes("ForgeSubclassSelection"), "Subclass selection behavior was removed.");
assert(guide.includes("model.selectSubclass(model.preview)"), "Subclass confirmation behavior was removed.");
assert(guide.includes("ProgressionTable"), "Class progression table was removed.");
assert(guide.includes("Class Overview") && guide.includes("Detailed Guide"), "Class guide view controls regressed.");

const protectedSource = `${css}\n${guide}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "mappageclient", "townsheet", "encounter_weapon_attack", "crafting_recipe"]) {
  assert(!protectedSource.includes(token), `Browser review fix crossed protected boundary: ${token}`);
}

console.log("Species/Class browser review fix validated: stable species portrait, visible Class scrollbars, full-width overview, all subclasses visible, and preserved Class mechanics.");
