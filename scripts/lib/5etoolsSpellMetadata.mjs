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
  const match = String(value || "").match(/\b([1-9])(?:st|nd|rd|th)?\b/i);
  return match ? Number(match[1]) : 0;
}

function findSpellSlotProgression(classEntry = {}) {
  const groups = Array.isArray(classEntry.classTableGroups) ? classEntry.classTableGroups : [];
  const standard = groups.find((group) => Array.isArray(group.rowsSpellProgression));
  if (standard) return standard.rowsSpellProgression.map((row) => Array.isArray(row) ? row.map((value) => Number(value) || 0) : []);

  const pactGroup = groups.find((group) => Array.isArray(group.rows) && (group.colLabels || []).some((label) => /slot level/i.test(String(label))));
  if (!pactGroup) return [];
  const labels = pactGroup.colLabels || [];
  const slotLevelIndex = labels.findIndex((label) => /slot level/i.test(String(label)));
  return pactGroup.rows.map((row) => {
    const slotLevel = parseOrdinalLevel(Array.isArray(row) ? row[slotLevelIndex] : 0);
    return Array.from({ length: 9 }, (_, index) => slotLevel >= index + 1 ? 1 : 0);
  });
}

function buildUnlockLevels(classEntry = {}, slotProgression = []) {
  const unlockLevels = {};
  const cantripProgression = Array.isArray(classEntry.cantripProgression) ? classEntry.cantripProgression : [];
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

export function normalizeClassProgression(classEntry = {}, sourceFile = "") {
  const slotProgression = findSpellSlotProgression(classEntry);
  const unlockLevels = buildUnlockLevels(classEntry, slotProgression);
  return {
    class_key: String(classEntry.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    class_name: classEntry.name || "",
    source: classEntry.source || "UNK",
    source_file: sourceFile || null,
    edition: classEntry.edition || null,
    spellcasting_ability: classEntry.spellcastingAbility || null,
    caster_progression: classEntry.casterProgression || null,
    prepared_spells_formula: classEntry.preparedSpells || null,
    cantrip_progression: classEntry.cantripProgression || [],
    spells_known_progression: classEntry.spellsKnownProgression || [],
    spells_known_progression_fixed: classEntry.spellsKnownProgressionFixed || [],
    spells_known_progression_fixed_by_level: classEntry.spellsKnownProgressionFixedByLevel || {},
    slot_progression: slotProgression,
    unlock_levels: unlockLevels,
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
      if (!classEntry?.name || (!classEntry.spellcastingAbility && !classEntry.casterProgression)) continue;
      const normalized = normalizeClassProgression(classEntry, filename);
      const key = `${normalized.class_key}|${normalized.source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(normalized);
    }
  }

  return out.sort((a, b) => a.class_name.localeCompare(b.class_name) || a.source.localeCompare(b.source));
}
