import fs from "node:fs";

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Unified Character Forge validation failed: missing ${path}`);
  return fs.readFileSync(path, "utf8");
}
function requireTokens(source, label, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`Unified Character Forge validation failed: ${label} missing ${token}`);
  }
}

const playerCreator = read("components/PlayerCharacterCreatorV2.js");
const sharedForge = read("components/NewNpcModalV3.js");
const refinedForge = read("components/NewNpcModalV3Refined.js");
const profile = read("components/PlayerCharacterProfilePanelUnified.js");
const profileEntry = read("components/PlayerCharacterProfilePanel.js");
const responsive = read("styles/character-forge-responsive.css");
const app = read("pages/_app.js");
const migration = read("sql/20260804_01_multi_player_character_forge_v2.sql");
const status = read("docs/Unified_Character_Forge_Status.md");

requireTokens(playerCreator, "player creator adapter", [
  'import NewNpcModalV3 from "./NewNpcModalV3";',
  'mode="player"',
  "onCreated={onCreated}",
  "onClose={onCancel}",
]);
if (playerCreator.includes("export default function PlayerCharacterCreatorV2") && playerCreator.includes("PlayerCharacterForgeView")) {
  throw new Error("Unified Character Forge validation failed: the retired standalone player view must not be rendered by the active player creator.");
}

requireTokens(sharedForge, "shared Forge player mode", [
  'props?.mode === "player"',
  'functionName !== "create_character_v1"',
  'invokeOriginal("create_player_character_v2"',
  "p_spell_choices: []",
  'creator: "shared_character_forge_player_v2"',
  "startingSpellSelectionPending",
  "Player Character Forge",
  "Starting level may be set from 1 to 20.",
  "originalRpcRef.current",
  "supabase.rpc = originalRpcRef.current",
]);
requireTokens(refinedForge, "canonical shared Forge", [
  'const STEP_LABELS = Object.freeze(["Species", "Background", "Class", "Abilities", "Training", "Identity", "Story", "Review"]);',
  'type="number" min="1" max="20"',
  'supabase.rpc("create_character_v1"',
  "NpcForgeContextPanel",
  "NpcForgePortraitPickerModal",
]);

requireTokens(profileEntry, "profile entry", [
  'import PlayerCharacterProfilePanelUnified from "./PlayerCharacterProfilePanelUnified";',
  "export default PlayerCharacterProfilePanelUnified;",
]);
requireTokens(profile, "multi-character profile", [
  'supabase.rpc("get_my_player_characters_v2")',
  "const [characters, setCharacters] = useState([]);",
  "Create another character",
  "player-character-forge-toolbar",
  "preferredCharacterId",
  "handleCharacterCreated",
  'document.addEventListener("keydown", onKeyDown, true)',
]);

requireTokens(responsive, "responsive Forge CSS", [
  "max-height: calc(100dvh - 24px)",
  ".npc-forge-modal-v2 .npc-forge-body",
  "overflow-x: auto",
  ".npc-forge-modal-v2 .npc-forge-footer",
  "position: sticky",
  "env(safe-area-inset-bottom)",
  "@media (max-width: 720px)",
  "height: 100dvh",
  ".player-character-forge-toolbar",
]);
if (!app.includes('import "../styles/character-forge-responsive.css";')) {
  throw new Error("Unified Character Forge validation failed: responsive stylesheet is not loaded by the app shell.");
}

requireTokens(migration, "guarded v2 player creation", [
  "get_my_player_characters_v2",
  "create_player_character_v2",
  "creation_request_id",
  "Starting level must be between 1 and 20.",
  "character_permissions",
  "character_progression",
  "player_character_created",
  "startingSpellSelectionPending",
  "grant execute on function public.create_player_character_v2",
]);
if (migration.includes("This account already has a linked player character")) {
  throw new Error("Unified Character Forge validation failed: v2 must permit more than one player character.");
}
if (migration.includes("New player characters must begin at level 1")) {
  throw new Error("Unified Character Forge validation failed: v2 must permit campaign-approved starting levels 1-20.");
}

requireTokens(status, "status handoff", [
  "Rinshin",
  "one shared Forge",
  "levels 1–20",
  "starting spell-selection parity",
  "Dawn",
]);

for (const source of [playerCreator, sharedForge, profile, responsive, migration]) {
  for (const forbidden of ["MapPageClient", "map_routes", "advance_all_characters", "weather", "route_segment_progress"]) {
    if (source.includes(forbidden)) throw new Error(`Unified Character Forge validation failed: crossed protected world-map boundary ${forbidden}`);
  }
}

console.log("Unified NPC/player Character Forge, multi-character ownership, and responsive reachability contracts validated.");
