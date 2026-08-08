import { createContext, useContext } from "react";
import {
  foundationChoiceSummary,
  normalizeSourceChoiceSelections,
  serializeSourceChoices,
  sourceChoiceGroupsComplete,
} from "../utils/playerForgeSourceChoices";

export const EMPTY_SOURCE_CHOICE_STATE = Object.freeze({ groups: [], selections: {}, catalogReady: false });

export const NpcForgeSourceChoiceContext = createContext({
  state: EMPTY_SOURCE_CHOICE_STATE,
  registerGroups: () => {},
  toggleChoice: () => {},
  setChoice: () => {},
});

export function useNpcForgeSourceChoices() {
  return useContext(NpcForgeSourceChoiceContext);
}

export function normalizeSourceChoiceState(groups = [], catalogReady = true, previous = EMPTY_SOURCE_CHOICE_STATE) {
  const validGroups = Array.isArray(groups) ? groups : [];
  return {
    groups: validGroups,
    selections: normalizeSourceChoiceSelections(validGroups, previous?.selections || {}),
    catalogReady: Boolean(catalogReady),
  };
}

export function sourceChoiceStateComplete(state = EMPTY_SOURCE_CHOICE_STATE, filters = {}) {
  if (!state.catalogReady) return false;
  return sourceChoiceGroupsComplete(state.groups || [], state.selections || {}, filters);
}

export function serializeSourceChoiceState(state = EMPTY_SOURCE_CHOICE_STATE) {
  return serializeSourceChoices(state.groups || [], state.selections || {});
}

export function sourceChoiceSelectionSummary(state = EMPTY_SOURCE_CHOICE_STATE) {
  return foundationChoiceSummary(state.groups || [], state.selections || {});
}

export function sourceChoiceGroupsForPlacement(state = EMPTY_SOURCE_CHOICE_STATE, placement = "") {
  return (state.groups || []).filter((group) => !placement || group.placement === placement);
}
