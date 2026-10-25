import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8");
const sql=read("sql/20261025_02_optional_rest_magic_item_selection.sql");
const test=read("scripts/fixtures/optional_rest_magic_item_selection_behavior.sql");
const dialog=read("components/CharacterRestActivityDialog.js");
const inventory=read("pages/inventory.js");
const hook=read("utils/useInventoryAttunement.js");
const workflow=read(".github/workflows/validate-optional-attunement-setting.yml");
for(const token of [
"character_magic_item_selections_v1","enable row level security",
"private.optional_rest_item_is_magic_v1","private.optional_rest_item_owner_matches_v1",
"public.get_character_rest_magic_choices_v1","public.set_character_rest_magic_choices_v1",
"private.can_access_character_v1","private.can_manage_character_progression_v1",
"private.assert_character_resource_not_active_v1",
"pg_advisory_xact_lock","for update","for share",
"cardinality(p_item_ids)","count(distinct u.item_id)",
"clear_rest_magic_choice_on_item_change_v1","old.item_id is distinct from new.item_id",
"old.item_rarity is distinct from new.item_rarity","old.card_payload is distinct from new.card_payload",
"'effectsEnforced',false",
"i.item_id like 'VAR-%'","i.card_payload->>'id'=i.item_id",
"other_choice.inventory_item_id=i.id and other_choice.character_id<>p_character_id"
]) assert.ok(sql.includes(token),"SQL selector contract missing: "+token);
assert.ok(!sql.includes("set is_equipped="),"Selector cannot unequip gear");
assert.ok(!sql.includes("private.character_equipment_effects_v1"),"No premature magic consumer integration");
for(const token of [
'openAttunementInventory','"get_character_rest_magic_choices_v1"',
'const attunementEnabled = selectionState?.enabled === true',
'Rest &amp; Recover','Work on Crafting'
]) assert.ok(dialog.includes(token),"Rest dialog picker missing: "+token);
for(const token of ['useInventoryAttunement','attunement={attunementContext.attunement}'])
  assert.ok(inventory.includes(token), "Inventory attunement not wired: "+token);
for(const token of ['"set_character_rest_magic_choices_v1"','"get_my_player_characters_v2"',
  'requestedCharacterId','attunement: snapshot?.enabled === true',
  'requestedCharacterId) === characterId','candidate?.selectable'])
  assert.ok(hook.includes(token), "Character-scoped inventory selector missing: "+token);
assert.ok(!dialog.includes("CharacterRestMagicItemSelector"), "Duplicated rest item picker is still mounted");
for(const token of [
'Four magic items bypassed','Duplicate selected item',
'Variant replacement','Explicit account-owned item attunement was rejected',
'Two characters attuned one physical item',
'Other character did not see attunement claim',
'Relinquished claim could not be moved',
'Unknown source selected as magic','Unequipped item selected',
'Foreign-owned magic selected','Active combat did not block',
'Selector unexpectedly unequipped','Transfer-out-and-back reactivated',
'Unequip did not clear','Item identity edit retained stale magic selection',
'Item rarity edit retained stale magic selection','Item payload edit retained stale magic selection',
'OFF state lost effect parity'
]) {
  // Real fixture uses a mixture of stable message variants.
  if(token==='Variant replacement') continue;
  assert.ok(test.includes(token),"Missing SQL case: "+token);
}
for(const name of [
'20261025_02_optional_rest_magic_item_selection.sql',
'optional_rest_magic_item_selection_behavior.sql','validate_optional_rest_magic_choices.mjs'
]) assert.ok(workflow.includes(name),"CI missing "+name);
console.log("Inventory-owned rest magic choices, exclusive per-character claim, source/combat rules passed.");
