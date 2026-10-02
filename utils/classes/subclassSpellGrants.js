function safeText(value) {
  return String(value ?? "").trim();
}

export function normalizeSubclassSpellName(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanInlineMarkup(value) {
  return safeText(value)
    .replace(/\{@(?:damage|dice|hit|chance)\s+([^}|]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@(?:spell|item|creature|condition|skill|action|sense|language|race|class|subclass|feat|filter|book|adventure|variantrule|status)\s+([^}|]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@(?:b|i|u|note|atk|h|dc)\s+([^}]*)}/gi, "$1")
    .replace(/\{@[a-zA-Z0-9]+\s+([^}|]+)(?:\|[^}]*)?}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function spellTokens(value) {
  if (typeof value !== "string") return [];
  const output = [];
  const pattern = /\{@spell\s+([^}|]+)(?:\|([^}|]+))?[^}]*}/gi;
  let match = pattern.exec(value);
  while (match) {
    output.push({
      name: safeText(match[1]),
      source: safeText(match[2]),
      index: match.index,
      length: match[0].length,
    });
    match = pattern.exec(value);
  }
  return output;
}

function spellTable(node, featureName = "") {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  if (!(node.type === "table" || Array.isArray(node.rows))) return false;
  const labels = Array.isArray(node.colLabels) ? node.colLabels.map(cleanInlineMarkup) : [];
  return /\b(?:spells?|cantrips?)\b/i.test(cleanInlineMarkup(node.caption))
    || labels.some((label) => /\b(?:spells?|cantrips?)\b/i.test(label))
    || (/\b(?:spells?|cantrips?)\b/i.test(safeText(featureName)) && Array.isArray(node.rows));
}

function collectSpellTokens(value, output = []) {
  if (typeof value === "string") {
    output.push(...spellTokens(value));
    return output;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectSpellTokens(entry, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const entry of Object.values(value)) collectSpellTokens(entry, output);
  return output;
}

function collectSpellTableReferences(node, feature, output) {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const entry of node) collectSpellTableReferences(entry, feature, output);
    return;
  }
  if (typeof node !== "object") return;

  if (spellTable(node, feature?.name)) {
    for (const row of Array.isArray(node.rows) ? node.rows : []) {
      const cells = Array.isArray(row) ? row : Array.isArray(row?.row) ? row.row : [];
      const unlockLabel = cleanInlineMarkup(cells[0]) || safeText(feature?.level);
      for (const cell of cells.slice(1)) {
        for (const token of collectSpellTokens(cell, [])) {
          output.push({
            name: token.name,
            source: token.source,
            unlockLabel,
            grantKind: "table",
            featureName: safeText(feature?.name),
          });
        }
      }
    }
  }

  for (const [key, entry] of Object.entries(node)) {
    if (key === "rows") continue;
    collectSpellTableReferences(entry, feature, output);
  }
}

function sentenceForToken(value, token) {
  const startBoundary = Math.max(
    value.lastIndexOf(".", token.index - 1),
    value.lastIndexOf("!", token.index - 1),
    value.lastIndexOf("?", token.index - 1),
    value.lastIndexOf("\n", token.index - 1),
  );
  const from = Math.max(0, startBoundary + 1);
  const afterToken = token.index + token.length;
  const endings = [
    value.indexOf(".", afterToken),
    value.indexOf("!", afterToken),
    value.indexOf("?", afterToken),
    value.indexOf("\n", afterToken),
  ].filter((index) => index >= 0);
  const to = endings.length ? Math.min(...endings) + 1 : value.length;
  return {
    sentence: cleanInlineMarkup(value.slice(from, to)),
    before: cleanInlineMarkup(value.slice(from, token.index)),
  };
}

function sentenceGrantsSpells(sentence) {
  const text = safeText(sentence);
  return /\byou\s+(?:also\s+)?(?:can|may)\s+cast\b/i.test(text)
    || /\bwhen\s+you\s+do\s+so,?\s+you\s+cast\b/i.test(text)
    || /\byou\s+(?:can|may)\b[^.!?]{0,160}\bto\s+cast\b/i.test(text)
    || /\byou\s+(?:can|may)\b[^.!?]{0,180}\band\b[^.!?]{0,40}\bcast\b/i.test(text)
    || /\byou\s+gain\b[^.!?]{0,140}\b(?:ability|option)\s+to\s+cast\b/i.test(text)
    || /\byou\s+gain\b[^.!?]{0,140}\b(?:spell|spells|cantrip|cantrips)\b/i.test(text)
    || /\byou\s+(?:choose\s+to\s+)?(?:learn|know)\b/i.test(text)
    || /\byou\s+(?:always\s+)?have\b[^.!?]{0,180}\bprepared\b/i.test(text)
    || /\byou\s+add\b[^.!?]{0,180}\b(?:spell|spells)\b/i.test(text);
}

function prefixGrantsSpell(before) {
  const text = safeText(before);
  return /\byou\s+(?:also\s+)?cast(?:\s+the)?\s*$/i.test(text)
    || /\b(?:to|and)(?:\s+immediately)?\s+cast(?:\s+the)?\s*$/i.test(text)
    || /\byou\s+cast\b[^.!?]{0,120}\b(?:or|and)\s*$/i.test(text);
}

function collectDirectSpellReferences(node, feature, output, insideGrantTable = false) {
  if (node == null) return;
  if (typeof node === "string") {
    if (insideGrantTable) return;
    for (const token of spellTokens(node)) {
      const context = sentenceForToken(node, token);
      if (!sentenceGrantsSpells(context.sentence) && !prefixGrantsSpell(context.before)) continue;
      output.push({
        name: token.name,
        source: token.source,
        unlockLabel: safeText(feature?.level),
        grantKind: "feature",
        featureName: safeText(feature?.name),
      });
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const entry of node) collectDirectSpellReferences(entry, feature, output, insideGrantTable);
    return;
  }
  if (typeof node !== "object") return;

  const nextInsideGrantTable = insideGrantTable || spellTable(node, feature?.name);
  for (const [key, entry] of Object.entries(node)) {
    if (nextInsideGrantTable && key === "rows") continue;
    collectDirectSpellReferences(entry, feature, output, nextInsideGrantTable);
  }
}

function unlockNumber(value) {
  const match = safeText(value).match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

export function subclassSpellGrantReferences(features = []) {
  const references = [];
  for (const feature of Array.isArray(features) ? features : []) {
    collectSpellTableReferences(feature?.entries, feature, references);
    collectDirectSpellReferences(feature?.entries, feature, references);
  }

  const preferred = new Map();
  for (const reference of references) {
    const identity = normalizeSubclassSpellName(reference?.name);
    if (!identity) continue;
    const current = preferred.get(identity);
    if (!current || unlockNumber(reference.unlockLabel) < unlockNumber(current.unlockLabel)) {
      preferred.set(identity, reference);
    }
  }

  return [...preferred.values()];
}

const SPELL_SOURCE_RANK = Object.freeze({ XPHB: 0, EFA: 1, TCE: 2, PHB: 3 });

function sourceRank(value) {
  return Number(SPELL_SOURCE_RANK[safeText(value).toUpperCase()] ?? 9);
}

export function resolveSubclassSpellGrants(references = [], catalog = []) {
  const byName = new Map();
  for (const spell of Array.isArray(catalog) ? catalog : []) {
    const identity = normalizeSubclassSpellName(spell?.name);
    if (!identity) continue;
    if (!byName.has(identity)) byName.set(identity, []);
    byName.get(identity).push(spell);
  }

  return (Array.isArray(references) ? references : []).map((reference) => {
    const candidates = byName.get(normalizeSubclassSpellName(reference?.name)) || [];
    const wantedSource = safeText(reference?.source).toUpperCase();
    const exact = wantedSource ? candidates.find((spell) => safeText(spell?.source).toUpperCase() === wantedSource) : null;
    const resolved = exact || [...candidates].sort((left, right) =>
      sourceRank(left?.source) - sourceRank(right?.source)
      || Number(left?.level || 0) - Number(right?.level || 0)
      || safeText(left?.source).localeCompare(safeText(right?.source))
    )[0] || null;

    return {
      ...(resolved || {}),
      name: safeText(resolved?.name || reference?.name),
      source: safeText(resolved?.source || reference?.source),
      unlockLabel: safeText(reference?.unlockLabel),
      grantKind: safeText(reference?.grantKind || "feature"),
      grantFeatureName: safeText(reference?.featureName),
      grantSource: safeText(reference?.source),
    };
  });
}
