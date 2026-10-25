import assert from "node:assert/strict";
import fs from "node:fs";

const read = (name) => fs.readFileSync(name, "utf8");
const dialog = read("components/CharacterRestActivityDialog.js");
const hook = read("utils/useInventoryAttunement.js");
const page = read("pages/inventory.js");
const diagram = read("components/EquipmentDiagram.js");
const sql = read("sql/20261025_02_optional_rest_magic_item_selection.sql");
const fixture = read("scripts/fixtures/optional_rest_magic_item_selection_behavior.sql");

for (const text of [
  "openAttunementInventory", 'supabase.auth.getUser()',
  'supabase.rpc("get_my_player_characters_v2")',
  'pathname: "/inventory"', 'ownerType: "player"',
  "characterId,", 'restActivity: "attunement"',
  "encounterLocked || combinedBusy",
  'onClick={onRecover}', "Rest &amp; Recover",
]) assert.ok(dialog.includes(text), "Missing rest-to-inventory contract: " + text);
assert.ok(!dialog.includes("CharacterRestMagicItemSelector"),
  "Rest must not mount a competing selection list.");

for (const text of [
  "get_my_player_characters_v2", "get_character_rest_magic_choices_v1",
  "set_character_rest_magic_choices_v1", "isOwnPlayerInventory",
  "requestedCharacterId", "restActivity", "requestedCharacterId) === characterId",
  "canManage", "candidate?.selectable", "snapshot.count",
  "savingRef.current", "snapshot?.enabled === true",
]) assert.ok(hook.includes(text), "Missing inventory identity/access contract: " + text);

for (const text of [
  'attunementContext = useInventoryAttunement({',
  'sessionUserId: session?.user?.id',
  'requestedCharacterId: typeof query.characterId === "string"',
  'restActivity: query.restActivity === "attunement"',
  'attunement={attunementContext.attunement}',
  'Active character',
  'attunementContext.characters.map',
]) assert.ok(page.includes(text), "Missing existing inventory integration: " + text);

for (const text of [
  'attunement = null', 'attunement?.enabled === true',
  'attunement?.canChange === true',
  'attunement.onToggle(String(selectedRow.id)',
  'onAssignEquipSlot?.(row.id, slot.key)',
  'onUnequip?.(dragState.rowId)',
  '<ItemCard item={equipmentItemForCard(selectedRow)} />',
]) assert.ok(diagram.includes(text), "Equipment manager contract changed: " + text);
assert.ok(!diagram.includes("supabase."), "EquipmentDiagram must remain presentation-only.");
assert.ok(!page.includes('supabase.rpc("set_character_rest_magic_choices_v1"'),
  "Inventory page must delegate choices to the guarded character hook.");

for (const text of [
  'unique(inventory_item_id)', 'for update',
  'private.assert_character_resource_not_active_v1',
  'private.can_manage_character_progression_v1',
  'other_choice.character_id<>p_character_id',
  'Already attuned to another character',
]) assert.ok(sql.includes(text), "Missing server exclusivity/permissions: " + text);
for (const text of [
  "Explicit account-owned item attunement was rejected",
  "Two characters attuned one physical item",
  "Other character did not see attunement claim",
  "Relinquished claim could not be moved",
  "Active combat did not block",
]) assert.ok(fixture.includes(text), "Missing exclusive-claim regression: " + text);

for (const legacy of [
  'set is_equipped=', 'delete from public.inventory_items',
  'update public.characters', 'update public.character_sheets'
]) assert.ok(!sql.includes(legacy), "Attunement may not rewrite inventory or character state: " + legacy);
console.log("Existing inventory attunement: authenticated character context, exclusive item claim, guarded rest navigation and equipment reuse passed.");
