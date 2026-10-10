import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const training = read("components/NpcForgeTrainingStep.js");
const tabbedTraining = read("components/NpcForgeTrainingStepPlayerTabbed.js");
const playerTraining = read("components/NpcForgeTrainingStepPlayer.js");
const classFeatureChoices = read("components/NpcForgeClassFeatureChoices.js");
const classOptionBrowser = read("components/NpcForgeClassOptionBrowser.js");
const legacy = read("components/NpcForgeTrainingStepBase.js");
const sourceFields = read("components/NpcForgeSourceChoiceFields.js");
const sourceContext = read("components/NpcForgeSourceChoiceContext.js");
const contextWrapper = read("components/NpcForgeContextPanel.js");
const trainingContext = read("components/NpcForgeTrainingContextCard.js");
const featPicker = read("components/NpcForgeTrainingFeatPicker.js");
const featRulePresentation = read("utils/featRulePresentation.js");
const classFeatureChoiceParsing = read("utils/classFeatureChoiceParsing.js");
const invocationChoices = read("utils/warlockInvocationChoices.js");
const profileFeatures = read("components/CharacterFeaturesPanel.js");
const spellStep = read("components/NpcForgeSpellStep.js");
const speciesBonus = read("components/NpcForgeSpeciesBonusPanel.js");
const routedController = read("components/useNpcForgeTrainingRoutedController.js");
const modal = read("components/NewNpcModalV3Refined.js");
const playerAdapter = read("components/NewNpcModalV3.js");
const validationGuidance = read("utils/forgeValidationGuidance.js");
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

assert(training.includes("NpcForgeTrainingStepBase") && training.includes("NpcForgeTrainingStepPlayerTabbed"), "Training wrapper must isolate the player redesign from NPC fallback and route players through the Skills/Feats/Class Choices switch.");
assert(training.includes("if (!props.playerMode) return <NpcForgeTrainingStepBase"), "NPC Forge must remain on the legacy Training presentation.");
assert(training.includes("return <NpcForgeTrainingStepPlayerTabbed"), "Player Character Forge must use the Skills/Feats/Class Choices Training switch.");
assert(tabbedTraining.includes("is-class-choice-tab") && tabbedTraining.includes("<span>Class</span><span>Choices</span>"), "Class Choices must stack its label inside the existing pill without enlarging the tab.");
assert(legacy.includes("Skills & Proficiencies") && legacy.includes("Feats & Class Abilities"), "Legacy NPC Training implementation was not preserved intact enough for fallback use.");

for (const token of ["npc-forge-training-mode-switch", 'role="tablist"', 'role="tab"', "npc-forge-training-tab-status", "skillsProgress", "featsProgress", "classTabProgress", "fraction(skillsProgress)", "fraction(featsProgress)", "fraction(classTabProgress)", "Class Choices", "is-skills", "is-feats", "is-class"]) {
  assert(tabbedTraining.includes(token), `Skills/Feats/Class Choices Training switch or progress fraction is missing ${token}`);
}
assert(!tabbedTraining.includes("Skills, Trade Skills &amp; additional training") && !tabbedTraining.includes("Feat catalogue &amp; feat-owned follow-ups") && !tabbedTraining.includes("Invocations, styles, maneuvers &amp; class options"), "Training tabs must use player-readable label + status + progress fraction without the retired tiny implementation subtitles.");
assert(tabbedTraining.includes("npc-forge-training-summary--unified{display:none!important}"), "The rejected aggregate source/provenance tally must be hidden from the player-facing Training header.");
assert(tabbedTraining.includes("Additional Training") && !tabbedTraining.includes("Source Training"), "Player-facing Training navigation must not expose the unclear Source Training label.");
assert(tabbedTraining.includes("Needs choice") && tabbedTraining.includes("Complete") && tabbedTraining.includes("No choices") && tabbedTraining.includes("const fraction = (progress)"), "Training subviews must pair categorical completion guidance with the accepted per-tab completion fraction.");
assert(tabbedTraining.includes("routeContinueToUnfinishedView") && tabbedTraining.includes('window.addEventListener("click", routeContinueToUnfinishedView, true)'), "Continue must route the player to the internal Training view that still needs work.");
assert(tabbedTraining.includes('if (incompleteBonusFeat) {') && tabbedTraining.includes('setActiveView("feats")') && tabbedTraining.includes('} else if (incompleteExpertiseGroup) {') && tabbedTraining.includes('setActiveView("class")') && tabbedTraining.includes('} else if (classChoicesIncomplete) {'), "Continue routing must prioritize the correct Skills/Feats/Class Choices view and route class-granted Expertise to Class Choices.");
assert(tabbedTraining.includes("sourceChoiceGroupsForResolverPlacement") && tabbedTraining.includes("sourceChoiceGroupsForPlacement") && tabbedTraining.includes("sourceChoiceGroupComplete") && tabbedTraining.includes("classGroupsIncomplete") && tabbedTraining.includes("classSourceGroups"), "Training subview status must derive from resolver-level and source-owned class-option authority.");
assert(tabbedTraining.includes("activeClassFeatureGroups") && tabbedTraining.includes("backgroundSourceSkillOptions") && tabbedTraining.includes("Class and subclass choices at this level") && tabbedTraining.includes("expertiseProgress"), "Training summaries must count active class groups, include Expertise in Class Choices, and include fixed/source Background skill grants.");
assert(tabbedTraining.includes("NpcForgeTrainingStepPlayer {...props}"), "The Training subview shell must reuse the existing player Training mechanics rather than duplicating selection state.");
assert(tabbedTraining.includes("Class Skill Choices") && tabbedTraining.includes("Background Skills") && tabbedTraining.includes('label: "Background"') && tabbedTraining.includes("name: backgroundName") && tabbedTraining.includes('label: "Class"') && tabbedTraining.includes("Grants you") && tabbedTraining.includes("backgroundSourceSkillOptions"), "Skills overview must use player-facing Background/Class language while preserving authoritative skill counts.");

assert(playerTraining.includes("Skill &amp; Training Selections"), "The isolated player mechanics module lost its legacy internal tally contract used by older validators.");
assert(playerTraining.includes("npc-forge-training-summary-breakdown"), "The isolated player mechanics module lost its legacy provenance structure used by older validators.");
assert(playerTraining.includes("<b>Skills</b>") && playerTraining.includes("<b>Trade Skills</b>") && playerTraining.includes("<b>Feat &amp; Class Choices</b>"), "Local Training subsection headings/tallies are missing.");
assert(!playerTraining.includes("<h3>Training Picks</h3>"), "Rejected redundant Training Picks heading remains in player Training.");
assert(playerTraining.includes("backgroundSourceLabel") && playerTraining.includes("Granted by ${backgroundSourceLabel}") && playerTraining.includes("Granted by ${grantSource}"), "Inline granted-proficiency provenance is missing.");
assert(playerTraining.includes("sourceGrantedProfessionKeys") && playerTraining.includes("sourceGrantedTradeSkillKeys") && playerTraining.includes("sourceGrantedTradeSkillKey"), "Player Training must derive free Trade Skills only from explicit source-grant authority.");
assert(playerTraining.includes("sourceProfessionFieldsFor") && playerTraining.includes("option?.metadata?.professionKey"), "Crafter's explicit Profession choices must resolve in Trade Skills without converting every tool option.");
assert(!playerTraining.includes("Trade Skills measure crafting proficiency") && !playerTraining.includes("Background tool proficiencies preserve their original rules value"), "Player Training must not expose internal Trade Skill compatibility/routing prose in the normal player surface.");
assert(playerTraining.includes("expertiseChoiceGroups") && playerTraining.includes("npc-forge-training-expertise-flag") && playerTraining.includes("aria-pressed={hasExpertise}") && playerTraining.includes("toggleExpertiseFlag"), "Expertise must be applied directly as a flag on already-proficient Skill rows.");
assert(playerTraining.includes('excludeKinds={["expertise"]}') && playerTraining.includes("Expertise is applied directly to your selected Skills above."), "The detached Expertise mini-form must stay out of Other Training Choices while Skill-row Expertise controls remain available.");
assert(playerTraining.includes("classChoicePresentationGroups") && playerTraining.includes('group.kind === "expertise" ? { ...group, placement: "class" } : group') && playerTraining.includes("groups={classChoicePresentationGroups}"), "Expertise must mirror into Class Choices without creating a second persistence group.");
assert(classFeatureChoices.includes("excludeKinds = []") && classFeatureChoices.includes("excludedKinds"), "Shared class feature choices must support bounded presentation filtering without changing canonical choice authority.");
assert(playerTraining.includes("paidProfessionKeys = explicitlyTrainedProfessionKeys.filter((key) => !sourceGrantedProfessionKeys.has(key))"), "Source-granted Trade Skills must not consume the shared Class Skill / Trade Skill allowance.");
assert(playerTraining.includes("sourceTradeFields") && playerTraining.includes("professionGrantSource"), "Trade Skill rows must retain source availability/provenance for Crafter and Background grants.");
assert(playerTraining.includes("groupsOverride={genericSourceTrainingGroups}"), "Generic non-feat source chooser must use a bounded presentation override after inline routing.");
assert(playerTraining.includes('if (field.kind === "skill") return []') && playerTraining.includes('option?.metadata?.professionKey'), "Presentation routing must promote Skills and explicit Profession choices while leaving ordinary tool choices in Additional Training.");
assert(playerTraining.includes("sourceChoiceGroupComplete"), "Required source-choice completion gating must remain active.");
assert(playerTraining.includes("onToggleBackgroundSkill") && playerTraining.includes("onToggleClassSkill") && playerTraining.includes("onSetProfession"), "Training selection callbacks must remain wired.");
assert(playerTraining.includes("sourceChoiceSelected") && playerTraining.includes("fixedSourceGranted") && playerTraining.includes('type: "skill"') && !playerTraining.includes("if (classAvailable) onToggleClassSkill?.(key);"), "Skill rows must inspect only while distinguishing fixed grants from removable selected source choices.");
assert(trainingContext.includes('detail?.selectionKind === "background-skill"') && trainingContext.includes('detail?.selectionKind === "source-skill"') && trainingContext.includes('detail?.selectionKind === "class-skill"') && trainingContext.includes('"Select Skill"') && trainingContext.includes('"Deselect Skill"') && trainingContext.includes("current.filter((optionKey) => optionKey !== detail.sourceOptionKey)"), "Skill selection authority must live in the right-side Current Selection button and selected choices must be removable there.");
assert(trainingContext.includes('"Select Trade Skill"') && playerTraining.includes('selectionKind = sourceGranted ? "granted-profession"'), "Trade Skill rows must follow the same inspect-left/select-right interaction contract.");
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
assert(featPicker.includes("Name, prerequisite, description") && featPicker.includes("Category") && featPicker.includes("Prerequisite") && featPicker.includes("Sort") && featPicker.includes("sortMode") && featPicker.includes("categoryLabel") && featPicker.includes("Current Selection"), "Training feat catalogue is missing readable category labels, prerequisite filtering, sorting, or detail guidance.");
assert(!featPicker.includes("onMouseEnter") && !featPicker.includes("onFocus") && !featPicker.includes("onSelect?.(") && featPicker.includes("onClick={() => publish(feat)}"), "Feat catalogue rows must inspect on click without selecting on hover or row click.");
assert(trainingContext.includes('selectionKind === "species-bonus-feat"') && trainingContext.includes("controller.setSpeciesBonus?.({ featId: feat.id })") && trainingContext.includes('actionLabel={selected ? "Selected" : "Select Feat"}'), "Bonus Feat confirmation must live on the right-side Select Feat/Selected control.");
assert(speciesBonus.includes("specific feat is chosen later in Training"), "Abilities must route the actual Bonus Feat selection to Training.");
assert(routedController.includes('controller.stepKey === "abilities"') && routedController.includes('controller.stepKey === "training"'), "Bonus Feat routing must allow Abilities to defer and require completion in Training.");
assert(routedController.includes("sourceGrantedTradeSkillKeys") && routedController.includes("sourceGrantedByCreation") && routedController.includes("paidTradeSkillKeys"), "Routed controller must synchronize explicit source grants and exclude them from paid allowance math.");
assert(!routedController.includes("toolForProfession") && !routedController.includes("additionalTools"), "Paid Trade Skill training must not auto-create a mundane tool proficiency.");
assert(modal.includes("NpcForgeControllerProvider") && modal.includes("useNpcForgeTrainingRoutedController"), "Forge must provide the routed controller to Training.");
assert(playerTraining.includes("featDecisionGroups") && playerTraining.includes("npc-forge-training-feat-followups") && playerTraining.includes("Spells next"), "Left Feats workspace must use a compact follow-up index instead of expanding feat-owned decision controls there.");
assert(playerTraining.includes("npc-forge-training-feat-only") && playerTraining.includes("npc-forge-training-class-only") && playerTraining.includes('placement="class"'), "Feat and Class Choices surfaces must be separated without duplicating underlying choice authority.");
assert(playerTraining.includes("NpcForgeClassOptionBrowser") && playerTraining.includes("groups={classOptionGroups}") && playerTraining.includes("allSourceClassAbilityGroups"), "Source-backed class options must stay inside the Class Choices workspace and participate in completion gating.");
assert(playerTraining.includes("inspectOnly onDetail={onDetail}") && classFeatureChoices.includes('type: "classFeatureOption"') && classFeatureChoices.includes("npc-forge-class-choice-inspect-list") && classFeatureChoices.includes("open={inspectOnly ? undefined : !complete}"), "Regular class/subclass choices must use collapsed inspect-left/select-right behavior inside Training.");
assert(trainingContext.includes('detail?.type === "classFeatureOption"') && trainingContext.includes("toggleFeatureOption") && trainingContext.includes('"Replace Selection"'), "Regular class feature options must be selected from Current Selection on the right.");
assert(!classFeatureChoices.includes("NpcForgeSourceChoiceFields"), "Class feature choices must never portal class-option controls into the Training preview rail.");
for (const token of ["sourceChoiceFieldIsActive", 'type: "classSourceOption"', "Descriptions and selection stay in Current Selection", "<details", "npc-forge-class-option-group__body", "npc-forge-class-option-list"]) assert(classOptionBrowser.includes(token), `Class Choices catalogue is missing ${token}`);
assert(!classOptionBrowser.includes("onMouseEnter") && !classOptionBrowser.includes("onFocus"), "Class Choices catalogue must be click-owned rather than hover-owned.");
assert(classOptionBrowser.includes("if (!visibleGroups.length) return null;"), "Class Choices must not reserve a large empty source-backed option panel when no slots exist at the current level.");
assert(classFeatureChoices.includes("is-inspect-only") && classFeatureChoices.includes(".npc-forge-class-choices.is-inspect-only"), "Inspect-only Class Choices must use the compact presentation instead of the full generic chooser spacing.");
assert(playerAdapter.includes("incompleteTrainingGroup") && playerAdapter.includes("incompleteClassGroup") && playerAdapter.includes("Training → Class Choices") && playerAdapter.includes("This class-granted choice is available in Class Choices and beside your proficient Skills"), "Training Continue blockers must identify unresolved class/training choices and explain the mirrored Expertise surface.");
assert(validationGuidance.includes(".npc-forge-training-class-only .npc-forge-class-choice-group.is-required") && validationGuidance.includes(".npc-forge-training-class-skills") && validationGuidance.includes(".npc-forge-class-option-group.is-required"), "Forge validation guidance must prioritize the Class Choices Expertise mirror while retaining the Skills fallback and source-backed Class Choice controls.");
assert(tabbedTraining.includes("classSourceGroups") && tabbedTraining.includes('group.ownerType === "class-option"') && tabbedTraining.includes('["feats", "class"].includes(activeView)') && playerTraining.includes("NpcForgeClassOptionBrowser"), "Class Choices must account for source-owned class options such as Warlock invocations without relying on implementation-facing tab subtitle copy.");
assert(trainingContext.includes('detail?.type === "classSourceOption"') && trainingContext.includes("toggleChoice: toggleSourceChoice") && trainingContext.includes('"Replace Selection"') && trainingContext.includes("Additional choice follows this option"), "Class Choices must inspect and confirm source-backed options from the real Current Selection panel.");
assert(invocationChoices.includes("OPTION_SUMMARIES") && invocationChoices.includes('formatPlayerFacingText(row.description, "") || guide?.summary || OPTION_SUMMARIES[norm(row.name)]'), "Invocation Current Selection must prefer the complete canonical source rule and retain the concise guide/summary only as fallback.");
assert(playerTraining.includes('group.ownerType !== "feat" && group.ownerType !== "class-option"') && playerTraining.includes("groupsOverride={otherSourceClassAbilityGroups}"), "Canonical class-option groups such as Eldritch Invocations must render only through Class Choice Catalogue, while unrelated non-feat class/advancement decisions remain resolvable.");
assert(contextWrapper.includes("NpcForgeTrainingContextCard"), "Training preview rail must use its dedicated current-selection dossier.");
for (const token of ["Current Selection", "trainingOverview", "Where these come from", "classSourceOption", "Typical Uses", "Class Skill", "Trade Skill", "Associated Tool", "Feat Rules", "Required Feat Choices", "Every permanent non-spell decision owned by this feat", "Granted spells resolve on the next tab", "skillsRoutedGroups", "groupsOverride={featTrainingGroups}", "Profession choices resolve in Skills", "Cooking", "Tinkering", "Jewelcraft", "Brewing", "Proficiency now • recipes later"]) assert(trainingContext.includes(token), `Training context dossier missing ${token}`);
assert(!trainingContext.includes("All choices can be reviewed on the final step") && !trainingContext.includes("npc-forge-training-context-note"), "Current Selection must stop at its actual rules/facts instead of appending the redundant final-step reminder and dead bottom space.");
assert(trainingContext.includes("height:auto;min-height:0") && !trainingContext.includes("min-height:100%"), "Training Current Selection dossier must use intrinsic content height.");
assert(trainingContext.includes("explicitly grants this Trade Skill") && trainingContext.includes("This is Proficiency, not Expertise") && trainingContext.includes("ordinary copy or incidental tool grant"), "Trade Skill dossier must explain source grants versus ordinary tools.");
assert(featRulePresentation.includes("featRuleSectionsFromDescription") && featRulePresentation.includes("looksLikeRuleHeading") && featRulePresentation.includes("titleLike.length / significant.length >= 0.8") && featRulePresentation.includes("with|over|by|as") && trainingContext.includes("featRuleSectionsFromDescription"), "Forge feat rules must partition genuine title-like source headings, including connector-word headings such as Dash over Difficult Terrain.");
assert(classFeatureChoiceParsing.includes('"doing one of the following"') && classFeatureChoiceParsing.includes('"do one of the following"'), "Runtime feature instructions such as Barbarian Rage must not be misclassified as creation-time Class Choices.");
assert(trainingContext.includes("font-size:.88rem") && classFeatureChoices.includes("npc-forge-class-choice-helper") && classFeatureChoices.includes("font-size:.74rem"), "Class Choice rules must retain the enlarged Current Selection copy and structured readable left-side helper treatment.");
assert(profileFeatures.includes("FeatureRuleText") && profileFeatures.includes("featRuleSectionsFromDescription") && profileFeatures.includes("profile-feature-rule-list"), "Profile Feats & Boons detail must use readable structured rule formatting instead of one raw paragraph.");
assert(spellStep.includes("sourceChoiceGroupsForResolverPlacement") && spellStep.includes('sourceChoiceGroupsForResolverPlacement(sourceChoiceState, "spells")'), "Spells must consume field-level source resolver placement so mixed feat spell grants arrive on the correct step.");
assert(spellStep.includes("components_v,components_s,components_m,material_text") && !spellStep.includes("components_text"), "Spells must query only columns present in the live spells_catalog schema.");

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

const protectedSources = `${training}\n${tabbedTraining}\n${playerTraining}\n${classOptionBrowser}\n${sourceFields}\n${sourceContext}\n${contextWrapper}\n${trainingContext}\n${featPicker}\n${spellStep}\n${routedController}\n${craftingToolProfessions}\n${craftingProfessions}\n${sourceChoices}\n${modal}`.toLowerCase();
for (const token of ["world map", "world-map", "map_routes", "advance_all_characters", "town map", "city map"]) assert(!protectedSources.includes(token), `Training redesign unexpectedly references protected map behavior: ${token}`);

console.log("Training tab redesign validation passed: Skills/Feats/Class Choices internal views, non-portaled source-owned class catalogues, click-sticky Current Selection, right-panel feat/class-option confirmation, accurate active/source summaries, readable feat rules, and protected boundaries are intact.");
