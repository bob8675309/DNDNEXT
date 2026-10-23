import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const { EMPTY_SOURCE_CHOICE_STATE, normalizeSourceChoiceState } = await import(pathToFileURL(path.join(root, "components/NpcForgeSourceChoiceContext.js")).href);
const { applyDirectSourceChoiceSelection } = await import(pathToFileURL(path.join(root, "utils/directSourceChoiceState.js")).href);
const key = "heritage-trait:creature-cover|GRIMHOLLOWPG24";
const group = {
  id: "heritage-lifecycle-1", ownerType: "species", ownerKey: "wechselkind",
  label: "Heritage Traits", placement: "species", source: "GrimHollowPG24",
  fields: [{ id: "pick-1", label: "Heritage pick 1", kind: "heritage-trait", count: 1, required: true,
    options: [{ key, value: "Creature Cover", label: "Creature Cover", source: "GrimHollowPG24" }] }],
};
let state = normalizeSourceChoiceState([group], true, EMPTY_SOURCE_CHOICE_STATE, "species-extra");
state = applyDirectSourceChoiceSelection(state, group, "pick-1", [key]);
assert.deepEqual(state.selections[group.id]["pick-1"], [key], "Direct Heritage choice was not saved");
state = normalizeSourceChoiceState([], false, state, "species-extra");
assert.deepEqual(state.selections[group.id]["pick-1"], [key], "Switching tabs must not erase choices belonging to a dormant group");
state = normalizeSourceChoiceState([{ ...group, fields: [{ ...group.fields[0], options: [] }] }], false, state, "species-extra");
assert.deepEqual(state.selections[group.id]["pick-1"], [key], "A pending catalogue must not wipe existing source picks");
state = normalizeSourceChoiceState([group], true, state, "species-extra");
assert.deepEqual(state.selections[group.id]["pick-1"], [key], "Resuming the Species tab must restore the chosen Heritage Trait");

const adapter = read("components/NewNpcModalV3.js");
const controller = read("components/useNpcForgeController.js");
const review = read("components/NpcForgeReviewPanel.js");
const spells = read("components/NpcForgeSpellStep.js");
const dock = read("components/NpcForgeClassFeatureDock.js");
const browserCss = read("styles/character-forge-class-final-browser-fix.css");
const sourceRule = read("components/SourceRuleContent.js");
const featureText = read("components/ClassFeatureText.js");
for (const [label, source, tokens] of [
  ["subclass restore", adapter, ["!catalogReady && !validOptions.length", "previous.selectedKey", "featureCatalogReady: false"]],
  ["Echoing Soul runtime", adapter, ["echoingSoulLanguageGrant", "!echoingSoulLanguageGrant(entry)", "alreadyKnown.has(normalizedLanguage(entry.value))"]],
  ["draft lifecycle", controller, ["if (!playerMode) resetForm()", "Keep the completed player draft"]],
  ["source-aware review", review, ['title="Species & Heritage"', "featSkillChoices", "All trained skills", "speciesFlavorLore"]],
  ["spell reference", spells, ["showSpellReference", "onReferenceDetail={showSpellReference}"]],
  ["popup visibility", dock, ['min-width: 540px', 'is-rule-reference']],
  ["heritage gate", controller, ['heritagePickCount', 'heritageTraitGroup', 'Choose all ${required} Heritage Traits']],
  ["reference link spacing", sourceRule, ['["action", "condition", "quickref", "rule"]', 'nodes.push(" ")']],
  ["benefit disclosure", featureText, ["sourceBenefitList", 'class-feature-text__benefits', "<summary>Available benefits ("]],
]) for (const token of tokens) assert(source.includes(token), label + " missing " + token);
assert(browserCss.includes(".is-viewport-floating:not(.is-rule-reference)"), "Non-Class rules-reference windows must stay visible.");
assert(!review.includes("<dt>Background choices</dt>"), "Instructional background choices must not pollute final review");

const parser = (await import("@babel/parser")).parse;
for (const file of [
  "components/NewNpcModalV3.js", "components/useNpcForgeController.js",
  "components/NpcForgeReviewPanel.js", "components/NpcForgeSpellStep.js",
  "components/NpcForgeClassFeatureDock.js", "components/ClassFeatureText.js"
]) {
  parser(read(file), { sourceType: "module", plugins: ["jsx"] });
  console.log("JSX validated:", file);
}
console.log("Character Forge draft/feat/review/reference regression passed.");
