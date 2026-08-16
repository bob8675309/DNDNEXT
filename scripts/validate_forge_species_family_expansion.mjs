import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const protectedPattern = /MapPageClient|advance_all_characters|route_segment_progress/;

const expansionSource = read("utils/speciesCatalogExpansion.js");
const catalogSource = read("utils/npcForgeCatalog.js");
const familySource = read("utils/speciesCatalogFamilyMenu.js");
const coreSource = read("components/NpcForgeCoreSupport.js");
const panelSource = read("components/NpcForgeContextPanel.js");
const migrationSource = read("sql/20260812_93_aven_subrace_catalog.sql");

for (const token of ["elf-lineage", "gnome-lineage", "shifter-subtype", "faerie-lineage", "kithkin-lineage", "aven-subrace", "catalogSourceVariants", "catalogHidden"]) assert.ok(expansionSource.includes(token) || catalogSource.includes(token), `expanded Species family model missing ${token}`);
for (const token of ["Human (Innistrad)", "Human (Ixalan)", "Human (Kaladesh)", "Human (Zendikar)", "Dwarf (Kaladesh)", "Elf (Kaladesh)", "Elf (Zendikar)", "Orc (Ixalan)", "Minotaur (Amonkhet)", "Goblin (Dankwood)"]) assert.ok(expansionSource.includes(token), `setting Species nesting missing ${token}`);
for (const token of ["filterCatalogSpeciesFamilyFields", "catalogSpeciesFamilyChoice", "selectedDescription", "applyCatalogPresentation"]) assert.ok(familySource.includes(token), `catalogue family projection missing ${token}`);
for (const token of ["SpeciesCatalogSourceVariants", "catalogHidden", "onSelect?.(variant)", "selectedSourceVariant", "catalogMergeSourceVariants", "selectCatalogFamilyOption"]) assert.ok(coreSource.includes(token), `real setting-variant catalogue nesting missing ${token}`);
assert.ok(panelSource.includes("filterCatalogSpeciesFamilyFields"), "right panel must filter only the promoted family field while retaining sibling source choices");
for (const token of ["species:aven-hawk-headed|PSA", "species:aven-ibis-headed|PSA", "Hawkeyed", "Kefnet''s Blessing", "does not already include your proficiency bonus", "sourceAudit"]) assert.ok(migrationSource.includes(token), `Aven source restoration migration missing ${token}`);

const { mergePreferredSpecies } = await import(pathToFileURL(path.join(root, "utils/npcForgeCatalog.js")).href);
const { buildSpeciesSourceChoiceGroups } = await import(pathToFileURL(path.join(root, "utils/playerForgeSpeciesChoices.js")).href);
const { projectSelectedSpeciesVariant } = await import(pathToFileURL(path.join(root, "utils/speciesVariantFamilies.js")).href);
const {
  filterCatalogSpeciesFamilyFields,
  projectCatalogSpeciesFamilySelection,
  speciesVariantChoiceBinding,
  speciesVariantUsesCatalogSubmenu,
} = await import(pathToFileURL(path.join(root, "utils/speciesCatalogFamilyMenu.js")).href);

const speciesRow = ({ id, name, source, traits = [], speed = 30, darkvision = null, size = ["M"], lore = "Source lore." }) => ({
  id, option_type: "species", name, source, description: traits.map((trait) => trait.name).join(". "),
  metadata: { traits, speed, darkvision, size, lore }, raw_payload: {},
});
const listTrait = (name, items) => ({ name, type: "entries", entries: [{ type: "list", style: "list-hang-notitle", items: items.map(([label, description]) => ({ type: "item", name: label, entries: [description] })) }] });
const tableTrait = (name, columns, rows) => ({ name, type: "entries", entries: [{ type: "table", caption: name, colLabels: columns, rows }] });

const elfRows = [speciesRow({
  id: "elf-xphb", name: "Elf", source: "XPHB", darkvision: 60,
  traits: [
    { name: "Darkvision", type: "entries", entries: ["Darkvision 60 feet."] },
    tableTrait("Elven Lineage", ["Lineage", "Level 1", "Level 3", "Level 5"], [
      ["Drow", "Darkvision becomes 120 feet; Dancing Lights.", "Faerie Fire", "Darkness"],
      ["High Elf", "Prestidigitation.", "Detect Magic", "Misty Step"],
      ["Wood Elf", "Speed becomes 35 feet; Druidcraft.", "Longstrider", "Pass without Trace"],
    ]),
    { name: "Fey Ancestry", type: "entries", entries: ["Advantage against Charmed."] },
  ],
}),
speciesRow({ id: "elf-kaladesh", name: "Elf (Kaladesh)", source: "PSK", traits: [{ name: "Fleet of Foot", type: "entries", entries: ["Setting rule."] }] }),
speciesRow({ id: "elf-zendikar", name: "Elf (Zendikar)", source: "PSZ", traits: [{ name: "Setting Heritage", type: "entries", entries: ["Zendikar rule."] }] })];
const elfCatalog = mergePreferredSpecies(elfRows);
const elf = elfCatalog.find((row) => row.id === "elf-xphb");
assert.equal(speciesVariantUsesCatalogSubmenu(elf), true, "2024 Elf must use the catalogue lineage submenu");
assert.deepEqual(elf.catalogSourceVariants.map((row) => row.id), ["elf-kaladesh"], "Kaladesh Elf must nest in the parent lineage list");
assert.equal(elf.catalogMergeSourceVariants, true, "Kaladesh Elf must share the main Elven Lineage submenu");
assert.equal(elfCatalog.find((row) => row.id === "elf-zendikar")?.catalogExcluded, true, "Zendikar Elf must stay hidden from the Forge without deleting its canonical source row");
assert.equal(elfCatalog.find((row) => row.id === "elf-kaladesh")?.catalogHidden, true, "setting child must remain in the internal catalogue but be hidden at top level");
assert.equal(elfCatalog.find((row) => row.id === "elf-kaladesh")?.source, "PSK", "setting child must keep its real source authority");
const elfGroups = buildSpeciesSourceChoiceGroups({ species: elf, level: 1, spells: [] });
const elfBinding = speciesVariantChoiceBinding(elf, elfGroups, {});
assert.ok(elfBinding, "Elf catalogue lineage must bind to the existing Elven Lineage source field");
assert.equal(elfBinding.field.id, "lineage", "Elf lineage field key must remain stable");
const filteredElfGroups = filterCatalogSpeciesFamilyFields(elfGroups, elf);
assert.ok(filteredElfGroups.some((group) => group.fields.some((field) => field.id === "spellcasting-ability")), "promoting Elf lineage must retain the sibling spellcasting-ability source choice");
assert.ok(!filteredElfGroups.some((group) => group.fields.some((field) => field.id === "lineage")), "promoted Elf lineage field must not be duplicated on the right");
const drow = elfBinding.field.options.find((option) => option.key === "drow");
const drowSelections = { [elfBinding.group.id]: { [elfBinding.field.id]: [drow.key] } };
const projectedDrow = projectCatalogSpeciesFamilySelection(projectSelectedSpeciesVariant(elf, elfGroups, drowSelections), elf, elfGroups, drowSelections);
assert.equal(projectedDrow.name, "Drow", "Drow lineage must change the right-side display identity");
assert.equal(projectedDrow.darkvision, 120, "Drow lineage must project its 120-foot Darkvision");
assert.match(projectedDrow.traitDetails.find((entry) => entry.name === "Elven Lineage")?.description || "", /Level 1.*Level 3.*Level 5/i, "selected Elf lineage summary must preserve its tiered source benefits");

const gnome = mergePreferredSpecies([speciesRow({ id: "gnome-xphb", name: "Gnome", source: "XPHB", darkvision: 60, size: ["S"], traits: [listTrait("Gnomish Lineage", [["Forest Gnome", "Minor Illusion and Speak with Animals."], ["Rock Gnome", "Mending, Prestidigitation, and a clockwork device."]])] })])[0];
const gnomeGroups = buildSpeciesSourceChoiceGroups({ species: gnome, level: 1, spells: [] });
assert.equal(speciesVariantUsesCatalogSubmenu(gnome), true, "Gnome must use a catalogue lineage submenu");
assert.equal(speciesVariantChoiceBinding(gnome, gnomeGroups, {})?.field?.id, "lineage", "Gnome must reuse its existing lineage field");

const shifter = mergePreferredSpecies([speciesRow({ id: "shifter-mpmm", name: "Shifter", source: "MPMM", darkvision: 60, traits: [listTrait("Shifting", [["Beasthide", "Extra temporary hit points and AC."], ["Longtooth", "Fanged unarmed strike."], ["Swiftstride", "Faster movement while shifted."], ["Wildhunt", "Wisdom-check and anti-advantage benefit."]])] })])[0];
const shifterGroups = buildSpeciesSourceChoiceGroups({ species: shifter, level: 1, spells: [] });
assert.equal(speciesVariantUsesCatalogSubmenu(shifter), true, "Shifter must use a catalogue subtype submenu");
assert.equal(speciesVariantChoiceBinding(shifter, shifterGroups, {})?.field?.id, "shifting", "Shifter must reuse the existing Shifting field rather than create duplicate state");

for (const [name, traitName, expectedId] of [["Fairy", "Faerie Lineage", "faerie-lineage"], ["Kithkin", "Kithkin Lineage", "kithkin-lineage"]]) {
  const family = mergePreferredSpecies([speciesRow({ id: `${name.toLowerCase()}-lfl`, name, source: "LFL", darkvision: name === "Kithkin" ? 120 : null, size: ["S"], traits: [listTrait(traitName, [["Lorwyn", "No additional traits."], ["Shadowmoor", "Darkvision 120 feet."]])] })])[0];
  assert.equal(family.speciesVariantChoice?.id, expectedId, `${name} must activate one standalone source-choice family because the legacy parser has no dedicated ${traitName} field`);
  const groups = buildSpeciesSourceChoiceGroups({ species: family, level: 1, spells: [] });
  const binding = speciesVariantChoiceBinding(family, groups, {});
  assert.ok(binding, `${name} family submenu must bind to source-choice state`);
  assert.equal(groups.filter((group) => group.metadata?.family === expectedId).length, 1, `${name} must create exactly one standalone family source group`);
  const parentProjection = projectCatalogSpeciesFamilySelection(projectSelectedSpeciesVariant(family, groups, {}), family, groups, {});
  assert.equal(parentProjection.darkvision, null, `${name} parent presentation must not preselect Shadowmoor Darkvision`);
  const shadow = binding.field.options.find((option) => option.key === "shadowmoor");
  const selections = { [binding.group.id]: { [binding.field.id]: [shadow.key] } };
  const projected = projectCatalogSpeciesFamilySelection(projectSelectedSpeciesVariant(family, groups, selections), family, groups, selections);
  assert.equal(projected.darkvision, 120, `${name} Shadowmoor selection must project 120-foot Darkvision`);
}

const avenRows = [
  speciesRow({ id: "aven-parent", name: "Aven", source: "PSA", speed: { walk: 25, fly: 30 }, traits: [{ name: "Flight", type: "entries", entries: ["Fly 30 feet."] }] }),
  speciesRow({ id: "aven-hawk", name: "Aven (Hawk-Headed)", source: "PSA", speed: { walk: 25, fly: 30 }, traits: [{ name: "Flight", type: "entries", entries: ["Fly 30 feet."] }, { name: "Hawkeyed", type: "entries", entries: ["Perception and long-range benefit."] }] }),
  speciesRow({ id: "aven-ibis", name: "Aven (Ibis-Headed)", source: "PSA", speed: { walk: 25, fly: 30 }, traits: [{ name: "Flight", type: "entries", entries: ["Fly 30 feet."] }, { name: "Kefnet's Blessing", type: "entries", entries: ["Half proficiency on eligible Intelligence checks."] }] }),
];
const avenCatalog = mergePreferredSpecies(avenRows);
assert.equal(avenCatalog.length, 1, "Aven source-derived subraces must collapse into one catalogue parent family");
const aven = avenCatalog[0];
assert.equal(aven.speciesVariantChoice?.id, "aven-subrace", "Aven must use one persisted parent plus source-backed subrace choice");
const avenGroups = buildSpeciesSourceChoiceGroups({ species: aven, level: 1, spells: [] });
assert.deepEqual(speciesVariantChoiceBinding(aven, avenGroups, {})?.field?.options?.map((option) => option.key), ["hawk-headed", "ibis-headed"], "Aven must expose Hawk-Headed and Ibis-Headed child choices");

const settingRows = mergePreferredSpecies([
  speciesRow({ id: "human", name: "Human", source: "XPHB" }),
  speciesRow({ id: "human-innistrad", name: "Human (Innistrad)", source: "PSI" }),
  speciesRow({ id: "human-ixalan", name: "Human (Ixalan)", source: "PSX" }),
  speciesRow({ id: "human-kaladesh", name: "Human (Kaladesh)", source: "PSK" }),
  speciesRow({ id: "human-zendikar", name: "Human (Zendikar)", source: "PSZ" }),
]);
const human = settingRows.find((row) => row.id === "human");
assert.equal(human.catalogSourceVariants.length, 4, "Human must nest all four retained setting variants");
assert.ok(human.catalogSourceVariants.every((row) => row.catalogHidden && row.id !== human.id), "setting children must remain independent real Species rows");

const distinctSpecies = mergePreferredSpecies([
  speciesRow({ id: "elf", name: "Elf", source: "XPHB", traits: [tableTrait("Elven Lineage", ["Lineage", "Level 1"], [["Drow", "Drow benefit"], ["High Elf", "High benefit"], ["Wood Elf", "Wood benefit"]])] }),
  speciesRow({ id: "sea-elf", name: "Sea Elf", source: "MPMM" }),
  speciesRow({ id: "astral-elf", name: "Astral Elf", source: "AAG" }),
]);
assert.equal(distinctSpecies.find((row) => row.id === "sea-elf")?.catalogHidden, undefined, "Sea Elf must remain an independent Species");
assert.equal(distinctSpecies.find((row) => row.id === "astral-elf")?.catalogHidden, undefined, "Astral Elf must remain an independent Species");

for (const source of [expansionSource, catalogSource, familySource, coreSource, panelSource, migrationSource]) assert.ok(!protectedPattern.test(source), "Species family expansion crossed a protected map/travel boundary");

console.log("Forge Species family expansion validated: source-backed lineage/subrace families reuse existing choice authority, setting variants nest without losing their real Species identity/source, Aven source rows are restored, distinct species remain independent, and protected boundaries remain intact.");
