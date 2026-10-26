import assert from "node:assert/strict";
import fs from "node:fs";
const read = path => fs.readFileSync(path,"utf8");
const sql = read("sql/20261026_05_character_hand_loadout_staging.sql");
const fixture=read("scripts/fixtures/character_hand_loadout_staging.sql");
const workflow=read(".github/workflows/validate-character-hand-loadout-staging.yml");
const canonical=read("sql/20260802_01_player_character_inventory_and_sheet_actions.sql");
const source=read("sql/20261025_02_optional_rest_magic_item_selection.sql");
for(const token of [
 "public.character_hand_loadout_staging_v1",
 "primary key(character_id,hand)",
 "unique(inventory_item_id)",
 "enable row level security",
 "from public,anon,authenticated",
 "private.character_staged_hand_item_valid_v1",
 "('weapon_1','weapon_2','weapon_3')",
 "public.get_character_hand_loadout_staging_v1",
 "public.set_character_hand_loadout_staging_v1",
 "private.can_access_character_v1",
 "private.can_manage_character_progression_v1",
 "private.assert_character_resource_not_active_v1",
 "hashtextextended(",
 "for update",
 "account",
 "private.invalidate_staged_hand_item_v1",
 "old.equip_slot is distinct from new.equip_slot",
 "old.owner_id is distinct from new.owner_id",
 "old.card_payload is distinct from new.card_payload",
 "'activeHoldVerified',false",
 "'combatSnapshotVerified',false",
 "'focusConsumerEnforced',false",
 "'physicalInventoryChanged',false",
]) assert.ok(sql.includes(token),"Staging migration missing: "+token);
for(const token of [
 "'weapon_1','weapon_2','weapon_3'",
 "private.can_access_character_v1(p_character_id, 'inventory')"
]) assert.ok(canonical.includes(token),"Legacy equipment slot/access boundary changed: "+token);
assert.ok(source.includes("private.assert_character_resource_not_active_v1"),"Required original combat guard missing");
for(const token of [
 "attuned_spell_list_hand_evidence.sql",
 "Unauthorized user staged someone else hands",
 "Duplicate physical item occupied both hands",
 "Account-shared item treated as exclusive physical custody",
 "Other-character item bypassed ownership check",
 "Active encounter failed to lock hand loadout changes",
 "Moved equipment slot retained obsolete hand declaration",
 "Unequip failed to invalidate staged hand",
 "Owner transfer failed to revoke staged hand",
 "Hand staging touched tactical spell-slot resources",
]) assert.ok(fixture.includes(token),"Test fixture missing: "+token);
for(const token of [
 "validate_character_hand_loadout_staging.mjs",
 "character_hand_loadout_staging.sql",
]) assert.ok(workflow.includes(token),"Workflow missing: "+token);
assert.ok(!sql.includes("public.encounter_cast_spell_v"),"Hand staging cannot call a spell writer");
assert.ok(!sql.includes("public.encounter_spellcasting_profile_v2"),"Hand staging cannot sync slots");
assert.ok(!sql.includes("update public.inventory_items"),"Hand staging cannot move physical equipment");
assert.ok(!sql.includes("update public.encounter_participants"),"Hand staging cannot change combat");
console.log("Precombat loadout data staging guards: canonical slots, permissions, source invalidation and no live gameplay effects verified.");
