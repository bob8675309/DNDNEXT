import fs from "node:fs";
import path from "node:path";

function unique(values = []) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))].sort();
}

function classNameFromEntry(entry = {}) {
  return entry?.name || entry?.class?.name || "";
}

function subclassLabelFromEntry(entry = {}) {
  const className = entry?.class?.name || entry?.className || "";
  const subclassName = entry?.subclass?.name || entry?.subclassName || entry?.name || "";
  if (className && subclassName) return `${className}: ${subclassName}`;
  return subclassName;
}

export function mergeExternalSpellAccess(row = {}, spell = {}, sourcesIndex = {}) {
  const external = sourcesIndex?.[spell?.source]?.[spell?.name] || {};
  const externalClasses = [
    ...(Array.isArray(external.class) ? external.class : []),
    ...(Array.isArray(external.classes) ? external.classes : []),
    ...(Array.isArray(external.classVariant) ? external.classVariant : []),
    ...(Array.isArray(external.classVariants) ? external.classVariants : []),
  ].map(classNameFromEntry);
  const externalSubclasses = [
    ...(Array.isArray(external.subclass) ? external.subclass : []),
    ...(Array.isArray(external.subclasses) ? external.subclasses : []),
  ].map(subclassLabelFromEntry);

  return {
    ...row,
    classes: unique([...(row.classes || []), ...externalClasses]),
    subclasses: unique([...(row.subclasses || []), ...externalSubclasses]),
  };
}

function parseOrdinalLevel(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    const numeric = Number(value.value ?? value.number ?? value.level);
    if (Number.isFinite(numeric)) return numeric;
  }
  const match = String(value || "").match(/\b([1-9])(?:st|nd|rd|th)?\b/i);
  return match ? Number(match[1]) : 0;
}

function parseCellNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    const numeric = Number(value.value ?? value.number ?? value.amount);
    if (Number.isFinite(numeric)) return numeric;
  }
  const match = String(value || "").match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function findProgressionColumn(classEntry = {}, patterns = []) {
  const groups = Array.isArray(classEntry.classTableGroups) ? classEntry.classTableGroups : [];
  for (const group of groups) {
    const labels = Array.isArray(group.colLabels) ? group.colLabels : [];
    const rows = Array.isArray(group.rows) ? group.rows : [];
    if (!labels.length || !rows.length) continue;
    const columnIndex = labels.findIndex((label) => patterns.some((pattern) => pattern.test(String(label))));
    if (columnIndex < 0) continue;
    const progression = rows.map((row) => {
      const values = Array.isArray(row) ? row : [];
      return Math.max(0, parseCellNumber(values[columnIndex]));
    });
    if (progression.some((value) => value > 0)) return progression;
  }
  return [];
}

function findSpellSlotProgression(classEntry = {}) {
  const groups = Array.isArray(classEntry.classTableGroups) ? classEntry.classTableGroups : [];
  const standard = groups.find((group) => Array.isArray(group.rowsSpellProgression));
  if (standard) {
    return standard.rowsSpellProgression.map((row) => (
      Array.isArray(row) ? row.map((value) => Math.max(0, parseCellNumber(value))) : []
    ));
  }

  const pactGroup = groups.find((group) => {
    const labels = Array.isArray(group.colLabels) ? group.colLabels : [];
    return Array.isArray(group.rows) && labels.some((label) => /slot level/i.test(String(label)));
  });
  if (!pactGroup) return [];

  const labels = pactGroup.colLabels || [];
  const slotLevelIndex = labels.findIndex((label) => /slot level/i.test(String(label)));
  const slotCountIndex = labels.findIndex((label) => /(?:spell|pact)?\s*slots?(?!\s*level)/i.test(String(label)));

  return pactGroup.rows.map((row) => {
    const values = Array.isArray(row) ? row : [];
    const slotLevel = parseOrdinalLevel(values[slotLevelIndex]);
    const slotCount = Math.max(0, parseCellNumber(values[slotCountIndex]));
    return Array.from({ length: 9 }, (_, index) => index + 1 === slotLevel ? slotCount : 0);
  });
}

function buildUnlockLevels(classEntry = {}, slotProgression = [], cantripProgression = []) {
  const unlockLevels = {};
  if (cantripProgression.some((value) => Number(value) > 0)) {
    unlockLevels["0"] = cantripProgression.findIndex((value) => Number(value) > 0) + 1;
  }

  for (let spellLevel = 1; spellLevel <= 9; spellLevel += 1) {
    const classLevelIndex = slotProgression.findIndex((row) => Number(row?.[spellLevel - 1] || 0) > 0);
    if (classLevelIndex >= 0) unlockLevels[String(spellLevel)] = classLevelIndex + 1;
  }

  const fixedByLevel = classEntry.spellsKnownProgressionFixedByLevel || {};
  for (const [classLevel, spellLevels] of Object.entries(fixedByLevel)) {
    for (const spellLevel of Object.keys(spellLevels || {})) {
      if (!unlockLevels[spellLevel] || Number(classLevel) < unlockLevels[spellLevel]) unlockLevels[spellLevel] = Number(classLevel);
    }
  }

  return unlockLevels;
}

function classFeatureLevel(feature) {
  if (feature && typeof feature === "object") {
    const numeric = Number(feature.level ?? feature.classLevel);
    if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 20) return numeric;
  }

  const parts = String(feature || "").split("|");
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const numeric = Number(parts[index]);
    if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 20) return numeric;
  }
  return null;
}

function groupClassFeaturesByLevel(classEntry = {}) {
  const grouped = {};
  for (const feature of Array.isArray(classEntry.classFeatures) ? classEntry.classFeatures : []) {
    const level = classFeatureLevel(feature);
    if (!level) continue;
    const key = String(level);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(feature);
  }
  return grouped;
}

function hitDieFaces(classEntry = {}) {
  const numeric = Number(classEntry?.hd?.faces);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function normalizeClassProgression(classEntry = {}, sourceFile = "") {
  const slotProgression = findSpellSlotProgression(classEntry);
  const cantripProgression = Array.isArray(classEntry.cantripProgression) && classEntry.cantripProgression.length
    ? classEntry.cantripProgression
    : findProgressionColumn(classEntry, [/cantrips?\s+(?:known|prepared)/i]);
  const spellsKnownProgression = Array.isArray(classEntry.spellsKnownProgression) && classEntry.spellsKnownProgression.length
    ? classEntry.spellsKnownProgression
    : findProgressionColumn(classEntry, [/(?:prepared\s+spells|spells\s+(?:known|prepared))/i]);
  const unlockLevels = buildUnlockLevels(classEntry, slotProgression, cantripProgression);
  return {
    class_key: String(classEntry.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    class_name: classEntry.name || "",
    source: classEntry.source || "UNK",
    source_file: sourceFile || null,
    edition: classEntry.edition || null,
    hit_die: hitDieFaces(classEntry),
    saving_throws: Array.isArray(classEntry.proficiency) ? classEntry.proficiency : [],
    spellcasting_ability: classEntry.spellcastingAbility || null,
    caster_progression: classEntry.casterProgression || null,
    prepared_spells_formula: classEntry.preparedSpells || null,
    cantrip_progression: cantripProgression,
    spells_known_progression: spellsKnownProgression,
    spells_known_progression_fixed: classEntry.spellsKnownProgressionFixed || [],
    spells_known_progression_fixed_by_level: classEntry.spellsKnownProgressionFixedByLevel || {},
    slot_progression: slotProgression,
    unlock_levels: unlockLevels,
    class_features_by_level: groupClassFeaturesByLevel(classEntry),
    starting_proficiencies: classEntry.startingProficiencies || {},
    multiclassing: classEntry.multiclassing || {},
  };
}

export function loadClassProgressions(spellsDir, readJson) {
  const classDir = path.resolve(spellsDir, "../class");
  if (!fs.existsSync(classDir)) return [];
  const filenames = fs.readdirSync(classDir)
    .filter((filename) => /^class-.*\.json$/i.test(filename))
    .sort();
  const out = [];
  const seen = new Set();

  for (const filename of filenames) {
    const filePath = path.join(classDir, filename);
    const data = readJson(filePath);
    for (const classEntry of data.class || []) {
      if (!classEntry?.name) continue;
      const normalized = normalizeClassProgression(classEntry, filename);
      const key = `${normalized.class_key}|${normalized.source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(normalized);
    }
  }

  return out.sort((a, b) => a.class_name.localeCompare(b.class_name) || a.source.localeCompare(b.source));
}
