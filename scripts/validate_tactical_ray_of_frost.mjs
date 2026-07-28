import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260728_06_tactical_ray_of_frost.sql";
const statusPath = "docs/Tactical_Encounter_Phase1P_Ray_of_Frost_Status.md";
for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Ray of Frost validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Ray of Frost validation failed: empty ${rel}`);
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
const required = [
  "public.encounter_cast_spell_v8",
  "public.encounter_cast_spell_v7",
  "ray-of-frost|xphb",
  "source_turn_start",
  "private.encounter_apply_source_turn_start_effect_v1",
  "private.encounter_timed_speed_penalty_ft_v1",
  "ray_of_frost_speed_reduction",
  "speedPenaltyFt",
  "Target is beyond Ray of Frost range",
  "Close-quarters ranged spell attacks remain GM-assisted",
  "Spell attacks with active conditions on caster or target remain GM-assisted",
  "Overlapping Ray of Frost speed reductions from different casters remain GM-assisted",
  "public.encounter_canonical_speed_ft_v1(v_participant.character_id)-private.encounter_timed_speed_penalty_ft_v1(v_participant.id)",
  "public.encounter_canonical_speed_ft_v1(character_id)-private.encounter_timed_speed_penalty_ft_v1(id)",
  "'speedReductionUntil','source_next_turn_start'",
  "'damageType','cold'",
  "v_die_size integer:=8",
  "v_disadvantage:=coalesce(v_t.dodging,false)",
  "v_target_ac:=coalesce(v_t.armor_class,10)+coalesce((v_targeting->>'coverAcBonus')::integer,0)",
  "when v_roll=1 then false",
  "v_crit:=v_roll=20",
  "on conflict(request_id) do nothing",
  "set action_available=false",
];
for (const token of required) {
  if (!sql.includes(token)) throw new Error(`Tactical Ray of Frost validation failed: missing contract ${token}`);
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
  "mind-sliver|xphb",
  "vicious-mockery|xphb",
  "hold-person|xphb",
]) {
  if (sql.includes(forbidden)) throw new Error(`Tactical Ray of Frost validation failed: unexpected contract ${forbidden}`);
}

if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_spell_v8\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical Ray of Frost validation failed: anonymous casting must remain unavailable.");
}
if (/grant\s+execute\s+on\s+function\s+private\.encounter_apply_source_turn_start_effect_v1\([^)]*\)\s+to\s+[^;]*authenticated/i.test(sql)) {
  throw new Error("Tactical Ray of Frost validation failed: source-turn effect helper must remain private.");
}
if (!/if\s+v_crit\s+then\s+v_dice_count:=v_dice_count\*2/i.test(sql)) {
  throw new Error("Tactical Ray of Frost validation failed: critical hits must double damage dice.");
}
if (!sql.includes("expiry_trigger in ('target_turn_start','source_turn_start')")) {
  throw new Error("Tactical Ray of Frost validation failed: timed-effect expiry modes are not constrained.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1P",
  "Ray of Frost",
  "60 feet",
  "1d8",
  "Cold",
  "Speed",
  "source-turn-start",
  "encounter_cast_spell_v8",
  "Pip Quillspark",
]) {
  if (!status.includes(token)) throw new Error(`Tactical Ray of Frost validation failed: status document missing ${token}`);
}

console.log("Tactical Ray of Frost server validation passed.");
