import NpcForgeTrainingStepBase from "./NpcForgeTrainingStepBase";
import NpcForgeTrainingStepPlayer from "./NpcForgeTrainingStepPlayer";

/**
 * Keep the Character Forge redesign isolated from NPC Forge. NPCs retain the
 * established bespoke Training/service editor; players use the focused inline
 * Skills / Trade Skills / source-choice presentation.
 */
export default function NpcForgeTrainingStep(props) {
  if (!props.playerMode) return <NpcForgeTrainingStepBase {...props} />;
  return <NpcForgeTrainingStepPlayer {...props} />;
}
