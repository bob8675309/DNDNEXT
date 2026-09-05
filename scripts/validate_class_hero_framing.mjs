import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read("pages/_app.js");
const framing = read("styles/character-forge-class-hero-framing.css");
const guide = read("components/NpcForgeClassGuide.js");
const artwork = read("utils/classes/classArtwork.js");
const speciesCorrection = read("styles/character-forge-cinematic-final-corrections.css");

assert(app.includes('import "../styles/character-forge-class-hero-framing.css";'), "Class hero framing stylesheet is not loaded globally.");
assert(app.indexOf('character-forge-class-hero-framing.css') > app.indexOf('character-forge-cinematic-final-corrections.css'), "Class hero framing correction must load after the older cinematic correction layer.");

for (const token of [
  ".npc-forge-class-guide:not(.is-class-artificer):not(.is-class-barbarian)",
  "object-fit: contain !important",
  "object-position: right center !important",
  "transform: none !important",
  ".npc-forge-class-guide.is-class-artificer",
  ".npc-forge-class-guide.is-class-barbarian",
  "object-fit: cover !important",
]) assert(framing.includes(token), `Class hero framing correction is missing ${token}`);

assert(guide.includes("classHeroArtworkFor(selectedClass.class_key)"), "Class hero must keep the centralized artwork resolver.");
assert(guide.includes("is-class-${theme}"), "Class guide must retain per-class theme hooks used by framing corrections.");
assert(artwork.includes("CINEMATIC_CLASS_HERO_ARTWORK"), "Purpose-built cinematic Class hero authority is missing.");
assert(artwork.includes("artificer: artificerHero") && artwork.includes("barbarian: barbarianHero"), "Artificer/Barbarian wide cinematic hero mappings must remain intact.");

assert(!speciesCorrection.includes('img[alt^="Bugbear species reference"]'), "Obsolete Bugbear crop override would stack on top of the newly approved Bugbear composition.");

const protectedText = `${framing}\n${guide}\n${artwork}\n${speciesCorrection}`.toLowerCase();
for (const token of ["mappageclient", "map_routes", "advance_all_characters", "townsheet", "world travel"]) {
  assert(!protectedText.includes(token), `Class hero framing patch unexpectedly references protected map/town behavior: ${token}`);
}

console.log("Class hero framing validation passed: square legacy Class paintings fit without destructive zoom/crop, purpose-built Artificer/Barbarian cinematic heroes retain cover behavior, obsolete Bugbear focal override is removed, and protected map/town boundaries remain untouched.");
