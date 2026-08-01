import fs from "node:fs";
import path from "node:path";
import {
  isCurrentNpcSelectionRequest,
  normalizeNpcSelectionKey,
} from "../utils/npcSelectionGuard.js";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "pages/npcs.js"), "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const dawn = "merchant:4bbde13d-403f-4541-b5e7-56494fd84d5f";
const pip = "npc:6b1254e9-38d6-45a6-b252-14a68157704a";
const raska = "npc:d0fe10d3-741c-44cb-93d7-49ed3d05a42b";

expect(normalizeNpcSelectionKey(`  ${pip}  `) === pip, "selection-key normalization");
expect(!isCurrentNpcSelectionRequest({
  activeKey: pip,
  requestedKey: dawn,
  activeRequestId: 12,
  requestId: 11,
}), "late previous-character response must be rejected");
expect(!isCurrentNpcSelectionRequest({
  activeKey: raska,
  requestedKey: pip,
  activeRequestId: 12,
  requestId: 12,
}), "matching request ID cannot attach to a different character");
expect(isCurrentNpcSelectionRequest({
  activeKey: raska,
  requestedKey: raska,
  activeRequestId: 13,
  requestId: 13,
}), "current character/current request must be accepted");

for (const token of [
  'import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
  'const selectCharacterKey = useCallback((nextKey) => {',
  'sheetRequestRef.current += 1;',
  'equipmentRequestRef.current += 1;',
  'notesRequestRef.current += 1;',
  'setSheet(null);',
  'setSheetDraft({});',
  'setEquippedRows([]);',
  'setNotes([]);',
  'setSheetLoading(Boolean(normalized));',
  'isCurrentNpcSelectionRequest({',
  'activeKey: selectedKeyRef.current,',
  'requestedKey,',
  'activeRequestId: sheetRequestRef.current,',
  'activeRequestId: equipmentRequestRef.current,',
  'activeRequestId: notesRequestRef.current,',
  'key={selectedKey || "no-selection"}',
  'Loading the selected character sheet…',
]) expect(page.includes(token), `NPC selection reconciliation missing ${JSON.stringify(token)}`);

expect(!page.includes('}, [sheet, selectedKey]);'),
  "selection changes must not copy the previous sheet into the next character's draft");
expect((page.match(/setSelectedKey\(/g) || []).length === 1,
  "all NPC selection changes must pass through selectCharacterKey");
expect((page.match(/isCurrentNpcSelectionRequest\(\{/g) || []).length >= 4,
  "sheet, equipment, notes, and sheet finalizer must all use request/identity guards");

if (failures.length) {
  console.error("NPC sheet selection reconciliation validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("NPC sheet selection reconciliation validation passed.");
