import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260727_13_tactical_spell_casting_slice.sql";
const statusPath = "docs/Tactical_Encounter_Phase1I_Spell_Foundation_Status.md";

for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical spell casting validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical spell casting validation failed: empty ${rel}`);
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
const required = [
  "'spell_cast'",
  "public.encounter_cast_spell_v1",
  "encounter_spell_slots",
  "encounter_spellcasting_profile_v1",
  "encounter_targeting_context_internal_v1",
  "encounter_apply_damage_internal_v1",
  "encounter_apply_healing_internal_v1",
  "encounter_are_hostile_internal_v1",
  "fire-bolt|xphb",
  "cure-wounds|xphb",
  "Only class spell assignments are automated",
  "Only reviewed XPHB spell versions are automated",
  "not (v_assignment.prepared or v_assignment.always_available)",
  "Close-quarters ranged spell attacks remain GM-assisted",
  "Spell attacks with active conditions on caster or target remain GM-assisted",
  "Target is hidden from this controller",
  "Multiple eligible spell-slot pools are not automated yet",
  "on conflict(request_id) do nothing",
  "set slots_remaining=slots_remaining-1",
  "set action_available=false",
  "supabase_realtime",
];
for (const token of required) {
  if (!sql.includes(token)) throw new Error(`Tactical spell casting validation failed: missing contract ${token}`);
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
]) {
  if (sql.includes(forbidden)) throw new Error(`Tactical spell casting validation failed: tactical casting must not reference ${forbidden}`);
}

if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_spell_v1\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical spell casting validation failed: anonymous casting must remain unavailable.");
}
if (/update\s+public\.character_spells\s+set/i.test(sql) || /delete\s+from\s+public\.character_spells/i.test(sql)) {
  throw new Error("Tactical spell casting validation failed: casting must not mutate canonical spell assignments.");
}
if (/insert\s+into\s+public\.spells_catalog/i.test(sql) || /update\s+public\.spells_catalog/i.test(sql)) {
  throw new Error("Tactical spell casting validation failed: casting must not mutate spell definitions.");
}
if (sql.includes("healing-word|xphb") || sql.includes("sacred-flame|xphb") || sql.includes("hold-person|xphb")) {
  throw new Error("Tactical spell casting validation failed: unapproved spell adapters were added to the first casting slice.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of ["Phase 1I", "Fire Bolt", "Cure Wounds", "GM-assisted", "spell_cast"]) {
  if (!status.includes(token)) throw new Error(`Tactical spell casting validation failed: status document missing ${token}`);
}

console.log("Tactical spell casting validation passed.");
