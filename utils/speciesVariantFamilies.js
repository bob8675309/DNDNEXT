const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (value) => norm(value).replace(/\s+/g, "-");
const array = (value) => Array.isArray(value) ? value : [];

function findTrait(species, name) {
  const wanted = norm(name);
  return array(species?.metadata?.traits).find((entry) => entry && typeof entry === "object" && norm(entry.name || entry.title) === wanted) || null;
}

function collectTables(node, output = []) {
  if (node == null) return output;
  if (Array.isArray(node)) { node.forEach((entry) => collectTables(entry, output)); return output; }
  if (typeof node !== "object") return output;
  if (node.type === "table" && Array.isArray(node.rows)) output.push(node);
  Object.values(node).forEach((entry) => collectTables(entry, output));
  return output;
}

function cleanInline(value = "") {
  return text(value)
    .replace(/\{@(?:damage|dice|hit|chance)\s+([^}|]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@(?:spell|item|creature|condition|skill|action|sense|language|race|class|subclass|feat|filter|book|adventure|variantrule|quickref)\s+([^}|]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@(?:b|i|u|note|atk|h|dc)\s+([^}]*)}/gi, "$1")
    .replace(/\{@[a-zA-Z]+\s+([^}]*)}/g, "$1")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function traitSummaries(species, excluded = []) {
  const blocked = new Set(excluded.map(norm));
  return array(species?.traitDetails)
    .filter((entry) => entry?.name && !blocked.has(norm(entry.name)))
    .map((entry) => ({ name: entry.name, description: text(entry.description) }));
}

function movementFact(speed) {
  if (speed == null || speed === "") return "";
  if (Number.isFinite(Number(speed))) return `${Number(speed)} ft.`;
  if (typeof speed !== "object") return "";
  const walk = Number(speed.walk || 0);
  const parts = [];
  if (walk) parts.push(`${walk} ft. walking`);
  for (const [key, label] of [["swim", "swimming"], ["fly", "flying"], ["climb", "climbing"], ["burrow", "burrowing"]]) {
    const value = speed[key];
    if (value === true && walk) parts.push(`${label} equal to walking speed`);
    else if (Number.isFinite(Number(value)) && Number(value) > 0) parts.push(`${Number(value)} ft. ${label}`);
  }
  return parts.join(" • ");
}

function variantFacts(species) {
  const output = [];
  const movement = movementFact(species?.metadata?.speed ?? species?.speed);
  if (movement) output.push({ label: "Speed", value: movement });
  if (species?.darkvision) output.push({ label: "Darkvision", value: `${Number(species.darkvision)} ft.` });
  return output;
}

function presentationMetadata(species, { selectorTraitName = "", selectorDescription = "", replaceParentTraits = false, displayName = "", artworkName = "" } = {}) {
  const resolvedDisplayName = text(displayName || species?.name);
  return {
    speed: species?.metadata?.speed ?? species?.speed ?? null,
    size: array(species?.size).length ? array(species.size) : array(species?.metadata?.size),
    darkvision: species?.darkvision ?? species?.metadata?.darkvision ?? null,
    creatureTypes: array(species?.creatureTypes).length ? array(species.creatureTypes) : array(species?.metadata?.creatureTypes),
    traits: traitSummaries(species, selectorTraitName === "Draconic Ancestry" ? ["Gem Ancestry"] : ["Size", "Darkvision"]),
    selectorTraitName,
    selectorDescription,
    replaceParentTraits,
    displayName: resolvedDisplayName,
    artworkName: text(artworkName || resolvedDisplayName),
  };
}

function genasiFamily(rows) {
  const parent = rows.find((row) => norm(row.name) === "genasi" && text(row.source).toUpperCase() === "MPMM");
  if (!parent) return null;
  const names = ["Air", "Earth", "Fire", "Water"];
  const children = names.map((lineage) => rows.find((row) => norm(row.name) === norm(`Genasi (${lineage})`) && text(row.source).toUpperCase() === "MPMM")).filter(Boolean);
  if (children.length !== names.length) return null;
  const helper = "Choose the elemental lineage your Genasi takes after. The selected lineage changes the source traits shown for this character; species magic is resolved in Spells.";
  return {
    parent,
    consumedIds: new Set(children.map((row) => String(row.id))),
    choice: {
      id: "genasi-elemental-lineage",
      label: "Elemental Lineage",
      kind: "lineage",
      helper,
      options: children.map((row) => {
        const lineage = text(row.name).match(/\(([^)]+)\)/)?.[1] || row.name;
        const displayName = `${lineage} Genasi`;
        return {
          key: `genasi-${slug(lineage)}-mpmm`,
          value: lineage,
          label: displayName,
          source: row.source,
          kind: "lineage",
          description: traitSummaries(row, ["Size", "Darkvision"]).map((entry) => `${entry.name}: ${entry.description}`).join(" "),
          metadata: {
            speciesVariant: true,
            family: "genasi-elemental-lineage",
            variantName: lineage,
            variantSpeciesName: row.name,
            variantSpeciesId: row.id,
            variantSource: row.source,
            catalogLabel: displayName,
            catalogDisplayName: displayName,
            catalogArtworkName: displayName,
            facts: variantFacts(row),
            traits: traitSummaries(row, ["Size", "Darkvision"]),
            presentation: presentationMetadata(row, { selectorTraitName: "Elemental Lineage", selectorDescription: helper, replaceParentTraits: true, displayName, artworkName: displayName }),
          },
        };
      }),
    },
  };
}

function tableOptions(species, traitName, family, prefix = "") {
  const trait = findTrait(species, traitName);
  const table = collectTables(trait)[0];
  if (!table) return [];
  return array(table.rows).flatMap((row) => {
    const cells = array(row).map(cleanInline);
    if (!cells[0]) return [];
    const damageType = cells[1] || "";
    return [{
      key: `${prefix}${slug(cells[0])}-${slug(species.source)}`,
      value: cells[0],
      label: cells[0],
      source: species.source,
      kind: "ancestry",
      description: damageType ? `${damageType} affinity` : "",
      metadata: {
        speciesVariant: true,
        family,
        variantName: cells[0],
        variantSource: species.source,
        damageType,
        row: cells,
        columns: array(table.colLabels).map(cleanInline),
        caption: cleanInline(table.caption || traitName),
      },
    }];
  });
}

function standardDragonbornArtwork(ancestry) {
  return `${text(ancestry)} Dragonborn`;
}

function dragonbornFamily(rows) {
  const parent = rows.find((row) => norm(row.name) === "dragonborn" && text(row.source).toUpperCase() === "XPHB");
  if (!parent) return null;
  const gem = rows.find((row) => norm(row.name) === "dragonborn gem" && text(row.source).toUpperCase() === "FTD");
  const related = rows.filter((row) => ["dragonborn chromatic", "dragonborn gem", "dragonborn metallic"].includes(norm(row.name)) && text(row.source).toUpperCase() === "FTD");
  const helper = "Choose one draconic ancestry. Standard chromatic and metallic colors use the 2024 Player's Handbook Dragonborn rules; Gem ancestries use their Fizban's Treasury of Dragons traits and are labeled separately.";
  const standard = tableOptions(parent, "Draconic Ancestry", "dragonborn-ancestry", "dragonborn-").map((option) => {
    const displayName = `${option.value} Dragonborn`;
    const artworkName = standardDragonbornArtwork(option.value);
    return {
      ...option,
      metadata: {
        ...(option.metadata || {}),
        catalogLabel: displayName,
        catalogDisplayName: displayName,
        catalogArtworkName: artworkName,
        ruleFamily: "XPHB Dragonborn",
        facts: variantFacts(parent),
        traits: traitSummaries(parent, ["Draconic Ancestry"]),
      },
    };
  });
  const gemOptions = gem ? tableOptions(gem, "Gem Ancestry", "dragonborn-ancestry", "dragonborn-gem-").map((option) => {
    const displayName = `${option.value} Gem Dragonborn`;
    return {
      ...option,
      label: `${option.label} (Gem)`,
      description: `${option.metadata?.damageType || "Gem"} affinity • Fizban's Treasury of Dragons`,
      metadata: {
        ...(option.metadata || {}),
        catalogLabel: displayName,
        catalogDisplayName: displayName,
        catalogArtworkName: displayName,
        ruleFamily: "FTD Gem Dragonborn",
        familySpeciesName: gem.name,
        familySpeciesId: gem.id,
        traits: traitSummaries(gem, ["Gem Ancestry"]),
        facts: variantFacts(gem),
        presentation: presentationMetadata(gem, { selectorTraitName: "Draconic Ancestry", selectorDescription: helper, replaceParentTraits: true, displayName, artworkName: displayName }),
      },
    };
  }) : [];
  if (!standard.length) return null;
  return {
    parent,
    consumedIds: new Set(related.map((row) => String(row.id))),
    choice: {
      id: "dragonborn-ancestry",
      label: "Draconic Ancestry",
      kind: "ancestry",
      helper,
      options: [...standard, ...gemOptions],
    },
  };
}

export function mergeSpeciesVariantFamilies(rows = []) {
  const input = array(rows);
  const families = [genasiFamily(input), dragonbornFamily(input)].filter(Boolean);
  if (!families.length) return input;
  const consumed = new Set(families.flatMap((family) => [...family.consumedIds]));
  const parentById = new Map(families.map((family) => [String(family.parent.id), family]));
  return input.flatMap((row) => {
    if (consumed.has(String(row.id))) return [];
    const family = parentById.get(String(row.id));
    if (!family) return [row];
    return [{
      ...row,
      speciesVariantChoice: family.choice,
      relatedVariantSpecies: family.choice.options.map((option) => option.metadata?.variantSpeciesId || option.metadata?.familySpeciesId).filter(Boolean),
    }];
  });
}

export function speciesVariantChoice(species = null) {
  return species?.speciesVariantChoice || null;
}

export function resolveSelectedSpeciesVariant(species = null, groups = [], selections = {}) {
  const choice = speciesVariantChoice(species);
  if (!choice?.options?.length || !species) return null;
  const ownerKey = String(species.id || species.name || "");
  const validKeys = new Set(choice.options.map((option) => option.key));
  for (const group of array(groups)) {
    if (group.ownerType !== "species" || String(group.ownerKey || "") !== ownerKey) continue;
    for (const field of array(group.fields)) {
      const fieldOptions = array(field.options);
      if (!fieldOptions.some((option) => validKeys.has(option.key) || option.metadata?.family === choice.id)) continue;
      const selectedKeys = array(selections?.[group.id]?.[field.id]);
      const selected = fieldOptions.find((option) => selectedKeys.includes(option.key) && (validKeys.has(option.key) || option.metadata?.family === choice.id));
      if (selected) return selected;
    }
  }
  return null;
}

export function projectSpeciesVariantPresentation(species = null, selectedVariant = null) {
  const presentation = selectedVariant?.metadata?.presentation;
  if (!species || !presentation || !presentation.replaceParentTraits) return species;
  const selectorName = text(presentation.selectorTraitName || species.speciesVariantChoice?.label || "Variant");
  const existingSelector = array(species.traitDetails).find((detail) => norm(detail?.name) === norm(selectorName));
  const selectorDetail = existingSelector || {
    name: selectorName,
    description: text(presentation.selectorDescription || species.speciesVariantChoice?.helper || "Choose the source-backed variant for this species."),
    structuredChoice: true,
  };
  const projectedDetails = [selectorDetail, ...array(presentation.traits).filter((detail) => norm(detail?.name) !== norm(selectorName))];
  return {
    ...species,
    name: text(presentation.displayName) || species.name,
    source: selectedVariant.source || species.source,
    speed: presentation.speed ?? species.speed,
    size: array(presentation.size).length ? array(presentation.size) : species.size,
    darkvision: presentation.darkvision ?? null,
    creatureTypes: array(presentation.creatureTypes).length ? array(presentation.creatureTypes) : species.creatureTypes,
    traits: projectedDetails.map((detail) => detail.name).filter(Boolean),
    traitDetails: projectedDetails,
    metadata: {
      ...(species.metadata || {}),
      speed: presentation.speed ?? species.metadata?.speed ?? species.speed,
      size: array(presentation.size).length ? array(presentation.size) : species.metadata?.size,
      darkvision: presentation.darkvision ?? null,
      presentationArtworkName: text(presentation.artworkName) || text(presentation.displayName) || species.name,
      selectedVariantPresentation: {
        label: selectedVariant.label,
        variantName: selectedVariant.metadata?.variantName || selectedVariant.value || null,
        source: selectedVariant.source,
        family: selectedVariant.metadata?.family || null,
        ruleFamily: selectedVariant.metadata?.ruleFamily || null,
        damageType: selectedVariant.metadata?.damageType || null,
      },
    },
  };
}

export function projectSelectedSpeciesVariant(species = null, groups = [], selections = {}) {
  return projectSpeciesVariantPresentation(species, resolveSelectedSpeciesVariant(species, groups, selections));
}
