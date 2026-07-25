import { formatPlayerFacingInline, formatPlayerFacingText } from "./playerFacingText.js";
import { neutralizeBackgroundLore } from "./backgroundNeutralization.js";

const FEAT_CATEGORY_LABELS = Object.freeze({
  DG: "Dark Gift",
  O: "Origin",
});

const SKILL_KEYS = Object.freeze([
  "acrobatics", "animal-handling", "arcana", "athletics", "deception", "history",
  "insight", "intimidation", "investigation", "medicine", "nature", "perception",
  "performance", "persuasion", "religion", "sleight-of-hand", "stealth", "survival",
]);
const SKILL_SET = new Set(SKILL_KEYS);

function safeText(value) {
  return String(value ?? "").trim();
}

function slug(value = "") {
  return safeText(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSkillReference(value = "") {
  const key = slug(value);
  const aliases = {
    animalhandling: "animal-handling",
    "animal-handling": "animal-handling",
    sleightofhand: "sleight-of-hand",
    "sleight-of-hand": "sleight-of-hand",
  };
  const normalized = aliases[key] || key;
  return SKILL_SET.has(normalized) ? normalized : "";
}

function titleCaseReference(value = "") {
  const cleaned = formatPlayerFacingInline(value);
  if (!cleaned || /[A-Z]/.test(cleaned)) return cleaned;
  const minorWords = new Set(["a", "an", "and", "as", "at", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);
  return cleaned.split(/\s+/).map((word, index) => {
    const lower = word.toLowerCase();
    if (index > 0 && minorWords.has(lower)) return lower;
    return lower.replace(/(^|[/(-])([a-z])/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
  }).join(" ");
}

export function cleanRuleReference(value = "") {
  return safeText(value)
    .replace(/#c$/i, "")
    .split("|")[0]
    .trim();
}

export function normalizedRuleName(value = "") {
  return cleanRuleReference(value)
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function backgroundPayload(background = {}) {
  return background.rawPayload
    || background.raw_payload
    || background.metadata?.rawPayload
    || background.metadata?.raw_payload
    || {};
}

function backgroundFeatEntries(background = {}) {
  const payload = backgroundPayload(background);
  if (Array.isArray(payload.feats)) return payload.feats;
  return Array.isArray(background.metadata?.feats) ? background.metadata.feats : [];
}

export function backgroundFeatRule(background = {}) {
  const directNames = [];
  const categoryCodes = [];

  for (const entry of backgroundFeatEntries(background)) {
    if (typeof entry === "string") {
      const name = cleanRuleReference(entry);
      if (name) directNames.push(name);
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    for (const [key, value] of Object.entries(entry)) {
      if (key === "anyFromCategory") {
        const categories = value?.category;
        (Array.isArray(categories) ? categories : [categories])
          .map(safeText)
          .filter(Boolean)
          .forEach((category) => categoryCodes.push(category.toUpperCase()));
        continue;
      }
      if (value === true || Number(value) > 0) {
        const name = cleanRuleReference(key);
        if (name) directNames.push(name);
      }
    }
  }

  const uniqueDirect = [...new Map(directNames.map((name) => [normalizedRuleName(name), name])).values()];
  const uniqueCategories = [...new Set(categoryCodes)];
  return {
    directNames: uniqueDirect,
    categoryCodes: uniqueCategories,
    requiresChoice: uniqueCategories.length > 0 || uniqueDirect.length > 1,
    fixedName: uniqueCategories.length === 0 && uniqueDirect.length === 1 ? uniqueDirect[0] : "",
  };
}

function fallbackFeat(name, source = "Source") {
  return {
    id: `background-feat-${normalizedRuleName(name).replace(/[^a-z0-9]+/g, "-")}`,
    name: titleCaseReference(name),
    source,
    category: null,
    description: "This feat is granted by the selected background.",
    prerequisite_text: "",
    isBackgroundFallback: true,
  };
}

export function resolveBackgroundFeatOptions(background = {}, featCatalog = []) {
  const rule = backgroundFeatRule(background);
  const catalog = Array.isArray(featCatalog) ? featCatalog : [];
  const output = [];
  const seen = new Set();

  function add(feat) {
    if (!feat?.name) return;
    const key = normalizedRuleName(feat.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push(feat);
  }

  for (const name of rule.directNames) {
    add(catalog.find((feat) => normalizedRuleName(feat?.name) === normalizedRuleName(name))
      || fallbackFeat(name, background.source));
  }

  for (const categoryCode of rule.categoryCodes) {
    catalog
      .filter((feat) => safeText(feat?.category).toUpperCase() === categoryCode)
      .sort((a, b) => safeText(a.name).localeCompare(safeText(b.name)))
      .forEach(add);
  }

  return output;
}

export function backgroundFeatSummary(background = {}, featCatalog = [], selectedFeat = null) {
  const rule = backgroundFeatRule(background);
  if (selectedFeat?.name) return selectedFeat.name;
  if (rule.fixedName) return titleCaseReference(rule.fixedName);
  const options = resolveBackgroundFeatOptions(background, featCatalog);
  if (options.length) return `Choose one: ${options.map((feat) => feat.name).join(", ")}`;
  if (rule.categoryCodes.length) {
    return `Choose a ${rule.categoryCodes.map((code) => FEAT_CATEGORY_LABELS[code] || code).join(" or ")} feat`;
  }
  return "None listed";
}

function skillEntries(background = {}) {
  const payload = backgroundPayload(background);
  if (Array.isArray(payload.skillProficiencies)) return payload.skillProficiencies;
  return Array.isArray(background.metadata?.skills) ? background.metadata.skills : [];
}

export function backgroundSkillRule(background = {}) {
  const fixedKeys = [];
  const choiceGroups = [];
  const fixedSeen = new Set();

  function addFixed(value) {
    const key = normalizeSkillReference(value);
    if (!key || fixedSeen.has(key)) return;
    fixedSeen.add(key);
    fixedKeys.push(key);
  }

  skillEntries(background).forEach((entry, entryIndex) => {
    if (typeof entry === "string") {
      addFixed(entry);
      return;
    }
    if (!entry || typeof entry !== "object") return;
    Object.entries(entry).forEach(([key, value]) => {
      if (key === "choose") return;
      if (value === true || Number(value) > 0) addFixed(key);
    });
    const choose = entry.choose || (Array.isArray(entry.from) ? entry : null);
    if (!choose) return;
    const from = [...new Set((Array.isArray(choose.from) ? choose.from : [])
      .map(normalizeSkillReference)
      .filter(Boolean))];
    const count = Math.max(1, Math.min(from.length || 1, Number(choose.count || 1)));
    if (from.length) choiceGroups.push({ id: `background-skill-choice-${entryIndex}`, count, from });
  });

  return { fixedKeys, choiceGroups };
}

function flattenFeatureText(node, output = []) {
  if (node == null) return output;
  if (typeof node === "string") {
    if (/^\s*\{@note\b/i.test(node)) return output;
    const text = formatPlayerFacingText(node, "");
    if (text) output.push(text);
    return output;
  }
  if (Array.isArray(node)) {
    node.forEach((entry) => flattenFeatureText(entry, output));
    return output;
  }
  if (typeof node !== "object") return output;
  if (node.type === "table" || node.rows) return output;
  if (node.entry) flattenFeatureText(node.entry, output);
  if (node.entries) flattenFeatureText(node.entries, output);
  if (node.items) flattenFeatureText(node.items, output);
  return output;
}

function featureTitle(value = "") {
  const text = formatPlayerFacingInline(value);
  const match = text.match(/Feature\s*:\s*(.+)$/i);
  return neutralizeBackgroundLore("", match ? match[1] : text.replace(/^Feature\s*:?\s*/i, ""));
}

export function backgroundFeatureDetails(background = {}) {
  const payload = backgroundPayload(background);
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  const features = [];
  const seen = new Set();

  function inspect(node) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const name = safeText(node.name);
    if (/^Suggested Characteristics$/i.test(name)) return;
    const isFeature = Boolean(node.data?.isFeature) || /(?:^|\s)Feature\s*:/i.test(name);
    if (isFeature) {
      const title = featureTitle(name) || "Background Feature";
      const paragraphs = flattenFeatureText(node.entries || node.entry || node.items || []);
      const description = neutralizeBackgroundLore(background.name || background.key, paragraphs.join("\n\n"));
      const key = `${title.toLowerCase()}|${description.toLowerCase()}`;
      if (description && !seen.has(key)) {
        seen.add(key);
        features.push({ name: title, description });
      }
      return;
    }
    if (node.entries) (Array.isArray(node.entries) ? node.entries : [node.entries]).forEach(inspect);
    if (node.items) (Array.isArray(node.items) ? node.items : [node.items]).forEach(inspect);
  }

  entries.forEach(inspect);
  return features;
}

function collectSpellReferences(node, output) {
  if (!node) return;
  if (typeof node === "string") {
    const name = cleanRuleReference(node);
    if (name) output.push(name);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((entry) => collectSpellReferences(entry, output));
    return;
  }
  if (typeof node !== "object") return;
  if (Array.isArray(node.from)) collectSpellReferences(node.from, output);
  if (Array.isArray(node.choose)) collectSpellReferences(node.choose, output);
}

function spellLevelFromKey(key = "") {
  const match = safeText(key).match(/^s(\d+)$/i);
  return match ? Number(match[1]) : null;
}

export function extractBackgroundSpellList(background = {}) {
  const payload = backgroundPayload(background);
  const additions = Array.isArray(payload.additionalSpells)
    ? payload.additionalSpells
    : Array.isArray(background.metadata?.additionalSpells)
      ? background.metadata.additionalSpells
      : [];
  const byLevel = new Map();

  for (const addition of additions) {
    const expanded = addition?.expanded;
    if (!expanded || typeof expanded !== "object") continue;
    for (const [levelKey, spellEntries] of Object.entries(expanded)) {
      const level = spellLevelFromKey(levelKey);
      if (level == null) continue;
      const names = [];
      collectSpellReferences(spellEntries, names);
      if (!byLevel.has(level)) byLevel.set(level, new Map());
      const bucket = byLevel.get(level);
      names.forEach((name) => bucket.set(normalizedRuleName(name), titleCaseReference(name)));
    }
  }

  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, spells]) => ({
      level,
      label: level === 0 ? "Cantrips" : `Level ${level}`,
      spells: [...spells.values()],
    }));
}

export function backgroundExpandedSpellNames(background = {}) {
  return extractBackgroundSpellList(background).flatMap((group) => group.spells);
}

export function spellMatchesExpandedList(spell = {}, names = []) {
  const target = normalizedRuleName(spell?.name);
  return Boolean(target) && (Array.isArray(names) ? names : []).some((name) => normalizedRuleName(name) === target);
}
