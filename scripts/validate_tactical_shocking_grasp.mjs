import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260728_05_tactical_shocking_grasp.sql";
const statusPath = "docs/Tactical_Encounter_Phase1O_Shocking_Grasp_Status.md";

for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Shocking Grasp validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Shocking Grasp validation failed: empty ${rel}`);
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
const required = [
  "public.encounter_timed_effects",
  "remaining_target_turn_starts",
  "encounter_timed_effects_authenticated_read",
  "private.encounter_has_timed_effect_v1",
  "private.encounter_apply_target_turn_start_effect_v1",
  "private.expire_encounter_timed_effects_on_turn_start_v1",
  "after update of active_participant_id on public.encounters",
  "opportunity_attack_suppressed",
  "public.encounter_threat_reach_ft_internal_v1",
  "then return 0",
  "Opportunity attacks are suppressed until this participant''s next turn starts",
  "public.encounter_opportunity_attack_internal_v1",
  "public.encounter_cast_spell_v7",
  "public.encounter_cast_spell_v6",
  "shocking-grasp|xphb",
  "v_spell.source<>'XPHB'",
  "v_spell.level<>0",
  "Cantrips do not use spell slots",
  "Target is beyond Shocking Grasp reach",
  "v_assignment.attack_bonus_override",
  "v_t.dodging",
  "coverAcBonus",
  "when coalesce((v_profile->>'classLevel')::integer,1)>=17 then 4",
  "v_die_size integer:=8",
  "encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'lightning')",
  "encounter_apply_target_turn_start_effect_v1",
  "'opportunityAttackSuppressed',v_hit",
  "set action_available=false",
  "on conflict(request_id) do nothing",
  "Phase 1N cast RPC must remain available",
  "authenticated clients must not directly mutate timed tactical effects",
];
for (const token of required) {
  if (!sql.includes(token)) throw new Error(`Tactical Shocking Grasp validation failed: missing contract ${token}`);
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
  "mind-sliver|xphb",
  "vicious-mockery|xphb",
  "ray-of-frost|xphb",
  "ray-of-sickness|xphb",
  "guiding-bolt|xphb",
  "chill-touch|xphb",
]) {
  if (sql.includes(forbidden)) throw new Error(`Tactical Shocking Grasp validation failed: unexpected contract ${forbidden}`);
}

if (/grant\s+(insert|update|delete|all)\s+on\s+public\.encounter_timed_effects\s+to\s+authenticated/i.test(sql)) {
  throw new Error("Tactical Shocking Grasp validation failed: authenticated clients must not directly write timed tactical effects.");
}
if (/grant\s+execute\s+on\s+function\s+private\.encounter_apply_target_turn_start_effect_v1\([^)]*\)\s+to\s+[^;]*authenticated/i.test(sql)) {
  throw new Error("Tactical Shocking Grasp validation failed: timed effect helper must remain internal.");
}
if (/update\s+public\.character_spells\s+set/i.test(sql) || /delete\s+from\s+public\.character_spells/i.test(sql)) {
  throw new Error("Tactical Shocking Grasp validation failed: casting must not mutate canonical spell assignments.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1O",
  "Shocking Grasp",
  "shocking-grasp|XPHB",
  "1d8",
  "Lightning",
  "Opportunity Attack",
  "start of the target's next turn",
  "encounter_timed_effects",
  "encounter_cast_spell_v7",
  "Pip Quillspark",
]) {
  if (!status.includes(token)) throw new Error(`Tactical Shocking Grasp validation failed: status document missing ${token}`);
}

console.log("Tactical Shocking Grasp validation passed.");
