import fs from "node:fs";
import path from "node:path";

const combatPath = "pages/encounters/combat.js";
const migrationPath = "sql/20260729_02_tactical_word_of_radiance.sql";
const statusPath = "docs/Tactical_Encounter_Phase1S_Word_of_Radiance_Status.md";

for (const rel of [combatPath, migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical Word of Radiance UI validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical Word of Radiance UI validation failed: empty ${rel}`);
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
const required = [
  '"word-of-radiance|xphb"',
  'const [areaTargetIds, setAreaTargetIds] = useState([]);',
  'const isAreaSpell = selectedSpellKey === "word-of-radiance|xphb";',
  'const areaSpellCandidates = useMemo(() => {',
  'return distance <= 1;',
  'wordOfRadianceDiceCount',
  '5-foot Emanation',
  'shared roll',
  'Choose at least one creature in the 5-foot Emanation.',
  '"encounter_cast_area_spell_v1"',
  'p_target_ids: areaTargetIds',
  'p_slot_level: null',
  'Word of Radiance: shared ${data?.damageDice || "1d6"} roll',
  'mindSliverPenaltyText(row?.saveProfile)',
  'Array.isArray(row.detail?.targets)',
  'row.detail?.sharedDamageRoll',
  'row.detail?.failureCount',
  'row.detail?.successCount',
  'result.originIncluded ? " • origin chosen" : ""',
  'TACTICAL ENCOUNTER • PHASE',
  'Word of Radiance',
  'are the current reviewed tactical adapters.',
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
  if (!combat.includes(token)) throw new Error(`Tactical Word of Radiance UI validation failed: missing contract ${token}`);
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
  '"acid-splash|xphb"',
  '"ray-of-sickness|xphb"',
  '"hold-person|xphb"',
]) {
  if (combat.includes(forbidden)) throw new Error(`Tactical Word of Radiance UI validation failed: combat UI must not reference ${forbidden}`);
}

if (!/word-of-radiance\|xphb[\s\S]{0,1000}encounter_cast_area_spell_v1|encounter_cast_area_spell_v1[\s\S]{0,1000}word-of-radiance\|xphb/.test(combat)) {
  throw new Error("Tactical Word of Radiance UI validation failed: Word of Radiance must route through encounter_cast_area_spell_v1.");
}
if (!combat.includes('if (!spellTarget) return;')) {
  throw new Error("Tactical Word of Radiance UI validation failed: established single-target spells must retain their own target guard after the area branch.");
}
if (!combat.includes('!Array.isArray(row.detail?.targets)')) {
  throw new Error("Tactical Word of Radiance UI validation failed: legacy single-target save log rendering must exclude area target arrays.");
}
if (!combat.includes('String(p.id) === String(active.id) ? " • self/origin" : ""')) {
  throw new Error("Tactical Word of Radiance UI validation failed: explicit caster/origin selection must be visible in the UI.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1S",
  "Word of Radiance",
  "SERVER DEPLOYED / VALIDATED",
  "20260729192806 tactical_word_of_radiance",
  "bd979a85-dea6-4e78-aa1a-42149262d5b4",
  "12 reviewed spell assignments",
  "5-foot Emanation",
]) {
  if (!status.includes(token)) throw new Error(`Tactical Word of Radiance UI validation failed: status document missing ${token}`);
}

console.log("Tactical Word of Radiance combat UI validation passed.");
