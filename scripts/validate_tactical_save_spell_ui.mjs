import fs from "node:fs";
import path from "node:path";

const combatPath = "pages/encounters/combat.js";
const migrationPath = "sql/20260727_14_tactical_single_target_save_spell.sql";
const statusPath = "docs/Tactical_Encounter_Phase1J_Save_Spells_Status.md";

for (const rel of [combatPath, migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical save-spell UI validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical save-spell UI validation failed: empty ${rel}`);
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
const required = [
  '"sacred-flame|xphb"',
  'selectedSpellKey === "sacred-flame|xphb" ? 60',
  '"encounter_cast_spell_v2"',
  'Sacred Flame: ${spellTarget.display_name} saved',
  'DEX vs DC {spellProfile.spellSaveDc ?? "—"}',
  'Sacred Flame ignores Half and Three-Quarters Cover',
  'row.detail?.saveAbility',
  'row.detail.saveTotal',
  'row.detail.saveDc',
  'row.detail.saveSuccess',
  'row.detail.saveAdvantage',
  'row.detail.ignoresHalfAndThreeQuarterCoverForSave',
];
for (const token of required) {
  if (!combat.includes(token)) throw new Error(`Tactical save-spell UI validation failed: missing contract ${token}`);
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
  '"hold-person|xphb"',
]) {
  if (combat.includes(forbidden)) throw new Error(`Tactical save-spell UI validation failed: combat UI must not reference ${forbidden}`);
}

if (!combat.includes('if (selectedSpellKey === "cure-wounds|xphb") return participants;')) {
  throw new Error("Tactical save-spell UI validation failed: Cure Wounds self/defeated-target behavior was changed.");
}
if (!combat.includes('return participants.filter((p) => !p.is_defeated && String(p.id) !== String(active.id));')) {
  throw new Error("Tactical save-spell UI validation failed: offensive spell target filtering is missing.");
}
if (!combat.includes('const slotLevel = Number(selectedSpell.level || 0) === 0 ? null : Number(spellSlotLevel);')) {
  throw new Error("Tactical save-spell UI validation failed: cantrip slot preflight is missing.");
}
if (!/sacred-flame\|xphb[\s\S]{0,220}encounter_cast_spell_v2|encounter_cast_spell_v2[\s\S]{0,220}sacred-flame\|xphb/.test(combat)) {
  throw new Error("Tactical save-spell UI validation failed: Sacred Flame must remain routed through encounter_cast_spell_v2.");
}

console.log("Tactical Sacred Flame combat UI validation passed.");
