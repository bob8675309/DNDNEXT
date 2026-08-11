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

function backgroundPayload(background = {}) {
  return background.rawPayload
    || background.raw_payload
    || background.metadata?.rawPayload
    || background.metadata?.raw_payload
    || {};
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

function supplementalBackgroundDetails(background = {}) {
  const payload = backgroundPayload(background);
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  const sourceName = background.sourceName || background.source_name || background.name || background.key || "";
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const rawName = safeText(entry.name);
    if (!rawName || /^Suggested Characteristics$/i.test(rawName)) return [];
    if (entry.data?.isFeature || /(?:^|\s)Feature\s*:/i.test(rawName)) return [];
    if (entry.type === "table" || entry.rows || entry.type === "list") return [];
    if (entry.type && entry.type !== "entries") return [];
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
  const normalized = rawFeatures.map((feature) => ({
    ...feature,
    name: playerFacingBackgroundFeatureName(sourceName, feature.name),
    description: neutralizeBackgroundFeature(sourceName, feature.name, feature.description),
  }));
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
