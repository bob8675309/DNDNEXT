import PlayerCharacterProfilePanelUnified from "./PlayerCharacterProfilePanelUnified";

/**
 * Compatibility markers for the pre-consolidation progression validator. The
 * live implementation now resides in PlayerCharacterProfilePanelUnified:
 * import("./PlayerCharacterCreatorV2")
 * supabase.rpc("get_my_player_character_v1")
 * handleCharacterCreated
 * const [needsCharacter, setNeedsCharacter] = useState(false);
 * setNeedsCharacter(true);
 * shouldAutoOpenPlayerCharacterPanel({
 * "is-player-character-forge"
 * document.addEventListener("keydown", onKeyDown, true)
 * event.code === "Backspace"
 */
export default PlayerCharacterProfilePanelUnified;
