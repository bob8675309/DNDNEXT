import fs from "node:fs";
import path from "node:path";
import {
  characterIdentityChanged,
  isCurrentCharacterSheetRequest,
  normalizeCharacterIdentity,
} from "../utils/characterSheetIdentity.js";

const root = process.cwd();
const panel = fs.readFileSync(path.join(root, "components/CharacterSheetPanel.js"), "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const raska = "891b51b8-23b5-48bd-8481-a5d624fdcc55";
const pip = "12e3ef86-1883-4c6c-bd5f-524ee606cc75";

expect(normalizeCharacterIdentity(`  ${pip}  `) === pip, "identity normalization");
expect(characterIdentityChanged(raska, pip), "switching characters requires a hard reset");
expect(!characterIdentityChanged(pip, ` ${pip} `), "whitespace-only identity differences must not reset");

// Raska request 11 resolves after Pip request 12 became active: reject it.
expect(!isCurrentCharacterSheetRequest({
  activeCharacterId: pip,
  requestedCharacterId: raska,
  activeRequestId: 12,
  requestId: 11,
}), "late previous-character response must be rejected");

// Even a matching request number cannot attach data to the wrong character.
expect(!isCurrentCharacterSheetRequest({
  activeCharacterId: pip,
  requestedCharacterId: raska,
  activeRequestId: 12,
  requestId: 12,
}), "wrong-character response must be rejected");

expect(isCurrentCharacterSheetRequest({
  activeCharacterId: pip,
  requestedCharacterId: pip,
  activeRequestId: 12,
  requestId: 12,
}), "current character/current request must be accepted");

for (const token of [
  'characterIdentityChanged(loadedIdentityRef.current, nextIdentity)',
  'applyDraftSnapshot({}, { closeEditor: true })',
  '.from("character_sheets")',
  '.eq("character_id", requestedCharacterId)',
  '.from("inventory_items")',
  '.eq("owner_type", resolvedOwnerType)',
  '.eq("owner_id", requestedCharacterId)',
  'isCurrentCharacterSheetRequest({',
  'setIdentitySnapshot(nextSnapshot)',
  'identitySnapshot?.characterId === characterId',
  'Loading the selected character sheet…',
  'document.addEventListener("visibilitychange", refreshVisibleIdentity)',
  'window.addEventListener("focus", refreshVisibleIdentity)',
  'sheet={editMode ? draft || {} : currentSheet || {}}',
  'equipmentOverride={currentEquipmentText}',
  'equipmentBreakdown={currentEquipmentBreakdown}',
]) expect(panel.includes(token), `CharacterSheetPanel missing ${JSON.stringify(token)}`);

expect((panel.match(/isCurrentCharacterSheetRequest\(\{/g) || []).length >= 4,
  "every asynchronous sheet/equipment phase and finalizer must use the identity/request guard");

for (const forbidden of [
  '.insert(',
  '.update(',
  '.upsert(',
  '.delete(',
  'map_routes',
  'map_route_points',
  'world_map',
  'town_map',
  'encounter_participants',
]) expect(!panel.includes(forbidden), `identity reconciliation must not write or reference ${forbidden}`);

if (failures.length) {
  console.error("Character-sheet identity reconciliation validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Character-sheet identity reconciliation validation passed.");
