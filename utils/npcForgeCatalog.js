import {
  mergePreferredBackgrounds as refinedMergePreferredBackgrounds,
  mergePreferredSpecies as refinedMergePreferredSpecies,
  normalizeBackgroundOption as refinedNormalizeBackgroundOption,
  optionMatchesQuery as refinedOptionMatchesQuery,
  slug,
} from "./npcForgeCatalogRefined.js";
import { playerFacingBackgroundName } from "./backgroundNeutralization.js";
import { mergeSpeciesVariantFamilies } from "./speciesVariantFamilies.js";

export * from "./npcForgeCatalogRefined.js";

function presentBackground(option = {}) {
  const sourceName = option.sourceName || option.source_name || option.name || "";
  const name = playerFacingBackgroundName(sourceName);
  return {
    ...option,
    sourceName,
    name,
    key: slug(name || option.key),
  };
}

export function normalizeBackgroundOption(row = {}) {
  return presentBackground(refinedNormalizeBackgroundOption(row));
}

export function mergePreferredBackgrounds(rows = []) {
  return refinedMergePreferredBackgrounds(rows).map(presentBackground);
}

export function mergePreferredSpecies(rows = []) {
  return mergeSpeciesVariantFamilies(refinedMergePreferredSpecies(rows));
}

export function optionMatchesQuery(option = {}, query = "") {
  if (refinedOptionMatchesQuery(option, query)) return true;
  const q = String(query ?? "").trim().toLowerCase();
  return Boolean(q && String(option.sourceName || option.source_name || "").toLowerCase().includes(q));
}
