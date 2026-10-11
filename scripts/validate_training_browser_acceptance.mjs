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
const prerequisiteFormatter = read("utils/formatPrerequisiteText.js");
const spellStep = read("components/NpcForgeSpellStep.js");
const spellCard = read("components/SpellCard.js");
const spellCardCss = read("styles/spell-card.css");
const sourceRuleContent = read("components/SourceRuleContent.js");
const spellRuleReferences = read("utils/spellRuleReferences.js");
const forgeSteps = read("components/NpcForgeStepContent.js");
const classFeatureDock = read("components/NpcForgeClassFeatureDock.js");
const playerFacingText = read("utils/playerFacingText.js");
const backgroundGuide = read("components/NpcForgeBackgroundGuideBase.js");
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
const classFeatureOptionAuthority = read("utils/classFeatureOptionAuthority.js");
const invocationChoices = read("utils/warlockInvocationChoices.js");
const classChoiceConstants = read("utils/classFeatureChoiceConstants.js");
const optionRuleEnrichment = read("sql/20261009_01_enrich_class_feature_option_rules.sql");
const referencedOptionRuleBackfill = read("sql/20261009_02_backfill_referenced_optional_feature_rules.sql");
const featChoiceRouting = read("utils/playerForgeFeatChoiceRouting.js");
const profileFeatures = read("components/CharacterFeaturesPanel.js");
const routedController = read("components/useNpcForgeTrainingRoutedController.js");
const contextPanel = read("components/NpcForgeContextPanel.js");
const stepContent = read("components/NpcForgeStepContent.js");
const validationGuidance = read("utils/forgeValidationGuidance.js");
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
assert(classFeatureChoices.includes("ChoiceHelperCopy") && classFeatureChoices.includes("npc-forge-class-choice-helper") && classFeatureChoices.includes("headingLike"), "Dense class-choice feature text must be split into readable titled sections instead of one tiny wall of text.");
assert(classFeatureChoiceParsing.includes("option.description || option.raw?.description"), "Feat-backed class options such as Fighting Styles must keep the imported feat rule instead of falling through to generic placeholder copy.");
assert(classFeatureOptionAuthority.includes("descriptionExact") && classFeatureOptionAuthority.includes("sourceDescription") && classFeatureOptionAuthority.includes("formatPlayerFacingText(row.description"), "Class option authority must resolve exact source-backed descriptions across maneuvers, Arcane Shots, runes, disciplines, Pact Boons, and imported subclass option families.");
assert(invocationChoices.includes('formatPlayerFacingText(row.description, "") || guide?.summary || OPTION_SUMMARIES[norm(row.name)]'), "Warlock Invocations must prefer their complete canonical source rule over the older concise guide summary.");
assert(featChoices.includes('formatPlayerFacingText(row.description, "") || OPTION_SUMMARIES[norm(row.name)]'), "Metamagic choice cards must prefer canonical source rules over terse summaries.");
for (const token of ["descriptionAuthority", "5etools:data/optionalfeatures.json", "battle-master-maneuver", "eldritch-invocation", "metamagic"]) assert(optionRuleEnrichment.includes(token), `Focused class-option source-rule enrichment is missing ${token}`);
for (const token of ["refOptionalfeature", "Grim Hollow - Player''s Guide - 2024.json", "arcane-shot", "rune", "elemental-discipline", "fighting-style", "pact-boon", "Referenced class optional-feature rule backfill incomplete"]) assert(referencedOptionRuleBackfill.includes(token), `Reference-driven class option rule backfill is missing ${token}`);
assert(!trainingContext.includes("npc-forge-training-context-note") && !trainingContext.includes("All choices can be reviewed on the final step"), "Training Current Selection must not restore the redundant bottom reminder.");
assert(!trainingContext.includes("groupsOverride={trainingGroups}"), "The Feats dossier must not render Skills-routed Crafter Profession controls.");
assert(!trainingContext.includes('<h4>Feat Rules</h4><p>{feat.description'), "Training must not dump raw unformatted feat descriptions directly into the dossier.");
assert(playerTraining.includes("backgroundSourceLabel") && playerTraining.includes("classSourceLabel") && playerTraining.includes("sourceOwnerLabel={selectedClassName || \"Class\"}"), "Skills and feature-owned Training choices must expose their actual Background/Class provenance.");
assert(classFeatureChoices.includes("npc-forge-class-choice-source") && classFeatureChoices.includes("Granted by") && classFeatureChoices.includes("group.subclassName || sourceOwnerLabel"), "Expertise and other class/subclass feature choices must identify the granting feature and owner.");
assert(playerTraining.includes("npc-forge-training-feat-only") && playerTraining.includes("npc-forge-training-class-only"), "Feat and class-option controls must be separated into distinct Training subviews.");
assert(playerTraining.includes("NpcForgeClassOptionBrowser") && playerTraining.includes("groups={classOptionGroups}"), "Class Choices must render source-backed catalogues inside the left workspace.");
assert(playerTraining.includes('group.ownerType !== "feat" && group.ownerType !== "class-option"'), "Source-owned class-option groups must not be rendered a second time through the generic source-choice surface.");
assert(playerTraining.includes("inspectOnly onDetail={onDetail}") && classFeatureChoices.includes('type: "classFeatureOption"') && classFeatureChoices.includes("npc-forge-class-choice-inspect-list"), "Regular class/subclass choices must inspect on the left and defer description/selection to Current Selection.");
assert(playerTraining.includes("classChoicePresentationGroups") && playerTraining.includes('group.kind === "expertise" ? { ...group, placement: "class" } : group') && playerTraining.includes("groups={classChoicePresentationGroups}"), "Class Choices must mirror the existing Expertise group without duplicating its persistence state.");
assert(trainingContext.includes("expertiseExplanation") && trainingContext.includes("Expertise doubles your Proficiency Bonus") && trainingContext.includes("Granted by") && trainingContext.includes('detail?.type === "classFeatureOption"'), "Current Selection must explain what Expertise does and preserve class/source provenance.");
assert(trainingContext.includes('detail?.type === "classFeatureOption"') && trainingContext.includes("toggleFeatureOption"), "Current Selection must own regular class feature choice confirmation.");
assert(!playerTraining.includes("Trade Skills measure crafting proficiency") && !playerTraining.includes("Background tool proficiencies preserve their original rules value"), "Player Training must not expose internal Trade Skill mapping/compatibility prose.");
assert(!classFeatureChoices.includes("NpcForgeSourceChoiceFields"), "Class feature choices must not portal class-option controls into the preview rail.");
assert(classOptionBrowser.includes('type: "classSourceOption"') && classOptionBrowser.includes("Descriptions and selection stay in Current Selection") && classOptionBrowser.includes("<details") && classOptionBrowser.includes("npc-forge-class-option-group__body") && !classOptionBrowser.includes("onMouseEnter") && !classOptionBrowser.includes("onFocus"), "Source-backed Class Choices must use collapsible slots, inspect on click, and confirm on the right.");
assert(classFeatureChoices.includes("npc-forge-class-choice-chevron") && classFeatureChoices.includes("{!inspectOnly ? <header>") && classFeatureChoices.includes("{!inspectOnly ? <>") && trainingContext.includes("ClassChoiceRuleCopy") && trainingContext.includes("npc-forge-training-class-rule-chevron"), "Class Choices must keep the left browse surface compact while full source-rule sections remain in Current Selection.");
assert(!playerTraining.includes("onMouseEnter={() => onDetail") && !playerTraining.includes("onMouseEnter={() => publishFeatGroup"), "Training Current Selection must not change merely because the pointer passes over another choice.");
assert(profileFeatures.includes("FeatureRuleText") && profileFeatures.includes("profile-feature-rule-list") && featRulePresentation.includes("featRuleSectionsFromDescription"), "Profile and Forge feat descriptions must share structured low-chrome rule formatting.");

for (const token of [
  "npc-forge-training-mode-switch{display:flex",
  "border-radius:999px",
  "is-class-choice-tab",
  "<strong>Class Choices</strong>",
  "npc-forge-training-tab-status",
  "npc-forge-training-tab-copy",
  "backgroundSkillCount",
  "availableClassSkillSlots",
  "skillsProgress",
  "featsProgress",
  "classTabProgress",
  "fraction(skillsProgress)",
  "fraction(featsProgress)",
  "fraction(classTabProgress)",
  "classSourceGroups",
  "Class Skill Choices",
  'label: "Background"',
  'label: "Class"',
  "activeClassFeatureGroups",
  "backgroundSourceSkillOptions",
  "Class and subclass choices at this level",
]) assert(playerTabbed.includes(token), `Segmented Skills/Feats/Class Choices navigation, progress fraction, or player-facing source summary is missing ${token}`);
assert(playerTabbed.includes("<strong>Skills &amp; Trade Skills</strong>"), "Training must label the combined Skills workspace as Skills & Trade Skills.");
const featFractionBlock = playerTabbed.slice(playerTabbed.indexOf("const featsProgress ="), playerTabbed.indexOf("const classTabProgress"));
assert(featFractionBlock.includes("otherGrantedFeatUnits") && !featFractionBlock.includes("featProgress"), "Feat progress must count feat instances rather than nested feat-owned decisions.");
assert(!playerTabbed.includes("Skills, Trade Skills &amp; additional training") && !playerTabbed.includes("Feat catalogue &amp; feat-owned follow-ups") && !playerTabbed.includes("Invocations, styles, maneuvers &amp; class options") && !playerTabbed.includes("npc-forge-training-tabbed-help"), "Training tabs must omit the retired tiny subtitles and bottom implementation helper.");
assert(trainingContext.includes("Where these come from"), "Training section tabs must publish source/count breakdowns into Current Selection.");
assert(!trainingContext.includes("Moving the mouse over another row will no longer replace") && trainingContext.includes("npc-forge-training-overview__source-name"), "Skills overview must remove implementation-facing helper copy and visually separate Background/Class names from their player-facing descriptions.");
assert(trainingContext.includes("PROFESSION_DESCRIPTIONS") && trainingContext.includes("Alchemy covers brewing potions, elixirs, oils, bombs, and other alchemical creations.") && !trainingContext.includes("ordinary copy or incidental tool grant") && !trainingContext.includes("explicitly grants this Trade Skill because"), "Trade Skill dossiers must stay player-facing and omit internal tool-to-proficiency explanations.");
assert(trainingContext.includes('detail?.type === "classSourceOption"') && trainingContext.includes("toggleChoice: toggleSourceChoice") && trainingContext.includes('"Replace Selection"') && trainingContext.includes("dossier?.scrollTo?.({ top: 0"), "Current Selection must own source-backed Class Choice confirmation and reset its scroll position on deliberate clicks.");
assert(trainingContext.includes('"Select Skill"') && trainingContext.includes('"Deselect Skill"') && trainingContext.includes('"Select Trade Skill"') && playerTraining.includes("sourceChoiceSelected") && playerTraining.includes("fixedSourceGranted"), "Skills must browse on the left and support Select/Deselect from Current Selection without treating removable source choices as fixed grants.");
assert(playerTraining.includes("npc-forge-training-expertise-tag") && playerTraining.includes("skillHasExpertise") && !playerTraining.includes("Add Expertise") && !playerTraining.includes("toggleExpertiseFlag"), "Skills must show a passive gold Expertise tag only after Expertise is chosen in Class Choices.");
assert(classOptionBrowser.includes("if (!visibleGroups.length) return null;"), "Empty source-backed Class Choice families must not reserve dead space.");
assert(playerTraining.includes("grantedFeats={controller.selectedBackgroundFeat") && featPicker.includes("is-granted"), "Background-granted feats such as Magic Initiate must pin at the top of the main Feat catalogue.");
assert(featPicker.includes("sortMode") && featPicker.includes("prerequisiteFilter") && featPicker.includes("categoryLabel") && featPicker.includes("Name A–Z") && featPicker.includes("Required level"), "Feat catalogue must provide player-readable category names, prerequisite filtering, and explicit sorting controls.");
assert(featPicker.includes("grantedFeats = []") && featPicker.includes("grantByIdentity") && featPicker.includes("pinnedKeys") && featPicker.includes("is-granted") && featPicker.includes('selectionKind: "granted-feat"'), "Selected and granted feats must pin to the top of the Feat catalogue while preserving their ownership.");
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
assert(trainingContext.includes("featAbilityBonusPresentation") && trainingContext.includes("Ability Score Bonus") && trainingContext.includes("This feat grants a +") && trainingContext.includes("bonus to any ability score.") && trainingContext.includes("bonus to one of the following ability scores:") && trainingContext.includes("simpleFeatAbilityChoices") && trainingContext.includes("FeatAbilityChoice") && trainingContext.includes("StaticFeatAbilityBonus") && trainingContext.includes("npc-forge-training-feat-choice-chevron") && trainingContext.includes("setOpen(false)") && trainingContext.includes("compactAbilityFieldIds") && !trainingContext.includes("featAbilityIncreaseRule"), "Every source-backed feat ability bonus must be visible in Feat Rules before feat selection, while selected simple choices retain the compact auto-collapsing chooser.");
assert(trainingContext.includes("npc-forge-training-feat-ability-choice>div button") && trainingContext.includes("border-radius:999px"), "Feat-owned simple ability choices must use compact pill options inside the chevron disclosure.");
for (const token of ["SourceSpellField", "sourceSpellFromOption", "profile-catalogue", "npc-forge-source-spell-picker__table-head", "<SpellCard", 'field.kind === "spell"']) assert(sharedSourceFields.includes(token), `Feat/source spell picker must match the normal row-list + SpellCard browser: missing ${token}`);
assert(featChoices.includes("spell: { ...spell }"), "Feat spell options must retain their canonical spell row for the shared SpellCard.");
assert(featRegistrar.includes("higher_level_text") && featRegistrar.includes("raw_payload") && featRegistrar.includes("material_text") && featRegistrar.includes("saving_throw_abilities"), "Feat spell registration must load the full canonical SpellCard fields.");
assert(sharedSourceFields.includes("classLabel(option.metadata?.classKey || group.metadata?.classKey)") && !sharedSourceFields.includes("Artificer level ${value}+"), "Source-choice prerequisites must identify the owning class instead of hard-coding Artificer.");
assert(featChoiceRouting.includes("gives you Magic Initiate") && featChoiceRouting.includes("best eligible spellcasting ability"), "Magic Initiate routing copy must remain compact and player-facing.");
assert(featChoices.includes('name === "metamagic adept"') && featChoices.includes('label: "Choose two Metamagic options"') && featChoices.includes('kind: "metamagic"') && featChoices.includes("count: 2") && featChoices.includes("OPTION_SUMMARIES[norm(row.name)]"), "Metamagic Adept must create a required two-option Metamagic choice with player-facing option summaries.");
assert(featRegistrar.includes('.eq("option_type", "metamagic")') && featRegistrar.includes('metamagicOptions: metamagicOptionRows') && featRegistrar.includes("metamagicOptionReady"), "Feat registration must load the canonical Metamagic catalogue before publishing Metamagic Adept choices.");
assert(sharedSourceFields.includes('"artificer-plan", "metamagic"') && sharedSourceFields.includes("RichField"), "Metamagic choices must use the rich inspect-and-choose source-choice presentation.");
assert(spellStep.includes('import SpellCard from "./SpellCard";') && spellStep.includes("profile-catalogue-workspace") && spellStep.includes("profile-catalogue__preview") && spellStep.includes("headerAction={<button") && spellStep.includes("npc-forge-spell-card-select") && spellStep.includes('inline compact groupsOverride={sourceSpellGroups}'), "Forge Spells must use the profile-style list + SpellCard preview, top-right Select action, and compact inline source-owned spell controls.");
assert(spellStep.includes("npc-forge-spell-table-head") && spellStep.includes("sortKey") && spellStep.includes("sortDirection") && !spellStep.includes("npc-forge-spell-catalogue-level"), "Forge spell choices must use the compact sortable one-row catalogue instead of three-line level-group cards.");
assert(spellStep.includes("selectionLimitFor") && spellStep.includes("canAddSpell") && spellStep.includes("Cantrip limit reached"), "Forge spell selection must hard-stop cantrip/leveled over-selection in the client instead of relying only on final validation.");
assert(spellStep.includes("scaling_text,scaling_json,raw_payload") && spellStep.includes("compressed"), "Forge spell details must load canonical scaling/raw structure and use the less-zoomed compact SpellCard presentation.");
assert(spellCard.includes("SourceRuleContent") && spellCard.includes("Spell Progression") && spellCard.includes("entriesHigherLevel") && spellCard.includes("scalingProfile"), "Shared SpellCard must render structured rules and collapsible spell progression.");
assert(spellCard.includes('<section className="spell-card__description">') && spellCard.includes('<details className="spell-card__progression">') && !spellCard.includes('spell-card__higher spell-card__progression'), "Spell Progression must live inside the main description box rather than a second outer bubble.");
for (const token of ["source-rule-content__disclosure", "Additional rules", "following effects", "onReferenceDetail", "source-rule-content__inline-reference", "@media print"]) assert(sourceRuleContent.includes(token), `Digital spell rule formatting is missing ${token}`);
for (const token of ["Bestial Spirit", "Hindered by Ice", "Difficult Terrain", "spellRuleReferenceDetail", "statBlock"]) assert(spellRuleReferences.includes(token), `Spell rules reference catalogue is missing ${token}`);
assert(spellStep.includes("onReferenceDetail = null") && spellStep.includes("onReferenceDetail={onReferenceDetail}") && forgeSteps.includes("onReferenceDetail={setClassFeatureDetail}") && classFeatureDock.includes('detail?.type === "rulesReference"'), "Spell terms/stat blocks must route into the existing movable Class Feature window.");
assert(spellCardCss.includes(".spell-card__body") && spellCardCss.includes(".spell-card--compressed") && spellCardCss.includes(".spell-card__progression") && spellCardCss.includes("scrollbar-gutter: stable"), "Compact SpellCard must use one bounded scroll body with a chevron progression section.");
assert(spellCardCss.includes(".spell-card__description .source-rule-content__disclosure") && spellCardCss.includes("@media print") && spellCardCss.includes("details:not([open]) > *:not(summary)"), "Spell digital disclosures must stay low-chrome on screen and expand into a printer-friendly card.");
assert(playerFacingText.includes("ITEM_PROPERTY_LABELS") && playerFacingText.includes('L: "Light"') && playerFacingText.includes('F: "Finesse"') && playerFacingText.includes('R: "Reach"'), "Imported weapon-property shorthand must expand to player-facing names inside spell/source rules.");
assert(!backgroundGuide.includes("Use this history to choose former allies"), "Background player view must not restore the redundant bottom routing/instruction strip.");
assert(!spellStep.includes("npc-forge-auto-casting-list") && spellStep.includes("do not use your class spell picks"), "Source-owned magic must not repeat automatic casting ability in a second oversized card.");
assert(spellStep.includes("saving_throw_abilities,attack_type") && spellStep.includes("higher_level_text") && spellStep.includes("area_type,area_size,area_unit"), "Forge spell queries must load the fields needed by the shared SpellCard.");
assert(!spellStep.includes("openSpellId") && !spellStep.includes("npc-forge-spell-details"), "Forge Spells must not regress to per-row expandable detail dumps.");
assert(spellStep.includes("incompleteSourceSpellGroups.map((group) => group.label).join"), "Blocked spell progression must name the unresolved source-owned spell group.");

assert(app.includes('import "../styles/character-forge-browser-review-polish.css";'), "Latest Character Forge browser-review stylesheet is not loaded by _app.js.");
assert(browserPolish.includes(".npc-forge-body.is-player-mode.npc-forge-step-background") && browserPolish.includes(".npc-forge-catalog-list") && browserPolish.includes("max-height: none !important") && browserPolish.includes("flex: 1 1 0 !important"), "Player Background catalogue must extend through the available desktop height instead of stopping at the old generic list cap.");
assert(stepContent.includes('!playerMode ? <div className="npc-forge-workspace-note mt-3"') && !stepContent.includes('{playerMode ? <div className="npc-forge-workspace-note mt-3">Background features'), "Player Background must not show the implementation-facing source-routing note.");
assert(browserPolish.includes("Final browser-review readability floor") && browserPolish.includes(".npc-forge-class-choice-inspect strong") && browserPolish.includes("font-size: .72rem !important") && browserPolish.includes(".npc-forge-training-skill-main b"), "Training and Class Choice player text must retain the moderately enlarged readability floor.");
assert(validationGuidance.includes(".npc-forge-training-class-only .npc-forge-class-choice-group.is-required") && validationGuidance.includes(".npc-forge-training-class-only .npc-forge-class-choice-inspect") && !validationGuidance.includes(".npc-forge-training-expertise-guide"), "Expertise validation must point only to Class Choices.");
assert(featPicker.includes("formatPlayerFacingPrerequisiteText") && prerequisiteFormatter.includes("formatPlayerFacingPrerequisiteText"), "Feat catalogue prerequisite copy must use the player-facing campaign-gate filter without deleting source metadata.");
assert(prerequisiteFormatter.includes("formatOtherSummary") && prerequisiteFormatter.includes('if (key === "otherSummary") return formatOtherSummary(value);') && prerequisiteFormatter.includes('replace(/^When Gaining\\b/, "When gaining")'), "Imported otherSummary prerequisites must be translated into player-facing special acquisition text.");
assert(trainingContext.includes("featCategoryLabel") && trainingContext.includes('"FS:R": "Ranger Fighting Style"') && trainingContext.includes('"FS:P": "Paladin Fighting Style"'), "Feat Current Selection must show player-facing Fighting Style category names instead of FS:R/FS:P importer codes.");
assert(trainingContext.includes('"Deselect Feat"') && trainingContext.includes('"Replace Feat"') && trainingContext.includes("identityMatches"), "Bonus Feats must be replaceable/deselectable and feat-instance matching must remain identity-safe.");
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
  "height: fit-content !important",
  "min-height: 0 !important",
  "max-height: calc(100dvh - 218px)",
  ".npc-forge-training-tabbed-shell:is(.is-feats,.is-class)",
]) assert(browserPolish.includes(token), `Latest low-chrome Feats/Class Choices continuation polish is missing ${token}`);
assert(!/\n\s*height:\s*calc\(100dvh - 190px\)\s*!important;/.test(browserPolish), "Class Choices Current Selection must not be forced to viewport height; short rules should end the card.");
assert(browserPolish.includes("grid-template-rows: auto auto !important") && browserPolish.includes("grid-row: 2 !important") && browserPolish.includes("justify-self: start !important"), "Training Needs choice / No choices badges must sit on their own row below tab labels instead of overlapping Skills or Class Choices.");

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
