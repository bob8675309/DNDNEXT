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
  "sql/20260712_01_profile_sheet_class_refinements.sql",
  "sql/20260720_01_subclass_compatibility_and_selection.sql",
  "sql/20260720_02_subclass_sheet_sync.sql",
  "components/CharacterClassPanel.js",
  "components/CharacterClassWorkspace.js",
  "components/CharacterLevelUpChoices.js",
  "components/CharacterFeaturesPanel.js",
  "components/CharacterSheetEnhancements.js",
  "components/CharacterSheetPanel.js",
  "components/PlayerCharacterCreatorV2.js",
  "components/PlayerCharacterProfilePanel.js",
  "components/character/CharacterInteractionContext.js",
  "components/character/CharacterInteractionPanel.js",
  "pages/admin/spells.js",
  "pages/admin/character-options.js",
  "pages/admin/class-features.js",
  "scripts/import_5etools_character_options.mjs",
  "scripts/import_5etools_class_features.mjs",
  "scripts/lib/5etoolsSpellMetadata.mjs",
  "styles/character-sheet-enhancements.css",
  "styles/character-class-workspace.css",
  "hooks/useSubclassCatalog.js",
  "utils/classes/classArtwork.js",
  "utils/classes/subclassCompatibility.js",
  "public/media/classes/adventurer.webp",
  "public/media/classes/artificer.webp",
  "public/media/classes/barbarian.webp",
  "public/media/classes/bard.webp",
  "public/media/classes/cleric.webp",
  "public/media/classes/druid.webp",
  "public/media/classes/fighter.webp",
  "public/media/classes/monk.webp",
  "public/media/classes/paladin.webp",
  "public/media/classes/ranger.webp",
  "public/media/classes/rogue.webp",
  "public/media/classes/sorcerer.webp",
  "public/media/classes/warlock.webp",
  "public/media/classes/wizard.webp",
  "utils/characterCreationGuidance.js",
  "utils/formatPrerequisiteText.js",
  "docs/Character_Progression_Foundation.md",
];

for (const rel of requiredFiles) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Character class progression validation failed: missing ${rel}`);
  const stats = fs.statSync(absolute);
  if (!stats.isFile() || stats.size === 0) throw new Error(`Character class progression validation failed: empty ${rel}`);
}

const interactionSource = fs.readFileSync(path.join(process.cwd(), "components/character/CharacterInteractionPanel.js"), "utf8");
for (const token of ["CharacterClassWorkspace", "CharacterClassShell", "CharacterFeaturesPanel", "CharacterFeaturesShell", "CharacterInteractionContext.Provider", '"features"', "Feats & Boons"]) {
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

const refinementMigration = fs.readFileSync(path.join(process.cwd(), "sql/20260712_01_profile_sheet_class_refinements.sql"), "utf8");
for (const contract of [
  "class_feature_catalog",
  "import_class_feature_batch_v1",
  "adjust_character_hit_points_v1",
  "can_manage_character_progression_v1",
  "v_absorbed := least(v_temp,v_damage)",
]) {
  if (!refinementMigration.includes(contract)) throw new Error(`Profile sheet refinement validation failed: missing ${contract}`);
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

const subclassMigration = fs.readFileSync(path.join(process.cwd(), "sql/20260720_01_subclass_compatibility_and_selection.sql"), "utf8");
for (const contract of [
  "get_class_subclass_options_v1",
  "resolve_subclass_choice_v1",
  "set_character_progression_v2",
  "complete_character_level_up_v2",
  "p_subclass_source",
  "security invoker",
  "private.can_manage_character_progression_v1",
  "revoke all on function public.complete_character_level_up_v2",
]) {
  if (!subclassMigration.includes(contract)) throw new Error(`Subclass compatibility validation failed: missing ${contract}`);
}

const subclassSheetSyncMigration = fs.readFileSync(path.join(process.cwd(), "sql/20260720_02_subclass_sheet_sync.sql"), "utf8");
for (const contract of [
  "set_character_progression_v2",
  "update public.character_sheets",
  "update public.players",
  "cp.can_edit",
  "subclassSource",
]) {
  if (!subclassSheetSyncMigration.includes(contract)) throw new Error(`Subclass sheet sync validation failed: missing ${contract}`);
}

const classPanel = fs.readFileSync(path.join(process.cwd(), "components/CharacterClassPanel.js"), "utf8");
for (const token of [
  "CharacterLevelUpChoices",
  "preferredClassRows",
  "useSubclassCatalog",
  "findSubclassOption",
  "progressionPreview",
  'supabase.rpc("can_manage_character_progression_v1"',
  'supabase.rpc("set_character_progression_v2"',
  'supabase.rpc("add_character_xp_v1"',
  'supabase.rpc("begin_character_level_up_v1"',
  'supabase.rpc("cancel_character_level_up_v1"',
  "handleLevelUpCompleted",
  "Review Level Up",
  "Current Level Features",
]) {
  if (!classPanel.includes(token)) throw new Error(`Character class progression validation failed: missing Class panel token ${token}`);
}

const classWorkspace = fs.readFileSync(path.join(process.cwd(), "components/CharacterClassWorkspace.js"), "utf8");
for (const token of [
  "Class Overview",
  "Detailed Guide",
  "Level 1–20 at a Glance",
  "Double-click to expand",
  "Close expanded level table",
  "Compare all",
  'from("class_level_progression")',
  'from("class_feature_catalog")',
  "resolveSubclassCatalog",
  "guideSubclassFeatures",
  "classArtworkFor",
  "handleClassArtworkError",
  "formatPlayerFacingText",
  "Feature Description",
  "Pinned Class Feature",
  "is-pinned",
  "Show subclass",
  "includeSubclassFeatures",
  "selectedOptionKey",
  "class-book-guide",
]) {
  if (!classWorkspace.includes(token)) throw new Error(`Class guide validation failed: missing ${token}`);
}
if (classWorkspace.includes('>Level 1–20 Guide</button>') || classWorkspace.includes('view === "guide"')) {
  throw new Error("Class guide validation failed: the retired top-level Level 1–20 Guide tab must not return.");
}
if (/\.eq\("class_source",\s*classRow\.source\)/.test(classWorkspace)) {
  throw new Error("Class guide validation failed: supplemental subclasses must not be hidden behind an exact class-source query.");
}

const classWorkspaceStyle = fs.readFileSync(path.join(process.cwd(), "styles/character-class-workspace.css"), "utf8");
for (const token of [
  ".class-level-guide-preview",
  ".class-level-guide-preview__table",
  ".class-expanded-guide__close",
  ".class-book-guide__hero img",
]) {
  if (!classWorkspaceStyle.includes(token)) throw new Error(`Class guide styling validation failed: missing ${token}`);
}

const levelChoiceSource = fs.readFileSync(path.join(process.cwd(), "components/CharacterLevelUpChoices.js"), "utf8");
for (const token of [
  "Ability Score Improvement or Feat",
  "useSubclassCatalog",
  'from("spells_catalog_preferred")',
  'supabase.rpc("complete_character_level_up_v2"',
  "subclass_source",
  "Apply Level",
  "spell_choices",
]) {
  if (!levelChoiceSource.includes(token)) throw new Error(`Level-up choice form validation failed: missing ${token}`);
}
if (/placeholder="Enter the chosen subclass"/.test(levelChoiceSource)) {
  throw new Error("Level-up choice validation failed: subclasses must be selected from the source-backed catalog, not entered as free text.");
}

const subclassCompatibilitySource = fs.readFileSync(path.join(process.cwd(), "utils/classes/subclassCompatibility.js"), "utf8");
for (const token of [
  "resolveSubclassCatalog",
  "effectiveSubclassLevel",
  "reprintOverlap",
  "isLegacyCompatibility",
  "findSubclassOption",
  "subclassIntroduction",
]) {
  if (!subclassCompatibilitySource.includes(token)) throw new Error(`Subclass compatibility helper validation failed: missing ${token}`);
}

const subclassCompatibilityModule = await import(`data:text/javascript;base64,${Buffer.from(subclassCompatibilitySource).toString("base64")}`);
const fixtureRows = [
  { feature_type: "subclass", class_source: "PHB", subclass_name: "Arcane Archer", subclass_short_name: "Arcane Archer", source: "XGE", level: 2, name: "Arcane Archer", description: "Introduction", raw_payload: { header: null } },
  { feature_type: "subclass", class_source: "PHB", subclass_name: "Arcane Archer", subclass_short_name: "Arcane Archer", source: "XGE", level: 2, name: "Arcane Shot", description: "Full legacy feature", raw_payload: { header: 1 } },
  { feature_type: "subclass", class_source: "PHB", subclass_name: "Arcane Archer", subclass_short_name: "Arcane Archer", source: "XGE", level: 7, name: "Curving Shot", description: "Full legacy feature", raw_payload: { header: 2 } },
  { feature_type: "subclass", class_source: "XPHB", subclass_name: "Arcane Archer", subclass_short_name: "Arcane Archer", source: "XGE", level: 3, name: "Arcane Archer", description: "Compatibility placeholder", raw_payload: { header: null } },
  { feature_type: "subclass", class_source: "XPHB", subclass_name: "Abjurer", subclass_short_name: "Abjurer", source: "XPHB", level: 3, name: "Arcane Ward", description: "Modern feature", raw_payload: { header: 1 } },
  { feature_type: "subclass", class_source: "XPHB", subclass_name: "Abjurer", subclass_short_name: "Abjurer", source: "XPHB", level: 10, name: "Spell Breaker", description: "Modern feature", raw_payload: { header: 2 } },
  { feature_type: "subclass", class_source: "PHB", subclass_name: "Abjuration", subclass_short_name: "Abjuration", source: "PHB", level: 2, name: "Arcane Ward", description: "Legacy reprint", raw_payload: { header: 1 } },
  { feature_type: "subclass", class_source: "PHB", subclass_name: "Abjuration", subclass_short_name: "Abjuration", source: "PHB", level: 10, name: "Spell Breaker", description: "Legacy reprint", raw_payload: { header: 2 } },
];
const resolvedFixture = subclassCompatibilityModule.resolveSubclassCatalog(fixtureRows, "XPHB");
const arcaneArcherFixture = subclassCompatibilityModule.findSubclassOption(resolvedFixture, "Arcane Archer", "XGE");
if (!arcaneArcherFixture || arcaneArcherFixture.classSource !== "PHB" || !arcaneArcherFixture.isLegacyCompatibility) {
  throw new Error("Subclass compatibility behavior failed: a complete supplemental definition must win over an XPHB placeholder.");
}
if (!subclassCompatibilityModule.guideSubclassFeatures(arcaneArcherFixture).some((feature) => feature.name === "Arcane Shot" && feature.level === 3 && feature.originalLevel === 2)) {
  throw new Error("Subclass compatibility behavior failed: a legacy entry feature must align to the 2024 level-3 subclass slot without losing its original level.");
}
if (resolvedFixture.some((option) => option.name === "Abjuration")) {
  throw new Error("Subclass compatibility behavior failed: a legacy reprint must be hidden when the modern subclass has the same meaningful feature set.");
}

const subclassHookSource = fs.readFileSync(path.join(process.cwd(), "hooks/useSubclassCatalog.js"), "utf8");
for (const token of ['from("class_feature_catalog")', 'eq("feature_type", "subclass")', "resolveSubclassCatalog"]) {
  if (!subclassHookSource.includes(token)) throw new Error(`Subclass catalog hook validation failed: missing ${token}`);
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
  'document.addEventListener("keydown", onKeyDown, true)',
  'event.code === "Backspace"',
]) {
  if (!profileSource.includes(token)) throw new Error(`Player profile creator or Backspace handoff validation failed: missing ${token}`);
}

const featureSource = fs.readFileSync(path.join(process.cwd(), "components/CharacterFeaturesPanel.js"), "utf8");
for (const token of [
  'from("character_option_catalog_preferred")',
  'supabase.rpc("get_character_option_grants_v1"',
  'supabase.rpc("grant_character_option_v1"',
  'supabase.rpc("remove_character_option_grant_v1"',
  "Feats & Boons",
  "Known",
  "Catalogue",
  "formatPrerequisiteText",
  "Epic Boons",
  "profile-catalogue-workspace",
  "profile-catalogue-toolbar",
  "categoryFilter",
  "Showing",
  "statusFilter",
  "removeSheetFeat",
  "Remove ${optionTypeLabel",
]) {
  if (!featureSource.includes(token)) throw new Error(`Character feat and boon validation failed: missing ${token}`);
}
if (featureSource.includes("sourceFilter") || /<span>Source<\/span><select/.test(featureSource)) {
  throw new Error("Character feat and boon validation failed: Source must not return as a catalogue filter.");
}
if (featureSource.lastIndexOf("{renderFilters(") > featureSource.lastIndexOf('<div className="profile-catalogue-workspace">')) {
  throw new Error("Character feat and boon validation failed: the filter toolbar must remain above the list/detail workspace.");
}

if (featureSource.includes('setView("admin")') || featureSource.includes('view === "admin"')) {
  throw new Error("Character feat and boon validation failed: admin actions must remain integrated into Catalogue.");
}

if (/const\s+(CatalogList|KnownList)\s*=|function\s+(CatalogList|KnownList)\s*\(/.test(featureSource)) {
  throw new Error("Character feat and boon search focus validation failed: render helpers must not be nested React component types.");
}

const adminItemSource = fs.readFileSync(path.join(process.cwd(), "pages/admin.js"), "utf8");
const adminExportIndex = adminItemSource.indexOf("export default function AdminPanel");
const boundaryIndex = adminItemSource.indexOf("function AdminErrorBoundary");
if (boundaryIndex < 0 || adminExportIndex < 0 || boundaryIndex > adminExportIndex) {
  throw new Error("Admin item search focus validation failed: AdminErrorBoundary must remain module-scoped.");
}

const catalogueStyleSource = fs.readFileSync(path.join(process.cwd(), "styles/profile-catalogue-workspace.css"), "utf8");
for (const token of [
  ".profile-catalogue-workspace",
  ".profile-catalogue-toolbar",
  ".profile-catalogue__filters",
  ".profile-catalogue__list",
  ".profile-catalogue__preview",
  ":focus-visible",
  "@media (max-width: 760px)",
]) {
  if (!catalogueStyleSource.includes(token)) throw new Error(`Profile catalogue workspace styling validation failed: missing ${token}`);
}

const sheetPanelSource = fs.readFileSync(path.join(process.cwd(), "components/CharacterSheetPanel.js"), "utf8");
for (const token of ["CharacterSheetEnhancements", "sheetRootRef", "onChange={setDraft}", "onSheetUpdated"]) {
  if (!sheetPanelSource.includes(token)) throw new Error(`Character sheet enhancement handoff failed: missing ${token}`);
}

const sheetEnhancementSource = fs.readFileSync(path.join(process.cwd(), "components/CharacterSheetEnhancements.js"), "utf8");
for (const token of [
  "FALLBACK_SKILL_DESCRIPTIONS",
  'from("class_feature_catalog")',
  'supabase.rpc("adjust_character_hit_points_v1"',
  "Take Damage",
  "Recover HP",
  "csheet-trait-description-list",
  "csheet-pinned-description",
  "setPinnedInfo",
]) {
  if (!sheetEnhancementSource.includes(token)) throw new Error(`Character sheet descriptions or HP controls validation failed: missing ${token}`);
}

const optionImporter = fs.readFileSync(path.join(process.cwd(), "scripts/import_5etools_character_options.mjs"), "utf8");
for (const token of ["feats.json", "backgrounds.json", "fluff-backgrounds.json", "backgroundLoreDetails", "races.json", "fluff-races.json", "firstLoreParagraph", "loreSource", "resolveRaceCopies", "languageProficiencies", "skills.json", "option_key", "Preview/batch generation only"]) {
  if (!optionImporter.includes(token)) throw new Error(`Character option importer validation failed: missing ${token}`);
}

const classFeatureImporter = fs.readFileSync(path.join(process.cwd(), "scripts/import_5etools_class_features.mjs"), "utf8");
for (const token of ["classFeature", "subclassFeature", "class-features-all-sources", "Preview/batch generation only", "/admin/class-features"]) {
  if (!classFeatureImporter.includes(token)) throw new Error(`Class feature importer validation failed: missing ${token}`);
}

const metadataSource = fs.readFileSync(path.join(process.cwd(), "scripts/lib/5etoolsSpellMetadata.mjs"), "utf8");
for (const token of ["findProgressionColumn", "prepared\\s+spells", "spells_known_progression: spellsKnownProgression"]) {
  if (!metadataSource.includes(token)) throw new Error(`Spell progression parser validation failed: missing ${token}`);
}

console.log("Canonical character creation, Known/Catalogue workspaces with integrated admin actions, pinned descriptions, quick HP, class guide, progression, and spell selection contracts validated.");
