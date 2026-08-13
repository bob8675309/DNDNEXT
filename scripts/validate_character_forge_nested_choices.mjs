import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const requireToken = (text, token, label) => { if (!text.includes(token)) throw new Error(`Nested Forge choices: ${label} is missing ${token}`); };
const forbidToken = (text, token, label) => { if (text.includes(token)) throw new Error(`Nested Forge choices: ${label} must not contain ${token}`); };

const extensions = read("utils/classFeatureChoiceExtensions.js");
const parsing = read("utils/classFeatureChoiceParsing.js");
const rules = read("utils/classFeatureChoices.js");
const speciesPresentation = read("utils/speciesPresentation.js");
const sourceChoices = read("utils/playerForgeSourceChoices.js");
const speciesChoices = read("utils/playerForgeSpeciesChoices.js");
const featChoices = read("utils/playerForgeFeatChoices.js");
const advancement = read("utils/playerForgeAdvancement.js");
const playerFacing = read("utils/playerFacingText.js");
const featureText = read("components/ClassFeatureText.js");
const abilityStep = read("components/NpcForgeAbilityStep.js");
const context = read("components/NpcForgeClassChoiceContext.js");
const sourceContext = read("components/NpcForgeSourceChoiceContext.js");
const sourceFields = read("components/NpcForgeSourceChoiceFields.js");
const sharedSourceFields = read("components/SourceChoiceFields.js");
const featRegistrar = read("components/NpcForgeFeatChoiceRegistrar.js");
const guideModel = read("components/NpcForgeClassGuideModel.js");
const choices = read("components/NpcForgeClassFeatureChoices.js");
const training = read("components/NpcForgeTrainingStep.js");
const sharedForge = read("components/NewNpcModalV3.js");
const migration = read("sql/20260806_03_player_forge_nested_choice_validation.sql");
const cadenceMigration = read("sql/20260807_01_player_forge_runtime_choice_cadence.sql");
const featInstanceMigration = read("sql/20260808_01_character_option_grant_instances.sql");
const featMaterializeMigration = read("sql/20260808_02_player_forge_feat_instance_authority.sql");
const featValidationMigration = read("sql/20260808_03_player_forge_feat_instance_validation.sql");

for (const token of [
  "activeClassFeatureGroups", "buildExplicitClassFeatureGroups", "Agonizing Blast", "Lessons of the First Ones",
  "Mystic Arcanum", "Magical Discoveries", "Primal Lore", "Blessed Strikes",
  "Deft Explorer languages", "Thieves' Cant additional language", "Elemental Affinity",
  "Signature Spells", "sourceRank", "preferredSpellRows",
]) requireToken(extensions, token, "source-backed extension engine");
for (const token of ["artificer-armorer-model", "wizard-spell-mastery-", "fighter-banneret-language", "warlock-pact-tome-cantrips", "warlock-pact-tome-rituals"]) forbidToken(extensions, token, "runtime/rest class choices");

for (const token of [
  "classFeatureChoiceCadence", "REST_RECONFIGURABLE_FEATURES", "PER_USE_FEATURES", "long-rest", "short-rest", "per-use",
  "weapon mastery", "circle of the land spells", "primal companion", "fiendish resilience", "dread allegiance", "armor model", "spell mastery",
  "steps of the fey", "tinker's magic", "spellcasting",
]) requireToken(parsing, token, "choice-cadence classifier");
forbidToken(parsing, 'Object.prototype.hasOwnProperty.call(node, "count")', "choice-cadence classifier");

for (const token of [
  "spells = []", "mergeChoiceGroups", "classFeatureGroupIsActive", "activeWhen", "constraints", "spell: option.spell",
  'placement: "training"', 'cadence: "creation"', "fightingStyleOptions", "expertiseCount(classKey, level, source",
]) requireToken(rules, token, "choice orchestration");
forbidToken(rules, "-weapon-mastery`", "creation-time class choices");
for (const token of ["classStepChoiceStateComplete", "trainingClassChoiceStateComplete", "activeClassFeatureGroups", "classFeatureGroupsComplete"]) requireToken(context, token, "placement-aware completion guard");
for (const token of ['from("spells_catalog")', "damage_types", "spells,"]) requireToken(guideModel, token, "class guide spell source");
for (const token of ["SpellChoiceCard", "Spell details", "Dependent choices open", "activeClassFeatureGroups", "CompactChoicePicker", "conciseChoiceHelper", 'placement = "class"', "eligibleOptionNames", "availableOptions.length > 8", "Number(option.minLevel || 1) <= Number(level || 1)"]) requireToken(choices, token, "nested choice UI");
for (const token of ["COMPACT_VISIBLE_SECTIONS", "Full feature rules", "class-feature-text__compact-more"]) requireToken(featureText, token, "compact feature presentation");
for (const token of ["isSourceCode(penultimate) && isFeatureLevel(last)", "isFeatureLevel(penultimate) && isSourceCode(last)"]) requireToken(playerFacing, token, "internal source-reference sanitizer");
for (const token of ["useNpcForgeClassChoice", 'placement="training"', "eligibleExpertiseNames", "Assign Expertise after proficiency is established"]) requireToken(training, token, "Training-stage Expertise routing");
forbidToken(abilityStep, "npc-forge-species-bonus mt-4", "Abilities main-workspace Species Bonus duplication");
for (const token of ["speciesCharacterSizeOptions", 'T: "Tiny"', 'S: "Small"', 'M: "Medium"', 'L: "Large"']) requireToken(speciesPresentation, token, "species source-size normalization");
forbidToken(abilityStep, "NpcForgeSourceChoiceFields", "higher-level advancement routing");
for (const token of ["NpcForgeSourceChoiceFields", 'placement="advancement"', "Higher-level feat and Epic Boon decisions", "Feats & Class Abilities"]) requireToken(training, token, "higher-level advancement Training UI");

for (const token of [
  "SOURCE_CHOICE_CADENCES", "buildOriginLanguageGroup", "buildSpeciesSizeGroup", "buildBackgroundSourceChoiceGroups", "buildClassStartingSourceChoiceGroups",
  "sourceChoiceFieldIsActive", "distinctFromFieldId", "normalizeSourceChoiceSelections", "serializeSourceChoices", "metadata: group.metadata",
]) requireToken(sourceChoices, token, "shared source-choice foundation");
for (const token of ["scopes", "normalizeSourceChoiceState", "sourceChoiceStateComplete"]) requireToken(sourceContext, token, "scoped source-choice context");
for (const token of ["SourceChoiceFields", "sourceChoiceGroupsForPlacement", "toggleChoice", "setChoice"]) requireToken(sourceFields, token, "Forge source-choice context adapter");
for (const token of ["DropdownField", "ButtonField", "blocked", "distinctFromFieldId", "sourceChoiceFieldComplete"]) requireToken(sharedSourceFields, token, "shared compact source-choice controls");
for (const token of ["buildSpeciesSourceChoiceGroups", "draconic ancestry", "elven lineage", "fiendish legacy", "kobold legacy", "animal enhancement", "astral trance", "distinctFromFieldId"]) requireToken(speciesChoices, token, "persistent Species choice engine");
for (const token of [
  "buildFeatSourceChoiceGroups", "featGrantInstancesFromSelections", "featInstanceSummaries", "abilityScoreImprovementFields", "magicInitiateFields", "ritualCasterFields",
  'name === "resilient"', "saving-throw-proficiency", "sourceChoiceFieldIsActive",
]) requireToken(featChoices, token, "nested feat-instance engine");
for (const token of ["buildAdvancementSourceChoiceGroups", 'ownerType: "advancement"', "Ability Score Improvement", "Epic Boon"]) requireToken(advancement, token, "higher-level advancement engine");
for (const token of ["buildSpeciesSourceChoiceGroups", "buildAdvancementSourceChoiceGroups", 'registerGroups(playerMode ? featGroups', '"species-extra"', '"advancement"', '"feats"']) requireToken(featRegistrar, token, "source-choice registrar");
for (const token of [
  "featGrantInstances", "featSpellChoices", "featAuthorityFromState", "applyFeatAbilityAuthority", "canonicalSkillKey", "mergeSaveAuthority",
  'sourcePlacements =', '"abilities", "advancement"', "sourceChoiceStateComplete",
]) requireToken(sharedForge, token, "shared Forge source authority");

for (const token of ["druid-land-type", "ranger-primal-companion-form", "rogue-dread-allegiance"]) forbidToken(extensions, token, "rest-reconfigurable creation groups");

for (const token of ["player_forge_choice_option_is_valid_v1", "validate_player_forge_nested_choice_payload_v1", "deferrable initially deferred", "spellClasses", "castingTimeIncludes", "Dependent class choice group"]) requireToken(migration, token, "nested choice authority migration");
for (const token of ["Agonizing Blast", "Eldritch Spear", "Repelling Blast", "Lessons of the First Ones", "Pact of the Tome is deliberately excluded", "validate_player_forge_nested_choice_payload_v1"]) requireToken(cadenceMigration, token, "runtime cadence authority migration");
forbidToken(cadenceMigration, "'Pact of the Tome']", "runtime cadence authority migration");
for (const token of ["character_option_grant_instances", "instance_key", "validate_player_forge_feat_instances_v1", "repeatable"]) requireToken(featInstanceMigration, token, "feat-instance schema");
for (const token of ["materialize_player_forge_feat_instances_v1", "character_progression_materialize_player_forge_feat_instances_v1", "character_option_grant_instances_direct_authority_guard_v1", "featGrantInstances"]) requireToken(featMaterializeMigration, token, "feat-instance materialization authority");
for (const token of ["validate_player_forge_authority_payload_v1", "featGrantInstances", "validate_player_forge_feat_instances_v1", "sourceChoices", "sourceChoiceSummary", "validated source-owned feat grants"]) requireToken(featValidationMigration, token, "feat-instance deferred validation");

console.log("Source-backed Player Forge choices validated with field-level cadence, scoped source choices, Species/source-size authority, nested feat instances, Training-routed higher-level advancement, rest-time authority alignment, and Training-stage Expertise.");
