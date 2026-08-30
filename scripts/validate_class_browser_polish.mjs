import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const step = read("components/NpcForgeStepContent.js");
const catalog = read("components/NpcForgeClassCatalog.js");
const guide = read("components/NpcForgeClassGuide.js");
const dock = read("components/NpcForgeClassFeatureDock.js");
const artwork = read("utils/classes/classArtwork.js");
const presentation = read("utils/classes/classPresentation.js");
const catalogWrapper = read("utils/npcForgeCatalog.js");
const polish = read("styles/character-forge-browser-review-polish.css");

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
  "min-height:46px!important",
  "width:32px;height:36px",
  "white-space:nowrap;text-overflow:ellipsis",
]) assert(catalog.includes(token), `Compact Class catalogue/browser cleanup is missing ${token}`);
assert(!catalog.includes('className="npc-forge-catalog-head"'), "Redundant player-facing Classes/count heading returned to the Class catalogue.");

for (const token of [
  'import { useEffect, useRef, useState } from "react"',
  "const [collapsed, setCollapsed] = useState(true)",
  "const [floatingPosition, setFloatingPosition] = useState(null)",
  "boundedDockPosition",
  "setPointerCapture",
  "releasePointerCapture",
  "handleDragStart",
  "handleDragMove",
  "handleDragEnd",
  'aria-expanded={!collapsed}',
  'className="npc-forge-class-feature-dock__body" hidden={collapsed}',
  "npc-forge-class-feature-dock.is-floating",
  "position:fixed!important",
  "max-height:min(62dvh",
  "npc-forge-class-feature-dock.is-floating.is-collapsed",
  "position:static!important",
]) assert(dock.includes(token), `Floating/collapsible Class description window is missing ${token}`);
assert(dock.includes("event.target?.closest?.(\"button,a,input,select,textarea,summary\")"), "Class dock drag handle must not steal pointer interaction from controls.");
assert(dock.includes("window.addEventListener(\"resize\", keepDockVisible)"), "Floating Class description window must stay recoverable after viewport resize.");

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
  "classMagicPresentation",
  "classPresentationSummary",
  "classPrimaryAbilities",
  '"Primary Ability"',
  '"Power System"',
]) assert(guide.includes(token), `Class guide presentation is missing ${token}`);
assert(dock.includes("classPresentationSummary(selectedClass)"), "Floating Class feature dock must keep the richer selected-Class overview copy.");

// Older browser-polish rules may still describe the original in-flow fallback.
// The component-level .is-floating selector is intentionally more specific and
// owns the desktop floating state; mobile retains the in-flow fallback.
assert(polish.includes("npc-forge-step-2"), "Class browser polish scope disappeared.");

const protectedSources = `${step}\n${catalog}\n${guide}\n${dock}\n${artwork}\n${presentation}\n${catalogWrapper}\n${polish}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "mappageclient", "townsheet", "world travel"]) {
  assert(!protectedSources.includes(token), `Class browser patch unexpectedly references protected map/town behavior: ${token}`);
}

console.log("Class browser polish validation passed: compact multi-row catalogue, redundant player-facing headings removed, floating/collapsible recoverable feature details, nested Sidekick catalogue, unique special-Class portraits, Mystic Intelligence normalization, and protected map/town boundaries are intact.");
