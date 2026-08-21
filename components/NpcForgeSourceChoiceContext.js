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

function backgroundToolChoiceResolvesInTraining(group = {}) {
  if (String(group.ownerType || "") !== "background") return false;
  return (group.fields || []).some((field) => (
    String(field?.kind || "") === "tool"
    && !field?.autoSelect
    && field?.required !== false
  ));
}

/**
 * Placement answers where the player resolves a source-owned choice, which is
 * deliberately separate from who owns/persists that choice. Background tool
 * choices remain Background-owned in serialization but are resolved alongside
 * the rest of the character's proficiency choices in Training.
 */
export function sourceChoiceResolverPlacement(group = {}) {
  const explicit = String(group.resolverPlacement || group.metadata?.resolverPlacement || "").trim();
  if (explicit) return explicit;
  if (backgroundToolChoiceResolvesInTraining(group)) return "training";
  if (["class", "advancement"].includes(group.placement)) return "training";
  return group.placement || "";
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
  if (filters?.placement) {
    const groups = (state.groups || []).filter((group) => sourceChoiceResolverPlacement(group) === filters.placement);
    return sourceChoiceGroupsComplete(groups, state.selections || {}, { ...filters, placement: undefined });
  }
  return sourceChoiceGroupsComplete(state.groups || [], state.selections || {}, filters);
}

export function serializeSourceChoiceState(state = EMPTY_SOURCE_CHOICE_STATE) {
  return serializeSourceChoices(state.groups || [], state.selections || {});
}

export function sourceChoiceSelectionSummary(state = EMPTY_SOURCE_CHOICE_STATE) {
  return foundationChoiceSummary(state.groups || [], state.selections || {});
}

export function sourceChoiceGroupsForPlacement(state = EMPTY_SOURCE_CHOICE_STATE, placement = "") {
  return (state.groups || []).filter((group) => !placement || sourceChoiceResolverPlacement(group) === placement);
}
