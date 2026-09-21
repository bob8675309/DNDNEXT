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
  'import { createPortal } from "react-dom"',
  'const FRONT_CENTER_SLOT = 1',
  'const FACE_UP_ARC_DEGREES = 72',
  'const DRAG_THRESHOLD_PX = 6',
  'const FLICK_PROJECTION_MS = 180',
  'function normalizeOrbitOffset(value, total)',
  'function signedOrbitSlots(value, total)',
  'function orbitProfileFor(total)',
  'const density = clamp((count - 4) / 10, 0, 1)',
  'const horizontalRadius = 31 + (density * 6.5)',
  'const verticalRadius = 22 + (density * 2.5)',
  'const verticalCenter = 52.5',
  'function orbitPlacement(optionIndex, orbitOffset, total)',
  'const angleStep = 360 / count',
  'const angleDegrees = signedSlots * angleStep',
  'const depth = (cosine + 1) / 2',
  'const isCenter = Math.abs(signedSlots) <= 0.015',
  'const isFaceUp = count === 1 || absoluteAngle <= FACE_UP_ARC_DEGREES + 0.01',
  'const isInteractive = isFaceUp',
  'const yaw = clamp(angleDegrees * 0.5, -68, 68)',
  'const x = 50 + (sine * profile.horizontalRadius)',
  'const y = profile.verticalCenter + (cosine * profile.verticalRadius)',
  'const scale = isCenter ? 1 : 0.56 + (depth * 0.40)',
  'const opacity = isCenter ? 0.985 : 0.22 + (depth * 0.73)',
  '"--orbit-depth-z": "0px"',
  '"--orbit-card-min":',
  '"--orbit-card-vw":',
  '"--orbit-card-max":',
  '"--orbit-hero-min":',
  '"--orbit-hero-vw":',
  '"--orbit-hero-max":',
  'const [orbitOffset, setOrbitOffset] = useState(0)',
  'const [isDragging, setIsDragging] = useState(false)',
  'const [inspectedKey, setInspectedKey] = useState("")',
  'const dragStateRef = useRef(null)',
  'const suppressClickUntilRef = useRef(0)',
  'const inspectedOption = options.find((option) => option.key === inspectedKey) || null',
  'function handleOrbitPointerDown(event)',
  'function handleOrbitPointerMove(event)',
  'function finishOrbitPointer(event, cancelled = false)',
  'function handleCardClick(event, option, optionIndex, isInteractive)',
  'setOrbitOffset(normalizeOrbitOffset(optionIndex - FRONT_CENTER_SLOT, options.length))',
  'event.currentTarget.setPointerCapture?.(event.pointerId)',
  'event.currentTarget.releasePointerCapture?.(event.pointerId)',
  'Math.round(drag.currentOffset + projectedCards)',
  'class-subclass-carousel-modal__orbit',
  'onPointerDown={handleOrbitPointerDown}',
  'onPointerMove={handleOrbitPointerMove}',
  'onPointerUp={(event) => finishOrbitPointer(event)}',
  'onPointerCancel={(event) => finishOrbitPointer(event, true)}',
  'width={840}',
  'height={1440}',
  'isCenter ? " is-orbit-center" : ""',
  'isInteractive ? " is-orbit-front" : " is-orbit-back"',
  'isFaceUp ? " is-orbit-face-up" : ""',
  'data-orbit-angle={angleDegrees.toFixed(3)}',
  'onClick={(event) => handleCardClick(event, option, optionIndex, isInteractive)}',
  'click to rotate to the hero position and select',
  'model.setPreviewKey(option.key)',
  'model.selectSubclass(option)',
  'onClick={showInspectedDetails}',
  'if (optionEntryLevel(option) <= currentLevel)',
  'class-subclass-selected-card',
  'onDoubleClick={() => setSelectorOpen(true)}',
  '>Change Subclass<',
  'onInspectSubclass?.(option)',
]) assert(selector.includes(token), `Flexible table-ring subclass selector is missing ${token}`);

assert(!selector.includes('VISIBLE_CARD_CAP'), "Flexible ring must not cap or hide subclasses based on a fixed visible-card count.");
assert(!selector.includes('function orbitThetaDegrees'), "Fixed hand-authored slot geometry must not coexist with the parametric ring.");
assert(!selector.includes('isVisible'), "Every subclass card must remain on the same physical ring instead of entering a capped visual window.");
assert((selector.match(/model\.selectSubclass\(option\)/g) || []).length === 1, "Carousel motion must never persist a subclass; only the explicit card-choice path may call selectSubclass(option).");
assert(!selector.includes('model?.setPreviewKey?.(focusedOption.key)'), "Front-most carousel position must not auto-preview/persist as the player's subclass.");
assert(!selector.includes('const focusedOption = options[focusedIndex] || null'), "Legacy auto-focused front-card selection state is still present.");
assert(selector.includes('const angleStep = 360 / count'), "Subclass cards must be evenly spaced around the ring for every catalogue size.");
assert(selector.includes('const angleDegrees = signedSlots * angleStep'), "Every card must derive its physical ring position from equal angular spacing.");
assert(selector.includes('const density = clamp((count - 4) / 10, 0, 1)'), "The ring may expand mildly with catalogue size instead of switching to a different carousel.");
assert(selector.includes('const horizontalRadius = 31 + (density * 6.5)'), "Adaptive horizontal ring radius must remain bounded to the physical table.");
assert(selector.includes('const verticalRadius = 22 + (density * 2.5)'), "Adaptive vertical ring radius must preserve the same table ellipse.");
assert(selector.includes('const isFaceUp = count === 1 || absoluteAngle <= FACE_UP_ARC_DEGREES + 0.01'), "Front/back presentation must be angle-based, not hard-coded by slot count.");
assert(selector.includes('const isInteractive = isFaceUp'), "Visible face-up cards must be able to rotate themselves into the hero position.");
assert(selector.includes('setOrbitOffset(normalizeOrbitOffset(optionIndex - FRONT_CENTER_SLOT, options.length))'), "Clicking a face-up card must rotate that exact card to the single hero position.");
assert(selector.includes('const isCenter = Math.abs(signedSlots) <= 0.015'), "Only the exact front-center card may receive hero treatment.");
assert(selector.includes('const scale = isCenter ? 1 : 0.56 + (depth * 0.40)'), "Non-hero scale must come continuously from ring depth.");
assert(selector.includes('const opacity = isCenter ? 0.985 : 0.22 + (depth * 0.73)'), "Opacity must come continuously from ring depth so rear motion remains visible.");
assert(selector.includes('"--orbit-depth-z": "0px"'), "Flexible ring must avoid positive Z translation that softens Tarot artwork.");
assert(selector.includes('const maxWidth = count <= 4 ? 300'), "Small subclass catalogues must be allowed physically larger crisp Tarot cards.");
assert(selector.includes(': count <= 12 ? 258'), "Large subclass catalogues must reduce physical card width modestly instead of hiding cards.");
assert(!selector.includes('class-subclass-carousel-modal__ambient-smoke'), "Approved clean-table presentation must not render ambient purple smoke.");
assert(!selector.includes('class-subclass-carousel-modal__smoke-back'), "Approved clean-table presentation must not render rear purple smoke.");
assert(!selector.includes('class-subclass-carousel-modal__smoke-front'), "Approved clean-table presentation must not render foreground purple smoke.");
assert(!selector.includes('`Unlocks at level ${optionEntryLevel(option)}`'), "Tarot card faces must not render unlock-level pills over the artwork.");
assert(selector.includes('const inspectedOption = options.find((option) => option.key === inspectedKey) || null'), "Subclass dossier must belong only to an explicitly clicked card.");
assert(selector.includes('{inspectedOption ? ('), "Subclass dossier must stay out of the cinematic table composition until a card is explicitly inspected.");

const rotateBlock = selector.slice(selector.indexOf("function rotateCarousel"), selector.indexOf("function showInspectedDetails"));
const pointerDownBlock = selector.slice(selector.indexOf("function handleOrbitPointerDown"), selector.indexOf("function handleOrbitPointerMove"));
const pointerMoveBlock = selector.slice(selector.indexOf("function handleOrbitPointerMove"), selector.indexOf("function finishOrbitPointer"));
assert(!rotateBlock.includes('setInspectedKey("")'), "Arrow navigation must not clear an explicitly clicked subclass inspection target.");
assert(!pointerDownBlock.includes('setInspectedKey("")'), "Pointer-down must not clear an explicitly clicked subclass inspection target.");
assert(!pointerDownBlock.includes('setPointerCapture'), "Ordinary pointer-down must remain a click candidate instead of immediately becoming a captured drag.");
assert(pointerMoveBlock.includes('setPointerCapture?.(event.pointerId)'), "Pointer capture must begin only after the drag threshold is crossed.");
assert(!selector.includes('<small>Selected</small>'), "Tarot artwork must remain badge-free; selected state should use restrained border/glow treatment only.");

for (const token of [
  '/* 2026-09-20 canonical flexible-ring implementation.',
  'url("/media/forge/subclass-carousel/subclass-selector-cathedral-bg.png")',
  'url("/media/forge/subclass-carousel/subclass-selector-runic-table.png")',
  'width: min(1760px, 100vw) !important',
  'height: min(990px, 100vh) !important',
  'display: none !important',
  'width: clamp(var(--orbit-card-min), var(--orbit-card-vw), var(--orbit-card-max)) !important',
  'width: clamp(var(--orbit-hero-min), var(--orbit-hero-vw), var(--orbit-hero-max)) !important',
  'translate3d(-50%, -100%, var(--orbit-depth-z))',
  'transform-origin: 50% 100% !important',
  '.class-subclass-carousel-card.is-orbit-front .class-subclass-carousel-card__surface',
  '.class-subclass-carousel-card.is-orbit-back .class-subclass-carousel-card__surface',
  'transform: rotateY(180deg) !important',
  '.class-subclass-carousel-card::after',
  'filter: grayscale(.14) sepia(.11) saturate(.72) brightness(.92) contrast(1.06) !important',
  'filter: grayscale(.48) sepia(.34) saturate(.82) brightness(.88) contrast(1.12) !important',
  'will-change: auto',
  '.class-subclass-carousel-modal__orbit.is-dragging .class-subclass-carousel-card',
  'will-change: left, top, transform, opacity',
  'image-rendering: auto !important',
  '.class-subclass-carousel-card__face.is-back',
  '.class-subclass-carousel-card__back-rune',
  'backface-visibility: hidden',
  '.class-subclass-carousel-card.is-selected .class-subclass-carousel-card__face.is-front',
  '.class-subclass-carousel-card.is-inspected .class-subclass-carousel-card__face.is-front',
  '.class-subclass-carousel-modal__position,',
  '.class-subclass-carousel-modal__hint',
  'backdrop-filter: blur(8px) !important',
]) assert(tarotCss.includes(token), `Flexible table-ring presentation is missing ${token}`);

for (const oldMarker of [
  'approved-reference implementation: translate the chosen mock-up',
  'table-rim anchoring pass: cards stand on the table',
  'three-card table-depth refinement',
  'annotated-reference pass: five visual fronts',
]) assert(!tarotCss.includes(oldMarker), `Conflicting historical Tarot override remains active: ${oldMarker}`);

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
  'loopedOptions',
  'keepRailLooped',
  'rail.scrollWidth / 3',
  'scroll-snap-type:x mandatory',
]) assert(!selector.includes(forbidden), `Subclass selector regressed to an obsolete presentation: ${forbidden}`);

assert(!selector.includes("supabase"), "Subclass selector must remain presentation-only.");

for (const asset of [
  "public/media/forge/subclass-carousel/subclass-selector-cathedral-bg.png",
  "public/media/forge/subclass-carousel/subclass-selector-runic-table.png",
  "public/media/forge/subclass-carousel/subclass-selector-smoke-back.png",
  "public/media/forge/subclass-carousel/subclass-selector-smoke-front.png",
]) assert(fs.existsSync(path.join(root, asset)), `Runic subclass carousel UI asset missing ${asset}`);


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

console.log("Class subclass selector validation passed: canonical authority remains in the guide model, the runic table supports fractional drag/flick plus one-card arrows, carousel motion never persists a subclass, explicit card clicks remain the only selection path, high-resolution Tarot art avoids the old image-filter blur path, all 152 approved normalized concepts remain installed/mapped, and future content retains safe fallback.");
