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
