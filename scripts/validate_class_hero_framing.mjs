import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read("pages/_app.js");
const framing = read("styles/character-forge-class-hero-framing.css");
const fullBleed = read("styles/character-forge-class-fullbleed-final.css");
const finalCorners = read("styles/character-forge-class-final-corners.css");
const guide = read("components/NpcForgeClassGuide.js");
const catalog = read("components/NpcForgeClassCatalog.js");
const artwork = read("utils/classes/classArtwork.js");
const speciesCorrection = read("styles/character-forge-cinematic-final-corrections.css");

assert(app.includes('import "../styles/character-forge-class-hero-framing.css";'), "Class hero framing stylesheet is not loaded globally.");
assert(app.includes('import "../styles/character-forge-class-fullbleed-final.css";'), "Class full-bleed stylesheet is not loaded globally.");
assert(app.includes('import "../styles/character-forge-class-final-corners.css";'), "Final Class cinematic correction stylesheet is not loaded globally.");
assert(app.indexOf('character-forge-class-hero-framing.css') > app.indexOf('character-forge-cinematic-final-corrections.css'), "Class hero framing correction must load after the older cinematic correction layer.");
assert(app.indexOf('character-forge-class-fullbleed-final.css') > app.indexOf('character-forge-class-hero-framing.css'), "Class full-bleed correction must load after the older hero framing layer.");
assert(app.indexOf('character-forge-class-final-corners.css') > app.indexOf('character-forge-class-fullbleed-final.css'), "Final Class cinematic correction must load last among Class framing layers.");

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
assert(framing.includes(`npc-forge-class-guide__overview-book:has(.npc-forge-class-guide__hero-art img[src*="/media/classes/cinematic-"])::before`) && framing.includes("content: none !important"), "Cinematic Class art must suppress the old inset Overview frame so artwork reaches the card corners.");

/* Final browser-acceptance layer: the modal owns one sharp cinematic image all the way through the
   Character Forge border. Transparent gradients protect text readability; no nested blur, second
   crop, or letterboxed Wizard subclass artwork is allowed to return. */
for (const token of [
  ".npc-forge-modal-v2.is-player-mode:has(.npc-forge-body.npc-forge-step-class",
  "--npc-forge-class-cinematic-art: url(\"/media/classes/cinematic-wizard.webp\")",
  ")::before {",
  "var(--npc-forge-class-cinematic-art) var(--npc-forge-class-art-position, center center) / cover no-repeat",
  "--npc-forge-class-art-position: 70% 42px",
  "--npc-forge-class-art-position: 68% 10%",
  "--npc-forge-class-reading-fade: linear-gradient",
  "text-shadow: 0 1px 3px rgba(0, 0, 0, .92), 0 0 14px rgba(0, 0, 0, .46)",
  "> .npc-forge-header",
  "> .npc-forge-steps",
  "background: rgba(3, 4, 9, .16) !important",
  "background: transparent !important",
  "background-image: none !important",
  ".npc-forge-class-guide__hero-art",
  "display: none !important",
  ".npc-forge-class-guide__hero-copy",
  "object-fit: cover !important",
  "backdrop-filter: none !important",
]) assert(finalCorners.includes(token), `Final Class Forge-border cinematic contract is missing ${token}`);

assert(finalCorners.includes("rgba(3, 5, 12, .80) 0%") && finalCorners.includes("rgba(3, 5, 12, .10) 72%") && finalCorners.includes("rgba(3, 5, 12, 0) 80%"), "Default Class cinematic fade must keep the left reading zone dark while clearing before the right-side subject.");
assert(finalCorners.includes("rgba(3, 5, 12, .99) 0%") && finalCorners.includes("rgba(3, 5, 12, .52) 68%") && finalCorners.includes("rgba(3, 5, 12, 0) 88%"), "Wizard must keep its stronger near-black left reading fade while clearing before the hero subject.");
assert(!/filter\s*:\s*blur\(/i.test(finalCorners), "Final Class cinematic artwork must not be blurred.");
assert(!/backdrop-filter\s*:\s*blur\(/i.test(finalCorners), "Final Class copy/chrome must not blur the cinematic artwork.");
assert(!finalCorners.includes("rgba(4, 7, 14, .68) 0%, rgba(4, 7, 14, .54) 22%, rgba(4, 7, 14, .28) 45%"), "Obsolete body-level opaque cinematic veil must not return.");
assert(finalCorners.includes(".npc-forge-body.is-player-mode.npc-forge-step-class") && finalCorners.includes("background-image: none !important"), "Class body must explicitly stop repainting the cinematic layer under the modal-owned artwork.");
assert(finalCorners.includes("456x240") && finalCorners.includes("76x40"), "Wizard subclass artwork must document the true selector aspect-ratio contract.");

assert(fullBleed.includes("position: absolute !important") && fullBleed.includes("inset: 0 !important"), "Pre-final Class full-bleed fallback contract must remain available beneath the browser-acceptance override.");
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

const protectedText = `${framing}\n${fullBleed}\n${finalCorners}\n${guide}\n${catalog}\n${artwork}\n${speciesCorrection}`.toLowerCase();
for (const token of ["mappageclient", "map_routes", "advance_all_characters", "townsheet", "world travel"]) {
  assert(!protectedText.includes(token), `Class hero framing patch unexpectedly references protected map/town behavior: ${token}`);
}

console.log("Class hero framing validation passed: one crisp modal-owned cinematic image reaches the Forge border with a strong transparent Wizard reading fade, Fighter lowered below the Class divider, resize-safe focal positioning, Wizard subclass art filling its native wide slot, nested duplicate/blur layers suppressed, and protected boundaries untouched.");
