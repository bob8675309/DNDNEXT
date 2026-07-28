import fs from "node:fs";
import path from "node:path";

const combatPath = "pages/encounters/combat.js";
const migrationPath = "sql/20260728_03_tactical_false_life.sql";
const statusPath = "docs/Tactical_Encounter_Phase1M_False_Life_Status.md";

for (const rel of [combatPath, migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical False Life UI validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical False Life UI validation failed: empty ${rel}`);
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
const required = [
  '"false-life|xphb"',
  'if (selectedSpellKey === "false-life|xphb") return [active];',
  'falseLifeBlockedByTempHp',
  'Number(active?.temp_hp || 0) > 0',
  'Math.max(0, (Number(spellSlotLevel || 1) - 1) * 5)',
  '!falseLifeBlockedByTempHp',
  '"encounter_cast_spell_v5"',
  'False Life granted ${data?.temporaryHpGranted ?? 0} Temporary HP',
  '2d4 + 4 Temporary HP',
  'Each slot level above 1 adds 5 Temporary HP.',
  'Existing Temporary HP is not stacked or replaced automatically',
  'Current Temporary HP',
  'False Life automation is blocked while the caster already has Temporary HP',
  'row.detail?.temporaryHpGranted != null',
  '"encounter_cast_spell_v4"',
  '"encounter_cast_spell_v3"',
  '"encounter_cast_spell_v2"',
  '"encounter_cast_spell_v1"',
];
for (const token of required) {
  if (!combat.includes(token)) throw new Error(`Tactical False Life UI validation failed: missing contract ${token}`);
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
  '"mind-sliver|xphb"',
  '"vicious-mockery|xphb"',
  '"ray-of-frost|xphb"',
  '"healing-word|xphb"',
  '"hold-person|xphb"',
]) {
  if (combat.includes(forbidden)) throw new Error(`Tactical False Life UI validation failed: combat UI must not reference ${forbidden}`);
}

if (!combat.includes('if (selectedSpellKey === "cure-wounds|xphb") return participants;')) {
  throw new Error("Tactical False Life UI validation failed: Cure Wounds target behavior changed.");
}
if (!combat.includes('return participants.filter((p) => !p.is_defeated && String(p.id) !== String(active.id));')) {
  throw new Error("Tactical False Life UI validation failed: offensive spell target filtering is missing.");
}
if (!combat.includes('const slotLevel = Number(selectedSpell.level || 0) === 0 ? null : Number(spellSlotLevel);')) {
  throw new Error("Tactical False Life UI validation failed: spell-slot preflight is missing.");
}
if (!/false-life\|xphb[\s\S]{0,620}encounter_cast_spell_v5|encounter_cast_spell_v5[\s\S]{0,620}false-life\|xphb/.test(combat)) {
  throw new Error("Tactical False Life UI validation failed: False Life must route through encounter_cast_spell_v5.");
}
if (!/poison-spray\|xphb[\s\S]{0,680}encounter_cast_spell_v4|encounter_cast_spell_v4[\s\S]{0,680}poison-spray\|xphb/.test(combat)) {
  throw new Error("Tactical False Life UI validation failed: Poison Spray must remain on encounter_cast_spell_v4.");
}
if (!/toll-the-dead\|xphb[\s\S]{0,780}encounter_cast_spell_v3|encounter_cast_spell_v3[\s\S]{0,780}toll-the-dead\|xphb/.test(combat)) {
  throw new Error("Tactical False Life UI validation failed: Toll the Dead must remain on encounter_cast_spell_v3.");
}
if (!/sacred-flame\|xphb[\s\S]{0,860}encounter_cast_spell_v2|encounter_cast_spell_v2[\s\S]{0,860}sacred-flame\|xphb/.test(combat)) {
  throw new Error("Tactical False Life UI validation failed: Sacred Flame must remain on encounter_cast_spell_v2.");
}

console.log("Tactical False Life combat UI validation passed.");