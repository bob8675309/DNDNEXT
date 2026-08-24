import { useEffect } from "react";
import { ABILITY_KEYS } from "../utils/characterCreation";
import { TRADE_SKILL_KEYS } from "../utils/craftingProfessions";
import { professionKeysForTools, toolForProfession } from "../utils/craftingToolProfessions";
import { pointBuyRemaining } from "../utils/playerForgeRules";
import { selectedSourceChoiceOptions } from "../utils/playerForgeSourceChoices";
import { useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";
import useNpcForgeController from "./useNpcForgeController";

export default function useNpcForgeTrainingRoutedController(args) {
  const controller = useNpcForgeController(args);
  const { state: sourceChoiceState } = useNpcForgeSourceChoices();
  const baseHandleNext = controller.handleNext;
  const baseHandleCreate = controller.handleCreate;
  const baseSetProfession = controller.setProfession;

  function initialBackground() {
    return controller.filteredBackgrounds?.[0] || controller.backgroundOptions?.[0] || null;
  }

  function seedInitialBackground() {
    if (!controller.playerMode || controller.loadingCatalogs || controller.draft?.backgroundOptionId) return false;
    const background = initialBackground();
    if (!background) return false;
    controller.chooseBackground?.(background);
    return true;
  }

  // Background should never sit on a structurally different splash page waiting
  // for the first click. Normal forward navigation seeds the first catalogue row
  // before the step changes; this effect is the resume/direct-navigation safety net.
  useEffect(() => {
    if (controller.stepKey !== "background" || controller.draft?.backgroundOptionId) return;
    seedInitialBackground();
  }, [
    controller.stepKey,
    controller.playerMode,
    controller.loadingCatalogs,
    controller.draft?.backgroundOptionId,
    controller.filteredBackgrounds?.[0]?.id,
    controller.backgroundOptions?.[0]?.id,
    controller.chooseBackground,
  ]);

  // useNpcForgeController intentionally keeps PROFESSION_KEYS scoped to the four
  // implemented crafting-runtime/NPC-service disciplines. Character Forge has a
  // broader eight-Trade-Skill proficiency catalogue, so adjust the shared player
  // allowance on the returned model without widening legacy crafting authority.
  // Source-granted mapped tools are free grants even if a player had previously
  // paid for that same Trade Skill before navigating back and changing sources.
  const trainedTradeSkillKeys = controller.playerMode
    ? TRADE_SKILL_KEYS.filter((key) => Number(controller.draft?.professions?.[key]?.rank || 0) > 0)
    : controller.selectedTrainedProfessions || [];
  const sourceGrantedTradeSkillKeys = controller.playerMode
    ? new Set(professionKeysForTools(selectedSourceChoiceOptions(sourceChoiceState.groups || [], sourceChoiceState.selections || {})
      .filter((entry) => entry.kind === "tool" || entry.fieldKind === "tool" || entry.fieldKind === "skill-or-tool")
      .map((entry) => entry.value || entry.label)))
    : new Set();
  const paidTradeSkillKeys = trainedTradeSkillKeys.filter((key) => !sourceGrantedTradeSkillKeys.has(key));

  // The controller handlers close over this same classSkillConfig object, so the
  // corrected count is also used by toggleClassSkill() and stepErrors().
  if (controller.playerMode && controller.classSkillConfig) {
    const totalCount = Number(controller.classSkillConfig.totalCount ?? controller.classSkillConfig.count ?? 0);
    controller.classSkillConfig.professionChoices = paidTradeSkillKeys.length;
    controller.classSkillConfig.count = Math.max(0, totalCount - paidTradeSkillKeys.length);
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

  function setProfession(key, field, value) {
    baseSetProfession?.(key, field, value);
    if (!controller.playerMode || field !== "rank") return;

    const tool = toolForProfession(key);
    if (!tool) return;
    const currentTools = Array.isArray(controller.draft?.additionalTools) ? controller.draft.additionalTools : [];
    const nextTools = Number(value || 0) > 0
      ? [...new Set([...currentTools, tool])]
      : currentTools.filter((entry) => String(entry || "").trim().toLowerCase() !== tool.toLowerCase());
    controller.patch?.({ additionalTools: nextTools });
  }

  function handleNext() {
    if (controller.playerMode && controller.stepKey === "species" && !controller.draft?.backgroundOptionId) {
      // Seed before advancing so the Background dossier is already populated on
      // its first painted frame instead of changing shape after the user clicks.
      seedInitialBackground();
    }

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
    setProfession,
    handleNext,
    handleCreate,
  };
}
