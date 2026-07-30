import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260730_01_tactical_legacy_attack_spell_hardening.sql";
const absolute = path.join(process.cwd(), migrationPath);
if (!fs.existsSync(absolute)) throw new Error(`Phase 1T legacy hardening validation failed: missing ${migrationPath}`);
if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Phase 1T legacy hardening validation failed: empty ${migrationPath}`);

const sql = fs.readFileSync(absolute, "utf8");
const required = [
  "create or replace function public.encounter_cast_spell_v1(",
  "create or replace function public.encounter_cast_spell_v4(",
  "create or replace function public.encounter_cast_spell_v7(",
  "create or replace function public.encounter_cast_spell_v8(",
  "create or replace function public.encounter_cast_spell_v9(",
  "v_key='fire-bolt|xphb'",
  "v_key='poison-spray|xphb'",
  "v_key='shocking-grasp|xphb'",
  "v_key='ray-of-frost|xphb'",
  "v_key='chill-touch|xphb'",
  "return public.encounter_cast_spell_v11(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);",
  "v_key<>'cure-wounds|xphb'",
  "v_dice_count:=2*p_slot_level;",
  "public.encounter_apply_healing_internal_v1(v_t.id,v_heal_total)",
  "update public.encounter_spell_slots set slots_remaining=slots_remaining-1",
  "update public.encounter_participants set action_available=false",
  "return public.encounter_cast_spell_v3(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);",
  "return public.encounter_cast_spell_v6(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);",
  "return public.encounter_cast_spell_v7(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);",
  "return public.encounter_cast_spell_v8(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);",
  "grant execute on function public.encounter_cast_spell_v1(uuid,uuid,uuid,integer,uuid) to authenticated, service_role;",
  "grant execute on function public.encounter_cast_spell_v4(uuid,uuid,uuid,integer,uuid) to authenticated, service_role;",
  "grant execute on function public.encounter_cast_spell_v7(uuid,uuid,uuid,integer,uuid) to authenticated, service_role;",
  "grant execute on function public.encounter_cast_spell_v8(uuid,uuid,uuid,integer,uuid) to authenticated, service_role;",
  "grant execute on function public.encounter_cast_spell_v9(uuid,uuid,uuid,integer,uuid) to authenticated, service_role;",
  "legacy attack compatibility RPCs must remain unavailable to anon",
];
for (const token of required) {
  if (!sql.includes(token)) throw new Error(`Phase 1T legacy hardening validation failed: missing contract ${token}`);
}

const redirects = sql.match(/return public\.encounter_cast_spell_v11\(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id\);/g) || [];
if (redirects.length !== 5) {
  throw new Error(`Phase 1T legacy hardening validation failed: expected 5 v11 redirects, found ${redirects.length}`);
}

for (const forbidden of [
  "drop function public.encounter_cast_spell_v1",
  "drop function public.encounter_cast_spell_v4",
  "drop function public.encounter_cast_spell_v7",
  "drop function public.encounter_cast_spell_v8",
  "drop function public.encounter_cast_spell_v9",
  "revoke execute on function public.encounter_cast_spell_v1(uuid,uuid,uuid,integer,uuid) from authenticated",
  "map_routes",
  "map_route_points",
  "world_state",
  "world_events",
  "town_map_flags",
  "advance_all_characters",
  "weather",
]) {
  if (sql.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`Phase 1T legacy hardening validation failed: forbidden contract ${forbidden}`);
}

console.log("Phase 1T legacy attack-spell hardening validation passed.");
