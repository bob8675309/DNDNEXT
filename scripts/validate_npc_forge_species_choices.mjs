import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const presentation = read("utils/speciesPresentation.js");
for (const token of [
  "extractSpeciesTraitChoiceRules",
  "speciesTraitChoiceRuleComplete",
  "one of the following cantrips",
  'id: "cantrip"',
  'id: "ability"',
  'value: "int"',
  'value: "wis"',
  'value: "cha"',
]) assert.ok(presentation.includes(token), `Species choice extraction missing ${token}`);

const wrapper = read("components/NewNpcModalV2.js");
for (const token of [
  "NpcForgeSpeciesChoiceContext.Provider",
  "blockIncompleteSpeciesChoice",
  '.from("character_sheets")',
  "speciesTraitChoices",
  "speciesSpellcasting",
]) assert.ok(wrapper.includes(token), `Species choice persistence missing ${token}`);

const context = read("components/NpcForgeSpeciesChoiceContext.js");
for (const token of [
  "speciesChoiceStateComplete",
  "serializeSpeciesChoiceState",
  "speciesSpellcastingFromChoiceState",
]) assert.ok(context.includes(token), `Species choice state contract missing ${token}`);

const panel = read("components/NpcForgeContextPanelRefined.js");
for (const token of [
  "SpeciesTraitChoiceControl",
  "extractSpeciesTraitChoiceRules",
  "Choice required",
  "Choose below to continue",
  "Required species choices are made inside the relevant feature above",
]) assert.ok(panel.includes(token), `Species choice panel missing ${token}`);

const styles = read("styles/npc-forge-species-info.css");
for (const token of [
  ".npc-forge-species-choice",
  ".npc-forge-species-choice-options",
  ".npc-forge-context-card.is-species .npc-forge-species-feature-list p",
]) assert.ok(styles.includes(token), `Species choice styling missing ${token}`);

console.log("NPC Forge species choice and readability validation passed.");
