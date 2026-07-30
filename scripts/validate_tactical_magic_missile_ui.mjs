import fs from "node:fs";
import path from "node:path";

const combatPath = "pages/encounters/combat.js";
const serverValidatorPath = "scripts/validate_tactical_magic_missile.mjs";
const statusPath = "docs/Tactical_Encounter_Phase1X_Magic_Missile_Status.md";

for (const rel of [combatPath, serverValidatorPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
    throw new Error(`Tactical Magic Missile UI validation failed: missing/empty ${rel}`);
  }
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
for (const token of [
  '"magic-missile|xphb"',
  "function magicMissileAllocationTotal(allocations)",
  "function normalizeMagicMissileAllocations(current, candidateIds, dartBudget)",
  "function magicMissileAffinityLabel(targetResult)",
  "const [magicMissileAllocations, setMagicMissileAllocations] = useState({});",
  'const isAllocatedSpell = selectedSpellKey === "magic-missile|xphb";',
  "if (isAreaSpell || isAllocatedSpell) return [];",
  "const magicMissileCandidates = useMemo(() => {",
  ") <= 24;",
  "const magicMissileDartBudget = isAllocatedSpell",
  "Math.max(3, Number(spellSlotLevel || 1) + 2)",
  "const magicMissileAllocatedDarts = magicMissileAllocationTotal(magicMissileAllocations);",
  "const magicMissileRemainingDarts = Math.max(0, magicMissileDartBudget - magicMissileAllocatedDarts);",
  "const magicMissileAllocationPayload = useMemo(",
  "const magicMissileAllocationComplete = Boolean(",
  "? magicMissileAllocationComplete",
  "setMagicMissileAllocations((current) => normalizeMagicMissileAllocations(",
  "function changeMagicMissileDarts(targetParticipantId, delta)",
  'if (key === "magic-missile|xphb")',
  '"encounter_cast_allocated_spell_v1"',
  "p_allocations: magicMissileAllocationPayload",
  "p_slot_level: slotLevel",
  "magicMissileAffinityLabel(row)",
  "1d4 + 1 force per dart",
  "Magic Missile dart allocations",
  "changeMagicMissileDarts(id, -1)",
  "changeMagicMissileDarts(id, 1)",
  "Allocate all {magicMissileDartBudget} Magic Missile darts before casting.",
  "Shield reactions remain GM-assisted",
  'String(row.detail?.spellKey || "").toLowerCase() === "magic-missile|xphb"',
  "independently rolled darts",
  "magicMissileAffinityLabel(result)",
  "TACTICAL ENCOUNTER • PHASE 1W <span>• PHASE 1X</span>",
  "selectedAreaOrigin={isPointAreaSpell ? pointAreaOrigin : null}",
  "onHexClick={isPointAreaSpell && canControl && !saving",
  "Magic Missile is also reviewed through its separate allocated-dart path",
]) {
  if (!combat.includes(token)) {
    throw new Error(`Tactical Magic Missile UI validation failed: missing contract ${token}`);
  }
}

const castStart = combat.indexOf("function castSpell()");
const castEnd = combat.indexOf("function rollSave()", castStart);
const castBlock = combat.slice(castStart, castEnd);
if (!(castStart >= 0 && castEnd > castStart)) {
  throw new Error("Tactical Magic Missile UI validation failed: castSpell helper boundaries are missing.");
}
if (castBlock.indexOf('if (key === "magic-missile|xphb")') > castBlock.indexOf("if (!spellTarget) return;")) {
  throw new Error("Tactical Magic Missile UI validation failed: allocation routing must run before the single-target guard.");
}
for (const token of [
  "p_caster_id: active.id",
  "p_assignment_id: selectedSpell.assignmentId",
  "p_allocations: magicMissileAllocationPayload",
  "p_slot_level: slotLevel",
  "p_request_id: requestId()",
]) {
  if (!castBlock.includes(token)) {
    throw new Error(`Tactical Magic Missile UI validation failed: allocated request wiring is missing ${token}`);
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
  "encounter_cast_spell_v14",
  "encounter_cast_area_spell_v2",
  "encounter_cast_point_area_spell_v2",
]) {
  if (combat.includes(forbidden)) {
    throw new Error(`Tactical Magic Missile UI validation failed: tactical UI must not reference ${forbidden}`);
  }
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1X",
  "Magic Missile",
  "20260730155810",
  "PR #104",
  "2f0c6078036b77f8754af258058f7c7f5a2f6111",
  "15 reviewed spell assignments",
  "0 Magic Missile assignments",
  "zero tactical fixture",
]) {
  if (!status.includes(token)) {
    throw new Error(`Tactical Magic Missile UI validation failed: status document missing ${token}`);
  }
}

console.log("Tactical Magic Missile combat UI validation passed.");
