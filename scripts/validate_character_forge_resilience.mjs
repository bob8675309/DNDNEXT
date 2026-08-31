import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const requireToken = (text, token, label) => { if (!text.includes(token)) throw new Error(`Character Forge resilience: ${label} is missing ${token}`); };
const forbidToken = (text, token, label) => { if (text.includes(token)) throw new Error(`Character Forge resilience: ${label} still contains rejected ${token}`); };

const adapter = read("components/PlayerCharacterForgeAdapter.js");
const forge = read("components/NpcForge.js");
const forgeController = read("components/NpcForgeController.js");
const forgeSteps = read("components/NpcForgeStepContent.js");
const context = read("components/NpcForgeContextPanelRefined.js");
const classContext = read("components/NpcForgeClassChoiceContext.js");
const classRules = read("components/NpcForgeClassGuideModel.js");
const classGuide = read("components/NpcForgeClassGuide.js");
const classGuideModel = read("components/NpcForgeClassGuideModel.js");
const classChoices = read("components/NpcForgeClassFeatureChoices.js");
const classFeatureText = read("components/ClassFeatureText.js");
const classDock = read("components/NpcForgeClassFeatureDock.js");
const classRuleSource = read("utils/classFeatureChoices.js");
const speciesRules = read("utils/playerForgeSpeciesChoices.js");
const speciesContext = read("components/NpcForgeSourceChoiceContext.js");
const sourceChoiceContext = speciesContext;
const sourceChoiceUi = read("components/SourceChoiceFields.js");
const ability = read("components/NpcForgeAbilityStep.js");
const speciesBonus = read("components/NpcForgeSpeciesBonusPanel.js");
const training = read("components/NpcForgeTrainingStep.js");
const review = read("components/NpcForgeReviewPanel.js");
const profile = read("components/PlayerProfile.js");
const finalPolish = read("styles/character-forge-browser-review-polish.css");
const validationGuidance = read("utils/forgeValidationGuidance.js");

for (const token of ["shared_character_forge_player_v2", "PlayerCharacterForgeAdapter", "playerMode", "onCreated"]) requireToken(adapter, token, "player adapter");
for (const token of ["shared_character_forge_player_v2", "npc-forge-body", "onCreated", "playerMode"]) requireToken(forge, token, "unified Forge shell");
forbidToken(adapter, "LegacyPlayerCharacterCreator", "legacy player creator fallback");
forbidToken(forge, "LegacyPlayerCharacterCreator", "legacy player creator fallback");

for (const token of ["key={sessionUser.id}", "is-forge-suspended"]) requireToken(profile, token, "profile host account isolation");

for (const token of ["Skillful", "Versatile", "Choose skill proficiency", "Choose Origin feat", "ORIGIN_FEAT_OPTIONS", "speciesFixedLanguages"]) requireToken(speciesRules, token, "Human and fixed-language Species choices");
for (const token of ["speciesSkillChoicesFromState", "speciesFeatChoicesFromState", "speciesSpellcastingFromChoiceState"]) requireToken(speciesContext, token, "Species choice persistence");
for (const token of ["applyAutomaticSourceSelections", "field?.autoSelect", "backgroundToolChoiceResolvesInTraining", "sourcePlacement"]) requireToken(sourceChoiceContext, token, "fixed and routed source choice authority");
for (const token of ["RichField", "npc-forge-rich-choice", "eldritch-invocation", "artificer-plan", "FixedField"]) requireToken(sourceChoiceUi, token, "rich source choice catalogue");

for (const token of ["classChoiceStateComplete", "eligibleSubclassOptions", "featureGroups", "featureSelections", "registerFeatureGroups", "toggleFeatureOption"]) requireToken(classContext, token, "class choice context");
for (const token of ["WARLOCK_INVOCATION_PROGRESSION_XPHB", "battle-master-maneuver", "metamagic", "weapon-mastery", "fighting-style", "expertise", "refSubclassFeature", "permanentChoiceText", "serializeClassFeatureChoices"]) requireToken(classRuleSource, token, "class feature choice rules");
for (const token of ["buildClassFeatureChoiceGroups", "serializeClassFeatureChoices"]) requireToken(classRules, token, "class feature choice orchestration");
for (const token of ["Class feature choices", "Complete permanent choices", "Read option", "is-required"]) requireToken(classChoices, token, "class feature choice UI");
requireToken(`${classGuide}\n${classGuideModel}`, 'from("class_level_progression")', "class guide model");
requireToken(classGuideModel, 'from("class_feature_catalog")', "class choice source");
requireToken(classGuideModel, 'from("character_option_catalog_preferred")', "class feat/skill source");
requireToken(classGuideModel, 'from("items_catalog")', "weapon mastery source");
forbidToken(classGuideModel, "subclass_source", "class feature catalog query");
for (const token of ["ForgeSubclassSelection", "ChoiceRoutingNote", "cleanPlayerCopy", "npc-forge-class-guide__level-heading", "npc-forge-class-guide__hero-facts", "onFeatureDetail", "ClassFeatureText"]) requireToken(classGuide, token, "class guide");
forbidToken(classGuide, "NpcForgeClassFeatureChoices", "class guide decision routing");
forbidToken(classGuide, '"Primary Abilities"', "class hero redundant primary-ability tile");
for (const token of ["normalizeClassFeatureText", "classFeatureSections", "class-feature-text__long-list", "LEVEL_BOILERPLATE"]) requireToken(classFeatureText, token, "structured class feature text");
for (const token of ["Class Feature", "Subclass Feature", "npc-forge-class-feature-dock", "ClassFeatureText", "Hover, focus, or select another feature or subclass"]) requireToken(classDock, token, "class feature card dock");
forbidToken(classDock, "NpcForgeSourceChoiceFields", "class feature card dock decision routing");
for (const token of ["Deferred resolutions", "resolve in Training", "Spell selections resolve in Spells"]) requireToken(classGuide, token, "class cross-tab decision routing");
requireToken(forgeSteps, "NpcForgeClassFeatureDock", "class feature dock placement");
requireToken(forgeSteps, "NpcForgeSpeciesBonusPanel", "ability Species Bonus placement");
requireToken(forgeSteps, "speciesFixedLanguages", "source-defined player languages");
requireToken(forgeSteps, "autoSelect: true", "fixed player languages");
requireToken(forgeSteps, "!playerMode && selectedSpecies?.lineages?.length", "NPC-only catalog lineage presentation");
forbidToken(forgeSteps, "{playerMode && selectedSpecies?.lineages?.length ?", "player-facing catalog lineage");
requireToken(context, "npc-forge-species-hero", "species hero composition");
requireToken(context, "npc-forge-species-facts", "species compact facts");
requireToken(context, "npc-forge-species-feature-list", "species expandable rules");
requireToken(context, "npc-forge-species-spell-help", "species spell hover details");
requireToken(context, 'from("spells_catalog")', "species spell hover source");
forbidToken(context, 'label: "Speed"', "species redundant flat rows");
for (const token of ["SpeciesIdentityFact", "GENDER_OPTIONS", "ALIGNMENT_OPTIONS", "onPatch={patch}"]) requireToken(`${context}\n${forgeSteps}`, token, "Species identity controls");
for (const token of ["clearForgeValidationGuidance", "showForgeValidationGuidance", "forgeStepGuidanceSelectors", "data-forge-validation-message", "aria-invalid"]) requireToken(`${adapter}\n${forgeController}\n${validationGuidance}`, token, "targeted Continue guidance");
for (const token of [".is-forge-validation-target", 'content: "↓ " attr(data-forge-validation-message)', "forge-validation-pulse"]) requireToken(finalPolish, token, "targeted Continue guidance styling");

for (const token of ["Ability Score Generation Method", "Standard 3d6", "4d6 drop lowest die", "Point Buy", "Standard Class Array", "Manual Assign", "Reroll All Six", "Species Bonus stays in the right information panel"]) requireToken(ability, token, "ability rules");
forbidToken(ability, "NpcForgeSourceChoiceFields", "advancement choices on Abilities");
forbidToken(ability, "npc-forge-species-bonus mt-4", "ability main-workspace Species Bonus duplication");
for (const token of ["npc-forge-species-bonus--context", "Species Bonus", "Bonus feat", "specific feat is chosen later in Training"]) requireToken(speciesBonus, token, "right-column Species Bonus");
forbidToken(speciesBonus, "Species bonus feat</span>", "Abilities specific Bonus Feat chooser");
for (const token of ["Skill &amp; Training Selections", "Training Choices", "Trade Skills", "sourceGrantedProfessionKeys", "Source-granted tools train the matching Trade Skill for free", "Skills & Proficiencies", "Feat &amp; Class Choices", 'placement="advancement"']) requireToken(training, token, "training rules and routed choices");
forbidToken(training, "Tool proficiency alone does not unlock the Trade Skill", "rejected tool/Trade Skill split");

for (const token of ["Character Review", "Review character choices", "sourceMagicChoices", "automaticSourceMagic", "selectedTrainingChoices", "startingEquipment"]) requireToken(review, token, "review dossier");
for (const token of ["stepValidation", "validationMessage", "Continue", "Back", "Reset"]) requireToken(forgeController, token, "Forge navigation");

for (const token of ["MapPageClient", "map_routes", "map_route_points", "advance_all_characters", "time_scale", "weather", "TownSheet", "craft_recipe", "encounter_action"]) {
  forbidToken(`${adapter}\n${forge}\n${forgeController}\n${forgeSteps}\n${context}\n${classGuide}\n${classDock}\n${ability}\n${training}\n${review}`, token, "protected boundary");
}

console.log("Character Forge resilience validation passed: unified player shell, account-isolated host, source-owned species/background/class choices, mockup-aligned read-only Class guide with routed decisions, movable/dismissible feature details, Species identity controls, targeted Continue guidance, player Training, ability methods, review dossier, and protected boundaries are intact.");