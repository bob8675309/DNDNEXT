import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sqlPath = path.join(root, "sql/20260814_02_species_heritage_profiles.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const match = sql.match(/\$profiles\$\s*([\s\S]*?)\s*\$profiles\$/);
assert.ok(match, "Heritage profile JSON block is missing");
const profiles = JSON.parse(match[1]);

const expectedSpecies = [
  ["Human (Innistrad)", "PSI"],
  ["Human (Kaladesh)", "PSK"],
  ["Human (Ixalan)", "PSX"],
  ["Human (Zendikar)", "PSZ"],
  ["Merfolk", "DMG"],
  ["Gnoll", "DMG"],
  ["Bullywug", "DMG"],
  ["Grimlock", "DMG"],
  ["Boggart", "LFL"],
  ["Flamekin", "LFL"],
  ["Rimekin", "LFL"],
  ["Giff", "AAG"],
];

assert.equal(profiles.length, expectedSpecies.length, "Exactly twelve approved Species profiles must be defined");
for (const [name, source] of expectedSpecies) {
  const profile = profiles.find((entry) => entry.name === name && entry.source === source);
  assert.ok(profile, `Missing approved Heritage profile: ${name}|${source}`);
  assert.equal(profile.traits.length, 8, `${name} must have exactly eight traditional Heritage Traits`);
  assert.equal(new Set(profile.traits).size, 8, `${name} must not duplicate a Heritage Trait in its traditional package`);
}

const category = new Map([
  ...["Brave","Hunter's Instinct","Relentless Endurance","Centered","Timely Boon","Skirmish Tactics","First Strike","Quick Initiative","Slippery","Natural Attack","Pack Tactics","Menacing Roar","Ruthless Response","Tenacious","Larger Target","Quick Slip","Creature Cover","Damage Resistance","Focused Reserves","Focused Mind","Mighty Shove","Stalwart Reserves"].map((name) => [name, "C"]),
  ...["Darkvision","Even in Sleep","Shroud of the Wild","Artifice Expertise","Driver","Intrinsic Orientation","Swimmer","Climber","Burst of Speed","Standing Leap","Amphibious","Tireless","Resilient Ears","Supple Squeeze","Pass Through","Inured to the Elements","Powerful Build","Steady"].map((name) => [name, "E"]),
  ...["Keen Survivor","Moved by Faith","Crafter's Eye","Magical Insight","Impromptu Artisan","Persuasive Knack","Inborn Perception","Athlete's Spirit","Connection to Nature","Nature's Voice","Instinctive Stealth","Animal Friend","Eager Deceiver","Nimble Moves","Embrace the Past","Firm Influence","Commanding Insight"].map((name) => [name, "R"]),
]);

for (const profile of profiles) {
  const counts = { C: 0, E: 0, R: 0 };
  for (const trait of profile.traits) {
    const key = category.get(trait);
    assert.ok(key, `Validator category map is missing ${trait}`);
    counts[key] += 1;
  }
  assert.deepEqual(Object.values(counts).sort((a, b) => a - b), [2, 3, 3], `${profile.name} must follow the standard balanced 3/3/2 traditional-package pattern`);
}

const flamekin = profiles.find((entry) => entry.name === "Flamekin");
const rimekin = profiles.find((entry) => entry.name === "Rimekin");
assert.equal(flamekin.fixedSubchoices?.["Damage Resistance"]?.damageType, "Fire", "Flamekin Damage Resistance must be fixed to Fire");
assert.equal(rimekin.fixedSubchoices?.["Damage Resistance"]?.damageType, "Cold", "Rimekin Damage Resistance must be fixed to Cold");

assert.deepEqual(profiles.find((entry) => entry.name === "Grimlock")?.baseTraitNames, ["Blindsight"], "Grimlock must preserve its defining Blindsight physiology outside the eight-pick budget");
assert.deepEqual(profiles.find((entry) => entry.name === "Boggart")?.baseTraitNames, ["Creature Type"], "Boggart must preserve its Humanoid/Goblinoid identity outside the eight-pick budget");

const giff = profiles.find((entry) => entry.name === "Giff");
assert.ok(!JSON.stringify(giff).match(/firearm/i), "Giff Heritage replacement must not restore firearms");

for (const token of [
  "heritageSourceTraits",
  "heritageSourceLanguages",
  "heritageSourceDarkvision",
  "heritageProfileActive",
  "legacyTraitPackageReplaced",
  "'{languages}', '[]'::jsonb",
  "'{traits}', t.base_traits || t.display_traits",
  "'mode', 'traditional-fixed'",
  "'pickCount', 8",
]) {
  assert.ok(sql.includes(token), `Heritage replacement migration is missing guardrail token: ${token}`);
}

for (const token of ["MapPageClient", "map_routes", "map_route_points", "advance_all_characters", "route_segment_progress", "weather"]) {
  assert.ok(!sql.includes(token), `Heritage replacement crossed protected map/travel boundary: ${token}`);
}

console.log("Approved Species Heritage profiles validated: 12 source identities, eight traits each, balanced 3/3/2 packages, Fire/Cold affinity locks, defining Boggart/Grimlock base traits, source backups, no firearms, and protected boundaries intact.");
