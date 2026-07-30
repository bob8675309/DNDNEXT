import fs from "node:fs";
import path from "node:path";

const combatPath = "pages/encounters/combat.js";
const boardPath = "components/encounter/EncounterTurnBoard.js";
const serverValidatorPath = "scripts/validate_tactical_acid_splash.mjs";
const statusPath = "docs/Tactical_Encounter_Phase1W_Acid_Splash_Status.md";

for (const rel of [combatPath, boardPath, serverValidatorPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
    throw new Error(`Tactical Acid Splash UI validation failed: missing/empty ${rel}`);
  }
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
for (const token of [
  '"acid-splash|xphb"',
  "const [pointAreaOrigin, setPointAreaOrigin] = useState(null);",
  'const isChosenAreaSpell = selectedSpellKey === "word-of-radiance|xphb";',
  'const isPointAreaSpell = selectedSpellKey === "acid-splash|xphb";',
  "const isAreaSpell = isChosenAreaSpell || isPointAreaSpell;",
  "const pointAreaOriginDistance = active && pointAreaOrigin",
  "const pointAreaOriginDistanceFt",
  "const pointAreaOriginInRange",
  "pointAreaOriginDistanceFt <= 60",
  "const pointAreaVisibleCandidates = useMemo(() => {",
  "hexDistance(",
  ") <= 1);",
  "const acidSplashDiceCount",
  "setPointAreaOrigin(null);",
  "isPointAreaSpell",
  "? pointAreaOriginInRange",
  'if (key === "acid-splash|xphb")',
  '"encounter_cast_point_area_spell_v1"',
  "p_origin_q: Number(pointAreaOrigin.q)",
  "p_origin_r: Number(pointAreaOrigin.r)",
  "p_slot_level: null",
  "visibleFailureCount",
  "visibleSuccessCount",
  "in visible results",
  "5-foot-radius Sphere",
  "The server derives every creature",
  "visible preview",
  "The selected Sphere has no visible creature, but the point remains a legal target.",
  "selectedAreaOrigin={isPointAreaSpell ? pointAreaOrigin : null}",
  "areaRadiusHex={isPointAreaSpell ? 1 : 0}",
  "onHexClick={isPointAreaSpell && canControl && !saving ? (hex) => setPointAreaOrigin(hex) : undefined}",
  '"encounter_cast_area_spell_v1"',
  '"encounter_cast_spell_v13"',
  "TACTICAL ENCOUNTER • PHASE 1W",
]) {
  if (!combat.includes(token)) {
    throw new Error(`Tactical Acid Splash UI validation failed: missing contract ${token}`);
  }
}

const castStart = combat.indexOf("function castSpell()");
const castEnd = combat.indexOf("function rollSave()", castStart);
const castBlock = combat.slice(castStart, castEnd);
if (!(castStart >= 0 && castEnd > castStart)) {
  throw new Error("Tactical Acid Splash UI validation failed: castSpell helper boundaries are missing.");
}
if (castBlock.indexOf('if (key === "acid-splash|xphb")') > castBlock.indexOf("if (!spellTarget) return;")) {
  throw new Error("Tactical Acid Splash UI validation failed: point-area routing must run before the single-target guard.");
}
for (const token of ["p_caster_id: active.id", "p_assignment_id: selectedSpell.assignmentId", "p_request_id: requestId()"]) {
  if (!castBlock.includes(token)) {
    throw new Error(`Tactical Acid Splash UI validation failed: point-area request wiring is missing ${token}`);
  }
}

const board = fs.readFileSync(path.join(process.cwd(), boardPath), "utf8");
for (const token of [
  "hexDistance",
  "selectedAreaOrigin = null",
  "areaRadiusHex = 0",
  "const selectedAreaOriginKey",
  "const selectedAreaKeys = useMemo(() => {",
  "hexDistance(hex, selectedAreaOrigin) <= Number(areaRadiusHex)",
  "is-selected-area",
  "is-selected-area-origin",
  "Green hexes preview the selected tactical area",
]) {
  if (!board.includes(token)) {
    throw new Error(`Tactical Acid Splash UI validation failed: tactical board is missing ${token}`);
  }
}
if (!board.includes("}, [areaRadiusHex, cells, selectedAreaOrigin]);")) {
  throw new Error("Tactical Acid Splash UI validation failed: selected-area memo dependencies are incomplete.");
}

for (const source of [combat, board]) {
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
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`Tactical Acid Splash UI validation failed: tactical UI must not reference ${forbidden}`);
    }
  }
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1W",
  "SERVER DEPLOYED / VALIDATED",
  "20260730151224 tactical_acid_splash",
  "c09c3d3b57e6b14bc8fc5312ef6bf8b4c861afd2",
  "14 reviewed spell assignments",
  "0 Acid Splash assignments",
  "zero tactical fixture rows",
]) {
  if (!status.includes(token)) {
    throw new Error(`Tactical Acid Splash UI validation failed: status document missing ${token}`);
  }
}

console.log("Tactical Acid Splash combat UI validation passed.");
