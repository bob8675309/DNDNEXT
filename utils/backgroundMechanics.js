import { formatPlayerFacingInline } from "./playerFacingText.js";

const FEAT_CATEGORY_LABELS = Object.freeze({
  DG: "Dark Gift",
  O: "Origin",
});

function safeText(value) {
  return String(value ?? "").trim();
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
