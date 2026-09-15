import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read("pages/_app.js");
const step = read("components/NpcForgeStepContent.js");
const catalog = read("components/NpcForgeClassCatalog.js");
const guide = read("components/NpcForgeClassGuide.js");
const selector = read("components/ClassSubclassSection.js");
const guideStyles = read("components/NpcForgeClassGuideStyles.js");
const dock = read("components/NpcForgeClassFeatureDock.js");
const artwork = read("utils/classes/classArtwork.js");
const subclassArtwork = read("utils/classes/subclassArtwork.js");
const presentation = read("utils/classes/classPresentation.js");
const catalogWrapper = read("utils/npcForgeCatalog.js");
const polish = read("styles/character-forge-browser-review-polish.css");
const framing = read("styles/character-forge-class-hero-framing.css");
const tarotLayout = read("styles/character-forge-subclass-tarot-layout.css");

assert(step.includes('import NpcForgeClassCatalog from "./NpcForgeClassCatalog"'), "Class step must use the dedicated Class catalogue.");
assert(step.includes("<NpcForgeClassCatalog query={classQuery}"), "Class step does not render the dedicated Class catalogue.");
assert(!step.includes('<CatalogList label="Classes"'), "Legacy flat Class CatalogList is still rendered in parallel.");

for (const token of [
  "isSidekickClass",
  "const sidekicks = rows.filter(isSidekickClass)",
  "const regular = rows.filter((row) => !isSidekickClass(row))",
  'aria-label="Sidekick classes"',
  "setSidekicksOpen",
  "onSelect?.(row)",
]) assert(catalog.includes(token), `Sidekick Class catalogue grouping is missing ${token}`);

for (const token of [
  'import { useEffect, useRef, useState } from "react"',
  'import { createPortal } from "react-dom"',
  'const [closedDetailKey, setClosedDetailKey] = useState("")',
  "const [floatingPosition, setFloatingPosition] = useState(null)",
  "const [portalHost, setPortalHost] = useState(null)",
  "currentDetailKey",
  "boundedDockPosition",
  "defaultDockPosition",
  "setPortalHost(document.body)",
  "createPortal(dock, portalHost)",
  "is-viewport-floating",
  "handleDragStart",
  "handleDragMove",
  "handleDragEnd",
  "setClosedDetailKey(currentDetailKey)",
  'aria-label="Close class feature details"',
  "if (dismissed) return null",
]) assert(dock.includes(token), `Viewport-owned/dismissible Class description window is missing ${token}`);
assert(!dock.includes("setCollapsed"), "Closing the Class detail window must dismiss it completely rather than collapse it into a persistent shell.");

for (const token of [
  "classThemeKey",
  "is-class-${theme}",
  "classOverviewSummary(selectedClass)",
  "npc-forge-class-guide__hero-art",
  "ClassSubclassSection",
  "classKey={selectedClass?.class_key || \"\"}",
  "onInspectSubclass",
  "inspectSubclass(model, onFeatureDetail, option)",
  "selectedRowFeatures",
  "spellSlotCells",
  'const slotLabels = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"]',
  "Selected subclass features join the table automatically",
  "class-level-guide__slot-cell",
  'aria-label={`View ${feature.name} details`}',
  "onClick={() => publishFeature(model, onFeatureDetail, feature, row.class_level)}",
  "Class Overview",
  "Detailed Guide",
]) assert(guide.includes(token), `Class overview target presentation is missing ${token}`);
assert(!guide.includes('<aside className="npc-forge-class-guide__dock-lane"'), "Class overview still wastes width on an in-flow Feature-card lane.");
assert(!guide.includes('onMouseEnter={() => publishFeature(model, onFeatureDetail'), "Feature-card content must not change on feature hover.");
assert(!guide.includes('onFocus={() => publishFeature(model, onFeatureDetail'), "Feature-card content must not change from focus alone.");
assert(!guide.includes("classSlotSummary(row.spell_slots)"), "Progression regressed to the compressed one-cell spell-slot summary.");

for (const token of [
  'import { createPortal } from "react-dom"',
  "subclassArtworkFor(classKey, option)",
  "class-subclass-carousel-modal",
  'role="dialog"',
  'aria-modal="true"',
  "class-subclass-carousel-modal__rail",
  "scroll-snap-type:x mandatory",
  "class-subclass-carousel-card",
  "loopedOptions",
  "keepRailLooped",
  "rail.scrollWidth / 3",
  "class-subclass-selected-card",
  'onDoubleClick={() => setSelectorOpen(true)}',
  ">Change Subclass<",
  "model.selectSubclass(option)",
  "model.setPreviewKey(option.key)",
  "optionEntryLevel(option) > currentLevel",
  "onInspectSubclass?.(option)",
]) assert(selector.includes(token), `Cinematic looping subclass selector is missing ${token}`);
for (const forbidden of [
  "class-subclass-two-column__grid",
  "class-subclass-two-column__scroll",
  "class-subclass-selected-row",
  "grid-template-columns:repeat(2,minmax(0,1fr))",
  "onMouseEnter",
  "Search subclasses",
  "browserOpen",
  "class-subclass-browser__search",
  "class-subclass-browser__sources",
]) assert(!selector.includes(forbidden), `Subclass selector regressed to the prior grid/hover-driven presentation: ${forbidden}`);
assert(!selector.includes("supabase"), "Subclass selector must remain presentation-only.");

assert(app.includes('import "../styles/character-forge-subclass-tarot-layout.css";'), "Normalized subclass tarot layout stylesheet is not loaded by _app.js.");
for (const token of [
  ".class-subclass-carousel-card",
  "aspect-ratio: 7 / 12 !important;",
  ".class-subclass-carousel-card__shade",
  "inset: 20px auto auto 20px !important;",
  "max-height: min(900px, 94vh) !important;",
]) assert(tarotLayout.includes(token), `Normalized 7:12 subclass tarot presentation is missing ${token}`);
assert(!tarotLayout.includes("aspect-ratio: 5 / 7"), "Tarot layout override regressed to the old 5:7 card ratio.");
assert(!tarotLayout.includes("rgba(3, 5, 10, 0.96)"), "Tarot layout override restored the old near-opaque lower footer shade.");

// 2026-09-13 approved normalized tarot install: explicitly mapped cards use the
// installed 7:12 deck while every unfinished subclass retains the class-art fallback.
for (const token of [
  'classMenuArtworkFor',
  'APPROVED_SUBCLASS_ART_FAMILIES',
  'function approvedSubclassArtworkFor',
  '/media/subclasses/',
  'function fallbackSubclassArtworkFor',
  'handleSubclassArtworkError',
]) assert(subclassArtwork.includes(token), `Approved subclass artwork/fallback contract is missing ${token}`);

const approvedTarotFamilies = {
  artificer: ["alchemist", "armorer", "artillerist", "battle-smith", "cartographer", "reanimator"],
  barbarian: ["berserker", "wild-heart", "world-tree", "zealot"],
  bard: ["dance", "glamour", "lore", "moon", "spirits", "valor"],
  cleric: ["ambition", "arcana", "death", "forge", "grave", "knowledge", "life", "light", "nature", "order", "peace", "solidarity", "strength", "tempest", "trickery", "twilight", "war", "zeal"],
  druid: ["dreams", "land", "moon", "sea", "shepherd", "spores", "stars", "wildfire"],
  fighter: ["banneret", "battle-master", "champion", "eldritch-knight", "psi-warrior"],
  monk: ["elements", "mercy", "open-hand", "shadow"],
  "monster-hunter": ["carver-guild", "devourer-guild", "occultist-guild", "trapper-guild"],
  paladin: ["ancients", "devotion", "glory", "noble-genies", "vengeance"],
  ranger: ["beast-master", "fey-wanderer", "gloom-stalker", "hollow-warden", "hunter", "winter-walker"],
  rogue: ["arcane-trickster", "assassin", "phantom", "scion-of-the-three", "soulknife", "thief"],
  sorcerer: ["aberrant", "clockwork", "divine-soul", "draconic", "lunar", "pyromancer", "shadow", "spellfire", "storm", "wild-magic"],
  warlock: ["archfey", "celestial", "fathomless", "fiend", "genie", "great-old-one", "hexblade", "undead", "undying"],
  wizard: ["abjuration", "bladesinger", "conjuration", "divination", "enchantment", "evocation", "graviturgy", "illusion"],
};
let approvedTarotCount = 0;
for (const [classKey, families] of Object.entries(approvedTarotFamilies)) {
  for (const family of families) {
    approvedTarotCount += 1;
    assert(fs.existsSync(path.join(root, `public/media/subclasses/${classKey}/${classKey}-${family}.webp`)), `Approved tarot asset missing ${classKey}/${family}`);
  }
}
assert(approvedTarotCount === 99, `Expected 99 installed approved tarot concepts, found ${approvedTarotCount}.`);
for (const token of ['"ambition-psa": "ambition"', '"knowledge-psa": "knowledge"', '"solidarity-psa": "solidarity"', '"strength-psa": "strength"', '"zeal-psa": "zeal"']) {
  assert(subclassArtwork.includes(token), `Preferred-source Cleric alias mapping missing ${token}`);
}
for (const token of ['"aberrant-mind": "aberrant"', '"clockwork-soul": "clockwork"', '"pyromancer-psk": "pyromancer"']) {
  assert(subclassArtwork.includes(token), `Preferred-source Sorcerer alias mapping missing ${token}`);
}
for (const token of ['wild: "wild-magic"', '"wild-magic": "wild-magic"']) {
  assert(subclassArtwork.includes(token), `Preferred-source Wild Magic alias mapping missing ${token}`);
}

for (const token of [
  "grid-template-columns:minmax(0,1fr)!important",
  "min-width:0!important",
  "repeat(9,minmax(24px,.32fr))",
  "min-height:34px!important",
  "padding:.16rem .34rem!important",
  "font-size:.57rem!important",
  "grid-template-columns:40px 34px minmax(190px,2.15fr) 46px 62px repeat(9,minmax(24px,.32fr))!important",
  "text-align:center!important",
  "border-radius:999px!important",
  "button.is-subclass",
]) assert(guide.includes(token), `Balanced progression presentation is missing ${token}`);

for (const token of [
  "bottom: auto !important",
  "left: 0 !important",
  "height: clamp(780px, 82vh, 960px) !important",
  "object-position: 100% 0% !important",
  "min-height: 312px !important",
  "font-size: .82rem !important",
]) assert(framing.includes(token), `Open stable cinematic Class art is missing ${token}`);

assert(artwork.includes('artificer: "/media/classes/artificer-approved.webp"'), "Approved Artificer Forge artwork mapping is missing.");
assert(fs.existsSync(path.join(root, "public/media/classes/artificer-approved.webp")), "Approved Artificer Forge artwork asset is missing.");
for (const key of ["fighter", "wizard", "rogue", "cleric", "ranger", "paladin", "warlock"]) {
  assert(presentation.includes(`${key}:`), `Expanded core Class summary missing ${key}.`);
}
assert(presentation.includes("imported.length >= 180"), "Long imported/campaign Class summaries must remain authoritative.");

for (const token of [
  "mergePreferredClasses as refinedMergePreferredClasses",
  "classPresentationSummary",
  "classPrimaryAbilities",
  "export function mergePreferredClasses",
]) assert(catalogWrapper.includes(token), `Forge class normalization is missing ${token}`);
assert(polish.includes("npc-forge-step-2"), "Class browser polish scope disappeared.");
assert(guideStyles.includes("npc-forge-class-guide__table-card") && guideStyles.includes("class-level-guide__row"), "Class progression foundation styling disappeared.");

const protectedSources = `${step}\n${catalog}\n${guide}\n${selector}\n${guideStyles}\n${dock}\n${artwork}\n${subclassArtwork}\n${presentation}\n${catalogWrapper}\n${polish}\n${framing}\n${tarotLayout}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "mappageclient", "townsheet", "world travel", "crafting_recipe"]) {
  assert(!protectedSources.includes(token), `Class browser patch unexpectedly references protected behavior: ${token}`);
}

console.log("Class browser polish validation passed: cinematic looping subclass gallery, normalized 7:12 tarot layout, restrained no-footer card shading, 99 approved tarot concepts with safe fallbacks for unfinished subclasses, click-only movable Feature-card details, selected-subclass progression bubbles, balanced per-level spell-slot table, open stable top-right art, preserved Class authority, and protected boundaries are intact.");
