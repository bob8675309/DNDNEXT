import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const guide = read("components/NpcForgeClassGuide.js");
const selector = read("components/ClassSubclassSection.js");
const subclassArtwork = read("utils/classes/subclassArtwork.js");
const presentation = read("utils/classes/classPresentation.js");
const framing = read("styles/character-forge-class-hero-framing.css");
const model = read("components/NpcForgeClassGuideModel.js");
const workspaceCss = read("styles/character-class-workspace.css");
const tarotCss = read("styles/character-forge-subclass-tarot-layout.css");

for (const token of [
  'import ClassSubclassSection from "./ClassSubclassSection"',
  '<ClassSubclassSection',
  'classKey={selectedClass?.class_key || ""}',
  'onInspectSubclass={(option) => inspectSubclass(model, onFeatureDetail, option)}',
  '<p className="npc-forge-class-guide__hero-tagline">{classOverviewSummary(selectedClass)}</p>',
  'function selectedRowFeatures(model, row)',
  'feature?.type !== "subclass"',
  'model?.selected',
  'Selected subclass features join the table automatically.',
  'function spellSlotCells(slots)',
  'const slotLabels = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"]',
  'class-level-guide__slot-cell',
  'onClick={() => publishFeature(model, onFeatureDetail, feature, row.class_level)}',
]) assert(guide.includes(token), `Class guide is missing ${token}`);

assert(!guide.includes('<aside className="npc-forge-class-guide__dock-lane"'), "Overview still reserves an empty dock lane instead of giving the progression table full width.");
assert(!guide.includes("<ClassOverviewCopy selectedClass={selectedClass}"), "Expanded Class overview copy is duplicated below the hero facts.");
assert(!guide.includes('onMouseEnter={() => publishFeature(model, onFeatureDetail'), "Feature card must not update from hover in the Class guide.");
assert(!guide.includes('onFocus={() => publishFeature(model, onFeatureDetail'), "Feature card must not update from focus alone in the Class guide.");

for (const token of [
  'import { useEffect, useMemo, useRef, useState } from "react"',
  'import { createPortal } from "react-dom"',
  'subclassArtworkFor(classKey, option)',
  'handleSubclassArtworkError(event, classKey)',
  'const FRONT_CENTER_SLOT = 0',
  'function faceUpArcDegreesFor(total)',
  'if (count <= 4) return 112',
  'return 68',
  'function orbitProfileFor(total)',
  'function orbitPlacement(optionIndex, orbitOffset, total)',
  'const angleStep = 360 / count',
  'const angleDegrees = signedSlots * angleStep',
  'const horizontalRadius = 36.5 + (density * 4.5)',
  'const verticalRadius = 17.4 + (density * 1.2)',
  'const [orbitOffset, setOrbitOffset] = useState(0)',
  'const orbitOptions = useMemo',
  'const heroOption = options[heroIndex] || null',
  'function rotateCarousel(direction)',
  'function handleOrbitPointerDown(event)',
  'function handleOrbitPointerMove(event)',
  'function finishOrbitPointer(event, cancelled = false)',
  'function handleCardClick(event, option, optionIndex, isInteractive)',
  'event.currentTarget.setPointerCapture?.(event.pointerId)',
  'Math.round(drag.currentOffset + projectedCards)',
  'class-subclass-carousel-modal__orbit',
  'class-subclass-carousel-modal__title',
  'class-subclass-carousel-card__surface',
  'class-subclass-carousel-card__face is-front',
  'class-subclass-carousel-card__face is-back',
  'isCenter ? " is-orbit-center" : ""',
  'isInteractive ? " is-orbit-front" : " is-orbit-back"',
  'data-orbit-angle={angleDegrees.toFixed(3)}',
  'onClick={(event) => handleCardClick(event, option, optionIndex, isInteractive)}',
  'model?.setPreviewKey?.(option.key)',
  'model.selectSubclass(option)',
  'class-subclass-selected-card',
  'onDoubleClick={() => setSelectorOpen(true)}',
  '>Change Subclass<',
  'currentLevel < entryLevel',
  'setSelectorOpen(true)',
  'onInspectSubclass?.(option)',
]) assert(selector.includes(token), `Reference-scene subclass selector is missing ${token}`);

assert((selector.match(/model\.selectSubclass\(option\)/g) || []).length === 1, "Carousel motion must never create a second subclass persistence path.");
assert(!selector.includes('model?.setPreviewKey?.(heroOption.key)'), "Hero position must not auto-preview or persist as player intent.");
assert(!selector.includes('browsedOption'), "Obsolete automatic browsed-card dossier state must not return.");
assert(!selector.includes('class-subclass-carousel-modal__details'), "The reference table scene must stay free of the old dossier panel.");
assert(!selector.includes('class-subclass-carousel-modal__smoke'), "The approved clean cathedral scene must not render smoke layers.");
assert(selector.includes('const faceUpArcDegrees = faceUpArcDegreesFor(count)') && selector.includes('const isFaceUp = count === 1 || absoluteAngle <= faceUpArcDegrees + 0.01'), "Front/back card presentation must derive from ring angle and catalogue density.");
assert(selector.includes('const scale = isCenter ? 1 : 0.46 + (depth * 0.48)'), "Non-hero scale must derive continuously from ring depth.");
assert(selector.includes('setOrbitOffset(normalizeOrbitOffset(optionIndex - FRONT_CENTER_SLOT, options.length))'), "Clicking a face-up card must rotate that exact card to hero.");

for (const token of [
  'url("/media/forge/subclass-carousel/subclass-selector-cathedral-20260922.webp")',
  'url("/media/forge/subclass-carousel/subclass-selector-card-back-20260922.webp")',
  'width: min(1760px, 100vw, calc(100vh * 16 / 9))',
  'aspect-ratio: 16 / 9',
  '.class-subclass-carousel-card.is-orbit-center',
  'width: clamp(var(--orbit-hero-min), var(--orbit-hero-vw), var(--orbit-hero-max))',
  'translate3d(-50%, -100%, 0)',
  'transform-origin: 50% 100%',
  'rotateY(var(--orbit-yaw))',
  '.class-subclass-carousel-card.is-orbit-back .class-subclass-carousel-card__surface',
  'transform: rotateY(180deg)',
  'backface-visibility: hidden',
  '.class-subclass-carousel-modal__nav.is-prev',
  '.class-subclass-carousel-modal__nav.is-next',
  '@media (prefers-reduced-motion: reduce)',
]) assert(tarotCss.includes(token), `Reference-scene Tarot presentation is missing ${token}`);

assert(!tarotCss.includes('subclass-selector-smoke-back.png'), "Smoke asset must not remain active in the clean reference-scene CSS.");
assert(!tarotCss.includes('subclass-selector-smoke-front.png'), "Foreground smoke must not remain active in the clean reference-scene CSS.");

for (const forbidden of [
  'class-subclass-two-column__grid',
  'class-subclass-two-column__scroll',
  'class-subclass-selected-row',
  'Search subclasses',
  'class-subclass-browser__search',
  'class-subclass-browser__sources',
  'onMouseEnter',
  'onFocus={() => onInspectSubclass',
  'const [visibleCount, setVisibleCount] = useState(4)',
  'const visibleOptions = useMemo',
  '--subclass-visible-count',
]) assert(!selector.includes(forbidden), `Subclass selector regressed to the prior flat/grid presentation: ${forbidden}`);

for (const forbidden of [
  'loopedOptions',
  'keepRailLooped',
  'rail.scrollWidth / 3',
  'scroll-snap-type:x mandatory',
  'scrollLeft += segment',
  'scrollLeft -= segment',
]) assert(!selector.includes(forbidden), `Subclass carousel still contains rubberband/recentering behavior: ${forbidden}`);

assert(!selector.includes("supabase"), "Subclass selector must remain presentation-only.");

for (const asset of [
  "public/media/forge/subclass-carousel/subclass-selector-cathedral-20260922.webp",
  "public/media/forge/subclass-carousel/subclass-selector-card-back-20260922.webp",
]) assert(fs.existsSync(path.join(root, asset)), `Reference-scene subclass selector asset missing ${asset}`);


// 2026-09-17 completed normalized Tarot install: every current runtime-visible
// subclass has approved dedicated art; the fallback remains only for unknown/future content.
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
  barbarian: ["ancestral-guardian", "battlerager", "beast", "berserker", "giant", "storm-herald", "totem-warrior", "wild-heart", "wild-magic", "world-tree", "zealot"],
  bard: ["creation", "dance", "eloquence", "glamour", "lore", "moon", "spirits", "swords", "valor", "whispers"],
  cleric: ["ambition", "arcana", "death", "forge", "grave", "knowledge", "life", "light", "nature", "order", "peace", "solidarity", "strength", "tempest", "trickery", "twilight", "war", "zeal"],
  druid: ["dreams", "land", "moon", "sea", "shepherd", "spores", "stars", "wildfire"],
  fighter: ["arcane-archer", "banneret", "battle-master", "cavalier", "champion", "echo-knight", "eldritch-knight", "purple-dragon-knight-banneret", "psi-warrior", "rune-knight", "samurai"],
  monk: ["ascendant-dragon", "astral-self", "drunken-master", "elements", "four-elements", "kensei", "long-death", "mercy", "open-hand", "shadow", "sun-soul"],
  "monster-hunter": ["carver-guild", "devourer-guild", "occultist-guild", "trapper-guild"],
  mystic: ["avatar", "awakened", "immortal", "nomad", "soul-knife", "wu-jen"],
  paladin: ["ancients", "conquest", "crown", "devotion", "glory", "noble-genies", "oathbreaker", "redemption", "vengeance", "watchers"],
  ranger: ["beast-master", "drakewarden", "fey-wanderer", "gloom-stalker", "hollow-warden", "horizon-walker", "hunter", "monster-slayer", "swarmkeeper", "winter-walker"],
  rogue: ["arcane-trickster", "assassin", "inquisitive", "mastermind", "phantom", "scion-of-the-three", "scout", "soulknife", "swashbuckler", "thief"],
  sorcerer: ["aberrant", "clockwork", "divine-soul", "draconic", "lunar", "pyromancer", "shadow", "spellfire", "storm", "wild-magic"],
  warlock: ["archfey", "celestial", "fathomless", "fiend", "genie", "great-old-one", "hexblade", "undead", "undying"],
  wizard: ["abjuration", "abjurer", "bladesinger", "bladesinging", "chronurgy", "conjuration", "divination", "diviner", "enchantment", "evocation", "evoker", "graviturgy", "illusion", "illusionist", "necromancy", "scribes", "transmutation", "war"],
};
let approvedTarotCount = 0;
for (const [classKey, families] of Object.entries(approvedTarotFamilies)) {
  for (const family of families) {
    approvedTarotCount += 1;
    assert(fs.existsSync(path.join(root, `public/media/subclasses/${classKey}/${classKey}-${family}.webp`)), `Approved tarot asset missing ${classKey}/${family}`);
  }
}
assert(approvedTarotCount === 152, `Expected 152 installed approved normalized tarot concepts, found ${approvedTarotCount}.`);
for (const token of ['"ambition-psa": "ambition"', '"knowledge-psa": "knowledge"', '"solidarity-psa": "solidarity"', '"strength-psa": "strength"', '"zeal-psa": "zeal"']) {
  assert(subclassArtwork.includes(token), `Preferred-source Cleric alias mapping missing ${token}`);
}
for (const token of ['"aberrant-mind": "aberrant"', '"clockwork-soul": "clockwork"', '"pyromancer-psk": "pyromancer"']) {
  assert(subclassArtwork.includes(token), `Preferred-source Sorcerer alias mapping missing ${token}`);
}
for (const token of ['wild: "wild-magic"', '"wild-magic": "wild-magic"']) {
  assert(subclassArtwork.includes(token), `Preferred-source Wild Magic alias mapping missing ${token}`);
}

assert(model.includes("resolveSubclassCatalog") && model.includes("const options = useMemo"), "Canonical subclass catalogue authority moved out of the existing guide model.");
assert(model.includes("selectSubclass"), "Existing subclass persistence authority disappeared from the guide model.");

for (const key of ["fighter", "wizard", "rogue", "cleric", "ranger", "paladin", "warlock"]) {
  assert(presentation.includes(`${key}:`), `Expanded core Class summary missing ${key}.`);
}
assert(presentation.includes("imported.length >= 180"), "Long imported/campaign Class summaries must remain authoritative.");

for (const token of [
  'bottom: auto !important',
  'left: 0 !important',
  'height: clamp(780px, 82vh, 960px) !important',
  'object-position: 100% 0% !important',
  'grid-template-columns: minmax(0, 1fr) !important',
  'font-size: .82rem !important',
]) assert(framing.includes(token), `Stable open top-right cinematic framing missing ${token}`);
assert(!framing.includes('bottom: 0 !important;\n    left: 0 !important'), "Cinematic art is still content-height-coupled.");

for (const token of [
  '.class-level-guide__features button',
  'border-radius: 999px',
  '.class-level-guide__features button.is-subclass',
]) assert(workspaceCss.includes(token), `Profile-panel feature-pill reference contract missing ${token}`);
for (const token of [
  'border-radius:999px!important',
  'background:rgba(126,75,202,.14)!important',
  'button.is-subclass',
  'min-width:0!important',
  'repeat(9,minmax(24px,.32fr))',
  'min-height:34px!important',
  'padding:.16rem .34rem!important',
  'font-size:.57rem!important',
  'grid-template-columns:40px 34px minmax(190px,2.15fr) 46px 62px repeat(9,minmax(24px,.32fr))!important',
  'text-align:center!important',
]) assert(guide.includes(token), `Forge progression table did not retain the balanced feature-pill/spell-slot treatment: ${token}`);

const protectedSource = `${guide}\n${selector}\n${subclassArtwork}\n${presentation}\n${framing}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "mappageclient", "townsheet", "encounter_weapon_attack", "crafting_recipe"]) {
  assert(!protectedSource.includes(token), `Class presentation patch crossed protected boundary: ${token}`);
}

console.log("Class subclass selector validation passed: canonical authority remains in the guide model, all subclass cards stay on one parametric table ring, rear cards use the shared card back, one exact hero position owns enlarged presentation, drag/arrow motion never persists a subclass, explicit card clicks remain the only selection path, all 152 approved normalized Tarot concepts remain installed/mapped, and future content retains safe fallback.");
