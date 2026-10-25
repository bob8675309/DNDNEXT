import assert from "node:assert/strict";
import fs from "node:fs";

const equipment = fs.readFileSync("components/EquipmentDiagram.js", "utf8");
const css = fs.readFileSync("styles/equipment-diagram-three-column.css", "utf8");
const inventory = fs.readFileSync("pages/inventory.js", "utf8");

for (const token of [
  "attunement = null",
  "attunement?.enabled === true",
  "attunementChoices.get(String(row.id))?.isSelected",
  "attunedCount}/{attunementCap} attuned",
  "Magic attunement:",
  "selectedAttunementChoice.reason",
  "attunement?.canChange === true",
  "typeof attunement?.onToggle === \"function\"",
  "attunement.onToggle(String(selectedRow.id), !selectedAttunementChoice.isSelected)",
  "attunedCount >= attunementCap",
  "Change attunement during an eligible rest."
]) {
  assert.ok(equipment.includes(token), "Missing isolated inventory attunement UI contract: " + token);
}
for (const token of [
  "onAssignEquipSlot?.(row.id, slot.key)",
  "onUnequip?.(dragState.rowId)",
  "<ItemCard item={equipmentItemForCard(selectedRow)} />",
  "onTransferItem(selectedRow.id, transferTargetKey)",
  "Drag backpack items into slots."
]) assert.ok(equipment.includes(token), "Equipment workflow changed: " + token);

assert.ok(!equipment.includes("supabase."), "Reusable equipment view must never write Supabase");
assert.ok(!equipment.includes("set_character_rest_magic_choices_v1"),
  "Only authorized parent may invoke magic selection RPC");
assert.ok(!inventory.includes("set_character_rest_magic_choices_v1"),
  "Account-owned inventory must not mutate character attunement before context reconciliation");
assert.ok(css.includes(".equipment-workbench__attunement-header"),
  "Attunement styling is missing");
assert.ok(css.includes(".equipment-stage-slot.is-attuned::after"),
  "Equipment stage attunement marker is missing");
console.log("Inventory attunement presentation stays opt-in, character-scoped, inert and preserves drag/drop.");
