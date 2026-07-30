import fs from "node:fs";
import path from "node:path";

const foundationPath = "sql/20260729_03_tactical_attack_roll_modifiers.sql";
const migrationPath = "sql/20260729_04_tactical_guiding_bolt.sql";
const statusPath = "docs/Tactical_Encounter_Phase1T_Guiding_Bolt_Status.md";
for (const rel of [foundationPath, migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
    throw new Error(`Tactical Guiding Bolt validation failed: missing/empty ${rel}`);
  }
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
for (const token of [
  "public.encounter_cast_spell_v11",
  "public.encounter_cast_spell_v10",
  "'fire-bolt|xphb'",
  "'poison-spray|xphb'",
  "'shocking-grasp|xphb'",
  "'ray-of-frost|xphb'",
  "'chill-touch|xphb'",
  "'guiding-bolt|xphb'",
  "Guiding Bolt automation requires its reviewed Cleric class assignment",
  "Guiding Bolt automation requires a canonical Cleric spellcasting profile",
  "if p_slot_level is null or p_slot_level<1 or p_slot_level>9",
  "Multiple eligible spell-slot pools are not automated yet",
  "v_range_ft:=case",
  "when v_key in ('fire-bolt|xphb','guiding-bolt|xphb') then 120",
  "Close-quarters ranged spell attacks remain GM-assisted in this slice",
  "private.encounter_resolve_attack_roll_v1(v_c.id,v_t.id,v_base_disadvantage)",
  "v_dice_count:=4+greatest(0,p_slot_level-1)",
  "public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,v_damage_type)",
  "'guiding_bolt_next_attack_advantage'",
  "'nextAttackAdvantageApplied'",
  "'source_next_turn_end'",
  "private.encounter_apply_target_turn_start_effect_v1",
  "private.encounter_apply_source_turn_start_effect_v1",
  "private.encounter_apply_source_turn_end_effect_v1",
  "update public.encounter_spell_slots set slots_remaining=slots_remaining-1",
  "set action_available=false",
  "grant execute on function public.encounter_cast_spell_v11(uuid,uuid,uuid,integer,uuid) to authenticated, service_role",
]) {
  if (!sql.includes(token)) throw new Error(`Tactical Guiding Bolt validation failed: missing contract ${token}`);
}

if (!/v_key not in \([\s\S]*guiding-bolt\|xphb[\s\S]*return public\.encounter_cast_spell_v10/.test(sql)) {
  throw new Error("Tactical Guiding Bolt validation failed: v11 must own reviewed attack-roll spells and delegate other reviewed spells to v10.");
}
if (!/if v_crit then v_dice_count:=v_dice_count\*2/.test(sql)) {
  throw new Error("Tactical Guiding Bolt validation failed: spell attack critical-hit dice doubling is missing.");
}
if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_spell_v11\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical Guiding Bolt validation failed: anonymous v11 casting must remain unavailable.");
}
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
  "guiding-bolt|PHB",
]) {
  if (sql.includes(forbidden)) throw new Error(`Tactical Guiding Bolt validation failed: unexpected contract ${forbidden}`);
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1T",
  "Guiding Bolt",
  "next attack roll",
  "Advantage",
  "4d6 Radiant",
  "encounter_cast_spell_v11",
  "encounter_resolve_attack_roll_v1",
  "Phase 1S",
]) {
  if (!status.includes(token)) throw new Error(`Tactical Guiding Bolt validation failed: status document missing ${token}`);
}

console.log("Tactical Guiding Bolt server validation passed.");
