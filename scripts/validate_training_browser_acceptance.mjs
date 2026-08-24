import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const responsive = read("styles/character-forge-responsive.css");
const playerTraining = read("components/NpcForgeTrainingStepPlayer.js");
const sourceContext = read("components/NpcForgeSourceChoiceContext.js");
const sourceFields = read("components/SourceChoiceFields.js");
const trainingContext = read("components/NpcForgeTrainingContextCard.js");
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
  'campaignRule: "crafter-profession-skills"',
  "do not consume the class Skill / Trade Skill allowance",
]) assert(sourceContext.includes(token), `Crafter Profession Skill adaptation is missing ${token}`);
assert(sourceContext.includes("normalizeProficiencyFeatDecisionSurface") && sourceContext.includes("beside the feat rules in Training → Feats"), "Proficiency-feat helper copy must point players to the right-side Feats decision surface.");

for (const token of [
  "function ProfessionChoiceField",
  "npc-forge-profession-choice__grid",
  "field.metadata?.professionChoice",
  "selected.length >= count",
  "onToggle?.(group.id, field.id, option.key)",
]) assert(sourceFields.includes(token), `Crafter Profession Skill control is missing ${token}`);
assert(sourceFields.includes("field.metadata?.professionChoice ? <ProfessionChoiceField"), "Profession choices must bypass the generic multi-tool dropdown renderer.");

for (const token of [
  "function featRuleSections",
  'normalized(feat.name) === "crafter"',
  'title: "Profession Training"',
  "Choose any three of Alchemy, Smithing, Scribe, Enchanting, Cooking, Tinkering, Jewelcraft, or Brewing",
  'title: "Discount"',
  'title: "Fast Crafting"',
  "only the three proficiency selections are replaced by Profession Skills",
  "<FeatRuleList feat={feat} matchingGroups={matchingGroups} />",
]) assert(trainingContext.includes(token), `Crafter formatted rule dossier is missing ${token}`);
assert(!trainingContext.includes('<h4>Feat Rules</h4><p>{feat.description'), "Training must not dump the raw unformatted Crafter/source feat description directly into the dossier.");

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

const protectedSources = `${responsive}\n${sourceContext}\n${sourceFields}\n${trainingContext}\n${routedController}\n${contextPanel}\n${backgroundEmpty}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "world-map", "town map", "city map"]) {
  assert(!protectedSources.includes(token), `Browser acceptance patch unexpectedly references protected map behavior: ${token}`);
}

console.log("Training browser acceptance validation passed: authoritative 40/60 layout, Crafter three direct Profession Skill choices with mapped-tool persistence and formatted campaign rules, and first-Background default selection with refined fallback are intact.");
