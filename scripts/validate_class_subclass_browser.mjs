import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const guide = read("components/NpcForgeClassGuide.js");
const selector = read("components/ClassSubclassSection.js");
const presentation = read("utils/classes/classPresentation.js");
const framing = read("styles/character-forge-class-hero-framing.css");
const model = read("components/NpcForgeClassGuideModel.js");
const workspaceCss = read("styles/character-class-workspace.css");

for (const token of [
  'import ClassSubclassSection from "./ClassSubclassSection"',
  '<ClassSubclassSection',
  'onInspectSubclass={(option) => inspectSubclass(model, onFeatureDetail, option)}',
  '<p className="npc-forge-class-guide__hero-tagline">{classOverviewSummary(selectedClass)}</p>',
  'function selectedRowFeatures(model, row)',
  'feature?.type !== "subclass"',
  'model?.selected',
  'model?.preview?.key !== model.selected.key',
  'Selected subclass features join the table automatically.',
  'className={feature.type === "subclass" ? "is-subclass" : ""}',
]) assert(guide.includes(token), `Class guide is missing ${token}`);

assert(!guide.includes('<aside className="npc-forge-class-guide__dock-lane"'), "Overview still reserves an empty dock lane instead of giving the progression table full width.");
assert(!guide.includes("<ClassOverviewCopy selectedClass={selectedClass}"), "Expanded Class overview copy is duplicated below the hero facts.");
assert(!guide.includes("model.options.slice(0, 4)"), "Subclass catalogue must not collapse after four entries.");

for (const token of [
  'class-subclass-inline__grid',
  'onInspectSubclass',
  'model?.options || []',
  'model.setPreviewKey(option.key)',
  'model.selectSubclass(option)',
  'optionEntryLevel(option) > currentLevel',
  'aria-label="Subclass catalogue"',
  'is-locked',
  'is-selected',
  'Hover or focus any subclass to inspect it in the movable Feature card.',
  'grid-template-columns:repeat(6,minmax(0,1fr))',
]) assert(selector.includes(token), `Compact inline subclass selector is missing ${token}`);

for (const forbidden of [
  'browserOpen',
  'Search subclasses',
  'class-subclass-browser__search',
  'class-subclass-browser__sources',
  'class-subclass-card__details',
  'max-height:min(48vh,520px)',
]) assert(!selector.includes(forbidden), `Bulky subclass browser state returned: ${forbidden}`);
assert(!selector.includes("supabase"), "Subclass selector must remain presentation-only.");

assert(model.includes("resolveSubclassCatalog") && model.includes("const options = useMemo"), "Canonical subclass catalogue authority moved out of the existing guide model.");
assert(model.includes("selectSubclass"), "Existing subclass persistence authority disappeared from the guide model.");

for (const key of ["fighter", "wizard", "rogue", "cleric", "ranger", "paladin", "warlock"]) {
  assert(presentation.includes(`${key}:`), `Expanded core Class summary missing ${key}.`);
}
assert(presentation.includes("imported.length >= 180"), "Long imported/campaign Class summaries must remain authoritative.");

for (const token of [
  'bottom: auto !important',
  'left: 16% !important',
  'height: clamp(680px, 72vh, 820px) !important',
  'object-position: right top !important',
  'grid-template-columns: minmax(0, 1fr) !important',
]) assert(framing.includes(token), `Stable top-right cinematic framing missing ${token}`);
assert(!framing.includes('bottom: 0 !important;\n    left: 16% !important'), "Cinematic art is still content-height-coupled.");

for (const token of [
  '.class-level-guide__features button',
  'border-radius: 999px',
  '.class-level-guide__features button.is-subclass',
]) assert(workspaceCss.includes(token), `Profile-panel feature-pill reference contract missing ${token}`);
for (const token of [
  'border-radius:999px!important',
  'background:rgba(126,75,202,.14)!important',
  'button.is-subclass',
  'min-width:900px!important',
]) assert(guide.includes(token), `Forge progression table did not adopt the compact feature-pill treatment: ${token}`);

const protectedSource = `${guide}\n${selector}\n${presentation}\n${framing}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "mappageclient", "townsheet", "encounter_weapon_attack", "crafting_recipe"]) {
  assert(!protectedSource.includes(token), `Class presentation patch crossed protected boundary: ${token}`);
}

console.log("Class subclass selector validation passed: always-visible compact subclass choices, movable Feature-card inspection, selected-subclass progression injection, Profile-style feature pills, stable cinematic art, and protected boundaries are intact.");
