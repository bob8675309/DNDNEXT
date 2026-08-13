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
const playerFacingSource = read("utils/playerFacingText.js");
const backgroundSource = read("utils/backgroundMechanics.js");
const embeddedSource = read("components/NpcForgeEmbeddedSourceChoices.js");
const structuredRenderer = read("components/SourceRuleContent.js");
const classTextSource = read("components/ClassFeatureText.js");
const classModelSource = read("components/NpcForgeClassGuideModel.js");
const classGuideSource = read("components/NpcForgeClassGuide.js");
const contextPanelSource = read("components/NpcForgeContextPanel.js");
const importerSource = read("scripts/import_5etools_character_options_refined.mjs");
const migration = read("sql/20260811_91_genasi_subrace_catalog.sql");

for (const token of ["mergeSpeciesVariantFamilies", "genasi-elemental-lineage", "dragonborn-ancestry", "FTD Gem Dragonborn", "movementFact", "resolveSelectedSpeciesVariant", "projectSpeciesVariantPresentation", "projectSelectedSpeciesVariant"]) assert.ok(variantSource.includes(token), `species family model missing ${token}`);
for (const token of ["variantChoiceField", "tableOptionDescription", "listOptionDescription", "speciesVariantChoice", "standaloneSpeciesVariantGroup"]) assert.ok(speciesChoicesSource.includes(token), `species source-choice detail model missing ${token}`);
for (const token of ["STRUCTURED_PERSISTENT_CHOICE_TRAITS", "omitChoiceCollections", "fiendish-legacy", "giant-ancestry"]) assert.ok(speciesPresentationSource.includes(token), `species presentation structure guard missing ${token}`);
assert.ok(playerFacingSource.includes("[a-zA-Z0-9]+"), "player-facing formatter must strip alphanumeric 5etools tag names");
for (const token of ["structuredRuleText", "tableLooksOptional", "structuredFeatureDescription", "structuredSource"]) assert.ok(backgroundSource.includes(token), `background structured-rule presentation missing ${token}`);
for (const token of ["SelectedOptionDetail", "choiceButtonSummary", "hasRichOptionDetail", "npc-forge-embedded-choice__selected", "metadata.damageType", "metadata.traits"]) assert.ok(embeddedSource.includes(token), `embedded selector detail presentation missing ${token}`);
for (const token of ["SourceTable", "SourceList", "NamedEntries", "SourceReference", "SourceFormula", "SourceOptions", "SourceQuote", "sourceRuleStructureSummary", "refClassFeature", "refSubclassFeature", "refOptionalfeature", "refFeat", "abilityDc", "abilityAttackMod", "itemSpell", "statblock"]) assert.ok(structuredRenderer.includes(token), `shared structured source renderer missing ${token}`);
for (const token of ['import SourceRuleContent from "./SourceRuleContent"', "entries = null", "hasStructuredEntries"]) assert.ok(classTextSource.includes(token), `ClassFeatureText structured source bridge missing ${token}`);
for (const token of ["featureSource", "entries: exact?.entries", 'select("id,feature_type,name,source,class_source,subclass_name,subclass_short_name,level,description,entries,raw_payload")']) assert.ok(classModelSource.includes(token), `class model source-entry preservation missing ${token}`);
assert.ok(classGuideSource.includes("entries={feature.entries || null}"), "detailed Class guide must pass source entries into structured renderer");
for (const token of ["useNpcForgeSourceChoices", "projectSelectedSpeciesVariant", "projectedSelectedSpecies", "projectedDetail"]) assert.ok(contextPanelSource.includes(token), `Species selected-variant presentation bridge missing ${token}`);
for (const token of ["files.races.subrace", "mergeSubraces", "sourceDerivedSubrace", "parentSpecies", "backgrounds-species-and-subraces", "legacy_copy_resolution"]) assert.ok(importerSource.includes(token), `canonical importer subrace support missing ${token}`);
for (const token of ["species:genasi-air|MPMM", "species:genasi-earth|MPMM", "species:genasi-fire|MPMM", "species:genasi-water|MPMM", "sourceDerivedSubrace"]) assert.ok(migration.includes(token), `Genasi migration missing ${token}`);
assert.ok(/where not exists/i.test(migration), "Genasi migration must be idempotent");

const { mergeSpeciesVariantFamilies, projectSelectedSpeciesVariant } = await import(pathToFileURL(path.join(root, "utils/speciesVariantFamilies.js")).href);
const { buildSpeciesSourceChoiceGroups } = await import(pathToFileURL(path.join(root, "utils/playerForgeSpeciesChoices.js")).href);
const { extractSpeciesTraitDetails } = await import(pathToFileURL(path.join(root, "utils/speciesPresentation.js")).href);
const { formatPlayerFacingInline } = await import(pathToFileURL(path.join(root, "utils/playerFacingText.js")).href);
const { backgroundFeatureDetails } = await import(pathToFileURL(path.join(root, "utils/backgroundMechanics.js")).href);

assert.equal(formatPlayerFacingInline("You gain one {@5etools feat|feats.html} of your choice."), "You gain one feat of your choice.", "alphanumeric 5etools tags must not leak their braces/tag marker or internal link target into player-facing copy");

function selectVariant(species, groups, optionValue) {
  const group = groups.find((entry) => entry.ownerType === "species" && String(entry.ownerKey || "") === String(species.id));
  assert.ok(group, `source-choice group missing for ${species.name}`);
  const field = group.fields.find((entry) => entry.options?.some((option) => option.value === optionValue || option.label === optionValue));
  assert.ok(field, `source-choice field missing ${optionValue}`);
  const option = field.options.find((entry) => entry.value === optionValue || entry.label === optionValue);
  assert.ok(option, `source-choice option missing ${optionValue}`);
  return { option, selections: { [group.id]: { [field.id]: [option.key] } } };
}

const genasiRows = [
  { id: "genasi-parent", name: "Genasi", source: "MPMM", speed: 30, darkvision: 60, creatureTypes: ["Humanoid"], size: ["M", "S"], metadata: { speed: 30, traits: [] }, traitDetails: [] },
  { id: "genasi-air", name: "Genasi (Air)", source: "MPMM", speed: 35, darkvision: 60, creatureTypes: ["Humanoid"], size: ["M", "S"], metadata: { speed: 35, traits: [] }, traitDetails: [{ name: "Unending Breath", description: "Hold your breath indefinitely." }, { name: "Lightning Resistance", description: "Resistance to lightning damage." }] },
  { id: "genasi-earth", name: "Genasi (Earth)", source: "MPMM", speed: 30, darkvision: 60, creatureTypes: ["Humanoid"], size: ["M", "S"], metadata: { speed: 30, traits: [] }, traitDetails: [{ name: "Earth Walk", description: "Ignore ground-based difficult terrain." }] },
  { id: "genasi-fire", name: "Genasi (Fire)", source: "MPMM", speed: 30, darkvision: 60, creatureTypes: ["Humanoid"], size: ["M", "S"], metadata: { speed: 30, traits: [] }, traitDetails: [{ name: "Fire Resistance", description: "Resistance to fire damage." }] },
  { id: "genasi-water", name: "Genasi (Water)", source: "MPMM", speed: { walk: 30, swim: true }, darkvision: 60, creatureTypes: ["Humanoid"], size: ["M", "S"], metadata: { speed: { walk: 30, swim: true }, traits: [] }, traitDetails: [{ name: "Amphibious", description: "Breathe air and water." }, { name: "Acid Resistance", description: "Resistance to acid damage." }] },
];
const groupedGenasi = mergeSpeciesVariantFamilies(genasiRows);
assert.equal(groupedGenasi.length, 1, "Genasi elemental child rows must collapse under the MPMM parent");
assert.equal(groupedGenasi[0].speciesVariantChoice.options.length, 4, "Genasi parent must expose four elemental lineages");
const water = groupedGenasi[0].speciesVariantChoice.options.find((option) => option.value === "Water");
assert.ok(water.metadata.facts.some((fact) => /swimming equal to walking speed/i.test(fact.value)), "Water Genasi movement summary must not degrade to NaN");
const genasiGroups = buildSpeciesSourceChoiceGroups({ species: groupedGenasi[0], level: 1, spells: [] });
assert.equal(genasiGroups[0].label, "Elemental Lineage", "Genasi lineage selector must be a source-owned Species choice");
assert.equal(genasiGroups[0].fields[0].options.length, 4, "Genasi selector must retain four source-backed options");
const selectedWater = selectVariant(groupedGenasi[0], genasiGroups, "Water");
const waterPresentation = projectSelectedSpeciesVariant(groupedGenasi[0], genasiGroups, selectedWater.selections);
assert.equal(waterPresentation.id, groupedGenasi[0].id, "selected Genasi lineage must not replace the persisted parent Species identity");
assert.deepEqual(waterPresentation.speed, { walk: 30, swim: true }, "Water Genasi selected presentation must publish swimming movement");
assert.ok(waterPresentation.traitDetails.some((entry) => entry.name === "Amphibious"), "Water Genasi selected presentation must publish child traits");
assert.ok(!waterPresentation.traitDetails.some((entry) => entry.name === "Unending Breath"), "Water Genasi selected presentation must not leak another lineage's traits");

const dragonbornRows = [
  {
    id: "dragonborn-xphb", name: "Dragonborn", source: "XPHB", speed: 30, darkvision: 60, creatureTypes: ["Humanoid"], size: ["M"],
    metadata: { speed: 30, traits: [{ name: "Draconic Ancestry", type: "entries", entries: [{ type: "table", caption: "Draconic Ancestors", colLabels: ["Dragon", "Damage Type"], rows: [["Black", "Acid"], ["Blue", "Lightning"], ["Brass", "Fire"], ["Bronze", "Lightning"], ["Copper", "Acid"], ["Gold", "Fire"], ["Green", "Poison"], ["Red", "Fire"], ["Silver", "Cold"], ["White", "Cold"]] }] }] },
    traitDetails: [{ name: "Draconic Ancestry", description: "Choose your draconic ancestor.", structuredChoice: true }, { name: "Breath Weapon", description: "Replace one attack with an elemental exhalation." }, { name: "Damage Resistance", description: "You resist your ancestry's damage type." }, { name: "Darkvision", description: "See in darkness." }, { name: "Draconic Flight", description: "At level 5, manifest spectral wings." }],
  },
  { id: "dragonborn-chromatic", name: "Dragonborn (Chromatic)", source: "FTD", metadata: { traits: [] }, traitDetails: [] },
  {
    id: "dragonborn-gem", name: "Dragonborn (Gem)", source: "FTD", speed: 30, darkvision: null, creatureTypes: ["Humanoid"], size: ["M"],
    metadata: { speed: 30, traits: [{ name: "Gem Ancestry", type: "entries", entries: [{ type: "table", caption: "Gem Ancestry", colLabels: ["Dragon", "Damage Type"], rows: [["Amethyst", "Force"], ["Crystal", "Radiant"], ["Emerald", "Psychic"], ["Sapphire", "Thunder"], ["Topaz", "Necrotic"]] }] }] },
    traitDetails: [{ name: "Gem Ancestry", description: "Choose your gem ancestry." }, { name: "Breath Weapon", description: "Exhale destructive gem energy." }, { name: "Draconic Resistance", description: "You resist your ancestry's damage type." }, { name: "Psionic Mind", description: "Telepathic communication." }, { name: "Gem Flight", description: "Manifest spectral wings temporarily." }],
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
const selectedGem = selectVariant(groupedDragonborn[0], dragonbornGroups, "Amethyst (Gem)");
const gemPresentation = projectSelectedSpeciesVariant(groupedDragonborn[0], dragonbornGroups, selectedGem.selections);
assert.equal(gemPresentation.id, groupedDragonborn[0].id, "Gem ancestry presentation must not replace the persisted XPHB parent Species identity");
assert.ok(gemPresentation.traitDetails.some((entry) => entry.name === "Psionic Mind"), "Gem selection must publish FTD Gem-specific traits");
assert.ok(gemPresentation.traitDetails.some((entry) => entry.name === "Gem Flight"), "Gem selection must publish FTD Gem Flight");
assert.ok(gemPresentation.traitDetails.some((entry) => entry.name === "Draconic Resistance"), "Gem selection must publish the FTD resistance rule");
assert.ok(!gemPresentation.traitDetails.some((entry) => entry.name === "Damage Resistance"), "Gem selection must not leave the XPHB Damage Resistance card in the projected panel");
assert.ok(!gemPresentation.traitDetails.some((entry) => entry.name === "Draconic Flight"), "Gem selection must not leave the XPHB Draconic Flight card in the projected panel");
assert.equal(gemPresentation.darkvision, null, "Gem selection must not inherit XPHB Darkvision when the FTD family does not provide it");
const selectedStandard = selectVariant(groupedDragonborn[0], dragonbornGroups, "Black");
assert.equal(projectSelectedSpeciesVariant(groupedDragonborn[0], dragonbornGroups, selectedStandard.selections), groupedDragonborn[0], "standard XPHB ancestry selection must retain the ordinary XPHB parent presentation object");

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

const structuredBackground = backgroundFeatureDetails({
  name: "Table Test",
  source: "TEST",
  rawPayload: { entries: [{
    type: "entries", name: "Feature: Structured Benefit", data: { isFeature: true }, entries: [
      "Choose a benefit from the table below.",
      { type: "table", caption: "Benefits", colLabels: ["Option", "Benefit"], rows: [["A", "First benefit"], ["B", "Second benefit"]] },
    ],
  }] },
});
assert.ok(structuredBackground.some((feature) => feature.structuredSource && /Option: A/.test(feature.description) && /Benefit: Second benefit/.test(feature.description)), "mechanical background tables must survive as organized rule rows");
const optionalBackground = backgroundFeatureDetails({
  name: "Optional Table Test",
  source: "TEST",
  rawPayload: { entries: [{
    type: "entries", name: "Feature: Optional Contact", data: { isFeature: true }, entries: [
      "You gain a useful contact.",
      "Roll on the Contact table to determine who you met, or choose with your GM.",
      { type: "table", caption: "Contact", colLabels: ["d4", "Contact"], rows: [["1", "A merchant"], ["2", "A sailor"]] },
    ],
  }] },
});
const optionalContact = optionalBackground.find((feature) => /Optional Contact/i.test(feature.name));
assert.ok(optionalContact && !/A merchant|A sailor/.test(optionalContact.description), "optional/random background tables must stay out of mechanical Forge prose");

for (const source of [variantSource, speciesChoicesSource, speciesPresentationSource, playerFacingSource, backgroundSource, embeddedSource, structuredRenderer, classTextSource, classModelSource, classGuideSource, contextPanelSource, importerSource, migration]) {
  assert.ok(!protectedPattern.test(source), "Forge source-presentation work crossed a protected map/travel boundary");
}

console.log("Forge source presentation validated: compact persistent Species choices, selected Genasi/Gem projection, cleaned player-facing source tags, Background rule rows, expanded Class source-node coverage, subrace import support, and protected boundaries are intact.");
