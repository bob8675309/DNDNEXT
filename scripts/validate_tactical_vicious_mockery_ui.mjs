import fs from "node:fs";
import path from "node:path";

const combatPath = "pages/encounters/combat.js";
const migrationPath = "sql/20260730_02_tactical_vicious_mockery.sql";
const statusPath = "docs/Tactical_Encounter_Phase1U_Vicious_Mockery_Status.md";
for (const rel of [combatPath, migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
    throw new Error(`Tactical Vicious Mockery UI validation failed: missing/empty ${rel}`);
  }
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
for (const token of [
  '"vicious-mockery|xphb"',
  'viciousMockeryDiceCount',
  'Number(spellProfile?.classLevel || 1) >= 17 ? 4',
  'selectedSpellKey === "vicious-mockery|xphb" ? 60',
  'key === "vicious-mockery|xphb"',
  '? "encounter_cast_spell_v12"',
  'if (key === "vicious-mockery|xphb")',
  'Vicious Mockery: ${spellTarget.display_name} resisted with WIS',
  'psychic damage',
  'next attack roll Disadvantage before the end of ${spellTarget.display_name}',
  'hearing-only targeting remains GM-assisted',
  'TACTICAL ENCOUNTER • PHASE',
  'Vicious Mockery imposes next-attack Disadvantage',
  'viciousMockeryEffectConsumed',
  'data?.attackRoll || data || {}',
  'Vicious Mockery Disadvantage consumed',
  'nextAttackDisadvantageApplied',
  'vicious_mockery_next_attack_disadvantage',
  'Vicious Mockery rider • next attack roll Disadvantage before target turn end',
  'Guiding Bolt, Vicious Mockery, Healing Word, and Acid Splash are the current reviewed tactical adapters.',
  '"encounter_cast_spell_v11"',
  '"encounter_cast_area_spell_v1"',
]) {
  if (!combat.includes(token)) throw new Error(`Tactical Vicious Mockery UI validation failed: missing contract ${token}`);
}

if (!/vicious-mockery\|xphb[\s\S]{0,180}encounter_cast_spell_v12|encounter_cast_spell_v12[\s\S]{0,180}vicious-mockery\|xphb/.test(combat)) {
  throw new Error("Tactical Vicious Mockery UI validation failed: Vicious Mockery must route through v12.");
}
if (!/guiding-bolt\|xphb[\s\S]{0,260}encounter_cast_spell_v11|encounter_cast_spell_v11[\s\S]{0,260}guiding-bolt\|xphb/.test(combat)) {
  throw new Error("Tactical Vicious Mockery UI validation failed: Guiding Bolt must remain on v11.");
}
if (!/word-of-radiance\|xphb[\s\S]{0,900}encounter_cast_area_spell_v1|encounter_cast_area_spell_v1[\s\S]{0,900}word-of-radiance\|xphb/.test(combat)) {
  throw new Error("Tactical Vicious Mockery UI validation failed: Word of Radiance must remain on the area RPC.");
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
  '"ray-of-sickness|xphb"',
  '"hold-person|xphb"',
]) {
  if (combat.includes(forbidden)) throw new Error(`Tactical Vicious Mockery UI validation failed: unexpected combat reference ${forbidden}`);
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of ["Phase 1U", "Vicious Mockery", "SERVER DEPLOYED / VALIDATED", "20260730045806 tactical_vicious_mockery", "5 characters", "13 reviewed spell assignments", "0 Vicious Mockery assignments", "20 locations", "4 world routes", "9 world route points"]) {
  if (!status.includes(token)) throw new Error(`Tactical Vicious Mockery UI validation failed: status document missing ${token}`);
}

console.log("Tactical Vicious Mockery combat UI validation passed.");
