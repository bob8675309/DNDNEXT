import { ABILITY_KEYS } from "../utils/characterCreation";
import { TRADE_SKILL_KEYS } from "../utils/craftingProfessions";
import { pointBuyRemaining } from "../utils/playerForgeRules";
import useNpcForgeController from "./useNpcForgeController";

export default function useNpcForgeTrainingRoutedController(args) {
  const controller = useNpcForgeController(args);
  const baseHandleNext = controller.handleNext;
  const baseHandleCreate = controller.handleCreate;

  // useNpcForgeController intentionally keeps PROFESSION_KEYS scoped to the four
  // implemented crafting-runtime/NPC-service disciplines. Character Forge has a
  // broader eight-Trade-Skill proficiency catalogue, so adjust the shared player
  // allowance on the returned model without widening legacy crafting authority.
  // The controller handlers close over this same classSkillConfig object, so the
  // corrected count is also used by toggleClassSkill() and stepErrors().
  const trainedTradeSkillKeys = controller.playerMode
    ? TRADE_SKILL_KEYS.filter((key) => Number(controller.draft?.professions?.[key]?.rank || 0) > 0)
    : controller.selectedTrainedProfessions || [];
  if (controller.playerMode && controller.classSkillConfig) {
    const totalCount = Number(controller.classSkillConfig.totalCount ?? controller.classSkillConfig.count ?? 0);
    controller.classSkillConfig.professionChoices = trainedTradeSkillKeys.length;
    controller.classSkillConfig.count = Math.max(0, totalCount - trainedTradeSkillKeys.length);
  }

  const bonusFeatPending = Boolean(
    controller.playerMode
      && controller.draft?.speciesBonus?.mode === "feat"
      && !controller.speciesBonusFeat
  );

  function abilitySetupErrors() {
    const errors = [];
    const method = controller.draft?.abilityMethod;
    if ((method === "3d6" || method === "4d6") && ABILITY_KEYS.some((ability) => !controller.allocation?.[ability])) {
      errors.push("Assign all six generated totals.");
    }
    if (method === "pointBuy" && pointBuyRemaining(controller.draft?.baseAbilities || {}) !== 0) {
      errors.push("Spend the full 27-point Point Buy budget.");
    }
    return errors;
  }

  function handleNext() {
    if (bonusFeatPending && controller.stepKey === "abilities") {
      const errors = abilitySetupErrors();
      if (errors.length) {
        controller.setError(errors.join(" "));
        return;
      }
      controller.setError("");
      controller.setDetail(null);
      controller.setStep((current) => Math.min(controller.STEP_LABELS.length - 1, current + 1));
      return;
    }

    if (bonusFeatPending && controller.stepKey === "training") {
      controller.setError("Choose your Bonus Feat in Training before continuing.");
      return;
    }

    return baseHandleNext();
  }

  function handleCreate() {
    if (bonusFeatPending) {
      const trainingIndex = controller.STEP_LABELS.findIndex((label) => String(label).toLowerCase() === "training");
      if (trainingIndex >= 0) controller.setStep(trainingIndex);
      controller.setDetail(null);
      controller.setError("Choose your Bonus Feat in Training before creating the character.");
      return;
    }
    return baseHandleCreate();
  }

  return {
    ...controller,
    selectedTrainedProfessions: trainedTradeSkillKeys,
    bonusFeatPending,
    handleNext,
    handleCreate,
  };
}
