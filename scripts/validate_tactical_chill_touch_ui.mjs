import fs from "node:fs";
import path from "node:path";

const combatPath = "pages/encounters/combat.js";
const migrationPath = "sql/20260728_07_tactical_chill_touch.sql";
const statusPath = "docs/Tactical_Encounter_Phase1Q_Chill_Touch_Status.md";

for (const rel of [combatPath, migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Chill Touch UI validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Chill Touch UI validation failed: empty ${rel}`);
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
const required = [
  '"chill-touch|xphb"',
  '"cure-wounds|xphb", "inflict-wounds|xphb", "shocking-grasp|xphb", "chill-touch|xphb"',
  'chillTouchDiceCount',
  '"encounter_cast_spell_v9"',
  'if (key === "chill-touch|xphb")',
  'Chill Touch hit for ${data?.damage?.damage ?? data?.rawDamage ?? 0} necrotic damage',
  'cannot regain Hit Points until the end of your next turn',
  'Chill Touch missed with ${attackTotal || "?"} vs AC',
  'Touch-range melee spell attack',
  'target cannot regain Hit Points until the end of the caster&apos;s next turn',
  'cannot regain HP',
  'TACTICAL ENCOUNTER • PHASE',
  'current reviewed tactical adapters.',
  'String(row.detail?.spellKey || "").toLowerCase() === "chill-touch|xphb"',
  'cannot regain HP until source next turn end',
  'data?.healing?.healingPrevented',
  'Cure Wounds was cast, but ${spellTarget.display_name} could not regain Hit Points',
  'row.detail.healing.healingPrevented ? `Healing prevented',
  '"encounter_cast_spell_v8"',
  '"encounter_cast_spell_v7"',
  '"encounter_cast_spell_v6"',
  '"encounter_cast_spell_v5"',
  '"encounter_cast_spell_v4"',
  '"encounter_cast_spell_v3"',
  '"encounter_cast_spell_v2"',
  '"encounter_cast_spell_v1"',
];
for (const token of required) {
  if (!combat.includes(token)) throw new Error(`Tactical Chill Touch UI validation failed: missing contract ${token}`);
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
  '"ray-of-sickness|xphb"',
  '"vicious-mockery|xphb"',
  '"hold-person|xphb"',
]) {
  if (combat.includes(forbidden)) throw new Error(`Tactical Chill Touch UI validation failed: combat UI must not reference ${forbidden}`);
}

if (!combat.includes('return participants.filter((p) => !p.is_defeated && String(p.id) !== String(active.id));')) {
  throw new Error("Tactical Chill Touch UI validation failed: offensive targeting must exclude self and defeated targets.");
}
if (!combat.includes('const slotLevel = Number(selectedSpell.level || 0) === 0 ? null : Number(spellSlotLevel);')) {
  throw new Error("Tactical Chill Touch UI validation failed: cantrip slot preflight is missing.");
}
if (!/chill-touch\|xphb[\s\S]{0,720}encounter_cast_spell_v9|encounter_cast_spell_v9[\s\S]{0,720}chill-touch\|xphb/.test(combat)) {
  throw new Error("Tactical Chill Touch UI validation failed: Chill Touch must route through encounter_cast_spell_v9.");
}
if (!/ray-of-frost\|xphb[\s\S]{0,860}encounter_cast_spell_v8|encounter_cast_spell_v8[\s\S]{0,860}ray-of-frost\|xphb/.test(combat)) {
  throw new Error("Tactical Chill Touch UI validation failed: Ray of Frost must remain on encounter_cast_spell_v8.");
}
if (!/shocking-grasp\|xphb[\s\S]{0,1000}encounter_cast_spell_v7|encounter_cast_spell_v7[\s\S]{0,1000}shocking-grasp\|xphb/.test(combat)) {
  throw new Error("Tactical Chill Touch UI validation failed: Shocking Grasp must remain on encounter_cast_spell_v7.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of ["Phase 1Q", "Chill Touch", "DEPLOYED / VALIDATED", "20260728193929", "Pip Quillspark"]) {
  if (!status.includes(token)) throw new Error(`Tactical Chill Touch UI validation failed: status document missing ${token}`);
}

console.log("Tactical Chill Touch combat UI validation passed.");
