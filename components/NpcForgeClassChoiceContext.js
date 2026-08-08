import { createContext, useContext } from "react";
import {
  activeClassFeatureGroups,
  classFeatureGroupsComplete,
  normalizeClassFeatureSelections,
  selectedClassFeatureOptions,
  serializeClassFeatureChoices,
} from "../utils/classFeatureChoices";

export const EMPTY_CLASS_CHOICE_STATE = Object.freeze({
  classId: "",
  classKey: "",
  className: "",
  classSource: "",
  level: 1,
  options: Object.freeze([]),
  catalogReady: false,
  selectedKey: "",
  featureGroups: Object.freeze([]),
  featureSelections: Object.freeze({}),
  featureCatalogReady: false,
});

export function eligibleSubclassOptions(state = EMPTY_CLASS_CHOICE_STATE) {
  return (state.options || []).filter((option) => Number(option.firstLevel || 1) <= Number(state.level || 1));
}

export function selectedSubclassOption(state = EMPTY_CLASS_CHOICE_STATE) {
  return (state.options || []).find((option) => option.key === state.selectedKey) || null;
}

export function classChoiceStateRequiresSelection(state = EMPTY_CLASS_CHOICE_STATE) {
  return eligibleSubclassOptions(state).length > 0;
}

export function classFeatureChoiceStateRequiresSelection(state = EMPTY_CLASS_CHOICE_STATE, placement = "class") {
  return activeClassFeatureGroups(state.featureGroups || [], state.featureSelections || {})
    .filter((group) => (group.placement || "class") === placement)
    .some((group) => group.required && Number(group.count || 0) > 0);
}

export function classStepChoiceStateComplete(state = EMPTY_CLASS_CHOICE_STATE) {
  if (!state.catalogReady || !state.featureCatalogReady) return false;
  const subclassComplete = !classChoiceStateRequiresSelection(state) || Boolean(selectedSubclassOption(state));
  return subclassComplete && classFeatureGroupsComplete(state.featureGroups || [], state.featureSelections || {}, "class");
}

export function trainingClassChoiceStateComplete(state = EMPTY_CLASS_CHOICE_STATE) {
  if (!state.featureCatalogReady) return false;
  return classFeatureGroupsComplete(state.featureGroups || [], state.featureSelections || {}, "training");
}

export function spellsClassChoiceStateComplete(state = EMPTY_CLASS_CHOICE_STATE) {
  if (!state.featureCatalogReady) return false;
  return classFeatureGroupsComplete(state.featureGroups || [], state.featureSelections || {}, "spells");
}

export function classChoiceStateComplete(state = EMPTY_CLASS_CHOICE_STATE) {
  if (!state.catalogReady || !state.featureCatalogReady) return false;
  const subclassComplete = !classChoiceStateRequiresSelection(state) || Boolean(selectedSubclassOption(state));
  return subclassComplete && classFeatureGroupsComplete(state.featureGroups || [], state.featureSelections || {});
}

export function classChoiceSelectionSummary(state = EMPTY_CLASS_CHOICE_STATE) {
  return selectedClassFeatureOptions(state.featureGroups || [], state.featureSelections || {});
}

export function serializeClassChoiceState(state = EMPTY_CLASS_CHOICE_STATE) {
  return serializeClassFeatureChoices(state.featureGroups || [], state.featureSelections || {});
}

export function normalizedClassFeatureChoiceState(groups = [], selections = {}) {
  return normalizeClassFeatureSelections(groups, selections);
}

export const NpcForgeClassChoiceContext = createContext({
  state: EMPTY_CLASS_CHOICE_STATE,
  registerClass: () => {},
  selectSubclass: () => {},
  registerFeatureGroups: () => {},
  toggleFeatureOption: () => {},
});

export function useNpcForgeClassChoice() {
  return useContext(NpcForgeClassChoiceContext);
}
