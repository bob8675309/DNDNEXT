import fs from "node:fs";

const read = (path) => {
  if (!fs.existsSync(path)) throw new Error(`Unified Character Forge validation failed: missing ${path}`);
  return fs.readFileSync(path, "utf8");
};
const expect = (condition, message) => { if (!condition) throw new Error(`Unified Character Forge validation failed: ${message}`); };
const includes = (source, tokens, label) => tokens.forEach((token) => expect(source.includes(token), `${label} missing ${token}`));

const playerCreator = read("components/PlayerCharacterCreatorV2.js");
const sharedForge = read("components/NewNpcModalV3.js");
const forge = read("components/NewNpcModalV3Refined.js");
const forgeController = read("components/useNpcForgeController.js");
const forgeDerived = read("components/useNpcForgeDerivedModel.js");
const forgeSteps = read("components/NpcForgeStepContent.js");
const forgeCore = read("components/NpcForgeCoreSupport.js");
const forgeSource = `${forge}\n${forgeController}\n${forgeDerived}\n${forgeSteps}\n${forgeCore}`;
const abilityStep = read("components/NpcForgeAbilityStep.js");
const speciesBonus = read("components/NpcForgeSpeciesBonusPanel.js");
const trainingStep = read("components/NpcForgeTrainingStep.js");
const spellStep = read("components/NpcForgeSpellStep.js");
const review = read("components/NpcForgeReviewPanel.js");
const rules = read("utils/playerForgeRules.js");
const spellSources = read("utils/playerForgeSpellSources.js");
const profile = read("components/PlayerCharacterProfilePanelUnified.js");
const profileEntry = read("components/PlayerCharacterProfilePanel.js");
const responsive = read("styles/character-forge-responsive.css");
const app = read("pages/_app.js");
const migration = read("sql/20260804_01_multi_player_character_forge_v2.sql");
const progressionFix = read("sql/20260804_02_player_forge_progression_upsert.sql");
const spellMigration = read("sql/20260805_02_player_forge_starting_spell_validation.sql");
const authorityMigration = read("sql/20260805_03_player_character_authority_hardening.sql");
const startingMagicAuthority = read("sql/20260808_04_player_forge_starting_magic_authority.sql");

includes(playerCreator, ['import NewNpcModalV3 from "./NewNpcModalV3";', 'mode="player"', "onCreated={onCreated}", "onClose={onCancel}"], "player creator adapter");
expect(!/^\s*import\s+PlayerCharacterForgeView\b/m.test(playerCreator), "retired standalone player creator returned");
includes(sharedForge, [
  'props?.mode === "player"',
  "const createCharacter = useCallback",
  "playerForgeProxySpellChoices",
  'String(entry?.source_type || "class") === "class"',
  'String(entry?.access_type || "class-list") !== "background-expanded"',
  'supabase.rpc("create_player_character_v3"',
  "p_spell_choices: proxySpellChoices",
  "p_magic_selections: magicSelections",
  "startingMagicSelections",
  "startingSpellSelectionPending",
  "createCharacter={createCharacter}",
], "shared Forge player mode");
expect(!sharedForge.includes('supabase.rpc("create_player_character_v2"'), "shared Forge still stops at the v2 starting-magic boundary");
expect(!sharedForge.includes("p_spell_choices: []"), "player Forge still discards starting spell choices");
expect(!sharedForge.includes("supabase.rpc =") && !sharedForge.includes("MutationObserver"), "player mode returned to RPC or DOM interception");

includes(forgeSource, ["NPC_STEP_LABELS", "PLAYER_STEP_LABELS", '"Spells"', 'type="number" min="1" max="20"', 'mode = "npc"', "NpcForgeAbilityStep", "NpcForgeSpeciesBonusPanel", "NpcForgeTrainingStep", "NpcForgeSpellStep", "NpcForgeReviewPanel", "NpcForgeContextPanel", "NpcForgePortraitPickerModal", "spellChoicesForRpc", "serializeStartingMagicSelections", "startingMagicSelections", "Create Player Character", "Starting level may be set from 1 to 20.", "playerMode ? [] : draft.additionalFeats || []"], "canonical shared Forge");
includes(abilityStep, ["Ability Score Generation Method", "Standard 3d6", "4d6 drop lowest die", "Point Buy", "Standard Class Array", "Manual Assign", "Reroll All Six", "Species Bonus stays in the right information panel"], "ability step");
includes(speciesBonus, ["Species Bonus", "+2 in one stat and +1 in a different stat", "+1 in three different stats", "Choose a feat"], "contextual Species Bonus");
expect(!abilityStep.includes("npc-forge-species-bonus mt-4"), "Species Bonus controls returned to the Abilities main workspace");
includes(trainingStep, ["Background Grants", "Class Skills", "Training Choices", "Crafting Professions", "Feat &amp; Class Choices", "each uses one Training choice", "Recipe-specific work sites and crafting times", "NpcForgeTrainingStepBase", "NpcForgeSourceChoiceFields"], "training step");
expect(!trainingStep.includes("Expertise is not self-assigned during creation"), "player Training still shows the redundant Expertise denial");
includes(spellStep, ['from("class_level_progression")', 'from("spells_catalog")', "startingSpellSourceForRow", "Known spells", "Spellbook", "Prepared", "Highest spell level", "Background-expanded access"], "spell step");
includes(review, ["Confirm your player character", "Class Progression", "Ability Scores", "Training & Professions", "Starting Magic", "Story & Campaign Hooks", "Campaign Status", "Edit"], "review dossier");
includes(rules, ["POINT_BUY_BUDGET = 27", "POINT_BUY_MIN = 8", "POINT_BUY_MAX = 15", "startingSpellSelectionModel", "validateStartingSpellSelections", "spellChoicesForRpc"], "player Forge rules");
includes(spellSources, ["subclassStartingSpellSelectionModel", "startingSpellSourceForRow", "serializeStartingMagicSelections", "model?.fixedSpells", 'source_type: choice.sourceType || model?.sourceType || "class"', 'access_type: choice.accessType || null', 'access_type: "fixed"'], "multi-source starting magic serialization");

includes(profileEntry, ['import PlayerCharacterProfilePanelUnified from "./PlayerCharacterProfilePanelUnified";', "export default PlayerCharacterProfilePanelUnified;"], "profile entry");
includes(profile, ['supabase.rpc("get_my_player_characters_v2")', "const [characters, setCharacters] = useState([]);", "Create another character", "const isLoggedIn = !!sessionUser;", "is-forge-suspended"], "multi-character profile");
expect(profile.includes("if (!isLoggedIn) return null;") || profile.includes("if (!keepCreatorMounted) return null;"), "multi-character profile missing authenticated mount guard");
includes(responsive, ["max-height: calc(100dvh - 24px)", ".npc-forge-modal-v2 .npc-forge-body", "overflow-x: auto", ".npc-forge-modal-v2 .npc-forge-footer", "position: sticky", "@media (max-width: 720px)"], "responsive Forge CSS");
expect(app.includes('import "../styles/character-forge-responsive.css";'), "responsive stylesheet is not loaded");

includes(migration, ["get_my_player_characters_v2", "create_player_character_v2", "creation_request_id", "character_permissions", "character_progression", "startingSpellSelectionPending"], "guarded player creation");
includes(progressionFix, ["on conflict (character_id) do update", "class_level = excluded.class_level"], "progression upsert");
includes(spellMigration, ["validate_player_forge_starting_spells_v1", "character_progression_validate_player_forge_spells_v1", "deferrable initially deferred", "v_cantrips_required", "v_leveled_required", "v_prepared_required", "v_maximum_spell_level"], "starting spell authority migration");
includes(authorityMigration, ["guard_direct_character_authority_mutation_v1", "character_spells_direct_authority_guard_v1", "character_option_grants_direct_authority_guard_v1", "character_sheets_authority_fields_guard_v1", "validate_player_forge_authority_payload_v1", "character_progression_validate_player_forge_authority_v1"], "player feat and spell authority migration");
includes(startingMagicAuthority, [
  "create_player_character_v3",
  "p_magic_selections",
  "background-expanded",
  "source_type = 'subclass'",
  "create_player_character_v2(p_payload, v_proxy)",
  "delete from public.character_spells",
  "validate_player_forge_starting_magic_exactness_v1",
  "startingMagicSelections",
], "guarded multi-source starting magic authority");

for (const source of [playerCreator, sharedForge, forgeSource, abilityStep, speciesBonus, trainingStep, spellStep, review, rules, spellSources, profile, responsive, migration, progressionFix, spellMigration, authorityMigration, startingMagicAuthority]) {
  for (const forbidden of ["MapPageClient", "map_routes", "advance_all_characters", "weather", "route_segment_progress"]) expect(!source.includes(forbidden), `crossed protected world-map boundary ${forbidden}`);
}

console.log("Unified Character Forge, guarded v3 multi-source starting magic, fixed subclass spells, Background-expanded access, contextual Species Bonus, shared Training choices, player feat/spell authority, review dossier, and protected boundaries validated.");