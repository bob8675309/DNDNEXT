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
  'import { useEffect, useMemo, useState } from "react"',
  'subclassArtworkFor(classKey, option)',
  'handleSubclassArtworkError(event, classKey)',
  'class-subclass-two-column__grid',
  'grid-template-columns:repeat(2,minmax(0,1fr))',
  'class-subclass-two-column__scroll',
  'max-height:min(22vh,164px)',
  'class-subclass-selected-row',
  '>Change<',
  'aria-label="Collapse subclass selector"',
  'model.setPreviewKey(option.key)',
  'model.selectSubclass(option)',
  'optionEntryLevel(option) > currentLevel',
  'aria-label="Subclass catalogue"',
  'onInspectSubclass?.(option)',
]) assert(selector.includes(token), `Compact two-column subclass selector is missing ${token}`);

for (const forbidden of [
  'onMouseEnter',
  'onFocus={() => onInspectSubclass',
  'Search subclasses',
  'class-subclass-browser__search',
  'class-subclass-browser__sources',
  'grid-template-columns:repeat(6,minmax(0,1fr))',
  'max-height:min(28vh,245px)',
]) assert(!selector.includes(forbidden), `Subclass selector regressed to the prior bulky/hover-driven presentation: ${forbidden}`);
assert(!selector.includes("supabase"), "Subclass selector must remain presentation-only.");

for (const token of [
  'const WIZARD_SUBCLASS_ART_FAMILY',
  'evocation: "evocation"',
  'abjuration: "abjuration"',
  'necromancy: "necromancy"',
  'return classMenuArtworkFor(normalizedClass)',
]) assert(subclassArtwork.includes(token), `Subclass artwork authority is missing ${token}`);
for (const family of ["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"]) {
  assert(fs.existsSync(path.join(root, `public/media/subclasses/wizard/wizard-${family}.webp`)), `Wizard subclass selector artwork missing ${family}.`);
}

assert(model.includes("resolveSubclassCatalog") && model.includes("const options = useMemo"), "Canonical subclass catalogue authority moved out of the existing guide model.");
assert(model.includes("selectSubclass"), "Existing subclass persistence authority disappeared from the guide model.");

for (const key of ["fighter", "wizard", "rogue", "cleric", "ranger", "paladin", "warlock"]) {
  assert(presentation.includes(`${key}:`), `Expanded core Class summary missing ${key}.`);
}
assert(presentation.includes("imported.length >= 180"), "Long imported/campaign Class summaries must remain authoritative.");

for (const token of [
  'bottom: auto !important',
  'left: 20% !important',
  'height: clamp(760px, 80vh, 940px) !important',
  'object-position: 100% 0% !important',
  'grid-template-columns: minmax(0, 1fr) !important',
]) assert(framing.includes(token), `Stable higher top-right cinematic framing missing ${token}`);
assert(!framing.includes('bottom: 0 !important;\n    left: 20% !important'), "Cinematic art is still content-height-coupled.");

for (const token of [
  '.class-level-guide__features button',
  'border-radius: 999px',
  '.class-level-guide__features button.is-subclass',
]) assert(workspaceCss.includes(token), `Profile-panel feature-pill reference contract missing ${token}`);
for (const token of [
  'border-radius:999px!important',
  'background:rgba(126,75,202,.14)!important',
  'button.is-subclass',
  'min-width:1060px!important',
  'repeat(9,minmax(36px,.34fr))',
  'min-height:39px!important',
  'padding:.18rem .4rem!important',
]) assert(guide.includes(token), `Forge progression table did not retain the compact feature-pill/spell-slot treatment: ${token}`);

const protectedSource = `${guide}\n${selector}\n${subclassArtwork}\n${presentation}\n${framing}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "mappageclient", "townsheet", "encounter_weapon_attack", "crafting_recipe"]) {
  assert(!protectedSource.includes(token), `Class presentation patch crossed protected boundary: ${token}`);
}

console.log("Class subclass selector validation passed: mockup-style compact two-column choices with artwork, click-only Feature-card inspection, selected-subclass progression injection, tighter spell-slot table, stable cinematic art, safe artwork fallback, and protected boundaries are intact.");
