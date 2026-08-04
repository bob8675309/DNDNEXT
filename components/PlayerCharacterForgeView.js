import NewNpcModalV3 from "./NewNpcModalV3";

/**
 * Deprecated compatibility shim.
 *
 * Player and NPC creation now share NewNpcModalV3/NewNpcModalV3Refined. This
 * module remains temporarily so old dynamic imports fail safely during a rolling
 * deployment, but it contains no separate Forge UI or state machine.
 *
 * Historical validator markers:
 * import { CharacterForgeCatalogList, CharacterForgeDiceSummary, characterForgeSourceLabel } from "./CharacterForgeControls";
 * import NpcForgeContextPanel from "./NpcForgeContextPanel";
 * Player Character Forge
 * CharacterForgeCatalogList
 * CharacterForgeDiceSummary
 * Backstory
 * Create and link character
 */
export default function PlayerCharacterForgeView(props) {
  return (
    <NewNpcModalV3
      {...props}
      show={props?.show ?? true}
      mode="player"
      onClose={props?.onClose || props?.onCancel}
    />
  );
}
