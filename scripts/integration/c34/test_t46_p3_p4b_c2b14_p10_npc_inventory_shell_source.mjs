// Source contract only. Genuine signed browser lives in the P10 local runner.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=x=>fs.readFileSync(path.join(root,x),"utf8");
const blob=x=>createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+x.length+"\0"),x])).digest("hex");
test("original inventory/Profile/Forge/merchant paths remain byte-identical",()=>{
 for(const [file,sha] of [
  ["components/NpcPanel.js","e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db"],
  ["pages/inventory.js","02d52821d0f22aa82ad92263c5014712906ee385"],
  ["sql/20260624_01_inventory_item_send_rpc.sql","2f1a5818ff0d5a7d87a239e5b1a8f0302b6ff5e6"],
  ["components/AssignItemButton.js","dc09dc77c66896ed842d240c584225cde26581db"],
  ["components/OfferTradeButton.js","5b689a2f4d65412264afd1af395b0fe93a0f151d"],
  ["components/TradeRequestsPanel.js","aa7cd652e0338e38e208d1ab3050c7739c61bb32"]
 ]){
  const data=fs.readFileSync(path.join(root,file));
  assert.equal(blob(data),sha,"Original source drift: "+file);
 }
});
test("P10 is separate from active pages and never imports legacy private inventory",()=>{
 const source=read("components/c34/NonMapNpcInventoryP10ResearchShell.jsx");
 assert.match(source,/createNpcInteractionResearchAdapter/);
 assert.match(source,/onAuthStateChange/);
 assert.match(source,/auth\.getUser\(\)/);
 assert.match(source,/SIGNED_OUT/);
 assert.match(source,/loadNext\(\)/);
 assert.match(source,/setEquipment\(/);
 assert.match(source,/can_view_backpack/);
 assert.match(source,/can_manage_equipment/);
 assert.match(source,/Return to Profile/);
 assert.doesNotMatch(source,/get_character_inventory_v1|set_character_inventory_equipment_v1|character_spells|card_payload|\.from\(|transfer_inventory_item_v1|fetch\(/);
 const active=read("components/c34/NonMapNpcProfileResearchShell.jsx");
 assert.ok(!active.includes("NonMapNpcInventoryP10ResearchShell"));
 const original=read("components/NpcPanel.js");
 assert.ok(!original.includes("NonMapNpcInventoryP10ResearchShell"));
});
test("P10 signed test route exists ONLY in guarded temporary test writer, not pages",()=>{
 const code=read("scripts/integration/c34/run_t46_p3_p4b_c2b14_p10_npc_inventory_browser_signed.mjs");
 assert.match(code,/DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY/);
 assert.match(code,/flag:"wx"/);
 assert.match(code,/fs\.rmSync/);
 assert.match(code,/browser\.newPage/);
 assert.match(code,/signInWithPassword/);
 assert.match(code,/SIGNED_OUT|signOut/);
 assert.match(code,/c34_b14_p7_npc_backpack_page_v1/);
 assert.match(code,/c34_b14_p7_set_npc_equipment_v1/);
 assert.match(code,/c34_b14_p6_set_npc_capability_v1/);
});
