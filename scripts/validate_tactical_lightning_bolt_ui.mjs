import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const combatPath = "pages/encounters/combat.js";
const boardPath = "components/encounter/EncounterTurnBoard.js";
const hexPath = "utils/encounterHex.js";
const serverValidatorPath = "scripts/validate_tactical_lightning_bolt.mjs";
const statusPath = "docs/Tactical_Encounter_Phase1Z_Lightning_Bolt_Status.md";

for (const rel of [combatPath, boardPath, hexPath, serverValidatorPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
    throw new Error(`Tactical Lightning Bolt UI validation failed: missing/empty ${rel}`);
  }
}

const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");
for (const token of [
  '"lightning-bolt|xphb"',
  "CONE_DIRECTION_LABELS",
  "makeHexLine100",
  'const isLineAreaSpell = selectedSpellKey === "lightning-bolt|xphb";',
  "if (isLineAreaSpell) return [];",
  "const lightningBoltLineHexes = useMemo(() => {",
  "const lightningBoltVisibleCandidates = useMemo(() => {",
  "const lightningBoltDiceCount = isLineAreaSpell",
  "Math.max(8, Number(spellSlotLevel || 3) + 5)",
  'if (key === "lightning-bolt|xphb")',
  '"encounter_cast_directional_area_spell_v2"',
  "p_direction: Number(coneDirection)",
  "p_slot_level: slotLevel",
  "visibleFailureCount",
  "visibleSuccessCount",
  "saved for half",
  "Self • 100-foot-long, 5-foot-wide Line",
  'aria-label="Lightning Bolt line direction"',
  "CONE_DIRECTION_LABELS.map((label, index)",
  "onClick={() => setConeDirection(String(index))}",
  "green 20-hex centerline",
  'aria-label="Visible Lightning Bolt line preview"',
  "The selected Line has no visible creature, but the direction remains legal.",
  'String(row.detail?.spellKey || "").toLowerCase() === "lightning-bolt|xphb"',
  "lightning damage • saved for half",
  "selectedAreaHexes={isDirectionalAreaSpell ? burningHandsConeHexes : isLineAreaSpell ? lightningBoltLineHexes : []}",
  "TACTICAL ENCOUNTER • PHASE 1W <span>• PHASE 1X</span> <span>• PHASE 1Y</span> <span>• PHASE 1Z</span>",
  "Burning Hands is reviewed through its separate directional Cone path.",
  "Lightning Bolt is reviewed through its separate directional Line path.",
]) {
  if (!combat.includes(token)) {
    throw new Error(`Tactical Lightning Bolt UI validation failed: missing contract ${token}`);
  }
}

const castStart = combat.indexOf("function castSpell()");
const castEnd = combat.indexOf("function rollSave()", castStart);
const castBlock = combat.slice(castStart, castEnd);
if (!(castStart >= 0 && castEnd > castStart)) {
  throw new Error("Tactical Lightning Bolt UI validation failed: castSpell helper boundaries are missing.");
}
if (castBlock.indexOf('if (key === "lightning-bolt|xphb")') > castBlock.indexOf("if (!spellTarget) return;")) {
  throw new Error("Tactical Lightning Bolt UI validation failed: Line routing must run before the single-target guard.");
}
for (const token of [
  "p_caster_id: active.id",
  "p_assignment_id: selectedSpell.assignmentId",
  "p_direction: Number(coneDirection)",
  "p_slot_level: slotLevel",
  "p_request_id: requestId()",
]) {
  if (!castBlock.includes(token)) {
    throw new Error(`Tactical Lightning Bolt UI validation failed: Line request wiring is missing ${token}`);
  }
}
if (!castBlock.includes('if (key === "burning-hands|xphb")')
    || !castBlock.includes('"encounter_cast_directional_area_spell_v1"')) {
  throw new Error("Tactical Lightning Bolt UI validation failed: Burning Hands must retain its v1 client route.");
}

const board = fs.readFileSync(path.join(process.cwd(), boardPath), "utf8");
for (const token of [
  "selectedAreaHexes = []",
  "const explicitSelectedAreaKeys = useMemo(",
  "(selectedAreaHexes || []).map((hex) => hexKey(hex.q, hex.r))",
  "selectedAreaKeys.has(key) || explicitSelectedAreaKeys.has(key)",
  "is-selected-area",
]) {
  if (!board.includes(token)) {
    throw new Error(`Tactical Lightning Bolt UI validation failed: tactical board is missing ${token}`);
  }
}

const hexModule = await import(`${pathToFileURL(path.join(process.cwd(), hexPath)).href}?phase1z=${Date.now()}`);
if (!Array.isArray(hexModule.CONE_DIRECTION_LABELS) || hexModule.CONE_DIRECTION_LABELS.length !== 6) {
  throw new Error("Tactical Lightning Bolt UI validation failed: six direction labels are required.");
}
const endpoints = [
  [20, 0],
  [20, -20],
  [0, -20],
  [-20, 0],
  [-20, 20],
  [0, 20],
];
for (let direction = 0; direction < 6; direction += 1) {
  const cells = hexModule.makeHexLine100({ q: 0, r: 0 }, direction);
  const keys = new Set(cells.map((cell) => `${cell.q}:${cell.r}`));
  const endpoint = cells[19];
  if (cells.length !== 20
      || keys.size !== 20
      || keys.has("0:0")
      || cells[0]?.depth !== 1
      || endpoint?.depth !== 20
      || endpoint?.q !== endpoints[direction][0]
      || endpoint?.r !== endpoints[direction][1]) {
    throw new Error(`Tactical Lightning Bolt UI validation failed: direction ${direction} is not the reviewed 20-hex Line.`);
  }
}
if (hexModule.makeHexLine100({ q: 0, r: 0 }, 6).length !== 0
    || hexModule.makeHexLine100(null, 0).length !== 0) {
  throw new Error("Tactical Lightning Bolt UI validation failed: illegal Line previews must remain empty.");
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
      throw new Error(`Tactical Lightning Bolt UI validation failed: tactical UI must not reference ${forbidden}`);
    }
  }
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1Z",
  "Lightning Bolt",
  "XPHB",
  "20-hex centerline",
  "20260730195028 tactical_lightning_bolt",
  "PR #110",
  "17 reviewed spell assignments",
  "0 Lightning Bolt assignments",
  "20 locations",
  "4 world routes",
  "9 world route points",
]) {
  if (!status.includes(token)) {
    throw new Error(`Tactical Lightning Bolt UI validation failed: status document missing ${token}`);
  }
}

console.log("Tactical Lightning Bolt combat UI validation passed.");
