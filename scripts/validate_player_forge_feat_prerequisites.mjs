import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const { evaluateFeatPrerequisites, progressionState } = await import(pathToFileURL(path.join(root, "utils/characterProgressionResolver.js")).href);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function result(feat, stateInput, level = null) {
  const state = stateInput?.armorProficiencies instanceof Set ? stateInput : progressionState(stateInput);
  return evaluateFeatPrerequisites(feat, state, level ?? state.level);
}

const balefulScion = {
  name: "Baleful Scion",
  source: "SatO",
  metadata: { prerequisite: [{ level: 4, feat: ["scion of the outer planes|sato|scion of the outer planes (evil outer plane)"] }] },
};
const evilScionGrant = {
  name: "Scion of the Outer Planes",
  source: "SatO",
  category: "O",
  choices: { "outer-plane": [{ label: "Evil Outer Plane" }] },
};
assert(!result(balefulScion, { level: 3, feats: [evilScionGrant] }).eligible, "Baleful Scion must be locked below level 4 even with the Evil Outer Plane prerequisite.");
assert(!result(balefulScion, { level: 4, feats: [{ name: "Scion of the Outer Planes", source: "SatO", category: "O" }] }).eligible, "Baleful Scion must require the Evil Outer Plane variant, not merely the parent Scion feat.");
assert(result(balefulScion, { level: 4, feats: [evilScionGrant] }).eligible, "Baleful Scion should unlock at level 4 with the Evil Outer Plane Scion variant.");

const athlete = {
  name: "Athlete",
  metadata: { prerequisite: [
    { level: 4, ability: [{ str: 13 }] },
    { level: 4, ability: [{ dex: 13 }] },
  ] },
};
assert(result(athlete, { level: 4, abilities: { str: 10, dex: 13 } }).eligible, "Athlete must accept either qualifying Strength or Dexterity alternative.");
assert(!result(athlete, { level: 4, abilities: { str: 12, dex: 12 } }).eligible, "Athlete must lock when neither ability prerequisite is met.");

const planescapeFeat = { name: "Scion of the Outer Planes", metadata: { prerequisite: [{ campaign: ["Planescape"] }] } };
assert(!result(planescapeFeat, { level: 1 }).eligible, "Campaign-gated feats must lock when no matching campaign is active.");
assert(result(planescapeFeat, { level: 1, campaigns: ["Planescape"] }).eligible, "Campaign-gated feats must unlock for the matching campaign.");

const fightingInitiate = { name: "Fighting Initiate", metadata: { prerequisite: [{ feature: ["Fighting Style"] }] } };
assert(!result(fightingInitiate, { level: 2 }).eligible, "Fighting Initiate must lock without the Fighting Style class feature.");
assert(result(fightingInitiate, { level: 2, features: ["Fighting Style"] }).eligible, "Fighting Initiate must unlock when Fighting Style is already possessed.");

const potentDragonmark = { name: "Potent Dragonmark", metadata: { prerequisite: [{ level: 4, featCategory: ["D"] }] } };
assert(!result(potentDragonmark, { level: 4 }).eligible, "Potent Dragonmark must lock without an existing Dragonmark feat.");
assert(result(potentDragonmark, { level: 4, feats: [{ name: "Mark of Passage", category: "D" }] }).eligible, "Potent Dragonmark must recognize an existing Dragonmark feat category.");

const aberrantDragonmark = { name: "Aberrant Dragonmark", metadata: { prerequisite: [{ campaign: ["Eberron"], exclusiveFeatCategory: ["D"] }] } };
assert(result(aberrantDragonmark, { level: 1, campaigns: ["Eberron"] }).eligible, "A first Dragonmark should be eligible in Eberron.");
assert(!result(aberrantDragonmark, { level: 1, campaigns: ["Eberron"], feats: [{ name: "Mark of Passage", category: "D" }] }).eligible, "Mutually exclusive Dragonmark feats must lock after a Dragonmark is already owned.");

const smallRaceFeat = { name: "Small Race Test", metadata: { prerequisite: [{ race: [{ name: "Small Race" }] }] } };
assert(result(smallRaceFeat, { level: 1, selectedSpecies: { name: "Halfling", size: "S" } }).eligible, "Small-race prerequisites must recognize Small species.");
assert(!result(smallRaceFeat, { level: 1, selectedSpecies: { name: "Human", size: "M" } }).eligible, "Small-race prerequisites must reject Medium species.");

const spellcastingFeat = { name: "Spellcasting Test", metadata: { prerequisite: [{ spellcasting: true }] } };
assert(!result(spellcastingFeat, { level: 1, spellcasting: false }).eligible, "Spellcasting prerequisites must lock non-spellcasters.");
assert(result(spellcastingFeat, { level: 1, spellcasting: true }).eligible, "Spellcasting prerequisites must accept a spellcasting character.");

const specialFightingStyle = {
  name: "Druidic Warrior",
  metadata: { prerequisite: [{ otherSummary: { entry: 'When Gaining the Level 2 Ranger "Fighting Style" Feature', entrySummary: "Special" } }] },
};
assert(result(specialFightingStyle, { level: 2, selectedClass: { class_name: "Ranger" }, features: ["Fighting Style"] }, 2).eligible, "Special Fighting Style acquisition prerequisites must recognize the correct class, level, and feature.");
assert(!result(specialFightingStyle, { level: 3, selectedClass: { class_name: "Ranger" }, features: ["Fighting Style"] }, 3).eligible, "Special acquisition prerequisites must not become generally selectable after their acquisition level.");

const unknown = { name: "Unknown Prerequisite Test", metadata: { prerequisite: [{ unsupportedFutureKey: true }] } };
const unknownResult = result(unknown, { level: 20 });
assert(!unknownResult.eligible && !unknownResult.supported, "Unknown prerequisite shapes must fail closed instead of silently allowing a feat.");

console.log("Player Forge feat prerequisite validation passed.");
