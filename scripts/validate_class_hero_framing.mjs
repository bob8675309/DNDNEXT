import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read("pages/_app.js");
const framing = read("styles/character-forge-class-hero-framing.css");
const guide = read("components/NpcForgeClassGuide.js");
const catalog = read("components/NpcForgeClassCatalog.js");
const artwork = read("utils/classes/classArtwork.js");
const speciesCorrection = read("styles/character-forge-cinematic-final-corrections.css");

assert(app.includes('import "../styles/character-forge-class-hero-framing.css";'), "Class hero framing stylesheet is not loaded globally.");
assert(app.indexOf('character-forge-class-hero-framing.css') > app.indexOf('character-forge-cinematic-final-corrections.css'), "Class hero framing correction must load after the older cinematic correction layer.");

for (const token of [
  ".npc-forge-class-guide:not(.is-class-artificer):not(.is-class-barbarian)",
  "object-fit: contain !important",
  "object-position: right center !important",
  "width: calc(100% + 32px) !important",
  "margin-top: -8px !important",
  "margin-right: -32px !important",
  "transform: none !important",
  ".npc-forge-class-guide.is-class-artificer",
  ".npc-forge-class-guide.is-class-barbarian",
  "object-fit: cover !important",
]) assert(framing.includes(token), `Class hero framing correction is missing ${token}`);

for (const token of [
  'img[src*="/media/classes/cinematic-"]',
  "position: absolute !important",
  "top: 0 !important",
  "right: 0 !important",
  "bottom: auto !important",
  "left: 0 !important",
  "height: clamp(780px, 82vh, 960px) !important",
  "object-position: 100% 0% !important",
  "min-height: 312px !important",
  "font-size: .82rem !important",
  "grid-template-columns: minmax(0, 1fr) !important",
  "@media (max-width: 900px)",
]) assert(framing.includes(token), `Open stable top-right Class cinematic contract is missing ${token}`);
assert(!framing.includes("bottom: 0 !important;\n    left: 0 !important"), "Cinematic hero must not use the expanding content height as its bottom edge.");

assert(guide.includes("classHeroArtworkFor(selectedClass.class_key)"), "Class hero must keep the centralized artwork resolver.");
assert(guide.includes("is-class-${theme}"), "Class guide must retain per-class theme hooks used by framing corrections.");
assert(catalog.includes("classMenuArtworkFor(classKey)"), "Class catalogue must keep a separately resolved menu-art role.");

for (const token of [
  "PUBLIC_CINEMATIC_CLASS_HERO_ARTWORK",
  "PUBLIC_CINEMATIC_CLASS_MENU_ARTWORK",
  "GENERATED_CINEMATIC_CLASS_HERO_ARTWORK",
  "GENERATED_CINEMATIC_CLASS_MENU_ARTWORK",
  "classHeroArtworkFor",
  "classMenuArtworkFor",
]) assert(artwork.includes(token), `Class artwork authority is missing ${token}`);

assert(artwork.includes("artificer: artificerHero") && artwork.includes("barbarian: barbarianHero"), "Artificer/Barbarian generated cinematic hero mappings must remain intact.");
assert(artwork.includes("artificer: artificerMenu") && artwork.includes("barbarian: barbarianMenu"), "Artificer/Barbarian menu-art mappings must remain intact.");
assert(!speciesCorrection.includes('img[alt^="Bugbear species reference"]'), "Obsolete Bugbear crop override would stack on top of the newly approved Bugbear composition.");

const protectedText = `${framing}\n${guide}\n${catalog}\n${artwork}\n${speciesCorrection}`.toLowerCase();
for (const token of ["mappageclient", "map_routes", "advance_all_characters", "townsheet", "world travel"]) {
  assert(!protectedText.includes(token), `Class hero framing patch unexpectedly references protected map/town behavior: ${token}`);
}

console.log("Class hero framing validation passed: legacy paintings retain safe framing, public cinematic art is fixed high in a stable full-width faded background layer independent of subclass/content height, artwork roles remain separate, and protected boundaries are untouched.");
