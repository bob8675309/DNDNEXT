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
  'const VISIBLE_CARD_CAP = 9',
  'const DRAG_THRESHOLD_PX = 6',
  'const FLICK_PROJECTION_MS = 180',
  'function normalizeOrbitOffset(value, total)',
  'function signedOrbitSlots(value, total)',
  'function orbitThetaDegrees(distance)',
  'if (d <= 1) return d * 28',
  'if (d <= 2) return 28 + ((d - 1) * 29)',
  'if (d <= 3) return 57 + ((d - 2) * 58)',
  'if (d <= 4) return 115 + ((d - 3) * 40)',
  'function orbitPlacement(optionIndex, orbitOffset, total)',
  'const visualSlotCount = Math.min(count, VISIBLE_CARD_CAP)',
  'const visibleRadius = Math.floor(visualSlotCount / 2)',
  'const isVisible = count <= VISIBLE_CARD_CAP || absoluteSlots <= visibleRadius + 0.18',
  'const faceUpRadius = 1',
  'const isFaceUp = count <= 3 || absoluteSlots <= faceUpRadius + 0.01',
  'const isCenter = absoluteSlots <= 0.015',
  'const isOpposite = count % 2 === 0 && Math.abs(absoluteSlots - (count / 2)) <= 0.015',
  'const thetaDegrees = isOpposite ? 180 : orbitThetaDegrees(absoluteSlots)',
  'const yawMagnitude = absoluteSlots <= 1',
  '? absoluteSlots * 22',
  '? 22 + ((absoluteSlots - 1) * 80)',
  'Math.min(180, Math.max(102, 104 + ((thetaDegrees - 90) * 0.76)))',
  'const horizontalRadius = 30.5',
  'const verticalCenter = 49.5',
  'const verticalRadius = 20.5',
  'const x = 50 + (direction * sine * horizontalRadius)',
  'const y = verticalCenter + (cosine * verticalRadius)',
  '? 0.965 - ((absoluteSlots - 1) * 0.30)',
  '? 0.665 - ((absoluteSlots - 2) * 0.10)',
  '? 0.965 - ((absoluteSlots - 1) * 0.58)',
  '? 0.385 - ((absoluteSlots - 2) * 0.10)',
  '"--orbit-opacity": (isVisible ? opacity : 0).toFixed(3)',
  '"--orbit-depth-z": `${isFaceUp ? 0 : Math.round(depth * 28)}px`',
  'const [orbitOffset, setOrbitOffset] = useState(0)',
  'const [isDragging, setIsDragging] = useState(false)',
  'const [inspectedKey, setInspectedKey] = useState("")',
  'const dragStateRef = useRef(null)',
  'const suppressClickUntilRef = useRef(0)',
  'const inspectedOption = options.find((option) => option.key === inspectedKey) || null',
  'function handleOrbitPointerDown(event)',
  'function handleOrbitPointerMove(event)',
  'function finishOrbitPointer(event, cancelled = false)',
  'function handleCardClick(event, option, isFront)',
  'event.currentTarget.setPointerCapture?.(event.pointerId)',
  'event.currentTarget.releasePointerCapture?.(event.pointerId)',
  'pixelsPerCardFor(bounds?.width, options.length)',
  'Math.round(drag.currentOffset + projectedCards)',
  'class-subclass-carousel-modal__orbit',
  'onPointerDown={handleOrbitPointerDown}',
  'onPointerMove={handleOrbitPointerMove}',
  'onPointerUp={(event) => finishOrbitPointer(event)}',
  'onPointerCancel={(event) => finishOrbitPointer(event, true)}',
  'class-subclass-carousel-card__surface',
  'width={840}',
  'height={1440}',
  'isCenter ? " is-orbit-center" : ""',
  'isFaceUp ? " is-orbit-face-up" : ""',
  'data-orbit-depth={depth.toFixed(3)}',
  'onClick={(event) => handleCardClick(event, option, isFront)}',
  'Only the three front cards can be chosen.',
  'model.setPreviewKey(option.key)',
  'model.selectSubclass(option)',
  'onClick={showInspectedDetails}',
  'if (optionEntryLevel(option) <= currentLevel)',
  'class-subclass-selected-card',
  'onDoubleClick={() => setSelectorOpen(true)}',
  '>Change Subclass<',
  'onInspectSubclass?.(option)',
]) assert(selector.includes(token), `Draggable runic subclass selector is missing ${token}`);

assert((selector.match(/model\.selectSubclass\(option\)/g) || []).length === 1, "Carousel motion must never persist a subclass; only the explicit card-choice path may call selectSubclass(option).");
assert(!selector.includes('model?.setPreviewKey?.(focusedOption.key)'), "Front-most carousel position must not auto-preview/persist as the player's subclass.");
assert(!selector.includes('const focusedOption = options[focusedIndex] || null'), "Legacy auto-focused front-card selection state is still present.");
assert(selector.includes('const visualSlotCount = Math.min(count, VISIBLE_CARD_CAP)'), "Visible Tarot cards must use a capped presentation ring while preserving the full subclass catalogue.");
assert(selector.includes('const visibleRadius = Math.floor(visualSlotCount / 2)'), "Visible Tarot ring must derive its cull radius from the visual slot cap.");
assert(selector.includes('const isVisible = count <= VISIBLE_CARD_CAP || absoluteSlots <= visibleRadius + 0.18'), "Tarot carousel must keep the full option list while limiting the painted ring to the approved visual window.");
assert(selector.includes('if (d <= 1) return d * 28'), "Inner Tarot pair must follow the approved relaxed table curve.");
assert(selector.includes('if (d <= 2) return 28 + ((d - 1) * 29)'), "Outer readable Tarot pair must spread farther along the table rim.");
assert(selector.includes('if (d <= 3) return 57 + ((d - 2) * 58)'), "Near rear cards must climb around the table instead of flattening into the foreground.");
assert(selector.includes('if (d <= 4) return 115 + ((d - 3) * 40)'), "Far rear cards must curl inward along the back of the ellipse.");
assert(selector.includes('const horizontalRadius = 30.5'), "Tarot card feet must follow the slightly tighter physical table rim.");
assert(selector.includes('const verticalCenter = 49.5'), "Readable Tarot cards must sit farther back on the tabletop instead of dominating the front lip.");
assert(selector.includes('const verticalRadius = 20.5'), "Tarot card feet must retain a front-low/rear-high ellipse while staying seated deeper on the table.");
assert(selector.includes('const isCenter = absoluteSlots <= 0.015'), "Only the centered Tarot card may receive the pop-out treatment.");
assert(selector.includes('const isOpposite = count % 2 === 0 && Math.abs(absoluteSlots - (count / 2)) <= 0.015'), "Even-card subclass sets must place their lone opposite card at the true rear-center slot.");

assert(selector.includes('const faceUpRadius = 1'), "Only the center and immediate left/right cards may remain readable on the front arc.");
assert(selector.includes('? absoluteSlots * 22'), "The readable side pair must bend modestly with the table rim.");
assert(selector.includes('? 22 + ((absoluteSlots - 1) * 80)'), "Cards leaving the readable three must turn smoothly rather than snapping into a rear-facing angle.");
assert(selector.includes('Math.min(180, Math.max(102, 104 + ((thetaDegrees - 90) * 0.76)))'), "Settled cards beyond the readable three must turn decisively into the rear deck.");
assert(selector.includes('? 0.965 - ((absoluteSlots - 1) * 0.30)'), "Card scale must interpolate smoothly between the readable front and the first rear slot.");
assert(selector.includes('? 0.965 - ((absoluteSlots - 1) * 0.58)'), "Card opacity must interpolate smoothly while a card moves around the table edge.");
assert(selector.includes('"--orbit-depth-z": `${isFaceUp ? 0 : Math.round(depth * 28)}px`'), "Readable Tarot faces must avoid positive Z-depth resampling.");
assert(!selector.includes('class-subclass-carousel-modal__ambient-smoke'), "Approved clean-table presentation must not render ambient purple smoke.");
assert(!selector.includes('class-subclass-carousel-modal__smoke-back'), "Approved clean-table presentation must not render rear purple smoke.");
assert(!selector.includes('class-subclass-carousel-modal__smoke-front'), "Approved clean-table presentation must not render foreground purple smoke.");
assert(!selector.includes('`Unlocks at level ${optionEntryLevel(option)}`'), "Tarot card faces must not render unlock-level pills over the artwork.");
assert(tarotCss.includes('width: clamp(188px, 14.6vw, 270px) !important'), "Foreground Tarot cards must stay large enough for crisp native art without overpowering the table.");
assert(tarotCss.includes('width: clamp(198px, 15.35vw, 284px) !important'), "Only the centered Tarot card may receive the restrained physical size bump.");
assert(tarotCss.includes('opacity: .955 !important'), "Front Tarot cards must retain the requested subtle translucency.");
assert(tarotCss.includes('display: none !important'), "Smoke-layer safety override must remain installed.");
assert(tarotCss.includes('opacity: .91'), "Runic table must remain clear and visually present after smoke removal.");
assert(tarotCss.includes('will-change: auto'), "Resting Tarot cards must not stay permanently promoted to compositor layers.");
const rotateBlock = selector.slice(selector.indexOf("function rotateCarousel"), selector.indexOf("function showInspectedDetails"));
const pointerDownBlock = selector.slice(selector.indexOf("function handleOrbitPointerDown"), selector.indexOf("function handleOrbitPointerMove"));
const pointerMoveBlock = selector.slice(selector.indexOf("function handleOrbitPointerMove"), selector.indexOf("function finishOrbitPointer"));
assert(!rotateBlock.includes('setInspectedKey("")'), "Arrow navigation must not clear an explicitly clicked subclass inspection target.");
assert(!pointerDownBlock.includes('setInspectedKey("")'), "Pointer-down must not clear an explicitly clicked subclass inspection target.");
assert(!pointerDownBlock.includes('setPointerCapture'), "Ordinary pointer-down must remain a click candidate instead of immediately becoming a captured drag.");
assert(pointerMoveBlock.includes('setPointerCapture?.(event.pointerId)'), "Pointer capture must begin only after the drag threshold is crossed.");
assert(selector.includes('selected && inspectedOption && selected.key === inspectedOption.key'), "Selected-note rendering must not treat two missing keys as a selected subclass.");
assert(!selector.includes('<small>Selected</small>'), "Approved Tarot artwork must remain badge-free; selected state should use border/glow treatment only.");
assert(selector.includes('const inspectedOption = options.find((option) => option.key === inspectedKey) || null'), "Subclass dossier must belong only to an explicitly clicked card, not the centered browse position.");
assert(!selector.includes('const browsedOption = options[browsedIndex] || null'), "Centered browse position must not masquerade as explicit subclass inspection.");
assert(selector.includes('{inspectedOption ? ('), "Subclass dossier must stay out of the cinematic table composition until a card is explicitly inspected.");


assert(tarotCss.includes('width: min(1760px, 100vw) !important'), "Approved subclass modal must use the near-fullscreen reference composition.");
assert(tarotCss.includes('height: min(990px, 100vh) !important'), "Approved subclass modal must preserve the cinematic reference height.");
assert(tarotCss.includes('top: 20% !important') && tarotCss.includes('bottom: 2.5% !important'), "Runic table must sit low and large in the approved composition.");
assert(tarotCss.includes('top: 19.5% !important') && tarotCss.includes('bottom: 13% !important'), "Tarot orbit must align vertically to the table rim in the approved composition.");
assert(tarotCss.includes('left: 24% !important') && tarotCss.includes('right: 24% !important'), "Subclass dossier must use the compact centered reference width.");
assert(tarotCss.includes('.class-subclass-carousel-modal__position,\n.class-subclass-carousel-modal__hint {\n  display: none !important;'), "Legacy counter/hint text must not clutter the approved visual composition.");
assert(tarotCss.includes('.class-subclass-carousel-card__copy {\n  display: none !important;'), "Tarot card artwork must remain free of pill overlays.");
assert(tarotCss.includes('translate3d(-50%, -100%, var(--orbit-depth-z))'), "Tarot cards must be bottom-center anchored so their feet trace the table rim.");
assert(tarotCss.includes('transform-origin: 50% 100% !important'), "Tarot scaling and yaw must remain planted at the card base.");
assert(tarotCss.includes('filter: saturate(.55) contrast(1.08) brightness(.88) sepia(.08) !important'), "Cathedral stage must keep the more restrained less-purple reference grade.");
assert(tarotCss.includes('filter: saturate(.38) brightness(.84) contrast(1.15) sepia(.16) !important'), "Runic table must stay dark, physical, and gold-biased instead of neon-purple.");
assert(tarotCss.includes('mix-blend-mode: multiply'), "Runic table must retain the dark physical-surface overlay.");
assert(tarotCss.includes('width: clamp(198px, 15.35vw, 284px) !important'), "Center card must use only a restrained size increase over its neighbors.");
assert(tarotCss.includes('white-space: nowrap'), "Desktop subclass heading should remain on one line like the approved reference.");
assert(tarotCss.includes('translate3d(-50%, -100%, var(--orbit-depth-z))'), "Center card must remain seated on the same table-foot anchor as its neighbors.");





for (const token of [
  'url("/media/forge/subclass-carousel/subclass-selector-cathedral-bg.png")',
  'url("/media/forge/subclass-carousel/subclass-selector-runic-table.png")',
  '.class-subclass-carousel-modal__orbit.is-dragging',
  'touch-action: none',
  'cursor: grab',
  '.class-subclass-carousel-card__surface',
  'translate3d(-50%, -100%, var(--orbit-depth-z))',
  'rotateY(var(--orbit-yaw))',
  'width: clamp(188px, 14.6vw, 270px) !important',
  'opacity: .955 !important',
  'will-change: auto',
  '.class-subclass-carousel-modal__orbit.is-dragging .class-subclass-carousel-card',
  'will-change: left, top, transform, opacity',
  '.class-subclass-carousel-card.is-orbit-front .class-subclass-carousel-card__face.is-front',
  'transform: none !important',
  '.class-subclass-carousel-card.is-orbit-hidden',
  'filter: none !important',
  'image-rendering: auto !important',
  '.class-subclass-carousel-card__face.is-back',
  '.class-subclass-carousel-card__back-rune',
  'backface-visibility: hidden',
  '.class-subclass-carousel-card.is-selected .class-subclass-carousel-card__face.is-front',
  '.class-subclass-carousel-card.is-inspected .class-subclass-carousel-card__face.is-front',
  'backdrop-filter: blur(12px)',
]) assert(tarotCss.includes(token), `Draggable/crisp subclass carousel presentation is missing ${token}`);

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
