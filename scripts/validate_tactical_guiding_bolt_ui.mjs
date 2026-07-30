import fs from "node:fs";
import path from "node:path";

const combatPath = "pages/encounters/combat.js";
const attackMigrationPath = "sql/20260729_03_tactical_attack_roll_modifiers.sql";
const guidingBoltMigrationPath = "sql/20260729_04_tactical_guiding_bolt.sql";
const statusPath = "docs/Tactical_Encounter_Phase1T_Guiding_Bolt_Status.md";

for (const rel of [combatPath, attackMigrationPath, guidingBoltMigrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Guiding Bolt UI validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Guiding Bolt UI validation failed: empty ${rel}`);
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
const required = [
  '"guiding-bolt|xphb"',
  'function guidingBoltAttackText(data)',
  'data?.guidingBoltEffectConsumed',
  'data?.advantageCanceledByDisadvantage',
  'Guiding Bolt Advantage consumed',
  '["fire-bolt|xphb", "guiding-bolt|xphb"].includes(selectedSpellKey)',
  'guidingBoltDiceCount',
  '4 + Math.max(0, Number(spellSlotLevel || 1) - 1)',
  'key === "guiding-bolt|xphb"',
  '? "encounter_cast_spell_v11"',
  'if (key === "guiding-bolt|xphb")',
  'Guiding Bolt hit for ${data?.damage?.damage ?? data?.rawDamage ?? 0} radiant damage',
  'next attack roll against ${spellTarget.display_name} has Advantage before the end of your next turn',
  'Guiding Bolt missed with ${attackTotal || "?"} vs AC',
  'guidingBoltAttackText(data)',
  'TACTICAL ENCOUNTER • PHASE',
  'one-shot attack/save modifiers',
  'Guiding Bolt grants next-attack Advantage',
  'normal cancellation',
  'selectedSpellKey === "guiding-bolt|xphb" ? <div className="read"><span>On hit</span><strong>{guidingBoltDiceCount}d6 radiant • next attack Advantage</strong></div> : null',
  'Guiding Bolt, and Vicious Mockery are the current reviewed tactical adapters.',
  'row.detail?.guidingBoltEffectConsumed',
  'Guiding Bolt rider consumed',
  'String(row.detail?.spellKey || "").toLowerCase() === "guiding-bolt|xphb"',
  'next attack Advantage until source next turn end',
  '"encounter_weapon_attack_v1"',
  '"encounter_unarmed_strike_v1"',
  '"encounter_cast_area_spell_v1"',
  '"encounter_cast_spell_v10"',
  '"encounter_cast_spell_v9"',
  '"encounter_cast_spell_v8"',
  '"encounter_cast_spell_v7"',
  '"encounter_cast_spell_v6"',
  '"encounter_cast_spell_v5"',
  '"encounter_cast_spell_v4"',
  '"encounter_cast_spell_v3"',
  '"encounter_cast_spell_v2"',
  '"encounter_cast_spell_v1"',
];
for (const token of required) {
  if (!combat.includes(token)) throw new Error(`Tactical Guiding Bolt UI validation failed: missing contract ${token}`);
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
  '"ray-of-sickness|xphb"',
  '"hold-person|xphb"',
]) {
  if (combat.includes(forbidden)) throw new Error(`Tactical Guiding Bolt UI validation failed: combat UI must not reference ${forbidden}`);
}

if (!/guiding-bolt\|xphb[\s\S]{0,280}encounter_cast_spell_v11|encounter_cast_spell_v11[\s\S]{0,280}guiding-bolt\|xphb/.test(combat)) {
  throw new Error("Tactical Guiding Bolt UI validation failed: Guiding Bolt must route through encounter_cast_spell_v11.");
}
if (!/word-of-radiance\|xphb[\s\S]{0,900}encounter_cast_area_spell_v1|encounter_cast_area_spell_v1[\s\S]{0,900}word-of-radiance\|xphb/.test(combat)) {
  throw new Error("Tactical Guiding Bolt UI validation failed: Word of Radiance must remain on encounter_cast_area_spell_v1.");
}
if (!combat.includes('if (!spellTarget) return;')) {
  throw new Error("Tactical Guiding Bolt UI validation failed: established single-target target guard is missing.");
}
if (!/encounter_unarmed_strike_v1[\s\S]{0,520}guidingBoltAttackText\(data\)/.test(combat)) {
  throw new Error("Tactical Guiding Bolt UI validation failed: Unarmed Strike feedback must surface rider consumption.");
}
if (!/encounter_weapon_attack_v1[\s\S]{0,720}guidingBoltAttackText\(data\)/.test(combat)) {
  throw new Error("Tactical Guiding Bolt UI validation failed: weapon feedback must surface rider consumption.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1T",
  "Guiding Bolt",
  "SERVER + COMBAT UI DEPLOYED / VALIDATED",
  "LEGACY ATTACK RPC HARDENING LIVE / VALIDATED",
  "20260730022432 tactical_attack_roll_modifiers",
  "20260730023411 tactical_guiding_bolt",
  "20260730040717 tactical_legacy_attack_spell_hardening",
  "5 characters",
  "reviewed spell assignments",
  "Guiding Bolt assignments",
  "20 locations",
  "4 world routes",
  "9 world route points",
]) {
  if (!status.includes(token)) throw new Error(`Tactical Guiding Bolt UI validation failed: status document missing ${token}`);
}

console.log("Tactical Guiding Bolt combat UI validation passed.");
