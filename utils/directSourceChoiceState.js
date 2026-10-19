import { setSourceChoiceSelection } from "./playerForgeSourceChoices.js";

export const DIRECT_SOURCE_CHOICE_SCOPE = "__direct_source_choice__";

export function applyDirectSourceChoiceSelection(current = {}, groupOrId = null, fieldId = "", optionKeys = []) {
  const incomingGroup = groupOrId && typeof groupOrId === "object" ? groupOrId : null;
  const groupId = String(incomingGroup?.id || groupOrId || "");
  let scopes = current?.scopes && typeof current.scopes === "object" ? { ...current.scopes } : {};
  let groups = Array.isArray(current?.groups) ? current.groups : [];

  if (incomingGroup?.id) {
    let foundInScope = false;
    scopes = Object.fromEntries(Object.entries(scopes).map(([scopeId, entry]) => {
      const scopedGroups = Array.isArray(entry?.groups) ? entry.groups : [];
      if (!scopedGroups.some((group) => String(group?.id || "") === groupId)) return [scopeId, entry];
      foundInScope = true;
      return [scopeId, {
        ...entry,
        groups: scopedGroups.map((group) => String(group?.id || "") === groupId ? incomingGroup : group),
      }];
    }));
    if (!foundInScope) {
      const directGroups = Array.isArray(scopes?.[DIRECT_SOURCE_CHOICE_SCOPE]?.groups)
        ? scopes[DIRECT_SOURCE_CHOICE_SCOPE].groups.filter((group) => String(group?.id || "") !== groupId)
        : [];
      scopes[DIRECT_SOURCE_CHOICE_SCOPE] = {
        groups: [...directGroups, incomingGroup],
        catalogReady: true,
      };
    }

    const existingIndex = groups.findIndex((entry) => String(entry?.id || "") === groupId);
    groups = existingIndex >= 0
      ? groups.map((entry, index) => index === existingIndex ? incomingGroup : entry)
      : [...groups, incomingGroup];
  }

  return {
    ...current,
    scopes,
    groups,
    selections: setSourceChoiceSelection(groups, current?.selections || {}, groupId, fieldId, optionKeys),
  };
}

export function reconcileDirectSourceChoiceScope(scopes = {}) {
  if (!scopes || typeof scopes !== "object") return {};
  const canonicalIds = new Set(Object.entries(scopes)
    .filter(([scopeId]) => scopeId !== DIRECT_SOURCE_CHOICE_SCOPE)
    .flatMap(([, entry]) => Array.isArray(entry?.groups) ? entry.groups : [])
    .map((group) => String(group?.id || ""))
    .filter(Boolean));

  if (!scopes[DIRECT_SOURCE_CHOICE_SCOPE]) return scopes;

  const remainingDirect = (scopes[DIRECT_SOURCE_CHOICE_SCOPE].groups || [])
    .filter((group) => group?.id && !canonicalIds.has(String(group.id)));
  if (remainingDirect.length) {
    return {
      ...scopes,
      [DIRECT_SOURCE_CHOICE_SCOPE]: {
        ...scopes[DIRECT_SOURCE_CHOICE_SCOPE],
        groups: remainingDirect,
        catalogReady: true,
      },
    };
  }

  const { [DIRECT_SOURCE_CHOICE_SCOPE]: _discarded, ...withoutDirect } = scopes;
  return withoutDirect;
}
