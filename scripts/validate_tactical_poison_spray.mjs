import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260728_02_tactical_poison_spray.sql";
const statusPath = "docs/Tactical_Encounter_Phase1L_Poison_Spray_Status.md";

for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Poison Spray validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Poison Spray validation failed: empty ${rel}`);
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
const required = [
  "public.encounter_cast_spell_v4",
  "public.encounter_cast_spell_v3",
  "poison-spray|xphb",
  "encounter_spellcasting_profile_v1",
  "encounter_targeting_context_internal_v1",
  "encounter_apply_damage_internal_v1",
  "Target is beyond Poison Spray range",
  "Close-quarters ranged spell attacks remain GM-assisted",
  "Spell attacks with active conditions on caster or target remain GM-assisted",
  "v_die_size integer:=12",
  "v_disadvantage:=coalesce(v_t.dodging,false)",
  "v_roll:=case when v_disadvantage then least(v_roll1,v_roll2) else v_roll1 end",
  "v_target_ac:=coalesce(v_t.armor_class,10)+coalesce((v_targeting->>'coverAcBonus')::integer,0)",
  "v_crit:=v_roll=20",
  "when v_roll=1 then false",
  "public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'poison')",
  "'damageType','poison'",
  "on conflict(request_id) do nothing",
  "set action_available=false",
  "Phase 1K cast RPC must remain available",
  "Phase 1J cast RPC must remain available",
  "Phase 1I cast RPC must remain available",
];
for (const token of required) {
  if (!sql.includes(token)) throw new Error(`Tactical Poison Spray validation failed: missing contract ${token}`);
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
  "mind-sliver|xphb",
  "vicious-mockery|xphb",
  "ray-of-frost|xphb",
  "shocking-grasp|xphb",
  "healing-word|xphb",
  "hold-person|xphb",
]) {
  if (sql.includes(forbidden)) throw new Error(`Tactical Poison Spray validation failed: unexpected contract ${forbidden}`);
}

if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_spell_v4\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical Poison Spray validation failed: anonymous casting must remain unavailable.");
}
if (/update\s+public\.character_spells\s+set/i.test(sql) || /delete\s+from\s+public\.character_spells/i.test(sql)) {
  throw new Error("Tactical Poison Spray validation failed: casting must not mutate canonical spell assignments.");
}
if (/insert\s+into\s+public\.spells_catalog/i.test(sql) || /update\s+public\.spells_catalog/i.test(sql)) {
  throw new Error("Tactical Poison Spray validation failed: casting must not mutate spell definitions.");
}
if (!/if\s+v_crit\s+then\s+v_dice_count:=v_dice_count\*2/i.test(sql)) {
  throw new Error("Tactical Poison Spray validation failed: critical hits must double damage dice.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1L",
  "Poison Spray",
  "30 feet",
  "1d12",
  "Poison",
  "ranged spell attack",
  "Dodge produces ranged spell-attack disadvantage",
  "35 feet",
  "Acid Splash was not selected",
  "AoE",
  "encounter_cast_spell_v4",
  "Pip Quillspark",
  "Raska Stonejaw",
]) {
  if (!status.includes(token)) throw new Error(`Tactical Poison Spray validation failed: status document missing ${token}`);
}

console.log("Tactical Poison Spray validation passed.");
