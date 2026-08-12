const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (value) => norm(value).replace(/\s+/g, "-");
const array = (value) => Array.isArray(value) ? value : [];

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

function flattenStrings(node, output = []) {
  if (node == null) return output;
  if (typeof node === "string") { const cleaned = cleanInline(node); if (cleaned) output.push(cleaned); return output; }
  if (Array.isArray(node)) { node.forEach((entry) => flattenStrings(entry, output)); return output; }
  if (typeof node !== "object") return output;
  if (node.entry) flattenStrings(node.entry, output);
  if (node.entries) flattenStrings(node.entries, output);
  return output;
}

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

function collectLists(node, output = []) {
  if (node == null) return output;
  if (Array.isArray(node)) { node.forEach((entry) => collectLists(entry, output)); return output; }
  if (typeof node !== "object") return output;
  if (node.type === "list" && Array.isArray(node.items)) output.push(node.items);
  Object.values(node).forEach((entry) => collectLists(entry, output));
  return output;
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

function factsFor({ speed = null, darkvision = null } = {}) {
  const facts = [];
  const movement = movementFact(speed);
  if (movement) facts.push({ label: "Speed", value: movement });
  if (darkvision) facts.push({ label: "Darkvision", value: `${Number(darkvision)} ft.` });
  return facts;
}

function basePresentation(species, selectorTraitName, helper, displayName, artworkName, overrides = {}) {
  const speed = overrides.speed === undefined ? species?.metadata?.speed ?? species?.speed ?? null : overrides.speed;
  const size = overrides.size === undefined ? array(species?.size).length ? array(species.size) : array(species?.metadata?.size) : array(overrides.size);
  const darkvision = overrides.darkvision === undefined ? species?.darkvision ?? species?.metadata?.darkvision ?? null : overrides.darkvision;
  const creatureTypes = overrides.creatureTypes === undefined ? array(species?.creatureTypes).length ? array(species.creatureTypes) : array(species?.metadata?.creatureTypes) : array(overrides.creatureTypes);
  return {
    speed,
    size,
    darkvision,
    creatureTypes,
    traits: array(species?.traitDetails).filter((entry) => norm(entry?.name) !== norm(selectorTraitName)),
    selectorTraitName,
    selectorDescription: helper,
    replaceParentTraits: true,
    displayName,
    artworkName,
  };
}

function tableFamily(species, config) {
  const trait = findTrait(species, config.traitName);
  const table = collectTables(trait)[0];
  if (!table) return species;
  const columns = array(table.colLabels).map(cleanInline);
  const options = array(table.rows).flatMap((rawRow) => {
    const row = array(rawRow).map(cleanInline);
    const label = row[0];
    if (!label) return [];
    const overrides = config.optionOverrides?.[norm(label)] || {};
    const displayName = overrides.displayName || config.displayName?.(label) || label;
    const selectedDescription = row.slice(1).map((value, index) => value ? `${columns[index + 1] || `Detail ${index + 1}`}: ${value}` : "").filter(Boolean).join(" • ");
    const presentation = basePresentation(species, config.traitName, config.helper, displayName, config.artworkName, overrides);
    return [{
      key: slug(label), value: label, label, source: species.source, kind: config.kind,
      description: selectedDescription,
      metadata: {
        speciesVariant: true,
        family: config.id,
        variantName: label,
        variantSource: species.source,
        catalogLabel: displayName,
        catalogDisplayName: displayName,
        catalogArtworkName: config.artworkName,
        selectedDescription,
        row,
        columns,
        caption: cleanInline(table.caption || config.traitName),
        facts: factsFor(presentation),
        presentation,
      },
    }];
  });
  if (options.length < 2) return species;
  return {
    ...species,
    catalogSpeciesVariantChoice: { id: config.id, label: config.label, kind: config.kind, traitName: config.traitName, helper: config.helper, options },
  };
}

function listFamily(species, config) {
  const trait = findTrait(species, config.traitName);
  const items = collectLists(trait)[0] || [];
  const options = array(items).flatMap((item) => {
    const label = text(typeof item === "string" ? item : item?.name || item?.entry);
    if (!label) return [];
    const overrides = config.optionOverrides?.[norm(label)] || {};
    const displayName = overrides.displayName || config.displayName?.(label) || label;
    const selectedDescription = flattenStrings(typeof item === "string" ? item : item?.entries || item?.entry || []).join(" ");
    const presentation = basePresentation(species, config.traitName, config.helper, displayName, config.artworkName, overrides);
    return [{
      key: slug(label), value: label, label, source: species.source, kind: config.kind,
      description: selectedDescription,
      metadata: {
        speciesVariant: true,
        family: config.id,
        variantName: label,
        variantSource: species.source,
        catalogLabel: displayName,
        catalogDisplayName: displayName,
        catalogArtworkName: config.artworkName,
        selectedDescription,
        sourceItem: item,
        facts: factsFor(presentation),
        presentation,
      },
    }];
  });
  if (options.length < 2) return species;
  const neutralDarkvision = config.neutralDarkvision === undefined ? species.darkvision : config.neutralDarkvision;
  return {
    ...species,
    ...(config.neutralDarkvision !== undefined ? { darkvision: neutralDarkvision } : {}),
    metadata: config.neutralDarkvision !== undefined ? { ...(species.metadata || {}), darkvision: neutralDarkvision } : species.metadata,
    catalogSpeciesVariantChoice: { id: config.id, label: config.label, kind: config.kind, traitName: config.traitName, helper: config.helper, options },
  };
}

function avenFamily(rows) {
  const parent = rows.find((row) => norm(row.name) === "aven" && text(row.source).toUpperCase() === "PSA");
  const hawk = rows.find((row) => norm(row.name) === "aven hawk headed" && text(row.source).toUpperCase() === "PSA");
  const ibis = rows.find((row) => norm(row.name) === "aven ibis headed" && text(row.source).toUpperCase() === "PSA");
  if (!parent || !hawk || !ibis) return null;
  const helper = "Choose the Aven subrace represented by this character. The selection keeps Aven as the parent Species while applying the source-backed Hawk-Headed or Ibis-Headed traits.";
  const children = [hawk, ibis];
  return {
    parent,
    consumedIds: new Set(children.map((row) => String(row.id))),
    choice: {
      id: "aven-subrace", label: "Aven Subrace", kind: "subrace", helper,
      options: children.map((row) => {
        const variant = text(row.metadata?.variantName || row.name.replace(/^Aven\s*\(|\)$/g, ""));
        const displayName = `${variant} Aven`;
        const presentation = {
          speed: row.metadata?.speed ?? row.speed ?? null,
          size: array(row.size).length ? array(row.size) : array(row.metadata?.size),
          darkvision: row.darkvision ?? row.metadata?.darkvision ?? null,
          creatureTypes: array(row.creatureTypes).length ? array(row.creatureTypes) : array(row.metadata?.creatureTypes),
          traits: array(row.traitDetails),
          selectorTraitName: "Aven Subrace",
          selectorDescription: helper,
          replaceParentTraits: true,
          displayName,
          artworkName: "Aven",
        };
        const uniqueTrait = array(row.traitDetails).find((detail) => !array(parent.traitDetails).some((base) => norm(base?.name) === norm(detail?.name)));
        return {
          key: slug(variant), value: variant, label: variant, source: row.source, kind: "subrace",
          description: uniqueTrait?.description || row.description,
          metadata: {
            speciesVariant: true,
            family: "aven-subrace",
            variantName: variant,
            variantSpeciesName: row.name,
            variantSpeciesId: row.id,
            variantSource: row.source,
            catalogLabel: displayName,
            catalogDisplayName: displayName,
            catalogArtworkName: "Aven",
            selectedDescription: uniqueTrait ? `${uniqueTrait.name}: ${uniqueTrait.description}` : row.description,
            facts: factsFor(presentation),
            presentation,
          },
        };
      }),
    },
  };
}

const TRAIT_FAMILIES = [
  {
    parentName: "Elf", source: "XPHB", mode: "table", id: "elf-lineage", label: "Elven Lineage", kind: "lineage", traitName: "Elven Lineage", artworkName: "Elf",
    helper: "Choose the 2024 Elven Lineage. The selected lineage changes its innate level 1 benefit and its level 3 and 5 species spells; spellcasting ability remains a separate source-owned choice.",
    displayName: (label) => label,
    optionOverrides: {
      drow: { displayName: "Drow", darkvision: 120 },
      "high elf": { displayName: "High Elf" },
      "wood elf": { displayName: "Wood Elf", speed: 35 },
    },
  },
  {
    parentName: "Gnome", source: "XPHB", mode: "list", id: "gnome-lineage", label: "Gnomish Lineage", kind: "lineage", traitName: "Gnomish Lineage", artworkName: "Gnome",
    helper: "Choose the 2024 Gnomish Lineage. Forest and Rock Gnomes keep the same Gnome parent identity while presenting their source-specific lineage benefits.",
    displayName: (label) => label,
  },
  {
    parentName: "Shifter", source: "MPMM", mode: "list", id: "shifter-subtype", label: "Shifting Form", kind: "subtype", traitName: "Shifting", artworkName: "Shifter",
    helper: "Choose the bestial Shifting form this Shifter manifests: Beasthide, Longtooth, Swiftstride, or Wildhunt.",
    displayName: (label) => `${label} Shifter`,
  },
  {
    parentName: "Fairy", source: "LFL", mode: "list", id: "faerie-lineage", label: "Faerie Lineage", kind: "lineage", traitName: "Faerie Lineage", artworkName: "Fairy",
    helper: "Choose whether this Faerie is native to Lorwyn or Shadowmoor. Shadowmoor Faeries gain their source-specific Darkvision benefit.",
    displayName: (label) => `${label} Fairy`,
    neutralDarkvision: null,
    optionOverrides: { lorwyn: { darkvision: null }, shadowmoor: { darkvision: 120 } },
  },
  {
    parentName: "Kithkin", source: "LFL", mode: "list", id: "kithkin-lineage", label: "Kithkin Lineage", kind: "lineage", traitName: "Kithkin Lineage", artworkName: "Kithkin",
    helper: "Choose whether this Kithkin is native to Lorwyn or Shadowmoor. Shadowmoor Kithkin gain their source-specific Darkvision benefit.",
    displayName: (label) => `${label} Kithkin`,
    neutralDarkvision: null,
    optionOverrides: { lorwyn: { darkvision: null }, shadowmoor: { darkvision: 120 } },
  },
];

const SETTING_FAMILIES = [
  { parentName: "Human", parentSource: "XPHB", children: [["Human (Innistrad)", "PSI"], ["Human (Ixalan)", "PSX"], ["Human (Kaladesh)", "PSK"], ["Human (Zendikar)", "PSZ"]] },
  { parentName: "Dwarf", parentSource: "XPHB", children: [["Dwarf (Kaladesh)", "PSK"]] },
  { parentName: "Elf", parentSource: "XPHB", children: [["Elf (Kaladesh)", "PSK"], ["Elf (Zendikar)", "PSZ"]] },
  { parentName: "Orc", parentSource: "XPHB", children: [["Orc (Ixalan)", "PSX"]] },
  { parentName: "Minotaur", parentSource: "MPMM", children: [["Minotaur (Amonkhet)", "PSA"]] },
  { parentName: "Goblin", parentSource: "MPMM", children: [["Goblin (Dankwood)", "AWM"]] },
];

function attachSettingFamilies(rows) {
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  for (const config of SETTING_FAMILIES) {
    const parent = rows.find((row) => norm(row.name) === norm(config.parentName) && text(row.source).toUpperCase() === config.parentSource);
    if (!parent) continue;
    const children = config.children.flatMap(([name, source]) => {
      const row = rows.find((candidate) => norm(candidate.name) === norm(name) && text(candidate.source).toUpperCase() === source);
      return row ? [row] : [];
    });
    if (!children.length) continue;
    byId.set(String(parent.id), {
      ...byId.get(String(parent.id)),
      catalogSourceVariants: children.map((child) => ({ ...child, catalogHidden: true, catalogParentId: parent.id, catalogParentName: parent.name })),
      catalogSearchAliases: children.flatMap((child) => [child.name, child.source]),
    });
    for (const child of children) byId.set(String(child.id), { ...child, catalogHidden: true, catalogParentId: parent.id, catalogParentName: parent.name });
  }
  return rows.map((row) => byId.get(String(row.id)) || row);
}

export function expandSpeciesCatalogFamilies(rows = []) {
  let output = array(rows);
  const aven = avenFamily(output);
  if (aven) {
    const consumed = aven.consumedIds;
    output = output.flatMap((row) => {
      if (consumed.has(String(row.id))) return [];
      if (String(row.id) !== String(aven.parent.id)) return [row];
      return [{ ...row, speciesVariantChoice: aven.choice, relatedVariantSpecies: aven.choice.options.map((option) => option.metadata?.variantSpeciesId).filter(Boolean) }];
    });
  }
  output = output.map((row) => {
    const config = TRAIT_FAMILIES.find((candidate) => norm(candidate.parentName) === norm(row.name) && candidate.source === text(row.source).toUpperCase());
    if (!config) return row;
    return config.mode === "table" ? tableFamily(row, config) : listFamily(row, config);
  });
  return attachSettingFamilies(output);
}
