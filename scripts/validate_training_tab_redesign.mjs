import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const training = read("components/NpcForgeTrainingStep.js");
const tabbedTraining = read("components/NpcForgeTrainingStepPlayerTabbed.js");
const playerTraining = read("components/NpcForgeTrainingStepPlayer.js");
const legacy = read("components/NpcForgeTrainingStepBase.js");
const sourceFields = read("components/NpcForgeSourceChoiceFields.js");
const sourceContext = read("components/NpcForgeSourceChoiceContext.js");
const contextWrapper = read("components/NpcForgeContextPanel.js");
const trainingContext = read("components/NpcForgeTrainingContextCard.js");
const featPicker = read("components/NpcForgeTrainingFeatPicker.js");
const speciesBonus = read("components/NpcForgeSpeciesBonusPanel.js");
const routedController = read("components/useNpcForgeTrainingRoutedController.js");
const modal = read("components/NewNpcModalV3Refined.js");
const craftingToolProfessions = read("utils/craftingToolProfessions.js");
const craftingProfessions = read("utils/craftingProfessions.js");
const assets = [
  "summary-background.svg",
  "summary-skills.svg",
  "summary-training.svg",
  "summary-feat.svg",
  "choice-tool.svg",
  "choice-instrument.svg",
  "choice-language.svg",
  "profession-alchemy.svg",
  "profession-smithing.svg",
  "profession-scribe.svg",
  "profession-enchanting.svg",
];

for (const asset of assets) {
  assert(fs.existsSync(path.join(root, "public/ui/forge/training", asset)), `Missing Training asset: ${asset}`);
}

assert(training.includes("NpcForgeTrainingStepBase") && training.includes("NpcForgeTrainingStepPlayerTabbed"), "Training wrapper must isolate the player redesign from NPC fallback and route players through the Skills/Feats switch.");
assert(training.includes("if (!props.playerMode) return <NpcForgeTrainingStepBase"), "NPC Forge must remain on the legacy Training presentation.");
assert(training.includes("return <NpcForgeTrainingStepPlayerTabbed"), "Player Character Forge must use the Skills/Feats Training switch.");
assert(legacy.includes("Skills & Proficiencies") && legacy.includes("Feats & Class Abilities"), "Legacy NPC Training implementation was not preserved intact enough for fallback use.");

for (const token of ["npc-forge-training-mode-switch", 'role="tablist"', 'role="tab"', "Skills, Trade Skills &amp; additional training", "Feat catalogue &amp; permanent feat choices", "is-skills", "is-feats"]) {
  assert(tabbedTraining.includes(token), `Skills/Feats Training switch is missing ${token}`);
}
assert(tabbedTraining.includes("npc-forge-training-summary--unified{display:none!important}"), "The rejected aggregate source/provenance tally must be hidden from the player-facing Training header.");
assert(tabbedTraining.includes("Additional Training") && !tabbedTraining.includes("Source Training"), "Player-facing Training navigation must not expose the unclear Source Training label.");
assert(tabbedTraining.includes("Needs choice") && tabbedTraining.includes("Complete") && tabbedTraining.includes("No choices"), "Training subviews must use categorical completion guidance rather than a mixed aggregate fraction.");
assert(tabbedTraining.includes("routeContinueToUnfinishedView") && tabbedTraining.includes('window.addEventListener("click", routeContinueToUnfinishedView, true)'), "Continue must route the player to the internal Training view that still needs work.");
assert(tabbedTraining.includes('if (incompleteBonusFeat) setActiveView("feats")') && tabbedTraining.includes('else if (skillsIncomplete) setActiveView("skills")'), "Continue routing must prioritize the correct Skills/Feats view.");
assert(tabbedTraining.includes("sourceChoiceGroupComplete") && tabbedTraining.includes("classGroupsIncomplete"), "Skills/Feats status must derive from existing source/class completion authority.");
assert(tabbedTraining.includes("NpcForgeTrainingStepPlayer {...props}"), "The Skills/Feats shell must reuse the existing player Training mechanics rather than duplicating selection state.");

assert(playerTraining.includes("Skill &amp; Training Selections"), "The isolated player mechanics module lost its legacy internal tally contract used by older validators.");
assert(playerTraining.includes("npc-forge-training-summary-breakdown"), "The isolated player mechanics module lost its legacy provenance structure used by older validators.");
assert(playerTraining.includes("<b>Skills</b>") && playerTraining.includes("<b>Trade Skills</b>") && playerTraining.includes("<b>Feat &amp; Class Choices</b>"), "Local Training subsection headings/tallies are missing.");
assert(!playerTraining.includes("<h3>Training Picks</h3>"), "Rejected redundant Training Picks heading remains in player Training.");
assert(playerTraining.includes("Granted by Background") && playerTraining.includes("Granted by ${grantSource}"), "Inline granted-proficiency provenance is missing.");
assert(playerTraining.includes("sourceGrantedProfessionKeys"), "Player Training must project source-granted mapped tools as Trade Skill grants.");
assert(playerTraining.includes("Source-granted craft tools resolve here for free"), "Player Training must explain that mapped tool grants do not cost a second paid pick.");
assert(!playerTraining.includes("Tool proficiency alone does not unlock the Trade Skill"), "Rejected tool-vs-Trade-Skill model remains in player Training.");
assert(playerTraining.includes('field.kind === "skill-or-tool"'), "Mixed Skilled-style skill-or-tool source choices must route through inline Skills/Trade Skills.");
assert(playerTraining.includes("groupsOverride={genericSourceTrainingGroups}"), "Generic source chooser must use a bounded presentation override after inline routing.");
assert(playerTraining.includes("hasArtisanPool && hasMappedTrade && isArtisanOption(option)"), "Unsupported artisan choices must be hidden only when a mapped Trade Skill can satisfy the same source field.");
assert(playerTraining.includes("sourceChoiceGroupComplete"), "Required source-choice completion gating must remain active.");
assert(playerTraining.includes("onToggleBackgroundSkill"), "Variable Background skill grants must remain selectable without becoming paid class picks.");
assert(playerTraining.includes("onToggleClassSkill"), "Class skill selection authority must remain wired.");
assert(playerTraining.includes("onSetProfession"), "Paid Trade Skill selection authority must remain wired.");
assert(playerTraining.includes(".npc-forge-context-panel{position:sticky!important"), "Current Selection must remain sticky during player Training.");
assert(playerTraining.includes(".npc-forge-modal-v2:has(.npc-forge-training-player-layout)"), "Approved Training modal width contract is missing.");
assert(playerTraining.includes(".npc-forge-body:has(.npc-forge-training-player-layout)"), "Approved Training/player body proportion rule is missing.");

assert(sourceContext.includes("backgroundToolChoiceResolvesInTraining"), "Background tool routing predicate is missing.");
assert(sourceContext.includes('placement: "training"') && sourceContext.includes("sourcePlacement") && sourceContext.includes("backgroundToolChoice"), "Background tool choices must preserve ownership provenance while resolving in Training.");
assert(contextWrapper.includes("Resolved in Training") && contextWrapper.includes("Choose in Training"), "Background must acknowledge routed tool choices without resolving them there.");
assert(sourceFields.includes("groupsOverride") && sourceFields.includes("Array.isArray(groupsOverride)"), "Source-choice presentation override is missing.");
assert(sourceFields.includes("if (inline) return fields"), "Source-choice wrapper must support bypassing the preview portal.");

assert(playerTraining.includes("NpcForgeTrainingFeatPicker"), "Training must use the compact feat catalogue picker.");
assert(featPicker.includes("Name, prerequisite, description") && featPicker.includes("Category") && featPicker.includes("Current Selection"), "Training feat catalogue is missing search/filter/detail guidance.");
assert(!playerTraining.includes("npc-forge-training-bonus-feat"), "Giant native Bonus Feat select remains in Training.");
assert(playerTraining.includes("controller.setSpeciesBonus?.({ featId })"), "Training must own the Bonus Feat catalogue selection.");
assert(speciesBonus.includes("specific feat is chosen later in Training"), "Abilities must route the actual Bonus Feat selection to Training.");
assert(!speciesBonus.includes("Species bonus feat</span>"), "Abilities still contains the old Bonus Feat catalogue chooser.");
assert(routedController.includes('controller.stepKey === "abilities"') && routedController.includes('controller.stepKey === "training"'), "Bonus Feat routing must allow Abilities to defer and require completion in Training.");
assert(routedController.includes("TRADE_SKILL_KEYS") && routedController.includes("trainedTradeSkillKeys") && routedController.includes("controller.classSkillConfig.count"), "Player allowance must count all eight explicit Trade Skills without widening base runtime keys.");
assert(routedController.includes("toolForProfession") && routedController.includes("additionalTools") && routedController.includes("setProfession,"), "Paid Trade Skills must persist their mapped tool proficiency without widening crafting runtime authority.");
assert(modal.includes("NpcForgeControllerProvider") && modal.includes("useNpcForgeTrainingRoutedController"), "Forge must provide the routed controller to Training.");
assert(playerTraining.includes("NpcForgeSourceChoiceFields placement=\"class\" ownerType=\"feat\" inline"), "Feat-owned follow-up choices must stay inline in Training.");
assert(playerTraining.includes("NpcForgeSourceChoiceFields placement=\"advancement\" inline"), "Advancement/Epic Boon choices must stay inline in Training.");
assert(contextWrapper.includes("NpcForgeTrainingContextCard"), "Training preview rail must use its dedicated current-selection dossier.");
for (const token of ["Current Selection", "Typical Uses", "Class Skill", "Trade Skill", "Associated Tool", "Feat Rules", "All choices can be reviewed on the final step", "Cooking", "Tinkering", "Jewelcraft", "Brewing", "Proficiency now • recipes later"]) assert(trainingContext.includes(token), `Training context dossier missing ${token}`);

for (const token of [
  'label: "Alchemy"', 'tool: "Alchemist\'s Supplies"',
  'label: "Smithing"', 'tool: "Smith\'s Tools"',
  'label: "Scribe"', 'tool: "Calligrapher\'s Supplies"',
  'label: "Enchanting"', 'tool: "Enchanter\'s Tools"',
  'label: "Cooking"', 'tool: "Cook\'s Utensils"',
  'label: "Tinkering"', 'tool: "Tinker\'s Tools"',
  'label: "Jewelcraft"', 'tool: "Jeweler\'s Tools"',
  'label: "Brewing"', 'tool: "Brewer\'s Supplies"',
]) assert(craftingProfessions.includes(token), `Eight-Trade-Skill catalogue missing ${token}`);
assert(craftingProfessions.includes("export const TRADE_SKILL_KEYS = Object.freeze(Object.keys(PROFESSION_DEFINITIONS))"), "Player Trade Skill key catalogue is missing.");
assert(craftingProfessions.includes('export const PROFESSION_KEYS = Object.freeze(["alchemy", "smithing", "scribe", "enchanting"])'), "Crafting runtime/NPC service keys must remain limited to the four implemented disciplines.");
assert(craftingProfessions.includes("runtimeEnabled: false"), "Future-facing Trade Skills must be marked as not having dedicated runtime yet.");
assert(craftingToolProfessions.includes("TRADE_SKILL_KEYS") && craftingToolProfessions.includes("professionKeyForTool") && craftingToolProfessions.includes("professionKeysForTools"), "Canonical tool-to-Trade-Skill helper must derive from all player Trade Skill definitions.");
assert(craftingProfessions.includes("sheetHasProfessionTool") && craftingProfessions.includes("toolGranted ? 1 : 0") && craftingProfessions.includes('proficiencySource: profession.rank > 0 ? "profession" : toolGranted ? "tool" : "none"'), "Shared Trade Skill resolver must honor canonical mapped-tool proficiency.");
assert(craftingProfessions.includes("professionHasServiceFlag") && craftingProfessions.includes("professionServicesFromSheet"), "Tool unification must not remove explicit NPC workshop service authority.");
assert(craftingProfessions.includes("PROFESSION_KEYS.includes(key)") && craftingProfessions.includes("availableProfessionsForCharacter"), "Future-facing Trade Skills must not accidentally become NPC workshop services.");

assert(modal.includes("handleHeaderDoubleClick") && modal.includes("handleHeaderPointerUp") && modal.includes("DOUBLE_TAP_WINDOW_MS"), "Forge header double-click/double-tap geometry reset is missing.");
assert(modal.includes("isInteractiveHeaderTarget") && modal.includes("HEADER_RESET_INTERACTIVE_SELECTOR"), "Forge reset gesture must ignore interactive header controls.");
assert(modal.includes("requestForgeWindowReset") && modal.includes('detail: { scope: "forge" }'), "Forge reset gesture must reuse the established app-window reset event.");
assert(modal.includes('npc-forge-species-fact-choice[data-icon-kind="languages"]') && modal.includes("npc-forge-embedded-choice__slots select"), "Species Origin Languages compact browser-review styling is missing.");

const protectedSources = `${training}\n${tabbedTraining}\n${playerTraining}\n${sourceFields}\n${sourceContext}\n${contextWrapper}\n${trainingContext}\n${featPicker}\n${routedController}\n${craftingToolProfessions}\n${craftingProfessions}\n${modal}`.toLowerCase();
for (const token of ["world map", "world-map", "map_routes", "advance_all_characters", "town map", "city map"]) assert(!protectedSources.includes(token), `Training redesign unexpectedly references protected map behavior: ${token}`);

console.log("Training tab redesign validation passed: Skills/Feats internal views, categorical completion guidance, isolated NPC fallback, inline source grants, eight player Trade Skills with mapped tool persistence and four-discipline runtime isolation, compact Species languages, header geometry reset, sticky Current Selection, and source-owned completion are intact.");