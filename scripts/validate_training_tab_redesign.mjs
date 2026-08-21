import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const training = read("components/NpcForgeTrainingStep.js");
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

assert(training.includes("NpcForgeTrainingStepBase"), "Player redesign must preserve the legacy NPC Training fallback.");
assert(training.includes("if (!props.playerMode) return <NpcForgeTrainingStepBase"), "NPC Forge must remain on the legacy Training presentation.");
assert(training.includes("Skill &amp; Training Selections"), "Training must use the single unified selection tally.");
assert(training.includes("npc-forge-training-summary-breakdown"), "Unified tally must expose a provenance breakdown.");
assert(training.includes("Background") && training.includes("Class Skills / Trade Skills") && training.includes("Source Training Choices") && training.includes("Feat &amp; Class Choices"), "Unified tally is missing a source breakdown.");
assert(training.includes("Class Skills"), "Training list must retain class skill picks.");
assert(training.includes("Trade Skills"), "Trade Skills must sit in the left Training selection stack.");
assert(training.includes("sourceGrantedProfessionKeys"), "Training must project source-granted crafting tools as Trade Skill grants.");
assert(training.includes("Source-granted tools train the matching Trade Skill for free"), "Training must explain that mapped tool grants do not cost a second pick.");
assert(!training.includes("Tool proficiency alone does not unlock the Trade Skill"), "Rejected tool-vs-Trade-Skill model remains in player Training.");
assert(training.includes("NpcForgeSourceChoiceFields placement=\"training\" inline"), "Training source-owned choices must render inline in the left selection pane.");
assert(sourceContext.includes("backgroundToolChoiceResolvesInTraining"), "Background tool routing predicate is missing.");
assert(sourceContext.includes('placement: "training"') && sourceContext.includes("sourcePlacement") && sourceContext.includes("backgroundToolChoice"), "Background tool choices must preserve ownership provenance while resolving in Training.");
assert(contextWrapper.includes("Resolved in Training") && contextWrapper.includes("Choose in Training"), "Background must acknowledge routed tool choices without resolving them there.");

assert(training.includes("NpcForgeTrainingFeatPicker"), "Training must use the compact feat catalogue picker.");
assert(featPicker.includes("Name, prerequisite, description") && featPicker.includes("Category") && featPicker.includes("Current Selection"), "Training feat catalogue is missing search/filter/detail guidance.");
assert(!training.includes("npc-forge-training-bonus-feat"), "Giant native Bonus Feat select remains in Training.");
assert(training.includes("controller.setSpeciesBonus?.({ featId })"), "Training must own the Bonus Feat catalogue selection.");
assert(speciesBonus.includes("specific feat is chosen later in Training"), "Abilities must route the actual Bonus Feat selection to Training.");
assert(!speciesBonus.includes("Species bonus feat</span>"), "Abilities still contains the old Bonus Feat catalogue chooser.");
assert(routedController.includes('controller.stepKey === "abilities"') && routedController.includes('controller.stepKey === "training"'), "Bonus Feat routing must allow Abilities to defer and require completion in Training.");
assert(modal.includes("NpcForgeControllerProvider") && modal.includes("useNpcForgeTrainingRoutedController"), "Forge must provide the routed controller to Training.");
assert(training.includes("NpcForgeSourceChoiceFields placement=\"class\" ownerType=\"feat\" inline"), "Feat-owned follow-up choices must stay inline in Training.");
assert(training.includes("NpcForgeSourceChoiceFields placement=\"advancement\" inline"), "Advancement/Epic Boon choices must stay inline in Training.");
assert(sourceFields.includes("if (inline) return fields"), "Source-choice wrapper must support bypassing the preview portal.");
assert(contextWrapper.includes("NpcForgeTrainingContextCard"), "Training preview rail must use its dedicated current-selection dossier.");
for (const token of ["Current Selection", "Typical Uses", "Class Skill", "Trade Skill", "Associated Tool", "Feat Rules", "All choices can be reviewed on the final step"]) assert(trainingContext.includes(token), `Training context dossier missing ${token}`);

assert(craftingToolProfessions.includes("PROFESSION_DEFINITIONS") && craftingToolProfessions.includes("professionKeyForTool") && craftingToolProfessions.includes("professionKeysForTools"), "Canonical tool-to-Trade-Skill helper must derive from profession definitions.");
assert(craftingProfessions.includes("sheetHasProfessionTool") && craftingProfessions.includes("toolGranted ? 1 : 0") && craftingProfessions.includes('proficiencySource: profession.rank > 0 ? "profession" : toolGranted ? "tool" : "none"'), "Shared profession resolver must honor canonical crafting-tool proficiency.");
assert(craftingProfessions.includes("professionHasServiceFlag") && craftingProfessions.includes("professionServicesFromSheet"), "Tool unification must not remove explicit NPC workshop service authority.");

assert(training.includes("onToggleBackgroundSkill"), "Variable Background skill grants must remain selectable without becoming class picks.");
assert(training.includes("onToggleClassSkill"), "Class skill selection authority must remain wired.");
assert(training.includes("onSetProfession"), "Paid Trade Skill selection authority must remain wired.");
assert(training.includes("sourceChoiceGroupComplete"), "Required source-choice completion gating must remain active.");
assert(training.includes(".npc-forge-modal-v2:has(.npc-forge-training-player-layout)"), "Approved Training modal width contract is missing.");
assert(training.includes(".npc-forge-body:has(.npc-forge-training-player-layout)"), "Approved Training/player body proportion rule is missing.");
assert(legacy.includes("Skills & Proficiencies") && legacy.includes("Feats & Class Abilities"), "Legacy NPC Training implementation was not preserved intact enough for fallback use.");

const protectedSources = `${training}\n${sourceFields}\n${sourceContext}\n${contextWrapper}\n${trainingContext}\n${featPicker}\n${routedController}\n${craftingToolProfessions}`.toLowerCase();
for (const token of ["world map", "world-map", "map_routes", "advance_all_characters", "town map", "city map"]) assert(!protectedSources.includes(token), `Training redesign unexpectedly references protected map behavior: ${token}`);

console.log("Training tab redesign validation passed: one provenance tally, Bonus Feat catalogue selection, Background tool routing, tool/Trade-Skill unification, left-side decisions, right-side context, and NPC fallback are intact.");
