#!/usr/bin/env node
// No database calls. Check source-integrity and one-transaction construction.
import assert from "node:assert/strict";
import {compose} from "./c33_compose_disposable_joint_sql.mjs";
const {sql,stages,protectedTables}=compose();
assert.equal(stages.length,4);
assert.deepEqual(protectedTables,["spells_catalog","items_catalog","inventory_items","character_stock"]);
assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);
assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1);
for(const n of [
 "get_npc_profile_visible_v1","get_npc_dossier_admin_v1",
 "get_character_editor_narrative_v1","create_player_character_with_private_backstory_v1",
 "inventory_items_owner_type_chk",
 "ALTER POLICY inventory_items_insert_owner_or_admin",
 "ALTER POLICY inventory_items_select_owner_or_admin",
 "ALTER POLICY inventory_items_update_owner_or_admin",
 "ALTER POLICY inventory_items_delete_owner_or_admin"
])assert.ok(sql.includes(n),"Missing staged source: "+n);
for(const n of protectedTables)assert.ok(sql.includes("b."+n+"_hash IS DISTINCT FROM a."+n+"_hash"));
assert.match(sql,/private\.test_admins/);
assert.ok(!/^\s*(DROP TABLE|TRUNCATE|DELETE FROM public\.(?:spells_catalog|items_catalog))\b/mi.test(sql));
console.log("PASS C3ATOMIC02: one source-locked guarded disposable transaction; protected catalog snapshots, no database execution");
