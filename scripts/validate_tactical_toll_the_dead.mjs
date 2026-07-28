import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260728_01_tactical_toll_the_dead.sql";
const statusPath = "docs/Tactical_Encounter_Phase1K_Toll_the_Dead_Status.md";

for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Toll the Dead validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Toll the Dead validation failed: empty ${rel}`);
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
const required = [
  "public.encounter_cast_spell_v3",
  "public.encounter_cast_spell_v2",
  "public.encounter_cast_spell_v1",
  "toll-the-dead|xphb",
  "encounter_spellcasting_profile_v1",
  "encounter_targeting_context_internal_v1",
  "encounter_saving_throw_profile_internal_v1",
  "encounter_apply_damage_internal_v1",
  "Save spells against targets with active conditions remain GM-assisted",
  "Target is beyond Toll the Dead range",
  "v_target_wounded:=coalesce(v_t.current_hp,0)<coalesce(v_t.max_hp,v_t.current_hp,0)",
  "v_die_size:=case when v_target_wounded then 12 else 8 end",
  "'saveAbility','wis'",
  "'saveAdvantage',false",
  "'saveCoverApplies',false",
  "'targetWasWounded',v_target_wounded",
  "'damageType','necrotic'",
  "on conflict(request_id) do nothing",
  "set action_available=false",
  "Phase 1J cast RPC must remain available",
  "Phase 1I cast RPC must remain available",
];
for (const token of required) {
  if (!sql.includes(token)) throw new Error(`Tactical Toll the Dead validation failed: missing contract ${token}`);
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
  "mind-sliver|xphb",
  "vicious-mockery|xphb",
  "inflict-wounds|xphb",
  "healing-word|xphb",
  "hold-person|xphb",
]) {
  if (sql.includes(forbidden)) throw new Error(`Tactical Toll the Dead validation failed: unexpected contract ${forbidden}`);
}

if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_spell_v3\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical Toll the Dead validation failed: anonymous casting must remain unavailable.");
}
if (/update\s+public\.character_spells\s+set/i.test(sql) || /delete\s+from\s+public\.character_spells/i.test(sql)) {
  throw new Error("Tactical Toll the Dead validation failed: casting must not mutate canonical spell assignments.");
}
if (/insert\s+into\s+public\.spells_catalog/i.test(sql) || /update\s+public\.spells_catalog/i.test(sql)) {
  throw new Error("Tactical Toll the Dead validation failed: casting must not mutate spell definitions.");
}
if (/v_save_advantage\s*:=\s*coalesce\(v_t\.dodging/i.test(sql) || /greatest\(v_roll1,v_roll2\)/i.test(sql)) {
  throw new Error("Tactical Toll the Dead validation failed: Dodge must not grant advantage on a Wisdom save.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1K",
  "Toll the Dead",
  "Wisdom",
  "1d8",
  "1d12",
  "current_hp < encounter_participants.max_hp",
  "Dodge does **not** grant advantage",
  "GM-assisted",
  "encounter_cast_spell_v3",
  "Aurelia Dawnmere",
  "Raska Stonejaw",
]) {
  if (!status.includes(token)) throw new Error(`Tactical Toll the Dead validation failed: status document missing ${token}`);
}

console.log("Tactical Toll the Dead validation passed.");
