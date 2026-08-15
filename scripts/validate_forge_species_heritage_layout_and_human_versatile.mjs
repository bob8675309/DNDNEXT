import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const picker = read("components/NpcForgeHeritageTraitPicker.js");
const panel = read("components/NpcForgeContextPanel.js");
const sourceFields = read("components/NpcForgeSourceChoiceFields.js");
const registrar = read("components/NpcForgeHumanVersatileRegistrar.js");
const modal = read("components/NewNpcModalV3Refined.js");
const migration = read("sql/20260815_01_merfolk_playable_speed_override.sql");

assert.match(picker, /Custom Lineage is built entirely from Heritage Traits\. Choose eight Heritage Traits, some traits may be chosen more then once\./);
assert.match(picker, /useState\("C"\)/);
assert.doesNotMatch(picker, /key:\s*"ALL"|label:\s*"All"|category\s*!==\s*"ALL"/);
assert.match(picker, /npc-forge-heritage-picker__browser/);
assert.match(picker, /npc-forge-heritage-picker__list/);
assert.match(picker, /npc-forge-heritage-picker__detail/);
assert.match(picker, /grid-column:\s*1\s*\/\s*-1/);
assert.match(picker, /SourceChoiceFields/);
assert.match(picker, /npc-forge-heritage-picker__selected-remove/);
assert.match(picker, /aria-label={`Remove one \$\{option\.label\} Heritage Trait pick`}/);
assert.match(picker, /onClick=\{\(\) => removeTrait\(option\.key\)\}/);

assert.match(panel, /Versatile — Feat Selection/);
assert.match(panel, /full imported Origin-feat catalogue/);
assert.match(panel, /instead of choosing one of the games races/i);
assert.match(panel, /your race is considered to be a custom lineage/i);

assert.match(registrar, /String\(feat\?\.category \|\| ""\)\.toUpperCase\(\) === "O"/);
assert.match(registrar, /surfaceWithFeatChoices:\s*true/);
assert.match(registrar, /ownerType:\s*"advancement"/);
assert.match(registrar, /placement:\s*"class"/);
assert.match(registrar, /resolverPlacement:\s*"training"/);
assert.match(registrar, /evaluateFeatPrerequisites/);
assert.match(sourceFields, /surfaceWithFeatChoices/);
assert.match(modal, /NpcForgeHumanVersatileRegistrar/);
assert.match(modal, /playerMode \? <h2>Character Forge<\/h2>/);
assert.doesNotMatch(modal, /Build a player-owned character with the shared canonical Forge/);
assert.doesNotMatch(modal, /playerMode \? "Player Character Forge"/);
assert.match(modal, /npc-forge-modal-v2\.is-player-mode \.npc-forge-header\{align-items:center;padding:10px 14px\}/);
assert.match(modal, /npc-forge-modal-v2\.is-player-mode \.npc-forge-workspace\{padding:14px\}/);
assert.match(modal, /npc-forge-modal-v2\.is-player-mode \.npc-forge-preview\{padding:12px 14px\}/);

assert.match(migration, /"walk":\s*20/);
assert.match(migration, /"swim":\s*40/);
assert.match(migration, /heritageSourceSpeed/);
assert.doesNotMatch(migration, /raw_payload\s*=/i);

for (const protectedPath of ["MapPageClient", "map_routes", "advance_all_characters", "town-map", "world-map"]) {
  assert.doesNotMatch([picker, panel, sourceFields, registrar, modal, migration].join("\n"), new RegExp(protectedPath, "i"));
}

console.log("Forge Heritage layout, compact Player header, Merfolk speed, and Human Versatile routing validation passed.");
