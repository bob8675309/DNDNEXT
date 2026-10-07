import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read("pages/_app.js");
const responsive = read("styles/character-forge-responsive.css");
const browserPolish = read("styles/character-forge-browser-review-polish.css");
const playerTraining = read("components/NpcForgeTrainingStepPlayer.js");
const featPicker = read("components/NpcForgeTrainingFeatPicker.js");
const spellStep = read("components/NpcForgeSpellStep.js");
const classFeatureChoices = read("components/NpcForgeClassFeatureChoices.js");
const classOptionBrowser = read("components/NpcForgeClassOptionBrowser.js");
const playerTabbed = read("components/NpcForgeTrainingStepPlayerTabbed.js");
const sourceContext = read("components/NpcForgeSourceChoiceContext.js");
const trainingContext = read("components/NpcForgeTrainingContextCard.js");
const sharedSourceFields = read("components/SourceChoiceFields.js");
const featChoices = read("utils/playerForgeFeatChoices.js");
const featRegistrar = read("components/NpcForgeFeatChoiceRegistrar.js");
const featRulePresentation = read("utils/featRulePresentation.js");
const classFeatureChoiceParsing = read("utils/classFeatureChoiceParsing.js");
const invocationChoices = read("utils/warlockInvocationChoices.js");
const classChoiceConstants = read("utils/classFeatureChoiceConstants.js");
const featChoiceRouting = read("utils/playerForgeFeatChoiceRouting.js");
const profileFeatures = read("components/CharacterFeaturesPanel.js");
const routedController = read("components/useNpcForgeTrainingRoutedController.js");
const contextPanel = read("components/NpcForgeContextPanel.js");
const backgroundEmpty = read("components/NpcForgeBackgroundEmptyState.js");

const authoritativeTrainingSplit = ".npc-forge-body.is-player-mode.npc-forge-step-4{grid-template-columns:minmax(390px,2fr) minmax(0,3fr)!important}";
const rejectedTrainingSplit = ".npc-forge-body.is-player-mode.npc-forge-step-4{grid-template-columns:minmax(0,64fr) minmax(310px,36fr)!important}";
assert(responsive.includes(authoritativeTrainingSplit), "Global player Training step must use the authoritative 40/60 choice/detail split.");
assert(!responsive.includes(rejectedTrainingSplit), "Legacy 64/36 Training split still overrides the accepted 40/60 browser layout.");
assert(playerTraining.includes("grid-template-columns:minmax(390px,2fr) minmax(0,3fr)!important"), "Training component must agree with the authoritative 40/60 desktop split.");

for (const token of [
  "normalizeCrafterProfessionChoices",
  'label: "Crafter — Profession Skills"',
  'id: "profession-skills"',
  'label: "Choose three Profession Skills"',
  "count: 3",
  "TRADE_SKILL_KEYS.map",
  "value: definition.tool",
  "label: definition.label",
  'professionChoice: true',
  'trainingSection: "skills"',
  'campaignRule: "crafter-profession-skills"',
  "Training → Skills → Trade Skills",
  "do not consume the class Skill / Trade Skill allowance",
  "const crafterProfessionSkills",
  '? crafterProfessionSkills ? "training" : "class"',
]) assert(sourceContext.includes(token), `Crafter Skills-routed Profession adaptation is missing ${token}`);
assert(sourceContext.includes("normalizeProficiencyFeatDecisionSurface") && sourceContext.includes("beside the feat rules in Training → Feats"), "Other proficiency-feat helper copy must still point players to the right-side Feats decision surface.");

for (const token of [
  "const sourceTradeFields",
  "sourceFieldForKey(sourceTradeFields, key, \"professionKey\")",
  "sourceAvailable ? `Available from ${grantSource}`",
  "sourceGranted ? `Granted by ${grantSource}`",
  'selectionKind = sourceGranted ? "granted-profession"',
]) assert(playerTraining.includes(token), `Trade Skill surface must expose source-granted Profession choices without mutating them on row click: missing ${token}`);
assert(trainingContext.includes('detail?.selectionKind === "source-profession"') && trainingContext.includes("setSourceChoice?.(detail.sourceGroupId, detail.sourceFieldId, next)"), "Source-granted Profession choices must be confirmed from Current Selection.");

for (const token of [
  "featRuleSectionsFromDescription",
  "npc-forge-training-feat-rule-intro",
  "skillsRoutedGroups",
  "featTrainingGroups",
  "Profession choices resolve in Skills",
  "Skills → Trade Skills",
  "groupsOverride={featTrainingGroups}",
  'title: "Profession Training"',
  'title: "Discount"',
  'title: "Fast Crafting"',
]) assert(trainingContext.includes(token), `Feat dossier cleanup / Crafter routing is missing ${token}`);
for (const token of ["looksLikeRuleHeading", "titleLike.length / significant.length >= 0.8", "flushProse", "formatPlayerFacingText", "with|over|by|as"]) assert(featRulePresentation.includes(token), `Shared feat rule formatter is missing ${token}`);
assert(classFeatureChoiceParsing.includes('"doing one of the following"'), "Runtime Rage instructions must not surface as a Class Choice.");
assert(!trainingContext.includes("groupsOverride={trainingGroups}"), "The Feats dossier must not render Skills-routed Crafter Profession controls.");
assert(!trainingContext.includes('<h4>Feat Rules</h4><p>{feat.description'), "Training must not dump raw unformatted feat descriptions directly into the dossier.");
assert(playerTraining.includes("backgroundSourceLabel") && playerTraining.includes("classSourceLabel") && playerTraining.includes("sourceOwnerLabel={selectedClassName || \"Class\"}"), "Skills and feature-owned Training choices must expose their actual Background/Class provenance.");
assert(classFeatureChoices.includes("npc-forge-class-choice-source") && classFeatureChoices.includes("Granted by") && classFeatureChoices.includes("group.subclassName || sourceOwnerLabel"), "Expertise and other class/subclass feature choices must identify the granting feature and owner.");
assert(playerTraining.includes("npc-forge-training-feat-only") && playerTraining.includes("npc-forge-training-class-only"), "Feat and class-option controls must be separated into distinct Training subviews.");
assert(playerTraining.includes("NpcForgeClassOptionBrowser") && playerTraining.includes("groups={classOptionGroups}"), "Class Choices must render source-backed catalogues inside the left workspace.");
assert(playerTraining.includes('group.ownerType !== "feat" && group.ownerType !== "class-option"'), "Source-owned class-option groups must not be rendered a second time through the generic source-choice surface.");
assert(playerTraining.includes("inspectOnly onDetail={onDetail}") && classFeatureChoices.includes('type: "classFeatureOption"') && classFeatureChoices.includes("npc-forge-class-choice-inspect-list"), "Regular class/subclass choices must inspect on the left and defer description/selection to Current Selection.");
assert(trainingContext.includes('detail?.type === "classFeatureOption"') && trainingContext.includes("toggleFeatureOption"), "Current Selection must own regular class feature choice confirmation.");
assert(!classFeatureChoices.includes("NpcForgeSourceChoiceFields"), "Class feature choices must not portal class-option controls into the preview rail.");
assert(classOptionBrowser.includes('type: "classSourceOption"') && classOptionBrowser.includes("Descriptions and selection stay in Current Selection") && classOptionBrowser.includes("<details") && classOptionBrowser.includes("npc-forge-class-option-group__body") && !classOptionBrowser.includes("onMouseEnter") && !classOptionBrowser.includes("onFocus"), "Source-backed Class Choices must use collapsible slots, inspect on click, and confirm on the right.");
assert(!playerTraining.includes("onMouseEnter={() => onDetail") && !playerTraining.includes("onMouseEnter={() => publishFeatGroup"), "Training Current Selection must not change merely because the pointer passes over another choice.");
assert(profileFeatures.includes("FeatureRuleText") && profileFeatures.includes("profile-feature-rule-list") && featRulePresentation.includes("featRuleSectionsFromDescription"), "Profile and Forge feat descriptions must share structured low-chrome rule formatting.");

for (const token of [
  "npc-forge-training-mode-switch{display:flex",
  "border-radius:999px",
  "is-class-choice-tab",
  "<span>Class</span><span>Choices</span>",
  "classSourceGroups",
  "Class Skill Choices",
  'label: "Background"',
  'label: "Class"',
  "activeClassFeatureGroups",
  "backgroundSourceSkillOptions",
  "Required class choices",
]) assert(playerTabbed.includes(token), `Segmented Skills/Feats/Class Choices navigation or player-facing source summary is missing ${token}`);
assert(trainingContext.includes("Where these come from"), "Training section tabs must publish source/count breakdowns into Current Selection.");
assert(!trainingContext.includes("Moving the mouse over another row will no longer replace") && trainingContext.includes("npc-forge-training-overview__source-name"), "Skills overview must remove implementation-facing helper copy and visually separate Background/Class names from their player-facing descriptions.");
assert(trainingContext.includes('detail?.type === "classSourceOption"') && trainingContext.includes("toggleChoice: toggleSourceChoice") && trainingContext.includes('"Replace Selection"') && trainingContext.includes("dossier?.scrollTo?.({ top: 0"), "Current Selection must own source-backed Class Choice confirmation and reset its scroll position on deliberate clicks.");
assert(trainingContext.includes('"Select Skill"') && trainingContext.includes('"Deselect Skill"') && trainingContext.includes('"Select Trade Skill"') && playerTraining.includes("sourceChoiceSelected") && playerTraining.includes("fixedSourceGranted"), "Skills must browse on the left and support Select/Deselect from Current Selection without treating removable source choices as fixed grants.");
assert(featPicker.includes("sortMode") && featPicker.includes("prerequisiteFilter") && featPicker.includes("categoryLabel") && featPicker.includes("Name A–Z") && featPicker.includes("Required level"), "Feat catalogue must provide player-readable category names, prerequisite filtering, and explicit sorting controls.");
assert(spellStep.includes("components_v,components_s,components_m,material_text") && !spellStep.includes("components_text"), "Spell catalogue query must match the live spells_catalog schema.");
const invocationOptionBody = invocationChoices.slice(invocationChoices.indexOf("function invocationOption"), invocationChoices.indexOf("function selectedOption"));
assert(invocationOptionBody.includes("INVOCATION_PLAYER_GUIDES[norm(row.name)]") && invocationOptionBody.includes("playerRules: array(guide?.rules)") && invocationOptionBody.includes('classKey: row.class_key || "warlock"'), "Invocation choices must expose complete player-facing guidance and class-aware prerequisites when imported descriptions are null.");
for (const token of [
  '"pact of the blade": Object.freeze({',
  '"pact of the tome": Object.freeze({',
  '"gaze of two minds": Object.freeze({',
  '"fiendish vigor": Object.freeze({',
  '"investment of the chain master": Object.freeze({',
  '"gift of the protectors": Object.freeze({',
  "30 feet for each Warlock level",
  "highest possible result on its Temporary Hit Point die",
  "three chosen cantrips and two chosen level-1 ritual spells",
]) assert(classChoiceConstants.includes(token), `Player-facing Invocation guide is missing ${token}`);
assert(classChoiceConstants.includes('"one with shadows": Object.freeze({') && !classChoiceConstants.includes("Become Invisible in dim light or darkness until you move, act, or react."), "One with Shadows must use the XPHB rule rather than the legacy move/action/reaction ending text.");
assert(classChoiceConstants.includes('"visions of distant realms": { minLevel: 9 }'), "XPHB Visions of Distant Realms must unlock at Warlock level 9.");
assert(trainingContext.includes("npc-forge-training-option-rules") && trainingContext.includes("Rules and limits") && trainingContext.includes("option.metadata?.playerRules"), "Current Selection must keep concise Invocation text visible and put detailed limits in a collapsible rules section.");
assert(sharedSourceFields.includes("CompactFixedFacts") && sharedSourceFields.includes("is-compact-group") && sharedSourceFields.includes("defaultOpen={!complete}") && sharedSourceFields.includes("npc-forge-rich-choice__rules"), "Source choices must support compact completed groups, inline fixed facts, and collapsible detailed rules.");
assert(sharedSourceFields.includes("classLabel(option.metadata?.classKey || group.metadata?.classKey)") && !sharedSourceFields.includes("Artificer level ${value}+"), "Source-choice prerequisites must identify the owning class instead of hard-coding Artificer.");
assert(featChoiceRouting.includes("gives you Magic Initiate") && featChoiceRouting.includes("best eligible spellcasting ability"), "Magic Initiate routing copy must remain compact and player-facing.");
assert(featChoices.includes('name === "metamagic adept"') && featChoices.includes('label: "Choose two Metamagic options"') && featChoices.includes('kind: "metamagic"') && featChoices.includes("count: 2") && featChoices.includes("OPTION_SUMMARIES[norm(row.name)]"), "Metamagic Adept must create a required two-option Metamagic choice with player-facing option summaries.");
assert(featRegistrar.includes('.eq("option_type", "metamagic")') && featRegistrar.includes('metamagicOptions: metamagicOptionRows') && featRegistrar.includes("metamagicOptionReady"), "Feat registration must load the canonical Metamagic catalogue before publishing Metamagic Adept choices.");
assert(sharedSourceFields.includes('"artificer-plan", "metamagic"') && sharedSourceFields.includes("RichField"), "Metamagic choices must use the rich inspect-and-choose source-choice presentation.");
assert(spellStep.includes('import SpellCard from "./SpellCard";') && spellStep.includes("profile-catalogue-workspace") && spellStep.includes("profile-catalogue__preview") && spellStep.includes("headerAction={<button") && spellStep.includes("npc-forge-spell-card-select") && spellStep.includes('inline compact groupsOverride={sourceSpellGroups}'), "Forge Spells must use the profile-style list + SpellCard preview, top-right Select action, and compact inline source-owned spell controls.");
assert(!spellStep.includes("npc-forge-auto-casting-list") && spellStep.includes("do not use your class spell picks"), "Source-owned magic must not repeat automatic casting ability in a second oversized card.");
assert(spellStep.includes("saving_throw_abilities,attack_type") && spellStep.includes("higher_level_text") && spellStep.includes("area_type,area_size,area_unit"), "Forge spell queries must load the fields needed by the shared SpellCard.");
assert(!spellStep.includes("openSpellId") && !spellStep.includes("npc-forge-spell-details"), "Forge Spells must not regress to per-row expandable detail dumps.");
assert(spellStep.includes("incompleteSourceSpellGroups.map((group) => group.label).join"), "Blocked spell progression must name the unresolved source-owned spell group.");

assert(app.includes('import "../styles/character-forge-browser-review-polish.css";'), "Latest Character Forge browser-review stylesheet is not loaded by _app.js.");
for (const token of [
  ".npc-forge-background-guide.is-showcase-one:has(> .npc-forge-bg-features)",
  "> .npc-forge-bg-showcase-grants",
  "display: contents !important",
  ".npc-forge-bg-showcase-skills",
  "grid-row: 3",
  ".npc-forge-bg-showcase-side",
  "grid-row: 3 / span 2",
  "> .npc-forge-bg-features",
  "grid-row: 4",
]) assert(browserPolish.includes(token), `Background feature-upflow polish is missing ${token}`);

for (const token of [
  ".npc-forge-training-mode-switch > button::after",
  ".npc-forge-training-picks",
  ".npc-forge-training-feat-picker",
  ".npc-forge-training-feat-list > button::before",
  ".npc-forge-body:has(.npc-forge-training-tabbed-shell) .npc-forge-context-panel",
]) assert(browserPolish.includes(token), `Training browse/inspect/choose visual hierarchy is missing ${token}`);

for (const token of [
  ".npc-forge-training-feat-rule-list > article",
  "border-left: 2px solid rgba(168,108,255,.38)",
  "border-radius: 0 !important",
  "background: transparent !important",
  ".npc-forge-training-feat-help",
  ".npc-forge-training-tabbed-help",
  ".npc-forge-training-feat-followups button.has-spells",
  ".npc-forge-training-feat-list",
  "max-height: clamp(228px, calc(100dvh - 430px), 500px)",
  ".npc-forge-training-context-note",
  "height: calc(100dvh - 190px)",
  ".npc-forge-training-tabbed-shell:is(.is-feats,.is-class)",
]) assert(browserPolish.includes(token), `Latest low-chrome Feats/Class Choices continuation polish is missing ${token}`);

for (const token of [
  "function initialBackground",
  "function seedInitialBackground",
  'controller.stepKey !== "background"',
  "controller.chooseBackground?.(background)",
  'controller.stepKey === "species"',
  "seedInitialBackground();",
]) assert(routedController.includes(token), `First-Background default selection is missing ${token}`);
assert(!routedController.includes("previewBackground") && !routedController.includes("previewOnly: true"), "Background initialization must be a real default selection, not a mismatched preview object.");

// Keep the refined empty dossier as a no-catalog/failure fallback only. In the
// normal player path, seedInitialBackground() fills the real dossier immediately.
assert(contextPanel.includes('import NpcForgeBackgroundEmptyState from "./NpcForgeBackgroundEmptyState"'), "Background context must retain a refined no-selection fallback.");
for (const token of ["Choose a Background", "Your life before adventuring", "History &amp; grants", "Source-backed rules"]) {
  assert(backgroundEmpty.includes(token), `Refined Background fallback is missing ${token}`);
}

const protectedSources = `${responsive}\n${browserPolish}\n${sourceContext}\n${trainingContext}\n${classOptionBrowser}\n${playerTabbed}\n${routedController}\n${contextPanel}\n${backgroundEmpty}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "world-map", "town map", "city map"]) {
  assert(!protectedSources.includes(token), `Browser acceptance patch unexpectedly references protected map behavior: ${token}`);
}

console.log("Training browser acceptance validation passed: authoritative 40/60 layout, non-portaled Class Choices catalogues, click-owned Current Selection, right-panel feat/class-option confirmation, accurate source breakdowns, subtle feat prose formatting, and first-Background default selection are intact.");
