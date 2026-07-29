import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260729_02_tactical_word_of_radiance.sql";
const statusPath = "docs/Tactical_Encounter_Phase1S_Word_of_Radiance_Status.md";
for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Word of Radiance validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Word of Radiance validation failed: empty ${rel}`);
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
const required = [
  "public.encounter_cast_area_spell_v1",
  "p_target_ids uuid[]",
  "word-of-radiance|xphb",
  "lower(coalesce(v_assignment.source_label,''))<>'cleric'",
  "lower(coalesce(v_profile->>'className',''))<>'cleric'",
  "v_spell.source<>'XPHB'",
  "v_spell.level<>0",
  "Cantrips do not use spell slots",
  "cardinality(p_target_ids)=0",
  "count(distinct x)",
  "Area spell target list contains duplicates",
  "foreach v_target_id in array p_target_ids loop",
  "v_target_id=v_c.id",
  "Every selected Word of Radiance target must be visible from the caster",
  "Every selected Word of Radiance target must be inside the 5-foot Emanation",
  "Word of Radiance against targets with active conditions remains GM-assisted in this slice",
  "public.encounter_saving_throw_profile_internal_v1(v_t.id,'con')",
  "v_shared_damage_roll:=v_shared_damage_roll+floor(random()*v_die_size)::integer+1",
  "public.encounter_apply_damage_internal_v1(v_t.id,v_shared_damage_roll,'radiant')",
  "'areaType','emanation'",
  "'areaRadiusFt',5",
  "'selectedTargetCount',v_target_count",
  "'sharedDamageRoll',v_shared_damage_roll",
  "'successCount',v_success_count",
  "'failureCount',v_failure_count",
  "'targets',v_target_results",
  "'savePenalty',coalesce((v_save_profile->>'savePenalty')::integer,0)",
  "p_request_id,v_c.encounter_id,v_c.id,'spell_cast',v_uid",
  "v_existing.command_type<>'spell_cast'",
  "on conflict(request_id) do nothing",
  "set action_available=false",
  "grant execute on function public.encounter_cast_area_spell_v1(uuid,uuid,uuid[],integer,uuid) to authenticated, service_role",
  "to_regprocedure('public.encounter_cast_spell_v10(uuid,uuid,uuid,integer,uuid)')",
];
for (const token of required) {
  if (!sql.includes(token)) throw new Error(`Tactical Word of Radiance validation failed: missing contract ${token}`);
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
  "guiding-bolt|xphb",
  "vicious-mockery|xphb",
  "ray-of-sickness|xphb",
  "acid-splash|xphb",
]) {
  if (sql.includes(forbidden)) throw new Error(`Tactical Word of Radiance validation failed: unexpected contract ${forbidden}`);
}

if (sql.includes("'area_spell_cast'")) {
  throw new Error("Tactical Word of Radiance validation failed: area casts must reuse the constrained spell_cast ledger command type.");
}
if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_area_spell_v1\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical Word of Radiance validation failed: anonymous casting must remain unavailable.");
}

const firstTargetLoop = sql.indexOf("foreach v_target_id in array p_target_ids loop");
const sharedRoll = sql.indexOf("v_shared_damage_roll:=v_shared_damage_roll+floor(random()*v_die_size)::integer+1");
const secondTargetLoop = sql.indexOf("foreach v_target_id in array p_target_ids loop", firstTargetLoop + 1);
if (!(firstTargetLoop >= 0 && sharedRoll > firstTargetLoop && secondTargetLoop > sharedRoll)) {
  throw new Error("Tactical Word of Radiance validation failed: target validation, one shared damage roll, and target resolution must remain in that order.");
}
if (sql.indexOf("set action_available=false") < secondTargetLoop) {
  throw new Error("Tactical Word of Radiance validation failed: Action must not be spent before all selected targets resolve successfully.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1S",
  "Word of Radiance",
  "Aurelia Dawnmere",
  "5-foot Emanation",
  "Constitution",
  "1d6 Radiant",
  "rolled once",
  "encounter_cast_area_spell_v1",
  "ee2cde5ffdfd2d87e99948d7dae3fc6bb6146844",
]) {
  if (!status.includes(token)) throw new Error(`Tactical Word of Radiance validation failed: status document missing ${token}`);
}

console.log("Tactical Word of Radiance server validation passed.");