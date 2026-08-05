import { createContext, useContext } from "react";

export const EMPTY_CLASS_CHOICE_STATE = Object.freeze({
  classId: "",
  classKey: "",
  className: "",
  classSource: "",
  level: 1,
  options: Object.freeze([]),
  catalogReady: false,
  selectedKey: "",
});

export function eligibleSubclassOptions(state = EMPTY_CLASS_CHOICE_STATE) {
  const level = Math.max(1, Math.min(20, Number(state.level || 1)));
  return (state.options || []).filter((option) => Number(option.firstLevel || 1) <= level);
}

export function selectedSubclassOption(state = EMPTY_CLASS_CHOICE_STATE) {
  const selected = (state.options || []).find((option) => option.key === state.selectedKey) || null;
  if (!selected) return null;
  return Number(selected.firstLevel || 1) <= Math.max(1, Math.min(20, Number(state.level || 1))) ? selected : null;
}

export function classChoiceStateRequiresSelection(state = EMPTY_CLASS_CHOICE_STATE) {
  return eligibleSubclassOptions(state).length > 0;
}

export function classChoiceStateComplete(state = EMPTY_CLASS_CHOICE_STATE) {
  if (state.classId && !state.catalogReady) return false;
  return !classChoiceStateRequiresSelection(state) || Boolean(selectedSubclassOption(state));
}

export const NpcForgeClassChoiceContext = createContext({
  state: EMPTY_CLASS_CHOICE_STATE,
  registerClass: () => {},
  selectSubclass: () => {},
});

export function useNpcForgeClassChoice() {
  return useContext(NpcForgeClassChoiceContext);
}
