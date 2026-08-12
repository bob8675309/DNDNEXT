import { speciesVariantChoice } from "./speciesVariantFamilies";

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const array = (value) => Array.isArray(value) ? value : [];

const CATALOG_SPECIES_VARIANT_FAMILIES = new Set([
  "genasi-elemental-lineage",
  "dragonborn-ancestry",
  "aven-subrace",
  "elf-lineage",
  "gnome-lineage",
  "shifter-subtype",
  "faerie-lineage",
  "kithkin-lineage",
]);

export function catalogSpeciesFamilyChoice(species = null) {
  return species?.catalogSpeciesVariantChoice || speciesVariantChoice(species);
}

export function speciesVariantUsesCatalogSubmenu(species = null) {
  const choice = catalogSpeciesFamilyChoice(species);
  return Boolean(choice?.id && CATALOG_SPECIES_VARIANT_FAMILIES.has(text(choice.id)));
}

export function sourceChoiceGroupUsesCatalogSpeciesFamily(group = null) {
  if (!group || text(group.ownerType) !== "species") return false;
  if (CATALOG_SPECIES_VARIANT_FAMILIES.has(text(group.metadata?.family))) return true;
  return array(group.fields).some((field) => array(field?.options).some((option) => CATALOG_SPECIES_VARIANT_FAMILIES.has(text(option?.metadata?.family))));
}

function mergedSelectedOption(choice, selected) {
  if (!selected) return null;
  const canonical = array(choice?.options).find((option) => text(option?.key) === text(selected?.key)) || null;
  if (!canonical) return selected;
  return {
    ...selected,
    ...canonical,
    metadata: { ...(selected.metadata || {}), ...(canonical.metadata || {}) },
  };
}

export function speciesVariantChoiceBinding(species = null, groups = [], selections = {}) {
  const choice = catalogSpeciesFamilyChoice(species);
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
        selected: mergedSelectedOption(choice, selected),
        selectedKey: text(selected?.key),
      };
    }
  }
  return null;
}

export function filterCatalogSpeciesFamilyFields(groups = [], species = null) {
  const choice = catalogSpeciesFamilyChoice(species);
  if (!choice?.options?.length || !species) return array(groups);
  const ownerKey = text(species.id || species.name);
  const optionKeys = new Set(array(choice.options).map((option) => text(option?.key)).filter(Boolean));
  return array(groups).flatMap((group) => {
    if (text(group?.ownerType) !== "species" || text(group?.ownerKey) !== ownerKey) return [group];
    const fields = array(group.fields).filter((field) => !array(field?.options).some((option) => optionKeys.has(text(option?.key))));
    return fields.length ? [{ ...group, fields }] : [];
  });
}

function selectedFamilySummary(choice, selected) {
  const kind = text(choice?.kind || "variant").replace(/-/g, " ");
  const parts = [`Selected ${kind}: ${text(selected?.metadata?.catalogLabel || selected?.label || selected?.value || "Selected option")}.`];
  const damageType = text(selected?.metadata?.damageType);
  const ruleFamily = text(selected?.metadata?.ruleFamily);
  const selectedDescription = text(selected?.metadata?.selectedDescription || selected?.description);
  if (damageType) parts.push(`Damage affinity: ${damageType}.`);
  if (ruleFamily) parts.push(`Rule family: ${ruleFamily}.`);
  if (selectedDescription) parts.push(selectedDescription);
  if (text(choice?.id) === "genasi-elemental-lineage") parts.push("The Species information shown here reflects this elemental lineage.");
  return {
    name: text(choice?.label || "Species Family"),
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

function applyCatalogPresentation(projectedSpecies, choice, selected) {
  const presentation = selected?.metadata?.presentation;
  const alreadyProjected = norm(projectedSpecies?.metadata?.selectedVariantPresentation?.family) === norm(choice?.id);
  if (!projectedSpecies || !presentation?.replaceParentTraits || alreadyProjected) return projectedSpecies;
  const selectorName = text(presentation.selectorTraitName || choice?.label || "Species Family");
  const existingSelector = array(projectedSpecies.traitDetails).find((detail) => norm(detail?.name) === norm(selectorName));
  const selector = existingSelector || { name: selectorName, description: text(presentation.selectorDescription || choice?.helper || "Choose the source-backed Species variant."), structuredChoice: true };
  const details = [selector, ...array(presentation.traits).filter((detail) => norm(detail?.name) !== norm(selectorName))];
  return {
    ...projectedSpecies,
    name: text(presentation.displayName) || projectedSpecies.name,
    source: selected.source || projectedSpecies.source,
    speed: presentation.speed ?? projectedSpecies.speed,
    size: array(presentation.size).length ? array(presentation.size) : projectedSpecies.size,
    darkvision: presentation.darkvision ?? null,
    creatureTypes: array(presentation.creatureTypes).length ? array(presentation.creatureTypes) : projectedSpecies.creatureTypes,
    traits: details.map((detail) => detail?.name).filter(Boolean),
    traitDetails: details,
    metadata: {
      ...(projectedSpecies.metadata || {}),
      speed: presentation.speed ?? projectedSpecies.metadata?.speed ?? projectedSpecies.speed,
      size: array(presentation.size).length ? array(presentation.size) : projectedSpecies.metadata?.size,
      darkvision: presentation.darkvision ?? null,
      presentationArtworkName: text(presentation.artworkName) || text(presentation.displayName) || projectedSpecies.name,
      selectedVariantPresentation: {
        label: selected.label,
        variantName: selected.metadata?.variantName || selected.value || null,
        source: selected.source,
        family: selected.metadata?.family || choice?.id || null,
        ruleFamily: selected.metadata?.ruleFamily || null,
      },
    },
  };
}

export function projectCatalogSpeciesFamilySelection(projectedSpecies = null, sourceSpecies = null, groups = [], selections = {}) {
  const binding = speciesVariantChoiceBinding(sourceSpecies, groups, selections);
  if (!projectedSpecies || !binding?.selected) return projectedSpecies;

  const presentedSpecies = applyCatalogPresentation(projectedSpecies, binding.choice, binding.selected);
  const summary = selectedFamilySummary(binding.choice, binding.selected);
  const details = array(presentedSpecies.traitDetails);
  const selectorIndex = details.findIndex((detail) => norm(detail?.name) === norm(summary.name));
  const nextDetails = selectorIndex >= 0
    ? details.map((detail, index) => index === selectorIndex ? summary : detail)
    : [summary, ...details];
  const displayName = text(binding.selected.metadata?.catalogDisplayName || binding.selected.metadata?.catalogLabel);
  const artworkName = text(binding.selected.metadata?.catalogArtworkName || presentedSpecies.metadata?.presentationArtworkName);

  return {
    ...presentedSpecies,
    name: displayName || presentedSpecies.name,
    traits: mergeTraitNames(nextDetails, presentedSpecies.traits),
    traitDetails: nextDetails,
    metadata: {
      ...(presentedSpecies.metadata || {}),
      ...(artworkName ? { presentationArtworkName: artworkName } : {}),
      selectedCatalogSpeciesFamily: {
        family: text(binding.choice.id),
        label: text(binding.selected.label),
        displayName: displayName || null,
        source: text(binding.selected.source),
        ruleFamily: text(binding.selected.metadata?.ruleFamily) || null,
      },
    },
  };
}
