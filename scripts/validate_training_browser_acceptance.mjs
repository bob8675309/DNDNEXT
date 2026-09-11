import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read("pages/_app.js");
const responsive = read("styles/character-forge-responsive.css");
const browserPolish = read("styles/character-forge-browser-review-polish.css");
const playerTraining = read("components/NpcForgeTrainingStepPlayer.js");
const playerTabbed = read("components/NpcForgeTrainingStepPlayerTabbed.js");
const sourceContext = read("components/NpcForgeSourceChoiceContext.js");
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
  "chooseSourceMappedOption(sourceRef, option)",
]) assert(playerTraining.includes(token), `Trade Skill surface must own source-granted Profession choices: missing ${token}`);

for (const token of [
  "const standaloneHeading",
  "standaloneHeading && paragraphs[index + 1]",
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
assert(!trainingContext.includes("groupsOverride={trainingGroups}"), "The Feats dossier must not render Skills-routed Crafter Profession controls.");
assert(!trainingContext.includes('<h4>Feat Rules</h4><p>{feat.description'), "Training must not dump raw unformatted feat descriptions directly into the dossier.");

for (const token of [
  "npc-forge-training-mode-switch{display:flex",
  "border-radius:999px",
  "Crafter's Profession grants are the exception and resolve in Skills",
  "Feat-granted Profession choices such as Crafter also resolve here",
]) assert(playerTabbed.includes(token), `Segmented Skills/Feats pill or routing copy is missing ${token}`);

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
  ".npc-forge-training-feat-rule-list > article + article:not(:has(> strong))",
  ".npc-forge-training-feat-rule-list > article:first-child:not(:has(> strong))",
  ".npc-forge-training-feat-help",
  ".npc-forge-training-tabbed-help",
  ".npc-forge-training-feat-followups button.has-spells",
  ".npc-forge-training-feat-list",
  "max-height: clamp(228px, calc(100dvh - 430px), 500px)",
  ".npc-forge-training-context-note",
  "height: calc(100dvh - 190px)",
]) assert(browserPolish.includes(token), `Latest Feats compaction / continuation polish is missing ${token}`);

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

const protectedSources = `${responsive}\n${browserPolish}\n${sourceContext}\n${trainingContext}\n${playerTabbed}\n${routedController}\n${contextPanel}\n${backgroundEmpty}`.toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "world-map", "town map", "city map"]) {
  assert(!protectedSources.includes(token), `Browser acceptance patch unexpectedly references protected map behavior: ${token}`);
}

console.log("Training browser acceptance validation passed: authoritative 40/60 layout, Crafter three free Profession choices routed through Skills/Trade Skills, Background features lifted under Skills, continuation feat prose visually grouped, redundant Feats helper/spell-only rows removed, full-height Current Selection, segmented Training pill, and first-Background default selection are intact.");
