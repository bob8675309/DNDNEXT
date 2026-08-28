import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const { backgroundFeatureDetails, backgroundFeatRule, backgroundSkillRule } = await import(pathToFileURL(path.join(root, "utils/backgroundMechanics.js")).href);
const { routeFeatSourceChoiceGroups } = await import(pathToFileURL(path.join(root, "utils/playerForgeFeatChoiceRouting.js")).href);

const customSkillRule = backgroundSkillRule({
  name: "Custom Background",
  source: "PHB",
  raw_payload: { skillProficiencies: [{ any: 2 }] },
});
assert.equal(customSkillRule.fixedKeys.length, 0, "Custom Background any-skill rules must not masquerade as fixed proficiencies");
assert.equal(customSkillRule.choiceGroups.length, 1, "Custom Background must publish one two-skill choice group");
assert.equal(customSkillRule.choiceGroups[0].count, 2, "Custom Background must require two skill choices");
assert.equal(customSkillRule.choiceGroups[0].from.length, 18, "Custom Background must offer the canonical 18-skill pool");

for (const [backgroundName, fixedList] of [["Acolyte", "Cleric"], ["Guide", "Druid"], ["Sage", "Wizard"]]) {
  const rule = backgroundFeatRule({
    name: backgroundName,
    source: "XPHB",
    raw_payload: { feats: [{ [`magic initiate; ${fixedList.toLowerCase()}|xphb`]: true }] },
  });
  assert.equal(rule.fixedName, "magic initiate", `${backgroundName} must reduce its qualified source reference to canonical Magic Initiate`);

  const routed = routeFeatSourceChoiceGroups({
    selectedBackground: { name: backgroundName, source: "XPHB" },
    finalAbilities: { str: 8, dex: 10, con: 12, int: 13, wis: 15, cha: 11 },
    groups: [{
      id: `magic-${backgroundName.toLowerCase()}`,
      label: "Magic Initiate",
      placement: "background",
      metadata: { featName: "Magic Initiate", acquisitionLabel: backgroundName },
      fields: [
        { id: "spell-list", kind: "spell-list", count: 1, required: true, options: ["Cleric", "Druid", "Wizard"].map((label) => ({ key: label.toLowerCase(), value: label, label })) },
        { id: "spellcasting-ability", kind: "ability", count: 1, required: true, options: ["int", "wis", "cha"].map((key) => ({ key, value: key, label: key })) },
        { id: `cantrips-${fixedList.toLowerCase()}`, kind: "spell", count: 2, required: true, options: [{ key: "a" }, { key: "b" }] },
        { id: `level-1-${fixedList.toLowerCase()}`, kind: "spell", count: 1, required: true, options: [{ key: "c" }] },
      ],
    }],
  })[0];

  assert.ok(routed, `${backgroundName} Magic Initiate must remain routable`);
  assert.equal(routed.metadata?.fixedSpellList, fixedList, `${backgroundName} must lock Magic Initiate to ${fixedList}`);
  const listField = routed.fields.find((field) => field.id === "spell-list");
  assert.equal(listField?.autoSelect, true, `${backgroundName} fixed Magic Initiate list must not become a false choice`);
  assert.deepEqual(listField?.options?.map((option) => option.label), [fixedList]);
}

const optionalFlavorFeatures = backgroundFeatureDetails({
  name: "Example",
  source: "TEST",
  raw_payload: { entries: [
    { type: "entries", name: "Feature: Real Rule", data: { isFeature: true }, entries: ["Keep this mechanical feature."] },
    { type: "entries", name: "Favored Event", entries: ["Roll or choose on the table.", { type: "table", colLabels: ["d6", "Event"], rows: [[1, "Example event"]] }] },
    { type: "entries", name: "Building an Example Character", entries: ["Build advice that belongs in the source book, not the Forge dossier."] },
  ] },
});
assert.ok(optionalFlavorFeatures.some((feature) => feature.name === "Real Rule"), "real Background features must survive optional-flavor pruning");
assert.ok(!optionalFlavorFeatures.some((feature) => feature.name === "Favored Event"), "optional random-table lead-in prose must not survive when the table is not a creator requirement");
assert.ok(!optionalFlavorFeatures.some((feature) => /^Building a .* Character$/i.test(feature.name)), "source-book character-building boilerplate must not become a Forge feature");

const runeFeatures = backgroundFeatureDetails({
  name: "Rune Carver",
  source: "BGG",
  raw_payload: { entries: [
    { type: "entries", name: "Feature: Rune Shaper", data: { isFeature: true }, entries: ["You gain the Rune Shaper feat."] },
    { type: "entries", name: "Rune Styles", entries: ["Choose a style from a source table.", { type: "table", rows: [[1, "Wax or clay"]] }] },
    { type: "entries", name: "Building a Rune Carver Character", entries: ["Boilerplate build advice."] },
  ] },
});
assert.ok(runeFeatures.some((feature) => /Rune Shaper/i.test(feature.name)), "Rune Carver must keep Rune Shaper");
assert.ok(!runeFeatures.some((feature) => /^Rune Styles$/i.test(feature.name)), "Rune Styles prose must be owned by the persisted dropdown instead");
assert.ok(!runeFeatures.some((feature) => /^Building a Rune Carver Character$/i.test(feature.name)), "Rune Carver build boilerplate must stay removed");

const clanFeatures = backgroundFeatureDetails({ name: "Clan Crafter", source: "SCAG", raw_payload: { entries: [] } });
assert.ok(!clanFeatures.some((feature) => feature.campaignRule || /Craft Expertise/i.test(feature.name)), "Clan Crafter must not recreate the retired Craft Expertise campaign feature");

const mechanicsSource = read("utils/backgroundMechanics.js");
for (const token of ["containsStructuredTable", "Building a .+ Character", "Optional flavor sections"]) {
  assert.ok(mechanicsSource.includes(token), `catalogue-wide Background prose guard missing ${token}`);
}
assert.ok(!mechanicsSource.includes("Craft Expertise") && !mechanicsSource.includes("clanCrafterHouseRule"), "retired Clan Crafter Craft Expertise injection must be absent from Background mechanics");

const derivedSource = read("components/useNpcForgeDerivedModel.js");
for (const token of ["TOOL_GUIDANCE", "Typical uses", "Rune Spells", "cleanPrerequisite", "Training → Skills & Proficiencies"]) {
  assert.ok(derivedSource.includes(token), `catalogue-wide Background readability model missing ${token}`);
}

const sourceChoiceSource = read("utils/playerForgeSourceChoices.js");
for (const token of ["toolRuleFacts", "RUNE_STYLE_OPTIONS", "separate from campaign Trade Skill training", "does not grant Expertise"]) {
  assert.ok(sourceChoiceSource.includes(token), `catalogue-wide Background choice model missing ${token}`);
}
assert.ok(!sourceChoiceSource.includes("clan-crafter-craft-expertise") && !sourceChoiceSource.includes("craftExpertise"), "retired Clan Crafter Craft Expertise metadata must be absent from source choices");

const featRoutingSource = read("utils/playerForgeFeatChoiceRouting.js");
for (const token of ["TRAINING_PROFICIENCY_FEATS", "fixedMagicInitiateListForBackground", "trainingSection: \"skills-proficiencies\""]) {
  assert.ok(featRoutingSource.includes(token), `Background feat routing guard missing ${token}`);
}

const css = read("styles/character-forge-background-polish.css");
for (const token of ["background: #111522", "color-scheme: dark", "grid-template-columns: minmax(0, 1fr)", "column-count: 1"]) {
  assert.ok(css.includes(token), `Background visual readability guard missing ${token}`);
}

for (const source of [mechanicsSource, read("utils/backgroundMechanicsRefined.js"), sourceChoiceSource, featRoutingSource, derivedSource, css]) {
  assert.doesNotMatch(source, /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/, "Background catalogue audit crossed protected map/travel boundaries");
}

console.log("Background catalogue readability validated: Custom Background arbitrary skills parse correctly; 2024 fixed Magic Initiate lists stay fixed; optional random-table and build-boilerplate prose is pruned without deleting real features; Rune Styles is structurally owned; mundane tools remain distinct from Trade Skill rank and never grant automatic Expertise; tool guidance, Training routing, dark choice contrast, and protected map/travel boundaries remain intact.");
