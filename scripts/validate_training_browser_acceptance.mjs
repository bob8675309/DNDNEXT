import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const responsive = read("styles/character-forge-responsive.css");
const playerTraining = read("components/NpcForgeTrainingStepPlayer.js");
const sourceContext = read("components/NpcForgeSourceChoiceContext.js");
const routedController = read("components/useNpcForgeTrainingRoutedController.js");

const authoritativeTrainingSplit = ".npc-forge-body.is-player-mode.npc-forge-step-4{grid-template-columns:minmax(390px,2fr) minmax(0,3fr)!important}";
const rejectedTrainingSplit = ".npc-forge-body.is-player-mode.npc-forge-step-4{grid-template-columns:minmax(0,64fr) minmax(310px,36fr)!important}";
assert(responsive.includes(authoritativeTrainingSplit), "Global player Training step must use the authoritative 40/60 choice/detail split.");
assert(!responsive.includes(rejectedTrainingSplit), "Legacy 64/36 Training split still overrides the accepted 40/60 browser layout.");
assert(playerTraining.includes("grid-template-columns:minmax(390px,2fr) minmax(0,3fr)!important"), "Training component must agree with the authoritative 40/60 desktop split.");

for (const token of [
  "normalizeCrafterProfessionChoices",
  'label: "Crafter — Profession Skills"',
  'id: "profession-skills"',
  'label: "Choose profession skill"',
  "count: 3",
  "TRADE_SKILL_KEYS.map",
  "value: definition.tool",
  "label: definition.label",
  'campaignRule: "crafter-profession-skills"',
  "do not consume the class Skill / Trade Skill allowance",
]) assert(sourceContext.includes(token), `Crafter Profession Skill adaptation is missing ${token}`);
assert(sourceContext.includes("normalizeProficiencyFeatDecisionSurface") && sourceContext.includes("beside the feat rules in Training → Feats"), "Proficiency-feat helper copy must point players to the right-side Feats decision surface.");

for (const token of [
  "previewBackground",
  'controller.stepKey === "background"',
  "!controller.loadingCatalogs",
  "controller.filteredBackgrounds?.[0]",
  "controller.backgroundOptions?.[0]",
  "controller.selectedBackground",
  'previewOnly: true',
  "controller.setDetail?.({ type: \"background\", option: previewBackground, previewOnly: true })",
]) assert(routedController.includes(token), `Initial refined Background preview is missing ${token}`);
assert(!routedController.includes("chooseBackground(previewBackground)"), "Background preview must never auto-select/commit the first Background.");

const protectedSources = `${responsive}\n${sourceContext}\n${routedController}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "world-map", "town map", "city map"]) {
  assert(!protectedSources.includes(token), `Browser acceptance patch unexpectedly references protected map behavior: ${token}`);
}

console.log("Training browser acceptance validation passed: authoritative 40/60 layout, Crafter three Profession Skill grants with mapped tools, right-side proficiency-feat guidance, and refined uncommitted Background preview are intact.");
