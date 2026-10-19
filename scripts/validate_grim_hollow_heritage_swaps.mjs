import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const { buildSpeciesSourceChoiceGroups } = await import(pathToFileURL(path.join(root, "utils/playerForgeSpeciesChoices.js")).href);
const {
  applySourceChoiceDefaults,
  setSourceChoiceSelection,
  sourceChoiceGroupComplete,
} = await import(pathToFileURL(path.join(root, "utils/playerForgeSourceChoices.js")).href);

const key = (name) => `heritage-trait:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}|GRIMHOLLOWPG24`;
const trait = (name, category, repeatLimit = 1) => ({
  key: key(name),
  name,
  category,
  description: `${name} source rule.`,
  improvedName: repeatLimit > 1 ? `Improved ${name}` : null,
  repeatLimit,
});

const catalog = [
  trait("Draining Attack", "C"),
  trait("Natural Attack", "C"),
  trait("Well Protected", "C"),
  trait("Climber", "E"),
  trait("Darkvision", "E"),
  trait("Eager Deceiver", "R"),
  trait("Magical Savvy", "R", 2),
  trait("Keen Survivor", "R"),
  trait("Centered", "C"),
];

const traditional = [
  "Draining Attack",
  "Natural Attack",
  "Well Protected",
  "Climber",
  "Darkvision",
  "Eager Deceiver",
  "Magical Savvy",
  "Magical Savvy",
].map((name) => {
  const resolved = catalog.find((entry) => entry.name === name);
  return { key: resolved.key, name: resolved.name, category: resolved.category };
});

const species = {
  id: "species:dhampir-grim-hollow|GRIMHOLLOWPG24",
  name: "Dhampir (Grim Hollow)",
  source: "GrimHollowPG24",
  metadata: {
    heritageOnly: true,
    heritagePickCount: 8,
    heritageTraitCatalog: catalog,
    traditionalHeritageSelections: traditional,
    traits: [{ name: "Heritage Traits", entries: ["Choose eight Heritage Traits."] }],
  },
};

const groups = buildSpeciesSourceChoiceGroups({ species });
const heritage = groups.find((group) => group.metadata?.heritageTraitGroup);
assert.ok(heritage, "Grim Hollow Species must expose the Heritage Trait source-choice group");
assert.equal(heritage.fields.length, 8, "Grim Hollow Species must keep eight Heritage slots");

heritage.fields.forEach((field, index) => {
  assert.equal(field.metadata?.defaultOptionKey, traditional[index].key, `Heritage slot ${index + 1} lost its source-traditional default`);
  assert.equal(field.metadata?.traditionalName, traditional[index].name, `Heritage slot ${index + 1} lost its traditional label`);
});

const seeded = applySourceChoiceDefaults(groups, {});
const seededKeys = heritage.fields.map((field) => seeded?.[heritage.id]?.[field.id]?.[0] || "");
assert.deepEqual(seededKeys, traditional.map((entry) => entry.key), "Traditional Heritage package must preselect in source order");
assert.equal(sourceChoiceGroupComplete(heritage, seeded), true, "Traditional Heritage package must start complete");
assert.equal(seededKeys.filter((entry) => entry === key("Magical Savvy")).length, 2, "Source-supported repeated traditional traits must remain repeated");

const swapped = setSourceChoiceSelection(groups, seeded, heritage.id, heritage.fields[1].id, [key("Centered")]);
assert.equal(swapped[heritage.id][heritage.fields[1].id][0], key("Centered"), "A filled traditional slot must be replaceable directly");
assert.equal(sourceChoiceGroupComplete(heritage, swapped), true, "A legal Heritage swap must keep the eight-pick group complete");
assert.equal(
  heritage.fields.map((field) => swapped?.[heritage.id]?.[field.id]?.[0]).filter((entry) => entry === key("Centered")).length,
  1,
  "Replacement trait must occupy only the targeted Heritage slot"
);

const illegalDuplicate = setSourceChoiceSelection(groups, seeded, heritage.id, heritage.fields[1].id, [key("Draining Attack")]);
assert.deepEqual(illegalDuplicate[heritage.id][heritage.fields[1].id], [], "Repeat-limit authority must reject an illegal swap into a capped trait");
assert.equal(sourceChoiceGroupComplete(heritage, illegalDuplicate), false, "An illegal capped replacement must not silently count as complete");

const explicitlyCleared = {
  ...seeded,
  [heritage.id]: {
    ...seeded[heritage.id],
    [heritage.fields[0].id]: [],
  },
};
const reseeded = applySourceChoiceDefaults(groups, explicitlyCleared);
assert.deepEqual(reseeded[heritage.id][heritage.fields[0].id], [], "An explicitly cleared Heritage slot must not be auto-restored on a later render");

const accursed = {
  id: "species:accursed|GRIMHOLLOWPG24",
  name: "Accursed",
  source: "GrimHollowPG24",
  metadata: {
    heritageOnly: true,
    heritagePickCount: 8,
    heritageTraitCatalog: catalog,
    traditionalHeritageSelections: [],
    traits: [{ name: "Heritage Traits", entries: ["Choose eight Heritage Traits."] }],
  },
};
const accursedGroups = buildSpeciesSourceChoiceGroups({ species: accursed });
const accursedHeritage = accursedGroups.find((group) => group.metadata?.heritageTraitGroup);
const accursedSeeded = applySourceChoiceDefaults(accursedGroups, {});
assert.ok(accursedHeritage, "Accursed must still expose the Heritage Trait picker");
assert.ok(accursedHeritage.fields.every((field) => !field.metadata?.defaultOptionKey), "Accursed must not invent traditional defaults");
assert.ok(accursedHeritage.fields.every((field) => (accursedSeeded?.[accursedHeritage.id]?.[field.id] || []).length === 0), "Accursed must remain an empty eight-pick build");

const picker = read("components/NpcForgeHeritageTraitPicker.js");
for (const token of [
  "NpcForgeHeritageTraitPicker",
  "selectedOptions",
  "removeTrait",
  "addTrait",
  "Reset to traditional traits",
  "same catalogue used by Custom Lineage",
  "All eight Heritage picks are filled. Remove one selected pick above",
]) assert.ok(picker.includes(token), `Shared Custom Lineage-style Heritage picker is missing ${token}`);
for (const forbidden of ["replaceFieldId", "Replace Trait", "selected-swap", "is-replacing"]) {
  assert.ok(!picker.includes(forbidden), `Grim Hollow Heritage swapping must not fork into a separate swap UI: ${forbidden}`);
}

const sourceContext = read("components/NpcForgeSourceChoiceContext.js");
assert.ok(sourceContext.includes("applySourceChoiceDefaults"), "Forge source-choice state must seed source-owned defaults before normalization");

const speciesChoices = read("utils/playerForgeSpeciesChoices.js");
for (const token of [
  "defaultOptionKey",
  "traditionalName",
  "source-traditional Heritage Traits are selected by default",
]) assert.ok(speciesChoices.includes(token), `Grim Hollow Species default builder is missing ${token}`);

const protectedText = [picker, sourceContext, speciesChoices].join("\n").toLowerCase();
for (const token of ["mappageclient", "map_routes", "advance_all_characters", "route_segment_progress", "world_state"]) {
  assert.ok(!protectedText.includes(token), `Heritage swap work crossed protected map/travel boundary: ${token}`);
}

console.log("Grim Hollow Heritage swaps validated: source-traditional eight-pick defaults, the same remove/select picker flow used by Custom Lineage, repeat-limit authority, explicit-clear persistence, Accursed no-default behavior, and protected boundaries all pass.");
