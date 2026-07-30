import fs from "node:fs";
import path from "node:path";

const combatPath = "pages/encounters/combat.js";
const serverValidatorPath = "scripts/validate_tactical_healing_word.mjs";
const statusPath = "docs/Tactical_Encounter_Phase1V_Healing_Word_Status.md";

for (const rel of [combatPath, serverValidatorPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
    throw new Error(`Tactical Healing Word UI validation failed: missing/empty ${rel}`);
  }
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
for (const token of [
  '"healing-word|xphb"',
  'const isBonusActionSpell = selectedSpellKey === "healing-word|xphb";',
  "const selectedSpellUsesSlot = Number(selectedSpell?.level || 0) > 0;",
  'if (selectedSpellKey === "healing-word|xphb") return participants;',
  'selectedSpellKey === "healing-word|xphb" ? 60',
  'if (selectedSpellKey === "healing-word|xphb" && active && spellTargets.some((p) => String(p.id) === String(active.id))) return active.id;',
  "const healingWordDiceCount",
  "Math.max(2, Number(spellSlotLevel || 1) * 2)",
  "const hasSpentSpellSlotThisTurn = useMemo",
  'row.event_type === "spell_cast"',
  "Number(row.detail?.slotLevel || 0) > 0",
  "const selectedSpellCastingResourceAvailable = isBonusActionSpell",
  "Boolean(active?.bonus_action_available)",
  "Boolean(active?.action_available)",
  "&& selectedSpellCastingResourceAvailable",
  "&& !(selectedSpellUsesSlot && hasSpentSpellSlotThisTurn)",
  'key === "healing-word|xphb"',
  '"encounter_cast_spell_v13"',
  "Healing Word was cast, but",
  "Healing Word restored ${healed} HP",
  "Bonus Action spent; Action unchanged.",
  '{isBonusActionSpell ? "Bonus Action" : "Action"}',
  "including the caster or a defeated/0-HP creature",
  "Only one spell slot can be expended to cast a spell on a turn",
  "Action cantrips remain legal before or after Healing Word",
  'p.is_defeated ? " • defeated/0 HP" : ""',
  "Healing Word requires an available Bonus Action.",
  "A spell slot has already been expended to cast a spell on this turn.",
  'String(row.detail?.spellKey || "").toLowerCase() === "healing-word|xphb"',
  "• Bonus Action • Action unchanged",
  "TACTICAL ENCOUNTER • PHASE 1W",
]) {
  if (!combat.includes(token)) {
    throw new Error(`Tactical Healing Word UI validation failed: missing contract ${token}`);
  }
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
  '"healing-word|phb"',
]) {
  if (combat.includes(forbidden)) {
    throw new Error(`Tactical Healing Word UI validation failed: combat UI must not reference ${forbidden}`);
  }
}

const canCastStart = combat.indexOf("const canCastSelectedSpell = Boolean(");
const canCastEnd = combat.indexOf("const moveAllowance", canCastStart);
const canCastBlock = combat.slice(canCastStart, canCastEnd);
if (canCastStart < 0 || canCastEnd < 0) {
  throw new Error("Tactical Healing Word UI validation failed: cast readiness block is missing.");
}
if (canCastBlock.includes("active?.action_available")) {
  throw new Error("Tactical Healing Word UI validation failed: cast readiness still unconditionally requires Action.");
}

const resourceStart = combat.indexOf("const selectedSpellCastingResourceAvailable = isBonusActionSpell");
const resourceEnd = combat.indexOf("const canCastSelectedSpell", resourceStart);
const resourceBlock = combat.slice(resourceStart, resourceEnd);
if (!(resourceStart >= 0 && resourceEnd > resourceStart && resourceBlock.indexOf("bonus_action_available") < resourceBlock.indexOf("action_available"))) {
  throw new Error("Tactical Healing Word UI validation failed: Bonus Action and Action resource selection is not wired correctly.");
}

const castStart = combat.indexOf("function castSpell()");
const castEnd = combat.indexOf("function rollSave()", castStart);
const castBlock = combat.slice(castStart, castEnd);
if (!(castStart >= 0 && castEnd > castStart)) {
  throw new Error("Tactical Healing Word UI validation failed: castSpell helper boundaries are missing.");
}
if (castBlock.indexOf('key === "healing-word|xphb"') > castBlock.indexOf('"encounter_cast_spell_v12"')) {
  throw new Error("Tactical Healing Word UI validation failed: Healing Word must select v13 before legacy routes.");
}
if (!castBlock.includes("p_slot_level: slotLevel") || !castBlock.includes("p_target_id: spellTarget.id")) {
  throw new Error("Tactical Healing Word UI validation failed: v13 request arguments are not passed through the established single-target cast path.");
}

if (!/\}, \[active, encounter, log\]\);/.test(combat)) {
  throw new Error("Tactical Healing Word UI validation failed: current-turn slot-spend memo is missing its dependencies.");
}
if (!combat.includes("await Promise.all([loadWeapons(active.id), loadSpellcastingProfile(active.id)])")) {
  throw new Error("Tactical Healing Word UI validation failed: successful casts do not refresh action and spell-slot resources.");
}

console.log("Tactical Healing Word combat UI validation passed.");
