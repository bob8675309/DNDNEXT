import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const responsive = read("styles/character-forge-responsive.css");
const playerTraining = read("components/NpcForgeTrainingStepPlayer.js");
const sourceContext = read("components/NpcForgeSourceChoiceContext.js");
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
  'label: "Choose profession skill"',
  "count: 3",
  "TRADE_SKILL_KEYS.map",
  "value: definition.tool",
  "label: definition.label",
  'campaignRule: "crafter-profession-skills"',
  "do not consume the class Skill / Trade Skill allowance",
]) assert(sourceContext.includes(token), `Crafter Profession Skill adaptation is missing ${token}`);
assert(sourceContext.includes("normalizeProficiencyFeatDecisionSurface") && sourceContext.includes("beside the feat rules in Training → Feats"), "Proficiency-feat helper copy must point players to the right-side Feats decision surface.");

assert(contextPanel.includes('import NpcForgeBackgroundEmptyState from "./NpcForgeBackgroundEmptyState"'), "Background context must own the refined empty state component.");
assert(contextPanel.includes("backgroundStepActive") && contextPanel.includes("if (!activeBackground) return <NpcForgeBackgroundEmptyState />"), "Opening Background with no selection must render the refined Background surface instead of the legacy context panel.");
for (const token of ["Choose a Background", "Your life before adventuring", "History &amp; grants", "Source-backed rules", "no separate legacy information view"]) {
  assert(backgroundEmpty.includes(token), `Refined Background empty state is missing ${token}`);
}
assert(!routedController.includes("previewBackground") && !routedController.includes("previewOnly: true"), "Background empty-state presentation must not preview or auto-commit a catalogue row.");

const protectedSources = `${responsive}\n${sourceContext}\n${routedController}\n${contextPanel}\n${backgroundEmpty}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "world-map", "town map", "city map"]) {
  assert(!protectedSources.includes(token), `Browser acceptance patch unexpectedly references protected map behavior: ${token}`);
}

console.log("Training browser acceptance validation passed: authoritative 40/60 layout, Crafter three Profession Skill grants with mapped tools, right-side proficiency-feat guidance, and a refined uncommitted Background empty state are intact.");
