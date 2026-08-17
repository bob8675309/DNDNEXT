import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const { backgroundFeatPresentation, backgroundFeatRouteNote, featSectionsAreChoiceOptions } = await import(pathToFileURL(path.join(root, "utils/backgroundFeatPresentation.js")).href);
const { routeFeatSourceChoiceGroups } = await import(pathToFileURL(path.join(root, "utils/playerForgeFeatChoiceRouting.js")).href);

const spell = (name, level, classes = ["Wizard"]) => ({ id: `${name}|XPHB`, spell_key: `${name}|XPHB`, name, source: "XPHB", level, classes, description: `${name} rules.` });
const spells = [
  spell("Fire Bolt", 0), spell("Mage Hand", 0),
  ...["Dissonant Whispers", "False Life", "Hex", "Ray of Sickness", "Color Spray", "Disguise Self", "Feather Fall", "Longstrider", "Comprehend Languages", "Detect Evil and Good", "Protection from Evil and Good", "Shield"].map((name) => spell(name, 1)),
];

const highSorcery = routeFeatSourceChoiceGroups({
  groups: [{ id: "feat-background-feat", label: "Initiate of High Sorcery", source: "DSotDQ", placement: "background", fields: [{ id: "spell-1-1", kind: "spell", count: 1, required: true, options: [spell("Fire Bolt", 0)] }], metadata: { featName: "Initiate of High Sorcery" } }],
  spells,
  finalAbilities: { int: 14, wis: 12, cha: 16 },
})[0];
assert.ok(highSorcery, "Initiate of High Sorcery must remain routable");
assert.equal(highSorcery.placement, "spells", "Initiate of High Sorcery spell decisions belong on Spells, not Background");
assert.equal(highSorcery.resolverPlacement, "spells");
assert.equal(highSorcery.fields.find((field) => field.id === "moon")?.options?.length, 3, "High Sorcery must expose Nuitari, Lunitari, and Solinari as one moon choice");
assert.equal(highSorcery.fields.find((field) => field.id === "wizard-cantrip")?.count, 1, "High Sorcery grants one Wizard cantrip");
for (const moon of ["nuitari", "lunitari", "solinari"]) assert.equal(highSorcery.fields.find((field) => field.id === `moon-spells-${moon}`)?.count, 2, `${moon} must grant two level 1 spell choices`);
assert.ok(!highSorcery.fields.some((field) => /^spell-\d+-\d+$/.test(field.id)), "generic orphaned High Sorcery spell dropdowns must be replaced");
assert.equal(highSorcery.fields.find((field) => field.id === "spellcasting-ability")?.autoSelect, true, "High Sorcery flexible casting ability should follow Forge automatic-casting convention");

const strike = routeFeatSourceChoiceGroups({ groups: [{ id: "feat-strike", label: "Strike of the Giants", source: "BGG", placement: "background", fields: [], metadata: { featName: "Strike of the Giants" } }] })[0];
const strikeField = strike?.fields?.find((field) => field.id === "giant-strike");
assert.equal(strike?.placement, "background");
assert.equal(strikeField?.options?.length, 6, "Strike of the Giants must remain one persisted six-option choice");
for (const label of ["Cloud Strike", "Fire Strike", "Frost Strike", "Hill Strike", "Stone Strike", "Storm Strike"]) assert.ok(strikeField.options.some((option) => option.label === label), `missing ${label}`);

const scion = routeFeatSourceChoiceGroups({
  groups: [{ id: "feat-scion", label: "Scion of the Outer Planes", source: "SatO", placement: "background", fields: [], metadata: { featName: "Scion of the Outer Planes" } }],
  finalAbilities: { int: 10, wis: 15, cha: 13 },
})[0];
const planeField = scion?.fields?.find((field) => field.id === "outer-plane");
assert.equal(planeField?.options?.length, 5, "Scion of the Outer Planes must keep five source plane packages together");
assert.ok(planeField.options.every((option) => option.metadata?.resistance && option.metadata?.cantrip), "each plane choice must keep resistance and cantrip together");
assert.equal(scion.fields.find((field) => field.id === "spellcasting-ability")?.autoSelect, true);

const rune = backgroundFeatPresentation({
  name: "Rune Shaper",
  source: "BGG",
  raw_payload: { entries: [
    "You've studied the magic of Giant runes.",
    { type: "list", items: [
      { type: "item", name: "Comprehend Languages", entries: ["You learn the comprehend languages spell."] },
      { type: "item", name: "Rune Magic", entries: ["You know a number of runes.", { type: "table", colLabels: ["Rune", "Spell"], rows: [["Cloud", "Fog Cloud"], ["Fire", "Burning Hands"]] }] },
    ] },
  ] },
});
assert.equal(rune.sections.length, 2, "Rune Shaper source structure must stay available to presentation helpers");
assert.equal(rune.sections.find((section) => section.title === "Rune Magic")?.tables?.[0]?.title, "Rune Spells", "Rune spell mapping must remain structurally recoverable");
assert.ok(backgroundFeatRouteNote({ name: "Skilled" }).includes("Training → Skills & Proficiencies"), "Skilled route note must remain player-facing");
assert.ok(backgroundFeatRouteNote({ name: "Initiate of High Sorcery" }).includes("Spells step"));
assert.equal(featSectionsAreChoiceOptions("Strike of the Giants"), true);
assert.equal(featSectionsAreChoiceOptions("Scion of the Outer Planes"), true);

const wrapper = read("components/NpcForgeContextPanel.js");
assert.ok(wrapper.includes("NpcForgeContextPanelRefined"), "Background must render through the established refined context panel");
assert.ok(wrapper.includes("projectedBackgroundMechanics"), "Background mechanics projection must remain intact after visual rollback");
assert.ok(!wrapper.includes("NpcForgeBackgroundGuide"), "the rejected Class-style Background dossier must not be active");
assert.ok(!wrapper.includes("props?.playerMode && activeBackground"), "player Backgrounds must not bypass the established refined context panel");

for (const source of [read("utils/backgroundFeatPresentation.js"), read("utils/playerForgeFeatChoiceRouting.js"), wrapper]) {
  assert.doesNotMatch(source, /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/, "Background rollback crossed protected map/travel boundaries");
}

console.log("Background rollback validated: the established refined Background presentation is restored while High Sorcery, Giant Strike, planar package, Rune structure, and source-choice routing fixes remain intact; protected map/travel boundaries remain untouched.");
