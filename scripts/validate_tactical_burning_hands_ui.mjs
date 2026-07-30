import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const combatPath = "pages/encounters/combat.js";
const boardPath = "components/encounter/EncounterTurnBoard.js";
const hexPath = "utils/encounterHex.js";
const serverValidatorPath = "scripts/validate_tactical_burning_hands.mjs";
const statusPath = "docs/Tactical_Encounter_Phase1Y_Burning_Hands_Status.md";

for (const rel of [combatPath, boardPath, hexPath, serverValidatorPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
    throw new Error(`Tactical Burning Hands UI validation failed: missing/empty ${rel}`);
  }
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
for (const token of [
  '"burning-hands|xphb"',
  "CONE_DIRECTION_LABELS",
  "makeHexCone15",
  'const [coneDirection, setConeDirection] = useState("0");',
  'const isDirectionalAreaSpell = selectedSpellKey === "burning-hands|xphb";',
  "if (isDirectionalAreaSpell) return [];",
  "const burningHandsConeHexes = useMemo(() => {",
  "const burningHandsVisibleCandidates = useMemo(() => {",
  "const burningHandsDiceCount = isDirectionalAreaSpell",
  "Math.max(3, Number(spellSlotLevel || 1) + 2)",
  "? Number.isInteger(Number(coneDirection))",
  'setConeDirection("0");',
  'if (key === "burning-hands|xphb")',
  '"encounter_cast_directional_area_spell_v1"',
  "p_direction: Number(coneDirection)",
  "p_slot_level: slotLevel",
  "visibleFailureCount",
  "visibleSuccessCount",
  "saved for half",
  "Self • 15-foot Cone",
  'aria-label="Burning Hands cone direction"',
  "CONE_DIRECTION_LABELS.map((label, index)",
  "onClick={() => setConeDirection(String(index))}",
  "seven-hex 1/3/3 footprint",
  "Unattended-object ignition remains GM-assisted",
  'aria-label="Visible Burning Hands cone preview"',
  "The selected Cone has no visible creature, but the direction remains legal.",
  'String(row.detail?.spellKey || "").toLowerCase() === "burning-hands|xphb"',
  "object ignition GM-assisted",
  "selectedAreaHexes={isDirectionalAreaSpell ? burningHandsConeHexes : []}",
  "selectedAreaOrigin={isPointAreaSpell ? pointAreaOrigin : null}",
  "areaRadiusHex={isPointAreaSpell ? 1 : 0}",
  "onHexClick={isPointAreaSpell && canControl && !saving",
  '"encounter_cast_area_spell_v1"',
  '"encounter_cast_point_area_spell_v1"',
  '"encounter_cast_allocated_spell_v1"',
  '"encounter_cast_spell_v13"',
  "TACTICAL ENCOUNTER • PHASE 1W <span>• PHASE 1X</span> <span>• PHASE 1Y</span>",
  "Burning Hands is reviewed through its separate directional Cone path.",
]) {
  if (!combat.includes(token)) {
    throw new Error(`Tactical Burning Hands UI validation failed: missing contract ${token}`);
  }
}

const castStart = combat.indexOf("function castSpell()");
const castEnd = combat.indexOf("function rollSave()", castStart);
const castBlock = combat.slice(castStart, castEnd);
if (!(castStart >= 0 && castEnd > castStart)) {
  throw new Error("Tactical Burning Hands UI validation failed: castSpell helper boundaries are missing.");
}
if (castBlock.indexOf('if (key === "burning-hands|xphb")') > castBlock.indexOf("if (!spellTarget) return;")) {
  throw new Error("Tactical Burning Hands UI validation failed: directional routing must run before the single-target guard.");
}
for (const token of [
  "p_caster_id: active.id",
  "p_assignment_id: selectedSpell.assignmentId",
  "p_direction: Number(coneDirection)",
  "p_slot_level: slotLevel",
  "p_request_id: requestId()",
]) {
  if (!castBlock.includes(token)) {
    throw new Error(`Tactical Burning Hands UI validation failed: directional request wiring is missing ${token}`);
  }
}

const board = fs.readFileSync(path.join(process.cwd(), boardPath), "utf8");
for (const token of [
  "selectedAreaOrigin = null",
  "areaRadiusHex = 0",
  "selectedAreaHexes = []",
  "const explicitSelectedAreaKeys = useMemo(",
  "(selectedAreaHexes || []).map((hex) => hexKey(hex.q, hex.r))",
  "[selectedAreaHexes]",
  "selectedAreaKeys.has(key) || explicitSelectedAreaKeys.has(key)",
  "is-selected-area",
]) {
  if (!board.includes(token)) {
    throw new Error(`Tactical Burning Hands UI validation failed: tactical board is missing ${token}`);
  }
}
if (!board.includes("}, [areaRadiusHex, cells, selectedAreaOrigin]);")) {
  throw new Error("Tactical Burning Hands UI validation failed: legacy point-area memo changed.");
}

const hexModule = await import(`${pathToFileURL(path.join(process.cwd(), hexPath)).href}?phase1y=${Date.now()}`);
if (!Array.isArray(hexModule.CONE_DIRECTION_LABELS) || hexModule.CONE_DIRECTION_LABELS.length !== 6) {
  throw new Error("Tactical Burning Hands UI validation failed: six direction labels are required.");
}
for (let direction = 0; direction < 6; direction += 1) {
  const cells = hexModule.makeHexCone15({ q: 0, r: 0 }, direction);
  const keys = new Set(cells.map((cell) => `${cell.q}:${cell.r}`));
  if (cells.length !== 7 || keys.size !== 7 || keys.has("0:0")) {
    throw new Error(`Tactical Burning Hands UI validation failed: direction ${direction} is not a unique seven-hex cone.`);
  }
}
const eastKeys = new Set(hexModule.makeHexCone15({ q: 0, r: 0 }, 0).map((cell) => `${cell.q}:${cell.r}:${cell.depth}`));
for (const expected of ["1:0:1", "2:0:2", "2:-1:2", "1:1:2", "3:0:3", "3:-1:3", "2:1:3"]) {
  if (!eastKeys.has(expected)) {
    throw new Error(`Tactical Burning Hands UI validation failed: direction-zero footprint is missing ${expected}.`);
  }
}
if (hexModule.makeHexCone15({ q: 0, r: 0 }, 6).length !== 0) {
  throw new Error("Tactical Burning Hands UI validation failed: illegal directions must not preview.");
}

for (const source of [combat, board, fs.readFileSync(path.join(process.cwd(), hexPath), "utf8")]) {
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
    "encounter_cast_allocated_spell_v2",
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`Tactical Burning Hands UI validation failed: tactical UI must not reference ${forbidden}`);
    }
  }
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1Y",
  "Burning Hands",
  "SERVER DEPLOYED / VALIDATED",
  "PR #107",
  "529d64e703f66886de4d86955eb786aa828a11dd",
  "4884d23ec4998e997b26fd60a8a44be57930754a",
  "20260730183119 tactical_burning_hands",
  "16 reviewed spell assignments",
  "0 Burning Hands assignments",
  "zero tactical fixture",
]) {
  if (!status.includes(token)) {
    throw new Error(`Tactical Burning Hands UI validation failed: status document missing ${token}`);
  }
}

console.log("Tactical Burning Hands combat UI validation passed.");
