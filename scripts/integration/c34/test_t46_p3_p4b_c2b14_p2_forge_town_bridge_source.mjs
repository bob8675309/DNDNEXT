#!/usr/bin/env node
// C34 B14-P2-C2 read-only source crosswalk; never executes SQL or external service.
// Distinguishes historical original v3 signed Forge acceptance from B14 scratch
// current account-item transfers. Research RED is not a claim about hosted ACLs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const pins={
 "sql/20260808_51_player_forge_character_scoped_equipment_projection.sql":"7b84dfca57a5482fbc474db71ea4e00243ff58fb",
 "sql/20261010_01_player_forge_starting_market.sql":"f77f996e88e8b3f8f01f10f77da205af2a24f11d",
 "sql/20260614_100_player_inventory_owner_alignment.sql":"bed3061042504eed8fdfb876b5f2898b864ba6e4",
 "sql/20260624_01_inventory_item_send_rpc.sql":"2f1a5818ff0d5a7d87a239e5b1a8f0302b6ff5e6",
 "sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql":"4532ddb8db642d0d0ab14646a3e87c034d4134c6",
 "scripts/integration/c34/test_joint_pg17_local_auth.mjs":"d36cbb3ae355aa7b7debba8631e2114ffb6675d3",
 "components/AssignItemButton.js":"dc09dc77c66896ed842d240c584225cde26581db",
 "pages/inventory.js":"02d52821d0f22aa82ad92263c5014712906ee385"
};
function read(file){return fs.readFileSync(path.join(root,file),"utf8");}
const blob=bytes=>createHash("sha1").update(
 Buffer.concat([Buffer.from("blob "+bytes.length+"\0"),bytes])
).digest("hex");

test("original Forge/Town/role/page/joint research sources are unchanged",()=>{
 for(const [file,sha] of Object.entries(pins))
  assert.equal(blob(fs.readFileSync(path.join(root,file))),sha,"Source drift: "+file);
});

test("real original signed Forge v3 deferred-equipment acceptance exists and is NOT B14",()=>{
 const s=read("scripts/integration/c34/test_joint_pg17_local_auth.mjs");
 assert.ok(s.includes('const created=await rpc(holder,"create_player_character_v3"'));
 assert.ok(s.includes('const createdItemCount=one("public.inventory_items",'));
 assert.ok(s.includes("original privileged deferred materializer must create starting item"));
 assert.ok(s.includes("PASS C34-GREEN04: signed original v3 + real nonce + deferred equipment materializer"));
 assert.ok(s.includes('sqlFile("sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql")'));
});

test("original Forge starter and market purchases are CHARACTER-scoped, not account owner",()=>{
 const starter=read("sql/20260808_51_player_forge_character_scoped_equipment_projection.sql");
 const market=read("sql/20261010_01_player_forge_starting_market.sql");
 for(const [name,s] of [["starter",starter],["starting-market",market]]){
  assert.ok(s.includes("insert into public.inventory_items("),name);
  assert.ok(s.includes("'character',p_character_id::text"),name);
  assert.ok(s.includes("user_id,item_id,item_name"),name);
 }
 assert.ok(market.includes("'startingMarket',true"));
});

test("original crafting ownership routing keeps player user UUID versus NPC/merchant character",()=>{
 const src=read("sql/20260614_100_player_inventory_owner_alignment.sql");
 assert.ok(src.includes("if v_owner_type = ''player'' then"));
 assert.ok(src.includes("v_output_owner_id := v_target_user_id::text;"));
 assert.ok(src.includes("v_output_owner_id := v_plan.target_character_id::text;"));
});

test("held combined Forge RLS is distinct from B14 versioned player/NPC/merchant RPC",()=>{
 const combined=read("sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql");
 const b14=read("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p2_inventory_authority_pg17.sql");
 assert.ok(combined.includes("ALTER POLICY inventory_items_insert_owner_or_admin"));
 assert.ok(combined.includes("private.can_access_character_v1(owner_id::uuid, 'inventory')"));
 assert.ok(combined.includes("ALTER TABLE public.inventory_items DROP CONSTRAINT inventory_items_owner_type_chk"));
 assert.ok(b14.includes("p_expected_owner_type NOT IN ('player', 'npc', 'merchant')"));
 assert.ok(b14.includes("RESEARCH-ONLY versioned SQL for disposable PG17"));
 assert.ok(!b14.includes("ALTER POLICY inventory_items_insert_owner_or_admin"));
});

test("legacy inventory UI/target RPC still has source-only RED boundaries, not cut over",()=>{
 const page=read("pages/inventory.js"), send=read("sql/20260624_01_inventory_item_send_rpc.sql");
 assert.ok(page.includes('supabase.rpc("is_admin", { uid: sess.user.id })'));
 assert.ok(page.includes('admin = (prof?.role || "player") !== "player";'));
 assert.ok(page.includes('supabase.rpc("transfer_inventory_item_v1"'));
 assert.ok(page.includes('supabase.from("inventory_items").update(patch).eq("id", rowId)'));
 assert.ok(page.includes('supabase.from("inventory_items").update(patch).in("id", selectedIds)'));
 assert.ok(send.includes("CREATE OR REPLACE FUNCTION public.list_item_send_targets_v1()"));
 const start=send.indexOf("CREATE OR REPLACE FUNCTION public.list_item_send_targets_v1()");
 const end=send.indexOf("CREATE OR REPLACE FUNCTION public.transfer_inventory_item_v1(",start);
 const list=send.slice(start,end);
 assert.ok(list.includes("WHERE c.kind = 'npc'"));
 assert.ok(!/c\.is_hidden|c\.state\s*=/.test(list),
  "Original legacy target RPC hidden NPC/state filtering changed; re-audit before claiming RED");
});

test("AssignItemButton uses owner_type/owner_id but player INSERT separately keys user_id",()=>{
 const src=read("components/AssignItemButton.js");
 assert.ok(src.includes("owner_type: finalType"));
 assert.ok(src.includes("owner_id: String(finalId)"));
 assert.ok(src.includes('if (finalType === "player") insertData.user_id = finalId;'));
 assert.ok(src.includes('.from("inventory_items").insert(insertData)'));
});
