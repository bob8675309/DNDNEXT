import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const requireToken = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Progression v3: ${label} is missing ${token}`);
};
const forbidToken = (source, token, label) => {
  if (source.includes(token)) throw new Error(`Progression v3: ${label} must not contain ${token}`);
};

execFileSync(process.execPath, [path.join(root, "scripts/validate_character_class_progression.mjs")], { stdio: "inherit" });

const ui = read("components/CharacterLevelUpChoices.js");
for (const token of [
  'supabase.rpc("get_character_level_class_choice_options_v1"',
  "classChoiceGroups",
  "classChoiceSelections",
  "sourceChoiceGroupsComplete",
  "class_choice_selections",
  'kicker="Class progression"',
  "loadingClassChoices",
  "spellMatchesLevelClassAccess",
  "magicalSecretsAccess",
  "Magical Secrets expands these new Bard spell choices",
  '["bard", "cleric", "druid", "wizard"]',
]) requireToken(ui, token, "earned level-up source-choice and spell-access UI");

const sourceFields = read("components/SourceChoiceFields.js");
for (const token of ["sourceChoiceFieldIsActive", "activeFields", "replacementCadence"]) requireToken(sourceFields, token, "dependent source-choice renderer");

const invocationBuilder = read("utils/warlockInvocationChoices.js");
for (const token of [
  "XPHB_INVOCATION_SLOT_LEVELS",
  "buildWarlockInvocationSourceGroups",
  "warlockInvocationSelections",
  'ownerType: "class-option"',
  'family: "eldritch-invocation"',
  "warlock-damage-cantrip",
  "warlock-attack-cantrip",
  "origin-feat",
  "distinctPerRepeat",
  'replacementCadence: "level-up"',
]) requireToken(invocationBuilder, token, "Warlock Invocation source instances");

const registrar = read("components/NpcForgeFeatChoiceRegistrar.js");
for (const token of [
  "buildWarlockInvocationSourceGroups",
  'from("class_feature_option_catalog")',
  '"class-options"',
  "classOptionReady",
  "warlock-invocation-slot-",
]) requireToken(registrar, token, "Forge Invocation registrar");

const guideModel = read("components/NpcForgeClassGuideModel.js");
for (const token of [
  "applyClassFeatureOptionAuthority",
  'from("class_feature_option_catalog")',
  "invocationSourceActive",
  'group.kind === "eldritch-invocation"',
]) requireToken(guideModel, token, "canonical optional-feature class guide");

const classChoicesUi = read("components/NpcForgeClassFeatureChoices.js");
for (const token of [
  "NpcForgeSourceChoiceFields",
  'ownerType="class-option"',
  'title="Source-owned class option instances"',
]) requireToken(classChoicesUi, token, "source-owned Class workspace");

const simple = read("sql/20260808_16_simple_class_choice_delta_authority.sql");
for (const token of [
  "simple_level_class_choice_groups_v1",
  "get_character_level_class_choice_options_v1",
  "apply_simple_level_class_choices_v1",
  "Fighting Style",
  "Scholar Expertise",
  "Primal Knowledge",
  "Deft Explorer Languages",
  "Blessed Strikes",
  "Elemental Fury",
  "character_option_grant_instances",
  "classFeatureChoices",
]) requireToken(simple, token, "simple class-choice authority");

const enable = read("sql/20260808_17_enable_simple_class_choice_level_up.sql");
for (const token of [
  "unsupported_level_choice_features_v1",
  "level_up_persistent_choice_gaps_v1",
  "complete_character_level_up_v3",
  "class_choice_selections",
  "class_choice_delta",
  "Eldritch Invocations +",
]) requireToken(enable, token, "v3 class-choice enablement and historical fail-closed boundary");

const spellAccess = read("sql/20260808_19_source_aware_level_up_spell_access.sql");
for (const token of [
  "level_up_spell_access_v1",
  "magical-secrets",
  "background-expanded",
  "complete_character_level_up_base_v3",
  "complete_character_level_up_v3",
  "accessType",
  "lower(listed) in ('bard', 'cleric', 'druid', 'wizard')",
  "Eldritch Invocations +",
]) requireToken(spellAccess, token, "source-aware earned spell access");
forbidToken(spellAccess, "Magical Secrets spell access", "current persistent-choice gap list");

const optionCatalog = read("sql/20260808_20_class_feature_option_catalog.sql");
for (const token of [
  "class_feature_option_catalog",
  "import_class_feature_option_batch_v1",
  "eldritch-invocation",
  "Devouring Blade",
  "Thirsting Blade",
  "Visions of Distant Realms",
  '"minClassLevel":9',
  "origin-feat",
  "warlock-damage-cantrip",
  "warlock-attack-cantrip",
  "book-of-shadows-spells",
  "short-or-long-rest",
]) requireToken(optionCatalog, token, "canonical optional class-feature catalogue");

const classOptionAuthority = read("sql/20260808_21_player_forge_class_option_instance_authority.sql");
for (const token of [
  "character_class_option_grant_instances",
  "validate_and_materialize_player_forge_class_options_v1",
  "get_character_class_option_grants_v1",
  "xphb_warlock_invocation_count_v1",
  "xphb_warlock_invocation_slot_level_v1",
  "Repeated % instances must use different dependent choices",
  "Lessons of the First Ones feat instance must match its Invocation source choice",
]) requireToken(classOptionAuthority, token, "normalized Player Forge class-option authority");

const legacyGate = read("sql/20260808_22_tighten_player_forge_class_option_legacy_gate.sql");
for (const token of [
  "reject_unmarked_legacy_warlock_invocations_v1",
  "player_forge_source_choice_legacy_v1",
  "New XPHB Warlocks must use source-owned Eldritch Invocation instances",
]) requireToken(legacyGate, token, "server-owned legacy gate");

const spellSlotFix = read("sql/20260808_23_fix_player_forge_spell_slot_json_validation.sql");
for (const token of [
  "validate_player_forge_starting_spells_v1",
  "v_spell_slots jsonb",
  "coalesce(p.spell_slots, '[]'::jsonb)",
  "jsonb_array_elements(v_spell_slots)",
  "pactSlotLevel",
]) requireToken(spellSlotFix, token, "shared Forge spell-slot JSON validation");

const optionImporter = read("scripts/import_5etools_optional_features.mjs");
for (const token of [
  "optionalfeatures.json",
  "class_feature_option_batch",
  "eldritch-invocation",
  "battle-master-maneuver",
  "arcane-shot",
  "metamagic",
  "raw_payload: raw",
  "Preview/batch generation complete. No database writes were performed.",
]) requireToken(optionImporter, token, "optional class-feature importer");

const delta = read("utils/characterClassChoiceDeltaPlan.js");
for (const token of [
  "buildClassChoiceLevelDeltaPlan",
  "classChoiceSelectionsFromAuthority",
  "mergeClassChoiceDeltaAuthority",
  "classChoiceDeltaGroups",
  "progressionReplacement",
  "eldritch-invocation",
  "metamagic",
  "mystic arcanum",
]) requireToken(delta, token, "shared class-choice delta planner");

console.log("Progression v3 class choices, source-aware spell access, normalized Invocation authority, optional-feature catalogue, and fail-closed complex-choice boundary validated.");
