import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  extractSpeciesTraitChoiceRules,
  speciesTraitChoiceRuleComplete,
} from "../utils/speciesPresentation.js";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const astralElf = {
  id: "astral-elf-test",
  name: "Astral Elf",
  metadata: {
    traits: [{
      name: "Astral Fire",
      entries: [
        "You know one of the following cantrips of your choice: {@spell dancing lights}, {@spell light}, or {@spell sacred flame}. Intelligence, Wisdom, or Charisma is your spellcasting ability for it (choose when you select this race).",
      ],
    }],
  },
};

const rules = extractSpeciesTraitChoiceRules(astralElf);
assert.equal(rules.length, 1, "Astral Fire should create one species trait choice rule.");
assert.equal(rules[0].traitName, "Astral Fire");
assert.deepEqual(rules[0].fields[0].options.map((option) => option.label), ["Dancing Lights", "Light", "Sacred Flame"]);
assert.deepEqual(rules[0].fields[1].options.map((option) => option.value), ["int", "wis", "cha"]);
assert.equal(speciesTraitChoiceRuleComplete(rules[0], {}), false);
assert.equal(speciesTraitChoiceRuleComplete(rules[0], { "astral-fire": { cantrip: "Light", ability: "wis" } }), true);

const wrapper = read("components/NewNpcModalV2.js");
for (const token of [
  "NpcForgeSpeciesChoiceContext.Provider",
  "blockIncompleteSpeciesChoice",
  '.from("character_sheets")',
  "speciesTraitChoices",
  "speciesSpellcasting",
]) assert.ok(wrapper.includes(token), `Species choice persistence missing ${token}`);

const panel = read("components/NpcForgeContextPanelRefined.js");
for (const token of [
  "SpeciesTraitChoiceControl",
  "extractSpeciesTraitChoiceRules",
  "Choice required",
  "Choose below to continue",
]) assert.ok(panel.includes(token), `Species choice panel missing ${token}`);

const styles = read("styles/npc-forge-species-info.css");
for (const token of [
  ".npc-forge-species-choice",
  ".npc-forge-species-choice-options",
  ".npc-forge-context-card.is-species .npc-forge-species-feature-list p",
]) assert.ok(styles.includes(token), `Species choice styling missing ${token}`);

console.log("NPC Forge species choice and readability validation passed.");
