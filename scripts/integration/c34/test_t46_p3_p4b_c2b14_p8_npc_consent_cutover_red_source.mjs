// C34 B14-P8 SOURCE-ONLY EXPECTED-RED release gate. Preserves all originals.
// Passing these tests means the legacy NPC transfer bypasses STILL EXIST
// in source and need a coordinated owner-approved runtime migration.
// Never run SQL or try to change the world map, trade, Forge or merchant stock.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const original={
 "sql/20260624_01_inventory_item_send_rpc.sql":"2f1a5818ff0d5a7d87a239e5b1a8f0302b6ff5e6",
 "pages/inventory.js":"02d52821d0f22aa82ad92263c5014712906ee385",
 "components/AssignItemButton.js":"dc09dc77c66896ed842d240c584225cde26581db",
 "components/OfferTradeButton.js":"5b689a2f4d65412264afd1af395b0fe93a0f151d",
 "components/TradeRequestsPanel.js":"aa7cd652e0338e38e208d1ab3050c7739c61bb32"
};
function read(f){return fs.readFileSync(path.join(root,f));}
function text(f){return read(f).toString("utf8");}
function gitBlob(b){return createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+b.length+"\0"),b
])).digest("hex");}
test("source-original June transfer, player trade, AssignItemButton and inventory page are untouched",()=>{
 for(const [f,sha] of Object.entries(original))
  assert.equal(gitBlob(read(f)),sha,"Original changed; re-audit "+f);
});
test("EXPECTED LEGACY RED: item send list can expose hidden/tagged Forge PCs",()=>{
 const s=text("sql/20260624_01_inventory_item_send_rpc.sql");
 const start=s.indexOf("CREATE OR REPLACE FUNCTION public.list_item_send_targets_v1()");
 const end=s.indexOf("CREATE OR REPLACE FUNCTION public.transfer_inventory_item_v1",start);
 const list=s.slice(start,end);
 assert.ok(list.includes("WHERE c.kind = 'npc'"));
 assert.ok(!list.includes("player-character"));
 assert.ok(!list.includes("is_hidden"));
 assert.ok(!list.includes("c.state"));
 assert.ok(list.includes("v_admin := coalesce(public.is_admin(caller), false)"));
});
test("EXPECTED LEGACY RED: original definer can move player-owned item directly to NPC without consent",()=>{
 const s=text("sql/20260624_01_inventory_item_send_rpc.sql");
 const start=s.indexOf("CREATE OR REPLACE FUNCTION public.transfer_inventory_item_v1(");
 const body=s.slice(start);
 assert.ok(body.includes("SECURITY DEFINER"));
 assert.ok(body.includes("AND c.kind = v_target_type"));
 assert.ok(!body.includes("player-character"));
 assert.ok(!body.includes("c34_b14_p6_offer_item_v1"));
 assert.ok(body.includes("SET owner_type = v_target_type"));
 assert.ok(body.includes("RETURNING * INTO v_result"));
 assert.ok(body.includes("GRANT EXECUTE ON FUNCTION public.transfer_inventory_item_v1("));
});
test("EXPECTED P2 RED: versioned immediate NPC sender bypasses offer, but excludes actual tagged PCs",()=>{
 const s=text("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p2_inventory_authority_pg17.sql");
 assert.ok(s.includes("v_target_type NOT IN ('player', 'npc', 'merchant')"));
 assert.ok(s.includes("'player-character' = ANY(coalesce(c.tags,'{}'::text[]))"));
 assert.ok(s.includes("SET owner_type = v_target_type"));
 assert.ok(!s.includes("c34_b14_p6_offer_item_v1"));
 assert.ok(s.includes("GRANT EXECUTE ON FUNCTION public.c34_b14_p2_transfer_inventory_item_v1"));
 assert.ok(s.includes("GRANT EXECUTE ON FUNCTION public.c34_b14_p2_transfer_inventory_items_bulk_v1"));
});
test("EXPECTED PAGE RED: single transfer RPC error falls back to direct UPDATE and bulk always raw UPDATE",()=>{
 const s=text("pages/inventory.js");
 assert.ok(s.includes('supabase.rpc("transfer_inventory_item_v1"'));
 assert.ok(s.includes("if (!canTransferOut) throw error;"));
 assert.ok(s.includes('supabase.from("inventory_items").update(patch).eq("id", rowId)'));
 assert.ok(s.includes('supabase.from("inventory_items").update(patch).in("id", selectedIds)'));
 assert.ok(s.includes('supabase.rpc("is_admin", { uid: sess.user.id })'));
 assert.ok(s.includes('admin = (prof?.role || "player") !== "player";'));
});
test("P6 staging only revokes older P4 direct gift; does not close earlier P2/June consent bypasses",()=>{
 const s=text("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p6_npc_capabilities_and_offers_pg17.sql");
 assert.ok(s.includes("REVOKE EXECUTE ON FUNCTION"));
 assert.ok(s.includes("public.c34_b14_p4_send_character_gear_to_controlled_npc_v1"));
 assert.ok(!s.includes("REVOKE ALL ON FUNCTION public.c34_b14_p2_transfer_inventory_item_v1"));
 assert.ok(!s.includes("REVOKE ALL ON FUNCTION public.transfer_inventory_item_v1"));
 assert.ok(s.includes("CREATE TABLE IF NOT EXISTS private.c34_b14_p6_item_offers"));
});
test("original player trades, item creation, merchant stock must not be routed through NPC consent silently",()=>{
 const assign=text("components/AssignItemButton.js");
 const offer=text("components/OfferTradeButton.js");
 const trade=text("components/TradeRequestsPanel.js");
 assert.ok(assign.includes('.from("inventory_items").insert(insertData)'));
 assert.ok(offer.includes('.from("trade_requests").insert('));
 assert.ok(trade.includes('supabase.rpc("accept_trade"'));
});
