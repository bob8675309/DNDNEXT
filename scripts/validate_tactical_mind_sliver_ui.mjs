import fs from "node:fs";
import path from "node:path";

const combatPath = "pages/encounters/combat.js";
const migrationPath = "sql/20260728_08_tactical_mind_sliver.sql";
const fixPath = "sql/20260729_01_tactical_mind_sliver_save_profile_fix.sql";
const statusPath = "docs/Tactical_Encounter_Phase1R_Mind_Sliver_Status.md";

for (const rel of [combatPath, migrationPath, fixPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Mind Sliver UI validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Mind Sliver UI validation failed: empty ${rel}`);
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
const required = [
  '"mind-sliver|xphb"',
  'selectedSpellKey === "mind-sliver|xphb" ? 60',
  'mindSliverDiceCount',
  'Number(spellProfile?.classLevel || 1) >= 17 ? 4',
  'Number(spellProfile?.classLevel || 1) >= 11 ? 3',
  'Number(spellProfile?.classLevel || 1) >= 5 ? 2 : 1',
  '"encounter_cast_spell_v10"',
  'if (key === "mind-sliver|xphb")',
  'Mind Sliver: ${spellTarget.display_name} resisted with INT',
  'Mind Sliver: INT save ${data?.saveTotal ?? "?"} vs DC',
  'psychic damage (${data?.damageDice || "1d6"})',
  'next saving throw −1d4 before the end of your next turn',
  'INT vs DC',
  'Mind Sliver forces an Intelligence saving throw at 60 feet.',
  'Cover and Dodge do not modify this save.',
  'that next real saving throw consumes the penalty',
  'On failed save',
  'next save −1d4',
  'TACTICAL ENCOUNTER • PHASE',
  'Mind Sliver',
  'are the current reviewed tactical adapters.',
  'mindSliverPenaltyText(data?.profile)',
  'mindSliverPenaltyText(row.detail?.saveProfile)',
  'mindSliverPenaltyText(row.detail?.profile)',
  'row.detail?.effectKey === "mind_sliver_save_penalty"',
  'Mind Sliver rider • next saving throw −1d4 before source next turn end',
  'effect consumed',
  '"encounter_cast_spell_v9"',
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
  if (!combat.includes(token)) throw new Error(`Tactical Mind Sliver UI validation failed: missing contract ${token}`);
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
  if (combat.includes(forbidden)) throw new Error(`Tactical Mind Sliver UI validation failed: combat UI must not reference ${forbidden}`);
}

if (!combat.includes('return participants.filter((p) => !p.is_defeated && String(p.id) !== String(active.id));')) {
  throw new Error("Tactical Mind Sliver UI validation failed: offensive targeting must exclude self and defeated targets.");
}
if (!combat.includes('const slotLevel = Number(selectedSpell.level || 0) === 0 ? null : Number(spellSlotLevel);')) {
  throw new Error("Tactical Mind Sliver UI validation failed: cantrip slot preflight is missing.");
}
if (!/mind-sliver\|xphb[\s\S]{0,420}encounter_cast_spell_v10|encounter_cast_spell_v10[\s\S]{0,420}mind-sliver\|xphb/.test(combat)) {
  throw new Error("Tactical Mind Sliver UI validation failed: Mind Sliver must route through encounter_cast_spell_v10.");
}
if (!/chill-touch\|xphb[\s\S]{0,700}encounter_cast_spell_v9|encounter_cast_spell_v9[\s\S]{0,700}chill-touch\|xphb/.test(combat)) {
  throw new Error("Tactical Mind Sliver UI validation failed: Chill Touch must remain on encounter_cast_spell_v9.");
}
if (!/ray-of-frost\|xphb[\s\S]{0,840}encounter_cast_spell_v8|encounter_cast_spell_v8[\s\S]{0,840}ray-of-frost\|xphb/.test(combat)) {
  throw new Error("Tactical Mind Sliver UI validation failed: Ray of Frost must remain on encounter_cast_spell_v8.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1R",
  "Mind Sliver",
  "SERVER DEPLOYED / VALIDATED",
  "20260729183810",
  "20260729184616",
  "2df1b481-7074-4578-b2e9-2a55fde3cba0",
  "11 reviewed spell assignments",
]) {
  if (!status.includes(token)) throw new Error(`Tactical Mind Sliver UI validation failed: status document missing ${token}`);
}

console.log("Tactical Mind Sliver combat UI validation passed.");
