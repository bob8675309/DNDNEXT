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
const spellStep = read("components/NpcForgeSpellStep.js");
const speciesBonus = read("components/NpcForgeSpeciesBonusPanel.js");
const routedController = read("components/useNpcForgeTrainingRoutedController.js");
const modal = read("components/NewNpcModalV3Refined.js");
const craftingToolProfessions = read("utils/craftingToolProfessions.js");
const craftingProfessions = read("utils/craftingProfessions.js");
const sourceChoices = read("utils/playerForgeSourceChoices.js");
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

for (const asset of assets) assert(fs.existsSync(path.join(root, "public/ui/forge/training", asset)), `Missing Training asset: ${asset}`);

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
assert(tabbedTraining.includes("sourceChoiceGroupsForResolverPlacement") && tabbedTraining.includes("sourceChoiceGroupComplete") && tabbedTraining.includes("classGroupsIncomplete"), "Skills/Feats status must derive from resolver-level source/class completion authority.");
assert(tabbedTraining.includes("NpcForgeTrainingStepPlayer {...props}"), "The Skills/Feats shell must reuse the existing player Training mechanics rather than duplicating selection state.");
assert(tabbedTraining.includes("Crafter's Profession grants are the exception and resolve in Skills"), "Feats navigation must identify Crafter as the bounded Skills-routed feat exception.");
assert(tabbedTraining.includes("Background tool proficiencies preserve their original power") && tabbedTraining.includes("sourceGrantedTradeSkillKeys"), "Skills navigation/status must explain and count source-bound Background Trade Skill grants.");

assert(playerTraining.includes("Skill &amp; Training Selections"), "The isolated player mechanics module lost its legacy internal tally contract used by older validators.");
assert(playerTraining.includes("npc-forge-training-summary-breakdown"), "The isolated player mechanics module lost its legacy provenance structure used by older validators.");
assert(playerTraining.includes("<b>Skills</b>") && playerTraining.includes("<b>Trade Skills</b>") && playerTraining.includes("<b>Feat &amp; Class Choices</b>"), "Local Training subsection headings/tallies are missing.");
assert(!playerTraining.includes("<h3>Training Picks</h3>"), "Rejected redundant Training Picks heading remains in player Training.");
assert(playerTraining.includes("Granted by Background") && playerTraining.includes("Granted by ${grantSource}"), "Inline granted-proficiency provenance is missing.");
assert(playerTraining.includes("sourceGrantedProfessionKeys") && playerTraining.includes("sourceGrantedTradeSkillKeys") && playerTraining.includes("sourceGrantedTradeSkillKey"), "Player Training must derive free Trade Skills only from explicit source-grant authority.");
assert(playerTraining.includes("sourceProfessionFieldsFor") && playerTraining.includes("option?.metadata?.professionKey"), "Crafter's explicit Profession choices must resolve in Trade Skills without converting every tool option.");
assert(playerTraining.includes("Background tool proficiencies preserve their original rules value") && playerTraining.includes("Background grants never provide Expertise"), "Player Training must explain the source-bound Background compatibility rule and Expertise limit.");
assert(playerTraining.includes("paidProfessionKeys = explicitlyTrainedProfessionKeys.filter((key) => !sourceGrantedProfessionKeys.has(key))"), "Source-granted Trade Skills must not consume the shared Class Skill / Trade Skill allowance.");
assert(playerTraining.includes("sourceTradeFields") && playerTraining.includes("professionGrantSource"), "Trade Skill rows must retain source availability/provenance for Crafter and Background grants.");
assert(playerTraining.includes("groupsOverride={genericSourceTrainingGroups}"), "Generic non-feat source chooser must use a bounded presentation override after inline routing.");
assert(playerTraining.includes('if (field.kind === "skill") return []') && playerTraining.includes('option?.metadata?.professionKey'), "Presentation routing must promote Skills and explicit Profession choices while leaving ordinary tool choices in Additional Training.");
assert(playerTraining.includes("sourceChoiceGroupComplete"), "Required source-choice completion gating must remain active.");
assert(playerTraining.includes("onToggleBackgroundSkill") && playerTraining.includes("onToggleClassSkill") && playerTraining.includes("onSetProfession"), "Training selection callbacks must remain wired.");
assert(playerTraining.includes(".npc-forge-context-panel{position:sticky!important"), "Current Selection must remain sticky during player Training.");
assert(playerTraining.includes("width:min(1360px,calc(100vw - 32px))") && playerTraining.includes("grid-template-columns:minmax(390px,2fr) minmax(0,3fr)"), "Training desktop layout must reserve approximately 40% for choices and 60% for Current Selection.");
assert(playerTraining.includes("grid-template-columns:minmax(360px,2fr) minmax(0,3fr)"), "Training medium-width layout must preserve the 40/60 choice/detail proportion until the one-column breakpoint.");

assert(sourceContext.includes("backgroundToolChoiceResolvesInTraining"), "Background tool routing predicate is missing.");
assert(sourceContext.includes('placement: "training"') && sourceContext.includes("sourcePlacement") && sourceContext.includes("backgroundToolChoice"), "Background tool choices must preserve ownership provenance while resolving in Training.");
assert(sourceContext.includes("sourceChoiceFieldResolverPlacement") && sourceContext.includes("sourceChoiceGroupsForResolverPlacement"), "Source-choice authority must support field-level resolver placement without splitting canonical groups.");
assert(sourceContext.includes('String(field?.kind || "") === "spell"') && sourceContext.includes('return "spells"') && sourceContext.includes('return "training"'), "Mixed feat groups must route spell fields to Spells and non-spell feat fields to Training.");
assert(sourceContext.includes("const crafterProfessionSkills") && sourceContext.includes('group.metadata?.campaignRule === "crafter-profession-skills"') && sourceContext.includes('group.metadata?.trainingSection === "skills"'), "Crafter must remain the bounded Skills-routed proficiency-feat exception.");
assert(sourceContext.includes('crafterProfessionSkills ? "training" : "class"'), "Crafter Profession choices must project to Skills while other feat-owned non-spell Training groups continue to project to Feats.");
assert(contextWrapper.includes("Resolved in Training") && contextWrapper.includes("Choose in Training"), "Background must acknowledge routed tool choices without resolving them there.");
assert(sourceFields.includes("groupsOverride") && sourceFields.includes("Array.isArray(groupsOverride)") && sourceFields.includes("if (inline) return fields"), "Source-choice wrapper must support bounded inline rendering.");

assert(playerTraining.includes("NpcForgeTrainingFeatPicker"), "Training must use the compact feat catalogue picker.");
assert(featPicker.includes("Name, prerequisite, description") && featPicker.includes("Category") && featPicker.includes("Current Selection"), "Training feat catalogue is missing search/filter/detail guidance.");
assert(playerTraining.includes("controller.setSpeciesBonus?.({ featId })"), "Training must own the Bonus Feat catalogue selection.");
assert(speciesBonus.includes("specific feat is chosen later in Training"), "Abilities must route the actual Bonus Feat selection to Training.");
assert(routedController.includes('controller.stepKey === "abilities"') && routedController.includes('controller.stepKey === "training"'), "Bonus Feat routing must allow Abilities to defer and require completion in Training.");
assert(routedController.includes("sourceGrantedTradeSkillKeys") && routedController.includes("sourceGrantedByCreation") && routedController.includes("paidTradeSkillKeys"), "Routed controller must synchronize explicit source grants and exclude them from paid allowance math.");
assert(!routedController.includes("toolForProfession") && !routedController.includes("additionalTools"), "Paid Trade Skill training must not auto-create a mundane tool proficiency.");
assert(modal.includes("NpcForgeControllerProvider") && modal.includes("useNpcForgeTrainingRoutedController"), "Forge must provide the routed controller to Training.");
assert(playerTraining.includes("featDecisionGroups") && playerTraining.includes("npc-forge-training-feat-followups") && playerTraining.includes("Spells next"), "Left Feats workspace must use a compact follow-up index instead of expanding feat-owned decision controls there.");
assert(playerTraining.includes("groupsOverride={otherSourceClassAbilityGroups}"), "Non-feat class/advancement source decisions must remain resolvable in the left workspace.");
assert(contextWrapper.includes("NpcForgeTrainingContextCard"), "Training preview rail must use its dedicated current-selection dossier.");
for (const token of ["Current Selection", "Typical Uses", "Class Skill", "Trade Skill", "Associated Tool", "Feat Rules", "Required Feat Choices", "Every permanent non-spell decision owned by this feat", "Granted spells resolve on the next tab", "skillsRoutedGroups", "groupsOverride={featTrainingGroups}", "Profession choices resolve in Skills", "All choices can be reviewed on the final step", "Cooking", "Tinkering", "Jewelcraft", "Brewing", "Proficiency now • recipes later"]) assert(trainingContext.includes(token), `Training context dossier missing ${token}`);
assert(trainingContext.includes("explicitly grants this Trade Skill") && trainingContext.includes("This is Proficiency, not Expertise") && trainingContext.includes("ordinary copy or incidental tool grant"), "Trade Skill dossier must explain source grants versus ordinary tools.");
assert(spellStep.includes("sourceChoiceGroupsForResolverPlacement") && spellStep.includes('sourceChoiceGroupsForResolverPlacement(sourceChoiceState, "spells")'), "Spells must consume field-level source resolver placement so mixed feat spell grants arrive on the correct step.");

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
assert(craftingToolProfessions.includes("professionKeyForTool") && craftingToolProfessions.includes("sourceChoiceGrantsTradeSkill") && craftingToolProfessions.includes("sourceGrantedTradeSkillKeys"), "Tool association and explicit source-grant helpers are missing.");
assert(craftingToolProfessions.includes("Association alone is informational/routing data") && craftingToolProfessions.includes("grantsMappedTradeSkill"), "Tool mapping must remain non-authoritative unless source metadata explicitly opts in.");
assert(sourceChoices.includes("grantsMappedTradeSkill: true") && sourceChoices.includes('tradeSkillGrantSource: "background-tool"') && sourceChoices.includes("It never grants Expertise"), "Background tool groups must carry explicit Proficient-only Trade Skill compatibility metadata.");
assert(craftingProfessions.includes("sheetHasProfessionTool") && craftingProfessions.includes("const effectiveRank = profession.rank") && craftingProfessions.includes('proficiencySource: profession.rank > 0 ? "trade-skill" : "none"'), "Shared Trade Skill resolver must keep persisted Trade Skill rank authoritative.");
assert(craftingProfessions.includes("hasToolProficiency") && craftingProfessions.includes("toolRequiredForCrafting: true") && !craftingProfessions.includes("toolGranted ? 1 : 0"), "Shared crafting resolver must expose mundane-tool status separately without granting proficiency globally.");
assert(craftingProfessions.includes("professionHasServiceFlag") && craftingProfessions.includes("professionServicesFromSheet"), "Tool compatibility must not remove explicit NPC workshop service authority.");
assert(craftingProfessions.includes("PROFESSION_KEYS.includes(key)") && craftingProfessions.includes("availableProfessionsForCharacter"), "Future-facing Trade Skills must not accidentally become NPC workshop services.");

assert(modal.includes("handleHeaderDoubleClick") && modal.includes("handleHeaderPointerUp") && modal.includes("DOUBLE_TAP_WINDOW_MS"), "Forge header double-click/double-tap geometry reset is missing.");
assert(modal.includes("isInteractiveHeaderTarget") && modal.includes("HEADER_RESET_INTERACTIVE_SELECTOR"), "Forge reset gesture must ignore interactive header controls.");
assert(modal.includes("requestForgeWindowReset") && modal.includes('detail: { scope: "forge" }'), "Forge reset gesture must reuse the established app-window reset event.");
assert(modal.includes('npc-forge-species-fact-choice[data-icon-kind="languages"]') && modal.includes("npc-forge-embedded-choice__slots select"), "Species Origin Languages compact browser-review styling is missing.");

const protectedSources = `${training}\n${tabbedTraining}\n${playerTraining}\n${sourceFields}\n${sourceContext}\n${contextWrapper}\n${trainingContext}\n${featPicker}\n${spellStep}\n${routedController}\n${craftingToolProfessions}\n${craftingProfessions}\n${sourceChoices}\n${modal}`.toLowerCase();
for (const token of ["world map", "world-map", "map_routes", "advance_all_characters", "town map", "city map"]) assert(!protectedSources.includes(token), `Training redesign unexpectedly references protected map behavior: ${token}`);

console.log("Training tab redesign validation passed: Skills/Feats internal views, categorical completion guidance, source-bound Background tool-to-Trade-Skill compatibility at Proficient rank only, ordinary-tool separation, Crafter Profession choices in Skills, mixed feat spell routing, isolated NPC fallback, eight player Trade Skills with four-discipline runtime isolation, sticky Current Selection, and protected boundaries are intact.");
