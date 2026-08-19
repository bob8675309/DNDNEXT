import {
  ABILITY_KEYS,
  BACKGROUND_DEFINITIONS,
  BACKGROUND_KEYS,
  CLASS_DEFINITIONS,
  CLASS_KEYS,
  SKILL_DEFINITIONS,
  SPECIES_DEFINITIONS,
  SPECIES_KEYS,
} from "./characterCreation.js";
import { formatPlayerFacingInline, formatPlayerFacingText } from "./playerFacingText.js";
import { extractSpeciesTraitDetails } from "./speciesPresentation.js";
import { backgroundStoryDescription } from "./backgroundPresentation.js";
import {
  backgroundExpandedSpellNames,
  backgroundFeatRule,
  backgroundFeatureDetails,
  backgroundSkillRule,
  extractBackgroundSpellList,
} from "./backgroundMechanics.js";

export function safeText(value) {
  return String(value ?? "").trim();
}

export function slug(value = "") {
  return safeText(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function uniqueText(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(safeText).filter(Boolean))];
}

const SKILL_BY_SLUG = new Map();
for (const skill of SKILL_DEFINITIONS) {
  SKILL_BY_SLUG.set(slug(skill.key), skill.key);
  SKILL_BY_SLUG.set(slug(skill.label), skill.key);
}

export function normalizeSkillKey(value = "") {
  return SKILL_BY_SLUG.get(slug(value)) || "";
}

export function clean5eLabel(value = "") {
  const raw = safeText(value);
  const labels = {
    any: "Any language",
    anyStandard: "Any standard language",
    anyExotic: "Any exotic language",
    anyGamingSet: "Any gaming set",
    anyArtisansTool: "Any artisan's tools",
    anyMusicalInstrument: "Any musical instrument",
  };
  if (labels[raw]) return labels[raw];
  return formatPlayerFacingInline(raw)
    .replace(/^any gaming set$/i, "Any gaming set")
    .replace(/^any artisan'?s tools?$/i, "Any artisan's tools")
    .replace(/^any musical instrument$/i, "Any musical instrument");
}

export function extractAbilityChoices(metadata = {}) {
  const found = new Set();
  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object") return;
    if (Array.isArray(node.from)) node.from.filter((key) => ABILITY_KEYS.includes(key)).forEach((key) => found.add(key));
    ABILITY_KEYS.forEach((key) => { if (node[key] != null) found.add(key); });
    Object.values(node).forEach(walk);
  }
  walk(metadata.abilities || metadata.ability || []);
  return found.size ? [...found] : ABILITY_KEYS;
}

export function extractBackgroundSkills(metadata = {}) {
  return backgroundSkillRule({ metadata }).fixedKeys.map(normalizeSkillKey).filter(Boolean);
}

export function extractBackgroundFeat(metadata = {}) {
  const rule = backgroundFeatRule({ metadata });
  return rule.fixedName ? clean5eLabel(rule.fixedName) : "";
}

export function extractBackgroundTools(metadata = {}) {
  const output = [];
  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === "string") {
      const text = clean5eLabel(node);
      if (text) output.push(text);
      return;
    }
    if (typeof node !== "object") return;
    Object.entries(node).forEach(([key, value]) => {
      if (key === "choose" && value && typeof value === "object") {
        const from = Array.isArray(value.from) ? value.from : [];
        if (from.length) from.forEach(walk);
        return;
      }
      if (value === true || Number(value) > 0) output.push(clean5eLabel(key));
      else walk(value);
    });
  }
  walk(metadata.tools || metadata.toolProficiencies || []);
  return uniqueText(output);
}

export function extractClassSkillConfiguration(classRow = null) {
  const fallback = CLASS_DEFINITIONS[classRow?.class_key] || CLASS_DEFINITIONS.civilian;
  const start = classRow?.raw_payload?.startingProficiencies || classRow?.raw_payload?.starting_proficiencies || {};
  const entries = Array.isArray(start.skills) ? start.skills : [];
  let count = fallback.skillCount;
  let options = [...fallback.skillOptions];
  for (const entry of entries) {
    const choose = entry?.choose || entry?.from ? (entry.choose || entry) : null;
    if (!choose) continue;
    const from = Array.isArray(choose.from) ? choose.from.map(normalizeSkillKey).filter(Boolean) : [];
    if (from.length) options = from;
    if (Number(choose.count) > 0) count = Number(choose.count);
  }
  return { count, options: uniqueText(options) };
}

function staticSpeciesRows() {
  return SPECIES_KEYS.map((key) => ({
    id: `static-species-${key}`,
    key,
    name: SPECIES_DEFINITIONS[key].label,
    source: "XPHB",
    description: (SPECIES_DEFINITIONS[key].traits || []).join(". ") || "Campaign-defined species traits.",
    metadata: {
      speed: SPECIES_DEFINITIONS[key].speed,
      traits: SPECIES_DEFINITIONS[key].traits || [],
      lineages: SPECIES_DEFINITIONS[key].lineages || [],
    },
    isStatic: true,
  }));
}

function staticBackgroundRows() {
  return BACKGROUND_KEYS.map((key) => ({
    id: `static-background-${key}`,
    key,
    name: BACKGROUND_DEFINITIONS[key].label,
    source: "XPHB",
    description: `${BACKGROUND_DEFINITIONS[key].label} grants ${BACKGROUND_DEFINITIONS[key].skills.map((skill) => SKILL_DEFINITIONS.find((row) => row.key === skill)?.label || skill).join(" and ") || "campaign-defined training"}.`,
    metadata: {
      abilities: BACKGROUND_DEFINITIONS[key].abilities,
      skills: BACKGROUND_DEFINITIONS[key].skills.map((skill) => ({ [skill]: true })),
      tools: BACKGROUND_DEFINITIONS[key].tool ? [{ [BACKGROUND_DEFINITIONS[key].tool]: true }] : [],
      feats: BACKGROUND_DEFINITIONS[key].feat ? [{ [BACKGROUND_DEFINITIONS[key].feat]: true }] : [],
    },
    raw_payload: {
      skillProficiencies: BACKGROUND_DEFINITIONS[key].skills.map((skill) => ({ [skill]: true })),
      toolProficiencies: BACKGROUND_DEFINITIONS[key].tool ? [{ [BACKGROUND_DEFINITIONS[key].tool]: true }] : [],
      feats: BACKGROUND_DEFINITIONS[key].feat ? [{ [BACKGROUND_DEFINITIONS[key].feat]: true }] : [],
      entries: [],
    },
    isStatic: true,
  }));
}

function staticClassRows() {
  return CLASS_KEYS.map((key) => ({
    id: `static-class-${key}`,
    class_key: key,
    class_name: CLASS_DEFINITIONS[key].label,
    source: key === "civilian" ? "CAMPAIGN" : "XPHB",
    ruleset: key === "civilian" ? "campaign" : "2024",
    edition: key === "civilian" ? null : 2024,
    hit_die: CLASS_DEFINITIONS[key].hitDie,
    primary_abilities: CLASS_DEFINITIONS[key].primaryAbilities,
    saving_throws: CLASS_DEFINITIONS[key].savingThrows,
    spellcasting_ability: CLASS_DEFINITIONS[key].spellcastingAbility,
    caster_progression: null,
    summary: CLASS_DEFINITIONS[key].summary,
    raw_payload: {
      startingProficiencies: {
        skills: [{ choose: { from: CLASS_DEFINITIONS[key].skillOptions, count: CLASS_DEFINITIONS[key].skillCount } }],
      },
    },
    isStatic: true,
  }));
}

export function normalizeSpeciesOption(row = {}) {
  const key = slug(row.name);
  const metadata = row.metadata || {};
  const traitDetails = extractSpeciesTraitDetails(metadata);
  return {
    id: row.id,
    key,
    name: row.name,
    source: row.source || "UNK",
    description: formatPlayerFacingText(row.description, "No source description is available."),
    lore: formatPlayerFacingText(metadata.lore, ""),
    metadata,
    traits: uniqueText([
      ...traitDetails.map((entry) => entry.name),
      ...(Array.isArray(metadata.traits) ? metadata.traits.map((entry) => typeof entry === "string" ? clean5eLabel(entry) : clean5eLabel(entry?.name)).filter(Boolean) : []),
    ]),
    traitDetails,
    lineages: Array.isArray(metadata.lineages) ? metadata.lineages : metadata.lineage ? [metadata.lineage] : [],
    speed: Number(metadata.speed?.walk || metadata.speed || 30),
    size: Array.isArray(metadata.size) ? metadata.size : [],
    creatureTypes: Array.isArray(metadata.creatureTypes) ? metadata.creatureTypes.map(clean5eLabel).filter(Boolean) : [],
    darkvision: metadata.darkvision == null ? null : Number(metadata.darkvision),
    languages: extractBackgroundTools({ tools: metadata.languages || metadata.languageProficiencies || [] }),
    isStatic: Boolean(row.isStatic),
  };
}

function canonicalBackgroundSkillRule(rule = {}) {
  return {
    fixedKeys: uniqueText((rule.fixedKeys || []).map(normalizeSkillKey).filter(Boolean)),
    choiceGroups: (rule.choiceGroups || []).map((group) => ({
      ...group,
      from: uniqueText((group.from || []).map(normalizeSkillKey).filter(Boolean)),
    })).filter((group) => group.from.length),
  };
}

export function normalizeBackgroundOption(row = {}) {
  const metadata = row.metadata || {};
  const rawPayload = row.raw_payload || metadata.rawPayload || metadata.raw_payload || {};
  const normalized = {
    key: slug(row.name),
    name: row.name,
    source: row.source || "UNK",
    description: formatPlayerFacingText(row.description, "No source description is available."),
    metadata,
    rawPayload,
  };
  const featRule = backgroundFeatRule(normalized);
  const skillRule = canonicalBackgroundSkillRule(backgroundSkillRule(normalized));
  const spellList = extractBackgroundSpellList(normalized);
  return {
    id: row.id,
    ...normalized,
    lore: backgroundStoryDescription(normalized),
    recommendedAbilities: extractAbilityChoices(metadata),
    backgroundSkills: skillRule.fixedKeys,
    skillRule,
    originFeat: featRule.fixedName ? clean5eLabel(featRule.fixedName) : "",
    featRule,
    features: backgroundFeatureDetails(normalized),
    spellList,
    expandedSpellNames: backgroundExpandedSpellNames(normalized),
    tools: extractBackgroundTools(metadata),
    metadata,
    isStatic: Boolean(row.isStatic),
  };
}

export function mergePreferredSpecies(rows = []) {
  const imported = rows.filter((row) => row.option_type === "species").map(normalizeSpeciesOption);
  return imported.length ? imported : staticSpeciesRows().map(normalizeSpeciesOption);
}

export function mergePreferredBackgrounds(rows = []) {
  const imported = rows.filter((row) => row.option_type === "background").map(normalizeBackgroundOption);
  return imported.length ? imported : staticBackgroundRows().map(normalizeBackgroundOption);
}

export function mergePreferredClasses(rows = []) {
  const imported = Array.isArray(rows) ? rows.filter((row) => row?.class_key) : [];
  const byKey = new Map(imported.map((row) => [row.class_key, row]));
  for (const fallback of staticClassRows()) {
    if (!byKey.has(fallback.class_key)) byKey.set(fallback.class_key, fallback);
  }
  return [...byKey.values()].sort((a, b) => safeText(a.class_name).localeCompare(safeText(b.class_name)));
}

export function optionMatchesQuery(option = {}, query = "") {
  const q = safeText(query).toLowerCase();
  if (!q) return true;
  return [option.name, option.class_name, option.source, option.description, option.summary, ...(option.features || []).map((entry) => `${entry.name} ${entry.description}`)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}
