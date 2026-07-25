import { formatPlayerFacingInline, formatPlayerFacingText } from "./playerFacingText.js";

function uniqueText(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function flattenEntryText(node) {
  const output = [];
  function walk(value) {
    if (value == null) return;
    if (typeof value === "string") {
      const cleaned = formatPlayerFacingText(value);
      if (cleaned) output.push(cleaned);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value !== "object") return;
    if (value.entry) walk(value.entry);
    if (value.entries) walk(value.entries);
    if (value.items) walk(value.items);
    if (value.rows) walk(value.rows);
    if (value.caption) walk(value.caption);
  }
  walk(node);
  return uniqueText(output).join("\n\n");
}

function slug(value = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleCaseSpell(value = "") {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const SPELLCASTING_ABILITY_OPTIONS = Object.freeze([
  Object.freeze({ value: "int", label: "Intelligence" }),
  Object.freeze({ value: "wis", label: "Wisdom" }),
  Object.freeze({ value: "cha", label: "Charisma" }),
]);

function cantripOptionsFromDescription(description = "") {
  const match = String(description).match(/one of the following cantrips(?: of your choice)?\s*:\s*([^.]*)\./i);
  if (!match) return [];
  return uniqueText(
    match[1]
      .replace(/\s+or\s+/gi, ",")
      .split(",")
      .map((value) => value.replace(/^\s*(?:and\s+)?/i, "").trim())
      .filter(Boolean)
      .map(titleCaseSpell),
  ).map((label) => ({ value: label, label }));
}

function spellcastingAbilityOptionsFromDescription(description = "") {
  if (!/spellcasting ability/i.test(description)) return [];
  return SPELLCASTING_ABILITY_OPTIONS.filter((option) => new RegExp(`\\b${option.label}\\b`, "i").test(description));
}

export function extractSpeciesTraitDetails(metadata = {}) {
  const entries = Array.isArray(metadata.traits) ? metadata.traits : [];
  return entries.map((entry) => {
    if (typeof entry === "string") {
      const name = formatPlayerFacingInline(entry);
      return name ? { name, description: "" } : null;
    }
    if (!entry || typeof entry !== "object") return null;
    const name = formatPlayerFacingInline(entry.name || entry.title || "Species Feature");
    const description = formatPlayerFacingText(flattenEntryText(entry));
    return name || description ? { name: name || "Species Feature", description } : null;
  }).filter(Boolean);
}

export function extractSpeciesTraitChoiceRules(option = {}) {
  const details = Array.isArray(option.traitDetails) && option.traitDetails.length
    ? option.traitDetails
    : extractSpeciesTraitDetails(option.metadata || {});

  return details.flatMap((detail) => {
    const cantripOptions = cantripOptionsFromDescription(detail.description);
    if (cantripOptions.length < 2) return [];

    const abilityOptions = spellcastingAbilityOptionsFromDescription(detail.description);
    const fields = [
      {
        id: "cantrip",
        label: "Choose cantrip",
        kind: "spell",
        required: true,
        options: cantripOptions,
      },
    ];
    if (abilityOptions.length > 1) {
      fields.push({
        id: "ability",
        label: "Spellcasting ability",
        kind: "ability",
        required: true,
        options: abilityOptions,
      });
    }

    return [{
      id: slug(detail.name || "species-feature"),
      traitName: detail.name || "Species Feature",
      required: true,
      fields,
    }];
  });
}

export function speciesTraitChoiceRuleComplete(rule = {}, selections = {}) {
  return (rule.fields || []).every((field) => !field.required || Boolean(String(selections?.[rule.id]?.[field.id] ?? "").trim()));
}

const CHARACTER_SIZE_BY_SOURCE_CODE = Object.freeze({
  S: "Small",
  M: "Medium",
  L: "Large",
});

export function speciesDefaultCharacterSize(option = {}) {
  const sourceSizes = uniqueText(option.size);
  if (sourceSizes.length !== 1) return "";
  return CHARACTER_SIZE_BY_SOURCE_CODE[sourceSizes[0].toUpperCase()] || "";
}

const MOVEMENT_LABELS = Object.freeze({
  walk: "Walking",
  burrow: "Burrowing",
  climb: "Climbing",
  fly: "Flying",
  swim: "Swimming",
});

export function formatSpeciesMovement(speed) {
  if (speed == null || speed === "") return "Varies";
  if (Number.isFinite(Number(speed))) return `${Number(speed)} ft.`;
  if (!speed || typeof speed !== "object") return "Varies";

  const parts = Object.entries(MOVEMENT_LABELS).flatMap(([key, label]) => {
    const value = speed[key];
    if (value === true && key !== "walk") return [`${label} equal to walking speed`];
    if (Number.isFinite(Number(value))) return [`${label} ${Number(value)} ft.`];
    return [];
  });

  return parts.join(", ") || "Varies";
}
