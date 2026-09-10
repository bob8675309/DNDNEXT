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
  'grid-auto-rows:52px',
  'class-subclass-two-column__scroll',
  'max-height:166px',
  'width:min(35%,430px)',
  'grid-template-columns:76px minmax(0,1fr)',
  'min-height:52px',
  'class-subclass-selected-row',
  '>Change<',
  'aria-label="Collapse subclass selector"',
  'model.setPreviewKey(option.key)',
  'model.selectSubclass(option)',
  'optionEntryLevel(option) > currentLevel',
  'aria-label="Subclass catalogue"',
  'onInspectSubclass?.(option)',
]) assert(selector.includes(token), `Readable two-column subclass selector is missing ${token}`);

for (const forbidden of [
  'class-subclass-two-column__source',
  'class-subclass-two-column__status',
  'optionSummary(option)',
  'onMouseEnter',
  'onFocus={() => onInspectSubclass',
  'Search subclasses',
  'class-subclass-browser__search',
  'class-subclass-browser__sources',
  'grid-template-columns:repeat(6,minmax(0,1fr))',
]) assert(!selector.includes(forbidden), `Subclass selector regressed to the prior bulky/hover-driven presentation: ${forbidden}`);
assert(!selector.includes("supabase"), "Subclass selector must remain presentation-only.");

const exactWizardSubclassArt = ["abjuration", "abjurer", "bladesinger", "bladesinging", "chronurgy", "conjuration", "divination", "diviner", "enchantment", "evocation", "evoker", "graviturgy", "illusion", "illusionist", "necromancy", "scribes", "transmutation", "war"];
for (const subclass of exactWizardSubclassArt) {
  assert(subclassArtwork.includes(`${subclass}: "${subclass}"`), `Wizard subclass artwork resolver is not one-to-one for ${subclass}.`);
  assert(fs.existsSync(path.join(root, `public/media/subclasses/wizard/wizard-${subclass}.webp`)), `Wizard subclass selector artwork missing ${subclass}.`);
}
const wizardSubclassArtBytes = new Set(exactWizardSubclassArt.map((subclass) => fs.readFileSync(path.join(root, `public/media/subclasses/wizard/wizard-${subclass}.webp`)).toString("base64")));
assert(wizardSubclassArtBytes.size === exactWizardSubclassArt.length, "Every canonical Wizard subclass must use a distinct artwork file.");

const approvedSubclassFamilies = Object.freeze({
  artificer: ["alchemist", "armorer", "artillerist", "battle-smith", "cartographer", "reanimator"],
  barbarian: ["ancestral-guardian", "berserker", "giant", "totem-warrior", "wild-magic", "zealot"],
  bard: ["creation", "glamour", "lore", "swords", "valor", "whispers"],
  cleric: ["knowledge", "life", "light", "tempest", "trickery", "war"],
  druid: ["land", "moon", "shepherd", "spores", "stars", "wildfire"],
  fighter: ["arcane-archer", "banneret", "battle-master", "cavalier", "champion", "echo-knight"],
  monk: ["astral-self", "drunken-master", "elements", "kensei", "open-hand", "shadow"],
  "monster-hunter": ["carver", "devourer", "occultist", "trapper"],
  mystic: ["avatar", "awakened", "immortal", "nomad", "soul-knife", "wu-jen"],
  paladin: ["ancients", "conquest", "crown", "devotion", "glory", "noble-genies"],
  ranger: ["beast-master", "drakewarden", "fey-wanderer", "gloom-stalker", "horizon-walker", "hunter"],
  rogue: ["arcane-trickster", "assassin", "phantom", "soulknife", "swashbuckler", "thief"],
  sorcerer: ["aberrant", "clockwork", "divine-soul", "draconic", "shadow", "wild-magic"],
  warlock: ["archfey", "celestial", "fiend", "great-old-one", "hexblade", "undead"],
});

for (const [classKey, families] of Object.entries(approvedSubclassFamilies)) {
  for (const family of families) {
    assert(subclassArtwork.includes(`\"${family}\"`) || subclassArtwork.includes(`${family}:`), `${classKey} subclass artwork resolver is missing ${family}.`);
    const file = path.join(root, `public/media/subclasses/${classKey}/${classKey}-${family}.webp`);
    assert(fs.existsSync(file), `Approved ${classKey} subclass selector artwork missing ${family}.`);
    assert(fs.statSync(file).size > 0, `Approved ${classKey} subclass selector artwork is empty: ${family}.`);
  }
}

for (const token of [
  'const WIZARD_SUBCLASS_ART_FAMILY',
  'const APPROVED_SUBCLASS_ART_FAMILIES',
  'function approvedSubclassArtworkFor',
  'evocation: "evocation"',
  'abjuration: "abjuration"',
  'necromancy: "necromancy"',
  '"aberrant-mind": "aberrant"',
  '"clockwork-soul": "clockwork"',
  'wild: "wild-magic"',
  '"purple-dragon-knight-banneret": "banneret"',
  '"four-elements": "elements"',
  '|| classMenuArtworkFor(normalizedClass)',
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

console.log("Class subclass selector validation passed: Wizard plus all currently approved Artificer, Barbarian, Bard, Cleric, Druid, Fighter, Monk, Monster Hunter, Mystic, Paladin, Ranger, Rogue, Sorcerer, and Warlock selector artwork batches use dedicated assets; readable two-column choices, click-only Feature-card inspection, selected-subclass progression injection, balanced spell-slot table, stable cinematic art, safe artwork fallback, and protected boundaries are intact.");
