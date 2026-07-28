import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260727_14_tactical_single_target_save_spell.sql";
const statusPath = "docs/Tactical_Encounter_Phase1J_Save_Spells_Status.md";

for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical save-spell validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical save-spell validation failed: empty ${rel}`);
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
const required = [
  "public.encounter_cast_spell_v2",
  "public.encounter_cast_spell_v1",
  "sacred-flame|xphb",
  "encounter_spellcasting_profile_v1",
  "encounter_targeting_context_internal_v1",
  "encounter_saving_throw_profile_internal_v1",
  "encounter_apply_damage_internal_v1",
  "Save spells against targets with active conditions remain GM-assisted",
  "v_save_advantage:=coalesce(v_t.dodging,false)",
  "greatest(v_roll1,v_roll2)",
  "Target is beyond Sacred Flame range",
  "coverSaveBonus',0",
  "ignoresHalfAndThreeQuarterCoverForSave',true",
  "'damageType','radiant'",
  "on conflict(request_id) do nothing",
  "set action_available=false",
  "Phase 1I cast RPC must remain available",
];
for (const token of required) {
  if (!sql.includes(token)) throw new Error(`Tactical save-spell validation failed: missing contract ${token}`);
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
  "dexSaveCoverBonus",
  "healing-word|xphb",
  "hold-person|xphb",
]) {
  if (sql.includes(forbidden)) throw new Error(`Tactical save-spell validation failed: unexpected contract ${forbidden}`);
}

if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_spell_v2\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical save-spell validation failed: anonymous casting must remain unavailable.");
}
if (/update\s+public\.character_spells\s+set/i.test(sql) || /delete\s+from\s+public\.character_spells/i.test(sql)) {
  throw new Error("Tactical save-spell validation failed: save-spell casting must not mutate canonical spell assignments.");
}
if (/insert\s+into\s+public\.spells_catalog/i.test(sql) || /update\s+public\.spells_catalog/i.test(sql)) {
  throw new Error("Tactical save-spell validation failed: save-spell casting must not mutate spell definitions.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of ["Phase 1J", "Sacred Flame", "Half Cover", "Dodge", "GM-assisted", "encounter_cast_spell_v2"]) {
  if (!status.includes(token)) throw new Error(`Tactical save-spell validation failed: status document missing ${token}`);
}

console.log("Tactical single-target save-spell validation passed.");
