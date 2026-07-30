import fs from "node:fs";
import path from "node:path";

const combatPath = "pages/encounters/combat.js";
const castMigrationPath = "sql/20260727_13_tactical_spell_casting_slice.sql";

for (const rel of [combatPath, castMigrationPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical spell UI validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical spell UI validation failed: empty ${rel}`);
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
const required = [
  '"fire-bolt|xphb"',
  '"cure-wounds|xphb"',
  'const [spellProfile, setSpellProfile] = useState(null);',
  'const [spellAssignmentId, setSpellAssignmentId] = useState("");',
  'const [spellTargetId, setSpellTargetId] = useState("");',
  'const [spellSlotLevel, setSpellSlotLevel] = useState("");',
  'const loadSpellcastingProfile = useCallback',
  'encounter_spellcasting_profile_v1',
  'encounter_cast_spell_v1',
  'encounter_spell_slots',
  'participant_id=eq.${participantId}',
  'source === "XPHB"',
  'sourceType === "class"',
  'selectedSpell.prepared || selectedSpell.alwaysAvailable',
  'selectedSpellKey === "cure-wounds|xphb"',
  'spellTargets.some((p) => String(p.id) === String(active.id))',
  'p_slot_level: slotLevel',
  'disabled={!canCastSelectedSpell}',
  'row.event_type !== "spell_cast"',
  'row.detail?.damage?.damage',
  'TACTICAL ENCOUNTER • PHASE 1',
];
for (const token of required) {
  if (!combat.includes(token)) throw new Error(`Tactical spell UI validation failed: missing contract ${token}`);
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
  '"healing-word|xphb"',
  '"hold-person|xphb"',
]) {
  if (combat.includes(forbidden)) throw new Error(`Tactical spell UI validation failed: combat UI must not reference ${forbidden}`);
}

for (const setter of ["setSpellProfile", "setSpellAssignmentId", "setSpellTargetId", "setSpellSlotLevel"]) {
  const declaration = new RegExp(`\\[\\s*[^,]+,\\s*${setter}\\s*\\]\\s*=\\s*useState`);
  if (!declaration.test(combat)) throw new Error(`Tactical spell UI validation failed: ${setter} is used without a local state declaration.`);
}

if (!/function\s+castSpell\s*\(\)/.test(combat)) throw new Error("Tactical spell UI validation failed: castSpell helper is missing.");
const castStart = combat.indexOf("function castSpell()");
const authorityGuard = combat.indexOf('if (!active || !selectedSpell || !canCastSelectedSpell) return;', castStart);
const areaBranch = combat.indexOf('if (key === "word-of-radiance|xphb")', castStart);
const singleTargetGuard = combat.indexOf('if (!spellTarget) return;', castStart);
if (castStart < 0 || authorityGuard < castStart) {
  throw new Error("Tactical spell UI validation failed: castSpell is missing its local authority/readiness preflight.");
}
if (areaBranch >= 0) {
  if (!(authorityGuard < areaBranch && areaBranch < singleTargetGuard)) {
    throw new Error("Tactical spell UI validation failed: area spells must resolve after authority preflight and before the single-target target guard.");
  }
} else if (!combat.includes('if (!active || !selectedSpell || !spellTarget || !canCastSelectedSpell) return;')) {
  throw new Error("Tactical spell UI validation failed: single-target castSpell is missing its target/readiness preflight.");
}
if (areaBranch >= 0 && singleTargetGuard < 0) {
  throw new Error("Tactical spell UI validation failed: established single-target spells lost their target guard after the area-spell branch.");
}
if (!combat.includes('await Promise.all([loadWeapons(active.id), loadSpellcastingProfile(active.id)])')) {
  throw new Error("Tactical spell UI validation failed: successful combat actions do not refresh spell resources.");
}

console.log("Tactical spell combat UI baseline validation passed.");
