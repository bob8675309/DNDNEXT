import { buildFeatSourceChoiceGroups, featInstanceSummaries } from "./playerForgeFeatChoices";
import {
  normalizeSourceChoiceSelections,
  selectedSourceChoiceOptions,
  sourceChoiceGroupsComplete,
} from "./playerForgeSourceChoices";

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (value) => norm(value).replace(/\s+/g, "-");
const array = (value) => Array.isArray(value) ? value : [];

function optionFromCatalog(row = {}) {
  return {
    key: text(row.id || row.option_key || `${slug(row.name)}|${row.source || "XPHB"}`),
    value: text(row.id || row.option_key || row.name),
    label: row.name,
    source: row.source || "XPHB",
    kind: row.option_type === "boon" || row.category === "EB" ? "boon" : "feat",
    description: text(row.description),
    metadata: {
      optionId: row.id || null,
      optionKey: row.option_key || null,
      optionType: row.option_type || "feat",
      category: row.category || null,
      prerequisiteText: row.prerequisite_text || null,
      repeatable: Boolean(row.metadata?.repeatable),
    },
  };
}

export function buildRuntimeAdvancementGroup({ classKey = "class", toLevel = 1, kind = "feat", options = [] } = {}) {
  const epic = kind === "epic-boon";
  const groupId = `level-${Number(toLevel || 1)}-${slug(classKey)}-advancement`;
  return {
    id: groupId,
    ownerType: "advancement",
    ownerKey: `${classKey}:${Number(toLevel || 1)}`,
    label: epic ? `Level ${Number(toLevel || 1)} Epic Boon` : `Level ${Number(toLevel || 1)} Feat`,
    source: "XPHB",
    placement: "advancement",
    level: Number(toLevel || 1),
    helper: epic
      ? "Choose an eligible Epic Boon or another eligible General feat. Eligibility is rechecked by the server when the level is committed."
      : "Choose the Ability Score Improvement feat or another eligible General feat. Eligibility is rechecked by the server when the level is committed.",
    metadata: { runtimeLevelUp: true, serverEligibility: true },
    fields: [{
      id: "option",
      label: epic ? "Epic Boon or General feat" : "Feat",
      kind: epic ? "boon-or-feat" : "feat",
      count: 1,
      required: true,
      cadence: "level-up",
      options: array(options).map(optionFromCatalog),
    }],
  };
}

export function selectedRuntimeAdvancementOption(group = null, selections = {}, catalogOptions = []) {
  if (!group) return null;
  const selected = selectedSourceChoiceOptions([group], selections)[0];
  if (!selected) return null;
  const selectedId = text(selected.metadata?.optionId || selected.value || selected.key);
  return array(catalogOptions).find((row) => selectedId && [row.id, row.option_key].map(text).includes(selectedId))
    || array(catalogOptions).find((row) => norm(row.name) === norm(selected.label) && (!selected.source || row.source === selected.source))
    || null;
}

export function buildRuntimeAdvancementChoiceModel({
  classKey = "class",
  toLevel = 1,
  advancement = null,
  selections = {},
  toolRows = [],
  spells = [],
} = {}) {
  if (!advancement?.required) return { groups: [], selections: {}, instance: null, complete: true };
  const mainGroup = buildRuntimeAdvancementGroup({
    classKey,
    toLevel,
    kind: advancement.kind,
    options: advancement.options || [],
  });
  const mainSelections = normalizeSourceChoiceSelections([mainGroup], selections);
  const selectedOption = selectedRuntimeAdvancementOption(mainGroup, mainSelections, advancement.options || []);
  const instance = selectedOption ? {
    instanceId: `level-${Number(toLevel || 1)}-advancement`,
    ownerType: "advancement",
    ownerKey: `${classKey}:${Number(toLevel || 1)}`,
    placement: "advancement",
    level: Number(toLevel || 1),
    acquisitionLabel: advancement.kind === "epic-boon" ? `Level ${Number(toLevel || 1)} Epic Boon` : `Level ${Number(toLevel || 1)} feat`,
    feat: selectedOption,
  } : null;
  const nestedGroups = instance ? buildFeatSourceChoiceGroups({ featInstances: [instance], toolRows, spells, level: Number(toLevel || 1) }) : [];
  const groups = [mainGroup, ...nestedGroups];
  const normalizedSelections = normalizeSourceChoiceSelections(groups, selections);
  const summaries = featInstanceSummaries(groups, normalizedSelections);
  const summary = summaries.find((entry) => entry.instanceId === instance?.instanceId) || null;
  if (summary && selectedOption) summary.optionType = selectedOption.option_type || "feat";
  return {
    groups,
    selections: normalizedSelections,
    selectedOption,
    instance: summary,
    complete: sourceChoiceGroupsComplete(groups, normalizedSelections),
  };
}

export function abilityIncreasesFromAdvancementInstance(instance = null) {
  if (!instance) return {};
  const output = {};
  const add = (ability, amount) => {
    if (!["str", "dex", "con", "int", "wis", "cha"].includes(ability)) return;
    output[ability] = Number(output[ability] || 0) + Number(amount || 0);
  };
  for (const effect of array(instance.fixedEffects)) {
    if (effect?.type === "ability-increase") add(effect.ability, effect.amount);
  }
  for (const choices of Object.values(instance.choices || {})) {
    for (const choice of array(choices)) {
      if (choice.kind === "ability" && choice.metadata?.effect === "ability-increase") add(choice.value, choice.metadata?.amount || 1);
    }
  }
  return output;
}

export function spellChoicesFromAdvancementInstance(instance = null) {
  if (!instance) return [];
  return Object.values(instance.choices || {}).flatMap((choices) => array(choices)).filter((choice) => choice.kind === "spell").map((choice) => ({
    spell_id: choice.metadata?.spellId || choice.value,
    spell_key: choice.metadata?.spellKey || null,
    name: choice.label,
    source: choice.source || null,
    level: Number(choice.metadata?.level || 0),
    prepared: true,
  }));
}
