import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260730_04_tactical_acid_splash.sql";
const statusPath = "docs/Tactical_Encounter_Phase1W_Acid_Splash_Status.md";

for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Acid Splash validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
    throw new Error(`Tactical Acid Splash validation failed: missing/empty ${rel}`);
  }
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
const required = [
  "private.encounter_hex_targeting_context_v1",
  "public.encounter_cast_point_area_spell_v1",
  "p_origin_q integer",
  "p_origin_r integer",
  "acid-splash|xphb",
  "Acid Splash automation requires a class spell assignment",
  "Acid Splash must resolve from its reviewed XPHB cantrip definition",
  "Acid Splash assignment source does not match the canonical casting class",
  "Acid Splash is not on this canonical class spell list",
  "Acid Splash casting ability does not match the canonical class",
  "Acid Splash point of origin is beyond range",
  "Acid Splash point of origin is blocked by total cover or line-of-sight obstruction",
  "Acid Splash remains GM-assisted while defeated or conditioned creatures are present in this encounter",
  "Point-area save resolution remains GM-assisted while hidden saving-throw modifiers are active",
  "fx.effect_key='mind_sliver_save_penalty'",
  "v_shared_damage_roll:=v_shared_damage_roll+floor(random()*v_die_size)::integer+1",
  "public.encounter_saving_throw_profile_internal_v1(v_t.id,'dex')",
  "v_save_total:=v_save_roll+v_save_bonus+v_cover_bonus",
  "public.encounter_apply_damage_internal_v1(v_t.id,v_shared_damage_roll,'acid')",
  "'areaType','sphere'",
  "'areaRadiusFt',5",
  "'serverDerivedMembership',true",
  "'originHex',jsonb_build_object('q',p_origin_q,'r',p_origin_r)",
  "'targets',v_target_results",
  "for update",
  "set action_available=false",
  "on conflict(request_id) do nothing",
  "p_request_id,v_c.encounter_id,v_c.id,'spell_cast',v_uid",
  "not v_t.is_hidden",
  "v_t.controller_user_id is not distinct from v_uid",
  "grant execute on function public.encounter_cast_point_area_spell_v1(uuid,uuid,integer,integer,integer,uuid) to authenticated, service_role",
  "to_regprocedure('public.encounter_cast_area_spell_v1(uuid,uuid,uuid[],integer,uuid)')",
  "to_regprocedure('public.encounter_cast_spell_v13(uuid,uuid,uuid,integer,uuid)')",
];
for (const token of required) {
  if (!sql.includes(token)) throw new Error(`Tactical Acid Splash validation failed: missing contract ${token}`);
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
  "encounter_cast_spell_v14",
]) {
  if (sql.includes(forbidden)) throw new Error(`Tactical Acid Splash validation failed: unexpected contract ${forbidden}`);
}

if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_point_area_spell_v1\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical Acid Splash validation failed: anonymous point-area casting must remain unavailable.");
}
if (/grant\s+execute\s+on\s+function\s+private\.encounter_hex_targeting_context_v1\([^)]*\)\s+to\s+[^;]*authenticated/i.test(sql)) {
  throw new Error("Tactical Acid Splash validation failed: private point targeting must not be client executable.");
}

const sharedRoll = sql.indexOf("v_shared_damage_roll:=v_shared_damage_roll+floor(random()*v_die_size)::integer+1");
const targetLoop = sql.indexOf("for v_t in", sharedRoll);
const actionSpend = sql.indexOf("set action_available=false", targetLoop);
if (!(sharedRoll >= 0 && targetLoop > sharedRoll && actionSpend > targetLoop)) {
  throw new Error("Tactical Acid Splash validation failed: shared roll, server target derivation, and Action spend ordering changed.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1W",
  "Acid Splash",
  "XPHB",
  "60-foot",
  "5-foot-radius Sphere",
  "Dexterity",
  "server-derived",
  "Pip Quillspark",
  "20 locations",
  "4 world routes",
  "9 world route points",
]) {
  if (!status.includes(token)) throw new Error(`Tactical Acid Splash validation failed: status document missing ${token}`);
}

console.log("Tactical Acid Splash server validation passed.");
