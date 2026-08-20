import { ABILITY_KEYS } from "../utils/characterCreation";
import { pointBuyRemaining } from "../utils/playerForgeRules";
import useNpcForgeController from "./useNpcForgeController";

export default function useNpcForgeTrainingRoutedController(args) {
  const controller = useNpcForgeController(args);
  const baseHandleNext = controller.handleNext;
  const baseHandleCreate = controller.handleCreate;

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
    bonusFeatPending,
    handleNext,
    handleCreate,
  };
}
