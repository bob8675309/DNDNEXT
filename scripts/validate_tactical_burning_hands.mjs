import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260730_06_tactical_burning_hands.sql";
const statusPath = "docs/Tactical_Encounter_Phase1Y_Burning_Hands_Status.md";

for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
    throw new Error(`Tactical Burning Hands validation failed: missing/empty ${rel}`);
  }
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
for (const token of [
  "private.encounter_cone_15ft_hexes_v1",
  "public.encounter_cast_directional_area_spell_v1",
  "p_direction integer",
  "burning-hands|xphb",
  "seven-hex 1/3/3 footprint",
  "(1, 0, 1)",
  "(2,-1, 2)",
  "(1, 1, 2)",
  "(3,-1, 3)",
  "(2, 1, 3)",
  "Burning Hands automation requires a class spell assignment",
  "Burning Hands must resolve from its reviewed XPHB level-1 definition",
  "Burning Hands is not currently prepared or always available",
  "Burning Hands assignment source does not match the canonical casting class",
  "Burning Hands is not on this canonical class spell list",
  "Burning Hands casting ability does not match the canonical class",
  "Burning Hands remains GM-assisted while defeated or conditioned creatures are present in this encounter",
  "Directional-area save resolution remains GM-assisted while hidden saving-throw modifiers are active",
  "perform private.encounter_enforce_spell_slot_cast_turn_v1(v_c.id,v_assignment.id,p_request_id)",
  "v_dice_count:=p_slot_level+2",
  "v_shared_damage_roll:=v_shared_damage_roll+floor(random()*6)::integer+1",
  "public.encounter_saving_throw_profile_internal_v1(v_t.id,'dex')",
  "floor(v_shared_damage_roll/2.0)::integer",
  "public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'fire')",
  "'areaType','cone'",
  "'areaLengthFt',15",
  "'serverDerivedMembership',true",
  "'objectIgnitionAutomated',false",
  "set slots_remaining=slots_remaining-1",
  "set action_available=false",
  "on conflict(request_id) do nothing",
  "p_request_id,v_c.encounter_id,v_c.id,'spell_cast',v_uid",
  "not v_t.is_hidden",
  "v_t.controller_user_id is not distinct from v_uid",
  "grant execute on function public.encounter_cast_directional_area_spell_v1(uuid,uuid,integer,integer,uuid) to authenticated, service_role",
  "to_regprocedure('public.encounter_cast_spell_v13(uuid,uuid,uuid,integer,uuid)')",
  "to_regprocedure('public.encounter_cast_area_spell_v1(uuid,uuid,uuid[],integer,uuid)')",
  "to_regprocedure('public.encounter_cast_point_area_spell_v1(uuid,uuid,integer,integer,integer,uuid)')",
  "to_regprocedure('public.encounter_cast_allocated_spell_v1(uuid,uuid,jsonb,integer,uuid)')",
]) {
  if (!sql.includes(token)) {
    throw new Error(`Tactical Burning Hands validation failed: missing contract ${token}`);
  }
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
  "encounter_cast_area_spell_v2",
  "encounter_cast_point_area_spell_v2",
  "encounter_cast_allocated_spell_v2",
]) {
  if (sql.includes(forbidden)) {
    throw new Error(`Tactical Burning Hands validation failed: unexpected contract ${forbidden}`);
  }
}

if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_directional_area_spell_v1\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical Burning Hands validation failed: anonymous directional-area casting must remain unavailable.");
}
if (/grant\s+execute\s+on\s+function\s+(private\.encounter_cone_15ft_hexes_v1|private\.encounter_enforce_spell_slot_cast_turn_v1)\([^)]*\)\s+to\s+[^;]*authenticated/i.test(sql)) {
  throw new Error("Tactical Burning Hands validation failed: private authority helpers must not be client executable.");
}

const targetLock = sql.indexOf("for update of p");
const slotGuard = sql.indexOf("perform private.encounter_enforce_spell_slot_cast_turn_v1", targetLock);
const sharedRoll = sql.indexOf("v_shared_damage_roll:=v_shared_damage_roll+floor(random()*6)::integer+1", slotGuard);
const targetLoop = sql.indexOf("for v_t in", sharedRoll);
const slotSpend = sql.indexOf("set slots_remaining=slots_remaining-1", targetLoop);
const actionSpend = sql.indexOf("set action_available=false", slotSpend);
if (!(targetLock >= 0 && slotGuard > targetLock && sharedRoll > slotGuard && targetLoop > sharedRoll && slotSpend > targetLoop && actionSpend > slotSpend)) {
  throw new Error("Tactical Burning Hands validation failed: lock, slot guard, shared roll, target resolution, slot spend, and Action spend ordering changed.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1Y",
  "Burning Hands",
  "XPHB",
  "15-foot Cone",
  "seven-hex",
  "1 / 3 / 3",
  "Dexterity",
  "3d6",
  "Fire",
  "Pip Quillspark",
  "object ignition",
  "20 locations",
  "4 world routes",
  "9 world route points",
]) {
  if (!status.includes(token)) {
    throw new Error(`Tactical Burning Hands validation failed: status document missing ${token}`);
  }
}

console.log("Tactical Burning Hands server validation passed.");
