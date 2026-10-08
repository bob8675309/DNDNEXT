import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const guide = read("components/NpcForgeClassGuide.js");
const guideStyles = read("components/NpcForgeClassGuideStyles.js");
const selector = read("components/ClassSubclassSection.js");
const subclassArtwork = read("utils/classes/subclassArtwork.js");
const presentation = read("utils/classes/classPresentation.js");
const framing = read("styles/character-forge-class-hero-framing.css");
const model = read("components/NpcForgeClassGuideModel.js");
const workspaceCss = read("styles/character-class-workspace.css");
const tarotCss = read("styles/character-forge-subclass-tarot-layout.css");
const featureDock = read("components/NpcForgeClassFeatureDock.js");
const forgeSteps = read("components/NpcForgeStepContent.js");
const playerFacingText = read("utils/playerFacingText.js");
const subclassSpellGrantsSource = read("utils/classes/subclassSpellGrants.js");
const spellCardCss = read("styles/spell-card.css");
const finalClassBrowserCss = read("styles/character-forge-class-final-browser-fix.css");
const classAcceptanceCss = read("styles/character-forge-class-acceptance-corrections.css");
const classMenuApprovedCss = read("styles/character-forge-class-menu-approved-art.css");

for (const token of [
  'import ClassSubclassSection from "./ClassSubclassSection"',
  '<ClassSubclassSection',
  'classKey={selectedClass?.class_key || ""}',
  'onInspectSubclass={(option, actions) => inspectSubclass(model, onSubclassDetail, option, actions)}',
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
assert(!guide.includes('onInspectSubclass={(option) => inspectSubclass(model, onFeatureDetail, option)}'), "Subclass inspection must not route through the Class Feature callback.");

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
  'const yaw = 0',
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
  'function inspectOption(option, selectedOverride = false)',
  'model.selectSubclass(option)',
  'class-subclass-selected-card-shell',
  '>Open Codex<',
  'currentLevel >= entryLevel',
  'setSelectorOpen(true)',
  'onInspectSubclass?.(option, {',
]) assert(selector.includes(token), `Reference-scene subclass selector is missing ${token}`);

assert((selector.match(/model\.selectSubclass\(option\)/g) || []).length === 1, "Subclass persistence must remain a single explicit Codex-confirmation path.");
assert(selector.includes("function handleCardClick") && selector.includes("model?.setPreviewKey?.(option.key)") && selector.includes("function inspectOption(option, selectedOverride = false)") && selector.includes("choose = eligible && !selectedNow"), "Tarot card click must preview/center first, while the Codex receives the explicit choose action.");
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
  '.class-subclass-carousel-card__yaw {',
  'transform: none;',
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
assert(selector.includes("captureGlideRects") && selector.includes("glide.animate") && selector.includes('cubic-bezier(.22,.78,.24,1)'), "Tarot slot changes must use the current base-anchored compositor glide rather than snapping layout-property transitions.");
assert(selector.includes("movement > orbitWidth * .58") && selector.includes("previousCenterX") && selector.includes("previous.bottom - next.bottom") && selector.includes("const duration = 980"), "Tarot glide must animate bottom-center anchor travel while skipping the rear signed-angle seam teleport.");
assert(selector.includes("const scale = clamp(previous.width / next.width, .42, 2.35)") && selector.includes("scale(${scale.toFixed(4)})") && tarotCss.includes(".class-subclass-carousel-card__glide") && tarotCss.includes("transform-origin: 50% 100%;"), "Tarot cards must resize continuously around their base anchor while moving between orbit slots.");
assert(!selector.includes("scaleX = clamp(previous.width / next.width") && !selector.includes("scaleY = clamp(previous.height / next.height"), "Anisotropic top-left FLIP scaling must not return; it caused camera-lunge blowups.");
assert(/\n\s*const yaw = 0;\n/.test(selector), "Tarot yaw declaration must remain executable code on its own line.");
assert(!selector.includes("corkscrew.\\n  const yaw = 0;"), "Tarot yaw declaration must never be swallowed by a line comment through a literal \\n sequence.");
assert(tarotCss.includes(".class-subclass-carousel-card__glide") && tarotCss.includes(".class-subclass-carousel-card__yaw") && tarotCss.includes('var(--orbit-float-duration, 9.6s)'), "Tarot glide, yaw, and independent idle-float layers must remain separated.");
assert(!tarotCss.includes("left 2.15s cubic-bezier") && !tarotCss.includes("top 2.25s cubic-bezier"), "Programmatic Tarot travel must not regress to left/top transition animation.");
assert(selector.includes("<strong>Subclass Browser</strong>") && !selector.includes("class-subclass-launcher__icon"), "Unselected subclass entry point must remain the compact Subclass Browser pill.");
assert(!selector.includes("autoOpenedForRef") && !selector.includes("autoOpenKey"), "Crossing the subclass entry level must never auto-open the selector; Forge advancement should signal readiness without stealing focus.");
assert(tarotCss.includes(".class-subclass-section.is-required .class-subclass-launcher") && tarotCss.includes("@keyframes subclass-browser-ready-energy") && tarotCss.includes("@keyframes subclass-browser-ready-aura"), "Eligible unselected subclass state must pulse the Subclass Browser with the reviewed energy-ready treatment.");
assert(tarotCss.includes("width: max-content") && tarotCss.includes("border-radius: 999px"), "Subclass Browser launcher must remain compact rather than stretching across the class panel.");
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
  barbarian: ["ancestral-guardian", "battlerager", "beast", "berserker", "giant", "storm-herald", "totem-warrior", "wild-heart", "wild-magic", "world-tree", "zealot", "path-of-the-fractured", "path-of-the-primal-spirit", "path-of-the-wrathful-dead"],
  bard: ["creation", "dance", "eloquence", "glamour", "lore", "moon", "spirits", "swords", "valor", "whispers", "college-of-adventurers", "college-of-fools", "college-of-requiems"],
  cleric: ["ambition", "arcana", "death", "forge", "grave", "knowledge", "life", "light", "nature", "order", "peace", "solidarity", "strength", "tempest", "trickery", "twilight", "war", "zeal", "eldritch-domain", "inquisition-domain", "purification-domain"],
  druid: ["dreams", "land", "moon", "sea", "shepherd", "spores", "stars", "wildfire", "circle-of-blood"],
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
assert(approvedTarotCount === 161, `Expected 161 installed approved normalized tarot concepts after the first 10-card Grim Hollow expansion batch, found ${approvedTarotCount}.`);
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
  '"path-of-the-fractured": "path-of-the-fractured"',
  '"path-of-the-primal-spirit": "path-of-the-primal-spirit"',
  '"path-of-the-wrathful-dead": "path-of-the-wrathful-dead"',
  '"college-of-adventurers": "college-of-adventurers"',
  '"college-of-fools": "college-of-fools"',
  '"college-of-requiems": "college-of-requiems"',
  '"eldritch-domain": "eldritch-domain"',
  '"inquisition-domain": "inquisition-domain"',
  '"purification-domain": "purification-domain"',
  '"circle-of-blood": "circle-of-blood"',
]) {
  assert(subclassArtwork.includes(token), `Approved Grim Hollow Tarot mapping missing ${token}`);
}

const subclassCompatibility = await import(pathToFileURL(path.join(root, "utils/classes/subclassCompatibility.js")).href);
const { resolveSubclassCatalog, guideSubclassFeatures, subclassIntroduction } = subclassCompatibility;
const playerFacingModule = await import(pathToFileURL(path.join(root, "utils/playerFacingText.js")).href);
const subclassSpellGrants = await import(pathToFileURL(path.join(root, "utils/classes/subclassSpellGrants.js")).href);
const { subclassSpellGrantReferences, resolveSubclassSpellGrants } = subclassSpellGrants;
const cleanedImportedRefs = playerFacingModule.formatPlayerFacingText("Lore text.\n\nBladesong|Wizard|XPHB|Bladesinger|FRHoF|3|FRHoF\n\nSoul Knife|Mystic|UATheMysticClass|Soul Knife|UATheMysticClass|1");
assert(cleanedImportedRefs === "Lore text.", "Mixed-case and long imported source-reference rows must stay out of player-facing lore.");

function testSubclassRow({ subclassName, name, level = 3, source = "TEST", classSource = "XPHB", header = null, description = "Source-backed rules.", entries = [] }) {
  return {
    feature_type: "subclass",
    class_key: "test",
    subclass_name: subclassName,
    subclass_short_name: subclassName,
    name,
    source,
    class_source: classSource,
    level,
    description,
    entries,
    raw_payload: { header },
  };
}

const winterWalker = resolveSubclassCatalog([
  testSubclassRow({ subclassName: "Winter Walker", name: "Frigid Explorer", header: null }),
  testSubclassRow({ subclassName: "Winter Walker", name: "Hunter's Rime", header: null }),
  testSubclassRow({ subclassName: "Winter Walker", name: "Winter Walker", header: null, description: "Winter Walker lore." }),
  testSubclassRow({ subclassName: "Winter Walker", name: "Winter Walker Spells", header: null }),
  testSubclassRow({ subclassName: "Winter Walker", name: "Fortifying Soul", level: 7, header: 2 }),
], "XPHB")[0];
assert(subclassIntroduction(winterWalker)?.name === "Winter Walker", "Winter Walker lore row must remain the subclass introduction when several level-3 feature rows have null headers.");
for (const name of ["Frigid Explorer", "Hunter's Rime", "Winter Walker Spells", "Fortifying Soul"]) {
  assert(guideSubclassFeatures(winterWalker).some((feature) => feature.name === name), `Winter Walker feature was incorrectly hidden as introduction: ${name}`);
}

const bladesinger = resolveSubclassCatalog([
  testSubclassRow({ subclassName: "Bladesinger", name: "Bladesinger", source: "FRHoF", header: null, description: "Bladesinger lore." }),
  testSubclassRow({ subclassName: "Bladesinger", name: "Bladesong", source: "FRHoF", header: null }),
  testSubclassRow({ subclassName: "Bladesinger", name: "Training in War and Song", source: "FRHoF", header: null }),
  testSubclassRow({ subclassName: "Bladesinger", name: "Extra Attack", source: "FRHoF", level: 6, header: 2 }),
], "XPHB")[0];
assert(subclassIntroduction(bladesinger)?.name === "Bladesinger", "Bladesinger lore row must not swallow same-level Bladesong/Training features.");
assert(guideSubclassFeatures(bladesinger).some((feature) => feature.name === "Bladesong"), "Bladesong must remain a visible subclass feature.");
assert(guideSubclassFeatures(bladesinger).some((feature) => feature.name === "Training in War and Song"), "Training in War and Song must remain a visible subclass feature.");

const kensei = resolveSubclassCatalog([
  testSubclassRow({ subclassName: "Kensei", name: "Way of the Kensei", source: "XGE", classSource: "PHB", header: null, description: "Kensei lore." }),
  testSubclassRow({ subclassName: "Kensei", name: "Path of the Kensei", source: "XGE", classSource: "PHB", header: 1, description: "Kensei feature rules." }),
], "XPHB")[0];
assert(subclassIntroduction(kensei)?.name === "Way of the Kensei", "Header-1 Path of the Kensei feature must not be mistaken for the lore introduction.");
assert(guideSubclassFeatures(kensei).some((feature) => feature.name === "Path of the Kensei"), "Path of the Kensei must remain a visible feature.");

const soulKnife = resolveSubclassCatalog([
  testSubclassRow({ subclassName: "Soul Knife", name: "Order of the Soul Knife", source: "UATheMysticClass", classSource: "UATheMysticClass", level: 1, header: null, description: "Soul Knife lore." }),
  testSubclassRow({ subclassName: "Soul Knife", name: "Soul Knife", source: "UATheMysticClass", classSource: "UATheMysticClass", level: 1, header: 1, description: "Soul Knife feature rules." }),
], "UATheMysticClass")[0];
assert(subclassIntroduction(soulKnife)?.name === "Order of the Soul Knife", "Header-1 Soul Knife feature must not replace the Order of the Soul Knife lore row.");
assert(guideSubclassFeatures(soulKnife).some((feature) => feature.name === "Soul Knife"), "Soul Knife level-1 feature must remain visible.");

const knowledgeChoices = resolveSubclassCatalog([
  testSubclassRow({ subclassName: "Knowledge", name: "Knowledge Domain", source: "FRHoF", classSource: "XPHB", description: "Modern Knowledge lore." }),
  testSubclassRow({ subclassName: "Knowledge", name: "Blessings of Knowledge", source: "FRHoF", classSource: "XPHB", description: "Modern Knowledge rules." }),
  testSubclassRow({ subclassName: "Knowledge", name: "Knowledge Domain", source: "PHB", classSource: "PHB", level: 1, description: "Legacy Knowledge lore." }),
  testSubclassRow({ subclassName: "Knowledge", name: "Blessings of Knowledge", source: "PHB", classSource: "PHB", level: 1, header: 1, description: "Legacy Knowledge rules." }),
  testSubclassRow({ subclassName: "Knowledge (PSA)", name: "Knowledge Domain (PSA)", source: "PSA", classSource: "XPHB", description: "", entries: [] }),
  testSubclassRow({ subclassName: "Knowledge (PSA)", name: "Knowledge Domain (PSA)", source: "PSA", classSource: "PHB", level: 1, description: "Setting-variant lore." }),
], "XPHB");
assert(knowledgeChoices.length === 1 && knowledgeChoices[0].name === "Knowledge" && knowledgeChoices[0].source === "FRHoF", "Complete exact-ruleset Knowledge must beat legacy/empty placeholders, and duplicate Knowledge (PSA) must stay hidden.");

for (const [subclassName, introName] of [
  ["Swords", "College of Swords"],
  ["Land", "Circle of the Land"],
  ["Noble Genies", "Oath of the Noble Genies"],
  ["Shadow", "Warrior of Shadow"],
  ["Scribes", "Order of Scribes"],
  ["Archfey", "Archfey Patron"],
  ["Spellfire", "Spellfire Sorcery"],
  ["Draconic", "Draconic Bloodline"],
  ["Wild", "Wild Magic"],
  ["Chronurgy", "Chronurgy Magic"],
  ["Graviturgy", "Graviturgy Magic"],
  ["War", "War Magic"],
  ["Ambition (PSA)", "Ambition Domain (PSA)"],
]) {
  const option = resolveSubclassCatalog([
    testSubclassRow({ subclassName, name: introName, description: `${subclassName} lore.` }),
    testSubclassRow({ subclassName, name: `${subclassName} Feature`, header: null }),
  ], "XPHB")[0];
  assert(subclassIntroduction(option)?.name === introName, `Wrapped subclass introduction identity failed for ${subclassName}: ${introName}`);
  assert(guideSubclassFeatures(option).some((feature) => feature.name === `${subclassName} Feature`), `Null-header feature was incorrectly hidden for ${subclassName}`);
}

const twilightGrantRows = [
  testSubclassRow({
    subclassName: "Twilight",
    name: "Twilight Domain",
    source: "TCE",
    classSource: "PHB",
    level: 1,
    entries: [{
      type: "table",
      caption: "Twilight Domain Spells",
      colLabels: ["Cleric Level", "Spells"],
      rows: [
        ["1st", "{@spell faerie fire}, {@spell sleep}"],
        ["3rd", "{@spell moonbeam}, {@spell see invisibility}"],
        ["5th", "{@spell aura of vitality}, {@spell Leomund's tiny hut}"],
        ["7th", "{@spell aura of life}, {@spell greater invisibility}"],
        ["9th", "{@spell circle of power}, {@spell mislead}"],
      ],
    }],
  }),
];
const twilightRefs = subclassSpellGrantReferences(twilightGrantRows);
assert(twilightRefs.length === 10 && twilightRefs.some((spell) => spell.name === "mislead"), "Intro-embedded legacy subclass spell tables must populate the Codex Spells tab.");

const directGrantRefs = subclassSpellGrantReferences([
  testSubclassRow({ subclassName: "Wild Heart", name: "Animal Speaker", entries: ["You can cast the {@spell Beast Sense|XPHB} and {@spell Speak with Animals|XPHB} spells but only as Rituals."] }),
  testSubclassRow({ subclassName: "Wild Heart", name: "Nature Speaker", level: 10, header: 2, entries: ["You can cast the {@spell Commune with Nature|XPHB} spell but only as a Ritual."] }),
  testSubclassRow({ subclassName: "Sun Soul", name: "Searing Arc Strike", level: 6, header: 2, entries: ["You can spend 2 Focus Points to cast the {@spell Burning Hands|XPHB} spell as a Bonus Action."] }),
]);
for (const spell of ["Beast Sense", "Speak with Animals", "Commune with Nature", "Burning Hands"]) {
  assert(directGrantRefs.some((entry) => entry.name === spell), `Direct subclass spell grant missing ${spell}`);
}

const choiceGrantRefs = subclassSpellGrantReferences([
  testSubclassRow({ subclassName: "Arcane Archer", name: "Arcane Archer Lore", source: "XGE", classSource: "PHB", entries: ["You choose to learn either the {@spell prestidigitation} or the {@spell druidcraft} cantrip."] }),
  testSubclassRow({ subclassName: "Scion of the Three", name: "Dread Allegiance", source: "FRHoF", entries: [{ type: "table", colLabels: ["Dead Three", "Resistance", "Cantrip"], rows: [["Bane", "Psychic", "{@spell Minor Illusion|XPHB}"], ["Bhaal", "Poison", "{@spell Blade Ward|XPHB}"], ["Myrkul", "Necrotic", "{@spell Chill Touch|XPHB}"]] }] }),
  testSubclassRow({ subclassName: "Light", name: "Bonus Cantrip", source: "PHB", classSource: "PHB", level: 1, entries: ["You gain the {@spell light} cantrip if you don't already know it."] }),
  testSubclassRow({ subclassName: "Ancestral Guardian", name: "Consult the Spirits", source: "XGE", classSource: "PHB", level: 10, entries: ["At 10th level, you gain the ability to consult with your ancestral spirits. When you do so, you cast the {@spell augury} or {@spell clairvoyance} spell, without using a spell slot or material components."] }),
  testSubclassRow({ subclassName: "Phantom", name: "Tokens of the Departed", source: "RHW", level: 9, entries: ["You can take a Magic action to destroy a soul trinket and immediately cast the {@spell Augury|XPHB} spell."] }),
]);
for (const spell of ["prestidigitation", "druidcraft", "Minor Illusion", "Blade Ward", "Chill Touch", "light", "augury", "clairvoyance"]) {
  const spellKey = spell.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  assert(choiceGrantRefs.some((entry) => entry.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === spellKey), `Choice/direct subclass spell grant missing ${spell}`);
}

const falseGrantRefs = subclassSpellGrantReferences([
  testSubclassRow({ subclassName: "Zealot", name: "Warrior of the Gods", header: 1, entries: ["If a spell, such as {@spell raise dead}, restores you to life, its caster needs no Material components."] }),
  testSubclassRow({ subclassName: "Scribes", name: "Manifest Mind", level: 6, header: 2, entries: ["The spectral mind ends if someone casts {@spell dispel magic} on it."] }),
  testSubclassRow({ subclassName: "Hunter", name: "Evasion", level: 15, header: 2, entries: ["You evade effects such as a {@spell lightning bolt} spell."] }),
]);
assert(falseGrantRefs.length === 0, "Incidental spell references must not be presented as subclass-granted spells.");

const resolvedSpellGrant = resolveSubclassSpellGrants(
  [{ name: "Shield", source: "", unlockLabel: "3" }],
  [
    { name: "Shield", source: "PHB", level: 1, description: "Legacy." },
    { name: "Shield", source: "XPHB", level: 1, description: "2024." },
  ],
)[0];
assert(resolvedSpellGrant?.source === "XPHB" && resolvedSpellGrant?.description === "2024.", "Subclass spell resolution must prefer the modern Profile-spellbook source when a grant omits a source.");

const cleanedEmptySourceRef = playerFacingModule.formatPlayerFacingText("Rules.\n\nSpirit Seeker|Barbarian||Totem Warrior||3\n\nBear|XGE\n\nFriendly [Attitude] creature in an Emanation [Area of Effect].");
assert(cleanedEmptySourceRef === "Rules.\n\nFriendly creature in an Emanation.", "Player-facing cleanup must remove empty-source/short imported references and strip bracketed 5etools annotations.");

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
assert(framing.includes(".npc-forge-class-guide__overview-book .npc-forge-class-guide__hero-art:has") && !framing.includes('.class-book-guide__content:has(.npc-forge-class-guide__hero-art img[src*="/media/classes/cinematic-"])'), "Global cinematic framing must remain Overview-scoped; Detailed Guide owns its separate intentional background treatment.");
assert(!guide.includes("npc-forge-class-guide__detailed-background") && guide.includes("npc-forge-class-guide__detailed-hero-stage") && guide.includes("npc-forge-class-guide__detailed-subclass-slot") && guide.includes("<ForgeClassHero selectedClass={selectedClass} detailed"), "Detailed Guide must use the canonical ForgeClassHero nested hero-art instead of a sibling image hidden behind the hero background.");
assert(!guide.includes("ChoiceRoutingNote") && !guide.includes("npc-forge-class-guide__detailed-controls"), "Detailed Guide must not render the retired Deferred Resolutions routing box.");
assert(guideStyles.includes("height:430px!important;min-height:430px!important") && guideStyles.includes("npc-forge-class-guide__hero-tagline{margin-top:36px!important}"), "Detailed Guide hero must retain the taller post-routing-note stage and the larger title-to-lore gap.");
assert(guideStyles.includes("left:31%!important") && guideStyles.includes("width:58%!important;height:430px!important") && guideStyles.includes("min-width:58%!important;min-height:430px!important") && guideStyles.includes("object-position:right center!important") && guideStyles.includes("min-height:430px!important"), "Detailed Guide must keep the subclass Tarot in the marked title-side gap and preserve an explicit full-height right-side cinematic artwork box.");

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

for (const token of ["subclassOption: option", "progressionRows: model.rows || []", "currentLevel: model.currentLevel"]) assert(guide.includes(token), `Subclass inspector payload is missing ${token}`);
for (const token of ["subclassTab", "npc-forge-subclass-inspector__tabs", "Overview", "Progression", "Spells", "subclassArtworkFor", "subclassFeatures", "subclassSpellGrantReferences", "spellCatalog", "Subclass Spells", "SpellCard", "subclassSpellWorkspaceRows", "npc-forge-subclass-inspector__spell-workspace", "npc-forge-subclass-inspector__spell-list", "npc-forge-subclass-inspector__spell-preview", "buildSubclassProgressionRows", "npc-forge-subclass-inspector__art-backdrop", "DUNAMANCY_SPELL_NAMES", "onFeatureDetail = null"]) {
  assert(featureDock.includes(token), `Tabbed subclass inspector is missing ${token}`);
}
assert(!featureDock.includes("subclassSpellFeatures"), "Spells tab regressed to keyword-filtered feature duplication.");
assert(!featureDock.includes("Class Spell Access"), "Subclass Spells tab must not duplicate the later full class spell catalogue.");
assert(featureDock.includes("CODEX_DOCK_WIDTH = 720") && featureDock.includes("body > .npc-forge-class-feature-dock.is-viewport-floating.is-subclass-inspector"), "Subclass Codex must override legacy floating-dock width caps with the wider reading layout.");
assert(featureDock.includes("npc-forge-subclass-inspector__overview-lore-scroll") && !featureDock.includes("Path Overview"), "Overview must present the source-backed subclass lore in the scrollable reading area rather than the old shallow Path Overview box.");
assert(featureDock.includes("npc-forge-subclass-inspector__art-backdrop") && featureDock.includes("npc-forge-subclass-inspector__content-layer") && !featureDock.includes("<strong>Lore</strong>"), "Subclass Tarot art must remain a subdued background layer while redundant Lore labels stay removed.");
assert(featureDock.includes("npc-forge-subclass-inspector__progression-table") && featureDock.includes("npc-forge-subclass-inspector__progression-features") && featureDock.includes("is-subclass"), "Subclass inspector must retain the merged class/subclass progression table with distinct subclass feature styling.");
assert(featureDock.includes('["progression", "Progression"]') && !featureDock.includes("is-overview-progression"), "Progression must remain in its own dedicated Subclass Codex tab.");
assert(featureDock.includes("overviewFeatureKey") && featureDock.includes("npc-forge-subclass-inspector__overview-feature-index") && featureDock.includes("Back to lore"), "Overview must keep the right-side subclass feature index and swap the left lore panel into feature details in place.");
assert(featureDock.includes('onClick={() => onFeatureDetail?.({ type: "classFeature"') && forgeSteps.includes("onFeatureDetail={setClassFeatureDetail}"), "Codex progression pills must route into the independent Feature panel.");
assert(featureDock.includes("this subclass has access to dunamancy spells") && featureDock.includes("subclassHasDunamancyAccess"), "Dunamancy access must remain in the Spells tab.");
assert(featureDock.includes("subclassSpellGrantReferences(subclassOption?.features || [])") && featureDock.includes("resolveSubclassSpellGrants"), "Subclass Codex must inspect every source-backed subclass row, including intro-embedded spell tables, and resolve grants against the full spell catalogue.");
assert(!featureDock.includes("normalizedSpellName(") && featureDock.includes("normalizeSubclassSpellName(feature?.name)"), "Subclass Codex progression helpers must use the imported normalization helper; stale normalizedSpellName calls would crash the Codex at runtime.");
assert(subclassSpellGrantsSource.includes("spellTable") && subclassSpellGrantsSource.includes("sentenceGrantsSpells") && subclassSpellGrantsSource.includes("prefixGrantsSpell"), "Subclass spell discovery must distinguish real table/direct grants from incidental spell mentions.");
assert(playerFacingText.includes("internalReferenceLabel") && playerFacingText.includes("Area of Effect|Attitude"), "Player-facing sanitizer must collapse imported reference rows and remove bracketed 5etools annotations.");
assert(featureDock.includes("width:86%") && featureDock.includes("brightness(.98)") && featureDock.includes("object-position:center top") && featureDock.includes("transform-origin:50% 0"), "Subclass Tarot backdrop must begin behind the navigation strip and reveal only the lower portion below it, keeping faces lower in the Codex crop.");
assert(featureDock.includes("playerFacingSubclassLore") && featureDock.includes("isImportedSubclassReferenceLine") && featureDock.includes('split("|")') && featureDock.includes("parts.length >= 7 ? parts[parts.length - 2]"), "Player-facing subclass lore must strip imported subclass-reference metadata without mutating catalogue data.");
assert(featureDock.includes("npc-forge-class-feature-dock__title-group{display:none!important}") && featureDock.includes("head-actions>em{display:none!important}"), "Subclass inspector header must stay compact and avoid repeating identity/source labels.");
assert(!subclassArtwork.includes('bladesinging: "bladesinging"'), "Retired Bladesinging artwork mapping must not return.");
assert(!featureDock.includes('["features", "Features"]') && !featureDock.includes('["lore", "Lore"]'), "Redundant Features and Lore tabs must stay removed; Overview already owns both functions.");
assert(featureDock.includes("grid-template-columns:repeat(3,1fr)"), "Subclass Codex must retain only Overview, Progression, and Spells tabs.");
assert(featureDock.includes('import SpellCard from "./SpellCard"') && featureDock.includes("<SpellCard spell={selectedSubclassSpellRow.spell} compact dense />"), "Subclass Spells tab must reuse the shared SpellCard with the Codex-only dense presentation.");
assert(featureDock.includes("height:min(460px,calc(84dvh - 160px))") && featureDock.includes("npc-forge-subclass-inspector__spell-preview{display:grid;grid-template-rows:minmax(0,1fr);min-height:0;overflow:hidden}") && featureDock.includes("npc-forge-subclass-inspector__spell-preview-scroll{min-height:0;height:100%;overflow-y:auto;overflow-x:hidden") && featureDock.includes("scrollbar-gutter:stable"), "Long subclass spell cards must stay inside a bounded preview pane with their own complete vertical scroll instead of forcing the outer Codex to clip or scroll the card under the tabs.");
assert(featureDock.includes("grid-template-columns:minmax(180px,.58fr) minmax(0,1.42fr)"), "Subclass spell workspace must give the detail card more horizontal room.");
assert(featureDock.includes("spell-card__description{font-size:.9rem!important;line-height:1.52!important;color:#fff!important}"), "Subclass spell rules body text must remain larger and high-contrast in the dense Codex preview.");
for (const token of [".spell-card--dense", "font-size: 0.84rem;", "line-height: 1.5;", ".spell-card--dense .spell-card__grid"]) assert(spellCardCss.includes(token), `Dense Codex spell-card readability treatment missing ${token}`);
assert(featureDock.includes("npc-forge-subclass-inspector__spell-row-name") && featureDock.includes("npc-forge-subclass-inspector__spell-row-meta") && featureDock.includes("npc-forge-subclass-inspector__spell-row-tags"), "Subclass Spells tab must use the profile-style selectable spell list plus detailed preview.");
assert(tarotCss.includes("width: max-content") && tarotCss.includes("padding: .38rem .46rem") && tarotCss.includes("class-subclass-section.is-card-launcher"), "Subclass Browser launcher shell must stay compact around its button rather than stretching across the class panel.");
assert(forgeSteps.includes("const [classFeatureDetail, setClassFeatureDetail] = useState(null)") && forgeSteps.includes("const [subclassCodexDetail, setSubclassCodexDetail] = useState(null)"), "Class Feature panel and Subclass Codex must keep independent state models.");
assert(forgeSteps.includes('panelRole="codex" detail={subclassCodexDetail}') && forgeSteps.includes('panelRole="feature" detail={classFeatureDetail}'), "Class step must render independent Codex and Feature panel instances.");
assert(guide.includes("onSubclassDetail") && guide.includes("onFeatureDetail") && !guide.includes("inspectSubclass(model, onFeatureDetail"), "Subclass inspection and feature detail routing must remain separate callbacks.");
assert(featureDock.includes("FEATURE_DOCK_WIDTH = 520") && featureDock.includes("is-feature-panel") && featureDock.includes("font-size:1.08rem!important;line-height:1.56!important;color:#fff!important") && featureDock.includes("width:min(560px"), "Feature panel must retain the larger desktop reading width with balanced high-contrast rules text.");
assert(!finalClassBrowserCss.includes("is-viewport-floating.has-feature .npc-forge-class-feature-dock__summary") && !classAcceptanceCss.includes("body .npc-forge-class-feature-dock .npc-forge-class-feature-dock__summary") && !classMenuApprovedCss.includes("body .npc-forge-class-feature-dock .npc-forge-class-feature-dock__summary"), "Legacy browser-polish styles must not shrink the Class Feature rules text underneath the current readable panel treatment.");
assert(model.includes("OPTION_SUMMARIES") && model.includes("listedOptionsForFeature") && featureDock.includes("npc-forge-class-feature-dock__listed-options") && featureDock.includes("Available options"), "Warlock Eldritch Invocation Options must surface the canonical invocation catalogue instead of only the imported pointer sentence.");
assert(featureDock.includes("window.innerWidth - width - 28") && featureDock.includes("forge ? forge.top + 46 : 72"), "Subclass Codex must default to the upper-right so it does not cover the hero Tarot card.");
assert(!tarotCss.includes("class-subclass-carousel-modal__choice-bar") && tarotCss.includes(".class-subclass-selected-card-shell") && tarotCss.includes("width: max-content") && tarotCss.includes(".class-subclass-selected-card__copy button"), "Tarot selector must not render the obsolete bottom confirmation box, and the selected subclass must remain a simple card/title/Open Codex presentation.");
assert(tarotCss.includes("align-items: flex-start;") && tarotCss.includes("align-content: start;") && tarotCss.includes("padding-top: .08rem;"), "Selected subclass title and Open Codex action must stay top-aligned with the Tarot card.");
assert(classMenuApprovedCss.includes('content: "LEVEL";') && classMenuApprovedCss.includes("width: 96px !important;") && classMenuApprovedCss.includes("font-size: .78rem !important;") && classMenuApprovedCss.includes("padding: 8px 112px 8px 11px !important;"), "Class level selector must retain the larger high-contrast LEVEL treatment without covering the search field.");
assert(selector.includes('selected ? " has-selection" : ""') && tarotCss.includes(".class-subclass-section.is-card-launcher.has-selection") && tarotCss.includes("background: transparent !important") && tarotCss.includes("border: 0 !important"), "Selected subclass presentation must sit directly on the Class background without the old nested container chrome.");
assert(featureDock.includes("npc-forge-class-feature-dock__subclass-action") && featureDock.includes("subclassActionLabel") && featureDock.includes("Browse Tarot"), "Subclass selection/change action must live in the Codex header rather than below the carousel.");
assert(model.includes("spellCatalog") && model.includes("allSpellCatalog: spells") && !model.includes("maxSpellLevelForProgressionRow"), "Subclass spell resolution should retain class access while exposing the full source-backed spell catalogue for special subclass access such as Dunamancy.");
for (const token of ["area_type", "area_size", "area_unit", "material_text", "saving_throw_abilities", "attack_type", "healing_dice", "higher_level_text"]) assert(model.includes(token), `Subclass Codex spell query must retain Profile SpellCard detail field: ${token}`);
assert(featureDock.includes("overflow:hidden!important") && featureDock.includes("flex-direction:column!important") && featureDock.includes("max-height:min(84dvh") && featureDock.includes("overflow-x:hidden!important;overflow-y:auto!important") && featureDock.includes("scrollbar-gutter:stable") && featureDock.includes("npc-forge-subclass-inspector__tabs{position:sticky;top:0"), "Codex scrolling must stay inside the body below the fixed header/tab boundary without a horizontal scrollbar cutting off the inner Codex.");
assert(featureDock.includes("padding:22px 22px 34px") && featureDock.includes("npc-forge-subclass-inspector__content.is-spells{min-height:0;padding-bottom:22px;overflow:hidden}") && featureDock.includes("padding:5px 8px 14px 5px"), "Codex content and the spell preview must preserve bottom breathing room so the card footer is fully reachable.");


console.log("Class subclass selector validation passed: canonical authority remains in the guide model, all subclass cards stay on one free-floating parametric carousel, rear cards use the shared card back, one exact hero position owns enlarged presentation, ambient library motion is presentation-only, drag/arrow motion never persists a subclass, explicit card clicks remain the only selection path, all 161 approved normalized Tarot concepts remain installed/mapped, and future content retains safe fallback.");
