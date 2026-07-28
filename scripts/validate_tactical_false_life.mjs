import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260728_03_tactical_false_life.sql";
const statusPath = "docs/Tactical_Encounter_Phase1M_False_Life_Status.md";

for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical False Life validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical False Life validation failed: empty ${rel}`);
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
const required = [
  "public.encounter_cast_spell_v5",
  "public.encounter_cast_spell_v4",
  "false-life|xphb",
  "v_spell.level<>1",
  "This leveled spell is not currently prepared or always available",
  "False Life can target only the caster",
  "encounter_spellcasting_profile_v1",
  "encounter_spell_slots",
  "Multiple eligible spell-slot pools are not automated yet",
  "False Life with existing Temporary HP remains GM-assisted in this slice",
  "v_roll:=(floor(random()*4)::integer+1)+(floor(random()*4)::integer+1)",
  "v_base_temp_hp:=v_roll+4",
  "v_upcast_bonus:=5*(p_slot_level-1)",
  "temp_hp=v_temp_hp_granted",
  "temporaryHpDice','2d4+4'",
  "temporaryHpGranted',v_temp_hp_granted",
  "slots_remaining=slots_remaining-1",
  "set action_available=false",
  "on conflict(request_id) do nothing",
  "Phase 1L cast RPC must remain available",
  "Phase 1K cast RPC must remain available",
  "Phase 1J cast RPC must remain available",
  "Phase 1I cast RPC must remain available",
];
for (const token of required) {
  if (!sql.includes(token)) throw new Error(`Tactical False Life validation failed: missing contract ${token}`);
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
  "healing-word|xphb",
  "inflict-wounds|xphb",
  "guiding-bolt|xphb",
  "ray-of-frost|xphb",
  "chill-touch|xphb",
]) {
  if (sql.includes(forbidden)) throw new Error(`Tactical False Life validation failed: unexpected contract ${forbidden}`);
}

if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_spell_v5\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical False Life validation failed: anonymous casting must remain unavailable.");
}
if (/update\s+public\.character_spells\s+set/i.test(sql) || /delete\s+from\s+public\.character_spells/i.test(sql)) {
  throw new Error("Tactical False Life validation failed: casting must not mutate canonical spell assignments.");
}
if (/insert\s+into\s+public\.spells_catalog/i.test(sql) || /update\s+public\.spells_catalog/i.test(sql)) {
  throw new Error("Tactical False Life validation failed: casting must not mutate spell definitions.");
}
if (/temp_hp\s*=\s*coalesce\([^;]*\+/i.test(sql)) {
  throw new Error("Tactical False Life validation failed: Temporary HP must not stack.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1M",
  "False Life",
  "2d4 + 4",
  "+5",
  "Temporary HP",
  "existing Temporary HP",
  "encounter_cast_spell_v5",
  "Pip Quillspark",
]) {
  if (!status.includes(token)) throw new Error(`Tactical False Life validation failed: status document missing ${token}`);
}

console.log("Tactical False Life validation passed.");
