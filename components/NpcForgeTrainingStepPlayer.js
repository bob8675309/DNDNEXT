import { useEffect, useMemo } from "react";
import { FaBookOpen, FaEye, FaLeaf, FaMagic, FaPlusCircle, FaSearch } from "react-icons/fa";
import { ABILITY_LABELS, SKILL_DEFINITIONS } from "../utils/characterCreation";
import { PROFESSION_DEFINITIONS, TRADE_SKILL_KEYS } from "../utils/craftingProfessions";
import { sourceGrantedTradeSkillKey, sourceGrantedTradeSkillKeys } from "../utils/craftingToolProfessions";
import { selectedSourceChoiceOptions, sourceChoiceFieldIsActive, sourceChoiceGroupComplete } from "../utils/playerForgeSourceChoices";
import { activeClassFeatureGroups } from "../utils/classFeatureChoices";
import NpcForgeClassFeatureChoices from "./NpcForgeClassFeatureChoices";
import NpcForgeClassOptionBrowser from "./NpcForgeClassOptionBrowser";
import NpcForgeSourceChoiceFields from "./NpcForgeSourceChoiceFields";
import NpcForgeTrainingFeatPicker from "./NpcForgeTrainingFeatPicker";
import { useNpcForgeClassChoice } from "./NpcForgeClassChoiceContext";
import { sourceChoiceGroupsForPlacement, sourceChoiceGroupsForResolverPlacement, useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";
import { useNpcForgeControllerContext } from "./NpcForgeControllerContext";

const normalized = (value) => String(value ?? "").trim().toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const SKILL_BY_KEY = Object.freeze(Object.fromEntries(SKILL_DEFINITIONS.map((skill) => [skill.key, skill])));
const TRAINING_ASSET_ROOT = "/ui/forge/training";
const PROFESSION_ICON = Object.freeze({
  alchemy: `${TRAINING_ASSET_ROOT}/profession-alchemy.svg`,
  smithing: `${TRAINING_ASSET_ROOT}/profession-smithing.svg`,
  scribe: `${TRAINING_ASSET_ROOT}/profession-scribe.svg`,
  enchanting: `${TRAINING_ASSET_ROOT}/profession-enchanting.svg`,
});
const SOURCE_KIND_ICON = Object.freeze({
  tool: `${TRAINING_ASSET_ROOT}/choice-tool.svg`,
  instrument: `${TRAINING_ASSET_ROOT}/choice-instrument.svg`,
  language: `${TRAINING_ASSET_ROOT}/choice-language.svg`,
  "skill-or-tool": `${TRAINING_ASSET_ROOT}/summary-training.svg`,
});
const SKILL_ICON = Object.freeze({
  arcana: FaMagic,
  history: FaBookOpen,
  investigation: FaSearch,
  perception: FaEye,
  medicine: FaPlusCircle,
  nature: FaLeaf,
});

function SkillGlyph({ skillKey }) {
  const Icon = SKILL_ICON[skillKey] || FaBookOpen;
  return <span className="npc-forge-training-skill-icon" aria-hidden="true"><Icon focusable="false" /></span>;
}

function classChoiceProgress(groups = [], selections = {}) {
  return groups.reduce((progress, group) => {
    if (!group?.required) return progress;
    const count = Math.max(1, Number(group.count || 1));
    const selected = Array.isArray(selections?.[group.id]) ? selections[group.id].length : 0;
    return { target: progress.target + count, done: progress.done + Math.min(count, selected) };
  }, { target: 0, done: 0 });
}

function sourceChoiceProgress(groups = [], selections = {}) {
  return groups.reduce((progress, group) => {
    for (const field of group?.fields || []) {
      if (field?.required === false || !sourceChoiceFieldIsActive(field, selections)) continue;
      const count = Math.max(1, Number(field.count || 1));
      const selected = Array.isArray(selections?.[group.id]?.[field.id]) ? selections[group.id][field.id].length : 0;
      progress.target += count;
      progress.done += Math.min(count, selected);
    }
    return progress;
  }, { target: 0, done: 0 });
}

function ownerLabel(group = {}) {
  const owner = String(group.ownerType || "source");
  return owner === "background" ? "Background" : owner === "class" ? "Class" : owner === "feat" ? "Feat" : owner === "species" ? "Species" : "Source";
}

function skillKeyForOption(option = {}) {
  const raw = normalized(option.value || option.label || option.key);
  if (!raw) return "";
  return SKILL_DEFINITIONS.find((skill) => normalized(skill.key) === raw || normalized(skill.label) === raw)?.key || "";
}

function sourceSkillFieldsFor(groups = [], selections = {}) {
  return groups.flatMap((group) => (group.fields || []).flatMap((field) => {
    if (field?.autoSelect || !sourceChoiceFieldIsActive(field, selections)) return [];
    if (field.kind !== "skill" && field.kind !== "skill-or-tool") return [];
    const mappedOptions = (field.options || []).flatMap((option) => {
      const skillKey = skillKeyForOption(option);
      return skillKey ? [{ ...option, skillKey }] : [];
    });
    if (!mappedOptions.length) return [];
    return [{
      group,
      field,
      mappedOptions,
      selectedKeys: Array.isArray(selections?.[group.id]?.[field.id]) ? selections[group.id][field.id] : [],
    }];
  }));
}

function sourceProfessionFieldsFor(groups = [], selections = {}) {
  return groups.flatMap((group) => (group.fields || []).flatMap((field) => {
    if (field?.autoSelect || !sourceChoiceFieldIsActive(field, selections)) return [];
    const mappedOptions = (field.options || []).flatMap((option) => {
      const professionKey = String(option?.metadata?.professionKey || "");
      return TRADE_SKILL_KEYS.includes(professionKey) ? [{ ...option, professionKey }] : [];
    });
    if (!mappedOptions.length) return [];
    return [{
      group,
      field,
      mappedOptions,
      selectedKeys: Array.isArray(selections?.[group.id]?.[field.id]) ? selections[group.id][field.id] : [],
    }];
  }));
}

function presentationSourceGroups(groups = [], selections = {}) {
  return groups.flatMap((group) => {
    const fields = (group.fields || []).flatMap((field) => {
      if (field?.autoSelect || !sourceChoiceFieldIsActive(field, selections)) return [field];
      // Skill choices are promoted into Skills. Explicit Profession-choice options
      // (currently Crafter) are promoted into Trade Skills. Ordinary Background
      // tool choices stay here as real tool choices; after selection, source-bound
      // metadata can grant the matching Trade Skill without duplicating the chooser.
      if (field.kind === "skill") return [];
      const options = (field.options || []).filter((option) => {
        if (skillKeyForOption(option)) return false;
        if (TRADE_SKILL_KEYS.includes(String(option?.metadata?.professionKey || ""))) return false;
        return true;
      });
      return options.length ? [{ ...field, options }] : [];
    });
    return fields.length ? [{ ...group, fields }] : [];
  });
}

function sourceGrantMap(entries = [], mapper) {
  const map = new Map();
  for (const entry of entries) {
    const key = mapper(entry);
    if (!key || map.has(key)) continue;
    const owner = entry.ownerType ? `${entry.ownerType[0]?.toUpperCase() || ""}${entry.ownerType.slice(1)}` : "Source";
    map.set(key, `${owner}: ${entry.groupLabel || entry.label}`);
  }
  return map;
}

function featOptionForGroup(group = {}, options = []) {
  const optionId = String(group?.metadata?.featOptionId || "");
  const featName = normalized(group?.metadata?.featName || group?.label);
  const featSource = String(group?.metadata?.featSource || group?.source || "");
  return options.find((option) => optionId && String(option?.id || "") === optionId)
    || options.find((option) => featName && normalized(option?.name) === featName && (!featSource || String(option?.source || "") === featSource))
    || options.find((option) => featName && normalized(option?.name) === featName)
    || null;
}

export default function NpcForgeTrainingStepPlayer({
  backgroundSkills = [],
  backgroundSkillChoices = [],
  backgroundSkillSelections = {},
  onToggleBackgroundSkill = null,
  classSkillConfig,
  selectedClassSkills = [],
  professions = {},
  titleForSkill,
  onToggleClassSkill,
  onSetProfession,
  onDetail,
}) {
  const controller = useNpcForgeControllerContext() || {};
  const selectedBackgroundName = String(controller.selectedBackground?.name || controller.selectedBackground?.class_name || "").trim();
  const selectedClassName = String(controller.selectedClass?.class_name || controller.selectedClass?.name || "").trim();
  const backgroundSourceLabel = selectedBackgroundName ? `Background — ${selectedBackgroundName}` : "Background";
  const classSourceLabel = selectedClassName ? `Class — ${selectedClassName}` : "Class";
  const { state: classChoiceState, toggleFeatureOption } = useNpcForgeClassChoice();
  const { state: sourceChoiceState, setChoice: setSourceChoice } = useNpcForgeSourceChoices();

  const speciesBonus = controller.draft?.speciesBonus || {};
  const bonusFeatRequired = speciesBonus.mode === "feat";
  const selectedBonusFeat = controller.speciesBonusFeat || null;
  const featOptions = controller.featOptions || [];
  const bonusFeatCatalogueOptions = useMemo(() => featOptions.filter((feat) => {
    const category = String(feat?.category || "").toUpperCase();
    const alreadySelected = String(feat?.id || "") === String(speciesBonus.featId || "");
    return alreadySelected || !category.startsWith("FS");
  }), [featOptions, speciesBonus.featId]);
  const classSkillOptions = Array.isArray(classSkillConfig?.options) ? classSkillConfig.options : [];

  const selectedSourceOptions = useMemo(
    () => selectedSourceChoiceOptions(sourceChoiceState.groups || [], sourceChoiceState.selections || {}),
    [sourceChoiceState.groups, sourceChoiceState.selections]
  );
  const sourceGrantedSkillKeys = useMemo(() => new Set(selectedSourceOptions.map(skillKeyForOption).filter(Boolean)), [selectedSourceOptions]);
  const sourceGrantedProfessionKeys = useMemo(() => new Set(sourceGrantedTradeSkillKeys(selectedSourceOptions)), [selectedSourceOptions]);
  const skillGrantSource = useMemo(() => sourceGrantMap(selectedSourceOptions, skillKeyForOption), [selectedSourceOptions]);
  const professionGrantSource = useMemo(() => sourceGrantMap(selectedSourceOptions, sourceGrantedTradeSkillKey), [selectedSourceOptions]);

  const backgroundChoiceSelectedKeys = useMemo(() => new Set(backgroundSkillChoices.flatMap((group) => backgroundSkillSelections?.[group.id] || [])), [backgroundSkillChoices, backgroundSkillSelections]);
  const backgroundGrantedSkillKeys = useMemo(() => new Set([...backgroundSkills, ...backgroundChoiceSelectedKeys]), [backgroundSkills, backgroundChoiceSelectedKeys]);
  const effectiveGrantedSkillKeys = useMemo(() => new Set([...backgroundGrantedSkillKeys, ...sourceGrantedSkillKeys]), [backgroundGrantedSkillKeys, sourceGrantedSkillKeys]);

  const activeFeatureGroups = useMemo(
    () => activeClassFeatureGroups(classChoiceState.featureGroups || [], classChoiceState.featureSelections || {}),
    [classChoiceState.featureGroups, classChoiceState.featureSelections]
  );
  const trainingChoiceGroups = useMemo(() => activeFeatureGroups.filter((group) => (group.placement || "class") === "training"), [activeFeatureGroups]);
  const classAbilityGroups = useMemo(() => activeFeatureGroups.filter((group) => (group.placement || "class") === "class"), [activeFeatureGroups]);
  const resolverTrainingGroups = useMemo(() => sourceChoiceGroupsForResolverPlacement(sourceChoiceState, "training"), [sourceChoiceState]);
  const sourceTrainingGroups = useMemo(() => resolverTrainingGroups.filter((group) => (
    group.placement === "training"
    && (group.ownerType !== "feat" || Boolean(group.metadata?.proficiencyFeat))
  )), [resolverTrainingGroups]);
  const sourceClassAbilityGroups = useMemo(() => resolverTrainingGroups.filter((group) => (
    (group.ownerType === "feat" && !group.metadata?.proficiencyFeat)
    || ["class", "advancement"].includes(group.placement)
  )), [resolverTrainingGroups]);
  const featTrainingGroups = useMemo(() => sourceClassAbilityGroups.filter((group) => group.ownerType === "feat"), [sourceClassAbilityGroups]);
  const otherSourceClassAbilityGroups = useMemo(() => sourceClassAbilityGroups.filter((group) => group.ownerType !== "feat" && group.ownerType !== "class-option"), [sourceClassAbilityGroups]);
  const classOptionGroups = useMemo(
    () => sourceChoiceGroupsForPlacement(sourceChoiceState, "class").filter((group) => group.ownerType === "class-option"),
    [sourceChoiceState]
  );
  const allSourceClassAbilityGroups = useMemo(() => {
    const byId = new Map([...sourceClassAbilityGroups, ...classOptionGroups].map((group) => [group.id, group]));
    return [...byId.values()];
  }, [classOptionGroups, sourceClassAbilityGroups]);
  const featSpellGroups = useMemo(() => sourceChoiceGroupsForResolverPlacement(sourceChoiceState, "spells").filter((group) => group.ownerType === "feat"), [sourceChoiceState]);
  const featDecisionGroups = useMemo(() => {
    const ids = [...new Set([...featTrainingGroups.map((group) => group.id), ...featSpellGroups.map((group) => group.id)])];
    return ids.map((id) => ({
      group: (sourceChoiceState.groups || []).find((group) => group.id === id) || featTrainingGroups.find((group) => group.id === id) || featSpellGroups.find((group) => group.id === id),
      trainingGroup: featTrainingGroups.find((group) => group.id === id) || null,
      spellGroup: featSpellGroups.find((group) => group.id === id) || null,
    })).filter((entry) => entry.group);
  }, [featSpellGroups, featTrainingGroups, sourceChoiceState.groups]);
  const sourceSkillFields = useMemo(() => sourceSkillFieldsFor(sourceTrainingGroups, sourceChoiceState.selections || {}), [sourceTrainingGroups, sourceChoiceState.selections]);
  const sourceTradeFields = useMemo(() => sourceProfessionFieldsFor(sourceTrainingGroups, sourceChoiceState.selections || {}), [sourceTrainingGroups, sourceChoiceState.selections]);
  const genericSourceTrainingGroups = useMemo(() => presentationSourceGroups(sourceTrainingGroups, sourceChoiceState.selections || {}), [sourceTrainingGroups, sourceChoiceState.selections]);

  const sourceSkillOptionKeys = useMemo(() => sourceSkillFields.flatMap((entry) => entry.mappedOptions.map((option) => option.skillKey)), [sourceSkillFields]);
  const skillDisplayKeys = useMemo(() => [...new Set([
    ...classSkillOptions,
    ...backgroundSkills,
    ...backgroundSkillChoices.flatMap((group) => (group.options || []).map((option) => option.key)),
    ...sourceSkillOptionKeys,
    ...sourceGrantedSkillKeys,
  ])], [backgroundSkills, backgroundSkillChoices, classSkillOptions, sourceGrantedSkillKeys, sourceSkillOptionKeys]);

  const selectedSkillKeys = useMemo(() => [...new Set([...effectiveGrantedSkillKeys, ...selectedClassSkills])], [effectiveGrantedSkillKeys, selectedClassSkills]);
  const eligibleExpertiseNames = selectedSkillKeys.map((key) => titleForSkill(key));
  const eligibleExpertiseKey = eligibleExpertiseNames.map(normalized).join("|");
  const eligibleExpertiseSet = useMemo(() => new Set(eligibleExpertiseNames.map(normalized)), [eligibleExpertiseKey]);
  const expertiseChoiceGroups = useMemo(() => trainingChoiceGroups.filter((group) => group.kind === "expertise"), [trainingChoiceGroups]);
  const otherTrainingChoiceGroups = useMemo(() => trainingChoiceGroups.filter((group) => group.kind !== "expertise"), [trainingChoiceGroups]);
  const classChoicePresentationGroups = useMemo(() => (classChoiceState.featureGroups || []).map((group) => (
    group.kind === "expertise" ? { ...group, placement: "class" } : group
  )), [classChoiceState.featureGroups]);
  const expertiseProgress = classChoiceProgress(expertiseChoiceGroups, classChoiceState.featureSelections || {});
  const incompleteExpertise = expertiseChoiceGroups.some((group) => group.required && (classChoiceState.featureSelections?.[group.id] || []).length !== Number(group.count || 0));

  const explicitlyTrainedProfessionKeys = TRADE_SKILL_KEYS.filter((key) => Number(professions?.[key]?.rank || 0) > 0);
  const paidProfessionKeys = explicitlyTrainedProfessionKeys.filter((key) => !sourceGrantedProfessionKeys.has(key));
  const paidProfessionCount = paidProfessionKeys.length;
  const totalTrainingChoices = Number(classSkillConfig?.totalCount ?? classSkillConfig?.count ?? 0);
  const usedTrainingChoices = selectedClassSkills.length + paidProfessionCount;
  const remainingTrainingChoices = Math.max(0, totalTrainingChoices - usedTrainingChoices);
  const incompleteTrainingAllowance = usedTrainingChoices !== totalTrainingChoices;

  const backgroundChoiceTarget = backgroundSkillChoices.reduce((total, group) => total + Number(group.count || 1), 0);
  const backgroundChoiceDone = backgroundSkillChoices.reduce((total, group) => total + Math.min(Number(group.count || 1), (backgroundSkillSelections?.[group.id] || []).length), 0);
  const incompleteBackgroundSkills = backgroundChoiceDone !== backgroundChoiceTarget;
  const incompleteTrainingFeature = trainingChoiceGroups.some((group) => group.required && (classChoiceState.featureSelections?.[group.id] || []).length !== Number(group.count || 0));
  const incompleteOtherTrainingFeature = otherTrainingChoiceGroups.some((group) => group.required && (classChoiceState.featureSelections?.[group.id] || []).length !== Number(group.count || 0));
  const incompleteClassAbility = classAbilityGroups.some((group) => group.required && (classChoiceState.featureSelections?.[group.id] || []).length !== Number(group.count || 0));
  const incompleteSourceTraining = sourceTrainingGroups.some((group) => !sourceChoiceGroupComplete(group, sourceChoiceState.selections || {}));
  const incompleteSourceClassAbility = allSourceClassAbilityGroups.some((group) => !sourceChoiceGroupComplete(group, sourceChoiceState.selections || {}));
  const incompleteBonusFeat = bonusFeatRequired && !selectedBonusFeat;

  const trainingFeatureProgress = classChoiceProgress(trainingChoiceGroups, classChoiceState.featureSelections || {});
  const otherTrainingFeatureProgress = classChoiceProgress(otherTrainingChoiceGroups, classChoiceState.featureSelections || {});
  const sourceTrainingProgress = sourceChoiceProgress(sourceTrainingGroups, sourceChoiceState.selections || {});
  const trainingStageProgress = { target: trainingFeatureProgress.target + sourceTrainingProgress.target, done: trainingFeatureProgress.done + sourceTrainingProgress.done };
  const classAbilityProgress = classChoiceProgress(classAbilityGroups, classChoiceState.featureSelections || {});
  const sourceClassProgress = sourceChoiceProgress(allSourceClassAbilityGroups, sourceChoiceState.selections || {});
  const featChoiceTarget = classAbilityProgress.target + sourceClassProgress.target + (bonusFeatRequired ? 1 : 0);
  const featChoiceDone = classAbilityProgress.done + sourceClassProgress.done + (bonusFeatRequired && selectedBonusFeat ? 1 : 0);
  const totalSelectionTarget = backgroundChoiceTarget + totalTrainingChoices + trainingStageProgress.target + featChoiceTarget;
  const totalSelectionDone = backgroundChoiceDone + Math.min(totalTrainingChoices, usedTrainingChoices) + trainingStageProgress.done + featChoiceDone;
  const allSelectionsResolved = totalSelectionDone === totalSelectionTarget;

  const sourceTrainingKinds = useMemo(() => {
    const kinds = new Set();
    genericSourceTrainingGroups.forEach((group) => (group.fields || []).forEach((field) => { if (SOURCE_KIND_ICON[field.kind]) kinds.add(field.kind); }));
    return [...kinds];
  }, [genericSourceTrainingGroups]);

  useEffect(() => {
    for (const group of trainingChoiceGroups) {
      if (group.kind !== "expertise") continue;
      for (const key of classChoiceState.featureSelections?.[group.id] || []) {
        const option = group.options?.find((candidate) => candidate.key === key);
        if (option && !eligibleExpertiseSet.has(normalized(option.name))) toggleFeatureOption(group.id, key);
      }
    }
  }, [classChoiceState.featureSelections, eligibleExpertiseKey, eligibleExpertiseSet, toggleFeatureOption, trainingChoiceGroups]);

  useEffect(() => {
    for (const key of effectiveGrantedSkillKeys) {
      if (selectedClassSkills.includes(key)) onToggleClassSkill?.(key);
    }
  }, [effectiveGrantedSkillKeys, onToggleClassSkill, selectedClassSkills]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    function blockIncompleteTrainingChoice(event) {
      const button = event.target?.closest?.("button");
      if (!button || button.textContent?.trim() !== "Continue") return;
      const incomplete = incompleteBackgroundSkills || incompleteTrainingAllowance || incompleteTrainingFeature || incompleteClassAbility || incompleteSourceTraining || incompleteSourceClassAbility || incompleteBonusFeat;
      if (!incomplete) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (incompleteBonusFeat) controller.setError?.("Choose your Bonus Feat in Training before continuing.");
      else if (incompleteBackgroundSkills) controller.setError?.("Complete the Background-granted skill choice shown in the Skills list.");
      else if (incompleteTrainingAllowance) controller.setError?.("Complete your Class Skill or Trade Skill selections before continuing.");
      else if (incompleteExpertise) controller.setError?.(`Choose ${Math.max(1, expertiseProgress.target - expertiseProgress.done)} proficient skill${Math.max(1, expertiseProgress.target - expertiseProgress.done) === 1 ? "" : "s"} to gain Expertise in Class Choices.`);
      else if (incompleteSourceClassAbility) controller.setError?.("Complete the remaining class or advancement choice in Class Choices before continuing.");
      else controller.setError?.("Complete the remaining required Training choice before continuing.");
      const host = button.closest(".npc-forge-modal-v2")?.querySelector(".npc-forge-training-player-layout");
      const target = incompleteExpertise
        ? host?.querySelector(".npc-forge-training-class-only .npc-forge-class-choice-group.is-required")
        : host?.querySelector(".is-required");
      if (target?.tagName === "DETAILS") target.open = true;
      target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
    document.addEventListener("click", blockIncompleteTrainingChoice, true);
    return () => document.removeEventListener("click", blockIncompleteTrainingChoice, true);
  }, [controller, expertiseProgress.done, expertiseProgress.target, incompleteBackgroundSkills, incompleteBonusFeat, incompleteClassAbility, incompleteExpertise, incompleteSourceClassAbility, incompleteSourceTraining, incompleteTrainingAllowance, incompleteTrainingFeature]);

  function backgroundChoiceForSkill(key) {
    const selected = backgroundSkillChoices.find((group) => (backgroundSkillSelections?.[group.id] || []).includes(key));
    if (selected) return selected;
    return backgroundSkillChoices.find((group) => (group.options || []).some((option) => option.key === key) && (backgroundSkillSelections?.[group.id] || []).length < Number(group.count || 1)) || null;
  }

  function sourceFieldForKey(refs, key, mappedKey) {
    const matching = refs.filter((entry) => entry.mappedOptions.some((option) => option[mappedKey] === key));
    const selected = matching.find((entry) => entry.mappedOptions.some((option) => option[mappedKey] === key && entry.selectedKeys.includes(option.key)));
    return selected || matching.find((entry) => entry.selectedKeys.length < Number(entry.field.count || 1)) || matching[0] || null;
  }

  function chooseSourceMappedOption(ref, option) {
    if (!ref || !option || typeof setSourceChoice !== "function") return false;
    const count = Math.max(1, Number(ref.field.count || 1));
    const current = [...ref.selectedKeys];
    let next = current;
    if (count === 1) next = [option.key];
    else if (!current.includes(option.key)) next = current.length < count ? [...current, option.key] : [...current.slice(0, count - 1), option.key];
    setSourceChoice(ref.group.id, ref.field.id, next);
    return true;
  }

  function skillHasExpertise(skillKey) {
    const skillName = normalized(titleForSkill(skillKey));
    return expertiseChoiceGroups.some((group) => {
      const selectedKeys = new Set(classChoiceState.featureSelections?.[group.id] || []);
      return (group.options || []).some((option) => selectedKeys.has(option.key) && normalized(option.name) === skillName);
    });
  }

  function publishFeatGroup(group) {
    if (!group) return;
    const option = featOptionForGroup(group, featOptions) || {
      id: group.metadata?.featOptionId || group.ownerKey,
      name: group.metadata?.featName || group.label || "Feat",
      source: group.metadata?.featSource || group.source || "Campaign",
      category: group.metadata?.featCategory || "Feat",
      description: group.helper || "Complete this feat's required follow-up choices.",
    };
    onDetail?.({ type: "feat", option, granted: true, featInstanceId: group.metadata?.featInstanceId || group.ownerKey });
  }

  const renderOtherTrainingChoices = otherTrainingChoiceGroups.length > 0 || genericSourceTrainingGroups.length > 0;

  return <div className="npc-forge-section npc-forge-training-step npc-forge-training-player-layout">
    <details className={`npc-forge-training-summary npc-forge-training-summary--unified ${allSelectionsResolved ? "is-complete" : "is-required"}`}>
      <summary>
        <img src={`${TRAINING_ASSET_ROOT}/summary-training.svg`} alt="" aria-hidden="true" />
        <span><strong>Skill &amp; Training Selections</strong><small>Open for a compact source/provenance breakdown.</small></span>
        <b>{totalSelectionTarget ? `${totalSelectionDone}/${totalSelectionTarget}` : "Complete"}</b>
        <em>{allSelectionsResolved ? "Resolved" : `${Math.max(0, totalSelectionTarget - totalSelectionDone)} left`}</em>
      </summary>
      <div className="npc-forge-training-summary-breakdown">
        <div><span><img src={`${TRAINING_ASSET_ROOT}/summary-background.svg`} alt="" /><b>Background</b><small>Fixed and variable source grants</small></span><strong>{backgroundChoiceTarget ? `${backgroundChoiceDone}/${backgroundChoiceTarget}` : "Granted"}</strong></div>
        <div><span><img src={`${TRAINING_ASSET_ROOT}/summary-skills.svg`} alt="" /><b>Paid Skills / Trade Skills</b><small>Shared class allowance</small></span><strong>{usedTrainingChoices}/{totalTrainingChoices}</strong></div>
        <div><span><img src={`${TRAINING_ASSET_ROOT}/summary-training.svg`} alt="" /><b>Source Training</b><small>Inline grants plus remaining source choices</small></span><strong>{trainingStageProgress.target ? `${trainingStageProgress.done}/${trainingStageProgress.target}` : "None"}</strong></div>
        <div><span><img src={`${TRAINING_ASSET_ROOT}/summary-feat.svg`} alt="" /><b>Feat &amp; Class</b><small>{bonusFeatRequired ? "Includes your Bonus Feat" : "Permanent feature choices"}</small></span><strong>{featChoiceTarget ? `${featChoiceDone}/${featChoiceTarget}` : "None"}</strong></div>
      </div>
    </details>

    <div className="npc-forge-training-picks">
      <section className={`npc-forge-training-pick-group npc-forge-training-class-skills ${(incompleteTrainingAllowance || incompleteBackgroundSkills) ? "is-required" : ""}`}>
        <div className="npc-forge-training-group-head"><span><img src={`${TRAINING_ASSET_ROOT}/summary-skills.svg`} alt="" aria-hidden="true" /><b>Skills</b></span><small>{effectiveGrantedSkillKeys.size} granted • {selectedClassSkills.length} paid{backgroundChoiceTarget ? ` • Background ${backgroundChoiceDone}/${backgroundChoiceTarget}` : ""}</small></div>
        <div className="npc-forge-training-skill-list">{skillDisplayKeys.map((key) => {
          const fixedBackgroundGranted = backgroundSkills.includes(key);
          const selectedBackgroundChoice = backgroundChoiceSelectedKeys.has(key);
          const backgroundGroup = backgroundChoiceForSkill(key);
          const pendingBackgroundChoice = Boolean(backgroundGroup && !fixedBackgroundGranted && !selectedBackgroundChoice);
          const sourceGranted = sourceGrantedSkillKeys.has(key);
          const sourceRef = sourceFieldForKey(sourceSkillFields, key, "skillKey");
          const sourceOption = sourceRef?.mappedOptions?.find((candidate) => candidate.skillKey === key) || null;
          const sourceChoiceSelected = Boolean(sourceRef && sourceOption && sourceRef.selectedKeys.includes(sourceOption.key));
          const fixedSourceGranted = sourceGranted && !sourceChoiceSelected;
          const sourceAvailable = Boolean(sourceRef && !sourceChoiceSelected);
          const classAvailable = classSkillOptions.includes(key);
          const classSelected = selectedClassSkills.includes(key);
          const granted = fixedBackgroundGranted || fixedSourceGranted;
          const selected = granted || selectedBackgroundChoice || sourceChoiceSelected || classSelected;
          const disabled = !selected && !pendingBackgroundChoice && !sourceAvailable && (!classAvailable || remainingTrainingChoices <= 0);
          const definition = SKILL_BY_KEY[key];
          const grantSource = fixedBackgroundGranted
            ? backgroundSourceLabel
            : fixedSourceGranted
              ? skillGrantSource.get(key) || "Source"
              : (sourceChoiceSelected || sourceAvailable) && sourceRef
                ? `${ownerLabel(sourceRef.group)}: ${sourceRef.group.label}`
                : "";
          const provenance = fixedBackgroundGranted
            ? `Granted by ${backgroundSourceLabel}`
            : fixedSourceGranted
              ? `Granted by ${grantSource}`
              : selectedBackgroundChoice
                ? `Chosen from ${backgroundSourceLabel}`
                : pendingBackgroundChoice
                  ? `Choice from ${backgroundSourceLabel}`
                  : sourceChoiceSelected
                    ? `Chosen from ${grantSource}`
                    : sourceAvailable
                      ? `Available from ${grantSource}`
                      : classSelected
                        ? `Chosen from ${classSourceLabel}`
                        : classAvailable
                          ? `Available from ${classSourceLabel}`
                          : ABILITY_LABELS[definition?.ability] || "Skill";
          const selectionKind = fixedBackgroundGranted || fixedSourceGranted
            ? "granted-skill"
            : selectedBackgroundChoice || pendingBackgroundChoice
              ? "background-skill"
              : sourceChoiceSelected || sourceAvailable
                ? "source-skill"
                : classAvailable
                  ? "class-skill"
                  : "skill-info";
          const canSelect = selectionKind === "background-skill" || selectionKind === "source-skill"
            ? true
            : selectionKind === "class-skill"
              ? classSelected || remainingTrainingChoices > 0
              : false;
          const hasExpertise = Boolean(selected && skillHasExpertise(key));
          return <article key={key} aria-disabled={disabled ? "true" : undefined} className={`${selected ? "is-selected" : ""} ${granted ? "is-granted" : ""} ${(pendingBackgroundChoice || sourceAvailable) && !granted ? "is-source-option" : ""} ${disabled ? "is-unavailable" : ""} ${hasExpertise ? "has-expertise" : ""}`}>
            <button type="button" className="npc-forge-training-skill-main" onClick={() => {
              onDetail?.({
                type: "skill",
                key,
                granted,
                grantSource,
                selectionKind,
                canSelect,
                backgroundGroupId: backgroundGroup?.id || "",
                backgroundCount: Number(backgroundGroup?.count || 1),
                sourceGroupId: sourceRef?.group?.id || "",
                sourceFieldId: sourceRef?.field?.id || "",
                sourceOptionKey: sourceOption?.key || "",
                sourceCount: Number(sourceRef?.field?.count || 1),
              });
            }}><SkillGlyph skillKey={key} /><span><b>{titleForSkill(key)}</b><small>{provenance}</small></span><em>{granted ? "Granted" : selected ? "Selected" : (pendingBackgroundChoice || sourceAvailable || classAvailable) ? "View" : "Info"}</em></button>
            {hasExpertise ? <span className="npc-forge-training-expertise-tag" title={`Expertise in ${titleForSkill(key)}`}><span aria-hidden="true">★</span>Expertise</span> : null}
          </article>;
        })}</div>
      </section>

      <section className={`npc-forge-training-pick-group npc-forge-training-trade-skills ${incompleteTrainingAllowance ? "is-required" : ""}`}>
        <div className="npc-forge-training-group-head"><span><img src={`${TRAINING_ASSET_ROOT}/choice-tool.svg`} alt="" aria-hidden="true" /><b>Trade Skills</b></span><small>{sourceGrantedProfessionKeys.size} granted • {paidProfessionCount} trained • {remainingTrainingChoices} shared left</small></div>
        <div className="npc-forge-training-trade-list">{TRADE_SKILL_KEYS.map((key) => {
          const definition = PROFESSION_DEFINITIONS[key];
          const profession = professions?.[key] || { rank: 0, ability: definition.abilities[0], offersService: false };
          const sourceGranted = sourceGrantedProfessionKeys.has(key);
          const paidTrained = Number(profession.rank || 0) > 0 && !sourceGranted;
          const trained = sourceGranted || paidTrained;
          const sourceRef = sourceFieldForKey(sourceTradeFields, key, "professionKey");
          const sourceAvailable = Boolean(sourceRef && !sourceGranted);
          const cannotTrain = !trained && !sourceAvailable && remainingTrainingChoices <= 0;
          const grantSource = professionGrantSource.get(key) || (sourceAvailable ? `${ownerLabel(sourceRef.group)}: ${sourceRef.group.label}` : "Training choice");
          const sourceOption = sourceRef?.mappedOptions?.find((candidate) => candidate.professionKey === key) || null;
          const selectionKind = sourceGranted ? "granted-profession" : sourceAvailable ? "source-profession" : "trade-skill";
          const canSelect = sourceGranted || paidTrained || sourceAvailable || remainingTrainingChoices > 0;
          return <article key={key} className={`${trained ? "is-selected" : ""} ${sourceGranted ? "is-granted" : ""} ${sourceAvailable && !sourceGranted ? "is-source-option" : ""} ${cannotTrain ? "is-unavailable" : ""}`}>
            <button type="button" className="npc-forge-training-trade-main" aria-disabled={cannotTrain ? "true" : undefined} onClick={() => {
              onDetail?.({
                type: "profession",
                key,
                granted: sourceGranted,
                grantSource: sourceGranted || sourceAvailable ? grantSource : "",
                selectionKind,
                canSelect,
                sourceGroupId: sourceRef?.group?.id || "",
                sourceFieldId: sourceRef?.field?.id || "",
                sourceOptionKey: sourceOption?.key || "",
                sourceCount: Number(sourceRef?.field?.count || 1),
              });
            }}><img src={PROFESSION_ICON[key] || `${TRAINING_ASSET_ROOT}/choice-tool.svg`} alt="" aria-hidden="true" /><span><b>{definition.label}</b><small>{sourceGranted ? `Granted by ${grantSource}` : sourceAvailable ? `Available from ${grantSource}` : definition.tool}</small></span><em>{sourceGranted ? "Granted" : paidTrained ? "Selected" : "View"}</em></button>
            {trained ? <label className="npc-forge-training-trade-ability"><span>Ability</span><select value={profession.ability || definition.abilities[0]} onChange={(event) => onSetProfession?.(key, "ability", event.target.value)}>{definition.abilities.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]}</option>)}</select></label> : null}
          </article>;
        })}</div>
      </section>

      {renderOtherTrainingChoices ? <details className={`npc-forge-training-choice-section npc-forge-training-source-section ${(incompleteOtherTrainingFeature || incompleteSourceTraining) ? "is-required" : ""}`} defaultOpen={(incompleteOtherTrainingFeature || incompleteSourceTraining) && genericSourceTrainingGroups.length > 0}>
        <summary><span><img src={`${TRAINING_ASSET_ROOT}/summary-training.svg`} alt="" aria-hidden="true" /><b>Other Training Choices</b>{sourceTrainingKinds.length ? <i>{sourceTrainingKinds.map((kind) => <img key={kind} src={SOURCE_KIND_ICON[kind]} alt="" aria-hidden="true" />)}</i> : null}</span><em>{(otherTrainingFeatureProgress.target + sourceTrainingProgress.target) ? `${otherTrainingFeatureProgress.done + sourceTrainingProgress.done}/${otherTrainingFeatureProgress.target + sourceTrainingProgress.target}` : "Open"}</em></summary>
        <div className="npc-forge-training-choice-body">
          {otherTrainingChoiceGroups.length ? <NpcForgeClassFeatureChoices groups={classChoiceState.featureGroups || []} selections={classChoiceState.featureSelections || {}} level={classChoiceState.level || 1} onToggle={toggleFeatureOption} placement="training" excludeKinds={["expertise"]} sourceOwnerLabel={selectedClassName || "Class"} heading="Other feature-granted Training choices" description="Languages, tools, and other feature-owned decisions stay here. Expertise is handled in Class Choices." /> : null}
          {genericSourceTrainingGroups.length ? <NpcForgeSourceChoiceFields placement="training" inline groupsOverride={genericSourceTrainingGroups} title="Languages, tools, instruments, and other source-required Training choices" /> : null}
        </div>
      </details> : null}

      <details className={`npc-forge-training-choice-section npc-forge-training-feat-section ${(incompleteBonusFeat || incompleteClassAbility || incompleteSourceClassAbility) ? "is-required" : ""}`} defaultOpen={incompleteBonusFeat}>
        <summary><span><img src={`${TRAINING_ASSET_ROOT}/summary-feat.svg`} alt="" aria-hidden="true" /><b>Feat &amp; Class Choices</b></span><em>{featChoiceTarget ? `${featChoiceDone}/${featChoiceTarget}` : "None"}</em></summary>
        <div className="npc-forge-training-choice-body">
          <div className="npc-forge-training-feat-only">
            {bonusFeatRequired ? <NpcForgeTrainingFeatPicker options={bonusFeatCatalogueOptions} selectedId={speciesBonus.featId || ""} grantedFeats={controller.selectedBackgroundFeat ? [{ feat: controller.selectedBackgroundFeat, featInstanceId: "background-feat" }] : []} onDetail={(next) => onDetail?.({ ...next, selectionKind: next.selectionKind || "species-bonus-feat", featInstanceId: next.featInstanceId || "species-bonus-feat" })} label="Bonus Feat" /> : null}
            {featDecisionGroups.length ? <section className="npc-forge-training-feat-followups" aria-label="Feat follow-up choices"><header><span>Feat follow-ups</span><small>Click a feat here to keep its rules in Current Selection while you finish any owned choices.</small></header><div>{featDecisionGroups.map(({ group, trainingGroup, spellGroup }) => {
              const trainingComplete = !trainingGroup || sourceChoiceGroupComplete(trainingGroup, sourceChoiceState.selections || {});
              const spellComplete = !spellGroup || sourceChoiceGroupComplete(spellGroup, sourceChoiceState.selections || {});
              const needsTraining = Boolean(trainingGroup && !trainingComplete);
              const hasSpellsNext = Boolean(spellGroup && !spellComplete);
              const status = needsTraining ? "Needs choice" : hasSpellsNext ? "Spells next" : "Complete";
              const detailText = needsTraining ? "Finish the feat-owned choice beside its rules." : hasSpellsNext ? "Its granted spell choice continues on the Spells tab." : "All creation-time choices for this feat are complete.";
              return <button key={group.id} type="button" className={needsTraining ? "is-required" : hasSpellsNext ? "has-spells" : "is-complete"} onClick={() => publishFeatGroup(group)}><span><b>{group.metadata?.featName || group.label || "Feat"}</b><small>{detailText}</small></span><em>{status}</em></button>;
            })}</div></section> : null}
          </div>
          <div className="npc-forge-training-class-only">
            <NpcForgeClassFeatureChoices groups={classChoicePresentationGroups} selections={classChoiceState.featureSelections || {}} level={classChoiceState.level || 1} onToggle={toggleFeatureOption} placement="class" eligibleOptionNames={eligibleExpertiseNames} sourceOwnerLabel={selectedClassName || "Class"} heading="Class & subclass choices" description="Your class features that require a choice are grouped here. Select an option to read its full rules in Current Selection, then confirm it there." inspectOnly onDetail={onDetail} />
            <NpcForgeClassOptionBrowser groups={classOptionGroups} selections={sourceChoiceState.selections || {}} onDetail={onDetail} />
            {otherSourceClassAbilityGroups.length ? <NpcForgeSourceChoiceFields placement="training" inline groupsOverride={otherSourceClassAbilityGroups} title="Other class and advancement decisions" /> : null}
          </div>
        </div>
      </details>
    </div>

    <style jsx global>{`
      .npc-forge-modal-v2:has(.npc-forge-training-player-layout){width:min(1360px,calc(100vw - 32px))!important;max-width:1360px!important}.npc-forge-body:has(.npc-forge-training-player-layout){grid-template-columns:minmax(390px,2fr) minmax(0,3fr)!important;align-items:start}.npc-forge-body:has(.npc-forge-training-player-layout) .npc-forge-workspace{padding:12px!important;background:linear-gradient(180deg,rgba(126,72,199,.025),transparent 26%)}.npc-forge-body:has(.npc-forge-training-player-layout) .npc-forge-preview{position:relative;align-self:stretch;overflow:visible!important;padding:12px 14px!important;background:radial-gradient(circle at 40% 0,rgba(126,72,199,.055),transparent 44%),#0a0d15}.npc-forge-body:has(.npc-forge-training-player-layout) .npc-forge-context-panel{position:sticky!important;top:10px!important;align-self:start!important;height:fit-content!important;min-height:0!important;overflow:visible!important;max-height:none!important}.npc-forge-body:has(.npc-forge-training-player-layout) .npc-forge-training-context-dossier{min-height:0!important;max-height:calc(100vh - 190px);overflow:auto;padding-right:4px}.npc-forge-training-player-layout{display:grid;gap:9px}.npc-forge-training-summary{border:1px solid rgba(255,255,255,.09);border-radius:9px;background:rgba(255,255,255,.018);overflow:hidden}.npc-forge-training-summary--unified>summary{display:grid;grid-template-columns:30px minmax(0,1fr) auto auto;gap:9px;align-items:center;padding:9px 11px;list-style:none;cursor:pointer;background:linear-gradient(135deg,rgba(255,255,255,.025),rgba(126,72,199,.025))}.npc-forge-training-summary--unified>summary::-webkit-details-marker{display:none}.npc-forge-training-summary--unified>summary>img{width:25px;height:25px}.npc-forge-training-summary--unified>summary>span{display:grid;gap:1px}.npc-forge-training-summary--unified>summary strong{color:#f5f0ff;font-size:.68rem}.npc-forge-training-summary--unified>summary small{color:rgba(255,255,255,.48);font-size:.49rem}.npc-forge-training-summary--unified>summary>b{color:#fff;font-size:.74rem}.npc-forge-training-summary--unified>summary>em{padding:3px 6px;border-radius:999px;color:#ffe0a0;background:rgba(243,191,99,.1);font-size:.46rem;font-style:normal}.npc-forge-training-summary--unified.is-complete>summary>em{color:#9cece2;background:rgba(88,214,199,.1)}.npc-forge-training-summary-breakdown{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;padding:1px;border-top:1px solid rgba(255,255,255,.075);background:rgba(255,255,255,.045)}.npc-forge-training-summary-breakdown>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 9px;background:#0c1019}.npc-forge-training-summary-breakdown>div>span{display:grid;grid-template-columns:20px minmax(0,1fr);gap:1px 6px;align-items:center}.npc-forge-training-summary-breakdown img{grid-row:1/3;width:18px;height:18px}.npc-forge-training-summary-breakdown b{color:#fff;font-size:.56rem}.npc-forge-training-summary-breakdown small{overflow:hidden;color:rgba(255,255,255,.43);font-size:.44rem;white-space:nowrap;text-overflow:ellipsis}.npc-forge-training-summary-breakdown>div>strong{color:#d8c2fb;font-size:.57rem}.npc-forge-training-picks{display:grid;gap:7px;padding:9px 12px 11px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:linear-gradient(135deg,rgba(255,255,255,.025),rgba(126,72,199,.025))}.npc-forge-training-pick-group,.npc-forge-training-choice-section{border:0;background:transparent}.npc-forge-training-pick-group{padding:2px 0}.npc-forge-training-pick-group.is-required{border-left:2px solid rgba(243,191,99,.38);padding-left:7px}.npc-forge-training-group-head,.npc-forge-training-choice-section>summary{display:flex;align-items:center;justify-content:space-between;gap:10px}.npc-forge-training-group-head{margin-bottom:5px}.npc-forge-training-group-head>span,.npc-forge-training-choice-section>summary>span{display:flex;align-items:center;gap:7px;min-width:0}.npc-forge-training-group-head img,.npc-forge-training-choice-section>summary>span>img{width:17px;height:17px;object-fit:contain}.npc-forge-training-group-head b,.npc-forge-training-choice-section>summary b{color:#ba87ff;font-size:.57rem;text-transform:uppercase;letter-spacing:.055em}.npc-forge-training-group-head small{color:rgba(255,255,255,.58);font-size:.49rem;text-align:right}.npc-forge-training-skill-list,.npc-forge-training-trade-list{display:grid;gap:3px}.npc-forge-training-skill-list>article,.npc-forge-training-trade-list>article{min-height:31px;border:1px solid rgba(255,255,255,.085);border-radius:6px;background:rgba(3,5,10,.3)}.npc-forge-training-skill-list>article{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:stretch;overflow:hidden}.npc-forge-training-skill-main{display:grid;grid-template-columns:23px minmax(0,1fr) auto;gap:7px;align-items:center;min-width:0;padding:4px 7px;border:0;color:rgba(255,255,255,.78);background:transparent;text-align:left}.npc-forge-training-skill-icon{display:grid;place-items:center;width:21px;height:21px;color:#aa72ff;font-size:.73rem}.npc-forge-training-skill-main>span{display:flex;align-items:baseline;gap:7px;min-width:0}.npc-forge-training-skill-main b{color:#fff;font-size:.61rem}.npc-forge-training-skill-main span small{color:rgba(255,255,255,.42);font-size:.45rem}.npc-forge-training-skill-main>em,.npc-forge-training-trade-main>em{display:grid;place-items:center;width:16px;height:16px;border:1px solid rgba(255,255,255,.18);border-radius:50%;color:rgba(255,255,255,.42);font-size:.48rem;font-style:normal}.npc-forge-training-skill-list>article.is-selected{border-color:rgba(168,108,255,.62);background:linear-gradient(90deg,rgba(126,72,199,.15),rgba(126,72,199,.03))}.npc-forge-training-skill-list>article.is-selected .npc-forge-training-skill-main>em{border-color:#8d58ff;color:#0b0912;background:#8d58ff}.npc-forge-training-skill-list>article.is-granted{border-color:rgba(88,214,199,.36);background:linear-gradient(90deg,rgba(88,214,199,.075),rgba(126,72,199,.035))}.npc-forge-training-skill-list>article.is-granted .npc-forge-training-skill-main>em{border-color:#58d6c7;color:#07110f;background:#58d6c7}.npc-forge-training-skill-list>article.is-source-option,.npc-forge-training-trade-list>article.is-source-option{border-style:dashed;border-color:rgba(243,191,99,.42)}.npc-forge-training-skill-list>article.is-unavailable,.npc-forge-training-trade-list>article.is-unavailable{opacity:.68}.npc-forge-training-skill-list>article.is-unavailable:hover,.npc-forge-training-trade-list>article.is-unavailable:hover{opacity:.86}.npc-forge-training-expertise-tag{display:flex;align-items:center;justify-content:center;gap:4px;min-width:76px;padding:4px 7px;border-left:1px solid rgba(255,255,255,.07);color:#171005;background:linear-gradient(180deg,#f2d27e,#c89e43);font-size:.46rem;font-weight:900;white-space:nowrap}.npc-forge-training-skill-list>article.has-expertise{border-color:rgba(243,191,99,.56);box-shadow:inset 3px 0 rgba(243,191,99,.5)}.npc-forge-training-group-copy{margin:1px 0 7px;color:rgba(255,255,255,.66);font-size:.58rem;line-height:1.5}.npc-forge-training-trade-list>article{display:grid;grid-template-columns:minmax(0,1fr) 112px;gap:7px;align-items:center;padding:4px 7px}.npc-forge-training-trade-list>article.is-selected{border-color:rgba(88,214,199,.48);background:linear-gradient(90deg,rgba(88,214,199,.075),rgba(88,214,199,.02))}.npc-forge-training-trade-list>article.is-granted{border-color:rgba(243,191,99,.42);background:linear-gradient(90deg,rgba(243,191,99,.065),rgba(88,214,199,.035))}.npc-forge-training-trade-main{display:grid;grid-template-columns:23px minmax(0,1fr) auto;gap:7px;align-items:center;min-width:0;padding:0;border:0;color:rgba(255,255,255,.78);background:transparent;text-align:left}.npc-forge-training-trade-main>img{width:21px;height:21px}.npc-forge-training-trade-main>span{display:flex;align-items:baseline;gap:7px;min-width:0}.npc-forge-training-trade-main b{color:#fff;font-size:.61rem}.npc-forge-training-trade-main small{overflow:hidden;color:rgba(255,255,255,.42);font-size:.45rem;white-space:nowrap;text-overflow:ellipsis}.npc-forge-training-trade-list>article.is-selected .npc-forge-training-trade-main>em{border-color:#58d6c7;color:#07110f;background:#58d6c7}.npc-forge-training-trade-list>article.is-granted .npc-forge-training-trade-main>em{border-color:#e1bd6e;color:#171005;background:#e1bd6e}.npc-forge-training-trade-ability{display:grid;grid-template-columns:auto minmax(0,1fr);gap:5px;align-items:center}.npc-forge-training-trade-ability>span{color:rgba(255,255,255,.4);font-size:.42rem;text-transform:uppercase}.npc-forge-training-trade-ability select{min-width:0;width:100%;padding:3px 5px;border:1px solid rgba(255,255,255,.12);border-radius:5px;color:#fff;background:#090b12;font-size:.48rem}.npc-forge-training-choice-section{overflow:hidden;border-top:1px solid rgba(255,255,255,.055)}.npc-forge-training-choice-section>summary{list-style:none;cursor:pointer;padding:7px 0 5px}.npc-forge-training-choice-section>summary::-webkit-details-marker{display:none}.npc-forge-training-choice-section>summary em{padding:2px 6px;border-radius:999px;color:#d8c2fb;background:rgba(126,72,199,.1);font-size:.46rem;font-style:normal}.npc-forge-training-choice-section.is-required>summary em{color:#ffe0a0;background:rgba(243,191,99,.1)}.npc-forge-training-choice-section>summary i{display:flex;gap:3px}.npc-forge-training-choice-section>summary i img{width:13px;height:13px}.npc-forge-training-choice-body{display:grid;gap:7px;padding:6px 0 4px}.npc-forge-training-feat-only,.npc-forge-training-class-only{display:grid;gap:7px}.npc-forge-training-feat-followups{display:grid;gap:5px;padding:7px 0;border-top:1px solid rgba(255,255,255,.055);border-bottom:1px solid rgba(255,255,255,.055)}.npc-forge-training-feat-followups>header{display:grid;gap:2px;padding:0 1px}.npc-forge-training-feat-followups>header>span{color:#ba87ff;font-size:.55rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.npc-forge-training-feat-followups>header>small{color:rgba(255,255,255,.47);font-size:.46rem;line-height:1.35}.npc-forge-training-feat-followups>div{display:grid;gap:3px}.npc-forge-training-feat-followups button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 7px;border:1px solid rgba(255,255,255,.085);border-radius:6px;color:#fff;background:rgba(3,5,10,.3);text-align:left}.npc-forge-training-feat-followups button>span{display:grid;gap:1px;min-width:0}.npc-forge-training-feat-followups button b{font-size:.58rem}.npc-forge-training-feat-followups button small{overflow:hidden;color:rgba(255,255,255,.44);font-size:.44rem;white-space:nowrap;text-overflow:ellipsis}.npc-forge-training-feat-followups button>em{padding:3px 6px;border-radius:999px;color:#9cece2;background:rgba(88,214,199,.09);font-size:.44rem;font-style:normal;white-space:nowrap}.npc-forge-training-feat-followups button.is-required{border-color:rgba(243,191,99,.4)}.npc-forge-training-feat-followups button.is-required>em{color:#ffe0a0;background:rgba(243,191,99,.1)}.npc-forge-training-feat-followups button.has-spells>em{color:#d8c2fb;background:rgba(126,72,199,.11)}.npc-forge-training-feat-followups button:hover,.npc-forge-training-feat-followups button:focus-visible{border-color:rgba(168,108,255,.48);background:rgba(126,72,199,.07)}.npc-forge-training-help{display:flex;gap:8px;align-items:flex-start;padding:7px 9px;border-top:1px solid rgba(255,255,255,.06);color:rgba(255,255,255,.5)}.npc-forge-training-help strong{color:#fff;font-size:.59rem}.npc-forge-training-help p{margin:0;font-size:.48rem}.npc-forge-training-player-layout .npc-forge-source-choices{gap:6px;margin-top:0}.npc-forge-training-player-layout .npc-forge-source-choices__heading{display:none}.npc-forge-training-player-layout .npc-forge-source-choice-group{gap:6px;padding:7px 8px}.npc-forge-training-player-layout .npc-forge-source-choice-slots{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}@media(max-width:1180px){.npc-forge-modal-v2:has(.npc-forge-training-player-layout){width:calc(100vw - 24px)!important;max-width:none!important}.npc-forge-body:has(.npc-forge-training-player-layout){grid-template-columns:minmax(360px,2fr) minmax(0,3fr)!important}.npc-forge-training-summary-breakdown{grid-template-columns:1fr}}@media(max-width:900px){.npc-forge-body:has(.npc-forge-training-player-layout){grid-template-columns:1fr!important}.npc-forge-body:has(.npc-forge-training-player-layout) .npc-forge-context-panel,.npc-forge-body:has(.npc-forge-training-player-layout) .npc-forge-training-context-dossier{position:static!important;max-height:none!important;overflow:visible!important}}@media(max-width:720px){.npc-forge-training-summary--unified>summary{grid-template-columns:28px minmax(0,1fr) auto}.npc-forge-training-summary--unified>summary>em{grid-column:2/4;justify-self:start}.npc-forge-training-trade-list>article{grid-template-columns:1fr}.npc-forge-training-trade-ability{padding-left:31px}.npc-forge-training-feat-followups button{grid-template-columns:1fr}.npc-forge-training-feat-followups button>em{justify-self:start}}
    `}</style>
  </div>;
}
