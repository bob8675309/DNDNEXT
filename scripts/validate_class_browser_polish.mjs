import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const step = read("components/NpcForgeStepContent.js");
const catalog = read("components/NpcForgeClassCatalog.js");
const guide = read("components/NpcForgeClassGuide.js");
const subclassSelector = read("components/ClassSubclassSection.js");
const guideStyles = read("components/NpcForgeClassGuideStyles.js");
const dock = read("components/NpcForgeClassFeatureDock.js");
const artwork = read("utils/classes/classArtwork.js");
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
  "NpcForgeClassCatalog",
  "ClassChoiceRow",
]) assert(catalog.includes(token), `Sidekick Class catalogue grouping is missing ${token}`);
assert(catalog.includes("onClick={() => setSidekicksOpen"), "Sidekick parent must expand/collapse rather than select a synthetic class.");
assert(catalog.includes("onSelect?.(row)"), "Real Sidekick child rows must keep the existing class-selection callback.");

for (const token of [
  'aria-label={`Search ${rows.length} classes`}',
  "grid-template-rows:auto minmax(390px,1fr) 0",
  "npc-forge-section-heading{display:none!important}",
  "min-height:57px!important",
  "width:41px;height:47px",
  "-webkit-line-clamp:2",
]) assert(catalog.includes(token), `Mockup-aligned Class catalogue cleanup is missing ${token}`);
assert(!catalog.includes('className="npc-forge-catalog-head"'), "Redundant player-facing Classes/count heading returned to the Class catalogue.");

for (const token of [
  'import { useEffect, useRef, useState } from "react"',
  'import { createPortal } from "react-dom"',
  'const [closedDetailKey, setClosedDetailKey] = useState("")',
  "const [floatingPosition, setFloatingPosition] = useState(null)",
  "const [portalHost, setPortalHost] = useState(null)",
  "currentDetailKey",
  "const dismissed = closedDetailKey === currentDetailKey",
  "boundedDockPosition",
  "defaultDockPosition",
  'document.querySelector(".npc-forge-class-guide__dock-lane")',
  'window.matchMedia("(min-width: 901px)")',
  "setPortalHost(document.body)",
  "createPortal(dock, portalHost)",
  "is-viewport-floating",
  "setPointerCapture",
  "releasePointerCapture",
  "handleDragStart",
  "handleDragMove",
  "handleDragEnd",
  "setClosedDetailKey(currentDetailKey)",
  'aria-label="Close class feature details"',
  'className="npc-forge-class-feature-dock__body"',
  "if (dismissed) return null",
  "position:fixed!important",
  "max-height:min(72dvh",
  "position:sticky",
]) assert(dock.includes(token), `Viewport-owned/dismissible Class description window is missing ${token}`);
assert(!dock.includes("setCollapsed"), "Closing the Class detail window must dismiss it completely rather than collapse it into a persistent header bar.");
assert(!dock.includes("hidden={collapsed}"), "Dismissed Class detail content must not leave a hidden-body header shell onscreen.");
assert(dock.includes("event.target?.closest?.(\"button,a,input,select,textarea,summary\")"), "Class dock drag handle must not steal pointer interaction from controls.");
assert(dock.includes("window.addEventListener(\"resize\", keepDockVisible)"), "Floating Class description window must stay recoverable after viewport resize.");
assert(dock.includes("npc-forge-step-class") && dock.includes("radial-gradient(circle at 76% 16%"), "Scoped Class-tab visual refresh is missing.");
assert(dock.includes("font-size:.72rem!important;line-height:1.58!important"), "Class feature window summary typography regressed to the tiny browser-review size.");

for (const token of [
  "classThemeKey",
  "is-class-${theme}",
  "classOverviewSummary(selectedClass)",
  "npc-forge-class-guide__hero-art",
  "npc-forge-class-guide__overview-layout",
  "npc-forge-class-guide__overview-main",
  "ClassSubclassSection",
  "onInspectSubclass",
  "model={model}",
  "inspectSubclass(model, onFeatureDetail, option)",
  "ForgeSubclassSelection",
  "Deferred resolutions",
  "Choices for tools, feats, skills, spells, and other options",
  "Tools, skills, feats, fighting styles, maneuvers, invocations",
  "npc-forge-class-guide__section-title",
  "npc-forge-class-guide__table-footnote",
  'aria-label={`View ${feature.name} details`}',
  "selectedRowFeatures",
  "model.selected",
  "Selected subclass features join the table automatically",
]) assert(guide.includes(token), `Mockup-aligned Class presentation is missing ${token}`);
assert(!guide.includes('<aside className="npc-forge-class-guide__dock-lane"'), "Class overview still wastes width on an in-flow dock lane even though the Feature card is viewport-owned.");
assert(!guide.includes("model.options.slice(0, 4)"), "Subclass catalogue must no longer collapse after four entries.");
assert(!guide.includes("<select value={model.preview?.key"), "Subclass selection must use visible compact buttons instead of the old dropdown selector.");
assert(!guide.includes("title={cleanPlayerCopy(feature.description)}"), "Native browser feature tooltips must not compete with the movable detail card.");

for (const token of [
  "class-subclass-inline__grid",
  "model.selectSubclass(option)",
  "model.setPreviewKey(option.key)",
  'aria-label="Subclass catalogue"',
  "onInspectSubclass",
  "is-locked",
  "is-selected",
  "grid-template-columns:repeat(6,minmax(0,1fr))",
]) assert(subclassSelector.includes(token), `Compact always-visible subclass selector is missing ${token}`);
for (const forbidden of ["Browse Subclasses", "Search subclasses", "browserOpen", "class-subclass-browser__search", "class-subclass-browser__sources"]) {
  assert(!subclassSelector.includes(forbidden), `Bulky subclass browser returned: ${forbidden}`);
}
assert(!subclassSelector.includes("supabase"), "Subclass selector must remain presentation-only.");

for (const token of [
  ".npc-forge-class-guide.is-class-artificer",
  "grid-template-columns:minmax(0,1fr) minmax(300px,34%)",
  "grid-template-columns:repeat(5,minmax(0,1fr))",
  "body .npc-forge-class-feature-dock::after",
  "body .npc-forge-class-feature-dock__title-group",
  "object-position:center 25%",
  "Class Progression",
]) assert(`${guideStyles}\n${guide}`.includes(token), `Approved Class visual foundation is missing ${token}`);

for (const token of [
  "grid-template-columns:minmax(0,1fr)!important",
  "min-width:900px!important",
  "border-radius:999px!important",
  "button.is-subclass",
]) assert(guide.includes(token), `Profile-style expanded progression presentation is missing ${token}`);

for (const token of [
  "bottom: auto !important",
  "left: 16% !important",
  "height: clamp(680px, 72vh, 820px) !important",
  "object-position: right top !important",
]) assert(framing.includes(token), `Stable cinematic Class art is missing ${token}`);

assert(artwork.includes('artificer: "/media/classes/artificer-approved.webp"'), "Approved Artificer Forge artwork mapping is missing.");
assert(fs.existsSync(path.join(root, "public/media/classes/artificer-approved.webp")), "Approved Artificer Forge artwork asset is missing from public/media/classes.");

const specialArtwork = {
  civilian: "/media/species/human.webp",
  "monster-hunter": "/media/species/human-innistrad.webp",
  mystic: "/media/species/kalashtar.webp",
  "expert-sidekick": "/media/species/changeling.webp",
  "warrior-sidekick": "/media/species/human-zendikar.webp",
  "spellcaster-sidekick": "/media/species/half-elf.webp",
  sidekick: "/media/species/human-kaladesh.webp",
};
for (const [key, image] of Object.entries(specialArtwork)) {
  assert(artwork.includes(`\"${key}\": \"${image}\"`) || artwork.includes(`${key}: \"${image}\"`), `Class artwork mapping missing ${key} → ${image}`);
}
assert(new Set(Object.values(specialArtwork)).size === Object.keys(specialArtwork).length, "Special/non-core Class portraits must be unique rather than aliases of one another.");
assert(!artwork.includes('"monster-hunter": "ranger"') && !artwork.includes('"expert-sidekick": "rogue"'), "Special classes must not reuse core Class portraits.");

for (const token of [
  '"monster-hunter"',
  "Monster Grimoire",
  "Studied Response",
  "Carver, Devourer, Occultist, or Trapper Guild",
  "mystic:",
  "psi points",
  "Avatar, Awakened, Immortal, Nomad, Soul Knife, or Wu Jen",
  '"expert-sidekick"',
  '"warrior-sidekick"',
  '"spellcaster-sidekick"',
  'if (keyFor(classRow) === "mystic") return ["int"]',
  'if (key === "mystic") return "Psionics • Intelligence"',
]) assert(presentation.includes(token), `Special Class presentation is missing ${token}`);

for (const token of [
  "mergePreferredClasses as refinedMergePreferredClasses",
  "classPresentationSummary",
  "classPrimaryAbilities",
  "export function mergePreferredClasses",
  "refinedMergePreferredClasses(rows).map(presentClass)",
  "primary_abilities: primaryAbilities.length ? primaryAbilities",
]) assert(catalogWrapper.includes(token), `Forge class normalization is missing ${token}`);

for (const token of [
  "classPresentationSummary",
  "classPrimaryAbilities",
  '"Primary Ability"',
  '"Saving Throws"',
  '"Hit Die"',
]) assert(guide.includes(token), `Class guide presentation is missing ${token}`);
assert(!guide.includes('"Power System"'), "Class hero should not restore the redundant Power System fact card.");
assert(!guide.includes('"Starting Level"'), "Class hero should not restore the redundant Starting Level fact card.");
assert(dock.includes("classPresentationSummary(selectedClass)"), "Floating Class feature dock must keep the selected-Class overview copy authority.");
assert(polish.includes("npc-forge-step-2"), "Class browser polish scope disappeared.");

const protectedSources = `${step}\n${catalog}\n${guide}\n${subclassSelector}\n${guideStyles}\n${dock}\n${artwork}\n${presentation}\n${catalogWrapper}\n${polish}\n${framing}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "mappageclient", "townsheet", "world travel"]) {
  assert(!protectedSources.includes(token), `Class browser patch unexpectedly references protected map/town behavior: ${token}`);
}

console.log("Class browser polish validation passed: compact always-visible subclass selection, movable Feature-card inspection, selected-subclass progression bubbles, stable top-right artwork, full-width progression, viewport-owned details, Sidekick grouping, special Class presentation, and protected boundaries are intact.");
