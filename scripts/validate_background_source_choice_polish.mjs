import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourceChoiceModule = await import(pathToFileURL(path.join(root, "utils/playerForgeSourceChoices.js")).href);
const { buildBackgroundSourceChoiceGroups, selectedSourceChoiceOptions } = sourceChoiceModule;
const { sourceGrantedTradeSkillKeys } = await import(pathToFileURL(path.join(root, "utils/craftingToolProfessions.js")).href);
const { routeFeatSourceChoiceGroups } = await import(pathToFileURL(path.join(root, "utils/playerForgeFeatChoiceRouting.js")).href);
const { backgroundFeatureDetails } = await import(pathToFileURL(path.join(root, "utils/backgroundMechanics.js")).href);
const { normalizeBackgroundOption } = await import(pathToFileURL(path.join(root, "utils/npcForgeCatalogRefined.js")).href);
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
const runeStyleGroup = runeCarver.find((group) => group.label === "Rune Styles");
assert.ok(runeStyleGroup, "Rune Carver must promote Rune Styles to a persisted Background choice");
assert.equal(runeStyleGroup.placement, "background");
assert.equal(runeStyleGroup.fields?.[0]?.kind, "enum");
assert.equal(runeStyleGroup.fields?.[0]?.options?.length, 6, "Rune Styles must expose all six source media/styles");
for (const phrase of ["Wax or clay", "Carved wood", "Glass beads", "Stitched clothing", "Animal bones", "Carved candles"]) assert.ok(runeStyleGroup.fields[0].options.some((option) => option.label === phrase), `Rune Styles is missing ${phrase}`);

const giantFoundling = groupsFor("Giant Foundling", "BGG", { languages: [{ giant: true, anyStandard: 1 }] });
const giantLanguageFields = fieldsOfKind(giantFoundling, "language");
assert.equal(giantLanguageFields.length, 2, "Giant Foundling must retain fixed Giant plus one Standard-language choice");
assert.ok(giantLanguageFields.some((field) => field.autoSelect && field.options.some((option) => option.label === "Giant")), "Giant must remain fixed");
const giantStandard = giantLanguageFields.find((field) => !field.autoSelect);
assert.equal(giantStandard.count, 1);
assert.ok(!giantStandard.options.some((option) => option.label === "Giant"), "the selectable Standard language must not duplicate fixed Giant");

const clanCrafter = groupsFor("Clan Crafter", "SCAG", { languages: [{ dwarvish: true }, { anyStandard: 1 }], tools: [{ anyArtisansTool: 1 }] });
const clanLanguages = fieldsOfKind(clanCrafter, "language");
assert.ok(clanLanguages.some((field) => field.autoSelect && field.options.some((option) => option.label === "Dwarvish")), "Clan Crafter must publish fixed Dwarvish");
const clanCraftGroup = clanCrafter.find((group) => (group.fields || []).some((field) => field.kind === "tool"));
assert.ok(clanCraftGroup, "Clan Crafter must retain its source artisan-tool selection");
assert.equal(clanCraftGroup.metadata?.grantsMappedTradeSkill, true, "Background tool groups must explicitly preserve mapped Trade Skill power");
assert.equal(clanCraftGroup.metadata?.tradeSkillGrantSource, "background-tool");
assert.ok(!clanCraftGroup.metadata?.craftExpertise && clanCraftGroup.metadata?.campaignRule !== "clan-crafter-craft-expertise", "Clan Crafter must not carry the retired Craft Expertise house-rule marker");
assert.match(clanCraftGroup.helper, /also grants that Trade Skill at Proficient rank/i, "Clan Crafter tool guidance must explain the compatibility Trade Skill grant");
assert.match(clanCraftGroup.helper, /never grants Expertise/i, "Clan Crafter tool guidance must explicitly reject automatic Expertise");
const clanToolField = clanCraftGroup.fields.find((field) => field.kind === "tool");
const clanSmithOption = clanToolField.options.find((option) => option.label === "Smith's Tools");
const clanSelectedEntries = selectedSourceChoiceOptions(clanCrafter, { [clanCraftGroup.id]: { [clanToolField.id]: [clanSmithOption.key] } });
assert.deepEqual(sourceGrantedTradeSkillKeys(clanSelectedEntries), ["smithing"], "Clan Crafter Smith's Tools must grant Smithing at the source compatibility layer");

const inheritor = groupsFor("Inheritor", "SCAG", { tools: [{ choose: { from: ["musical instrument", "gaming set"] } }] });
const inheritorTool = fieldsOfKind(inheritor, "tool").find((field) => !field.autoSelect);
assert.ok(inheritorTool, "Inheritor must expose its source tool choice");
assert.deepEqual(new Set(inheritorTool.options.map((option) => option.label)), new Set(["Lute", "Dice Set"]));
assert.equal(inheritorTool.count, 1);
const inheritorGroup = inheritor.find((group) => group.fields?.includes(inheritorTool));
const lute = inheritorTool.options.find((option) => option.label === "Lute");
assert.deepEqual(sourceGrantedTradeSkillKeys(selectedSourceChoiceOptions(inheritor, { [inheritorGroup.id]: { [inheritorTool.id]: [lute.key] } })), [], "Unmapped Background tools must remain tools without inventing a Trade Skill");

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
assert.ok(folkHero.filter((group) => (group.fields || []).some((field) => field.kind === "tool")).every((group) => group.metadata?.grantsMappedTradeSkill === true), "Folk Hero Background tool groups must use the same source compatibility policy");

const charlatan = normalizeBackgroundOption({
  id: "charlatan|XPHB",
  name: "Charlatan",
  source: "XPHB",
  description: "Charlatan.",
  metadata: { lore: "A practiced deceiver." },
  raw_payload: { skillProficiencies: [{ deception: true, "sleight of hand": true }], entries: [] },
});
assert.deepEqual(charlatan.backgroundSkills, ["deception", "sleightOfHand"], "Background skills must use canonical Forge skill keys so Sleight of Hand resolves its description");

const variableSkills = normalizeBackgroundOption({
  id: "variable|TEST",
  name: "Variable Skill Background",
  source: "TEST",
  description: "Variable skills.",
  metadata: { lore: "A test background." },
  raw_payload: { skillProficiencies: [{ choose: { from: ["arcana", "sleight of hand", "animal handling"], count: 2 } }], entries: [] },
});
assert.deepEqual(variableSkills.skillRule.choiceGroups[0].from, ["arcana", "sleightOfHand", "animalHandling"], "Background skill-choice pools must normalize to canonical Forge keys");

const routedProficiencyFeats = routeFeatSourceChoiceGroups({ groups: [
  { id: "skilled", label: "Skilled", placement: "background", fields: [{ id: "profs", kind: "skill", count: 3, required: true, options: [{ key: "a" }, { key: "b" }, { key: "c" }] }], metadata: { featName: "Skilled", acquisitionLabel: "Charlatan" } },
  { id: "crafter", label: "Crafter", placement: "background", fields: [{ id: "tools", kind: "tool", count: 3, required: true, options: [{ key: "a" }, { key: "b" }, { key: "c" }] }], metadata: { featName: "Crafter", acquisitionLabel: "Artisan" } },
  { id: "musician", label: "Musician", placement: "background", fields: [{ id: "instruments", kind: "tool", count: 3, required: true, options: [{ key: "a" }, { key: "b" }, { key: "c" }] }], metadata: { featName: "Musician", acquisitionLabel: "Entertainer" } },
] });
assert.equal(routedProficiencyFeats.length, 3);
assert.ok(routedProficiencyFeats.every((group) => group.placement === "training" && group.resolverPlacement === "training"), "Skilled/Crafter/Musician follow-up proficiencies belong in Training");
assert.ok(routedProficiencyFeats.every((group) => group.metadata?.trainingSection === "skills-proficiencies"), "proficiency feats must identify the Skills & Proficiencies Training section");

const runeBackgroundFeatures = backgroundFeatureDetails({
  name: "Rune Carver",
  source: "BGG",
  raw_payload: { entries: [
    { type: "entries", name: "Feature: Rune Shaper", data: { isFeature: true }, entries: ["You gain the Rune Shaper feat."] },
    { type: "entries", name: "Rune Styles", entries: ["Choose a favored style."] },
    { type: "entries", name: "Building a Rune Carver Character", entries: ["Boilerplate build advice."] },
  ] },
});
assert.ok(runeBackgroundFeatures.some((feature) => /Rune Shaper/i.test(feature.name)), "Rune Carver must retain its actual feature");
assert.ok(!runeBackgroundFeatures.some((feature) => /^Rune Styles$/i.test(feature.name)), "Rune Styles prose must be replaced by the structured dropdown");
assert.ok(!runeBackgroundFeatures.some((feature) => /^Building a .* Character$/i.test(feature.name)), "source character-building boilerplate must not render as a Background feature");

const clanFeatures = backgroundFeatureDetails({ name: "Clan Crafter", source: "SCAG", raw_payload: { entries: [] } });
assert.ok(!clanFeatures.some((feature) => feature.campaignRule || /Craft Expertise/i.test(feature.name)), "Clan Crafter must not inject the retired DnDNext Craft Expertise house-rule card");

const embeddedSource = read("components/NpcForgeEmbeddedSourceChoices.js");
for (const token of ["sourceChoicePrompt", "incompleteFields", "field.autoSelect", 'join(" • ")']) assert.ok(embeddedSource.includes(token), `fixed + unresolved summary handling missing ${token}`);

const contextSource = read("components/NpcForgeContextPanelRefined.js");
for (const token of ["toolHasChoices", "languageHasChoices", "backgroundFeatureTextForDisplay", "Spell Level:", "ExpandedSpellList"]) assert.ok(contextSource.includes(token), `Background presentation correction missing ${token}`);
assert.match(contextSource, /filter\(\(paragraph\) => !\/\^Spell Level:/, "Strixhaven feature copy must remove duplicated structured spell-table rows");

const controllerSource = read("components/useNpcForgeController.js");
const backgroundValidation = controllerSource.match(/if \(key === "background"\) \{([^\n]+)\}/)?.[1] || "";
assert.ok(backgroundValidation.includes("Choose a background"), "Background step validation must still require a Background");
assert.ok(!backgroundValidation.includes("backgroundSkillChoiceGroups"), "variable Background skills must not block the Background step");
assert.match(controllerSource, /if \(key === "training"\)[\s\S]*?backgroundSkillChoiceGroups\.forEach/, "variable Background skill choices must be validated in Training");

const trainingSource = read("components/NpcForgeTrainingStep.js");
for (const token of ["Background skill choice", "onToggleBackgroundSkill", "do not consume the Class Skill / Trade Skill allowance", "incompleteBackgroundSkills", 'placement="training"', "NpcForgeTrainingFeatPicker", "Skill &amp; Training Selections"]) assert.ok(trainingSource.includes(token), `Training routing missing ${token}`);

const sourceChoiceContext = read("components/NpcForgeSourceChoiceContext.js");
for (const token of ["backgroundToolChoiceResolvesInTraining", "normalizeBackgroundToolPlacement", 'placement: "training"', 'sourcePlacement: group.placement || "background"']) assert.ok(sourceChoiceContext.includes(token), `Background tool Training resolver missing ${token}`);

const contextWrapper = read("components/NpcForgeContextPanel.js");
assert.ok(contextWrapper.includes("playerBackgroundPresentation"), "Background context wrapper must own the Training routing projection");
assert.ok(contextWrapper.includes("skillChoices: []"), "Background page must not render the old variable skill chooser");

const derivedSource = read("components/useNpcForgeDerivedModel.js");
for (const token of ["featDescriptionForBackground", "flattenSourceRuleEntries", "Rune Spells", "Training → Skills & Proficiencies", "TOOL_GUIDANCE", "Typical uses", "cleanPrerequisite"]) assert.ok(derivedSource.includes(token), `Background description/routing model missing ${token}`);
assert.ok(!derivedSource.includes("toolProficiencyDescription(name)"), "Background tools must not use the old generic one-line proficiency copy");

const sourceChoiceSource = read("utils/playerForgeSourceChoices.js");
for (const token of ["toolRuleFacts", "Rune Styles", "RUNE_STYLE_OPTIONS", "grantsMappedTradeSkill: true", 'tradeSkillGrantSource: "background-tool"', "never grants Expertise"]) assert.ok(sourceChoiceSource.includes(token), `Background source-choice enrichment missing ${token}`);
assert.ok(!sourceChoiceSource.includes("clan-crafter-craft-expertise") && !sourceChoiceSource.includes("craftExpertise"), "Retired Clan Crafter Craft Expertise metadata must not remain in source-choice authority");

const loginSource = read("pages/login.js");
assert.ok(loginSource.includes('router.replace("/profile?characterProfile=1")'), "successful login must open the shared Profile panel for normal sign-in");
assert.ok(loginSource.includes('router.query.legacyRoleRoute === "1"'), "bounded role routing may exist only behind the explicit legacy compatibility switch");
const legacyRouteIndex = loginSource.indexOf('router.replace(isAdmin ? "/admin" : "/profile")');
const legacyGuardIndex = loginSource.indexOf('router.query.legacyRoleRoute === "1"');
assert.ok(legacyRouteIndex > legacyGuardIndex && legacyGuardIndex >= 0, "admin/profile role routing must remain inside the explicit legacy compatibility branch");

const modalSource = read("components/NewNpcModalV3Refined.js");
for (const token of ["resetForgeWindowElement", "requestAnimationFrame", "closeCompletedChoiceOnOutsidePointer", "npc-forge-species-fact-choice.is-complete[open]"]) assert.ok(modalSource.includes(token), `Forge geometry/choice-collapse correction missing ${token}`);

const appSource = read("pages/_app.js");
assert.ok(appSource.includes('import "../styles/character-forge-background-polish.css";'), "Background contrast/readability stylesheet must load after the Forge smoke fixes");
const backgroundCss = read("styles/character-forge-background-polish.css");
for (const token of ["npc-forge-context-choice-grid.feats button", "background: #111522", "grid-template-columns: minmax(0, 1fr)", "column-count: 1", "color-scheme: dark"]) assert.ok(backgroundCss.includes(token), `Background contrast/readability CSS missing ${token}`);

for (const source of [read("utils/playerForgeSourceChoices.js"), read("utils/playerForgeFeatChoiceRouting.js"), read("utils/backgroundMechanics.js"), embeddedSource, contextSource, controllerSource, trainingSource, sourceChoiceContext, contextWrapper, derivedSource, loginSource, modalSource, backgroundCss]) {
  assert.doesNotMatch(source, /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/, "Background work crossed protected map/travel boundaries");
}

console.log("Background source-choice polish validated: fixed languages/tools remain automatic, Background tool proficiencies preserve their original power by granting a mapped Trade Skill at Proficient rank only, unmapped tools remain ordinary tools, Clan Crafter Craft Expertise stays retired, Background skills and source choices resolve through Training, source feat copy is structured, Rune Styles is persisted, choice surfaces remain readable, login/profile routing is intact, and protected map/travel boundaries remain untouched.");
