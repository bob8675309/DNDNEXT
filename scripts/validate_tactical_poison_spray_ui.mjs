import fs from "node:fs";
import path from "node:path";

const combatPath = "pages/encounters/combat.js";
const migrationPath = "sql/20260728_02_tactical_poison_spray.sql";
const statusPath = "docs/Tactical_Encounter_Phase1L_Poison_Spray_Status.md";

for (const rel of [combatPath, migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Poison Spray UI validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Poison Spray UI validation failed: empty ${rel}`);
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
const required = [
  '"poison-spray|xphb"',
  'selectedSpellKey === "poison-spray|xphb" ? 30',
  '"encounter_cast_spell_v4"',
  'Poison Spray hit for ${data?.damage?.damage ?? data?.rawDamage ?? 0} poison damage',
  'Poison Spray missed with ${attackTotal || "?"} vs AC',
  'Poison Spray makes a ranged spell attack.',
  'Dodge imposes disadvantage',
  'Half and Three-Quarters Cover increase AC',
  'close-quarters ranged spell attacks remain GM-assisted',
  'Base damage</span><strong>1d12 poison',
  'String(row.detail?.spellKey || "").toLowerCase() === "poison-spray|xphb"',
  'Ranged spell attack {Number(row.detail?.roll || 0) + Number(row.detail?.attackBonus || 0)} vs AC',
  '"encounter_cast_spell_v3"',
  '"encounter_cast_spell_v2"',
  '"encounter_cast_spell_v1"',
];
for (const token of required) {
  if (!combat.includes(token)) throw new Error(`Tactical Poison Spray UI validation failed: missing contract ${token}`);
}

for (const forbidden of [
  "map_routes",
  "map_route_points",
  "map_route_edges",
  "world_state",
  "world_events",
  "town_map_flags",
  "town_map_labels",
  "advance_all_characters",
  "weather",
  '"acid-splash|xphb"',
  '"vicious-mockery|xphb"',
  '"healing-word|xphb"',
  '"hold-person|xphb"',
]) {
  if (combat.includes(forbidden)) throw new Error(`Tactical Poison Spray UI validation failed: combat UI must not reference ${forbidden}`);
}

if (!combat.includes('if (selectedSpellKey === "cure-wounds|xphb") return participants;')) {
  throw new Error("Tactical Poison Spray UI validation failed: Cure Wounds target behavior changed.");
}
if (!combat.includes('return participants.filter((p) => !p.is_defeated && String(p.id) !== String(active.id));')) {
  throw new Error("Tactical Poison Spray UI validation failed: offensive spell target filtering is missing.");
}
if (!combat.includes('const slotLevel = Number(selectedSpell.level || 0) === 0 ? null : Number(spellSlotLevel);')) {
  throw new Error("Tactical Poison Spray UI validation failed: cantrip slot preflight is missing.");
}
if (!/poison-spray\|xphb[\s\S]{0,760}encounter_cast_spell_v4|encounter_cast_spell_v4[\s\S]{0,760}poison-spray\|xphb/.test(combat)) {
  throw new Error("Tactical Poison Spray UI validation failed: Poison Spray must route through encounter_cast_spell_v4.");
}
if (!/toll-the-dead\|xphb[\s\S]{0,860}encounter_cast_spell_v3|encounter_cast_spell_v3[\s\S]{0,860}toll-the-dead\|xphb/.test(combat)) {
  throw new Error("Tactical Poison Spray UI validation failed: Toll the Dead must remain on encounter_cast_spell_v3.");
}
if (!/sacred-flame\|xphb[\s\S]{0,940}encounter_cast_spell_v2|encounter_cast_spell_v2[\s\S]{0,940}sacred-flame\|xphb/.test(combat)) {
  throw new Error("Tactical Poison Spray UI validation failed: Sacred Flame must remain on encounter_cast_spell_v2.");
}

console.log("Tactical Poison Spray combat UI validation passed.");
