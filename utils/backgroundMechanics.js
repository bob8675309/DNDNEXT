import { backgroundFeatureDetails as refinedBackgroundFeatureDetails } from "./backgroundMechanicsRefined.js";
import {
  neutralizeBackgroundFeature,
  playerFacingBackgroundFeatureName,
} from "./backgroundNeutralization.js";
import { formatPlayerFacingInline, formatPlayerFacingText } from "./playerFacingText.js";

export * from "./backgroundMechanicsRefined.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizedName(value = "") {
  return formatPlayerFacingInline(value)
    .replace(/^Feature\s*:?\s*/i, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function backgroundPayload(background = {}) {
  return background.rawPayload
    || background.raw_payload
    || background.metadata?.rawPayload
    || background.metadata?.raw_payload
    || {};
}

function containsStructuredTable(node) {
  if (!node) return false;
  if (Array.isArray(node)) return node.some(containsStructuredTable);
  if (typeof node !== "object") return false;
  if (node.type === "table" || Array.isArray(node.rows)) return true;
  return [node.entry, node.entries, node.items].some(containsStructuredTable);
}

function flattenSupplementalText(node, output = []) {
  if (node == null) return output;
  if (typeof node === "string") {
    const text = formatPlayerFacingText(node, "");
    if (text) output.push(text);
    return output;
  }
  if (Array.isArray(node)) {
    node.forEach((entry) => flattenSupplementalText(entry, output));
    return output;
  }
  if (typeof node !== "object") return output;
  if (node.type === "table" || node.rows || /^\s*\{@note\b/i.test(safeText(node.entry))) return output;
  if (node.entry) flattenSupplementalText(node.entry, output);
  if (node.entries) flattenSupplementalText(node.entries, output);
  if (node.items && node.type !== "list") flattenSupplementalText(node.items, output);
  return output;
}

function tableLooksOptional(siblings = [], tableIndex = -1) {
  const nearby = siblings.slice(Math.max(0, tableIndex - 2), tableIndex).map((entry) => typeof entry === "string" ? formatPlayerFacingText(entry) : "").join(" ");
  return /(?:roll on|roll or choose|choose or roll|randomly determine|determine .* on)\b[^.]{0,100}\btable/i.test(nearby);
}

function structuredRuleText(node, output = []) {
  if (node == null) return output;
  if (typeof node === "string") {
    if (/^\s*\{@note\b/i.test(node)) return output;
    const value = formatPlayerFacingText(node, "");
    if (value) output.push(value);
    return output;
  }
  if (Array.isArray(node)) {
    node.forEach((entry, index) => {
      if (entry && typeof entry === "object" && (entry.type === "table" || entry.rows) && tableLooksOptional(node, index)) return;
      structuredRuleText(entry, output);
    });
    return output;
  }
  if (typeof node !== "object") return output;
  if (node.type === "table" || node.rows) {
    const headers = Array.isArray(node.colLabels) ? node.colLabels.map((value) => formatPlayerFacingInline(value)) : [];
    if (node.caption) output.push(formatPlayerFacingInline(node.caption));
    (Array.isArray(node.rows) ? node.rows : []).forEach((row) => {
      const values = (Array.isArray(row) ? row : [row]).map((value) => formatPlayerFacingInline(value)).filter(Boolean);
      if (!values.length) return;
      const cells = values.map((value, index) => headers[index] ? `${headers[index]}: ${value}` : value);
      output.push(cells.join(" • "));
    });
    return output;
  }
  if (node.type === "list" && Array.isArray(node.items)) {
    node.items.forEach((item) => {
      if (typeof item === "string") return structuredRuleText(item, output);
      if (!item || typeof item !== "object") return;
      const label = formatPlayerFacingInline(item.name || "");
      const body = [];
      structuredRuleText(item.entries || item.entry || [], body);
      if (label && body.length) output.push(`${label} — ${body.join(" ")}`);
      else if (label) output.push(label);
      else output.push(...body);
    });
    return output;
  }
  if (node.name && !/^Feature\s*:/i.test(safeText(node.name))) {
    const label = formatPlayerFacingInline(node.name);
    if (label) output.push(label);
  }
  if (node.entry) structuredRuleText(node.entry, output);
  if (node.entries) structuredRuleText(node.entries, output);
  if (node.items) structuredRuleText(node.items, output);
  return output;
}

function sourceFeatureNodes(background = {}) {
  const payload = backgroundPayload(background);
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  const nodes = [];
  function inspect(node) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const name = safeText(node.name);
    if (/^Suggested Characteristics$/i.test(name)) return;
    if (node.data?.isFeature || /(?:^|\s)Feature\s*:/i.test(name)) {
      nodes.push(node);
      return;
    }
    if (node.entries) (Array.isArray(node.entries) ? node.entries : [node.entries]).forEach(inspect);
    if (node.items) (Array.isArray(node.items) ? node.items : [node.items]).forEach(inspect);
  }
  entries.forEach(inspect);
  return nodes;
}

function structuredFeatureDescription(background, feature) {
  const wanted = normalizedName(feature?.name);
  if (!wanted) return "";
  const node = sourceFeatureNodes(background).find((candidate) => normalizedName(candidate.name) === wanted);
  if (!node) return "";
  return structuredRuleText(node.entries || node.entry || node.items || []).join("\n\n").trim();
}

function supplementalBackgroundDetails(background = {}) {
  const payload = backgroundPayload(background);
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  const sourceName = background.sourceName || background.source_name || background.name || background.key || "";
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const rawName = safeText(entry.name);
    if (!rawName || /^Suggested Characteristics$/i.test(rawName)) return [];
    // Source books often repeat character-building advice after the actual rules.
    // That prose is useful in the book, but it becomes a redundant wall of text in the Forge.
    if (/^Building a .+ Character$/i.test(rawName)) return [];
    // Rune Styles is promoted to a real persisted Background choice by the source-choice layer.
    if (/^Rune Styles$/i.test(rawName) && normalizedName(sourceName) === "rune carver") return [];
    if (entry.data?.isFeature || /(?:^|\s)Feature\s*:/i.test(rawName)) return [];
    if (entry.type === "table" || entry.rows || entry.type === "list") return [];
    if (entry.type && entry.type !== "entries") return [];
    // Optional flavor sections such as Specialty, Favored Event, Fishing Tale, Origin Stories,
    // trinkets, and similar random tables are not creator requirements. Showing their lead-in
    // prose after dropping the table leaves orphaned instructions and creates the loose text
    // seen in browser review, so omit the whole supplemental section unless it is promoted to
    // a real persisted choice (Rune Styles above).
    if (containsStructuredTable(entry)) return [];
    const description = flattenSupplementalText(entry.entries || entry.entry || []).join("\n\n").trim();
    if (!description) return [];
    const name = formatPlayerFacingInline(rawName);
    return [{
      name,
      description: neutralizeBackgroundFeature(sourceName, name, description),
      supplemental: true,
    }];
  });
}

export function backgroundFeatureDetails(background = {}) {
  const sourceName = background.sourceName || background.source_name || background.name || background.key || "";
  const rawFeatures = refinedBackgroundFeatureDetails({
    ...background,
    name: `${sourceName || "background"}__feature`,
  });
  const normalized = rawFeatures.map((feature) => {
    const structured = structuredFeatureDescription(background, feature);
    const description = structured || feature.description;
    return {
      ...feature,
      name: playerFacingBackgroundFeatureName(sourceName, feature.name),
      description: neutralizeBackgroundFeature(sourceName, feature.name, description),
      structuredSource: Boolean(structured),
    };
  });
  const seen = new Set(normalized.map((feature) => `${safeText(feature.name).toLowerCase()}|${safeText(feature.description).toLowerCase()}`));
  for (const detail of supplementalBackgroundDetails(background)) {
    const key = `${safeText(detail.name).toLowerCase()}|${safeText(detail.description).toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(detail);
    }
  }
  return normalized;
}
