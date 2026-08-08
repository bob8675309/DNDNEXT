import {
  buildClassFeatureChoiceGroups,
  normalizeClassFeatureSelections,
  serializeClassFeatureChoices,
} from "./classFeatureChoices";
import { classChoiceDeltaGroups } from "./characterProgressionResolver";

const array = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const REPLACE_ON_LEVEL_UP_KINDS = new Set(["eldritch-invocation", "metamagic"]);
const REPLACE_ON_LEVEL_UP_FEATURES = new Set(["mystic arcanum"]);

export function classChoiceSelectionsFromAuthority(groups = [], authority = {}) {
  const output = {};
  for (const group of array(groups)) {
    const saved = authority?.[group.id];
    const savedSelections = array(saved?.selections);
    const keys = savedSelections.flatMap((selection) => {
      const key = text(selection?.key);
      if (key && array(group.options).some((option) => option.key === key)) return [key];
      const name = norm(selection?.name);
      const source = text(selection?.source);
      const option = array(group.options).find((candidate) => norm(candidate.name) === name && (!source || candidate.source === source));
      return option ? [option.key] : [];
    });
    output[group.id] = [...new Set(keys)].slice(0, Math.max(0, Number(group.count || 0)));
  }
  return normalizeClassFeatureSelections(groups, output);
}

function semanticKey(group = {}) {
  return [
    group.kind || "class-feature",
    group.sourceFeature || group.label || "",
    group.subclassName || "",
    group.placement || "class",
  ].map(norm).join("|");
}

function cumulativeGroup(previousGroups, nextGroup) {
  const key = semanticKey(nextGroup);
  return array(previousGroups).find((group) => semanticKey(group) === key) || null;
}

function existingNamesForGroup(group, selections) {
  return new Set(array(selections?.[group.id]).flatMap((key) => {
    const option = array(group.options).find((candidate) => candidate.key === key);
    return option ? [norm(option.name)] : [];
  }));
}

function deltaOptions(previousGroup, nextGroup, previousSelections) {
  if (!previousGroup) return array(nextGroup.options);
  if (nextGroup.allowRepeatAcrossGroups) return array(nextGroup.options);
  const used = existingNamesForGroup(previousGroup, previousSelections);
  return array(nextGroup.options).filter((option) => !used.has(norm(option.name)));
}

export function buildClassChoiceLevelDeltaPlan({
  rows = [],
  selectedClass = null,
  selectedSubclass = null,
  fromLevel = 1,
  toLevel = null,
  catalogRows = [],
  spells = [],
  authority = {},
} = {}) {
  const from = Math.max(1, Math.min(20, Number(fromLevel || 1)));
  const to = Math.max(from, Math.min(20, Number(toLevel || from + 1)));
  const previousGroups = buildClassFeatureChoiceGroups({
    rows,
    selectedClass,
    selectedSubclass,
    level: from,
    catalogRows,
    spells,
  });
  const nextGroups = buildClassFeatureChoiceGroups({
    rows,
    selectedClass,
    selectedSubclass,
    level: to,
    catalogRows,
    spells,
  });
  const previousSelections = classChoiceSelectionsFromAuthority(previousGroups, authority);
  const rawDeltas = classChoiceDeltaGroups(previousGroups, nextGroups, to);
  const requiredGroups = rawDeltas.map((delta) => {
    const nextGroup = cumulativeGroup(nextGroups, delta) || delta;
    const previousGroup = cumulativeGroup(previousGroups, delta);
    return {
      ...delta,
      label: nextGroup.label,
      sourceFeature: nextGroup.sourceFeature,
      subclassName: nextGroup.subclassName,
      placement: nextGroup.placement || "class",
      cadence: "level-up",
      options: deltaOptions(previousGroup, nextGroup, previousSelections),
      metadata: {
        ...(nextGroup.metadata || {}),
        progressionDelta: true,
        fromLevel: from,
        toLevel: to,
        previousCount: Number(previousGroup?.count || 0),
        nextCount: Number(nextGroup.count || 0),
        cumulativeGroupId: nextGroup.id,
      },
    };
  }).filter((group) => Number(group.count || 0) > 0 && array(group.options).length >= Number(group.count || 0));

  const optionalReplacementGroups = nextGroups.flatMap((nextGroup) => {
    const previousGroup = cumulativeGroup(previousGroups, nextGroup);
    if (!previousGroup || !array(previousSelections?.[previousGroup.id]).length) return [];
    const replaceable = REPLACE_ON_LEVEL_UP_KINDS.has(nextGroup.kind)
      || REPLACE_ON_LEVEL_UP_FEATURES.has(norm(nextGroup.sourceFeature));
    if (!replaceable) return [];
    return [{
      ...nextGroup,
      id: `${nextGroup.id}-level-${to}-replacement`,
      count: 1,
      required: false,
      cadence: "level-up",
      helper: `Optional: replace one existing ${nextGroup.label} choice while gaining level ${to}.`,
      metadata: {
        ...(nextGroup.metadata || {}),
        progressionReplacement: true,
        fromLevel: from,
        toLevel: to,
        cumulativeGroupId: nextGroup.id,
        existingSelectionKeys: array(previousSelections?.[previousGroup.id]),
      },
    }];
  });

  return {
    fromLevel: from,
    toLevel: to,
    previousGroups,
    nextGroups,
    previousSelections,
    requiredGroups,
    optionalReplacementGroups,
    hasRequiredChoices: requiredGroups.length > 0,
    hasOptionalReplacements: optionalReplacementGroups.length > 0,
  };
}

export function mergeClassChoiceDeltaAuthority({
  plan,
  deltaSelections = {},
  replacementSelections = {},
} = {}) {
  if (!plan) return {};
  const nextSelections = classChoiceSelectionsFromAuthority(plan.nextGroups, serializeClassFeatureChoices(plan.previousGroups, plan.previousSelections));

  for (const delta of array(plan.requiredGroups)) {
    const cumulativeId = delta.metadata?.cumulativeGroupId;
    const cumulative = array(plan.nextGroups).find((group) => group.id === cumulativeId);
    if (!cumulative) continue;
    const previous = array(nextSelections[cumulative.id]);
    const added = array(deltaSelections?.[delta.id]);
    nextSelections[cumulative.id] = [...new Set([...previous, ...added])].slice(0, Number(cumulative.count || 0));
  }

  for (const replacement of array(plan.optionalReplacementGroups)) {
    const chosen = array(replacementSelections?.[replacement.id]);
    if (chosen.length !== 1) continue;
    const cumulativeId = replacement.metadata?.cumulativeGroupId;
    const cumulative = array(plan.nextGroups).find((group) => group.id === cumulativeId);
    if (!cumulative) continue;
    const previous = array(nextSelections[cumulative.id]);
    if (!previous.length) continue;
    nextSelections[cumulative.id] = [...previous.slice(0, -1), chosen[0]];
  }

  return serializeClassFeatureChoices(plan.nextGroups, normalizeClassFeatureSelections(plan.nextGroups, nextSelections));
}
