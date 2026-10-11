import { normalized, safeText } from "./classFeatureChoiceConstants";
import { formatPlayerFacingText } from "./playerFacingText";

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

function sourceCode(value = "") {
  return safeText(value).toUpperCase();
}

function sourceRank(source, preferredSource) {
  if (sourceCode(source) === sourceCode(preferredSource)) return 0;
  if (sourceCode(source) === "XPHB") return 1;
  if (sourceCode(source) === "PHB") return 2;
  return 3;
}

function indexedRows(rows = [], preferredSource = "") {
  const typedExact = new Map();
  const typedPreferred = new Map();
  const descriptionExact = new Map();
  const descriptionPreferred = new Map();

  for (const row of array(rows)) {
    const type = safeText(row.option_type);
    const name = normalized(row.name);
    const source = sourceCode(row.source);
    if (!name) continue;

    if (type) {
      typedExact.set(`${type}|${name}|${source}`, row);
      const typedKey = `${type}|${name}`;
      const current = typedPreferred.get(typedKey);
      if (!current || sourceRank(row.source, preferredSource) < sourceRank(current.source, preferredSource)) typedPreferred.set(typedKey, row);
    }

    if (safeText(row.description)) {
      descriptionExact.set(`${name}|${source}`, row);
      const current = descriptionPreferred.get(name);
      if (!current || sourceRank(row.source, preferredSource) < sourceRank(current.source, preferredSource)) descriptionPreferred.set(name, row);
    }
  }

  return { typedExact, typedPreferred, descriptionExact, descriptionPreferred };
}

function sourceDescription(option, index) {
  const name = normalized(option?.name);
  if (!name) return null;
  const exact = index.descriptionExact.get(`${name}|${sourceCode(option?.source)}`);
  return exact || index.descriptionPreferred.get(name) || null;
}

function canonicalRow(groupKind, option, index) {
  const name = normalized(option?.name);
  if (!name) return null;
  const exact = index.typedExact.get(`${groupKind}|${name}|${sourceCode(option?.source)}`);
  return exact || index.typedPreferred.get(`${groupKind}|${name}`) || null;
}

function withSourceDescription(option, row) {
  const description = formatPlayerFacingText(row?.description, "");
  if (!description) return option;
  return {
    ...option,
    description,
    descriptionAuthority: "class_feature_option_catalog",
  };
}

function canonicalOption(option, row) {
  const prerequisites = row?.prerequisites && typeof row.prerequisites === "object" ? row.prerequisites : {};
  const requiresAll = array(prerequisites.requiresOptions).map(safeText).filter(Boolean);
  return {
    ...option,
    source: row.source || option.source,
    description: formatPlayerFacingText(row.description, "") || option.description,
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
    const optionsWithDescriptions = array(group.options).map((option) => {
      const descriptionRow = sourceDescription(option, index);
      return descriptionRow ? withSourceDescription(option, descriptionRow) : option;
    });

    if (!CATALOG_KINDS.has(group.kind)) {
      return {
        ...group,
        options: optionsWithDescriptions,
        sourceAuthority: optionsWithDescriptions.some((option) => option.descriptionAuthority === "class_feature_option_catalog")
          ? "class_feature_option_catalog"
          : group.sourceAuthority || null,
      };
    }

    const canonicalOptions = optionsWithDescriptions.flatMap((option) => {
      const row = canonicalRow(group.kind, option, index);
      if (!row) {
        // Invocation authority is fail-closed because production has a complete XPHB catalogue.
        if (group.kind === "eldritch-invocation" && sourceCode(preferredSource) === "XPHB") return [];
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
