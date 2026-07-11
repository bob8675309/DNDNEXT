import fs from "node:fs";
import path from "node:path";

const requiredFiles = [
  "sql/20260710_02_character_progression_foundation.sql",
  "sql/20260710_03_character_progression_rpc_grants.sql",
  "sql/20260710_04_character_xp_level_up_review.sql",
  "sql/20260710_05_player_character_creation_and_starting_spells.sql",
  "sql/20260710_06_player_creation_progression_trigger_guard.sql",
  "sql/20260710_07_transactional_level_up_completion.sql",
  "sql/20260711_01_canonical_spell_class_and_character_option_catalogs.sql",
  "sql/20260711_02_prefer_canonical_spell_and_class_versions.sql",
  "components/CharacterClassPanel.js",
  "components/CharacterLevelUpChoices.js",
  "components/CharacterFeaturesPanel.js",
  "components/PlayerCharacterCreatorV2.js",
  "components/PlayerCharacterProfilePanel.js",
  "components/character/CharacterInteractionPanel.js",
  "pages/admin/spells.js",
  "pages/admin/character-options.js",
  "scripts/import_5etools_character_options.mjs",
  "scripts/lib/5etoolsSpellMetadata.mjs",
  "utils/characterCreationGuidance.js",
  "docs/Character_Progression_Foundation.md",
];

for (const rel of requiredFiles) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Character class progression validation failed: missing ${rel}`);
  const stats = fs.statSync(absolute);
  if (!stats.isFile() || stats.size === 0) throw new Error(`Character class progression validation failed: empty ${rel}`);
}

const interactionSource = fs.readFileSync(path.join(process.cwd(), "components/character/CharacterInteractionPanel.js"), "utf8");
for (const token of ["CharacterClassPanel", "CharacterClassShell", "CharacterFeaturesPanel", "CharacterFeaturesShell", '"features"', "Features & Boons"]) {
  if (!interactionSource.includes(token)) throw new Error(`Character interaction progression validation failed: missing ${token}`);
}

const foundationSource = fs.readFileSync(path.join(process.cwd(), "sql/20260710_02_character_progression_foundation.sql"), "utf8");
for (const contract of ["class_catalog", "character_progression", "get_character_progression_v1", "set_character_progression_v1"]) {
  if (!foundationSource.includes(contract)) throw new Error(`Character class progression validation failed: missing database contract ${contract}`);
}

const reviewMigration = fs.readFileSync(path.join(process.cwd(), "sql/20260710_04_character_xp_level_up_review.sql"), "utf8");
for (const contract of [
  "character_level_up_sessions",
  "can_manage_character_progression_v1",
  "get_character_level_up_review_v1",
  "begin_character_level_up_v1",
  "cancel_character_level_up_v1",
  "metadata_ready",
  "source = 'XPHB'",
]) {
  if (!reviewMigration.includes(contract)) throw new Error(`Character class progression validation failed: missing review contract ${contract}`);
}

const playerMigration = fs.readFileSync(path.join(process.cwd(), "sql/20260710_05_player_character_creation_and_starting_spells.sql"), "utf8");
for (const contract of [
  "xphb_starting_spell_requirements_v1",
  "get_my_player_character_v1",
  "create_player_character_v1",
  "character_permissions",
  "character_progression",
  "character_spells",
  "rulesetSource','XPHB'",
]) {
  if (!playerMigration.includes(contract)) throw new Error(`Player character creation validation failed: missing ${contract}`);
}

const canonicalMigration = fs.readFileSync(path.join(process.cwd(), "sql/20260711_01_canonical_spell_class_and_character_option_catalogs.sql"), "utf8");
for (const contract of [
  "character_source_priority_v1",
  "spells_catalog_preferred",
  "class_catalog_preferred",
  "is_preferred_spell_version_v1",
  "is_preferred_class_version_v1",
  "character_option_catalog",
  "character_option_catalog_preferred",
  "character_option_grants",
  "grant_character_option_v1",
  "remove_character_option_grant_v1",
]) {
  if (!canonicalMigration.includes(contract)) throw new Error(`Canonical character catalog validation failed: missing ${contract}`);
}

const preferenceMigration = fs.readFileSync(path.join(process.cwd(), "sql/20260711_02_prefer_canonical_spell_and_class_versions.sql"), "utf8");
for (const contract of [
  "character_source_priority_v1(source)",
  "starting_spell_requirements_v2",
  "is_preferred_spell_version_v1",
  "is_preferred_class_version_v1",
]) {
  if (!preferenceMigration.includes(contract)) throw new Error(`Canonical progression preference validation failed: missing ${contract}`);
}

const levelUpMigration = fs.readFileSync(path.join(process.cwd(), "sql/20260710_07_transactional_level_up_completion.sql"), "utf8");
for (const contract of [
  "highest_spell_level_from_slots_v1",
  "unsupported_level_choice_features_v1",
  "complete_character_level_up_v1",
  "level_up_completed",
  "hp_method",
  "ability_increases",
  "spell_choices",
]) {
  if (!levelUpMigration.includes(contract)) throw new Error(`Transactional level-up validation failed: missing ${contract}`);
}

const classPanel = fs.readFileSync(path.join(process.cwd(), "components/CharacterClassPanel.js"), "utf8");
for (const token of [
  "CharacterLevelUpChoices",
  "preferredClassRows",
  'supabase.rpc("can_manage_character_progression_v1"',
  'supabase.rpc("add_character_xp_v1"',
  'supabase.rpc("begin_character_level_up_v1"',
  'supabase.rpc("cancel_character_level_up_v1"',
  "handleLevelUpCompleted",
  "Review Level Up",
]) {
  if (!classPanel.includes(token)) throw new Error(`Character class progression validation failed: missing Class panel token ${token}`);
}

const levelChoiceSource = fs.readFileSync(path.join(process.cwd(), "components/CharacterLevelUpChoices.js"), "utf8");
for (const token of [
  "Ability Score Improvement or Feat",
  'from("spells_catalog_preferred")',
  'supabase.rpc("complete_character_level_up_v1"',
  "Apply Level",
  "spell_choices",
]) {
  if (!levelChoiceSource.includes(token)) throw new Error(`Level-up choice form validation failed: missing ${token}`);
}

const creatorSource = fs.readFileSync(path.join(process.cwd(), "components/PlayerCharacterCreatorV2.js"), "utf8");
for (const token of [
  "rollAbilityPool",
  "defaultRollAllocation",
  "4d6, drops the lowest die",
  "flexibleAbilityBoosts",
  'from("class_catalog_preferred")',
  'from("spells_catalog_preferred")',
  "campaign bonus feat",
  'supabase.rpc("create_player_character_v1"',
  "Create and link character",
]) {
  if (!creatorSource.includes(token)) throw new Error(`Source-aware player character creator validation failed: missing ${token}`);
}

const profileSource = fs.readFileSync(path.join(process.cwd(), "components/PlayerCharacterProfilePanel.js"), "utf8");
for (const token of [
  'import("./PlayerCharacterCreatorV2")',
  'supabase.rpc("get_my_player_character_v1")',
  "handleCharacterCreated",
]) {
  if (!profileSource.includes(token)) throw new Error(`Player profile creator handoff validation failed: missing ${token}`);
}

const featureSource = fs.readFileSync(path.join(process.cwd(), "components/CharacterFeaturesPanel.js"), "utf8");
for (const token of [
  'from("character_option_catalog_preferred")',
  'supabase.rpc("get_character_option_grants_v1"',
  'supabase.rpc("grant_character_option_v1"',
  'supabase.rpc("remove_character_option_grant_v1"',
  "Epic Boons",
]) {
  if (!featureSource.includes(token)) throw new Error(`Character feature grant validation failed: missing ${token}`);
}

const optionImporter = fs.readFileSync(path.join(process.cwd(), "scripts/import_5etools_character_options.mjs"), "utf8");
for (const token of ["feats.json", "backgrounds.json", "races.json", "skills.json", "option_key", "Preview/batch generation only"]) {
  if (!optionImporter.includes(token)) throw new Error(`Character option importer validation failed: missing ${token}`);
}

const metadataSource = fs.readFileSync(path.join(process.cwd(), "scripts/lib/5etoolsSpellMetadata.mjs"), "utf8");
for (const token of ["findProgressionColumn", "prepared\\s+spells", "spells_known_progression: spellsKnownProgression"]) {
  if (!metadataSource.includes(token)) throw new Error(`Spell progression parser validation failed: missing ${token}`);
}

console.log("Canonical all-source character creation, progression, spell selection, and feature-grant contracts validated.");
