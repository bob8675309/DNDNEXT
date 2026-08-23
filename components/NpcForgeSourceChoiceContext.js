import { createContext, useContext } from "react";
import { PROFESSION_DEFINITIONS, TRADE_SKILL_KEYS } from "../utils/craftingProfessions";
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

function normalizedFeatName(group = {}) {
  return String(group?.metadata?.featName || group?.label || "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
    helper: "DnDNext campaign rule: Crafter grants three additional Profession Skills instead of three raw Fast-Crafting tool picks. Each Profession Skill also grants its mapped tool proficiency, and these feat-granted choices do not consume the class Skill / Trade Skill allowance.",
    fields: [{
      id: "profession-skills",
      label: "Choose profession skill",
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
      trainingSection: "feats",
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
 * and every other feat-owned persistent decision in Training -> Feats.
 * Whole groups already routed to Spells (Magic Initiate, Strixhaven, High Sorcery,
 * etc.) stay intact.
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
    // The clone is presentation-only. Feat-owned non-spell groups use the existing
    // "class" subsection marker so every feat-owned decision appears in Feats/Current
    // Selection, including Skilled/Crafter/Musician proficiency choices. Canonical
    // placement, ownership, ids, and serialized selections remain untouched in state.
    const projectedPlacement = placement === "training" && String(group.ownerType || "") === "feat"
      ? "class"
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
    .map(normalizeCrafterProfessionChoices)
    .map(normalizeProficiencyFeatDecisionSurface);
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
