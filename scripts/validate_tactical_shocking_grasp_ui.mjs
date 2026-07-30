import fs from "node:fs";
import path from "node:path";

const combatPath = "pages/encounters/combat.js";
const migrationPath = "sql/20260728_05_tactical_shocking_grasp.sql";
const statusPath = "docs/Tactical_Encounter_Phase1O_Shocking_Grasp_Status.md";

for (const rel of [combatPath, migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Shocking Grasp UI validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Shocking Grasp UI validation failed: empty ${rel}`);
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
const required = [
  '"shocking-grasp|xphb"',
  'shockingGraspDiceCount',
  'Number(spellProfile?.classLevel || 1) >= 17 ? 4',
  'Number(spellProfile?.classLevel || 1) >= 11 ? 3',
  'Number(spellProfile?.classLevel || 1) >= 5 ? 2 : 1',
  '"encounter_cast_spell_v7"',
  'if (key === "shocking-grasp|xphb")',
  'Shocking Grasp hit for ${data?.damage?.damage ?? data?.rawDamage ?? 0} lightning damage',
  'suppressed Opportunity Attacks until ${spellTarget.display_name}\'s next turn starts',
  'Shocking Grasp missed with ${attackTotal || "?"} vs AC',
  'Touch-range melee spell attack',
  'Dodge imposes disadvantage',
  'cover can increase AC',
  'cannot make Opportunity Attacks until the start of its next turn',
  'general Reaction is not spent or disabled',
  'suppress Opportunity Attacks',
  'String(row.detail?.spellKey || "").toLowerCase() === "shocking-grasp|xphb"',
  'Melee spell attack {Number(row.detail?.roll || 0) + Number(row.detail?.attackBonus || 0)} vs AC',
  'Opportunity Attacks suppressed until target turn start',
  '"encounter_cast_spell_v6"',
  '"encounter_cast_spell_v5"',
  '"encounter_cast_spell_v4"',
  '"encounter_cast_spell_v3"',
  '"encounter_cast_spell_v2"',
  '"encounter_cast_spell_v1"',
];
for (const token of required) {
  if (!combat.includes(token)) throw new Error(`Tactical Shocking Grasp UI validation failed: missing contract ${token}`);
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
]) {
  if (combat.includes(forbidden)) throw new Error(`Tactical Shocking Grasp UI validation failed: combat UI must not reference ${forbidden}`);
}

if (!/const spellRangeFt[\s\S]{0,1150}shocking-grasp\|xphb[\s\S]{0,340}\? 5/.test(combat)) {
  throw new Error("Tactical Shocking Grasp UI validation failed: Shocking Grasp must remain a 5-foot Touch adapter.");
}
if (!combat.includes('return participants.filter((p) => !p.is_defeated && String(p.id) !== String(active.id));')) {
  throw new Error("Tactical Shocking Grasp UI validation failed: offensive targeting must exclude self and defeated targets.");
}
if (!combat.includes('const slotLevel = Number(selectedSpell.level || 0) === 0 ? null : Number(spellSlotLevel);')) {
  throw new Error("Tactical Shocking Grasp UI validation failed: cantrip slot preflight is missing.");
}
if (!/shocking-grasp\|xphb[\s\S]{0,900}encounter_cast_spell_v7|encounter_cast_spell_v7[\s\S]{0,900}shocking-grasp\|xphb/.test(combat)) {
  throw new Error("Tactical Shocking Grasp UI validation failed: Shocking Grasp must route through encounter_cast_spell_v7.");
}
if (!/inflict-wounds\|xphb[\s\S]{0,1080}encounter_cast_spell_v6|encounter_cast_spell_v6[\s\S]{0,1080}inflict-wounds\|xphb/.test(combat)) {
  throw new Error("Tactical Shocking Grasp UI validation failed: Inflict Wounds must remain on encounter_cast_spell_v6.");
}
if (!/false-life\|xphb[\s\S]{0,1220}encounter_cast_spell_v5|encounter_cast_spell_v5[\s\S]{0,1220}false-life\|xphb/.test(combat)) {
  throw new Error("Tactical Shocking Grasp UI validation failed: False Life must remain on encounter_cast_spell_v5.");
}

console.log("Tactical Shocking Grasp combat UI validation passed.");
