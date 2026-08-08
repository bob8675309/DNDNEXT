import fs from "node:fs";

const choices = fs.readFileSync("utils/classFeatureChoices.js", "utf8");
const spellStep = fs.readFileSync("components/NpcForgeSpellStep.js", "utf8");
const migration = fs.readFileSync("sql/20260808_41_wizard_savant_forge_chronology.sql", "utf8");

const need = (source, token, label = token) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};
const forbid = (source, token, label = token) => {
  if (source.includes(token)) throw new Error(`Forbidden ${label}: ${token}`);
};

for (const token of [
  "function expandWizardSavantGroups",
  "groups.flatMap",
  "{ level: 3, count: 2, maxSpellLevel: 2 }",
  "{ level: 5, count: 1, maxSpellLevel: 3 }",
  "{ level: 17, count: 1, maxSpellLevel: 9 }",
  "spellLevel < 1",
  "minSpellLevel: 1",
  "`${group.id}-level-${acquisition.level}`",
  "Choose the two level 1+ Wizard spells",
]) need(choices, token);
forbid(choices, "count: maximumLevel", "cumulative Savant selection count");

for (const token of [
  "useNpcForgeClassChoice",
  "savantSpellIds",
  "spells.filter((spell) => !savantSpellIds.has(String(spell.id)))",
  "Savant spellbook additions",
  "cannot be selected twice",
]) need(spellStep, token);

for (const token of [
  "wizard_spellbook_has_spell_v1",
  "validate_wizard_spellbook_uniqueness_v1",
  "Wizard spellbook entries must be level 1+ spells",
  "s.level between 1 and 2",
  "p_to_level=3 and not(v_spell.level between 1 and 2)",
  "materialize_player_forge_wizard_savant_for_character_v1",
  "v_expected_levels:=array[3]",
  "for v_level_gate in 5..least(17,v_progression.class_level) by 2",
  "coalesce((entry.value->>'level')::integer,0)=v_level_gate",
  "v_spell.level<1",
  "Savant spellbook selections must be distinct across every acquisition level",
  "'class-feature',v_group_key,v_feature",
  "'wizardSpellbook',true",
  "'grantedAtLevel',v_level_gate",
  "character_progression_materialize_player_forge_wizard_savant_v1",
  "deferrable initially deferred",
]) need(migration, token);
forbid(migration, "between 0 and 2", "level-0 Savant spellbook legality");
forbid(migration, "one cumulative Savant choice group", "cumulative Forge Savant group authority");

console.log("Higher-level Player Forge Wizard Savant acquisition chronology, level-1+ spellbook legality, materialization, and duplicate separation validated.");
