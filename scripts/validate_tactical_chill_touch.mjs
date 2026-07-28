import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260728_07_tactical_chill_touch.sql";
const statusPath = "docs/Tactical_Encounter_Phase1Q_Chill_Touch_Status.md";

for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Chill Touch validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Chill Touch validation failed: empty ${rel}`);
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
const required = [
  "public.encounter_cast_spell_v9",
  "public.encounter_cast_spell_v8",
  "chill-touch|xphb",
  "source_turn_end",
  "private.encounter_apply_source_turn_end_effect_v1",
  "chill_touch_no_healing",
  "preventsHealing",
  "public.encounter_apply_healing_internal_v1",
  "'healingPrevented',true",
  "'targetDefeated',v_t.is_defeated",
  "Overlapping Chill Touch healing locks from different casters remain GM-assisted",
  "Target is beyond Chill Touch reach",
  "Spell attacks with active conditions on caster or target remain GM-assisted",
  "v_die_size integer:=10",
  "v_disadvantage:=coalesce(v_t.dodging,false)",
  "v_target_ac:=coalesce(v_t.armor_class,10)+coalesce((v_targeting->>'coverAcBonus')::integer,0)",
  "v_crit:=v_roll=20",
  "when v_roll=1 then false",
  "'damageType','necrotic'",
  "'healingPreventedUntil','source_next_turn_end'",
  "p_source_turn_ends integer default 2",
  "and remaining_target_turn_starts=1",
  "and remaining_target_turn_starts>1",
  "on conflict(request_id) do nothing",
  "set action_available=false",
];
for (const token of required) {
  if (!sql.includes(token)) throw new Error(`Tactical Chill Touch validation failed: missing contract ${token}`);
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
  if (sql.includes(forbidden)) throw new Error(`Tactical Chill Touch validation failed: unexpected contract ${forbidden}`);
}

if (!sql.includes("expiry_trigger in ('target_turn_start','source_turn_start','source_turn_end')")) {
  throw new Error("Tactical Chill Touch validation failed: timed-effect expiry modes are not constrained.");
}
if (!/if\s+v_crit\s+then\s+v_dice_count:=v_dice_count\*2/i.test(sql)) {
  throw new Error("Tactical Chill Touch validation failed: critical hits must double damage dice.");
}
if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_spell_v9\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical Chill Touch validation failed: anonymous casting must remain unavailable.");
}
if (/grant\s+execute\s+on\s+function\s+private\.encounter_apply_source_turn_end_effect_v1\([^)]*\)\s+to\s+[^;]*authenticated/i.test(sql)) {
  throw new Error("Tactical Chill Touch validation failed: source-turn-end effect helper must remain private.");
}
if (/grant\s+execute\s+on\s+function\s+public\.encounter_apply_healing_internal_v1\([^)]*\)\s+to\s+[^;]*authenticated/i.test(sql)) {
  throw new Error("Tactical Chill Touch validation failed: healing helper must remain private.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1Q",
  "Chill Touch",
  "Touch",
  "1d10",
  "Necrotic",
  "source-turn-end",
  "cannot regain Hit Points",
  "encounter_cast_spell_v9",
  "Pip Quillspark",
]) {
  if (!status.includes(token)) throw new Error(`Tactical Chill Touch validation failed: status document missing ${token}`);
}

console.log("Tactical Chill Touch server validation passed.");
