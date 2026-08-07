import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const requireToken = (text, token, label) => { if (!text.includes(token)) throw new Error(`Nested Forge choices: ${label} is missing ${token}`); };

const extensions = read("utils/classFeatureChoiceExtensions.js");
const rules = read("utils/classFeatureChoices.js");
const context = read("components/NpcForgeClassChoiceContext.js");
const guideModel = read("components/NpcForgeClassGuideModel.js");
const choices = read("components/NpcForgeClassFeatureChoices.js");
const migration = read("sql/20260806_03_player_forge_nested_choice_validation.sql");

for (const token of [
  "activeClassFeatureGroups", "buildExplicitClassFeatureGroups", "Agonizing Blast", "Lessons of the First Ones",
  "Pact of the Tome", "Mystic Arcanum", "Magical Discoveries", "Primal Lore", "Blessed Strikes",
  "Deft Explorer languages", "Thieves' Cant additional language", "Elemental Affinity", "Spell Mastery",
  "Signature Spells", "sourceRank", "preferredSpellRows",
]) requireToken(extensions, token, "source-backed extension engine");

for (const token of ["spells = []", "mergeChoiceGroups", "classFeatureGroupIsActive", "activeWhen", "constraints", "spell: option.spell"]) requireToken(rules, token, "choice orchestration");
for (const token of ["activeClassFeatureGroups", "classFeatureGroupsComplete"]) requireToken(context, token, "completion guard");
for (const token of ['from("spells_catalog")', "damage_types", "spells,"]) requireToken(guideModel, token, "class guide spell source");
for (const token of ["SpellChoiceCard", "Spell details", "Dependent choices open", "activeClassFeatureGroups"]) requireToken(choices, token, "nested choice UI");
for (const token of [
  "player_forge_choice_option_is_valid_v1", "validate_player_forge_nested_choice_payload_v1",
  "deferrable initially deferred", "spellClasses", "castingTimeIncludes", "Dependent class choice group",
]) requireToken(migration, token, "nested choice authority migration");

console.log("Source-backed nested Player Forge class choices validated.");
