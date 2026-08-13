import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const presentation = await import(pathToFileURL(path.join(root, "utils/speciesForgePresentation.js")).href);
const speciesRules = await import(pathToFileURL(path.join(root, "utils/speciesPresentation.js")).href);

const astralElf = {
  name: "Astral Elf",
  source: "AAG",
  creatureTypes: ["humanoid"],
  darkvision: 60,
  traits: ["Creature Type", "Superior Darkvision", "Fey Ancestry"],
  traitDetails: [
    { name: "Creature Type", description: "You are a Humanoid. You are also considered an elf for any prerequisite or effect that requires you to be an elf." },
    { name: "Superior Darkvision", description: "You can see in dim light within 60 feet of yourself as if it were bright light." },
    { name: "Fey Ancestry", description: "You have Advantage on saving throws against being Charmed." },
  ],
};
assert.equal(presentation.speciesCreatureTypeLabel(astralElf), "Humanoid, Elf", "Astral Elf must publish both creature identities in the top fact");
assert.match(presentation.speciesVisionExplanation(astralElf), /dim light appears bright and darkness appears dim/i, "Darkvision hover copy must explain dim and dark light behavior");
assert.equal(presentation.speciesFixedLanguageFact(["Common", "Aven"]), "Aven", "Common must stay implicit when a source grants another fixed language");
assert.match(presentation.speciesFixedLanguageFact(["Aven"]), /Does not know Common/, "fixed-language exceptions must explicitly note when Common is absent");
assert.equal(speciesRules.speciesHasSourceLanguageRule({ metadata: { languages: [] }, traitDetails: [] }), false, "Species without a source language rule must receive the generic Origin-language pair");
assert.equal(speciesRules.speciesHasSourceLanguageRule({ metadata: { languages: [{ common: true, anyStandard: 2 }] }, traitDetails: [{ name: "Languages", description: "Choose two languages." }] }), true, "Species-defined selectable languages must suppress the generic Origin-language pair");
const astralFeatures = presentation.speciesFeaturePresentation(astralElf);
assert.deepEqual(astralFeatures.traits, ["Fey Ancestry"], "promoted Creature Type and Darkvision facts must not remain duplicate feature cards");

const gold = {
  name: "Gold Dragonborn",
  metadata: { selectedCatalogSpeciesFamily: { label: "Gold", damageType: "Fire" } },
  traits: ["Breath Weapon", "Damage Resistance"],
  traitDetails: [
    { name: "Breath Weapon", description: "A creature takes damage of the type determined by your Draconic Ancestry trait." },
    { name: "Damage Resistance", description: "You have Resistance to the damage type determined by your Draconic Ancestry trait." },
  ],
};
const goldFeatures = presentation.speciesFeaturePresentation(gold).details;
assert.match(goldFeatures.find((entry) => entry.name === "Breath Weapon")?.description || "", /gold draconic ancestry[\s\S]*searing fire[\s\S]*Fire damage/i, "Gold Breath Weapon copy must resolve Fire and retain ancestry flavor");
assert.match(goldFeatures.find((entry) => entry.name === "Damage Resistance")?.description || "", /gold draconic ancestry[\s\S]*Resistance to Fire damage/i, "Gold Damage Resistance copy must resolve Fire");

const eladrin = {
  name: "Eladrin",
  source: "MPMM",
  traits: ["Choose your eladrin's season: autumn, winter, spring, or summer.", "Fey Step"],
  traitDetails: [{ name: "Choose your eladrin's season: autumn, winter, spring, or summer.", description: "" }, { name: "Fey Step", description: "Teleport up to 30 feet." }],
};
const eladrinFeatures = presentation.speciesFeaturePresentation(eladrin);
const seasonCards = eladrinFeatures.details.filter((entry) => /eladrin seasons?/i.test(entry.name));
assert.equal(seasonCards.length, 1, "Eladrin season presentation must collapse into one feature card");
for (const token of ["Autumn", "Winter", "Spring", "Summer", "Long Rest", "current season"]) assert.match(seasonCards[0].description, new RegExp(token, "i"), `Eladrin season explanation missing ${token}`);

const contextSource = read("components/NpcForgeContextPanelRefined.js");
const stepSource = read("components/NpcForgeStepContent.js");
const variantSource = read("utils/speciesVariantFamilies.js");
const catalogFamilySource = read("utils/speciesCatalogFamilyMenu.js");
const polishSource = read("styles/character-forge-final-polish.css");
for (const token of [
  "SpeciesChoiceFact",
  "SpeciesStaticFact",
  'group.id === "origin-standard-languages"',
  "Select two Origin languages (besides Common)",
  "speciesCreatureTypeLabel(option)",
  "speciesVisionExplanation(option)",
  "speciesFeaturePresentation(option)",
  'group.metadata?.family === "eladrin-season"',
]) assert.ok(contextSource.includes(token), `Species fact presentation is missing ${token}`);
assert.ok(contextSource.includes("(?<=[.!?])"), "rule paragraph splitting must require preceding punctuation so 'You are a Humanoid' stays intact");
assert.ok(stepSource.includes('group.id !== "origin-standard-languages" || (!fixedLanguages.length && !hasSourceLanguageRule)'), "origin languages must apply only when neither fixed nor selectable source languages exist");
assert.ok(!stepSource.includes('String(selectedSpecies.source || "").toUpperCase() === "XPHB" && !fixedLanguages.length'), "origin language availability must not be limited to XPHB Species");
assert.ok(variantSource.includes("damageType: selectedVariant.metadata?.damageType || null"), "selected variant metadata must project its damage type");
assert.ok(catalogFamilySource.includes("damageType: text(binding.selected.metadata?.damageType) || null"), "catalog family metadata must project its damage type");
for (const token of ["npc-forge-species-fact-choice", "npc-forge-species-fact-tooltip", "grid-column: 1 / -1"]) assert.ok(polishSource.includes(token), `Species fact interaction styling is missing ${token}`);

for (const source of [contextSource, stepSource, variantSource, catalogFamilySource, polishSource]) {
  assert.doesNotMatch(source, /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/, "Species fact work crossed a protected map/travel boundary");
}

console.log("Forge Species fact choices validated: Common remains implicit, origin languages and variable Size reuse canonical source-choice state, promoted facts are not duplicated, Astral Elf creature identity and Darkvision guidance are clear, Dragonborn damage affinity reaches feature copy, Eladrin seasons are combined without changing initial/runtime authority, and map/travel boundaries remain untouched.");
