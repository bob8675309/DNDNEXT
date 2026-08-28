import { useEffect, useMemo } from "react";
import { ABILITY_KEYS } from "../utils/characterCreation";
import { TRADE_SKILL_KEYS } from "../utils/craftingProfessions";
import { sourceGrantedTradeSkillKeys } from "../utils/craftingToolProfessions";
import { pointBuyRemaining } from "../utils/playerForgeRules";
import { selectedSourceChoiceOptions } from "../utils/playerForgeSourceChoices";
import { useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";
import useNpcForgeController from "./useNpcForgeController";

export default function useNpcForgeTrainingRoutedController(args) {
  const controller = useNpcForgeController(args);
  const { state: sourceChoiceState } = useNpcForgeSourceChoices();
  const baseHandleNext = controller.handleNext;
  const baseHandleCreate = controller.handleCreate;

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

  const selectedSourceOptions = useMemo(
    () => selectedSourceChoiceOptions(sourceChoiceState.groups || [], sourceChoiceState.selections || {}),
    [sourceChoiceState.groups, sourceChoiceState.selections]
  );
  const sourceGrantedTradeSkills = useMemo(
    () => new Set(sourceGrantedTradeSkillKeys(selectedSourceOptions)),
    [selectedSourceOptions]
  );
  const sourceGrantSignature = [...sourceGrantedTradeSkills].sort().join("|");

  // Background tool proficiency was the old source expression for many trade
  // competencies. Source metadata now says when that old tool grant should also
  // grant the matching DnDNext Trade Skill. Synchronize only those explicit source
  // grants into the draft profession map. The marker lets a later source change
  // revoke the free rank without turning every mundane copy of the tool into a
  // skill. This is proficiency only; it never creates Expertise or workshop service.
  useEffect(() => {
    if (!controller.playerMode || typeof controller.setDraft !== "function") return;
    controller.setDraft((current) => {
      const professions = { ...(current.professions || {}) };
      let changed = false;
      for (const key of TRADE_SKILL_KEYS) {
        const entry = professions[key] && typeof professions[key] === "object" ? professions[key] : {};
        const grantedNow = sourceGrantedTradeSkills.has(key);
        const wasSourceGranted = Boolean(entry.sourceGrantedByCreation);
        if (grantedNow) {
          if (!wasSourceGranted || Number(entry.rank || 0) < 1 || entry.offersService) {
            professions[key] = {
              ...entry,
              rank: Math.max(1, Number(entry.rank || 0)),
              sourceGrantedByCreation: true,
              offersService: false,
            };
            changed = true;
          }
          continue;
        }
        if (wasSourceGranted) {
          const { sourceGrantedByCreation, ...rest } = entry;
          professions[key] = { ...rest, rank: 0, offersService: false };
          changed = true;
        }
      }
      return changed ? { ...current, professions } : current;
    });
  }, [controller.playerMode, controller.setDraft, sourceGrantSignature]);

  // Character Forge has eight player Trade Skills, while runtime/NPC service
  // authority remains limited to the four implemented crafting disciplines.
  // Source-granted Trade Skills are free grants and therefore do not consume the
  // shared Class Skill / Trade Skill allowance.
  const trainedTradeSkillKeys = controller.playerMode
    ? TRADE_SKILL_KEYS.filter((key) => Number(controller.draft?.professions?.[key]?.rank || 0) > 0)
    : controller.selectedTrainedProfessions || [];
  const paidTradeSkillKeys = trainedTradeSkillKeys.filter((key) => !sourceGrantedTradeSkills.has(key));
  const effectiveTradeSkillKeys = [...new Set([...trainedTradeSkillKeys, ...sourceGrantedTradeSkills])];

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
    selectedTrainedProfessions: effectiveTradeSkillKeys,
    sourceGrantedTradeSkillKeys: [...sourceGrantedTradeSkills],
    bonusFeatPending,
    handleNext,
    handleCreate,
  };
}
