function safeText(value) {
  return String(value ?? "").trim();
}

export function normalizeSubclassName(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sourceKey(value) {
  return safeText(value).toUpperCase();
}

// Publication order is used only when two imported subclasses have the same normalized name.
// Known campaign sources are explicit so the Forge does not show duplicate reprints.
const SOURCE_PUBLICATION_ORDER = Object.freeze({
  EFA: 20251209,
  XDMG: 20241112,
  XPHB: 20240917,
  TCE: 20201117,
  DMG: 20141209,
  PHB: 20140819,
});

function sourcePublicationOrder(value) {
  return Number(SOURCE_PUBLICATION_ORDER[sourceKey(value)] || 0);
}

export function subclassOptionKey(name, source) {
  return `${sourceKey(source)}:${normalizeSubclassName(name).replace(/\s+/g, "-")}`;
}

function isIntroductionRow(row, subclassName) {
  const rawHeader = row?.raw_payload?.header;
  if (rawHeader == null) return true;
  const rowName = normalizeSubclassName(row?.name);
  const optionName = normalizeSubclassName(subclassName);
  return Boolean(rowName && optionName && (rowName === optionName || rowName === `school of ${optionName}` || rowName === `path of the ${optionName}`));
}

function effectiveSubclassLevel(level, classSource, targetClassSource) {
  const numeric = Math.max(1, Math.min(20, Number(level || 1)));
  if (sourceKey(targetClassSource) === "XPHB" && sourceKey(classSource) !== "XPHB" && numeric < 3) return 3;
  return numeric;
}

function featureNames(group) {
  return new Set(group.features
    .filter((feature) => !feature.isIntroduction)
    .map((feature) => normalizeSubclassName(feature.name))
    .filter(Boolean));
}

function reprintOverlap(left, right) {
  const leftNames = featureNames(left);
  const rightNames = featureNames(right);
  if (!leftNames.size || !rightNames.size) return 0;
  let shared = 0;
  for (const name of leftNames) if (rightNames.has(name)) shared += 1;
  return shared / Math.min(leftNames.size, rightNames.size);
}

function candidateScore(group, targetClassSource) {
  const exactClass = sourceKey(group.classSource) === sourceKey(targetClassSource) ? 1 : 0;
  const complete = group.describedFeatureCount > 1 ? 1 : 0;
  return (complete * 100000) + (group.describedFeatureCount * 1000) + (group.features.length * 10) + exactClass;
}

function preferDuplicateSubclass(candidate, current, targetClassSource) {
  // Never let a newer but incomplete placeholder hide a complete supplemental definition.
  // Once both candidates are usable definitions, publication order decides the reprint.
  const candidateComplete = candidate.describedFeatureCount > 1;
  const currentComplete = current.describedFeatureCount > 1;
  if (candidateComplete !== currentComplete) return candidateComplete;
  const candidatePublished = sourcePublicationOrder(candidate.source);
  const currentPublished = sourcePublicationOrder(current.source);
  if (candidatePublished !== currentPublished) return candidatePublished > currentPublished;
  const candidateClassPublished = sourcePublicationOrder(candidate.classSource);
  const currentClassPublished = sourcePublicationOrder(current.classSource);
  if (candidateClassPublished !== currentClassPublished) return candidateClassPublished > currentClassPublished;
  return candidateScore(candidate, targetClassSource) > candidateScore(current, targetClassSource);
}

export function resolveSubclassCatalog(featureRows = [], targetClassSource = "XPHB") {
  const rawGroups = new Map();

  for (const row of Array.isArray(featureRows) ? featureRows : []) {
    if (row?.feature_type !== "subclass") continue;
    const name = safeText(row.subclass_name || row.subclass_short_name);
    const shortName = safeText(row.subclass_short_name || row.subclass_name || name);
    const source = safeText(row.source);
    const classSource = safeText(row.class_source);
    if (!name || !source || !classSource) continue;
    const rawKey = `${normalizeSubclassName(name)}|${sourceKey(source)}|${sourceKey(classSource)}`;
    if (!rawGroups.has(rawKey)) {
      rawGroups.set(rawKey, {
        key: subclassOptionKey(name, source),
        name,
        shortName,
        source,
        classSource,
        features: [],
        describedFeatureCount: 0,
      });
    }
    const group = rawGroups.get(rawKey);
    const feature = {
      ...row,
      originalLevel: Number(row.level || 1),
      level: effectiveSubclassLevel(row.level, classSource, targetClassSource),
      isIntroduction: isIntroductionRow(row, name),
    };
    group.features.push(feature);
    if (safeText(row.description)) group.describedFeatureCount += 1;
  }

  for (const group of rawGroups.values()) {
    const seen = new Set();
    group.features = group.features
      .sort((a, b) => Number(a.level) - Number(b.level) || Number(a.isIntroduction) - Number(b.isIntroduction) || safeText(a.name).localeCompare(safeText(b.name)))
      .filter((feature) => {
        const key = `${Number(feature.level)}:${normalizeSubclassName(feature.name)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    group.isLegacyCompatibility = sourceKey(targetClassSource) === "XPHB" && sourceKey(group.classSource) !== "XPHB";
    group.firstLevel = Math.min(...group.features.map((feature) => Number(feature.level || 20)));
  }

  // Same-name reprints are one player-facing choice. Complete definitions beat placeholders;
  // among complete definitions, keep the newest known source.
  const preferredByIdentity = new Map();
  for (const group of rawGroups.values()) {
    const identity = normalizeSubclassName(group.name);
    const current = preferredByIdentity.get(identity);
    if (!current || preferDuplicateSubclass(group, current, targetClassSource)) preferredByIdentity.set(identity, group);
  }

  const candidates = [...preferredByIdentity.values()];
  const modernReprints = candidates.filter((group) =>
    sourceKey(group.source) === sourceKey(targetClassSource)
    && sourceKey(group.classSource) === sourceKey(targetClassSource)
    && group.describedFeatureCount > 1
  );

  return candidates
    .filter((group) => {
      if (!group.isLegacyCompatibility) return true;
      return !modernReprints.some((modern) => {
        if (normalizeSubclassName(modern.name) === normalizeSubclassName(group.name)) return true;
        const shared = reprintOverlap(modern, group);
        return shared >= 0.5 && Math.min(featureNames(modern).size, featureNames(group).size) >= 2;
      });
    })
    .sort((a, b) => safeText(a.name).localeCompare(safeText(b.name)) || sourcePublicationOrder(b.source) - sourcePublicationOrder(a.source) || safeText(a.source).localeCompare(safeText(b.source)));
}

export function findSubclassOption(options = [], name = "", source = "") {
  const normalizedName = normalizeSubclassName(name);
  const normalizedSource = sourceKey(source);
  if (!normalizedName) return null;
  return (Array.isArray(options) ? options : []).find((option) =>
    normalizeSubclassName(option.name) === normalizedName
    && (!normalizedSource || sourceKey(option.source) === normalizedSource)
  ) || (Array.isArray(options) ? options : []).find((option) => normalizeSubclassName(option.name) === normalizedName) || null;
}

export function guideSubclassFeatures(option = null) {
  return (option?.features || []).filter((feature) => !feature.isIntroduction);
}

export function subclassIntroduction(option = null) {
  return (option?.features || []).find((feature) => feature.isIntroduction && safeText(feature.description)) || null;
}
