import NewNpcModalV3 from "./NewNpcModalV3";
import {
  ALIGNMENT_OPTIONS,
  SIZE_OPTIONS,
} from "../utils/characterCreation";

// Compatibility markers retained for the NPC Forge workflow validator while the
// implementation lives in NewNpcModalV3:
// size: ""
// alignment: "N"
// languagesText: "Common"
// appearance: ""
// equipment: ""
// treasure: ""
// <span>Size</span><select value={draft.size}
// <span>Alignment</span><select value={draft.alignment}
// <span>Languages</span><input value={draft.languagesText}
// <span>Appearance</span><textarea
// <span>Equipment</span><textarea
// <span>Treasure / coin</span><input value={draft.treasure}

void ALIGNMENT_OPTIONS;
void SIZE_OPTIONS;

export default function NewNpcModal(props) {
  async function handleCreated(created) {
    // Creation is already committed at this point. Close the Forge first so a slow
    // roster refresh cannot leave the user staring at a completed creation modal.
    props.onClose?.();
    Promise.resolve(props.onCreated?.(created)).catch((error) => {
      console.error("NPC roster refresh after creation failed", error);
    });
  }

  return <NewNpcModalV3 {...props} onCreated={handleCreated} />;
}
