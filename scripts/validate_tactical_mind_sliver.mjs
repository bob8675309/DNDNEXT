import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260728_08_tactical_mind_sliver.sql";
const statusPath = "docs/Tactical_Encounter_Phase1R_Mind_Sliver_Status.md";
for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Mind Sliver validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Mind Sliver validation failed: empty ${rel}`);
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
const required = [
  "public.encounter_saving_throw_profile_internal_v1",
  "mind_sliver_save_penalty",
  "floor(random()*4)::integer+1",
  "delete from public.encounter_timed_effects",
  "'effect_consumed'",
  "'baseSaveBonus'",
  "'savePenalty'",
  "'savePenaltyEffectId'",
  "'savePenaltySourceId'",
  "'saveBonus'",
  "public.encounter_cast_spell_v10",
  "public.encounter_cast_spell_v9",
  "mind-sliver|xphb",
  "Target is beyond Mind Sliver range",
  "Save spells against targets with active conditions remain GM-assisted in this slice",
  "public.encounter_saving_throw_profile_internal_v1(v_t.id,'int')",
  "v_die_size integer:=6",
  "'damageType','psychic'",
  "'nextSavePenaltyApplied'",
  "'nextSavePenaltyDice'",
  "'source_next_turn_end'",
  "private.encounter_apply_source_turn_end_effect_v1",
  "on conflict(request_id) do nothing",
  "set action_available=false",
];
for (const token of required) {
  if (!sql.includes(token)) throw new Error(`Tactical Mind Sliver validation failed: missing contract ${token}`);
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
  "vicious-mockery|xphb",
  "hold-person|xphb",
]) {
  if (sql.includes(forbidden)) throw new Error(`Tactical Mind Sliver validation failed: unexpected contract ${forbidden}`);
}

if (/create\s+or\s+replace\s+function\s+public\.encounter_saving_throw_profile_internal_v1[\s\S]{0,500}\bstable\b/i.test(sql)) {
  throw new Error("Tactical Mind Sliver validation failed: consuming save profile must not remain STABLE.");
}
if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_spell_v10\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical Mind Sliver validation failed: anonymous casting must remain unavailable.");
}
if (/grant\s+execute\s+on\s+function\s+public\.encounter_saving_throw_profile_internal_v1\([^)]*\)\s+to\s+[^;]*authenticated/i.test(sql)) {
  throw new Error("Tactical Mind Sliver validation failed: save profile must remain internal.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1R",
  "Mind Sliver",
  "60 feet",
  "Intelligence",
  "1d6",
  "Psychic",
  "1d4",
  "source-turn-end",
  "encounter_cast_spell_v10",
  "Pip Quillspark",
]) {
  if (!status.includes(token)) throw new Error(`Tactical Mind Sliver validation failed: status document missing ${token}`);
}

console.log("Tactical Mind Sliver server validation passed.");
