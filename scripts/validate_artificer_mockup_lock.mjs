import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read("pages/_app.js");
const catalog = read("components/NpcForgeClassCatalog.js");
const css = read("styles/character-forge-artificer-approved.css");
const menuCss = read("styles/character-forge-class-menu-approved-art.css");
const correctionCss = read("styles/character-forge-class-acceptance-corrections.css");
const guide = read("components/NpcForgeClassGuide.js");
const guideModel = read("components/NpcForgeClassGuideModel.js");
const dock = read("components/NpcForgeClassFeatureDock.js");
const heroPath = "public/media/classes/artificer-approved.webp";
const heroBytes = fs.readFileSync(heroPath);

assert(app.includes('import "../styles/character-forge-artificer-approved.css"'), "Approved Artificer presentation stylesheet is not loaded globally.");
assert(app.includes('import "../styles/character-forge-class-menu-approved-art.css"'), "Class acceptance refinement stylesheet is not loaded after the Artificer composition.");
assert(app.includes('import "../styles/character-forge-class-acceptance-corrections.css"'), "Final browser-review Class correction stylesheet is not loaded last.");
assert(catalog.includes('data-class-key={String(row?.class_key || "").trim().toLowerCase()}'), "Class catalogue rows must expose their normalized class key.");
assert(fs.existsSync(heroPath), "Approved Artificer hero asset is missing.");
assert(heroBytes.length > 12000, "Artificer hero asset regressed to the tiny screenshot-derived version.");
assert(heroBytes.subarray(0, 4).toString("ascii") === "RIFF", "Artificer hero asset is not a RIFF WebP file.");
assert(heroBytes.subarray(8, 12).toString("ascii") === "WEBP", "Artificer hero asset is not a valid WebP container.");
assert(heroBytes.readUInt32LE(4) + 8 === heroBytes.length, "Artificer hero WebP payload is truncated.");

for (const token of [
  ".npc-forge-level-row { display: none !important; }",
  "grid-template-columns: minmax(300px, 24fr) minmax(0, 76fr)",
  "grid-template-rows: minmax(0,1fr) 0",
  ".npc-forge-class-guide.is-class-artificer .npc-forge-class-guide__book-hero",
  ".npc-forge-class-guide__hero-art {",
  "position: absolute !important; inset: 0 !important",
]) assert(css.includes(token), `Approved Artificer base composition is missing ${token}`);

for (const token of [
  'background-image: url("/media/classes/artificer.webp")',
  "opacity: 1 !important",
  "grid-template-columns: 50px minmax(0,1fr) 22px",
  "min-height: 64px !important",
  "width: min(330px, calc(100vw - 24px))",
  "min-height: 0 !important",
]) assert(menuCss.includes(token), `Class acceptance refinements are missing ${token}`);

for (const token of [
  "background-image: none !important",
  "opacity: 1 !important",
  "height: 188px !important",
  "grid-template-columns: minmax(0, 1fr) 300px",
  "grid-template-columns: 44px 44px minmax(155px, 1.8fr) 58px 76px minmax(96px, .9fr)",
  "width: min(326px, calc(100vw - 24px))",
  "max-height: min(58dvh",
  "overflow-wrap: anywhere",
]) assert(correctionCss.includes(token), `Final Class browser-review correction is missing ${token}`);

assert(!correctionCss.includes('background-image: url("/media/classes/class-menu-approved.webp")'), "Do not restore the compressed screenshot-derived Class-menu sprite.");
assert(!correctionCss.includes("background-size: 100% 1100%"), "Do not restore sprite-strip scaling for Class portraits.");

for (const token of [
  "ForgeClassHero",
  "ForgeSubclassSelection",
  "ProgressionTable",
  "Class Overview",
  "Detailed Guide",
  "inspectSubclass(model, onFeatureDetail, option)",
  "selectedRowFeatures",
]) assert(guide.includes(token), `Artificer presentation patch must preserve existing Class behavior: ${token}`);

assert(guideModel.includes('select("class_level,proficiency_bonus,cantrips_known,spells_known,spell_slots,features")'), "Class progression must remain sourced from the imported progression fields.");
assert(!guide.includes("Infusions Known") && !guideModel.includes("infusions_known"), "Do not invent an Infusions Known progression column from mockup-only presentation art without source-backed data.");

for (const token of [
  "handleDragStart",
  "handleDragMove",
  "handleDragEnd",
  "setClosedDetailKey(currentDetailKey)",
  "if (dismissed) return null",
]) assert(dock.includes(token), `Class acceptance patch must preserve feature-card behavior: ${token}`);

const protectedSource = `${css}\n${menuCss}\n${correctionCss}\n${catalog}\n${guide}\n${dock}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "mappageclient", "townsheet", "encounter_weapon_attack", "crafting_recipe"]) {
  assert(!protectedSource.includes(token), `Approved Artificer presentation crossed a protected boundary: ${token}`);
}

console.log("Artificer browser-review corrections validated: real per-class portraits, reduced native-ratio hero stretch, full-width source-backed progression table, compact movable feature inspector, preserved subclass/detail mechanics, and protected boundaries intact.");
