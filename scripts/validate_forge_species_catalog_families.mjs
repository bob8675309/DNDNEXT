import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const protectedPattern = /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/;

const coreSource = read("components/NpcForgeCoreSupport.js");
const panelSource = read("components/NpcForgeContextPanel.js");
const familySource = read("utils/speciesCatalogFamilyMenu.js");
const variantSource = read("utils/speciesVariantFamilies.js");
const artworkSource = read("utils/speciesArtwork.js");
const genasiRestoreSql = read("sql/20260811_92_genasi_source_detail_restore.sql");

for (const token of ["SpeciesCatalogFamilySubmenu", "speciesVariantChoiceBinding", "speciesVariantUsesCatalogSubmenu", "setChoice(group.id, field.id, [option.key])", "npc-forge-catalog-family-option", "option.metadata?.catalogLabel || option.label", "setChoice(binding.group.id, binding.field.id, [])"]) assert.ok(coreSource.includes(token), `left Species family submenu missing ${token}`);
assert.ok(!coreSource.includes("<select value={selectedKey}"), "Species family submenu must use indented catalogue rows, not a dropdown");
for (const token of ["NpcForgeSourceChoiceContext.Provider", "sourceChoiceGroupUsesCatalogSpeciesFamily", "projectSelectedSpeciesVariant", "projectCatalogSpeciesFamilySelection", "groups: (sourceChoiceState.groups || []).filter"]) assert.ok(panelSource.includes(token), `right Species presentation filtering missing ${token}`);
for (const token of ["genasi-elemental-lineage", "dragonborn-ancestry", "speciesVariantChoiceBinding", "selectedCatalogSpeciesFamily", "projectCatalogSpeciesFamilySelection"]) assert.ok(familySource.includes(token), `catalogue Species family helper missing ${token}`);
for (const token of ["displayName", "catalogLabel", "presentationArtworkName", "Dragonborn (Chromatic)", "Dragonborn (Metallic)", "Dragonborn (Gem)"]) assert.ok(variantSource.includes(token), `selected Species family presentation missing ${token}`);
for (const token of ["air-genasi", "water-genasi", "black-dragonborn", "gold-dragonborn", "amethyst-gem-dragonborn"]) assert.ok(artworkSource.includes(token), `selected Species artwork alias missing ${token}`);
for (const token of ["without requiring a material component", "using any spell slots", "sourceAudit", "5etools MPMM source audit"]) assert.ok(genasiRestoreSql.includes(token), `Genasi source-detail restore migration missing ${token}`);
assert.ok(!familySource.includes("giant-ancestry"), "Goliath Giant Ancestry must not be promoted into the catalogue family submenu");
assert.ok(!familySource.includes("fiendish-legacy"), "Tiefling Fiendish Legacy must not be promoted into the catalogue family submenu");

const { mergeSpeciesVariantFamilies, projectSelectedSpeciesVariant } = await import(pathToFileURL(path.join(root, "utils/speciesVariantFamilies.js")).href);
const { buildSpeciesSourceChoiceGroups } = await import(pathToFileURL(path.join(root, "utils/playerForgeSpeciesChoices.js")).href);
const { speciesArtworkFor } = await import(pathToFileURL(path.join(root, "utils/speciesArtwork.js")).href);
const {
  projectCatalogSpeciesFamilySelection,
  sourceChoiceGroupUsesCatalogSpeciesFamily,
  speciesVariantChoiceBinding,
  speciesVariantUsesCatalogSubmenu,
} = await import(pathToFileURL(path.join(root, "utils/speciesCatalogFamilyMenu.js")).href);

const genasiRows = [
  { id: "genasi-parent", name: "Genasi", source: "MPMM", speed: 30, darkvision: 60, metadata: { speed: 30, traits: [] }, traitDetails: [{ name: "Elemental Lineage", description: "Choose the elemental lineage your Genasi takes after." }] },
  { id: "genasi-air", name: "Genasi (Air)", source: "MPMM", speed: 35, darkvision: 60, metadata: { speed: 35, traits: [] }, traitDetails: [{ name: "Unending Breath", description: "Hold your breath indefinitely." }, { name: "Lightning Resistance", description: "Resistance to lightning damage." }] },
  { id: "genasi-earth", name: "Genasi (Earth)", source: "MPMM", speed: 30, darkvision: 60, metadata: { speed: 30, traits: [] }, traitDetails: [{ name: "Earth Walk", description: "Ignore ground-based difficult terrain." }] },
  { id: "genasi-fire", name: "Genasi (Fire)", source: "MPMM", speed: 30, darkvision: 60, metadata: { speed: 30, traits: [] }, traitDetails: [{ name: "Fire Resistance", description: "Resistance to fire damage." }] },
  { id: "genasi-water", name: "Genasi (Water)", source: "MPMM", speed: { walk: 30, swim: true }, darkvision: 60, metadata: { speed: { walk: 30, swim: true }, traits: [] }, traitDetails: [{ name: "Amphibious", description: "Breathe air and water." }, { name: "Acid Resistance", description: "Resistance to acid damage." }] },
];
const [genasi] = mergeSpeciesVariantFamilies(genasiRows);
assert.equal(speciesVariantUsesCatalogSubmenu(genasi), true, "Genasi must use the left catalogue family submenu");
const genasiGroups = buildSpeciesSourceChoiceGroups({ species: genasi, level: 1, spells: [] });
const genasiBinding = speciesVariantChoiceBinding(genasi, genasiGroups, {});
assert.ok(genasiBinding?.group && genasiBinding?.field, "Genasi catalogue submenu must bind to the existing source-choice authority");
assert.equal(sourceChoiceGroupUsesCatalogSpeciesFamily(genasiBinding.group), true, "Genasi source group must be hidden only from right-side presentation");
const projectedGenasiParent = projectCatalogSpeciesFamilySelection(projectSelectedSpeciesVariant(genasi, genasiGroups, {}), genasi, genasiGroups, {});
assert.equal(projectedGenasiParent.name, "Genasi", "opening Genasi must show the parent presentation before a lineage is selected");
assert.ok(!projectedGenasiParent.traitDetails.some((detail) => detail.name === "Amphibious"), "parent Genasi presentation must not preselect Water lineage traits");
const water = genasiBinding.field.options.find((option) => option.value === "Water");
assert.ok(water, "Water Genasi source option missing");
const waterSelections = { [genasiBinding.group.id]: { [genasiBinding.field.id]: [water.key] } };
const projectedWater = projectCatalogSpeciesFamilySelection(projectSelectedSpeciesVariant(genasi, genasiGroups, waterSelections), genasi, genasiGroups, waterSelections);
assert.equal(projectedWater.id, genasi.id, "Genasi submenu selection must not replace the persisted parent Species ID");
assert.equal(projectedWater.name, "Water Genasi", "selected Genasi lineage must change the right-hand display identity");
assert.equal(projectedWater.metadata?.presentationArtworkName, "Genasi", "MPMM supplies one shared Genasi reference image, so lineage display must retain the family artwork rather than invent a false source image");
assert.ok(projectedWater.traitDetails.some((detail) => detail.name === "Amphibious"), "Water selection must project Water lineage traits into the right panel");
assert.ok(!projectedWater.traitDetails.some((detail) => detail.name === "Unending Breath"), "Water selection must not leak Air lineage traits into the right panel");
assert.match(projectedWater.traitDetails.find((detail) => detail.name === "Elemental Lineage")?.description || "", /Selected lineage: Water Genasi/i, "right panel must identify the selected Genasi lineage");
assert.equal(speciesArtworkFor(projectedWater.name), "/media/species/genasi.webp", "selected Water Genasi must use the intentional shared Genasi artwork alias");

const dragonbornRows = [
  {
    id: "dragonborn-xphb", name: "Dragonborn", source: "XPHB", speed: 30, darkvision: 60,
    metadata: { speed: 30, traits: [{ name: "Draconic Ancestry", type: "entries", entries: [{ type: "table", caption: "Draconic Ancestors", colLabels: ["Dragon", "Damage Type"], rows: [["Black", "Acid"], ["Blue", "Lightning"], ["Brass", "Fire"], ["Bronze", "Lightning"], ["Copper", "Acid"], ["Gold", "Fire"], ["Green", "Poison"], ["Red", "Fire"], ["Silver", "Cold"], ["White", "Cold"]] }] }] },
    traitDetails: [{ name: "Draconic Ancestry", description: "Choose a dragon progenitor." }, { name: "Breath Weapon", description: "Exhale damaging energy." }, { name: "Damage Resistance", description: "Resist your ancestry damage type." }, { name: "Darkvision", description: "See in darkness." }, { name: "Draconic Flight", description: "Gain spectral wings at level 5." }],
  },
  { id: "dragonborn-chromatic", name: "Dragonborn (Chromatic)", source: "FTD", metadata: { traits: [] }, traitDetails: [] },
  {
    id: "dragonborn-gem", name: "Dragonborn (Gem)", source: "FTD", speed: 30, darkvision: null,
    metadata: { speed: 30, traits: [{ name: "Gem Ancestry", type: "entries", entries: [{ type: "table", caption: "Gem Ancestry", colLabels: ["Dragon", "Damage Type"], rows: [["Amethyst", "Force"], ["Crystal", "Radiant"], ["Emerald", "Psychic"], ["Sapphire", "Thunder"], ["Topaz", "Necrotic"]] }] }] },
    traitDetails: [{ name: "Breath Weapon", description: "Gem-family breath weapon." }, { name: "Draconic Resistance", description: "Resist the Gem ancestry damage type." }, { name: "Psionic Mind", description: "Telepathic communication." }, { name: "Gem Flight", description: "Manifest spectral wings." }],
  },
  { id: "dragonborn-metallic", name: "Dragonborn (Metallic)", source: "FTD", metadata: { traits: [] }, traitDetails: [] },
];
const [dragonborn] = mergeSpeciesVariantFamilies(dragonbornRows);
assert.equal(speciesVariantUsesCatalogSubmenu(dragonborn), true, "Dragonborn must use the left catalogue family submenu");
const dragonbornGroups = buildSpeciesSourceChoiceGroups({ species: dragonborn, level: 1, spells: [] });
const dragonbornBinding = speciesVariantChoiceBinding(dragonborn, dragonbornGroups, {});
assert.ok(dragonbornBinding?.field?.options?.length === 15, "Dragonborn submenu must retain ten XPHB colors plus five FTD Gem ancestries");
assert.equal(sourceChoiceGroupUsesCatalogSpeciesFamily(dragonbornBinding.group), true, "Dragonborn ancestry group must be filtered only from right-side choice controls");
const projectedDragonbornParent = projectCatalogSpeciesFamilySelection(projectSelectedSpeciesVariant(dragonborn, dragonbornGroups, {}), dragonborn, dragonbornGroups, {});
assert.equal(projectedDragonbornParent.name, "Dragonborn", "opening Dragonborn must show parent information before an ancestry is selected");
const black = dragonbornBinding.field.options.find((option) => option.value === "Black");
assert.equal(black?.label, "Black", "standard Dragonborn canonical source-choice label must remain stable");
assert.equal(black?.metadata?.catalogLabel, "Black Dragonborn", "standard Dragonborn child row may use a richer catalogue-only label");
const blackSelections = { [dragonbornBinding.group.id]: { [dragonbornBinding.field.id]: [black.key] } };
const projectedBlack = projectCatalogSpeciesFamilySelection(projectSelectedSpeciesVariant(dragonborn, dragonbornGroups, blackSelections), dragonborn, dragonbornGroups, blackSelections);
assert.equal(projectedBlack.name, "Black Dragonborn", "standard Dragonborn selection must change the right-hand display identity");
assert.equal(projectedBlack.metadata?.presentationArtworkName, "Dragonborn (Chromatic)", "standard chromatic ancestry must switch to chromatic family artwork");
assert.equal(speciesArtworkFor(projectedBlack.name), "/media/species/dragonborn-chromatic.webp", "Black Dragonborn display must resolve to chromatic family artwork");
assert.ok(projectedBlack.traitDetails.some((detail) => detail.name === "Damage Resistance"), "standard XPHB Dragonborn selection must retain XPHB parent mechanics");
assert.match(projectedBlack.traitDetails.find((detail) => detail.name === "Draconic Ancestry")?.description || "", /Selected ancestry: Black.*Acid/i, "right panel must identify the selected standard Dragonborn ancestry and affinity");
const amethyst = dragonbornBinding.field.options.find((option) => option.value === "Amethyst");
assert.equal(amethyst?.label, "Amethyst (Gem)", "Gem Dragonborn canonical source-choice label must remain stable");
assert.equal(amethyst?.metadata?.catalogLabel, "Amethyst Gem Dragonborn", "Gem Dragonborn child row may use a richer catalogue-only label");
const gemSelections = { [dragonbornBinding.group.id]: { [dragonbornBinding.field.id]: [amethyst.key] } };
const projectedGem = projectCatalogSpeciesFamilySelection(projectSelectedSpeciesVariant(dragonborn, dragonbornGroups, gemSelections), dragonborn, dragonbornGroups, gemSelections);
assert.equal(projectedGem.name, "Amethyst Gem Dragonborn", "Gem ancestry must change the right-hand display identity");
assert.equal(projectedGem.metadata?.presentationArtworkName, "Dragonborn (Gem)", "Gem ancestry must switch to Gem family artwork");
assert.equal(speciesArtworkFor(projectedGem.name), "/media/species/dragonborn-gem.webp", "Gem Dragonborn display must resolve to Gem family artwork");
assert.ok(projectedGem.traitDetails.some((detail) => detail.name === "Psionic Mind"), "FTD Gem selection must project Gem-family traits");
assert.ok(projectedGem.traitDetails.some((detail) => detail.name === "Gem Flight"), "FTD Gem selection must project Gem Flight");
assert.ok(!projectedGem.traitDetails.some((detail) => detail.name === "Damage Resistance"), "FTD Gem selection must not retain XPHB-only Damage Resistance presentation");
assert.ok(!projectedGem.traitDetails.some((detail) => detail.name === "Draconic Flight"), "FTD Gem selection must not retain XPHB-only Draconic Flight presentation");
assert.match(projectedGem.traitDetails.find((detail) => detail.name === "Draconic Ancestry")?.description || "", /Amethyst \(Gem\).*Force.*FTD Gem Dragonborn/i, "right panel must identify the selected Gem ancestry, affinity, and rule family");

assert.equal(speciesVariantUsesCatalogSubmenu({ name: "Goliath", source: "XPHB" }), false, "Goliath Giant Ancestry must remain an inline trait choice");
assert.equal(speciesVariantUsesCatalogSubmenu({ name: "Tiefling", source: "XPHB" }), false, "Tiefling Fiendish Legacy must remain an inline trait choice");
assert.equal(sourceChoiceGroupUsesCatalogSpeciesFamily({ ownerType: "species", label: "Giant Ancestry", fields: [{ options: [{ key: "cloud" }] }] }), false, "Goliath source group must remain visible on the right");
assert.equal(sourceChoiceGroupUsesCatalogSpeciesFamily({ ownerType: "species", label: "Fiendish Legacy", fields: [{ options: [{ key: "infernal" }] }] }), false, "Tiefling source group must remain visible on the right");

for (const source of [coreSource, panelSource, familySource, variantSource, artworkSource]) assert.ok(!protectedPattern.test(source), "Species catalogue family work crossed a protected map/travel boundary");

console.log("Forge Species catalogue families validated: Genasi and Dragonborn expand to indented child rows, parent-first display is preserved, canonical source-choice labels stay stable, selected child identity/artwork/rules project on the right, Goliath/Tiefling stay inline, and protected boundaries remain intact.");
