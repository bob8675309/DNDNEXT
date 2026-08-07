import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const requireToken = (text, token, label) => { if (!text.includes(token)) throw new Error(`Nested Forge choices: ${label} is missing ${token}`); };
const forbidToken = (text, token, label) => { if (text.includes(token)) throw new Error(`Nested Forge choices: ${label} must not contain ${token}`); };

const extensions = read("utils/classFeatureChoiceExtensions.js");
const parsing = read("utils/classFeatureChoiceParsing.js");
const rules = read("utils/classFeatureChoices.js");
const playerFacing = read("utils/playerFacingText.js");
const featureText = read("components/ClassFeatureText.js");
const context = read("components/NpcForgeClassChoiceContext.js");
const guideModel = read("components/NpcForgeClassGuideModel.js");
const choices = read("components/NpcForgeClassFeatureChoices.js");
const training = read("components/NpcForgeTrainingStep.js");
const migration = read("sql/20260806_03_player_forge_nested_choice_validation.sql");

for (const token of [
  "activeClassFeatureGroups", "buildExplicitClassFeatureGroups", "Agonizing Blast", "Lessons of the First Ones",
  "Pact of the Tome", "Mystic Arcanum", "Magical Discoveries", "Primal Lore", "Blessed Strikes",
  "Deft Explorer languages", "Thieves' Cant additional language", "Elemental Affinity", "Spell Mastery",
  "Signature Spells", "sourceRank", "preferredSpellRows",
]) requireToken(extensions, token, "source-backed extension engine");

for (const token of [
  "classFeatureChoiceCadence", "REST_RECONFIGURABLE_FEATURES", "PER_USE_FEATURES", "long-rest", "short-rest", "per-use",
  "weapon mastery", "circle of the land spells", "primal companion", "fiendish resilience", "dread allegiance", "steps of the fey", "tinker's magic", "spellcasting",
]) requireToken(parsing, token, "choice-cadence classifier");
forbidToken(parsing, 'Object.prototype.hasOwnProperty.call(node, "count")', "choice-cadence classifier");

for (const token of ["spells = []", "mergeChoiceGroups", "classFeatureGroupIsActive", "activeWhen", "constraints", "spell: option.spell", 'placement: "training"', 'cadence: "creation"']) requireToken(rules, token, "choice orchestration");
forbidToken(rules, "-weapon-mastery`", "creation-time class choices");
for (const token of ["classStepChoiceStateComplete", "trainingClassChoiceStateComplete", "activeClassFeatureGroups", "classFeatureGroupsComplete"]) requireToken(context, token, "placement-aware completion guard");
for (const token of ['from("spells_catalog")', "damage_types", "spells,"]) requireToken(guideModel, token, "class guide spell source");
for (const token of [
  "SpellChoiceCard", "Spell details", "Dependent choices open", "activeClassFeatureGroups", "CompactChoicePicker",
  "conciseChoiceHelper", 'placement = "class"', "eligibleOptionNames", "availableOptions.length > 8",
  "Number(option.minLevel || 1) <= Number(level || 1)",
]) requireToken(choices, token, "nested choice UI");
for (const token of ["COMPACT_VISIBLE_SECTIONS", "Full feature rules", "class-feature-text__compact-more"]) requireToken(featureText, token, "compact feature presentation");
for (const token of [
  "isSourceCode(penultimate) && isFeatureLevel(last)",
  "isFeatureLevel(penultimate) && isSourceCode(last)",
]) requireToken(playerFacing, token, "internal source-reference sanitizer");
for (const token of ["useNpcForgeClassChoice", 'placement="training"', "eligibleExpertiseNames", "Assign Expertise after proficiency is established"]) requireToken(training, token, "Training-stage Expertise routing");

for (const token of ["druid-land-type", "ranger-primal-companion-form", "rogue-dread-allegiance"]) forbidToken(extensions, token, "rest-reconfigurable creation groups");

for (const token of [
  "player_forge_choice_option_is_valid_v1", "validate_player_forge_nested_choice_payload_v1",
  "deferrable initially deferred", "spellClasses", "castingTimeIncludes", "Dependent class choice group",
]) requireToken(migration, token, "nested choice authority migration");

console.log("Source-backed Player Forge choices validated with cadence separation, compact presentation, source-reference cleanup, and Training-stage Expertise.");
