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
 * Step-level resolver placement is distinct from source ownership. Class and
 * advancement groups already resolve on the Training step but retain their
 * subsection placement. Background tool choices are the one case normalized
 * into the Training choice surface itself.
 */
export function sourceChoiceResolverPlacement(group = {}) {
  const explicit = String(group.resolverPlacement || group.metadata?.resolverPlacement || "").trim();
  if (explicit) return explicit;
  if (backgroundToolChoiceResolvesInTraining(group)) return "training";
  if (["class", "advancement"].includes(group.placement)) return "training";
  return group.placement || "";
}

/**
 * Mixed feat groups can own both permanent non-spell decisions and granted spell
 * choices. Keep one canonical group/selection record, but resolve each field on
 * the step where the player has the right context: feat spell fields in Spells,
 * and the feat's other persistent decisions in Training. Whole groups already
 * routed to Spells (Magic Initiate, Strixhaven, High Sorcery, etc.) stay intact.
 */
export function sourceChoiceFieldResolverPlacement(group = {}, field = {}) {
  const explicit = String(field?.resolverPlacement || field?.metadata?.resolverPlacement || "").trim();
  if (explicit) return explicit;
  const groupPlacement = sourceChoiceResolverPlacement(group);
  if (groupPlacement === "spells") return "spells";
  if (String(group?.ownerType || "") === "feat") {
    if (String(field?.kind || "") === "spell") return "spells";
    return "training";
  }
  return groupPlacement;
}

export function sourceChoiceGroupsForResolverPlacement(state = EMPTY_SOURCE_CHOICE_STATE, placement = "") {
  return (state.groups || []).flatMap((group) => {
    const fields = (group.fields || []).filter((field) => !placement || sourceChoiceFieldResolverPlacement(group, field) === placement);
    return fields.length ? [{ ...group, resolverPlacement: placement || sourceChoiceResolverPlacement(group), fields }] : [];
  });
}

function normalizeBackgroundToolPlacement(group = {}) {
  if (!backgroundToolChoiceResolvesInTraining(group)) return group;
  return {
    ...group,
    placement: "training",
    metadata: {
      ...(group.metadata || {}),
      sourcePlacement: group.placement || "background",
      resolverPlacement: "training",
      backgroundToolChoice: true,
    },
  };
}

export function normalizeSourceChoiceState(groups = [], catalogReady = true, previous = EMPTY_SOURCE_CHOICE_STATE, scope = "foundation") {
  const validGroups = normalizeFeatSourceChoiceGroups(Array.isArray(groups) ? groups : []).map(normalizeBackgroundToolPlacement);
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
    const groups = sourceChoiceGroupsForResolverPlacement(state, filters.placement);
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
  return (state.groups || []).filter((group) => !placement || group.placement === placement);
}
