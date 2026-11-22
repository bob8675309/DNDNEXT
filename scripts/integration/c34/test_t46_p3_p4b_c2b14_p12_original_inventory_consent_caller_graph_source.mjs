// C34 B14-P12 source-only original NPC inventory/consent caller graph.
// Every original legacy RED below is a release blocker, NOT a deployed fix.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const pins={
 "sql/20260624_01_inventory_item_send_rpc.sql":"2f1a5818ff0d5a7d87a239e5b1a8f0302b6ff5e6",
 "pages/inventory.js":"02d52821d0f22aa82ad92263c5014712906ee385",
 "components/NpcPanel.js":"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db",
 "hooks/useNpcSheetActionData.js":"61e3acb114c032cd275eb77d4d4c6f245da5ad20",
 "pages/npcs.js":"7fc00b9b3ace6233d1648a3d017f8a05e072d722",
 "components/AssignItemButton.js":"dc09dc77c66896ed842d240c584225cde26581db",
 "components/OfferTradeButton.js":"5b689a2f4d65412264afd1af395b0fe93a0f151d",
 "components/TradeRequestsPanel.js":"aa7cd652e0338e38e208d1ab3050c7739c61bb32",
 "components/MerchantPanel.js":"22e4d0810603bc0322904573cb5fe0c14bad1f88",
 "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a"
};
const raw=f=>fs.readFileSync(path.join(root,f));
const source=f=>raw(f).toString("utf8");
const blob=b=>createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+b.length+"\0"),b
])).digest("hex");

test("P12 exact original June, NPC page, trades, merchants and protected map blobs unchanged",()=>{
 for(const [file,sha] of Object.entries(pins))
  assert.equal(blob(raw(file)),sha,"Original source drift; re-audit "+file);
});
test("EXPECTED ORIGINAL RED: June definer lists tagged/hidden NPCs and bypasses NPC consent",()=>{
 const s=source("sql/20260624_01_inventory_item_send_rpc.sql");
 const targets=s.split("CREATE OR REPLACE FUNCTION public.list_item_send_targets_v1()")[1]
  .split("CREATE OR REPLACE FUNCTION public.transfer_inventory_item_v1(")[0];
 const transfer=s.split("CREATE OR REPLACE FUNCTION public.transfer_inventory_item_v1(")[1];
 assert.match(targets,/WHERE c\.kind = 'npc'/);
 assert.ok(!/player-character|is_hidden|c\.state/.test(targets));
 assert.match(transfer,/RETURNS public\.inventory_items/);
 assert.match(transfer,/SECURITY DEFINER/);
 assert.match(transfer,/AND c\.kind = v_target_type/);
 assert.match(transfer,/SET owner_type = v_target_type/);
 assert.ok(!transfer.includes("c34_b14_p6_offer_item_v1"));
 assert.match(transfer,/GRANT EXECUTE ON FUNCTION public\.transfer_inventory_item_v1\(uuid, text, text\) TO authenticated/);
});
test("EXPECTED ORIGINAL RED: NPC panel, manager hook and inventory page retain old readers/writes",()=>{
 const npc=source("components/NpcPanel.js");
 const hook=source("hooks/useNpcSheetActionData.js");
 const manager=source("pages/npcs.js");
 const inv=source("pages/inventory.js");
 for(const endpoint of ["get_character_inventory_v1","list_item_send_targets_v1",
  "transfer_inventory_item_v1","set_character_inventory_equipment_v1"])
  assert.ok(npc.includes('rpc("'+endpoint+'"'),"NpcPanel old caller drift: "+endpoint);
 assert.ok(npc.includes("canView: canInventory, canManage: canInventory"));
 assert.ok(hook.includes('rpc("get_character_inventory_v1"'));
 assert.ok(manager.includes("useNpcSheetActionData({"));
 assert.ok(manager.includes('.from("inventory_items")'));
 assert.ok(inv.includes('rpc("list_item_send_targets_v1"'));
 assert.ok(inv.includes('rpc("list_transfer_targets"'));
 assert.ok(inv.includes('rpc("transfer_inventory_item_v1"'));
 assert.ok(inv.includes('from("inventory_items").update(patch).eq("id", rowId)'));
 assert.ok(inv.includes('from("inventory_items").update(patch).in("id", selectedIds)'));
 assert.ok(inv.includes('admin = (prof?.role || "player") !== "player";'));
});
test("EXPECTED VERSIONED RED: P2 direct NPC and P6 original GM decision not closed by additive P8",()=>{
 const p2=source("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p2_inventory_authority_pg17.sql");
 const p6=source("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p6_npc_capabilities_and_offers_pg17.sql");
 const p8=source("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p8_intent_dispatch_pg17.sql");
 const gm=source("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p8_gm_offer_settlement_pg17.sql");
 assert.ok(p2.includes("SET owner_type = v_target_type"));
 assert.ok(p2.includes("GRANT EXECUTE ON FUNCTION public.c34_b14_p2_transfer_inventory_item_v1"));
 assert.ok(!p2.includes("c34_b14_p6_offer_item_v1"));
 assert.ok(p6.includes("CREATE OR REPLACE FUNCTION public.c34_b14_p6_decide_item_offer_v1"));
 assert.ok(p6.includes("GRANT EXECUTE ON FUNCTION public.c34_b14_p6_decide_item_offer_v1"));
 assert.ok(p6.includes("CREATE OR REPLACE FUNCTION public.c34_b14_p6_cancel_item_offer_v1"));
 assert.ok(p8.includes("public.c34_b14_p6_offer_item_v1"));
 assert.ok(!p8.includes("REVOKE ALL ON FUNCTION public.transfer_inventory_item_v1"));
 assert.ok(gm.includes("REVOKE ALL ON FUNCTION public.c34_b14_p6_decide_item_offer_v1"));
 assert.ok(!gm.includes("REVOKE ALL ON FUNCTION public.transfer_inventory_item_v1"));
 assert.ok(!gm.includes("REVOKE ALL ON FUNCTION public.c34_b14_p2_transfer_inventory_item_v1"));
 assert.ok(gm.includes("Sender no longer controls recipient NPC"));
 assert.ok(gm.includes("WHERE request_id=p_request_id FOR UPDATE"));
});
test("Unrelated original account trades, item creation and merchant stock remain independent",()=>{
 assert.ok(source("components/OfferTradeButton.js").includes('.from("trade_requests").insert('));
 assert.ok(source("components/TradeRequestsPanel.js").includes('rpc("accept_trade"'));
 assert.ok(source("components/AssignItemButton.js").includes('.from("inventory_items").insert(insertData)'));
 assert.ok(source("components/MerchantPanel.js").includes('.from("character_stock")'));
});
console.log("P12 SOURCE ONLY: original NPC consent and full-row readers still RED; GM guard is disposable, not a hosted cutover.");
