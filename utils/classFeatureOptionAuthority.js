import { normalized, safeText } from "./classFeatureChoiceConstants";

const array = (value) => Array.isArray(value) ? value : [];

const CATALOG_KINDS = new Set([
  "eldritch-invocation",
  "battle-master-maneuver",
  "metamagic",
  "arcane-shot",
  "rune",
  "elemental-discipline",
  "artificer-plan",
]);

function sourceRank(source, preferredSource) {
  if (safeText(source) === safeText(preferredSource)) return 0;
  if (safeText(source) === "XPHB") return 1;
  if (safeText(source) === "PHB") return 2;
  return 3;
}

function indexedRows(rows = [], preferredSource = "") {
  const index = new Map();
  for (const row of array(rows)) {
    const key = `${safeText(row.option_type)}|${normalized(row.name)}`;
    const current = index.get(key);
    if (!current || sourceRank(row.source, preferredSource) < sourceRank(current.source, preferredSource)) index.set(key, row);
  }
  return index;
}

function canonicalOption(option, row) {
  const prerequisites = row?.prerequisites && typeof row.prerequisites === "object" ? row.prerequisites : {};
  const requiresAll = array(prerequisites.requiresOptions).map(safeText).filter(Boolean);
  return {
    ...option,
    source: row.source || option.source,
    description: safeText(row.description) || option.description,
    minLevel: Math.max(1, Number(prerequisites.minClassLevel || option.minLevel || 1)),
    requires: requiresAll[0] || option.requires || "",
    requiresAll,
    repeatable: Boolean(row.repeatable),
    catalogOptionId: row.id || null,
    catalogOptionKey: row.option_key || null,
    canonicalChoiceSchema: row.choice_schema || {},
    canonicalPrerequisites: prerequisites,
    sourceAuthority: "class_feature_option_catalog",
  };
}

export function applyClassFeatureOptionAuthority(groups = [], optionRows = [], selectedClass = null) {
  const preferredSource = safeText(selectedClass?.source);
  const index = indexedRows(optionRows, preferredSource);
  return array(groups).map((group) => {
    if (!CATALOG_KINDS.has(group.kind)) return group;
    const canonicalOptions = array(group.options).flatMap((option) => {
      const row = index.get(`${group.kind}|${normalized(option.name)}`);
      if (!row) {
        // Invocation authority is fail-closed because production has a complete XPHB catalogue.
        if (group.kind === "eldritch-invocation" && preferredSource === "XPHB") return [];
        return [option];
      }
      return [canonicalOption(option, row)];
    });
    return {
      ...group,
      options: canonicalOptions,
      sourceAuthority: canonicalOptions.some((option) => option.sourceAuthority === "class_feature_option_catalog")
        ? "class_feature_option_catalog"
        : group.sourceAuthority || null,
    };
  });
}

export function canonicalOptionalFeatureRows(rows = [], kind = "") {
  return array(rows).filter((row) => !kind || row.option_type === kind);
}
