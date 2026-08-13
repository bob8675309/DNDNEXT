import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const protectedPattern = /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/;

const iconSource = read("components/ForgeSemanticIcon.js");
const contextSource = read("components/NpcForgeContextPanelRefined.js");
const stepSource = read("components/NpcForgeStepContent.js");
const polishSource = read("styles/character-forge-final-polish.css");
const baseStyleSource = read("styles/npc-forge-v2.css");

const semanticPairs = [
  ["speed", "FaShoePrints"],
  ["size", "FaRulerVertical"],
  ["creature", "FaUserCircle"],
  ["vision", "FaEye"],
  ["languages", "FaComments"],
  ["ancestry", "FaDragon"],
  ["breath", "FaFireAlt"],
  ["resistance", "FaShieldAlt"],
  ["flight", "FaFeatherAlt"],
  ["magic", "FaMagic"],
  ["proficiency", "FaBookOpen"],
  ["swim", "FaSwimmer"],
  ["climb", "FaMountain"],
  ["attack", "FaFistRaised"],
  ["feature", "FaScroll"],
];

assert.equal(new Set(semanticPairs.map(([, icon]) => icon)).size, semanticPairs.length, "each Forge semantic meaning must have its own icon component");
for (const [kind, icon] of semanticPairs) {
  assert.ok(iconSource.includes(`${kind}: ${icon}`), `${kind} must retain its assigned ${icon} symbol`);
}
assert.ok(iconSource.includes('if (/\\blanguages?\\b/.test(value)) return "languages";'), "language labels must resolve to the speech-bubble vocabulary");
assert.doesNotMatch(iconSource, /useState|useEffect|useContext/, "semantic icon presentation must not add state, effects, or parallel context authority");

for (const token of [
  'import ForgeSemanticIcon, { speciesFeatureIconKind } from "./ForgeSemanticIcon"',
  'kind: "speed", title: "Speed"',
  'kind: "size", title: "Size"',
  'kind: "creature", title: "Creature type"',
  'kind: "vision", title: "Darkvision"',
  'kind: "languages", title: "Languages"',
  "data-icon-kind={kind}",
  "data-feature-kind={speciesFeatureIconKind",
  "npc-forge-species-feature-title",
  "speciesPortraitArtworkFor(option.name)",
]) assert.ok(contextSource.includes(token), `shared Species presentation missing ${token}`);

for (const token of [
  "npc-forge-step-species > .npc-forge-workspace",
  "flex: 1 1 0",
  "max-height: none !important",
  '[data-icon-kind="languages"]',
  '[data-feature-kind="breath"]',
  '[data-feature-kind="resistance"]',
  '[data-feature-kind="flight"]',
  "npc-forge-species-feature-title",
]) assert.ok(polishSource.includes(token), `Species semantic/layout polish missing ${token}`);

assert.ok(baseStyleSource.includes("max-height: 430px"), "non-desktop/default catalogue height guard must remain available");
assert.ok(stepSource.includes('className={`npc-forge-body npc-forge-step-${step} npc-forge-step-${stepKey}'), "Species layout must reuse the established shared step key rather than new state");

for (const source of [iconSource, contextSource, polishSource]) {
  assert.ok(!protectedPattern.test(source), "Species icon/layout work crossed a protected map/travel boundary");
}

console.log("Forge Species semantic presentation validated: the catalogue stretches with the desktop detail rail, responsive bounds remain, shared player/NPC facts and features use a one-meaning-per-icon vocabulary, canonical portrait routing remains intact, and protected map/travel boundaries are untouched.");
