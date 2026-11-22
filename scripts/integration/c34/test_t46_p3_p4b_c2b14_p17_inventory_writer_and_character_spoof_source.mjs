// C34 B14-P17 original-source writer/definer census and P16 character-INSERT RED.
// Read-only scanner: original runtime and SQL, not a live pg_proc/pg_policy audit.
// No product, world-map, merchant, Storage, production SQL or grant changes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const blob=p=>{
 const bytes=fs.readFileSync(path.join(root,p));
 return createHash("sha1").update(Buffer.concat([Buffer.from("blob "+bytes.length+"\0"),bytes])).digest("hex");
};
const original={
 "sql/20260614_02_phase_a_non_map_security_hardening.sql":"25d106dfc18f469948edf705e7997fa961a16cd0",
 "sql/20260624_01_inventory_item_send_rpc.sql":"2f1a5818ff0d5a7d87a239e5b1a8f0302b6ff5e6",
 "components/AssignItemButton.js":"dc09dc77c66896ed842d240c584225cde26581db",
 "pages/inventory.js":"02d52821d0f22aa82ad92263c5014712906ee385",
 "pages/town/[id].js":"c66508b798645e189bb900e63bc17b85b8662e10",
 "components/OfferTradeButton.js":"5b689a2f4d65412264afd1af395b0fe93a0f151d",
 "components/TradeRequestsPanel.js":"aa7cd652e0338e38e208d1ab3050c7739c61bb32",
 "scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p16_disposable_consent_cutover_pg17.sql":"4aafcb071d21573e2f2f193bfa57eca931ca945c"
};
function walk(dir,extensions){
 if(!fs.existsSync(path.join(root,dir)))return [];
 return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(ent=>{
  if(ent.name==="node_modules"||ent.name===".next"||ent.name===".git")return [];
  const rel=dir+"/"+ent.name;
  return ent.isDirectory()?walk(rel,extensions):extensions.test(ent.name)?[rel]:[];
 });
}
const runtime=["components","pages","hooks","utils"].flatMap(d=>walk(d,/\.(?:jsx?|tsx?|mjs)$/i)).sort();
const sqlSources=["sql","supabase"].flatMap(d=>walk(d,/\.sql$/i)).sort();
const lineno=(s,i)=>s.slice(0,i).split("\n").length;
function tableCalls(table){
 const out=[];
 const pat=new RegExp("\\.from\\(\\s*['\\"]"+table+"['\\"]\\s*\\)","g");
 for(const file of runtime){
  const source=read(file);
  for(const m of source.matchAll(pat)){
   const after=source.slice(m.index+m[0].length,m.index+m[0].length+270);
   const method=/\.\s*(select|insert|upsert|update|delete)\s*\(/.exec(after)?.[1]??"unresolved";
   out.push({file,line:lineno(source,m.index),method});
  }
 }
 return out;
}
const inventory=tableCalls("inventory_items");
const merchant=tableCalls("character_stock");
const writers=inventory.filter(c=>["insert","upsert","update","delete"].includes(c.method));
function definerCandidates(){
 const rows=[];
 for(const file of sqlSources){
  const source=read(file);
  const functions=[...source.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([A-Za-z_][A-Za-z_0-9."]*)\s*\(/gi)];
  for(let i=0;i<functions.length;i++){
   const m=functions[i];
   const section=source.slice(m.index,functions[i+1]?.index??source.length);
   if(!/SECURITY\s+DEFINER/i.test(section)||!/\binventory_items\b/i.test(section))continue;
   const mutates=/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:public\.)?inventory_items\b/i.test(section);
   rows.push({file,line:lineno(source,m.index),function:m[1],mutates,
    note:"Textual function-section candidate, not installed pg_proc and not complete dynamic-SQL proof"});
  }
 }
 return rows;
}
test("P17 immutable original writer and P16 signed-local source: no silent product rewrite",()=>{
 for(const [file,sha] of Object.entries(original))
  assert.equal(blob(file),sha,"Original accepted source changed: "+file);
 const p16=read(Object.keys(original).at(-1));
 assert.match(p16,/IF TG_OP='INSERT' AND lower\(coalesce\(NEW.owner_type,''\)\) IN \('npc','merchant'\)/);
 assert.match(p16,/current_user NOT IN \('authenticated','anon'\)/);
 assert.doesNotMatch(p16,/IF TG_OP='INSERT' AND lower\(coalesce\(NEW.owner_type,''\)\) IN \('npc','merchant','character'\)/);
 const rls=read("sql/20260614_02_phase_a_non_map_security_hardening.sql");
 assert.match(rls,/CREATE POLICY inventory_items_insert_owner_or_admin[\s\S]*?WITH CHECK \(\s*user_id = \(SELECT auth\.uid\(\)\)/);
 assert.match(rls,/GRANT SELECT, INSERT, UPDATE, DELETE[\s\S]*?ON TABLE public\.inventory_items/);
 console.log("PASS P17-ORIGINAL-RED: P16 direct npc/merchant INSERT guard omits character ownership; original signed-user_id INSERT RLS does not verify character owner_id");
});
test("P17 full literal browser inventory writer paths, deliberate Town/GM/merchant/trade separation",()=>{
 assert.ok(runtime.length>=250,"Incomplete JS/TS runtime scan");
 const actual=[...new Set(writers.map(x=>x.file))].sort();
 assert.deepEqual(actual,[
  "components/AssignItemButton.js","pages/inventory.js","pages/town/[id].js"
 ],"New direct inventory mutation caller: review its owner_type, owner_id, user_id and legitimacy");
 assert.ok(writers.some(x=>x.file==="components/AssignItemButton.js"&&x.method==="insert"));
 assert.ok(writers.some(x=>x.file==="pages/town/[id].js"&&x.method==="delete"));
 assert.ok(writers.filter(x=>x.file==="pages/town/[id].js"&&x.method==="insert").length>=2);
 assert.ok(writers.some(x=>x.file==="pages/inventory.js"&&x.method==="update"));
 const assigned=read("components/AssignItemButton.js"),town=read("pages/town/[id].js");
 assert.match(assigned,/if \(finalType === "player"\) insertData.user_id = finalId/);
 assert.match(assigned,/supabase\.from\("inventory_items"\)\.insert\(insertData\)/);
 assert.match(town,/\.insert\(rollbackRows\)/);
 assert.match(read("components/OfferTradeButton.js"),/\.from\("trade_requests"\)\.insert/);
 assert.match(read("components/TradeRequestsPanel.js"),/rpc\("accept_trade"/);
 assert.match(read("components/MerchantPanel.js"),/rpc\("buy_from_merchant"/);
 assert.ok(merchant.some(x=>x.file==="components/MerchantPanel.js"&&x.method==="insert"));
 assert.equal(merchant.filter(x=>x.file==="components/AssignItemButton.js").length,0);
 console.log("PASS P17-BROWSER-WRITERS: direct item mutations exact path list, player crafting rollback, admin assignment and player trade vs merchant stock split");
});
test("P17 all checked-in historical SQL function candidate census, no false hosted coverage claim",()=>{
 assert.ok(sqlSources.length>=180,"SQL source corpus unexpectedly truncated");
 const defs=definerCandidates();
 assert.ok(defs.length>0,"No SECURITY DEFINER inventory reader/writer candidates found");
 const has=keyword=>defs.some(x=>x.function.includes(keyword));
 assert.ok(has("transfer_inventory_item_v1"),"Original definer transfer absent from census");
 const mutating=defs.filter(x=>x.mutates);
 assert.ok(mutating.length>0,"Original SQL inventory mutators absent from census");
 console.log("C34-P17-SOURCE-CENSUS "+JSON.stringify({
  runtimeFiles:runtime.length,sqlFiles:sqlSources.length,
  browserInventoryWrites:writers,merchantStockWrites:merchant.filter(x=>x.method!=="select"),
  definerCandidates:defs,
  caveats:["Source SQL may be obsolete, uninstalled or later overridden","textual function sections can include comments, neighboring triggers or dynamic SQL","SQL writers outside SECURITY DEFINER, indirect triggers and external clients are not enumerated","Requires owner-approved read-only hosted pg_proc, grants, pg_policy, function-call graph and role/browser validation","P16 prototype intentionally unchanged; signed P17 separately records character INSERT spoof RED"]
 }));
 console.log("PASS P17-DEFINER-CENSUS: historical SQL candidates identified, not certified as installed or safe to revoke");
});
