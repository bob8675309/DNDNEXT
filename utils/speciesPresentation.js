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

const SKILL_OPTIONS = Object.freeze([
  ["acrobatics", "Acrobatics"], ["animalHandling", "Animal Handling"], ["arcana", "Arcana"], ["athletics", "Athletics"],
  ["deception", "Deception"], ["history", "History"], ["insight", "Insight"], ["intimidation", "Intimidation"],
  ["investigation", "Investigation"], ["medicine", "Medicine"], ["nature", "Nature"], ["perception", "Perception"],
  ["performance", "Performance"], ["persuasion", "Persuasion"], ["religion", "Religion"], ["sleightOfHand", "Sleight of Hand"],
  ["stealth", "Stealth"], ["survival", "Survival"],
].map(([value, label]) => Object.freeze({ value, label, description: `Gain proficiency in ${label}.`, source: "XPHB" })));

const ORIGIN_FEAT_OPTIONS = Object.freeze([
  ["Alert", "Add Proficiency to Initiative and swap Initiative with a willing ally after rolling."],
  ["Crafter", "Gain three Artisan's Tool proficiencies, receive nonmagical purchase discounts, and make temporary gear after a Long Rest."],
  ["Healer", "Use a Healer's Kit to restore Hit Points and reroll healing dice that roll a 1."],
  ["Lucky", "Gain Luck Points that can grant your rolls Advantage or impose Disadvantage on attacks against you."],
  ["Magic Initiate", "Learn two cantrips and one level-1 spell from the Cleric, Druid, or Wizard list."],
  ["Musician", "Gain three instrument proficiencies and grant Heroic Inspiration after rests by performing."],
  ["Savage Attacker", "Once per turn, roll a weapon's damage dice twice and use either result."],
  ["Skilled", "Gain proficiency in any combination of three skills or tools."],
  ["Tavern Brawler", "Improve Unarmed Strikes, improvised weapons, damage rerolls, and pushing with an Unarmed Strike."],
  ["Tough", "Increase maximum Hit Points by twice your level and gain 2 more with every later level."],
].map(([label, description]) => Object.freeze({ value: label, label, description, source: "XPHB" })));

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

function humanChoiceRule(detail) {
  const name = slug(detail.name);
  const description = String(detail.description || "");
  if (name === "skillful" || /gain proficiency in one skill/i.test(description)) {
    return {
      id: slug(detail.name || "skillful"),
      traitName: detail.name || "Skillful",
      required: true,
      fields: [{ id: "skill", label: "Choose skill proficiency", kind: "skill", required: true, options: SKILL_OPTIONS }],
    };
  }
  if (name === "versatile" || /gain an origin feat/i.test(description)) {
    return {
      id: slug(detail.name || "versatile"),
      traitName: detail.name || "Versatile",
      required: true,
      fields: [{ id: "feat", label: "Choose Origin feat", kind: "origin-feat", required: true, options: ORIGIN_FEAT_OPTIONS }],
    };
  }
  return null;
}

export function extractSpeciesTraitChoiceRules(option = {}) {
  const details = Array.isArray(option.traitDetails) && option.traitDetails.length
    ? option.traitDetails
    : extractSpeciesTraitDetails(option.metadata || {});

  return details.flatMap((detail) => {
    const humanRule = humanChoiceRule(detail);
    if (humanRule) return [humanRule];

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
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan",
});

export function speciesCharacterSizeOptions(option = {}) {
  return uniqueText(option.size).flatMap((value) => {
    const raw = String(value || "").trim();
    const label = CHARACTER_SIZE_BY_SOURCE_CODE[raw.toUpperCase()] || Object.values(CHARACTER_SIZE_BY_SOURCE_CODE).find((candidate) => candidate.toLowerCase() === raw.toLowerCase()) || "";
    return label ? [{ key: label, label }] : [];
  });
}

export function speciesDefaultCharacterSize(option = {}) {
  const options = speciesCharacterSizeOptions(option);
  return options.length === 1 ? options[0].key : "";
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
