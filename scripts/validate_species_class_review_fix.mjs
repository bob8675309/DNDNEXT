import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read("pages/_app.js");
const css = read("styles/character-forge-species-class-review-fix.css");
const cinematic = read("styles/character-forge-cinematic-reference-pass.css");
const finalCorrections = read("styles/character-forge-cinematic-final-corrections.css");
const guide = read("components/NpcForgeClassGuide.js");
const classCatalog = read("components/NpcForgeClassCatalog.js");
const classEmpty = read("components/NpcForgeClassEmptyState.js");
const classArtwork = read("utils/classes/classArtwork.js");
const speciesArtwork = read("utils/speciesArtwork.js");
const forgeModal = read("components/NewNpcModalV3Refined.js");

assert(app.includes('import "../styles/character-forge-species-class-review-fix.css"'), "Species/Class browser review stylesheet is not loaded.");
assert(app.includes('import "../styles/character-forge-cinematic-reference-pass.css"'), "Cinematic Species/Class reference presentation is not loaded.");
assert(app.includes('import "../styles/character-forge-cinematic-final-corrections.css"'), "Final cinematic Species/Class correction layer is not loaded.");
assert(app.indexOf('character-forge-cinematic-reference-pass.css') > app.indexOf('character-forge-species-class-review-fix.css'), "Cinematic reference presentation must load after the browser-review correction layer.");
assert(app.indexOf('character-forge-cinematic-final-corrections.css') > app.indexOf('character-forge-cinematic-reference-pass.css'), "Final cinematic corrections must load after the cinematic reference layer.");

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

for (const token of [
  "height: clamp(560px,calc(100dvh - 238px),720px) !important",
  "inset: 0 0 0 48% !important",
  "linear-gradient(90deg,rgba(5,8,16,.04)",
  ".npc-forge-class-empty__art",
  ".npc-forge-class-empty__lower",
  "height: 300px !important",
  "linear-gradient(90deg,rgba(6,9,17,.995)",
  "repeat(auto-fit,minmax(132px,1fr))",
  "grid-template-columns:55px minmax(0,1fr) auto",
]) assert(cinematic.includes(token), `Cinematic reference presentation is missing ${token}`);

for (const token of [
  "object-position: center 24% !important",
  "> .npc-forge-workspace > .npc-forge-section.npc-forge-class-selection",
  "grid-template-rows: minmax(0, 1fr) !important",
  "> .npc-forge-class-catalog > .npc-forge-class-catalog-list",
  "height: 100% !important",
  "max-height: none !important",
  "overflow-y: auto !important",
  "overscroll-behavior: contain !important",
  "scrollbar-gutter: stable !important",
]) assert(finalCorrections.includes(token), `Final cinematic correction is missing ${token}`);
assert(!finalCorrections.includes("grid-template-rows: auto minmax(0, 1fr) 0 !important"), "Class catalogue regression: the first in-flow Class row must not be auto-sized.");

assert(guide.includes("model.options.map((option) => <SubclassButton"), "Every subclass must render directly in the visible subclass grid.");
assert(!guide.includes("model.options.slice(0, 4)"), "Subclass grid must not collapse after four entries.");
assert(!guide.includes("npc-forge-class-guide__subclass-more"), "The Class overview must not hide subclasses behind a More disclosure.");
assert(guide.includes("ForgeSubclassSelection"), "Subclass selection behavior was removed.");
assert(guide.includes("model.selectSubclass(model.preview)"), "Subclass confirmation behavior was removed.");
assert(guide.includes("ProgressionTable"), "Class progression table was removed.");
assert(guide.includes("Class Overview") && guide.includes("Detailed Guide"), "Class guide view controls regressed.");
assert(guide.includes("classHeroArtworkFor(selectedClass.class_key)"), "Selected Class hero must use the cinematic hero-art authority.");
assert(classCatalog.includes("classMenuArtworkFor(classKey)"), "Class catalogue must use the dedicated menu-art authority.");
assert(classEmpty.includes("classEmptyStateArtwork"), "Class empty state must use the generated arcane-room artwork.");
for (const token of ["artificerHero", "barbarianHero", "artificerMenu", "barbarianMenu", "CINEMATIC_CLASS_HERO_ARTWORK", "CINEMATIC_CLASS_MENU_ARTWORK"]) assert(classArtwork.includes(token), `Class cinematic artwork authority is missing ${token}`);
assert(classArtwork.includes('from "../forgeGeneratedArt/artificerHero.js"') && classArtwork.includes('from "../forgeGeneratedArt/barbarianHero.js"'), "Generated Class artwork imports must be Node ESM-resolvable.");

const cinematicSpeciesAssets = {
  aarakocra: "/media/species/cinematic-aarakocra.webp",
  elf: "/media/species/cinematic-elf.webp",
  "half-orc": "/media/species/cinematic-half-orc.webp",
  halfling: "/media/species/cinematic-halfling.webp",
};
for (const [key, publicPath] of Object.entries(cinematicSpeciesAssets)) {
  assert(speciesArtwork.includes(`${JSON.stringify(key)}: ${JSON.stringify(publicPath)}`) || speciesArtwork.includes(`${key}: ${JSON.stringify(publicPath)}`), `Cinematic Species artwork authority is missing ${key} → ${publicPath}.`);
  const diskPath = `public${publicPath}`;
  assert(fs.existsSync(diskPath), `Cinematic Species asset is missing ${diskPath}.`);
  const asset = fs.readFileSync(diskPath);
  assert(asset.length > 4000, `Cinematic Species asset is unexpectedly tiny: ${diskPath}.`);
  assert(asset.subarray(0, 4).toString("ascii") === "RIFF", `Cinematic Species asset is not a RIFF container: ${diskPath}.`);
  assert(asset.subarray(8, 12).toString("ascii") === "WEBP", `Cinematic Species asset is not a WebP image: ${diskPath}.`);
}
assert(!speciesArtwork.includes("aarakocraHero"), "Aarakocra must use the sharp public WebP rather than the old embedded generated module.");

for (const token of [
  "handleHeaderDoubleClick",
  "onDoubleClick={handleHeaderDoubleClick}",
  "restoreForgeGeometry",
  "requestForgeWindowReset",
  'title="Double-click or double-tap this header to restore the Forge window"',
]) assert(forgeModal.includes(token), `Character Forge double-click restore contract is missing ${token}`);

const protectedSource = `${css}\n${cinematic}\n${finalCorrections}\n${guide}\n${classCatalog}\n${classEmpty}\n${classArtwork}\n${speciesArtwork}\n${forgeModal}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "mappageclient", "townsheet", "encounter_weapon_attack", "crafting_recipe"]) assert(!protectedSource.includes(token), `Browser review fix crossed protected boundary: ${token}`);

console.log("Species/Class cinematic reference pass validated: structurally valid cinematic Aarakocra/Elf/Half-orc/Halfling WebP artwork, head-safe Species framing, full-height Class catalogue, Forge double-click geometry recovery, generated Class idle artwork, blended selected-Class paintings, purpose-specific Class menu portraits, visible subclasses, preserved progression and protected boundaries.");
