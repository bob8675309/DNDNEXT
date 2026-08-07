import { formatPlayerFacingText } from "./playerFacingText";
import {
  safeText, normalized, slug, unique,
  WARLOCK_INVOCATION_PROGRESSION_XPHB, WARLOCK_INVOCATION_PROGRESSION_PHB,
  BATTLE_MASTER_MANEUVER_PROGRESSION, SORCERER_METAMAGIC_PROGRESSION_XPHB, SORCERER_METAMAGIC_PROGRESSION_PHB,
  ARTIFICER_PLAN_PROGRESSION_EFA, ARCANE_SHOT_PROGRESSION, RUNE_KNIGHT_PROGRESSION, FOUR_ELEMENTS_DISCIPLINE_PROGRESSION,
  OPTION_SUMMARIES, INVOCATION_PREREQUISITES, CLASS_OPTION_PREREQUISITES,
} from "./classFeatureChoiceConstants";

function walk(node, visit) {
  if (node == null) return;
  if (Array.isArray(node)) return node.forEach((value) => walk(value, visit));
  if (typeof node !== "object") return;
  visit(node);
  Object.values(node).forEach((value) => walk(value, visit));
}

function splitReference(value = "", referenceType = "optional-feature") {
  const parts = safeText(value).split("|");
  const name = safeText(parts[0]);
  if (referenceType === "class-feature") return { name, source: safeText(parts[4] || parts[2]), referenceType };
  if (referenceType === "subclass-feature") return { name, source: safeText(parts[6] || parts[4] || parts[2]), referenceType };
  return { name, source: safeText(parts[1]), referenceType };
}

export function referencedOptions(node) {
  const output = [];
  walk(node, (entry) => {
    if (entry.type === "refOptionalfeature" && entry.optionalfeature) {
      const reference = splitReference(entry.optionalfeature, "optional-feature");
      if (reference.name) output.push(reference);
    }
    if (entry.type === "refClassFeature" && entry.classFeature) {
      const reference = splitReference(entry.classFeature, "class-feature");
      if (reference.name) output.push(reference);
    }
    if (entry.type === "refSubclassFeature" && entry.subclassFeature) {
      const reference = splitReference(entry.subclassFeature, "subclass-feature");
      if (reference.name) output.push(reference);
    }
  });
  return output;
}

export function optionNodes(entries) {
  const output = [];
  walk(entries, (entry) => { if (entry.type === "options") output.push(entry); });
  return output;
}

const COUNT_WORDS = Object.freeze({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 });

export function textChoiceCount(description = "", fallback = 1) {
  const match = safeText(description).match(/(?:choose|select|learn|gain)\s+(?:any\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i);
  if (!match) return fallback;
  return Number(COUNT_WORDS[match[1].toLowerCase()] || match[1] || fallback);
}

function runtimeOnlyChoice(row) {
  const description = normalized(row?.description);
  if (!description) return false;
  return ["when you do so choose", "as a bonus action choose", "as an action choose", "can use one of the following", "use one of the following", "powers below", "following powers", "gain the following benefits", "based on the environment you chose"].some((phrase) => description.includes(phrase));
}

export function permanentChoiceText(row) {
  const description = normalized(row?.description);
  if (!description || runtimeOnlyChoice(row)) return false;
  return /\b(choose|select|learn|gain)\b/.test(description)
    && /(of your choice|one of the following|two types|three options|four plans|feature options)/.test(description);
}

function choiceDescription(node) {
  const parts = [];
  function collect(value) {
    if (value == null) return;
    if (typeof value === "string") {
      const cleaned = formatPlayerFacingText(value, "");
      if (cleaned) parts.push(cleaned);
      return;
    }
    if (Array.isArray(value)) return value.forEach(collect);
    if (typeof value !== "object") return;
    if (value.entries) collect(value.entries);
    if (value.entry) collect(value.entry);
    if (value.items) collect(value.items);
  }
  collect(node);
  return unique(parts).join("\n\n");
}

export function namedEntryOptions(entries) {
  const output = [];
  walk(entries, (entry) => {
    if (entry.type !== "entries" || !entry.name || !Array.isArray(entry.entries)) return;
    output.push({ name: safeText(entry.name), source: "", referenceType: "subclass-feature", description: choiceDescription(entry.entries) });
  });
  return output;
}

export function optionNodeCreatesChoice(row, node, kind) {
  if (["eldritch-invocation", "battle-master-maneuver", "metamagic", "arcane-shot", "rune", "elemental-discipline"].includes(kind)) return true;
  if (node && Object.prototype.hasOwnProperty.call(node, "count")) return true;
  if (normalized(row?.name) === "storm aura") return true;
  return permanentChoiceText(row);
}

export function tablePlanOptions(entries) {
  const output = [];
  walk(entries, (entry) => {
    if (entry.type !== "table" || !Array.isArray(entry.rows)) return;
    const captionText = safeText(entry.caption);
    if (!normalized(captionText).includes("magic item plan")) return;
    const minimumLevel = Number(captionText.match(/level\s+(\d+)\+/i)?.[1] || 2);
    for (const row of entry.rows) {
      const cell = Array.isArray(row) ? row[0] : null;
      const raw = typeof cell === "string" ? cell : cell?.entry || cell?.name || "";
      const cleaned = safeText(raw).replace(/\{@[^ ]+\s+([^}|]+)(?:\|[^}]*)?}/g, "$1");
      if (cleaned) output.push({ name: cleaned, source: "EFA", referenceType: "artificer-plan", minLevel: minimumLevel });
    }
  });
  return output;
}

function resolveFeatureDescription(option, features = []) {
  const key = normalized(option.name);
  const row = features.find((feature) => normalized(feature.name) === key && (!option.source || feature.source === option.source || feature.class_source === option.source));
  return formatPlayerFacingText(row?.description || OPTION_SUMMARIES[key], `A source-backed ${option.referenceType?.replace(/-/g, " ") || "class feature"} option. Select it to record this permanent class choice.`);
}

function optionKey(option) {
  return `${slug(option.name)}|${safeText(option.source || "CAMPAIGN").toUpperCase()}`;
}

export function enrichOptions(options, features, groupKind) {
  const seen = new Set();
  return options.flatMap((option) => {
    const name = safeText(option.name);
    if (!name) return [];
    const key = optionKey(option);
    if (seen.has(key)) return [];
    seen.add(key);
    const prerequisites = groupKind === "eldritch-invocation" ? INVOCATION_PREREQUISITES[normalized(name)] || {} : CLASS_OPTION_PREREQUISITES[normalized(name)] || {};
    return [{
      key,
      name,
      source: option.source || "CAMPAIGN",
      kind: option.referenceType || groupKind || "class-feature",
      description: formatPlayerFacingText(option.description, "") || resolveFeatureDescription(option, features),
      minLevel: Number(option.minLevel || prerequisites.minLevel || 1),
      requires: prerequisites.requires || "",
      followup: prerequisites.followup || "",
      raw: option.raw || null,
    }];
  });
}

function selectedSubclassMatches(row, selectedSubclass) {
  if (row.feature_type !== "subclass") return true;
  if (!selectedSubclass) return false;
  const rowNames = [row.subclass_name, row.subclass_short_name].map(normalized).filter(Boolean);
  if (!rowNames.includes(normalized(selectedSubclass.name))) return false;
  const selectedSource = safeText(selectedSubclass.source);
  const rowSource = safeText(row.subclass_source || row.source);
  return !selectedSource || !rowSource || selectedSource === rowSource;
}

export function eligibleRows(features, selectedClass, selectedSubclass, level) {
  return (Array.isArray(features) ? features : []).filter((row) => {
    if (Number(row.level || 1) > Number(level || 1)) return false;
    if (row.feature_type === "class" && row.class_source !== selectedClass?.source) return false;
    return selectedSubclassMatches(row, selectedSubclass);
  });
}

function sourceProgressionCount(selectedClass, kind, level) {
  const progressions = Array.isArray(selectedClass?.raw_payload?.optionalfeatureProgression) ? selectedClass.raw_payload.optionalfeatureProgression : [];
  const wanted = { "eldritch-invocation": ["ei"], "artificer-plan": ["ai", "mip"] }[kind] || [];
  const row = progressions.find((entry) => (entry.featureType || []).some((type) => wanted.includes(String(type).toLowerCase())));
  const value = row?.progression?.[Math.max(0, Math.min(19, Number(level || 1) - 1))];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function progressionCount(kind, selectedClass, level, fallback) {
  const sourceCount = sourceProgressionCount(selectedClass, kind, level);
  if (sourceCount != null) return sourceCount;
  const index = Math.max(0, Math.min(19, Number(level || 1) - 1));
  if (kind === "eldritch-invocation") return (selectedClass?.source === "XPHB" ? WARLOCK_INVOCATION_PROGRESSION_XPHB : WARLOCK_INVOCATION_PROGRESSION_PHB)[index] || fallback;
  if (kind === "battle-master-maneuver") return BATTLE_MASTER_MANEUVER_PROGRESSION[index] || fallback;
  if (kind === "metamagic") return (selectedClass?.source === "XPHB" ? SORCERER_METAMAGIC_PROGRESSION_XPHB : SORCERER_METAMAGIC_PROGRESSION_PHB)[index] || fallback;
  if (kind === "artificer-plan") return ARTIFICER_PLAN_PROGRESSION_EFA[index] || fallback;
  if (kind === "arcane-shot") return ARCANE_SHOT_PROGRESSION[index] || fallback;
  if (kind === "rune") return RUNE_KNIGHT_PROGRESSION[index] || fallback;
  if (kind === "elemental-discipline") return FOUR_ELEMENTS_DISCIPLINE_PROGRESSION[index] || fallback;
  return fallback;
}

export function groupKind(row) {
  const name = normalized(row.name);
  if (name === "fighting style") return "fighting-style";
  if (name.includes("eldritch invocation")) return "eldritch-invocation";
  if (name === "maneuvers" || name.includes("maneuver option")) return "battle-master-maneuver";
  if (name === "metamagic" || name.includes("metamagic option")) return "metamagic";
  if (name.includes("arcane shot")) return "arcane-shot";
  if (name === "rune carver" || name.includes("rune option")) return "rune";
  if (name.includes("elemental discipline")) return "elemental-discipline";
  return "class-feature";
}

export function mergeProgressionGroups(groups, selectedClass, level) {
  const merged = [];
  const buckets = new Map();
  for (const group of groups) {
    if (!["eldritch-invocation", "battle-master-maneuver", "metamagic", "artificer-plan", "arcane-shot", "rune", "elemental-discipline"].includes(group.kind)) {
      merged.push(group);
      continue;
    }
    const key = `${group.kind}|${normalized(group.subclassName)}`;
    const existing = buckets.get(key);
    if (!existing) buckets.set(key, { ...group, options: [...group.options] });
    else {
      const byKey = new Map(existing.options.map((option) => [option.key, option]));
      group.options.forEach((option) => { if (!byKey.has(option.key)) byKey.set(option.key, option); });
      existing.options = [...byKey.values()];
      existing.level = Math.min(Number(existing.level || group.level || 1), Number(group.level || existing.level || 1));
    }
  }
  for (const group of buckets.values()) {
    group.count = progressionCount(group.kind, selectedClass, level, group.count);
    merged.push(group);
  }
  return merged;
}
