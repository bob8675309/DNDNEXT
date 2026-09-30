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
const featureDock = read("components/NpcForgeClassFeatureDock.js");

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
  'import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"',
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
  'const yaw = clamp(angleDegrees * 0.24, -34, 34)',
  'const horizontalRadius = 39.1',
  'const verticalRadius = 18.5',
  'const verticalCenter = 59.2',
  'const opacity = isFaceUp ? 1 : 0.84 + (depth * 0.14)',
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
  'class-subclass-carousel-modal__flame is-flame-left-upper',
  'class-subclass-carousel-modal__smoke-near',
  'class-subclass-carousel-card__float',
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
assert(!selector.includes('class-subclass-carousel-modal__details'), "The floating Tarot scene must stay free of the old dossier panel.");
assert(!selector.includes('class-subclass-carousel-modal__rune-foreground'), "Retired runic-table foreground must not return.");
assert(!selector.includes('const roll = clamp('), "Whole-card tangent roll must remain removed; cards should stay upright.");
assert(!tarotCss.includes('--orbit-roll'), "Whole-card orbit roll CSS must remain removed.");
assert(!selector.includes('class-subclass-carousel-card__base-contact'), "Rejected shadow-only base-contact layer must not return.");
assert(!selector.includes('class-subclass-carousel-card__base-fold'), "Rejected hinged footer must not return.");
assert(!selector.includes('class-subclass-carousel-card__table-seat'), "Rejected per-card table-seat layer must not return.");
assert(!tarotCss.includes('rotateX(70deg)'), "Rejected hinged footer transform must not return.");
assert(!tarotCss.includes('clip-path: inset(0 0 7.5% 0)'), "Full Tarot card artwork must remain intact; do not clip the footer.");
assert(!tarotCss.includes('subclass-card-base-contact-mask.svg'), "Rejected shadow-only contact-mask asset must not drive the live selector.");
assert(!tarotCss.includes('subclass-card-table-seat-mask.svg'), "Rejected per-card table-seat mask must not drive the live selector.");
assert(selector.includes('const faceUpArcDegrees = faceUpArcDegreesFor(count)') && selector.includes('const isFaceUp = count === 1 || absoluteAngle <= faceUpArcDegrees + 0.01'), "Front/back card presentation must derive from ring angle and catalogue density.");
assert(selector.includes('Math.pow(depth, 1.72) * 0.74'), "Non-hero physical card size must use non-linear continuous depth falloff.");
assert(selector.includes('const horizontalRadius = 39.1') && selector.includes('const verticalRadius = 18.5') && selector.includes('const verticalCenter = 59.2'), "Floating carousel path must remain stable across catalogue sizes and retain the browser-approved lower placement.");
assert(selector.includes('setOrbitOffset(normalizeOrbitOffset(optionIndex - FRONT_CENTER_SLOT, options.length))'), "Clicking a face-up card must rotate that exact card to hero.");

for (const token of [
  'url("/media/forge/subclass-carousel/subclass-selector-library-ruins-20260926.webp")',
  'url("/media/forge/subclass-carousel/subclass-selector-card-back-20260922.webp")',
  'width: min(1760px, 100vw, calc(100vh * 16 / 9))',
  'aspect-ratio: 16 / 9',
  '.class-subclass-carousel-card.is-orbit-center',
  'opacity: 1 !important',
  'translate(-50%, -100%)',
  'transform-origin: 50% 100%',
  'rotateY(var(--orbit-yaw))',
  'url("/media/forge/subclass-carousel/subclass-selector-smoke-back.png")',
  'url("/media/forge/subclass-carousel/subclass-selector-smoke-front.png")',
  'url("/media/forge/subclass-carousel/subclass-selector-smoke-gray-20260927.webp")',
  'url("/media/forge/subclass-carousel/subclass-selector-nav-prev-20260927.webp")',
  'url("/media/forge/subclass-carousel/subclass-selector-nav-next-20260927.webp")',
  'url("/media/forge/subclass-carousel/subclass-selector-flame-20260928.webp")',
  '@keyframes subclass-library-flame-waver',
  '@keyframes subclass-card-idle-float',
  '@keyframes subclass-smoke-near-drift',
  '@keyframes subclass-smoke-back-drift',
  '@keyframes subclass-smoke-front-drift',
  '@keyframes subclass-smoke-gray-drift',
  '@keyframes subclass-candle-flicker-left',
  '@keyframes subclass-candle-flicker-right',
  '.class-subclass-carousel-card.is-orbit-back .class-subclass-carousel-card__surface',
  'transform: rotateY(180deg)',
  'backface-visibility: hidden',
  '.class-subclass-carousel-modal__nav.is-prev',
  '.class-subclass-carousel-modal__nav.is-next',
  '@media (prefers-reduced-motion: reduce)',
]) assert(tarotCss.includes(token), `Reference-scene Tarot presentation is missing ${token}`);

assert(!tarotCss.includes('subclass-selector-cathedral-20260922.webp'), "Retired cathedral/runic-table background must not return.");
assert(!tarotCss.includes('subclass-rune-front-mask.svg'), "Retired rune foreground mask must not return.");
assert(!tarotCss.includes('.class-subclass-carousel-modal__rune-foreground'), "Retired table-owned rune foreground must not return.");
assert(tarotCss.includes('subclass-selector-smoke-back.png'), "Floating library scene must include the rear smoke layer.");
assert(tarotCss.includes('subclass-selector-smoke-front.png'), "Floating library scene must include the colored depth-smoke layer.");
assert(tarotCss.includes('subclass-selector-smoke-gray-20260927.webp'), "Floating library scene must include the gray depth-smoke layer.");
assert(selector.includes("<span>Choose Your</span><strong>Subclass</strong>") && !tarotCss.includes("subclass-selector-title-choose-fate-20260927.webp"), "Subclass selector title must use the symbol-free cinematic Choose Your / Subclass hierarchy.");
assert(tarotCss.includes('subclass-selector-nav-prev-20260927.webp') && tarotCss.includes('subclass-selector-nav-next-20260927.webp'), "Subclass selector must use the approved left/right navigation artwork.");
assert(selector.includes('? 820') && selector.includes('? 520 + Math.round(depth * 180)') && selector.includes(': 100 + Math.round(depth * 120)'), "Front/rear cards must use separate stacking bands so rear cards cannot clip across front cards.");
assert(tarotCss.includes('transform-style: flat') && tarotCss.includes('isolation: isolate'), "Carousel cards must remain atomic stacking layers while inner Tarot faces retain their own flip context.");
assert(tarotCss.includes('brightness(1.11)') && tarotCss.includes('brightness(1.06)'), "Front-facing Tarot cards must retain the subtle browser-approved brightness lift.");
assert(tarotCss.includes('animation: none !important'), "Reduced-motion mode must disable ambient library animation.");
assert(tarotCss.includes('.class-subclass-carousel-card.is-orbit-center .class-subclass-carousel-card__float') && tarotCss.includes('animation: none;'), "Hero card must stay still while non-hero cards idle-float.");
assert(tarotCss.includes('z-index: 760') && tarotCss.includes('class-subclass-carousel-modal__smoke-near'), "Near smoke must cross side/front cards while remaining below the hero z-band.");
assert(tarotCss.includes('left: 13.7%') && tarotCss.includes('right: 16.4%') && tarotCss.includes('top: 12.4%'), "Animated flames must stay registered to real upper candle clusters in the ruined-library background.");
assert(selector.includes("captureGlideRects") && selector.includes("glide.animate") && selector.includes('cubic-bezier(.32,.035,.18,1)'), "Tarot slot changes must use the compositor glide path rather than snapping layout-property transitions.");
assert(selector.includes("changedFaceBand ? 1 : clamp(rawScaleX, .72, 1.38)") && selector.includes("isFront: node.classList.contains(\"is-orbit-front\")"), "Tarot FLIP scaling must suppress oversized front/back depth-band transitions.");
assert(tarotCss.includes(".class-subclass-carousel-card__glide") && tarotCss.includes(".class-subclass-carousel-card__yaw") && tarotCss.includes('var(--orbit-float-duration, 9.6s)'), "Tarot glide, yaw, and independent idle-float layers must remain separated.");
assert(!tarotCss.includes("left 2.15s cubic-bezier") && !tarotCss.includes("top 2.25s cubic-bezier"), "Programmatic Tarot travel must not regress to left/top transition animation.");
assert(!tarotCss.includes(':hover .class-subclass-carousel-card__surface {\n  filter:'), "Hover must not filter the 3D card surface; that compositor path caused cards to disappear.");
assert(!tarotCss.includes('subclass-library-mouse-scurry') && !selector.includes('class-subclass-carousel-modal__mouse'), "Terrain-independent mouse animation must stay removed.");
assert(!tarotCss.includes('subclass-selector-bat'), "Do not replace the removed mouse with bats without a separate browser-reviewed plan.");

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
  "public/media/forge/subclass-carousel/subclass-selector-library-ruins-20260926.webp",
  "public/media/forge/subclass-carousel/subclass-selector-card-back-20260922.webp",
  "public/media/forge/subclass-carousel/subclass-selector-smoke-back.png",
  "public/media/forge/subclass-carousel/subclass-selector-smoke-front.png",
  "public/media/forge/subclass-carousel/subclass-selector-smoke-gray-20260927.webp",
  "public/media/forge/subclass-carousel/subclass-selector-nav-prev-20260927.webp",
  "public/media/forge/subclass-carousel/subclass-selector-nav-next-20260927.webp",
  "public/media/forge/subclass-carousel/subclass-selector-flame-20260928.webp",
]) assert(fs.existsSync(path.join(root, asset)), `Floating-library subclass selector asset missing ${asset}`);

const libraryAssetSize = fs.statSync(path.join(root, "public/media/forge/subclass-carousel/subclass-selector-library-ruins-20260926.webp")).size;
const tarotBackAssetSize = fs.statSync(path.join(root, "public/media/forge/subclass-carousel/subclass-selector-card-back-20260922.webp")).size;
const smokeBackAssetSize = fs.statSync(path.join(root, "public/media/forge/subclass-carousel/subclass-selector-smoke-back.png")).size;
const smokeFrontAssetSize = fs.statSync(path.join(root, "public/media/forge/subclass-carousel/subclass-selector-smoke-front.png")).size;
const flameAssetSize = fs.statSync(path.join(root, "public/media/forge/subclass-carousel/subclass-selector-flame-20260928.webp")).size;
const smokeGrayAssetSize = fs.statSync(path.join(root, "public/media/forge/subclass-carousel/subclass-selector-smoke-gray-20260927.webp")).size;
const navPrevAssetSize = fs.statSync(path.join(root, "public/media/forge/subclass-carousel/subclass-selector-nav-prev-20260927.webp")).size;
const navNextAssetSize = fs.statSync(path.join(root, "public/media/forge/subclass-carousel/subclass-selector-nav-next-20260927.webp")).size;
assert(libraryAssetSize > 150_000, `Ruined-library selector asset is unexpectedly small (${libraryAssetSize} bytes); reject placeholder/corrupt transfers.`);
assert(tarotBackAssetSize > 300_000, `Tarot back asset is unexpectedly small (${tarotBackAssetSize} bytes); reject placeholder/corrupt transfers.`);
assert(smokeBackAssetSize > 1_000_000, `Rear smoke asset is unexpectedly small (${smokeBackAssetSize} bytes); reject placeholder/corrupt transfers.`);
assert(smokeFrontAssetSize > 1_000_000, `Foreground smoke asset is unexpectedly small (${smokeFrontAssetSize} bytes); reject placeholder/corrupt transfers.`);
assert(flameAssetSize > 5_000, `Flame overlay asset is unexpectedly small (${flameAssetSize} bytes); reject placeholder/corrupt transfers.`);
assert(smokeGrayAssetSize > 250_000, `Gray smoke asset is unexpectedly small (${smokeGrayAssetSize} bytes); reject placeholder/corrupt transfers.`);
assert(navPrevAssetSize > 25_000 && navNextAssetSize > 25_000, "Approved navigation assets are unexpectedly small; reject placeholder/corrupt transfers.");


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
  wizard: ["abjuration", "abjurer", "bladesinger", "chronurgy", "conjuration", "divination", "diviner", "enchantment", "evocation", "evoker", "graviturgy", "illusion", "illusionist", "necromancy", "scribes", "transmutation", "war"],
};
let approvedTarotCount = 0;
for (const [classKey, families] of Object.entries(approvedTarotFamilies)) {
  for (const family of families) {
    approvedTarotCount += 1;
    assert(fs.existsSync(path.join(root, `public/media/subclasses/${classKey}/${classKey}-${family}.webp`)), `Approved tarot asset missing ${classKey}/${family}`);
  }
}
assert(approvedTarotCount === 151, `Expected 151 installed approved normalized tarot concepts after retiring corrupt Bladesinging, found ${approvedTarotCount}.`);
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

for (const token of ["subclassOption: option"]) assert(guide.includes(token), `Subclass inspector payload is missing ${token}`);
for (const token of ["subclassTab", "npc-forge-subclass-inspector__tabs", "Overview", "Features", "Lore", "Spells", "subclassArtworkFor", "subclassFeatures", "subclassSpellReferences", "spellCatalog", "Subclass Spell Grants"]) {
  assert(featureDock.includes(token), `Tabbed subclass inspector is missing ${token}`);
}
assert(!featureDock.includes("subclassSpellFeatures"), "Spells tab regressed to keyword-filtered feature duplication.");
assert(!featureDock.includes("Class Spell Access"), "Subclass Spells tab must not duplicate the later full class spell catalogue.");
assert(featureDock.includes("width: isSubclassInspector ? 720 : DOCK_DEFAULT_WIDTH") && featureDock.includes("body > .npc-forge-class-feature-dock.is-viewport-floating.is-subclass-inspector"), "Subclass inspector must override legacy floating-dock width caps with the wider reading layout.");
assert(featureDock.includes("npc-forge-subclass-inspector__overview-lore-scroll") && !featureDock.includes("Path Overview"), "Overview must present the source-backed subclass lore in the scrollable reading area rather than the old shallow Path Overview box.");
assert(featureDock.includes('grid-template-areas:"heading heading" "lore art"') && featureDock.includes("height:254px") && !featureDock.includes("<strong>Lore</strong>"), "Overview lore and Tarot art must remain parallel while redundant source/Lore labels stay removed.");
assert(!subclassArtwork.includes('bladesinging: "bladesinging"'), "Retired Bladesinging artwork mapping must not return.");
assert(featureDock.includes("grid-template-columns:repeat(2,minmax(0,1fr))"), "Subclass feature summaries must retain the two-column desktop layout.");
assert(model.includes("spellCatalog") && !model.includes("maxSpellLevelForProgressionRow"), "Subclass spell resolution should use the source-backed class spell catalogue without rendering the full class list here.");


console.log("Class subclass selector validation passed: canonical authority remains in the guide model, all subclass cards stay on one free-floating parametric carousel, rear cards use the shared card back, one exact hero position owns enlarged presentation, ambient library motion is presentation-only, drag/arrow motion never persists a subclass, explicit card clicks remain the only selection path, all 151 approved normalized Tarot concepts remain installed/mapped, and future content retains safe fallback.");
