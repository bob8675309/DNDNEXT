import fs from "node:fs";
import path from "node:path";

const combatPath = "pages/encounters/combat.js";
const migrationPath = "sql/20260728_04_tactical_inflict_wounds.sql";
const statusPath = "docs/Tactical_Encounter_Phase1N_Inflict_Wounds_Status.md";

for (const rel of [combatPath, migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Inflict Wounds UI validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Inflict Wounds UI validation failed: empty ${rel}`);
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
const required = [
  '"inflict-wounds|xphb"',
  'inflictWoundsDiceCount',
  'Math.max(2, Number(spellSlotLevel || 1) + 1)',
  '"encounter_cast_spell_v6"',
  'if (key === "inflict-wounds|xphb")',
  'Inflict Wounds: CON save',
  'successful save • half damage',
  'failed save • full damage',
  'CON vs DC',
  '2d10 Necrotic damage at level 1',
  'plus 1d10 for each slot level above 1',
  'A successful Constitution save takes half the rolled damage.',
  'Cover does not modify this save',
  'Selected-slot damage',
  'half on save',
  'row.detail.halfDamageOnSuccessfulSave && row.detail.saveSuccess ? " • half damage"',
  '(!row.detail?.saveSuccess || row.detail?.halfDamageOnSuccessfulSave)',
  'row.detail.fullDamageRoll != null',
  'TACTICAL ENCOUNTER • PHASE',
  'Inflict Wounds',
  'current reviewed tactical adapters.',
  '"encounter_cast_spell_v5"',
  '"encounter_cast_spell_v4"',
  '"encounter_cast_spell_v3"',
  '"encounter_cast_spell_v2"',
  '"encounter_cast_spell_v1"',
];
for (const token of required) {
  if (!combat.includes(token)) throw new Error(`Tactical Inflict Wounds UI validation failed: missing contract ${token}`);
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
  '"hold-person|xphb"',
]) {
  if (combat.includes(forbidden)) throw new Error(`Tactical Inflict Wounds UI validation failed: combat UI must not reference ${forbidden}`);
}

if (!/const spellRangeFt[\s\S]{0,920}inflict-wounds\|xphb[\s\S]{0,260}\? 5/.test(combat)) {
  throw new Error("Tactical Inflict Wounds UI validation failed: Inflict Wounds must remain a 5-foot Touch adapter.");
}
if (!combat.includes('return participants.filter((p) => !p.is_defeated && String(p.id) !== String(active.id));')) {
  throw new Error("Tactical Inflict Wounds UI validation failed: offensive targeting must still exclude self and defeated targets.");
}
if (!combat.includes('const slotLevel = Number(selectedSpell.level || 0) === 0 ? null : Number(spellSlotLevel);')) {
  throw new Error("Tactical Inflict Wounds UI validation failed: leveled-spell slot preflight is missing.");
}
if (!/inflict-wounds\|xphb[\s\S]{0,900}encounter_cast_spell_v6|encounter_cast_spell_v6[\s\S]{0,900}inflict-wounds\|xphb/.test(combat)) {
  throw new Error("Tactical Inflict Wounds UI validation failed: Inflict Wounds must route through encounter_cast_spell_v6.");
}
if (!/false-life\|xphb[\s\S]{0,1020}encounter_cast_spell_v5|encounter_cast_spell_v5[\s\S]{0,1020}false-life\|xphb/.test(combat)) {
  throw new Error("Tactical Inflict Wounds UI validation failed: False Life must remain on encounter_cast_spell_v5.");
}
if (!/poison-spray\|xphb[\s\S]{0,1120}encounter_cast_spell_v4|encounter_cast_spell_v4[\s\S]{0,1120}poison-spray\|xphb/.test(combat)) {
  throw new Error("Tactical Inflict Wounds UI validation failed: Poison Spray must remain on encounter_cast_spell_v4.");
}

console.log("Tactical Inflict Wounds combat UI validation passed.");
