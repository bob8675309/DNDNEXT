import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260730_05_tactical_magic_missile.sql";
const statusPath = "docs/Tactical_Encounter_Phase1X_Magic_Missile_Status.md";

for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
    throw new Error(`Tactical Magic Missile validation failed: missing/empty ${rel}`);
  }
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
const required = [
  "public.encounter_cast_allocated_spell_v1",
  "p_allocations jsonb",
  "magic-missile|xphb",
  "Magic Missile automation requires a class spell assignment",
  "Magic Missile must resolve from its reviewed XPHB level-1 definition",
  "Magic Missile is not currently prepared or always available",
  "Magic Missile assignment source does not match the canonical casting class",
  "Magic Missile is not on this canonical class spell list",
  "Magic Missile casting ability does not match the canonical class",
  "v_expected_darts:=p_slot_level+2",
  "Magic Missile must allocate exactly % darts for the selected slot level",
  "Magic Missile target allocations must be unique",
  "order by p.id",
  "for update",
  "Every Magic Missile target must be visible and not behind Total Cover",
  "Every Magic Missile target must be within 120 feet",
  "perform private.encounter_enforce_spell_slot_cast_turn_v1(v_c.id,v_assignment.id,p_request_id)",
  "v_raw_damage:=floor(random()*4)::integer+2",
  "public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'force')",
  "'damageDice','1d4+1 per dart'",
  "'simultaneous',true",
  "'shieldReactionAutomated',false",
  "set slots_remaining=slots_remaining-1",
  "set action_available=false",
  "on conflict(request_id) do nothing",
  "p_request_id,v_c.encounter_id,v_c.id,'spell_cast',v_uid",
  "grant execute on function public.encounter_cast_allocated_spell_v1(uuid,uuid,jsonb,integer,uuid) to authenticated, service_role",
  "to_regprocedure('public.encounter_cast_spell_v13(uuid,uuid,uuid,integer,uuid)')",
  "to_regprocedure('public.encounter_cast_area_spell_v1(uuid,uuid,uuid[],integer,uuid)')",
  "to_regprocedure('public.encounter_cast_point_area_spell_v1(uuid,uuid,integer,integer,integer,uuid)')",
];

for (const token of required) {
  if (!sql.includes(token)) {
    throw new Error(`Tactical Magic Missile validation failed: missing contract ${token}`);
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
]) {
  if (sql.includes(forbidden)) {
    throw new Error(`Tactical Magic Missile validation failed: unexpected contract ${forbidden}`);
  }
}

if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_allocated_spell_v1\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical Magic Missile validation failed: anonymous allocated casting must remain unavailable.");
}
if (/grant\s+execute\s+on\s+function\s+(public\.encounter_apply_damage_internal_v1|private\.encounter_enforce_spell_slot_cast_turn_v1)\([^)]*\)\s+to\s+[^;]*authenticated/i.test(sql)) {
  throw new Error("Tactical Magic Missile validation failed: internal authority helpers must not be client executable.");
}

const targetValidation = sql.indexOf("for v_index in 1..v_target_count loop");
const slotGuard = sql.indexOf("perform private.encounter_enforce_spell_slot_cast_turn_v1", targetValidation);
const damageLoop = sql.indexOf("for v_index in 1..v_target_count loop", slotGuard);
const slotSpend = sql.indexOf("set slots_remaining=slots_remaining-1", damageLoop);
const actionSpend = sql.indexOf("set action_available=false", slotSpend);
if (!(targetValidation >= 0 && slotGuard > targetValidation && damageLoop > slotGuard && slotSpend > damageLoop && actionSpend > slotSpend)) {
  throw new Error("Tactical Magic Missile validation failed: validate, slot guard, damage, slot spend, and Action spend ordering changed.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1X",
  "Magic Missile",
  "XPHB",
  "120 feet",
  "1d4 + 1",
  "Force",
  "slot level + 2",
  "Pip Quillspark",
  "Shield",
  "concentration",
  "20 locations",
  "4 world routes",
  "9 world route points",
]) {
  if (!status.includes(token)) {
    throw new Error(`Tactical Magic Missile validation failed: status document missing ${token}`);
  }
}

console.log("Tactical Magic Missile server validation passed.");
