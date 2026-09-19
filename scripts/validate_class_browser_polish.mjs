import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

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
  'import { useEffect, useMemo, useRef, useState } from "react"',
  'import { createPortal } from "react-dom"',
  "subclassArtworkFor(classKey, option)",
  "function orbitPlacement(optionIndex, orbitOffset, total)",
  "const [orbitOffset, setOrbitOffset] = useState(0)",
  "const inspectedOption = options.find((option) => option.key === inspectedKey) || null",
  '"Click any of the three front cards to inspect that path. Dragging the carousel will not change your choice."',
  '<h4>{inspectedOption?.name || "Choose a card"}</h4>',
  "function handleOrbitPointerDown(event)",
  "function handleOrbitPointerMove(event)",
  "function finishOrbitPointer(event, cancelled = false)",
  "function handleCardClick(event, option, isFront)",
  "onPointerDown={handleOrbitPointerDown}",
  "onPointerMove={handleOrbitPointerMove}",
  "onPointerUp={(event) => finishOrbitPointer(event)}",
  "onClick={(event) => handleCardClick(event, option, isFront)}",
  "class-subclass-carousel-card__surface",
  "class-subclass-carousel-card__face is-front",
  "class-subclass-carousel-card__face is-back",
  "class-subclass-carousel-modal__details",
  "model.selectSubclass(option)",
  "model?.setPreviewKey?.(option.key)",
  "onClick={showInspectedDetails}",
  "class-subclass-selected-card",
  ">Change Subclass<",
  "onDoubleClick={() => setSelectorOpen(true)}",
]) assert(selector.includes(token), `Draggable runic subclass selector is missing ${token}`);

assert((selector.match(/model\.selectSubclass\(option\)/g) || []).length === 1, "Carousel motion must not create a second subclass-selection authority.");
assert(!selector.includes('model?.setPreviewKey?.(focusedOption.key)'), "Front-most carousel position must not auto-select or auto-preview as player intent.");

for (const forbidden of [
  "class-subclass-two-column__grid",
  "class-subclass-two-column__scroll",
  "class-subclass-selected-row",
  "onMouseEnter",
  "Search subclasses",
  "browserOpen",
  "class-subclass-browser__search",
  "class-subclass-browser__sources",
  "const [visibleCount, setVisibleCount] = useState(4)",
  "const visibleOptions = useMemo",
  "loopedOptions",
  "keepRailLooped",
  "rail.scrollWidth / 3",
]) assert(!selector.includes(forbidden), `Subclass selector regressed to a prior flat/hover/rubberband presentation: ${forbidden}`);
assert(!selector.includes("supabase"), "Subclass selector must remain presentation-only.");

for (const token of [
  "const APPROVED_SUBCLASS_ART_FAMILIES",
  "function approvedSubclassArtworkFor",
  "/media/subclasses/${normalizedClass}/${normalizedClass}-${family}.webp",
  "function fallbackSubclassArtworkFor",
  "return classMenuArtworkFor(normalizedClass)",
  "return approvedSubclassArtworkFor(normalizedClass, normalizedSubclass)",
]) assert(subclassArtwork.includes(token), `Subclass artwork resolver missing ${token}`);
for (const family of ["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"]) {
  assert(fs.existsSync(path.join(root, `public/media/subclasses/wizard/wizard-${family}.webp`)), `Wizard subclass selector artwork missing ${family}.`);
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

const protectedSources = `${step}\n${catalog}\n${guide}\n${selector}\n${guideStyles}\n${dock}\n${artwork}\n${subclassArtwork}\n${presentation}\n${catalogWrapper}\n${polish}\n${framing}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "mappageclient", "townsheet", "world travel", "crafting_recipe"]) {
  assert(!protectedSources.includes(token), `Class browser patch unexpectedly references protected behavior: ${token}`);
}

console.log("Class browser polish validation passed: draggable runic Tarot browsing and explicit click selection are separated, Feature-card details remain click-owned, subclass progression bubbles/spell slots remain intact, Class authority stays preserved, and protected boundaries are unchanged.");
