import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const required = (text, token, label) => { if (!text.includes(token)) throw new Error(`${label}: missing ${token}`); };
const forbidden = (text, token, label) => { if (text.includes(token)) throw new Error(`${label}: protected or legacy token present: ${token}`); };

const steps = read("components/NpcForgeStepContent.js");
const training = read("components/NpcForgeTrainingStep.js");
const ability = read("components/NpcForgeAbilityStep.js");
const classGuide = read("components/NpcForgeClassGuide.js");
const classDock = read("components/NpcForgeClassFeatureDock.js");
const context = read("components/NpcForgeContextPanelRefined.js");
const sourceUi = read("components/SourceChoiceFields.js");
const sourceContext = read("components/NpcForgeSourceChoiceContext.js");
const spellStep = read("components/NpcForgeSpellStep.js");
const review = read("components/NpcForgeReviewPanel.js");
const species = read("utils/speciesPresentation.js");
const speciesChoices = read("utils/playerForgeSpeciesChoices.js");
const featRouting = read("utils/playerForgeFeatChoiceRouting.js");
const autoCasting = read("utils/playerForgeAutomaticCasting.js");
const registrar = read("components/NpcForgeFeatChoiceRegistrar.js");
const m86 = read("sql/20260810_86_player_forge_source_magic_materialization.sql");
const m87 = read("sql/20260810_87_source_magic_level_parser_fix.sql");
const m88 = read("sql/20260810_88_source_magic_feat_name_normalization_fix.sql");
const all = [steps, training, ability, classGuide, classDock, context, sourceUi, sourceContext, spellStep, review, species, speciesChoices, featRouting, autoCasting, registrar, m86, m87, m88].join("\n");

for (const token of ["speciesFixedLanguages", "fixed-languages", "autoSelect: true", "!playerMode && selectedSpecies?.lineages?.length"]) required(steps, token, "Species presentation routing");
forbidden(steps, "{playerMode && selectedSpecies?.lineages?.length ?", "Player lineage presentation");
for (const token of ["Skills & Proficiencies", "Feats & Class Abilities", 'placement="advancement"', 'placement="class"']) required(training, token, "Training decision hub");
forbidden(ability, "NpcForgeSourceChoiceFields", "Ability feat routing");
for (const token of ["ChoiceRoutingNote", "Persistent feature choices are completed in Training or Spells"]) required(classGuide, token, "Class explanation routing");
forbidden(classGuide, "NpcForgeClassFeatureChoices", "Class explanation routing");
forbidden(classDock, "NpcForgeSourceChoiceFields", "Class dock explanation routing");
for (const token of ["RichField", "npc-forge-rich-choice", "eldritch-invocation", "artificer-plan"]) required(sourceUi, token, "Rich catalogue choices");
for (const token of ["resolverPlacement", "applyAutomaticSourceSelections", "sourceChoiceFieldResolverPlacement", "sourceChoiceGroupsForResolverPlacement"]) required(sourceContext, token, "Source resolver placement");
required(sourceContext, 'String(field?.kind || "") === "spell"', "Mixed feat source-magic field routing");
for (const token of ["directCantripChoiceField", "fixedSpeciesSpellFields", '"spells"', "autoCastingAbility"]) required(speciesChoices, token, "Species source magic routing");
for (const token of ["STRIXHAVEN_COLLEGES", "fixedCollegeForBackground", "routeStrixhaven", "routeMagicInitiate", "bestEligibleCastingAbility", "autoSelect: true"]) required(featRouting, token, "Feat source magic routing");
for (const token of ["bestEligibleCastingAbility", "classPreferred", "STABLE_PRIORITY"]) required(autoCasting, token, "Automatic casting resolver");
for (const token of ["routeFeatSourceChoiceGroups", "finalAbilities: controller?.finalAbilities", "selectedBackground: controller?.selectedBackground"]) required(registrar, token, "Feat routing registrar");
for (const token of ["sourceSpellGroups", "Source-owned magic", "NpcForgeSourceChoiceFields", "automaticCastingForGroup", "No base-class spell catalogue selection is required", "sourceChoiceGroupsForResolverPlacement", "groupsOverride={sourceSpellGroups}"]) required(spellStep, token, "Unified Spell step");
for (const token of ["automaticSourceMagic", "Feats & Class Abilities", "sourceMagicChoices", "automaticCastingAbilityLabel"]) required(review, token, "Review source magic");
for (const token of ["speciesFixedLanguages", "Languages"] ) required(species, token, "Fixed language parser");

for (const token of [
  "player_forge_best_casting_ability_v1",
  "player_forge_trait_has_spell_v1",
  "player_forge_json_spell_min_level_v1",
  "player_forge_species_spell_choice_limit_v1",
  "upsert_player_forge_source_magic_spell_v1",
  "materialize_player_forge_source_magic_v1",
  "character_progression_materialize_player_forge_source_magic_v1",
  "new.character_id,v_spell.id,'species'",
  "new.character_id,v_spell.id,'feat'",
]) required(m86.replace(/\s+/g, " "), token.replace(/\s+/g, " "), "Migration 86 source authority");
required(m87, "'^[0-9]+$'", "Migration 87 level parser correction");
required(m87, "[[:space:]]+", "Migration 87 choice parser correction");
required(m88, "='magic initiate'", "Migration 88 feat normalization correction");
required(m88, "='strixhaven initiate'", "Migration 88 feat normalization correction");
forbidden(m88, "='magicinitiate'", "Migration 88 feat normalization correction");
forbidden(m88, "='strixhaveninitiate'", "Migration 88 feat normalization correction");

for (const protectedToken of ["MapPageClient", "map_routes", "map_route_points", "advance_all_characters", "time_scale", "weather", "town map", "world map", "craft_recipe", "encounter_action"]) {
  forbidden(`${m86}\n${m87}\n${m88}`, protectedToken, "Source magic migrations");
}

required(all, "shared_character_forge_player_v2", "Forge creator authority");
console.log("Player Forge source-defined languages, routed Training choices, rich catalogues, Species/Feat source magic including mixed feat field routing, automatic casting ability, noncaster Spell resolution, server materialization, and protected-boundary isolation validated.");
