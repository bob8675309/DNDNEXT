import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260730_02_tactical_vicious_mockery.sql";
const statusPath = "docs/Tactical_Encounter_Phase1U_Vicious_Mockery_Status.md";
for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
    throw new Error(`Tactical Vicious Mockery validation failed: missing/empty ${rel}`);
  }
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
for (const token of [
  "'target_turn_end'::text",
  "private.encounter_apply_target_turn_end_effect_v1",
  "private.encounter_resolve_attack_roll_v1",
  "'vicious_mockery_next_attack_disadvantage'",
  "'guiding_bolt_next_attack_advantage'",
  "v_any_disadvantage:=v_base_disadvantage or v_vicious_disadvantage",
  "v_canceled:=v_advantage and v_any_disadvantage",
  "'viciousMockeryDisadvantage'",
  "'viciousMockeryEffectConsumed'",
  "expiry_trigger='target_turn_end'",
  "public.encounter_end_turn_v1",
  "public.encounter_cast_spell_v12",
  "return public.encounter_cast_spell_v11",
  "'vicious-mockery|xphb'",
  "Vicious Mockery automation requires its reviewed Bard class assignment",
  "Vicious Mockery automation requires a canonical Bard spellcasting profile",
  "Vicious Mockery automation requires the Bard Charisma casting ability",
  "public.encounter_saving_throw_profile_internal_v1(v_t.id,'wis')",
  "public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'psychic')",
  "private.encounter_apply_target_turn_end_effect_v1(",
  "'nextAttackDisadvantageApplied'",
  "'target_next_turn_end'",
  "hearingOnlyTargetingAutomated",
  "Hearing-only Vicious Mockery targeting is not automated yet",
  "grant execute on function public.encounter_cast_spell_v12(uuid,uuid,uuid,integer,uuid) to authenticated, service_role",
]) {
  if (!sql.includes(token)) throw new Error(`Tactical Vicious Mockery validation failed: missing contract ${token}`);
}

if (!/if v_key<>'vicious-mockery\|xphb' then\s*return public\.encounter_cast_spell_v11/.test(sql)) {
  throw new Error("Tactical Vicious Mockery validation failed: v12 must delegate all non-Vicious-Mockery spells to v11.");
}
if (!/where fx\.participant_id=v_a\.id[\s\S]{0,180}vicious_mockery_next_attack_disadvantage/.test(sql)) {
  throw new Error("Tactical Vicious Mockery validation failed: one-shot Disadvantage must be consumed from the attacker.");
}
if (!/where fx\.participant_id=v_t\.id[\s\S]{0,180}guiding_bolt_next_attack_advantage/.test(sql)) {
  throw new Error("Tactical Vicious Mockery validation failed: Guiding Bolt Advantage must remain target-scoped.");
}
if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_spell_v12\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical Vicious Mockery validation failed: anonymous v12 casting must remain unavailable.");
}
for (const forbidden of [
  "map_routes",
  "map_route_points",
  "world_state",
  "world_events",
  "town_map_flags",
  "town_map_labels",
  "advance_all_characters",
  "weather",
  "vicious-mockery|PHB",
]) {
  if (sql.includes(forbidden)) throw new Error(`Tactical Vicious Mockery validation failed: unexpected contract ${forbidden}`);
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1U",
  "Vicious Mockery",
  "target-turn-end",
  "Wisdom",
  "Psychic",
  "next attack roll",
  "Disadvantage",
  "Guiding Bolt",
  "encounter_cast_spell_v12",
  "80ea7ba3f4d08695bf923672e5a4d69475b0de8e",
]) {
  if (!status.includes(token)) throw new Error(`Tactical Vicious Mockery validation failed: status document missing ${token}`);
}

console.log("Tactical Vicious Mockery server validation passed.");
