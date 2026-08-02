import { formatPlayerFacingText } from "./playerFacingText.js";
import {
  findSubclassOption,
  guideSubclassFeatures,
  resolveSubclassCatalog,
} from "./classes/subclassCompatibility.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeName(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueText(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(safeText).filter(Boolean))];
}

function featureIdentity(category, name) {
  return `${normalizeName(category)}:${normalizeName(name)}`;
}

function addFeature(target, feature) {
  const category = safeText(feature?.category || "Trait") || "Trait";
  const name = safeText(feature?.name);
  if (!name) return;
  const identity = featureIdentity(category, name);
  if (target.has(identity)) {
    const current = target.get(identity);
    target.set(identity, {
      ...current,
      ...feature,
      category,
      name,
      description: safeText(feature?.description) || current.description,
      source: safeText(feature?.source) || current.source,
      origin: safeText(feature?.origin) || current.origin,
    });
    return;
  }
  target.set(identity, {
    id: safeText(feature?.id) || identity,
    category,
    name,
    description: safeText(feature?.description) || "No imported description is available for this entry yet.",
    source: safeText(feature?.source),
    level: Number.isFinite(Number(feature?.level)) ? Number(feature.level) : null,
    origin: safeText(feature?.origin),
  });
}

function speciesTraitDetails(speciesOption = null) {
  const metadataTraits = Array.isArray(speciesOption?.metadata?.traits) ? speciesOption.metadata.traits : [];
  const rawTraits = Array.isArray(speciesOption?.raw_payload?.entries) ? speciesOption.raw_payload.entries : [];
  const rows = metadataTraits.length ? metadataTraits : rawTraits;
  return rows.map((row) => ({
    name: safeText(row?.name),
    description: formatPlayerFacingText(
      Array.isArray(row?.entries)
        ? row.entries.map((entry) => typeof entry === "string" ? entry : safeText(entry?.name || entry?.entry)).filter(Boolean).join("\n\n")
        : row?.entries
    ),
  })).filter((row) => row.name);
}

function matchingSpeciesDescription(name, details = []) {
  const normalized = normalizeName(name);
  const match = details.find((row) => {
    const candidate = normalizeName(row.name);
    return normalized === candidate || normalized.startsWith(`${candidate} `) || candidate.startsWith(`${normalized} `);
  });
  return safeText(match?.description);
}

function parseLegacyTraitLines(value) {
  return safeText(value).split(/\r?\n/).map((line) => {
    const raw = safeText(line);
    const separator = raw.indexOf(":");
    return separator >= 0
      ? { category: safeText(raw.slice(0, separator)) || "Trait", name: safeText(raw.slice(separator + 1)) }
      : { category: "Trait", name: raw };
  }).filter((row) => row.name);
}

function isStructuralClassRow(row) {
  const name = normalizeName(row?.name);
  return name.endsWith(" subclass") || name === "subclass";
}

export function buildCharacterSheetFeatures({
  sheet = {},
  grantedOptions = [],
  progression = null,
  classRow = null,
  classFeatureRows = [],
  speciesOption = null,
} = {}) {
  const features = new Map();
  const grants = Array.isArray(grantedOptions) ? grantedOptions : [];
  const sheetFeatNames = uniqueText(sheet?.feats || []);
  const grantNames = new Set();

  for (const grant of grants) {
    const optionType = safeText(grant?.optionType || grant?.option_type || "feat").toLowerCase();
    if (optionType !== "feat" && optionType !== "boon") continue;
    const name = safeText(grant?.name);
    if (!name) continue;
    grantNames.add(normalizeName(name));
    addFeature(features, {
      id: grant?.id,
      category: optionType === "boon" ? "Epic Boon" : "Feat",
      name,
      description: grant?.description,
      source: grant?.source,
      origin: grant?.notes ? `Grant: ${safeText(grant.notes)}` : "Feats & Boons",
    });
  }

  for (const name of sheetFeatNames) {
    if (grantNames.has(normalizeName(name))) continue;
    addFeature(features, { category: "Feat", name, origin: "Character sheet" });
  }

  const speciesDetails = speciesTraitDetails(speciesOption);
  for (const name of uniqueText(sheet?.speciesTraits || [])) {
    addFeature(features, {
      category: "Species",
      name,
      description: matchingSpeciesDescription(name, speciesDetails),
      source: speciesOption?.source || sheet?.speciesSource || sheet?.meta?.speciesSource,
      origin: safeText(sheet?.species || sheet?.race || sheet?.meta?.species),
    });
  }

  const catalogRows = Array.isArray(classFeatureRows) ? classFeatureRows : [];
  const classSource = safeText(classRow?.source || sheet?.classSource || sheet?.meta?.classSource || "XPHB") || "XPHB";
  const level = Math.max(1, Number(progression?.class_level || sheet?.level || sheet?.meta?.level || 1));
  const baseRows = catalogRows.filter((row) =>
    row?.feature_type === "class"
    && safeText(row?.class_source) === classSource
    && Number(row?.level || 1) <= level
    && !isStructuralClassRow(row)
  );
  const subclassOptions = resolveSubclassCatalog(catalogRows, classSource);
  const selectedSubclass = findSubclassOption(
    subclassOptions,
    progression?.subclass_name || sheet?.subclass || sheet?.meta?.subclass,
    progression?.subclass_source || sheet?.subclassSource || sheet?.meta?.subclassSource
  );
  const subclassRows = guideSubclassFeatures(selectedSubclass).filter((row) => Number(row?.level || 1) <= level);

  for (const row of [...baseRows, ...subclassRows]) {
    addFeature(features, {
      id: row?.id,
      category: row?.feature_type === "subclass" ? "Subclass" : "Class",
      name: row?.name,
      description: formatPlayerFacingText(row?.description),
      source: row?.source || row?.class_source,
      level: row?.level,
      origin: row?.feature_type === "subclass"
        ? safeText(selectedSubclass?.name || progression?.subclass_name)
        : safeText(classRow?.class_name || sheet?.className || sheet?.class),
    });
  }

  if (!baseRows.length && !subclassRows.length) {
    for (const name of uniqueText(sheet?.classFeatures || [])) {
      addFeature(features, { category: "Class", name, origin: safeText(sheet?.className || sheet?.class) });
    }
  }

  const existingNames = new Set([...features.values()].map((row) => normalizeName(row.name)));
  for (const legacy of parseLegacyTraitLines(sheet?.featsTraits)) {
    if (existingNames.has(normalizeName(legacy.name))) continue;
    addFeature(features, legacy);
  }

  const categoryOrder = { Feat: 0, "Epic Boon": 1, Species: 2, Class: 3, Subclass: 4, Trait: 5 };
  return [...features.values()].sort((left, right) =>
    Number(categoryOrder[left.category] ?? 9) - Number(categoryOrder[right.category] ?? 9)
    || Number(left.level || 0) - Number(right.level || 0)
    || safeText(left.name).localeCompare(safeText(right.name))
  );
}

export function formatCharacterSheetFeatureText(features = [], fallback = "") {
  const rows = (Array.isArray(features) ? features : [])
    .map((feature) => `${safeText(feature?.category || "Trait")}: ${safeText(feature?.name)}`)
    .filter((value) => !value.endsWith(": "));
  return rows.length ? rows.join("\n") : safeText(fallback);
}
