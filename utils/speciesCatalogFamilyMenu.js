import { speciesVariantChoice } from "./speciesVariantFamilies";

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const array = (value) => Array.isArray(value) ? value : [];

const CATALOG_SPECIES_VARIANT_FAMILIES = new Set([
  "genasi-elemental-lineage",
  "dragonborn-ancestry",
]);

export function speciesVariantUsesCatalogSubmenu(species = null) {
  const choice = speciesVariantChoice(species);
  return Boolean(choice?.id && CATALOG_SPECIES_VARIANT_FAMILIES.has(text(choice.id)));
}

export function sourceChoiceGroupUsesCatalogSpeciesFamily(group = null) {
  if (!group || text(group.ownerType) !== "species") return false;
  if (CATALOG_SPECIES_VARIANT_FAMILIES.has(text(group.metadata?.family))) return true;
  return array(group.fields).some((field) => array(field?.options).some((option) => CATALOG_SPECIES_VARIANT_FAMILIES.has(text(option?.metadata?.family))));
}

export function speciesVariantChoiceBinding(species = null, groups = [], selections = {}) {
  const choice = speciesVariantChoice(species);
  if (!species || !choice?.options?.length || !speciesVariantUsesCatalogSubmenu(species)) return null;
  const ownerKey = text(species.id || species.name);
  const familyId = text(choice.id);
  const optionKeys = new Set(array(choice.options).map((option) => text(option?.key)).filter(Boolean));

  for (const group of array(groups)) {
    if (text(group?.ownerType) !== "species" || text(group?.ownerKey) !== ownerKey) continue;
    for (const field of array(group?.fields)) {
      const options = array(field?.options);
      const belongsToFamily = options.some((option) => optionKeys.has(text(option?.key)) || text(option?.metadata?.family) === familyId);
      if (!belongsToFamily) continue;
      const selectedKeys = array(selections?.[group.id]?.[field.id]).map(text);
      const selected = options.find((option) => selectedKeys.includes(text(option?.key))) || null;
      return {
        choice,
        group,
        field,
        selected,
        selectedKey: text(selected?.key),
      };
    }
  }
  return null;
}

function selectedFamilySummary(choice, selected) {
  const familyId = text(choice?.id);
  const isGenasi = familyId === "genasi-elemental-lineage";
  const parts = [`Selected ${isGenasi ? "lineage" : "ancestry"}: ${text(selected?.label || selected?.value || "Selected option")}.`];
  const damageType = text(selected?.metadata?.damageType);
  const ruleFamily = text(selected?.metadata?.ruleFamily);
  if (damageType) parts.push(`Damage affinity: ${damageType}.`);
  if (ruleFamily) parts.push(`Rule family: ${ruleFamily}.`);
  if (isGenasi) parts.push("The Species information shown here reflects this elemental lineage.");
  return {
    name: text(choice?.label || (isGenasi ? "Elemental Lineage" : "Draconic Ancestry")),
    description: parts.join(" "),
    selectedFamily: true,
  };
}

function mergeTraitNames(details = [], existing = []) {
  const output = [];
  const seen = new Set();
  for (const value of [...array(details).map((entry) => entry?.name), ...array(existing)]) {
    const label = text(value);
    const key = norm(label);
    if (!label || seen.has(key)) continue;
    seen.add(key);
    output.push(label);
  }
  return output;
}

export function projectCatalogSpeciesFamilySelection(projectedSpecies = null, sourceSpecies = null, groups = [], selections = {}) {
  const binding = speciesVariantChoiceBinding(sourceSpecies, groups, selections);
  if (!projectedSpecies || !binding?.selected) return projectedSpecies;

  const summary = selectedFamilySummary(binding.choice, binding.selected);
  const details = array(projectedSpecies.traitDetails);
  const selectorIndex = details.findIndex((detail) => norm(detail?.name) === norm(summary.name));
  const nextDetails = selectorIndex >= 0
    ? details.map((detail, index) => index === selectorIndex ? summary : detail)
    : [summary, ...details];

  return {
    ...projectedSpecies,
    traits: mergeTraitNames(nextDetails, projectedSpecies.traits),
    traitDetails: nextDetails,
    metadata: {
      ...(projectedSpecies.metadata || {}),
      selectedCatalogSpeciesFamily: {
        family: text(binding.choice.id),
        label: text(binding.selected.label),
        source: text(binding.selected.source),
        ruleFamily: text(binding.selected.metadata?.ruleFamily) || null,
      },
    },
  };
}
