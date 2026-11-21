// C34 C2-B13: free, full-checked-out-branch nonmap merchant writer census.
// Static ONLY; no DB, hosted Supabase, API key, agent, deployment, or network.
// This detects newly introduced browser character_stock writers but does not
// claim complete production RLS, original PR feature parity or installed SQL.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const raw=rel=>fs.readFileSync(path.join(root,rel));
const gitBlob=b=>createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+b.length+"\0"),b
])).digest("hex");
const must={ 
 "components/MerchantPanel.js":"22e4d0810603bc0322904573cb5fe0c14bad1f88",
 "components/c34/MerchantPanelT28P2Research.jsx":"32c808c78f56767a19c1fcfd4f64c961755a8cf1",
 "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a",
 "utils/useWallet.js":"f34b99f1d6eee66420d57bdcefdc6d3427092e25",
 "components/MerchantStorefrontView.js":"9460eb1ea15994b9b0ed2abefba660e9b4c9370c",
 "components/NpcForgeEquipmentStep.js":"9269c554d80fb1b02afd571d51f8d626e2a89c50",
 "pages/inventory.js":"02d52821d0f22aa82ad92263c5014712906ee385",
 "pages/admin.js":"1ba76a20bfa87934d7e504c056c4770ad1b3a92a",
 "pages/town/[id].js":"c66508b798645e189bb900e63bc17b85b8662e10",
 "supabase/advance_all_characters_v3.sql":"da0f39e320075ed1859a3ffaf41cd892e7d47387",
 "sql/20261016_01_campaign_item_pool_final_constraints.sql":"c804ccd4ea3c1746ad114daa18af8f173bf02128"
};
for(const [file,expected] of Object.entries(must)){
 assert.equal(gitBlob(raw(file)),expected,"C2-B13 source blob drift: "+file);
}
const codeTypes=/\.(?:js|jsx|ts|tsx|mjs)$/;
function walk(dir){
 if(!fs.existsSync(path.join(root,dir)))return [];
 const results=[];
 for(const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
  if(item.name==="node_modules"||item.name===".next")continue;
  const rel=dir+"/"+item.name;
  if(item.isDirectory())results.push(...walk(rel));
  else if(codeTypes.test(item.name))results.push(rel);
 }
 return results;
}
const files=["components","pages","utils"].flatMap(walk);
const knownRpcs=[
 "buy_from_merchant","stock_merchant_item","reroll_merchant_inventory_v2",
 "set_campaign_future_tech_enabled_v1","c34_t46_manage_stock_qty_v1",
 "c34_t46_manage_merchant_stock_v1","transfer_inventory_item_v1",
 "list_item_send_targets_v1","list_transfer_targets","wallet_get"
];
const srcs=files.map(file=>({file,src:raw(file).toString("utf8")}));
function lines(src,idx){return src.slice(0,idx).split("\n").length}
function calls(table){
 const results=[];
 const lookup=new RegExp("\\.from\\(\\s*['\\\"]"+table+"['\\\"]\\s*\\)","g");
 for(const {file,src} of srcs){
  for(const m of src.matchAll(lookup)){
   const tail=src.slice(m.index+m[0].length,m.index+m[0].length+300);
   const method=/\.\s*(select|insert|upsert|update|delete)\s*\(/.exec(tail);
   results.push({file,line:lines(src,m.index),method:method?.[1]||"unresolved"});
  }
 }
 return results;
}
const stock=calls("character_stock");
const stockWrites=stock.filter(v=>["insert","upsert","update","delete"].includes(v.method));
const expectedStockWriters=[
 "components/MerchantPanel.js",
 "components/c34/MerchantPanelT28P2Research.jsx"
];
assert.deepEqual([...new Set(stockWrites.map(x=>x.file))].sort(),expectedStockWriters,
 "C2-B13 NEW runtime direct character_stock writer: investigate, never silently accept");
for(const file of expectedStockWriters){
 const writes=stockWrites.filter(x=>x.file===file);
 for(const action of ["insert","update","delete"])
  assert.ok(writes.some(x=>x.method===action),file+" original expected RED "+action+" missing");
}
const inventory=calls("inventory_items");
const inventoryWrites=inventory.filter(v=>["insert","upsert","update","delete"].includes(v.method));
const rpcs=[];
for(const {file,src} of srcs){
 for(const m of src.matchAll(/\.rpc\(\s*["']([A-Za-z_0-9]+)["']/g))
  if(knownRpcs.includes(m[1]))rpcs.push({file,line:lines(src,m.index),rpc:m[1]});
}
const currentByName=name=>rpcs.filter(x=>x.rpc===name);
assert.ok(currentByName("set_campaign_future_tech_enabled_v1").some(x=>x.file==="pages/admin.js"));
assert.ok(currentByName("stock_merchant_item").length>=2);
assert.ok(currentByName("buy_from_merchant").length>=2);
assert.ok(inventoryWrites.some(x=>x.file==="pages/inventory.js"));
assert.ok(inventoryWrites.some(x=>x.file==="pages/town/[id].js"));
const storefront=raw("components/MerchantStorefrontView.js").toString("utf8");
assert.ok(!/\.from\(|\.rpc\(/.test(storefront),
 "Shared merchant storefront view unexpectedly gained a data writer");
const forge=raw("components/NpcForgeEquipmentStep.js").toString("utf8");
assert.ok(forge.includes('from("character_stock")')&&!/\bfrom\(["']character_stock["']\)[\s\S]{0,150}\.(insert|delete|update)\(/.test(forge),
 "Forge stock browser unexpectedly gained direct stock write");
const admin=raw("pages/admin.js").toString("utf8");
assert.ok(admin.includes('rpc("set_campaign_future_tech_enabled_v1"'));
const town=raw("pages/town/[id].js").toString("utf8");
assert.ok(town.includes('from("inventory_items").delete()')&&town.includes(".insert(rollbackRows)"),
 "Town crafting nontransactional inventory rollback changed; review separately");
const sql=raw("sql/20261016_01_campaign_item_pool_final_constraints.sql").toString("utf8");
assert.ok(sql.includes("CREATE OR REPLACE FUNCTION public.set_campaign_future_tech_enabled_v1"));
assert.ok(sql.includes("PERFORM * FROM public.reroll_merchant_inventory_v2"));
assert.ok(sql.includes("WHERE storefront_enabled=true")&&!sql.includes("WHERE storefront_enabled=true AND kind='merchant'"),
 "Original bulk reroll RED source changed or became a candidate");
const movement=raw("supabase/advance_all_characters_v3.sql").toString("utf8");
assert.match(movement,/perform public\.reroll_merchant_inventory_v2\(/i);
const sqlStockDml=[];
for(const file of walk("sql").concat(walk("supabase")).filter(f=>/\.(?:sql|js|mjs)$/.test(f))){
 const src=raw(file).toString("utf8");
 for(const m of src.matchAll(/\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:public\.)?character_stock\b/gi))
  sqlStockDml.push({file,line:lines(src,m.index),kind:m[1].toUpperCase().replace(/\s+/g," ")});
}
const readOnlyStock=stock.filter(v=>v.method==="select");
const report={
 scope:"C34 C2-B13 static checked-out runtime/browser code + historical SQL census",
 runtimeCodeFilesScanned:files.length,
 historicalSqlDmlPaths:[...new Set(sqlStockDml.map(x=>x.file))].sort(),
 runtimeDirectStockWriters:stockWrites,
 runtimeStockReaders:readOnlyStock,
 relevantRpcCallsites:rpcs,
 inventoryWriters:inventoryWrites,
 sqlStockDml,
 sourceBlobsPinned:Object.keys(must).length,
 notProved:["hosted function body/grants","browser role ACL under deployed policies",
 "complete inherited PR source parity","world-map movement safe to patch",
 "production deployment","independent database/Storage restore"]
};
console.log("PASS C34-C2B13-PROTECTED-BLOBS: "+Object.keys(must).length+
 " original exact Git blobs including untouched map, stock panels, original SQL");
console.log("PASS C34-C2B13-CLIENT-STOCK-RED: only the two checked-in merchant panels retain direct raw stock mutation; preserved as original RED");
console.log("PASS C34-C2B13-ADJACENT-CONSUMERS: Forge stock browser read/stage, shared storefront presentation only, separate inventory/town craft writes, global admin RPC and movement-side reroll identified");
console.log("C34-C2B13-CENSUS "+JSON.stringify(report));
console.log("PASS C34-C2B13-STATIC-SOURCE-ONLY: no hosted SQL, no production deployment, no agent or paid API");
