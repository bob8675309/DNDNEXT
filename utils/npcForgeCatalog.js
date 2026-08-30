import {
  mergePreferredBackgrounds as refinedMergePreferredBackgrounds,
  mergePreferredClasses as refinedMergePreferredClasses,
  mergePreferredSpecies as refinedMergePreferredSpecies,
  normalizeBackgroundOption as refinedNormalizeBackgroundOption,
  optionMatchesQuery as refinedOptionMatchesQuery,
  slug,
} from "./npcForgeCatalogRefined.js";
import { playerFacingBackgroundName } from "./backgroundNeutralization.js";
import { mergeSpeciesVariantFamilies } from "./speciesVariantFamilies.js";
import { expandSpeciesCatalogFamilies } from "./speciesCatalogExpansion.js";
import { classPresentationSummary, classPrimaryAbilities } from "./classes/classPresentation.js";

export * from "./npcForgeCatalogRefined.js";

const STANDALONE_CATALOG_SOURCE_CHOICES = new Set(["faerie-lineage", "kithkin-lineage"]);

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

function activateStandaloneCatalogSourceChoice(species = {}) {
  const choice = species.catalogSpeciesVariantChoice;
  if (!choice?.id || !STANDALONE_CATALOG_SOURCE_CHOICES.has(choice.id)) return species;
  return { ...species, speciesVariantChoice: choice };
}

function presentClass(option = {}) {
  const primaryAbilities = classPrimaryAbilities(option);
  return {
    ...option,
    summary: classPresentationSummary(option, option.summary || ""),
    primary_abilities: primaryAbilities.length ? primaryAbilities : (option.primary_abilities || []),
  };
}

export function normalizeBackgroundOption(row = {}) {
  return presentBackground(refinedNormalizeBackgroundOption(row));
}

export function mergePreferredBackgrounds(rows = []) {
  return refinedMergePreferredBackgrounds(rows).map(presentBackground);
}

export function mergePreferredSpecies(rows = []) {
  return expandSpeciesCatalogFamilies(mergeSpeciesVariantFamilies(refinedMergePreferredSpecies(rows))).map(activateStandaloneCatalogSourceChoice);
}

export function mergePreferredClasses(rows = []) {
  return refinedMergePreferredClasses(rows).map(presentClass);
}

export function optionMatchesQuery(option = {}, query = "") {
  if (refinedOptionMatchesQuery(option, query)) return true;
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return false;
  const aliases = [
    option.sourceName,
    option.source_name,
    ...(Array.isArray(option.catalogSearchAliases) ? option.catalogSearchAliases : []),
    ...(Array.isArray(option.catalogSourceVariants) ? option.catalogSourceVariants.flatMap((variant) => [variant?.name, variant?.source]) : []),
  ].filter(Boolean).join(" ").toLowerCase();
  return aliases.includes(q);
}
