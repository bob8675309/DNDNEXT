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
const forgeSteps = read("components/NpcForgeStepContent.js");
const forgeCore = read("components/NpcForgeCoreSupport.js");
const forgeSource = `${forge}\n${forgeController}\n${forgeSteps}\n${forgeCore}`;
const abilityStep = read("components/NpcForgeAbilityStep.js");
const trainingStep = read("components/NpcForgeTrainingStep.js");
const spellStep = read("components/NpcForgeSpellStep.js");
const review = read("components/NpcForgeReviewPanel.js");
const rules = read("utils/playerForgeRules.js");
const profile = read("components/PlayerCharacterProfilePanelUnified.js");
const profileEntry = read("components/PlayerCharacterProfilePanel.js");
const responsive = read("styles/character-forge-responsive.css");
const app = read("pages/_app.js");
const migration = read("sql/20260804_01_multi_player_character_forge_v2.sql");
const progressionFix = read("sql/20260804_02_player_forge_progression_upsert.sql");
const spellMigration = read("sql/20260805_02_player_forge_starting_spell_validation.sql");

includes(playerCreator, ['import NewNpcModalV3 from "./NewNpcModalV3";', 'mode="player"', "onCreated={onCreated}", "onClose={onCancel}"], "player creator adapter");
expect(!/^\s*import\s+PlayerCharacterForgeView\b/m.test(playerCreator), "retired standalone player creator returned");
includes(sharedForge, ['props?.mode === "player"', "const createCharacter = useCallback", 'supabase.rpc("create_player_character_v2"', "p_spell_choices: spellChoices", "playerPayload(payload, spellChoices)", "startingSpellSelectionPending", "createCharacter={createCharacter}"], "shared Forge player mode");
expect(!sharedForge.includes("p_spell_choices: []"), "player Forge still discards starting spell choices");
expect(!sharedForge.includes("supabase.rpc =") && !sharedForge.includes("MutationObserver"), "player mode returned to RPC or DOM interception");

includes(forgeSource, ["NPC_STEP_LABELS", "PLAYER_STEP_LABELS", '"Spells"', 'type="number" min="1" max="20"', 'mode = "npc"', "NpcForgeAbilityStep", "NpcForgeTrainingStep", "NpcForgeSpellStep", "NpcForgeReviewPanel", "NpcForgeContextPanel", "NpcForgePortraitPickerModal", "spellChoicesForRpc", "Create Player Character", "Starting level may be set from 1 to 20."], "canonical shared Forge");
includes(abilityStep, ["Ability Score Generation Method", "Standard 3d6", "4d6 drop lowest die", "Point Buy", "Standard Class Array", "Manual Assign", "Reroll All Six", "Species Bonus", "Choose a feat"], "ability step");
includes(trainingStep, ["Background grants", "Class choices", "Expertise is not self-assigned", "Campaign crafting house rule", "Short or Long Rest", "physical work site"], "training step");
includes(spellStep, ['from("class_level_progression")', 'from("spells_catalog")', "Known spells", "Spellbook", "Prepared", "Highest spell level"], "spell step");
includes(review, ["Confirm your player character", "Class Progression", "Ability Scores", "Training & Professions", "Starting Magic", "Story & Campaign Hooks", "Campaign Status", "Edit"], "review dossier");
includes(rules, ["POINT_BUY_BUDGET = 27", "POINT_BUY_MIN = 8", "POINT_BUY_MAX = 15", "startingSpellSelectionModel", "validateStartingSpellSelections", "spellChoicesForRpc"], "player Forge rules");

includes(profileEntry, ['import PlayerCharacterProfilePanelUnified from "./PlayerCharacterProfilePanelUnified";', "export default PlayerCharacterProfilePanelUnified;"], "profile entry");
includes(profile, ['supabase.rpc("get_my_player_characters_v2")', "const [characters, setCharacters] = useState([]);", "Create another character", "keepCreatorMounted", "is-forge-suspended"], "multi-character profile");
includes(responsive, ["max-height: calc(100dvh - 24px)", ".npc-forge-modal-v2 .npc-forge-body", "overflow-x: auto", ".npc-forge-modal-v2 .npc-forge-footer", "position: sticky", "@media (max-width: 720px)"], "responsive Forge CSS");
expect(app.includes('import "../styles/character-forge-responsive.css";'), "responsive stylesheet is not loaded");

includes(migration, ["get_my_player_characters_v2", "create_player_character_v2", "creation_request_id", "character_permissions", "character_progression", "startingSpellSelectionPending"], "guarded player creation");
includes(progressionFix, ["on conflict (character_id) do update", "class_level = excluded.class_level"], "progression upsert");
includes(spellMigration, ["validate_player_forge_starting_spells_v1", "character_progression_validate_player_forge_spells_v1", "deferrable initially deferred", "v_cantrips_required", "v_leveled_required", "v_prepared_required", "v_maximum_spell_level"], "starting spell authority migration");

for (const source of [playerCreator, sharedForge, forgeSource, abilityStep, trainingStep, spellStep, review, rules, profile, responsive, migration, progressionFix, spellMigration]) {
  for (const forbidden of ["MapPageClient", "map_routes", "advance_all_characters", "weather", "route_segment_progress"]) expect(!source.includes(forbidden), `crossed protected world-map boundary ${forbidden}`);
}

console.log("Unified Character Forge, restored starting spells, ability methods, training guidance, review dossier, and protected boundaries validated.");
