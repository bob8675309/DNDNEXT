import { createContext, useContext } from "react";
import { PROFESSION_DEFINITIONS, TRADE_SKILL_KEYS } from "../utils/craftingProfessions";
import { normalizeFeatSourceChoiceGroups } from "../utils/featSourceChoiceNormalization";
import {
  applySourceChoiceDefaults,
  foundationChoiceSummary,
  normalizeSourceChoiceSelections,
  serializeSourceChoices,
  setSourceChoiceSelection,
  sourceChoiceGroupsComplete,
} from "../utils/playerForgeSourceChoices";

export const EMPTY_SOURCE_CHOICE_STATE = Object.freeze({ groups: [], selections: {}, catalogReady: false, scopes: {}, defaultedGroups: {} });
export const DIRECT_SOURCE_CHOICE_SCOPE = "__direct_source_choice__";

export const NpcForgeSourceChoiceContext = createContext({
  state: EMPTY_SOURCE_CHOICE_STATE,
  registerGroups: () => {},
  toggleChoice: () => {},
  setChoice: () => {},
});

export function useNpcForgeSourceChoices() {
  return useContext(NpcForgeSourceChoiceContext);
}

export function applyDirectSourceChoiceSelection(current = EMPTY_SOURCE_CHOICE_STATE, groupOrId = null, fieldId = "", optionKeys = []) {
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

function normalizedFeatName(group = {}) {
  return String(group?.metadata?.featName || group?.label || "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizedChoiceLabel(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * A class rule that grants a generic Artisan's Tool proficiency is a direct
 * Trade Skill grant in DnDNext. Surface that single source-owned choice in the
 * existing Training → Skills → Trade Skills list instead of duplicating it as
 * an Additional Training dropdown. Fixed tools and mixed tool/instrument rules
 * keep their imported source-choice presentation unchanged.
 */
function normalizeClassArtisanTradeSkillChoice(group = {}) {
  if (String(group?.ownerType || "") !== "class") return group;
  let converted = false;
  const fields = (group.fields || []).map((field) => {
    const normalizedLabel = normalizedChoiceLabel(field?.label);
    const classArtisanChoice = String(field?.kind || "") === "tool"
      && (
        normalizedLabel === "choose an artisans tool"
        || normalizedLabel === "choose an artisans tool or musical instrument"
      );
    if (!classArtisanChoice) return field;
    converted = true;
    return {
      ...field,
      label: "Choose a Trade Skill",
      helper: "Your class grants one additional Trade Skill through its Artisan's Tool proficiency.",
      options: TRADE_SKILL_KEYS.map((professionKey) => {
        const definition = PROFESSION_DEFINITIONS[professionKey];
        return {
          key: `class-profession-${professionKey}`,
          value: definition.tool,
          label: definition.label,
          source: group.source || "Campaign",
          kind: "tool",
          description: `${definition.label} includes proficiency with ${definition.tool}.`,
          metadata: {
            professionKey,
            mappedTool: definition.tool,
            grantsMappedTradeSkill: true,
            tradeSkillGrantSource: "class-artisan-tool",
          },
        };
      }),
      metadata: {
        ...(field.metadata || {}),
        professionChoice: true,
        grantsMappedTradeSkill: true,
        campaignRule: "class-artisan-trade-skill",
      },
    };
  });
  if (!converted) return group;
  return {
    ...group,
    label: "Class Trade Skill proficiency",
    helper: "Your class grants one additional Trade Skill choice. Choose it directly from Trade Skills; it does not consume your normal Class Skill / Trade Skill allowance.",
    fields,
    metadata: {
      ...(group.metadata || {}),
      grantsMappedTradeSkill: true,
      campaignRule: "class-artisan-trade-skill",
      resolverPlacement: "training",
      trainingSection: "skills",
    },
  };
}

/**
 * DnDNext campaign adaptation for the 2024 Crafter Origin feat.
 *
 * The imported source grants three Fast-Crafting artisan-tool proficiencies.
 * DnDNext treats mapped crafting tools and Trade/Profession Skills as one
 * campaign proficiency, so Crafter instead grants any three of the eight
 * player-facing Profession Skills. Each option keeps the canonical mapped tool
 * as its stored value so existing source-choice serialization, tool projection,
 * character creation, and crafting proficiency checks continue to agree.
 */
function normalizeCrafterProfessionChoices(group = {}) {
  if (String(group?.ownerType || "") !== "feat" || normalizedFeatName(group) !== "crafter") return group;
  const source = group.source || group.metadata?.featSource || "XPHB";
  return {
    ...group,
    label: "Crafter — Profession Skills",
    helper: "DnDNext campaign rule: Crafter grants three additional Profession Skills instead of three raw Fast-Crafting tool picks. Choose them in Training → Skills → Trade Skills. Each Profession Skill also grants its mapped tool proficiency, and these feat-granted choices do not consume the class Skill / Trade Skill allowance.",
    fields: [{
      id: "profession-skills",
      label: "Choose three Profession Skills",
      kind: "tool",
      count: 3,
      required: true,
      cadence: "creation",
      options: TRADE_SKILL_KEYS.map((key) => {
        const definition = PROFESSION_DEFINITIONS[key];
        return {
          key: `crafter-profession-${key}`,
          value: definition.tool,
          label: definition.label,
          source: "Campaign",
          kind: "tool",
          description: `${definition.label} includes proficiency with ${definition.tool}.`,
          metadata: {
            professionKey: key,
            mappedTool: definition.tool,
            originalFeatSource: source,
            campaignRule: "crafter-profession-skills",
          },
        };
      }),
      metadata: {
        professionChoice: true,
        campaignRule: "crafter-profession-skills",
        originalFeatRule: "Choose three different Artisan's Tools from the Fast Crafting table.",
      },
    }],
    metadata: {
      ...(group.metadata || {}),
      proficiencyFeat: true,
      resolverPlacement: "training",
      trainingSection: "skills",
      campaignRule: "crafter-profession-skills",
      originalFeatSource: source,
    },
  };
}

function normalizeProficiencyFeatDecisionSurface(group = {}) {
  if (String(group?.ownerType || "") !== "feat" || !group?.metadata?.proficiencyFeat) return group;
  if (group.metadata?.campaignRule === "crafter-profession-skills") return group;
  const featName = String(group.metadata?.featName || group.label || "This feat").trim();
  const acquisition = String(group.metadata?.acquisitionLabel || "").trim();
  return {
    ...group,
    helper: `${featName} is already granted${acquisition ? ` by ${acquisition}` : ""}. Complete its feat-owned skill, tool, or instrument choices beside the feat rules in Training → Feats. These feat-granted proficiencies do not consume the class Skill / Trade Skill allowance.`,
    metadata: {
      ...(group.metadata || {}),
      resolverPlacement: "training",
      trainingSection: "feats",
    },
  };
}

/**
 * Step-level resolver placement is distinct from source ownership. Class and
 * advancement groups already resolve on the Training step but retain their
 * subsection placement. Background tool choices are normalized into Training,
 * and Crafter is the deliberate feat exception whose three Profession choices
 * resolve in Skills → Trade Skills instead of the Feats dossier.
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
 * and other feat-owned persistent decisions in Training. Crafter remains a feat-
 * owned choice internally but is surfaced in Skills → Trade Skills.
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
    if (!fields.length) return [];
    // The clone is presentation-only. Most feat-owned non-spell groups use the
    // existing "class" subsection marker so their decisions appear in Feats /
    // Current Selection. Crafter is the exception: its three mapped Profession
    // grants use the normal Training marker so the Trade Skill rows become the
    // decision surface. Canonical ownership, ids, and serialized values stay put.
    const crafterProfessionSkills = group.metadata?.campaignRule === "crafter-profession-skills"
      && group.metadata?.trainingSection === "skills";
    const projectedPlacement = placement === "training" && String(group.ownerType || "") === "feat"
      ? crafterProfessionSkills ? "training" : "class"
      : group.placement;
    return [{ ...group, placement: projectedPlacement, resolverPlacement: placement || sourceChoiceResolverPlacement(group), fields }];
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
  const validGroups = normalizeFeatSourceChoiceGroups(Array.isArray(groups) ? groups : [])
    .map(normalizeBackgroundToolPlacement)
    .map(normalizeClassArtisanTradeSkillChoice)
    .map(normalizeCrafterProfessionChoices)
    .map(normalizeProficiencyFeatDecisionSurface);
  const previousScopes = previous?.scopes && typeof previous.scopes === "object" ? previous.scopes : {};
  let scopes = {
    ...previousScopes,
    [scope || "foundation"]: { groups: validGroups, catalogReady: Boolean(catalogReady) },
  };

  // Direct interactive writes can happen before the owning registrar effect has
  // committed its scope (especially immediately after restoring a Forge draft).
  // Keep those live groups in a short-lived direct scope, then retire the
  // duplicate as soon as any canonical scope registers the same group ID.
  const canonicalIds = new Set(Object.entries(scopes)
    .filter(([scopeId]) => scopeId !== DIRECT_SOURCE_CHOICE_SCOPE)
    .flatMap(([, entry]) => Array.isArray(entry?.groups) ? entry.groups : [])
    .map((group) => String(group?.id || ""))
    .filter(Boolean));
  if (scopes[DIRECT_SOURCE_CHOICE_SCOPE]) {
    const remainingDirect = (scopes[DIRECT_SOURCE_CHOICE_SCOPE].groups || [])
      .filter((group) => group?.id && !canonicalIds.has(String(group.id)));
    if (remainingDirect.length) {
      scopes = {
        ...scopes,
        [DIRECT_SOURCE_CHOICE_SCOPE]: {
          ...scopes[DIRECT_SOURCE_CHOICE_SCOPE],
          groups: remainingDirect,
          catalogReady: true,
        },
      };
    } else {
      const { [DIRECT_SOURCE_CHOICE_SCOPE]: _discarded, ...withoutDirect } = scopes;
      scopes = withoutDirect;
    }
  }

  const combinedById = new Map();
  for (const entry of Object.values(scopes)) {
    for (const group of Array.isArray(entry?.groups) ? entry.groups : []) {
      if (!group?.id) continue;
      combinedById.set(String(group.id), group);
    }
  }
  const combinedGroups = normalizeFeatSourceChoiceGroups([...combinedById.values()]);
  const previousSelections = previous?.selections || {};
  const previousDefaultedGroups = previous?.defaultedGroups && typeof previous.defaultedGroups === "object"
    ? previous.defaultedGroups
    : {};
  const groupsWithDefaults = combinedGroups.filter((group) => (group?.fields || []).some((field) => (
    Boolean(field?.metadata?.defaultOptionKey)
    || (Array.isArray(field?.metadata?.defaultOptionKeys) && field.metadata.defaultOptionKeys.length > 0)
  )));
  const forceEmptyGroupIds = groupsWithDefaults.flatMap((group) => {
    if (previousDefaultedGroups[group.id]) return [];
    const hasAnyStoredSelection = (group?.fields || []).some((field) => (
      Array.isArray(previousSelections?.[group.id]?.[field.id])
      && previousSelections[group.id][field.id].length > 0
    ));
    return hasAnyStoredSelection ? [] : [group.id];
  });
  const seededSelections = applySourceChoiceDefaults(combinedGroups, previousSelections, { forceEmptyGroupIds });
  const normalizedSelections = normalizeSourceChoiceSelections(combinedGroups, seededSelections);
  const defaultedGroups = { ...previousDefaultedGroups };
  groupsWithDefaults.forEach((group) => { defaultedGroups[group.id] = true; });
  return {
    scopes,
    groups: combinedGroups,
    selections: applyAutomaticSourceSelections(combinedGroups, normalizedSelections),
    catalogReady: Object.values(scopes).every((entry) => Boolean(entry?.catalogReady)),
    defaultedGroups,
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
