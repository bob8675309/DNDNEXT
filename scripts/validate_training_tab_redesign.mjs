import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const training = read("components/NpcForgeTrainingStep.js");
const legacy = read("components/NpcForgeTrainingStepBase.js");
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

assert(training.includes("NpcForgeTrainingStepBase"), "Player redesign must preserve the legacy NPC Training fallback.");
assert(training.includes("if (!props.playerMode) return <NpcForgeTrainingStepBase"), "NPC Forge must remain on the legacy Training presentation.");
assert(training.includes("Background Grants"), "Training summary must acknowledge Background grants.");
assert(training.includes("Class Skills"), "Training summary/list must retain class skill picks.");
assert(training.includes("Training Choices"), "Training-stage source choices must remain visible.");
assert(training.includes("Crafting Professions"), "Crafting professions must be in the left Training selection stack.");
assert(training.includes("Feat &amp; Class Choices"), "Feat/class choices must remain in Training.");
assert(training.includes("NpcForgeSourceChoiceFields placement=\"training\""), "Source-owned Training choices must retain their authority.");
assert(training.includes("NpcForgeSourceChoiceFields placement=\"class\" ownerType=\"feat\""), "Feat-owned follow-up choices must retain source routing.");
assert(training.includes("NpcForgeSourceChoiceFields placement=\"advancement\""), "Advancement/Epic Boon choices must remain routed.");
assert(training.includes("onToggleBackgroundSkill"), "Variable Background skill grants must remain selectable without becoming class picks.");
assert(training.includes("onToggleClassSkill"), "Class skill selection authority must remain wired.");
assert(training.includes("onSetProfession"), "Crafting profession selection authority must remain wired.");
assert(training.includes("sourceChoiceGroupComplete"), "Required source-choice completion gating must remain active.");
assert(training.includes(".npc-forge-body:has(.npc-forge-training-player-layout)"), "Approved Training/player body proportion rule is missing.");
assert(legacy.includes("Skills & Proficiencies") && legacy.includes("Feats & Class Abilities"), "Legacy NPC Training implementation was not preserved intact enough for fallback use.");

const forbidden = ["world map", "world-map", "map_routes", "advance_all_characters", "town map", "city map"];
const lower = training.toLowerCase();
for (const token of forbidden) assert(!lower.includes(token), `Training redesign unexpectedly references protected map behavior: ${token}`);

console.log("Training tab redesign validation passed.");
