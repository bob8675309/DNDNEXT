// C34 T46-C2-B10. Signed actual GoTrue/PostgREST source-preserving
// manual add/remove/dump vs guarded buyer/B8 delta/B9 reroll + historical
// full campaign item-pool toggling. DISPOSABLE PG17 ONLY, no live SQL.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {spawn,spawnSync} from "node:child_process";
import {b10BulkSource} from "./candidates/t46_p3_p4b_c2b10_bulk_source.mjs";

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const within=(promise,label,ms=30000)=>Promise.race([
 promise,new Promise((_,reject)=>setTimeout(()=>reject(Error("B10 timeout: "+label)),ms))
]);
class LockRow {
 constructor(env){
  this.proc=spawn("psql",["-X","-qAt","-v","ON_ERROR_STOP=1"],{env,stdio:["pipe","pipe","pipe"]});
  this.out="";this.err="";this.pending=new Map();this.failed=null;
  this.proc.stdin.on("error",()=>{});
  this.proc.stdout.on("data",buf=>{
   this.out+=buf.toString();let i;
   while((i=this.out.indexOf("\n"))>=0){
    const line=this.out.slice(0,i).trim();this.out=this.out.slice(i+1);
    const done=this.pending.get(line);if(done){this.pending.delete(line);done()}
   }
  });
  this.proc.stderr.on("data",v=>this.err=(this.err+v.toString()).slice(-5000));
  this.proc.on("error",e=>this.failed=e);
  this.proc.on("exit",c=>this.failed=Error("B10 psql exited "+c+" "+this.err));
 }
 async send(q){
  assert.ifError(this.failed);
  const token="B10_"+randomUUID().replaceAll("-","");
  const ready=new Promise(resolve=>this.pending.set(token,resolve));
  this.proc.stdin.write(q+"\nSELECT '"+token+"';\n");
  await within(ready,"held psql",18000);
  assert.ifError(this.failed);
 }
 async close(){
  if(!this.failed)try{await this.send("ROLLBACK;")}catch{}
  if(this.proc.exitCode===null)this.proc.kill("SIGTERM");
  await pause(90);
 }
}
const deny=(response,code,message)=>{
 assert.ok(response.error,message+": unexpected success "+JSON.stringify(response));
 assert.equal(response.error.code,code,message+": "+JSON.stringify(response.error));
};
export async function runT46C2B10StockWritersSigned({
 env,root,actors,newActor,sql,q,lit,walletOf,invCount
}){
 for(const [k,v] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGDATABASE:"postgres",DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"
 }))assert.equal(env[k],v,"B10 refuses hosted/non-disposable env "+k);
 assert.equal(sql("SELECT current_setting('server_version_num')::integer BETWEEN 170000 AND 179999"),"t");
 const originalBuyer=sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))");
 const b8Original=sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)'::regprocedure))");
 const b9Original=sql("SELECT md5(pg_get_functiondef('public.reroll_merchant_inventory_v2(uuid,text,integer)'::regprocedure))");
 const sqlPath=path.join(root,"scripts/integration/c34/candidates/t46_p3_p4b_c2b10_manual_stock_pg17.sql");
 const stmt=fs.readFileSync(sqlPath);
 assert.ok(stmt.toString().includes("C34 T46-C2B10"));
 assert.equal(sql("SELECT to_regprocedure('public.c34_t46_manage_merchant_stock_v1(uuid,text,uuid,jsonb,text,numeric,integer,jsonb)') IS NULL"),"t");
 const proc=spawnSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-f",sqlPath],{cwd:root,env,encoding:"utf8",timeout:30000});
 assert.equal(proc.status,0,"B10 local candidate install: "+String(proc.stderr).slice(-2000));
 const sig="'public.c34_t46_manage_merchant_stock_v1(uuid,text,uuid,jsonb,text,numeric,integer,jsonb)'";
 assert.equal(sql("SELECT has_function_privilege('anon',"+sig+",'EXECUTE')"),"f");
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+sig+",'EXECUTE')"),"t");
 const def=sql("SELECT pg_get_functiondef("+sig+"::regprocedure)");
 assert.ok(def.indexOf("FOR UPDATE")<def.indexOf("DELETE FROM public.character_stock"),"B10 seller lock order");

 const [admin,gm,player,buyer]=await Promise.all([
  newActor("B10_ADMIN","admin"),newActor("B10_GM","gm"),
  newActor("B10_PLAYER","player"),newActor("B10_FUNDED_BUYER","player")
 ]);
 // Isolate B10 purchase accounting from B2–B9 spending and stock fixtures.
 sql("INSERT INTO public.player_wallets(user_id,gp) VALUES("+q(buyer.id)+",100)");
 const ids=[randomUUID(),randomUUID()].sort();
 const [sellerA,sellerB]=ids;
 for(const [i,id] of ids.entries())sql(
  "INSERT INTO public.characters(id,name,kind,is_hidden,storefront_enabled,state,location_id) VALUES("+
  q(id)+","+lit("B10 Safe Merchant "+(i+1))+",'merchant',false,true,"+(i?"'camping'":"'moving'")+",NULL)");
 const addParams=(seller,name,qty=3,price=5)=>({
  p_merchant_id:seller,p_action:"add",p_display_name:name,p_qty:qty,p_price_gp:price,
  p_payload:{item_type:"Potion",item_rarity:"Common",item_id:"b10-"+name.replaceAll(" ","-")}
 });
 const mutate=(actor,args)=>actor.who.rpc("c34_t46_manage_merchant_stock_v1",args);
 const shelf=(seller)=>JSON.parse(sql("SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb)::text FROM public.character_stock s WHERE s.character_id="+q(seller)));
 const byId=(id)=>JSON.parse(sql("SELECT row_to_json(s)::text FROM public.character_stock s WHERE id="+q(id)));
 const stockQty=(id)=>sql("SELECT coalesce((SELECT qty::text FROM public.character_stock WHERE id="+q(id)+"),'gone')");
 const count=(seller)=>Number(sql("SELECT count(*) FROM public.character_stock WHERE character_id="+q(seller)));
 const walletStart=walletOf(buyer.id),invStart=Number(invCount(buyer.id));
 const normalBuy=(seller,id)=>buyer.who.rpc("buy_from_merchant",{
  p_merchant_id:seller,p_stock_uuid:id,p_qty:1
 });
 const [a0,b0]=await Promise.all([
  mutate(admin,addParams(sellerA,"Original Set A")),
  mutate(gm,addParams(sellerB,"Original Set B"))
 ]);
 assert.ifError(a0.error);assert.ifError(b0.error);
 const aid=a0.data.id,bid=b0.data.id;
 assert.equal(stockQty(aid),"3");assert.equal(stockQty(bid),"3");
 const third=await mutate(actors.DM,addParams(sellerA,"DM Added",1,0));
 assert.ifError(third.error);assert.equal(stockQty(third.data.id),"1");
 for(const request of [
  addParams(sellerA,"Unauthorized Item"),
  {p_merchant_id:sellerA,p_action:"dump",p_expected:shelf(sellerA)},
  {p_merchant_id:sellerA,p_action:"remove",p_stock_id:aid,p_expected:byId(aid)}
 ])deny(await mutate(player,request),"42501","signed nonmanager must not add/remove/dump");
 for(const actor of [player,actors.OUTSIDER]){
  const direct=await actor.who.from("character_stock").delete().eq("id",aid).select("id");
  assert.ok(direct.error||!direct.data?.length,"B10 nonmanager direct REST DELETE succeeded");
 }
 assert.equal(stockQty(aid),"3");
 console.log("PASS T46-C2B10-ACL: signed admin/gm/dm manually add stock via single atomic RPC, signed player add/remove/dump 42501, anon denied, raw DELETE denied");

 for(const [message,args] of [
  ["negative price",addParams(sellerA,"Bad price",3,-1)],
  ["negative quantity",addParams(sellerA,"Bad qty",-1,3)],
  ["zero quantity",addParams(sellerA,"Zero qty",0,3)],
  ["empty name",addParams(sellerA,"",3,3)],
  ["wrong action",{p_merchant_id:sellerA,p_action:"rename",p_display_name:"No"}],
  ["remove without CAS",{p_merchant_id:sellerA,p_action:"remove",p_stock_id:aid}],
  ["dump without snapshot",{p_merchant_id:sellerA,p_action:"dump"}]
 ])deny(await mutate(gm,args),"22023",message);
 const npc=randomUUID();
 sql("INSERT INTO public.characters(id,name,kind,is_hidden,storefront_enabled,state) VALUES("+
  q(npc)+",'B10 Unauthorized NPC','npc',false,true,'resting')");
 deny(await mutate(admin,addParams(npc,"NPC stock")),"42501","NPC not a merchant");
 assert.equal(count(sellerA),2);
 console.log("PASS T46-C2B10-VALIDATION: invalid price/quantity/name/actions/snapshots and nonmerchant seller rejected without writes");

 // Entire row snapshot must detect card-payload AND price edits even when a
 // privileged legacy writer changes neither qty nor updated_at.
 const frozenDetails=byId(aid);
 sql("UPDATE public.character_stock SET price_gp=price_gp+1, card_payload=card_payload || '{\"b10_probe\":true}'::jsonb WHERE id="+q(aid));
 deny(await mutate(gm,{p_merchant_id:sellerA,p_action:"remove",p_stock_id:aid,
  p_expected:frozenDetails}),"40001","stale crafted price/payload despite equal quantity/revision");
 assert.equal(stockQty(aid),"3");
 sql("UPDATE public.character_stock SET price_gp=price_gp-1, card_payload=card_payload-'b10_probe' WHERE id="+q(aid));
 console.log("PASS T46-C2B10-SNAPSHOT-FULL-ROW: stale price/payload edit invalidates destructive CAS despite unchanged qty and timestamp");

 // Purchase after UI snapshot MUST invalidate a deliberate remove.
 const oldRow=byId(aid);
 const buy1=await normalBuy(sellerA,aid);
 assert.ifError(buy1.error);assert.equal(Number(buy1.data),1);
 deny(await mutate(gm,{p_merchant_id:sellerA,p_action:"remove",
  p_stock_id:aid,p_expected:oldRow}),"40001","stale remove after buyer");
 assert.equal(stockQty(aid),"2");
 const removed=await mutate(gm,{p_merchant_id:sellerA,p_action:"remove",
  p_stock_id:aid,p_expected:byId(aid)});
 assert.ifError(removed.error);assert.equal(removed.data.deleted,1);
 assert.equal(stockQty(aid),"gone");
 deny(await mutate(admin,{p_merchant_id:sellerA,p_action:"remove",
  p_stock_id:aid,p_expected:oldRow}),"P0002","removed stock UUID");
 assert.equal(walletOf(buyer.id),String(Number(walletStart)-5));
 assert.equal(Number(invCount(buyer.id)),invStart+1);
 console.log("PASS T46-C2B10-REMOVE-CAS: buyer invalidates original snapshot, stale remove 40001, fresh remove deletes exactly owned stock; no purchase double debit");

 // Dump snapshot compares EVERY UUID, quantity and timestamp on a seller
 // locked before stock deletion. Selling to buyer changes the exact snapshot.
 const oldShelf=shelf(sellerB);
 const boughtB=await normalBuy(sellerB,bid);
 assert.ifError(boughtB.error);
 deny(await mutate(actors.DM,{p_merchant_id:sellerB,p_action:"dump",p_expected:oldShelf}),"40001","dump lost buyer");
 assert.equal(stockQty(bid),"2");
 const dumped=await mutate(actors.DM,{p_merchant_id:sellerB,p_action:"dump",p_expected:shelf(sellerB)});
 assert.ifError(dumped.error);
 assert.equal(dumped.data.deleted,1);
 assert.equal(count(sellerB),0);
 assert.equal(count(sellerA),1,"Merchant B dump must never remove Merchant A stock");
 assert.equal(walletOf(buyer.id),String(Number(walletStart)-10));
 assert.equal(Number(invCount(buyer.id)),invStart+2);
 console.log("PASS T46-C2B10-DUMP-CAS: old snapshot rejected after signed buyer; fresh full-shelf clear atomic and merchant scoped");

 // Reverse-race check: exclusive seller lock must be taken BEFORE waiting on
 // held stock row. Buyer and B8 manager each need seller FOR SHARE and queue.
 const heldRow=third.data.id;
 const snapshot=shelf(sellerA);
 const walletBeforeRace=walletOf(buyer.id),itemsBeforeRace=Number(invCount(buyer.id));
 let tx=new LockRow(env);
 try{
  await tx.send("BEGIN; SELECT id FROM public.character_stock WHERE id="+q(heldRow)+" FOR UPDATE;");
  let cleared=false;
  const clearPromise=Promise.resolve(mutate(admin,{
   p_merchant_id:sellerA,p_action:"dump",p_expected:snapshot
  })).then(x=>{cleared=true;return x});
  let blocked=false;
  for(let i=0;i<50;i++){
   await pause(90);
   if(cleared)break;
   if(Number(sql("SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query ILIKE '%c34_t46_manage_merchant_stock_v1%'"))>0){
    blocked=true;break;
   }
  }
  assert.ok(blocked&&!cleared,"B10 failed to demonstrate seller-exclusive lock held before stock wait");
  let bought=false,deltaDone=false;
  const purchase=Promise.resolve(normalBuy(sellerA,heldRow)).then(x=>{bought=true;return x});
  const delta=Promise.resolve(actors.DM.who.rpc("c34_t46_manage_stock_qty_v1",{
    p_stock_id:heldRow,p_mode:"delta",p_value:1,p_expected_qty:null,p_expected_updated_at:null
  })).then(x=>{deltaDone=true;return x});
  await pause(200);
  assert.ok(!cleared&&!bought&&!deltaDone,"B10 buyer/quantity bypassed seller-first dump lock");
  await tx.send("COMMIT;");
  const [result,receipt,qty]=await within(Promise.all([clearPromise,purchase,delta]),"dump/buy/delta race",35000);
  assert.ifError(result.error);
  deny(receipt,"P0001","original buyer of removed row after dump");
  assert.match(receipt.error.message,/Stock not found/,"original buyer reason must be exact missing UUID");
  deny(qty,"P0002","B8 delta of removed row after dump");
  assert.equal(stockQty(heldRow),"gone");
  assert.equal(walletOf(buyer.id),walletBeforeRace);
  assert.equal(Number(invCount(buyer.id)),itemsBeforeRace);
  console.log("PASS T46-C2B10-DUMP-RACE: signed dump acquires exclusive seller before stock, signed buyer/B8 manager wait, both old UUIDs deny, no deadlock/GP/item side effects");
 }finally{await tx.close()}

 // Server fallback cannot safely emulate atomic operations using two HTTP
 // requests; there is no rollback across independent DELETE then INSERT.
 // Preserve original source RED and approved fail-CLOSED production decision.
 const originalPanel=fs.readFileSync(path.join(root,"components/MerchantPanel.js"),"utf8");
 const originalGuarded=fs.readFileSync(path.join(root,"components/c34/MerchantPanelT28P2Research.jsx"),"utf8");
 for(const [source,label] of [[originalPanel,"main original"],[originalGuarded,"held guarded"]]){
  assert.match(source,/async function rerollThemedFallback\(/,label+" missing original fallback");
  assert.match(source,/if \(rpc\.error\) \{[\s\S]*?\.from\("character_stock"\)\.insert/,label+" lost source add fallback");
  assert.match(source,/async function dumpAll\(/);
  assert.match(source,/async function removeRow\(/);
 }
 console.log("EXPECTED ORIGINAL T46-C2B10-DIRECT-STOCK-RED: both existing storefront source variants retain fallback raw INSERT and direct DELETE/dump; B10 tests only a disposable server boundary, not a product UI release");

 // The original repository future-tech setter is source-pinned against
 // same Oct16 blob; do not call hosted function or change map/cron.
 const {original,candidate}=b10BulkSource(fs.readFileSync(path.join(root,
  "sql/20261016_01_campaign_item_pool_final_constraints.sql")));
 for(const [col,kind] of [
  ["role","text"],["affiliation","text"],["storefront_title","text"],
  ["storefront_tagline","text"],["tags","text[]"]
 ])sql("ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS "+col+" "+kind);
 for(const [col,kind] of [["updated_at","timestamptz"],["updated_by","uuid"]])
  sql("ALTER TABLE public.campaign_item_pool_settings ADD COLUMN IF NOT EXISTS "+col+" "+kind);
 const originalEnabled=JSON.parse(sql("SELECT coalesce(jsonb_agg(c.id),'[]'::jsonb)::text FROM public.characters c WHERE c.storefront_enabled IS TRUE"));
 sql("UPDATE public.characters SET storefront_enabled=false WHERE storefront_enabled IS TRUE");
 sql("UPDATE public.characters SET storefront_enabled=true WHERE id IN ("+ids.map(q).join(",")+")");
 const initialSetting=sql("SELECT future_tech_enabled::text FROM public.campaign_item_pool_settings WHERE id=1");
 const bulk=(actor,enabled)=>actor.who.rpc("set_campaign_future_tech_enabled_v1",{p_enabled:enabled});
 try{
  // Two merchants only; storefront-enabled NPC is intentionally ignored by
  // B10 kind-only fix while original function would try rerolling the NPC.
  sql("UPDATE public.characters SET storefront_enabled=true WHERE id="+q(npc));
  sql(original);
  sql("REVOKE ALL ON FUNCTION public.set_campaign_future_tech_enabled_v1(boolean) FROM PUBLIC,anon,authenticated");
  sql("GRANT EXECUTE ON FUNCTION public.set_campaign_future_tech_enabled_v1(boolean) TO authenticated");
  sql("NOTIFY pgrst,'reload schema'");
  deny(await bulk(gm,false),"P0001","original admin-only bulk setter");
  assert.equal(sql("SELECT future_tech_enabled::text FROM public.campaign_item_pool_settings WHERE id=1"),initialSetting);
  console.log("EXPECTED ORIGINAL T46-C2B10-BULK-GM-RED: exact historical October future-tech source rejects signed GM, while in-app admin/gm/dm are owner-equivalent");
  sql(candidate);
  sql("NOTIFY pgrst,'reload schema'");
  deny(await bulk(player,true),"42501","ordinary player bulk toggle");
  let gmResult=await bulk(gm,true);assert.ifError(gmResult.error);
  assert.equal(gmResult.data[0].rerolled_merchants,2);
  assert.equal(gmResult.data[0].future_tech_enabled,true);
  assert.equal(count(sellerA),30);assert.equal(count(sellerB),30);
  assert.equal(sql("SELECT future_tech_enabled::text FROM public.campaign_item_pool_settings WHERE id=1"),"true");
  assert.equal(count(npc),0,"Bulk reroll incorrectly generated stock for NPC");
  assert.equal(sql("SELECT state::text FROM public.characters WHERE id="+q(sellerA)),"moving");
  assert.equal(sql("SELECT state::text FROM public.characters WHERE id="+q(sellerB)),"camping");
  const compat=await gm.who.rpc("reroll_merchant_inventory_v2",{
   p_merchant_id:sellerA,p_theme:"general"
  });
  assert.ifError(compat.error);
  assert.ok(Number(compat.data[0].inserted_count)>=28&&Number(compat.data[0].inserted_count)<=32,
   "B10 omitted p_count must use source default, not an invented 2-arg routine");
  assert.equal(sql("SELECT to_regprocedure('public.reroll_merchant_inventory_v2(uuid,text)') IS NULL"),"t");
  console.log("PASS T46-C2B10-BULK-ROLES: original source-derived bulk signed GM rerolls two real merchants, ignores enabled NPC, keeps moving/camping, explicit old 2-arg call resolves 3-arg function DEFAULT safely");
  // Always check forced failure AFTER first successful merchant's DELETE +
  // INSERT as proof the entire multi-merchant and settings toggle roll back.
  const beforeStock=ids.map(id=>JSON.stringify(shelf(id)));
  const settingBefore=sql("SELECT future_tech_enabled::text FROM public.campaign_item_pool_settings WHERE id=1");
  const injectedSecond=ids[1];
  sql(`CREATE FUNCTION private.c34_b10_force_second_insert_v1() RETURNS trigger
    LANGUAGE plpgsql SET search_path TO pg_catalog,public,private AS $$
    BEGIN
      IF NEW.character_id='${injectedSecond}'::uuid AND NEW.note LIKE 'auto_reroll:%' THEN
        RAISE EXCEPTION 'B10 injected SECOND merchant failure' USING ERRCODE='P0001';
      END IF;
      RETURN NEW;
    END $$`);
  sql("CREATE TRIGGER c34_b10_bulk_fail_second BEFORE INSERT ON public.character_stock FOR EACH ROW EXECUTE FUNCTION private.c34_b10_force_second_insert_v1()");
  try{
   const unsuccessful=await bulk(actors.DM,false);
   deny(unsuccessful,"P0001","failure on second merchant bulk");
   assert.match(unsuccessful.error.message,/B10 injected SECOND/);
   assert.equal(sql("SELECT future_tech_enabled::text FROM public.campaign_item_pool_settings WHERE id=1"),settingBefore);
   for(let i=0;i<ids.length;i++)assert.equal(JSON.stringify(shelf(ids[i])),beforeStock[i],
     "B10 mass failure partially replaced merchant "+i);
   assert.equal(walletOf(buyer.id),walletBeforeRace);
   assert.equal(Number(invCount(buyer.id)),itemsBeforeRace);
   console.log("PASS T46-C2B10-BULK-ROLLBACK: failed second signed DM merchant reroll rolls back first merchant shelf AND global future-tech flag, exact old UUID/qty/revision, zero buyer side effects");
  }finally{
   sql("DROP TRIGGER IF EXISTS c34_b10_bulk_fail_second ON public.character_stock");
   sql("DROP FUNCTION IF EXISTS private.c34_b10_force_second_insert_v1()");
  }
  // Full requested-role triad: admin and DM perform explicit successful
  // toggles too (GM positive already passed).
  const dmEnabled=await bulk(actors.DM,false);
  assert.ifError(dmEnabled.error);assert.equal(dmEnabled.data[0].rerolled_merchants,2);
  const adminEnabled=await bulk(admin,true);
  assert.ifError(adminEnabled.error);assert.equal(adminEnabled.data[0].rerolled_merchants,2);
  assert.equal(sql("SELECT private.item_campaign_loot_eligible_v1('Laser Rifle','XPHB','Adventuring Gear','Rare',10,'{}'::jsonb,false)::text"),"false");
  assert.equal(sql("SELECT private.item_campaign_loot_eligible_v1('Laser Rifle','XPHB','Adventuring Gear','Rare',10,'{}'::jsonb,true)::text"),"true");
  console.log("PASS T46-C2B10-BULK-TRIAD: genuinely signed admin/gm/dm source-preserving global toggle with future-tech eligibility and source-default 2-arg compatibility");
 }finally{
  sql("UPDATE public.characters SET storefront_enabled=false WHERE storefront_enabled IS TRUE");
  if(originalEnabled.length)sql("UPDATE public.characters SET storefront_enabled=true WHERE id IN ("+originalEnabled.map(q).join(",")+")");
  sql("UPDATE public.campaign_item_pool_settings SET future_tech_enabled="+initialSetting+" WHERE id=1");
 }
 assert.equal(sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))"),originalBuyer);
 assert.equal(sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)'::regprocedure))"),b8Original);
 assert.equal(sql("SELECT md5(pg_get_functiondef('public.reroll_merchant_inventory_v2(uuid,text,integer)'::regprocedure))"),b9Original);
 console.log("PASS T46-C2B10-SIGNED-RESEARCH: signed atomic add/remove/dump, buyer/delta race, source-default reroll, full future-tech bulk role/rollback; original buyer+B8+B9 unchanged, hosted permissions still unverified");
}
