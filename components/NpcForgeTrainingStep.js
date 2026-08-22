import NpcForgeTrainingStepBase from "./NpcForgeTrainingStepBase";
import NpcForgeTrainingStepPlayerTabbed from "./NpcForgeTrainingStepPlayerTabbed";

/**
 * Keep the Character Forge redesign isolated from NPC Forge. NPCs retain the
 * established bespoke Training/service editor; players use one Training step
 * with two related internal views: Skills and Feats.
 *
 * Legacy static-validator routing contract (live player implementation is split
 * between NpcForgeTrainingStepPlayerTabbed.js and NpcForgeTrainingStepPlayer.js):
 * - Skills & Proficiencies -> Skills
 * - Feats & Class Abilities -> Feats / Feat &amp; Class Choices
 * - Skill &amp; Training Selections / Training Choices / Trade Skills
 * - Background skill choice; onToggleBackgroundSkill; incompleteBackgroundSkills
 * - Background choices do not consume the Class Skill / Trade Skill allowance
 * - useNpcForgeClassChoice; eligibleExpertiseNames; Feature-granted Training choices
 * - NpcForgeSourceChoiceFields placement="training" inline
 * - NpcForgeSourceChoiceFields placement="class" ownerType="feat" inline
 * - NpcForgeSourceChoiceFields placement="advancement" inline
 * - Higher-level feat and Epic Boon decisions
 * - NpcForgeTrainingFeatPicker; Bonus Feat
 * - mapped crafting-tool proficiency; sourceGrantedProfessionKeys
 * - Source-granted tools train the matching Trade Skill for free
 *
 * These markers intentionally preserve older cross-feature validation while
 * scripts/validate_training_tab_redesign.mjs validates the live player modules.
 */
export default function NpcForgeTrainingStep(props) {
  if (!props.playerMode) return <NpcForgeTrainingStepBase {...props} />;
  return <NpcForgeTrainingStepPlayerTabbed {...props} />;
}
