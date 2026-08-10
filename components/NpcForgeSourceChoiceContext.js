import { createContext, useContext } from "react";
import { normalizeFeatSourceChoiceGroups } from "../utils/featSourceChoiceNormalization";
import {
  foundationChoiceSummary,
  normalizeSourceChoiceSelections,
  serializeSourceChoices,
  sourceChoiceGroupsComplete,
} from "../utils/playerForgeSourceChoices";

export const EMPTY_SOURCE_CHOICE_STATE = Object.freeze({ groups: [], selections: {}, catalogReady: false, scopes: {} });

export const NpcForgeSourceChoiceContext = createContext({
  state: EMPTY_SOURCE_CHOICE_STATE,
  registerGroups: () => {},
  toggleChoice: () => {},
  setChoice: () => {},
});

export function useNpcForgeSourceChoices() {
  return useContext(NpcForgeSourceChoiceContext);
}

function applyAutomaticSourceSelections(groups = [], selections = {}) {
  const next = { ...(selections || {}) };
  for (const group of groups || []) {
    for (const field of group?.fields || []) {
      if (!field?.autoSelect) continue;
      const keys = (field.options || []).map((option) => option.key).filter(Boolean).slice(0, Number(field.count || 1));
      next[group.id] = { ...(next[group.id] || {}), [field.id]: keys };
    }
  }
  return normalizeSourceChoiceSelections(groups, next);
}

export function normalizeSourceChoiceState(groups = [], catalogReady = true, previous = EMPTY_SOURCE_CHOICE_STATE, scope = "foundation") {
  const validGroups = normalizeFeatSourceChoiceGroups(Array.isArray(groups) ? groups : []);
  const previousScopes = previous?.scopes && typeof previous.scopes === "object" ? previous.scopes : {};
  const scopes = {
    ...previousScopes,
    [scope || "foundation"]: { groups: validGroups, catalogReady: Boolean(catalogReady) },
  };
  const combinedGroups = normalizeFeatSourceChoiceGroups(Object.values(scopes).flatMap((entry) => Array.isArray(entry?.groups) ? entry.groups : []));
  const normalizedSelections = normalizeSourceChoiceSelections(combinedGroups, previous?.selections || {});
  return {
    scopes,
    groups: combinedGroups,
    selections: applyAutomaticSourceSelections(combinedGroups, normalizedSelections),
    catalogReady: Object.values(scopes).every((entry) => Boolean(entry?.catalogReady)),
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
