import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260729_03_tactical_attack_roll_modifiers.sql";
const absolute = path.join(process.cwd(), migrationPath);
if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
  throw new Error(`Tactical attack-roll modifier validation failed: missing/empty ${migrationPath}`);
}
const sql = fs.readFileSync(absolute, "utf8");

for (const token of [
  "private.encounter_resolve_attack_roll_v1",
  "guiding_bolt_next_attack_advantage",
  "for update",
  "delete from public.encounter_timed_effects",
  "'effect_consumed'",
  "v_canceled:=v_advantage and v_base_disadvantage",
  "v_effective_advantage:=v_advantage and not v_base_disadvantage",
  "v_effective_disadvantage:=v_base_disadvantage and not v_advantage",
  "when v_effective_advantage then greatest(v_roll1,v_roll2)",
  "when v_effective_disadvantage then least(v_roll1,v_roll2)",
  "'advantageCanceledByDisadvantage',v_canceled",
  "create or replace function public.encounter_weapon_attack_v1",
  "create or replace function public.encounter_unarmed_strike_v1",
  "create or replace function public.encounter_opportunity_attack_internal_v1",
  "private.encounter_resolve_attack_roll_v1(v_a.id,v_t.id,v_base_disadvantage)",
  "private.encounter_resolve_attack_roll_v1(v_r.id,v_m.id,v_base_disadvantage)",
  "'guidingBoltEffectConsumed'",
  "grant execute on function private.encounter_resolve_attack_roll_v1(uuid,uuid,boolean) to service_role",
  "has_function_privilege('authenticated','private.encounter_resolve_attack_roll_v1(uuid,uuid,boolean)','EXECUTE')",
]) {
  if (!sql.includes(token)) throw new Error(`Tactical attack-roll modifier validation failed: missing contract ${token}`);
}

const callCount = (sql.match(/private\.encounter_resolve_attack_roll_v1\(/g) || []).length;
if (callCount < 4) throw new Error("Tactical attack-roll modifier validation failed: helper must be defined and used by weapon, unarmed, and opportunity attack paths.");

for (const forbidden of [
  "pg_get_functiondef",
  "regexp_replace",
  "map_routes",
  "map_route_points",
  "world_state",
  "world_events",
  "town_map_flags",
  "town_map_labels",
  "advance_all_characters",
  "weather",
]) {
  if (sql.includes(forbidden)) throw new Error(`Tactical attack-roll modifier validation failed: unexpected contract ${forbidden}`);
}

console.log("Tactical shared attack-roll modifier validation passed.");
