import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const { buildBackgroundSourceChoiceGroups } = await import(pathToFileURL(path.join(root, "utils/playerForgeSourceChoices.js")).href);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const toolRows = [
  ["Smith's Tools", "smith-tools|XPHB", "AT"],
  ["Lute", "lute|XPHB", "INS"],
  ["Dice Set", "dice-set|XPHB", "GS"],
  ["Thieves' Tools", "thieves-tools|XPHB", "T"],
  ["Navigator's Tools", "navigators-tools|XPHB", "T"],
  ["Disguise Kit", "disguise-kit|XPHB", "T"],
  ["Vehicles (Land)", "vehicles-land|XPHB", "VEH"],
].map(([name, key, type]) => ({ item_name: name, item_key: key, item_type: "tool", payload: { name, source: "XPHB", type } }));

const background = (name, source, metadata) => ({ id: `${name}|${source}`, name, source, metadata });
const groupsFor = (name, source, metadata) => buildBackgroundSourceChoiceGroups(background(name, source, metadata), toolRows);
const fieldsOfKind = (groups, kind) => groups.flatMap((group) => group.fields || []).filter((field) => field.kind === kind);

const runeCarver = groupsFor("Rune Carver", "BGG", { languages: [{ giant: true }] });
const runeLanguage = fieldsOfKind(runeCarver, "language");
assert.equal(runeLanguage.length, 1, "Rune Carver must publish its fixed Giant language");
assert.equal(runeLanguage[0].autoSelect, true, "fixed Background languages must be automatic rather than false creator choices");
assert.deepEqual(runeLanguage[0].options.map((option) => option.label), ["Giant"]);

const giantFoundling = groupsFor("Giant Foundling", "BGG", { languages: [{ giant: true, anyStandard: 1 }] });
const giantLanguageFields = fieldsOfKind(giantFoundling, "language");
assert.equal(giantLanguageFields.length, 2, "Giant Foundling must retain fixed Giant plus one Standard-language choice");
assert.ok(giantLanguageFields.some((field) => field.autoSelect && field.options.some((option) => option.label === "Giant")), "Giant must remain fixed");
const giantStandard = giantLanguageFields.find((field) => !field.autoSelect);
assert.equal(giantStandard.count, 1);
assert.ok(!giantStandard.options.some((option) => option.label === "Giant"), "the selectable Standard language must not duplicate fixed Giant");

const clanCrafter = groupsFor("Clan Crafter", "SCAG", { languages: [{ dwarvish: true }, { anyStandard: 1 }] });
const clanLanguages = fieldsOfKind(clanCrafter, "language");
assert.ok(clanLanguages.some((field) => field.autoSelect && field.options.some((option) => option.label === "Dwarvish")), "Clan Crafter must publish fixed Dwarvish");

const inheritor = groupsFor("Inheritor", "SCAG", { tools: [{ choose: { from: ["musical instrument", "gaming set"] } }] });
const inheritorTool = fieldsOfKind(inheritor, "tool").find((field) => !field.autoSelect);
assert.ok(inheritorTool, "Inheritor must expose its source tool choice");
assert.deepEqual(new Set(inheritorTool.options.map((option) => option.label)), new Set(["Lute", "Dice Set"]));
assert.equal(inheritorTool.count, 1);

const urbanBountyHunter = groupsFor("Urban Bounty Hunter", "SCAG", { tools: [{ choose: { from: ["gaming set", "musical instrument", "thieves' tools"], count: 2 } }] });
const bountyTool = fieldsOfKind(urbanBountyHunter, "tool").find((field) => !field.autoSelect);
assert.equal(bountyTool.count, 2, "Urban Bounty Hunter must require two source tool choices");
for (const label of ["Dice Set", "Lute", "Thieves' Tools"]) assert.ok(bountyTool.options.some((option) => option.label === label), `Urban Bounty Hunter is missing ${label}`);

const witchlight = groupsFor("Witchlight Hand", "WBtW", { tools: [{ choose: { from: ["disguise kit", "musical instrument"] } }] });
const witchlightTool = fieldsOfKind(witchlight, "tool").find((field) => !field.autoSelect);
for (const label of ["Disguise Kit", "Lute"]) assert.ok(witchlightTool.options.some((option) => option.label === label), `Witchlight Hand is missing ${label}`);

const folkHero = groupsFor("Folk Hero", "PHB", { tools: [{ anyArtisansTool: 1, "vehicles (land)": true }] });
const folkTools = fieldsOfKind(folkHero, "tool");
assert.ok(folkTools.some((field) => field.autoSelect && field.options.some((option) => option.label === "Vehicles (Land)")), "Folk Hero must retain fixed land-vehicle proficiency");
assert.ok(folkTools.some((field) => !field.autoSelect && field.options.some((option) => option.label === "Smith's Tools")), "Folk Hero must retain its Artisan's Tool choice");

const embeddedSource = read("components/NpcForgeEmbeddedSourceChoices.js");
for (const token of ["sourceChoicePrompt", "incompleteFields", "field.autoSelect", 'join(" • ")']) assert.ok(embeddedSource.includes(token), `fixed + unresolved summary handling missing ${token}`);

const contextSource = read("components/NpcForgeContextPanelRefined.js");
for (const token of ["toolHasChoices", "languageHasChoices", "backgroundFeatureTextForDisplay", "Spell Level:", "ExpandedSpellList"]) assert.ok(contextSource.includes(token), `Background presentation correction missing ${token}`);
assert.match(contextSource, /filter\(\(paragraph\) => !\/\^Spell Level:/, "Strixhaven feature copy must remove duplicated structured spell-table rows");

for (const source of [read("utils/playerForgeSourceChoices.js"), embeddedSource, contextSource]) {
  assert.doesNotMatch(source, /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/, "Background work crossed protected map/travel boundaries");
}

console.log("Background source-choice polish validated: fixed languages/tools remain automatic, choose.from tool rules use canonical source-choice state, mixed grants stay visible, Strixhaven spell tables are not duplicated, and protected map/travel boundaries remain untouched.");
