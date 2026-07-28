import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260728_04_tactical_inflict_wounds.sql";
const statusPath = "docs/Tactical_Encounter_Phase1N_Inflict_Wounds_Status.md";

for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Inflict Wounds validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Inflict Wounds validation failed: empty ${rel}`);
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
const required = [
  "private.encounter_damage_after_save_v1",
  "floor(greatest(coalesce(p_full_damage,0),0)/2.0)::integer",
  "public.encounter_cast_spell_v6",
  "public.encounter_cast_spell_v5",
  "inflict-wounds|xphb",
  "v_spell.level<>1",
  "This leveled spell is not currently prepared or always available",
  "Inflict Wounds requires another creature target in this automation slice",
  "Inflict Wounds requires a target within 5 feet",
  "encounter_spellcasting_profile_v1",
  "encounter_saving_throw_profile_internal_v1(v_t.id,'con')",
  "encounter_targeting_context_internal_v1",
  "Multiple eligible spell-slot pools are not automated yet",
  "v_dice_count:=p_slot_level+1",
  "v_save_adjusted_damage:=private.encounter_damage_after_save_v1",
  "encounter_apply_damage_internal_v1",
  "'halfDamageOnSuccessfulSave',true",
  "'damageHalvedBySave',v_save_success",
  "'fullDamageRoll',v_full_damage_roll",
  "slots_remaining=slots_remaining-1",
  "set action_available=false",
  "on conflict(request_id) do nothing",
  "Phase 1M cast RPC must remain available",
  "Phase 1L cast RPC must remain available",
  "Phase 1K cast RPC must remain available",
  "Phase 1J cast RPC must remain available",
  "Phase 1I cast RPC must remain available",
];
for (const token of required) {
  if (!sql.includes(token)) throw new Error(`Tactical Inflict Wounds validation failed: missing contract ${token}`);
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
  "acid-splash|xphb",
  "guiding-bolt|xphb",
  "ray-of-sickness|xphb",
  "mind-sliver|xphb",
  "vicious-mockery|xphb",
]) {
  if (sql.includes(forbidden)) throw new Error(`Tactical Inflict Wounds validation failed: unexpected contract ${forbidden}`);
}

if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_spell_v6\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical Inflict Wounds validation failed: anonymous casting must remain unavailable.");
}
if (/grant\s+execute\s+on\s+function\s+private\.encounter_damage_after_save_v1\([^)]*\)\s+to\s+[^;]*(authenticated|anon)/i.test(sql)) {
  throw new Error("Tactical Inflict Wounds validation failed: save-adjustment helper must remain internal.");
}
if (/update\s+public\.character_spells\s+set/i.test(sql) || /delete\s+from\s+public\.character_spells/i.test(sql)) {
  throw new Error("Tactical Inflict Wounds validation failed: casting must not mutate canonical spell assignments.");
}
if (/insert\s+into\s+public\.spells_catalog/i.test(sql) || /update\s+public\.spells_catalog/i.test(sql)) {
  throw new Error("Tactical Inflict Wounds validation failed: casting must not mutate spell definitions.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1N",
  "Inflict Wounds",
  "inflict-wounds|XPHB",
  "2d10",
  "+1d10",
  "Constitution",
  "half",
  "encounter_damage_after_save_v1",
  "encounter_cast_spell_v6",
  "Aurelia Dawnmere",
]) {
  if (!status.includes(token)) throw new Error(`Tactical Inflict Wounds validation failed: status document missing ${token}`);
}

console.log("Tactical Inflict Wounds validation passed.");