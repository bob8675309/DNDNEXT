import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read("pages/_app.js");
const catalog = read("components/NpcForgeClassCatalog.js");
const css = read("styles/character-forge-artificer-approved.css");
const guide = read("components/NpcForgeClassGuide.js");
const dock = read("components/NpcForgeClassFeatureDock.js");

assert(app.includes('import "../styles/character-forge-artificer-approved.css"'), "Approved Artificer presentation stylesheet is not loaded globally.");
assert(catalog.includes('data-class-key={String(row?.class_key || "").trim().toLowerCase()}'), "Class catalogue rows must expose their normalized class key for approved menu art.");

for (const token of [
  ".npc-forge-level-row { display: none !important; }",
  "grid-template-columns: minmax(300px, 24fr) minmax(0, 76fr)",
  "grid-template-rows: minmax(0,1fr) 0",
  "min-height: 69px !important",
  "width: 54px !important; height: 56px !important",
  'data:image/webp;base64,',
  '[data-class-key="artificer"]',
  '[data-class-key="barbarian"]',
  '[data-class-key="sorcerer"]',
  ".npc-forge-class-guide.is-class-artificer .npc-forge-class-guide__book-hero",
  "height: 246px !important",
  ".npc-forge-class-guide__hero-art {",
  "position: absolute !important; inset: 0 !important",
  "object-position: center 45% !important",
  "width: 57% !important",
  "grid-template-columns: minmax(0,1fr) minmax(355px,38%)",
  "margin-top: -62px !important",
  "max-height: 392px !important",
  "min-height: min(610px",
]) assert(css.includes(token), `Approved Artificer mockup lock is missing ${token}`);

for (const token of [
  "ForgeClassHero",
  "ForgeSubclassSelection",
  "ProgressionTable",
  "Class Overview",
  "Detailed Guide",
  "previewSubclass(model, onFeatureDetail, option)",
]) assert(guide.includes(token), `Artificer presentation patch must preserve existing Class behavior: ${token}`);

for (const token of [
  "handleDragStart",
  "handleDragMove",
  "handleDragEnd",
  "setClosedDetailKey(currentDetailKey)",
  "if (dismissed) return null",
]) assert(dock.includes(token), `Artificer presentation patch must preserve feature-card behavior: ${token}`);

const protectedSource = `${css}\n${catalog}\n${guide}\n${dock}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "mappageclient", "townsheet", "encounter_weapon_attack", "crafting_recipe"]) {
  assert(!protectedSource.includes(token), `Approved Artificer presentation crossed a protected boundary: ${token}`);
}

console.log("Approved Artificer mockup lock validated: compact 24/76 Class layout, hidden redundant stat strip, enlarged menu rows with approved menu art, full-bleed Artificer hero, expanded progression surface, preserved subclass/detail mechanics, and protected boundaries intact.");
