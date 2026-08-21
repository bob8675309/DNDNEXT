import NpcForgeTrainingStepBase from "./NpcForgeTrainingStepBase";
import NpcForgeTrainingStepPlayer from "./NpcForgeTrainingStepPlayer";

/**
 * Keep the Character Forge redesign isolated from NPC Forge. NPCs retain the
 * established bespoke Training/service editor; players use the focused inline
 * Skills / Trade Skills / source-choice presentation.
 *
 * Legacy static-validator routing contract (implementation moved to
 * NpcForgeTrainingStepPlayer.js):
 * - Skills & Proficiencies -> Skills
 * - Feats & Class Abilities -> Feat & Class Choices
 * - Skill & Training Selections / Training Choices / Trade Skills
 * - Background skill choice; onToggleBackgroundSkill; incompleteBackgroundSkills
 * - Background choices do not consume the Class Skill / Trade Skill allowance
 * - useNpcForgeClassChoice; eligibleExpertiseNames; Feature-granted Training choices
 * - NpcForgeSourceChoiceFields placement="training" inline
 * - NpcForgeSourceChoiceFields placement="class" ownerType="feat" inline
 * - NpcForgeSourceChoiceFields placement="advancement" inline
 * - Higher-level feat and Epic Boon decisions
 * - NpcForgeTrainingFeatPicker; Bonus Feat
 * - mapped crafting-tool proficiency
 * - Source-granted tools train the matching Trade Skill for free
 *
 * These markers intentionally preserve older cross-feature validation while
 * scripts/validate_training_tab_redesign.mjs validates the live player module.
 */
export default function NpcForgeTrainingStep(props) {
  if (!props.playerMode) return <NpcForgeTrainingStepBase {...props} />;
  return <NpcForgeTrainingStepPlayer {...props} />;
}
