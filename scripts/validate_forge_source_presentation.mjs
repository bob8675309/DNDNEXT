import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const protectedPattern = /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/;

const variantSource = read("utils/speciesVariantFamilies.js");
const speciesChoicesSource = read("utils/playerForgeSpeciesChoices.js");
const speciesPresentationSource = read("utils/speciesPresentation.js");
const embeddedSource = read("components/NpcForgeEmbeddedSourceChoices.js");
const structuredRenderer = read("components/SourceRuleContent.js");
const classTextSource = read("components/ClassFeatureText.js");
const classModelSource = read("components/NpcForgeClassGuideModel.js");
const classGuideSource = read("components/NpcForgeClassGuide.js");
const importerSource = read("scripts/import_5etools_character_options_refined.mjs");
const migration = read("sql/20260811_91_genasi_subrace_catalog.sql");

for (const token of ["mergeSpeciesVariantFamilies", "genasi-elemental-lineage", "dragonborn-ancestry", "FTD Gem Dragonborn", "movementFact"]) assert.ok(variantSource.includes(token), `species family model missing ${token}`);
for (const token of ["variantChoiceField", "tableOptionDescription", "listOptionDescription", "speciesVariantChoice", "standaloneSpeciesVariantGroup"]) assert.ok(speciesChoicesSource.includes(token), `species source-choice detail model missing ${token}`);
for (const token of ["STRUCTURED_PERSISTENT_CHOICE_TRAITS", "omitChoiceCollections", "fiendish-legacy", "giant-ancestry"]) assert.ok(speciesPresentationSource.includes(token), `species presentation structure guard missing ${token}`);
for (const token of ["SelectedOptionDetail", "npc-forge-embedded-choice__selected", "metadata.damageType", "metadata.traits"]) assert.ok(embeddedSource.includes(token), `embedded selector detail presentation missing ${token}`);
for (const token of ["SourceTable", "SourceList", "NamedEntries", "sourceRuleStructureSummary"]) assert.ok(structuredRenderer.includes(token), `shared structured source renderer missing ${token}`);
for (const token of ['import SourceRuleContent from "./SourceRuleContent"', "entries = null", "hasStructuredEntries"]) assert.ok(classTextSource.includes(token), `ClassFeatureText structured source bridge missing ${token}`);
for (const token of ["featureSource", "entries: exact?.entries", 'select("id,feature_type,name,source,class_source,subclass_name,subclass_short_name,level,description,entries,raw_payload")']) assert.ok(classModelSource.includes(token), `class model source-entry preservation missing ${token}`);
assert.ok(classGuideSource.includes("entries={feature.entries || null}"), "detailed Class guide must pass source entries into structured renderer");
for (const token of ["files.races.subrace", "mergeSubraces", "sourceDerivedSubrace", "parentSpecies", "backgrounds-species-and-subraces"]) assert.ok(importerSource.includes(token), `canonical importer subrace support missing ${token}`);
for (const token of ["species:genasi-air|MPMM", "species:genasi-earth|MPMM", "species:genasi-fire|MPMM", "species:genasi-water|MPMM", "sourceDerivedSubrace"]) assert.ok(migration.includes(token), `Genasi migration missing ${token}`);
assert.ok(/where not exists/i.test(migration), "Genasi migration must be idempotent");

const { mergeSpeciesVariantFamilies } = await import(pathToFileURL(path.join(root, "utils/speciesVariantFamilies.js")).href);
const { buildSpeciesSourceChoiceGroups } = await import(pathToFileURL(path.join(root, "utils/playerForgeSpeciesChoices.js")).href);
const { extractSpeciesTraitDetails } = await import(pathToFileURL(path.join(root, "utils/speciesPresentation.js")).href);

const genasiRows = [
  { id: "genasi-parent", name: "Genasi", source: "MPMM", speed: 30, darkvision: 60, metadata: { speed: 30, traits: [] }, traitDetails: [] },
  { id: "genasi-air", name: "Genasi (Air)", source: "MPMM", speed: 35, darkvision: 60, metadata: { speed: 35, traits: [] }, traitDetails: [{ name: "Unending Breath", description: "Hold your breath indefinitely." }, { name: "Lightning Resistance", description: "Resistance to lightning damage." }] },
  { id: "genasi-earth", name: "Genasi (Earth)", source: "MPMM", speed: 30, darkvision: 60, metadata: { speed: 30, traits: [] }, traitDetails: [{ name: "Earth Walk", description: "Ignore ground-based difficult terrain." }] },
  { id: "genasi-fire", name: "Genasi (Fire)", source: "MPMM", speed: 30, darkvision: 60, metadata: { speed: 30, traits: [] }, traitDetails: [{ name: "Fire Resistance", description: "Resistance to fire damage." }] },
  { id: "genasi-water", name: "Genasi (Water)", source: "MPMM", speed: { walk: 30, swim: true }, darkvision: 60, metadata: { speed: { walk: 30, swim: true }, traits: [] }, traitDetails: [{ name: "Amphibious", description: "Breathe air and water." }] },
];
const groupedGenasi = mergeSpeciesVariantFamilies(genasiRows);
assert.equal(groupedGenasi.length, 1, "Genasi elemental child rows must collapse under the MPMM parent");
assert.equal(groupedGenasi[0].speciesVariantChoice.options.length, 4, "Genasi parent must expose four elemental lineages");
const water = groupedGenasi[0].speciesVariantChoice.options.find((option) => option.value === "Water");
assert.ok(water.metadata.facts.some((fact) => /swimming equal to walking speed/i.test(fact.value)), "Water Genasi movement summary must not degrade to NaN");
const genasiGroups = buildSpeciesSourceChoiceGroups({ species: groupedGenasi[0], level: 1, spells: [] });
assert.equal(genasiGroups[0].label, "Elemental Lineage", "Genasi lineage selector must be a source-owned Species choice");
assert.equal(genasiGroups[0].fields[0].options.length, 4, "Genasi selector must retain four source-backed options");

const dragonbornRows = [
  {
    id: "dragonborn-xphb", name: "Dragonborn", source: "XPHB", metadata: { traits: [{ name: "Draconic Ancestry", type: "entries", entries: [{ type: "table", caption: "Draconic Ancestors", colLabels: ["Dragon", "Damage Type"], rows: [["Black", "Acid"], ["Blue", "Lightning"], ["Brass", "Fire"], ["Bronze", "Lightning"], ["Copper", "Acid"], ["Gold", "Fire"], ["Green", "Poison"], ["Red", "Fire"], ["Silver", "Cold"], ["White", "Cold"]] }] }] }, traitDetails: [],
  },
  { id: "dragonborn-chromatic", name: "Dragonborn (Chromatic)", source: "FTD", metadata: { traits: [] }, traitDetails: [] },
  {
    id: "dragonborn-gem", name: "Dragonborn (Gem)", source: "FTD", speed: 30, darkvision: 60,
    metadata: { speed: 30, traits: [{ name: "Gem Ancestry", type: "entries", entries: [{ type: "table", caption: "Gem Ancestry", colLabels: ["Dragon", "Damage Type"], rows: [["Amethyst", "Force"], ["Crystal", "Radiant"], ["Emerald", "Psychic"], ["Sapphire", "Thunder"], ["Topaz", "Necrotic"]] }] }] },
    traitDetails: [{ name: "Psionic Mind", description: "Telepathic communication." }, { name: "Gem Flight", description: "Manifest spectral wings." }],
  },
  { id: "dragonborn-metallic", name: "Dragonborn (Metallic)", source: "FTD", metadata: { traits: [] }, traitDetails: [] },
];
const groupedDragonborn = mergeSpeciesVariantFamilies(dragonbornRows);
assert.equal(groupedDragonborn.length, 1, "Dragonborn FTD family rows should be represented under one player-facing parent");
assert.equal(groupedDragonborn[0].speciesVariantChoice.options.length, 15, "Dragonborn selector must expose ten XPHB colors plus five explicitly labeled Gem options");
assert.equal(groupedDragonborn[0].speciesVariantChoice.options.filter((option) => option.metadata?.ruleFamily === "FTD Gem Dragonborn").length, 5, "five Gem Dragonborn options must retain their FTD rule family");
const dragonbornGroups = buildSpeciesSourceChoiceGroups({ species: groupedDragonborn[0], level: 1, spells: [] });
const ancestryGroup = dragonbornGroups.find((group) => group.label === "Draconic Ancestry");
assert.equal(ancestryGroup?.fields?.[0]?.options?.length, 15, "Dragonborn Draconic Ancestry source group must use the unified family selector");

const tiefling = {
  id: "tiefling", name: "Tiefling", source: "XPHB",
  metadata: { traits: [{ name: "Fiendish Legacy", type: "entries", entries: ["You are the recipient of a legacy that grants supernatural abilities.", { type: "table", caption: "Fiendish Legacies", colLabels: ["Legacy", "Resistance", "Level 1", "Level 3", "Level 5"], rows: [["Abyssal", "Poison", "Poison Spray", "Ray of Sickness", "Hold Person"], ["Chthonic", "Necrotic", "Chill Touch", "False Life", "Ray of Enfeeblement"], ["Infernal", "Fire", "Fire Bolt", "Hellish Rebuke", "Darkness"]] }] }] },
};
const tieflingGroups = buildSpeciesSourceChoiceGroups({ species: tiefling, level: 1, spells: [] });
const legacy = tieflingGroups.find((group) => group.label === "Fiendish Legacy");
assert.equal(legacy?.fields?.[0]?.options?.length, 3, "Fiendish Legacy must expose three coherent source rows");
assert.ok(legacy.fields[0].options.every((option) => /Resistance:/.test(option.description) && /Level 5:/.test(option.description)), "Fiendish Legacy choices must carry their row-specific mechanics instead of labels only");
const tieflingDetails = extractSpeciesTraitDetails(tiefling.metadata);
assert.ok(!/Abyssal[\s\S]*Chthonic[\s\S]*Infernal/.test(tieflingDetails[0].description), "Fiendish Legacy table must not be duplicated as a flattened prose wall");

const goliath = {
  id: "goliath", name: "Goliath", source: "XPHB",
  metadata: { traits: [{ name: "Giant Ancestry", type: "entries", entries: ["You are descended from Giants.", { type: "list", items: [
    { type: "item", name: "Cloud's Jaunt (Cloud Giant)", entries: ["Teleport up to 30 feet as a Bonus Action."] },
    { type: "item", name: "Fire's Burn (Fire Giant)", entries: ["Deal extra fire damage on a hit."] },
    { type: "item", name: "Frost's Chill (Frost Giant)", entries: ["Deal extra cold damage and reduce Speed."] },
    { type: "item", name: "Hill's Tumble (Hill Giant)", entries: ["Knock a Large or smaller creature Prone."] },
    { type: "item", name: "Stone's Endurance (Stone Giant)", entries: ["Reduce incoming damage as a Reaction."] },
    { type: "item", name: "Storm's Thunder (Storm Giant)", entries: ["Deal thunder damage as a Reaction."] },
  ] }] }] },
};
const goliathGroups = buildSpeciesSourceChoiceGroups({ species: goliath, level: 1, spells: [] });
const giant = goliathGroups.find((group) => group.label === "Giant Ancestry");
assert.equal(giant?.fields?.[0]?.options?.length, 6, "Goliath must expose six Giant Ancestry options");
assert.ok(giant.fields[0].options.every((option) => option.description.length > 12), "each Giant Ancestry option needs its own readable rule summary");
const goliathDetails = extractSpeciesTraitDetails(goliath.metadata);
assert.ok(!/Cloud's Jaunt[\s\S]*Storm's Thunder/.test(goliathDetails[0].description), "Giant Ancestry option list must not also appear as one prose wall");

for (const source of [variantSource, speciesChoicesSource, speciesPresentationSource, embeddedSource, structuredRenderer, classTextSource, classModelSource, classGuideSource, importerSource, migration]) {
  assert.ok(!protectedPattern.test(source), "Forge source-presentation work crossed a protected map/travel boundary");
}

console.log("Forge source presentation validated: structured Species selectors, Genasi/Dragonborn families, Class source tables/lists, subrace import support, and protected boundaries are intact.");
