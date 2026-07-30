import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260730_07_tactical_lightning_bolt.sql";
const statusPath = "docs/Tactical_Encounter_Phase1Z_Lightning_Bolt_Status.md";

for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
    throw new Error(`Tactical Lightning Bolt validation failed: missing/empty ${rel}`);
  }
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
for (const token of [
  "private.encounter_line_100ft_hexes_v1",
  "public.encounter_cast_directional_area_spell_v2",
  "p_direction integer",
  "(0, 1, 0)",
  "(1, 1,-1)",
  "(2, 0,-1)",
  "(3,-1, 0)",
  "(4,-1, 1)",
  "(5, 0, 1)",
  "for v_depth in 1..20 loop",
  "burning-hands|xphb",
  "return public.encounter_cast_directional_area_spell_v1(",
  "p_caster_id,p_assignment_id,p_direction,p_slot_level,p_request_id",
  "lightning-bolt|xphb",
  "Lightning Bolt automation requires a class spell assignment",
  "Lightning Bolt must resolve from its reviewed XPHB level-3 definition",
  "Lightning Bolt is not currently prepared or always available",
  "Lightning Bolt assignment source does not match the canonical casting class",
  "Lightning Bolt is not on this canonical class spell list",
  "Lightning Bolt casting ability does not match the canonical class",
  "Lightning Bolt remains GM-assisted while defeated or conditioned creatures are present in this encounter",
  "Directional-area save resolution remains GM-assisted while hidden saving-throw modifiers are active",
  "perform private.encounter_enforce_spell_slot_cast_turn_v1(v_c.id,v_assignment.id,p_request_id)",
  "v_dice_count:=p_slot_level+5",
  "v_shared_damage_roll:=v_shared_damage_roll+floor(random()*6)::integer+1",
  "public.encounter_saving_throw_profile_internal_v1(v_t.id,'dex')",
  "floor(v_shared_damage_roll/2.0)::integer",
  "public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'lightning')",
  "'lineHexes',v_line_hexes",
  "'areaType','line'",
  "'areaLengthFt',100",
  "'areaWidthFt',5",
  "'hexApproximation','twenty-hex centerline'",
  "'serverDerivedMembership',true",
  "set slots_remaining=slots_remaining-1",
  "set action_available=false",
  "on conflict(request_id) do nothing",
  "p_request_id,v_c.encounter_id,v_c.id,'spell_cast',v_uid",
  "not v_t.is_hidden",
  "v_t.controller_user_id is not distinct from v_uid",
  "grant execute on function public.encounter_cast_directional_area_spell_v2(uuid,uuid,integer,integer,uuid) to authenticated, service_role",
  "to_regprocedure('public.encounter_cast_directional_area_spell_v1(uuid,uuid,integer,integer,uuid)')",
  "to_regprocedure('public.encounter_cast_spell_v13(uuid,uuid,uuid,integer,uuid)')",
  "to_regprocedure('public.encounter_cast_area_spell_v1(uuid,uuid,uuid[],integer,uuid)')",
  "to_regprocedure('public.encounter_cast_point_area_spell_v1(uuid,uuid,integer,integer,integer,uuid)')",
  "to_regprocedure('public.encounter_cast_allocated_spell_v1(uuid,uuid,jsonb,integer,uuid)')",
]) {
  if (!sql.includes(token)) {
    throw new Error(`Tactical Lightning Bolt validation failed: missing contract ${token}`);
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
    throw new Error(`Tactical Lightning Bolt validation failed: unexpected contract ${forbidden}`);
  }
}

if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_directional_area_spell_v2\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical Lightning Bolt validation failed: anonymous directional-area casting must remain unavailable.");
}
if (/grant\s+execute\s+on\s+function\s+(private\.encounter_line_100ft_hexes_v1|private\.encounter_enforce_spell_slot_cast_turn_v1)\([^)]*\)\s+to\s+[^;]*authenticated/i.test(sql)) {
  throw new Error("Tactical Lightning Bolt validation failed: private authority helpers must not be client executable.");
}

const delegate = sql.indexOf("return public.encounter_cast_directional_area_spell_v1(");
const commandInsert = sql.indexOf("insert into public.encounter_command_requests");
if (!(delegate >= 0 && commandInsert > delegate)) {
  throw new Error("Tactical Lightning Bolt validation failed: Burning Hands delegation must occur before the v2 command insert.");
}

const targetLock = sql.indexOf("for update of p");
const slotGuard = sql.indexOf("perform private.encounter_enforce_spell_slot_cast_turn_v1", targetLock);
const sharedRoll = sql.indexOf("v_shared_damage_roll:=v_shared_damage_roll+floor(random()*6)::integer+1", slotGuard);
const targetLoop = sql.indexOf("for v_t in", sharedRoll);
const slotSpend = sql.indexOf("set slots_remaining=slots_remaining-1", targetLoop);
const actionSpend = sql.indexOf("set action_available=false", slotSpend);
if (!(targetLock >= 0 && slotGuard > targetLock && sharedRoll > slotGuard && targetLoop > sharedRoll && slotSpend > targetLoop && actionSpend > slotSpend)) {
  throw new Error("Tactical Lightning Bolt validation failed: lock, slot guard, shared roll, target resolution, slot spend, and Action spend ordering changed.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1Z",
  "Lightning Bolt",
  "XPHB",
  "100-foot-long, 5-foot-wide Line",
  "20-hex centerline",
  "Dexterity",
  "8d6",
  "Lightning",
  "Pip Quillspark",
  "level 2",
  "does not create an off-level spell assignment",
  "17 reviewed spell assignments",
  "0 Lightning Bolt assignments",
  "20 locations",
  "4 world routes",
  "9 world route points",
]) {
  if (!status.includes(token)) {
    throw new Error(`Tactical Lightning Bolt validation failed: status document missing ${token}`);
  }
}

console.log("Tactical Lightning Bolt server validation passed.");
