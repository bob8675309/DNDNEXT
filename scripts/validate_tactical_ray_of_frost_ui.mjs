import fs from "node:fs";
import path from "node:path";

const combatPath = "pages/encounters/combat.js";
const migrationPath = "sql/20260728_06_tactical_ray_of_frost.sql";
const statusPath = "docs/Tactical_Encounter_Phase1P_Ray_of_Frost_Status.md";

for (const rel of [combatPath, migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Ray of Frost UI validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Ray of Frost UI validation failed: empty ${rel}`);
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
const required = [
  '"ray-of-frost|xphb"',
  'selectedSpellKey === "ray-of-frost|xphb" ? 60',
  'rayOfFrostDiceCount',
  'Number(spellProfile?.classLevel || 1) >= 17 ? 4',
  'Number(spellProfile?.classLevel || 1) >= 11 ? 3',
  'Number(spellProfile?.classLevel || 1) >= 5 ? 2 : 1',
  '"encounter_cast_spell_v8"',
  'if (key === "ray-of-frost|xphb")',
  'Ray of Frost hit for ${data?.damage?.damage ?? data?.rawDamage ?? 0} cold damage',
  "reduced ${spellTarget.display_name}'s Speed by 10 feet until the start of your next turn",
  'Ray of Frost missed with ${attackTotal || "?"} vs AC',
  'Ray of Frost makes a ranged spell attack at 60 feet.',
  'Half and Three-Quarters Cover increase AC',
  'close-quarters ranged spell attacks remain GM-assisted',
  'target&apos;s Speed is reduced by 10 feet until the start of the caster&apos;s next turn',
  'Current Speed',
  'Speed −10 ft.',
  'String(row.detail?.spellKey || "").toLowerCase() === "ray-of-frost|xphb"',
  'Speed ${row.detail.targetSpeedBeforeFt ?? "?"} → ${row.detail.targetSpeedAfterFt ?? "?"} ft. until source turn start',
  '"encounter_cast_spell_v7"',
  '"encounter_cast_spell_v6"',
  '"encounter_cast_spell_v5"',
  '"encounter_cast_spell_v4"',
  '"encounter_cast_spell_v3"',
  '"encounter_cast_spell_v2"',
  '"encounter_cast_spell_v1"',
];
for (const token of required) {
  if (!combat.includes(token)) throw new Error(`Tactical Ray of Frost UI validation failed: missing contract ${token}`);
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
  '"ray-of-sickness|xphb"',
  '"hold-person|xphb"',
]) {
  if (combat.includes(forbidden)) throw new Error(`Tactical Ray of Frost UI validation failed: combat UI must not reference ${forbidden}`);
}

if (!combat.includes('return participants.filter((p) => !p.is_defeated && String(p.id) !== String(active.id));')) {
  throw new Error("Tactical Ray of Frost UI validation failed: offensive targeting must exclude self and defeated targets.");
}
if (!combat.includes('const slotLevel = Number(selectedSpell.level || 0) === 0 ? null : Number(spellSlotLevel);')) {
  throw new Error("Tactical Ray of Frost UI validation failed: cantrip slot preflight is missing.");
}
if (!/ray-of-frost\|xphb[\s\S]{0,820}encounter_cast_spell_v8|encounter_cast_spell_v8[\s\S]{0,820}ray-of-frost\|xphb/.test(combat)) {
  throw new Error("Tactical Ray of Frost UI validation failed: Ray of Frost must route through encounter_cast_spell_v8.");
}
if (!/shocking-grasp\|xphb[\s\S]{0,940}encounter_cast_spell_v7|encounter_cast_spell_v7[\s\S]{0,940}shocking-grasp\|xphb/.test(combat)) {
  throw new Error("Tactical Ray of Frost UI validation failed: Shocking Grasp must remain on encounter_cast_spell_v7.");
}
if (!/inflict-wounds\|xphb[\s\S]{0,1100}encounter_cast_spell_v6|encounter_cast_spell_v6[\s\S]{0,1100}inflict-wounds\|xphb/.test(combat)) {
  throw new Error("Tactical Ray of Frost UI validation failed: Inflict Wounds must remain on encounter_cast_spell_v6.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of ["Phase 1P", "Ray of Frost", "DEPLOYED / VALIDATED", "20260728190908", "Pip Quillspark"]) {
  if (!status.includes(token)) throw new Error(`Tactical Ray of Frost UI validation failed: status document missing ${token}`);
}

console.log("Tactical Ray of Frost combat UI validation passed.");
