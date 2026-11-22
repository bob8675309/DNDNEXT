// C34 B14-P13: checked-out runtime source inventory of inventory/NPC consent
// entrypoints. This is a static research guard, NOT a hosted SQL check or cutover.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const directSources=["components","pages","hooks","utils"];
const extensions=/\.(?:jsx?|tsx?|mjs)$/i;
function walk(rel){
 const dir=path.join(root,rel);
 if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{
  if(ent.name==="node_modules"||ent.name===".next")return [];
  const p=rel+"/"+ent.name;
  return ent.isDirectory()?walk(p):extensions.test(ent.name)?[p]:[];
 });
}
const read=f=>fs.readFileSync(path.join(root,f),"utf8");
const runtime=directSources.flatMap(walk).sort();
const sources=runtime.map(file=>({file,source:read(file)}));
const lineOf=(s,n)=>s.slice(0,n).split("\n").length;
const interesting=new Set([
 "list_item_send_targets_v1",
 "transfer_inventory_item_v1",
 "get_character_inventory_v1",
 "set_character_inventory_equipment_v1",
 "c34_b14_p2_transfer_inventory_item_v1",
 "c34_b14_p2_transfer_inventory_items_bulk_v1",
 "c34_b14_p4_send_character_gear_to_controlled_npc_v1",
 "c34_b14_p6_offer_item_v1",
 "c34_b14_p6_decide_item_offer_v1",
 "c34_b14_p6_cancel_item_offer_v1",
 "c34_b14_p8_dispatch_item_intent_v1",
 "c34_b14_p8_dispatch_batch_intent_v1",
 "c34_b14_p8_gm_decide_item_offer_v1",
 "c34_b14_p8_gm_pending_offers_v1",
 "accept_trade","buy_from_merchant","stock_merchant_item",
 "reroll_merchant_inventory_v2"
]);
function findRpc(){
 const hits=[];
 for(const {file,source} of sources){
  for(const m of source.matchAll(/\.rpc\(\s*["']([A-Za-z_0-9]+)["']/g)){
   if(interesting.has(m[1]))hits.push({file,line:lineOf(source,m.index),rpc:m[1]});
  }
 }
 return hits.sort((a,b)=>a.rpc.localeCompare(b.rpc)||a.file.localeCompare(b.file)||a.line-b.line);
}
const calls=findRpc();
function names(name){return [...new Set(calls.filter(x=>x.rpc===name).map(x=>x.file))].sort();}
function expectPaths(name,expected){
 assert.deepEqual(names(name),expected.sort(),"Review unexpected or missing runtime caller of "+name);
}
const original={
 list_item_send_targets_v1:["components/NpcPanel.js","pages/inventory.js"],
 transfer_inventory_item_v1:["components/NpcPanel.js","pages/inventory.js"],
 get_character_inventory_v1:["components/NpcPanel.js","hooks/useNpcSheetActionData.js"],
 set_character_inventory_equipment_v1:["components/NpcPanel.js"],
 accept_trade:["components/TradeRequestsPanel.js"],
};
const proposed=[
 "c34_b14_p2_transfer_inventory_item_v1",
 "c34_b14_p2_transfer_inventory_items_bulk_v1",
 "c34_b14_p4_send_character_gear_to_controlled_npc_v1",
 "c34_b14_p6_offer_item_v1",
 "c34_b14_p6_decide_item_offer_v1",
 "c34_b14_p6_cancel_item_offer_v1",
 "c34_b14_p8_dispatch_item_intent_v1",
 "c34_b14_p8_dispatch_batch_intent_v1",
 "c34_b14_p8_gm_decide_item_offer_v1",
 "c34_b14_p8_gm_pending_offers_v1",
];
function tableCalls(table){
 const hits=[];
 const re=new RegExp("\\.from\\(\\s*['\\\"]"+table+"['\\\"]\\s*\\)","g");
 for(const {file,source} of sources){
  for(const m of source.matchAll(re)){
   const look=source.slice(m.index+m[0].length,m.index+m[0].length+270);
   const result=/\.\s*(select|insert|upsert|update|delete)\s*\(/.exec(look);
   hits.push({file,line:lineOf(source,m.index),method:result?.[1]??"unresolved"});
  }
 }
 return hits.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line);
}
const inventory=tableCalls("inventory_items");
const merchant=tableCalls("character_stock");
test("P13 scan all mounted and research JS/TS runtime locations; no silently added old RPC client",()=>{
 assert.ok(runtime.length>=250,"Unexpectedly narrow runtime source inventory");
 for(const [endpoint,expected] of Object.entries(original))expectPaths(endpoint,expected);
 for(const endpoint of proposed)expectPaths(endpoint,[]);
 const merchantBuyer=names("buy_from_merchant");
 assert.ok(merchantBuyer.includes("components/MerchantPanel.js"));
 assert.ok(names("stock_merchant_item").includes("components/MerchantPanel.js"));
});
test("P13 preserve original source/role split: account trades, NPC, manager, merchant and Town remain different",()=>{
 const inv=read("pages/inventory.js");
 const npc=read("components/NpcPanel.js");
 const trade=read("components/TradeRequestsPanel.js");
 const town=read("pages/town/[id].js");
 const rls=read("sql/20260614_02_phase_a_non_map_security_hardening.sql");
 const stock=read("sql/20260721_01_character_data_rls_phase_1.sql");
 assert.match(inv,/supabase\.rpc\("transfer_inventory_item_v1"/);
 assert.match(inv,/supabase\.from\("inventory_items"\)\.update\(patch\)\.in\("id", selectedIds\)/);
 assert.match(npc,/supabase\.rpc\("get_character_inventory_v1"/);
 assert.match(trade,/supabase\.rpc\("accept_trade"/);
 assert.match(town,/\.from\("inventory_items"\)\.delete\(\)/);
 assert.match(town,/\.insert\(rollbackRows\)/);
 assert.match(rls,/CREATE POLICY inventory_items_update_owner_or_admin/);
 assert.match(rls,/WITH CHECK \(\s*user_id = \(SELECT auth\.uid\(\)\)\s*OR \(SELECT private\.current_user_is_admin\(\)\)/);
 assert.match(stock,/create policy character_stock_admin_write/);
 assert.match(stock,/using \(\(select private\.current_user_is_admin\(\)\)\)/);
 assert.ok(!read("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p8_gm_offer_settlement_pg17.sql").includes("REVOKE ALL ON FUNCTION public.transfer_inventory_item_v1"),
  "P8 GM scratch settlement may not masquerade as full consent cutover");
});
test("P13 owner transfers and merchant stock write census are distinct from NPC consent",()=>{
 assert.ok(inventory.some(x=>x.file==="pages/inventory.js"&&x.method==="update"));
 assert.ok(inventory.some(x=>x.file==="components/AssignItemButton.js"&&x.method==="insert"));
 assert.ok(inventory.some(x=>x.file==="pages/town/[id].js"&&x.method==="delete"));
 assert.ok(merchant.some(x=>x.file==="components/MerchantPanel.js"&&x.method==="insert"));
 assert.ok(merchant.some(x=>x.file==="components/MerchantPanel.js"&&x.method==="delete"));
 const writerPaths=[...new Set(merchant.filter(x=>["insert","update","delete","upsert"].includes(x.method)).map(x=>x.file))].sort();
 assert.deepEqual(writerPaths,["components/MerchantPanel.js","components/c34/MerchantPanelT28P2Research.jsx"]);
});
console.log("C34-P13-CALLER-SOURCE-CENSUS "+JSON.stringify({
 scannedRuntimeFiles:runtime.length,
 originalClientRpcs:calls.filter(x=>Object.keys(original).includes(x.rpc)),
 currentMerchantRpcs:calls.filter(x=>["buy_from_merchant","stock_merchant_item","reroll_merchant_inventory_v2"].includes(x.rpc)),
 activeP8P6P2ClientRpcs:calls.filter(x=>proposed.includes(x.rpc)),
 inventoryDirectCalls:inventory,
 merchantDirectCalls:merchant,
 exclusions:["public SQL sources do not certify installed RLS or RPC grants","dynamic or externally generated RPC names not resolved","current user role privileges not live-verified","original player-to-player trade separate from NPC consent","Forge/Town direct item issuance and merchant character_stock remain independent","MapPageClient and movement SQL unchanged","no signed browser cutover"]
}));
