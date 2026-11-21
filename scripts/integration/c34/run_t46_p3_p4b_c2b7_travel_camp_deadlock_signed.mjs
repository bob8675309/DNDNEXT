// C34 T46-P3-P4B-C2-B7: owner-approved MOVING + CAMPING sales and
// source-actual merchant reroll/lock-order study. DISPOSABLE local PG17 ONLY.
// No hosted SQL, released migration, gameplay import, map or role changes.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {randomUUID,createHash} from "node:crypto";
import {spawn} from "node:child_process";

const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const gitBlob=b=>createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
const bounded=(p,name,ms=22000)=>Promise.race([
 p,new Promise((_,reject)=>setTimeout(()=>reject(Error("B7 bounded wait: "+name)),ms))
]);
const qty=(sql,q,id)=>sql("SELECT COALESCE((SELECT qty::text FROM public.character_stock WHERE id="+q(id)+"),'gone')");
const inventoryByStock=(sql,q,lit,actor,stock)=>Number(sql(
 "SELECT count(*) FROM public.inventory_items WHERE user_id="+q(actor)+
 " AND card_payload->>'stock_id'="+lit(stock)));

class LocalDeadlockSession {
 constructor(env){
  this.proc=spawn("psql",["-X","-qAt","-v","ON_ERROR_STOP=1"],{
   env,stdio:["pipe","pipe","pipe"]});
  this.output="";this.stderr="";this.waiting=new Map();this.seq=0;
  this.exited=null;
  this.proc.stdin.on("error",()=>{}); // deadlock victim closes pipe itself
  this.proc.stdout.on("data",bytes=>{
   this.output+=bytes.toString();
   let pos;
   while((pos=this.output.indexOf("\n"))!==-1){
    const line=this.output.slice(0,pos).trim();
    this.output=this.output.slice(pos+1);
    if(this.waiting.has(line)){
     const settle=this.waiting.get(line);this.waiting.delete(line);settle();
    }
   }
  });
  this.proc.stderr.on("data",bytes=>{this.stderr=(this.stderr+bytes.toString()).slice(-5000)});
  this.proc.on("error",err=>this.fail(err));
  this.proc.on("exit",code=>this.fail(Error("B7 psql session exited "+code+": "+this.stderr)));
 }
 fail(error){
  this.exited=error;
  for(const [,settle] of this.waiting)settle(error);
  this.waiting.clear();
 }
 async send(statement){
  assert.ok(!this.exited,"B7 deadlock session exited: "+this.stderr);
  const marker="B7_DONE_"+(++this.seq)+"_"+randomUUID().replaceAll("-","");
  const wait=new Promise((resolve,reject)=>this.waiting.set(marker,e=>e?reject(e):resolve()));
  this.proc.stdin.write(statement+"\nSELECT '"+marker+"';\n");
  return bounded(wait,marker,16000);
 }
 async close(){
  if(!this.exited)try{await this.send("ROLLBACK;")}catch{}
  if(this.proc.exitCode===null)try{this.proc.kill("SIGTERM")}catch{}
  await sleep(100);
 }
}
export async function runT46C2B7MerchantTravelLocks({
 env,root,actors,newActor,merchantId,townId,sql,q,lit,walletOf,invCount
}){
 for(const [k,v] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGDATABASE:"postgres",DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"
 }))assert.equal(env[k],v,"B7 refuses hosted/non-disposable environment: "+k);
 assert.equal(walletOf(actors.OUTSIDER.id),"12",
  "B7 must preserve original B5 signed user balance");
 assert.equal(sql("SELECT pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure) ILIKE '%Merchant unavailable%'"),"t");
 // Source lineage: repository has a COMPLETE October 16 candidate reroll,
 // unlike old docs/Cron INFO important.txt's explicitly omitted body.
 // It is a SOURCE candidate; do not imply production pg_get_functiondef parity.
 const rerollBytes=fs.readFileSync(path.join(root,
  "sql/20261016_01_campaign_item_pool_final_constraints.sql"));
 assert.equal(gitBlob(rerollBytes),"c804ccd4ea3c1746ad114daa18af8f173bf02128");
 const reroll=rerollBytes.toString();
 const start=reroll.indexOf("CREATE OR REPLACE FUNCTION public.reroll_merchant_inventory_v2(");
 const end=reroll.indexOf("\nEND\n$$;",start);
 assert.ok(start>=0&&end>start,"B7 Oct16 reroll source cut changed");
 const fn=reroll.slice(start,end);
 const del=fn.indexOf("DELETE FROM public.character_stock WHERE character_id=p_merchant_id;");
 const insert=fn.indexOf("INSERT INTO public.character_stock(character_id,display_name,price_gp,qty,card_payload,item_id,note)");
 assert.ok(del>0&&insert>del,"Reroll source DELETE then INSERT changed");
 assert.match(fn,/up\.role='admin'/);
 assert.ok(!/\bFOR (?:UPDATE|SHARE)\b/i.test(fn),
  "Reroll source added explicit lock, re-review guard order");
 const buyerBytes=fs.readFileSync(path.join(root,
  "scripts/fixtures/forge_original_merchant_buy_source_pg17.sql"));
 assert.equal(gitBlob(buyerBytes),"72fd9f0f80a83adaec67caf80a762e238f1dcd8c");
 assert.match(sql("SELECT pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure)"),
  /FOR SHARE/i,"Guarded signed buyer no longer locks seller first");
 console.log("PASS T46-C2B7-REROLL-SOURCE: pinned Oct16 repository full reroll does one function-call DELETE→INSERT, no explicit seller lock, source admin-only gate; hosted routine/version/role parity NOT VERIFIED; frontend fallback remains non-atomic separate requests");

 const before=JSON.parse(sql("SELECT row_to_json(t)::text FROM ("+
  "SELECT state::text AS state,location_id,home_location_id,is_hidden,storefront_enabled "+
  "FROM public.characters WHERE id="+q(merchantId)+") t"));
 assert.equal(before.is_hidden,false);assert.equal(before.storefront_enabled,true);
 const traveller=await newActor("B7_TRAVEL_CAMP_BUYER","player");
 sql("INSERT INTO public.player_wallets(user_id,gp) VALUES ("+q(traveller.id)+",40)");
 const buyer=traveller.who;
 const addStock=(name,price,n)=>{const id=randomUUID();
  sql("INSERT INTO public.character_stock(id,character_id,item_id,display_name,price_gp,qty,card_payload) VALUES ("+
   q(id)+","+q(merchantId)+","+lit("c2b7-"+name)+","+lit("T46 C2B7 "+name)+
   ","+price+","+n+","+lit(JSON.stringify({item_type:"Potion",item_rarity:"Common"}))+"::jsonb)");
  return id;};
 const buy=stock=>buyer.rpc("buy_from_merchant",{
  p_merchant_id:merchantId,p_stock_uuid:stock,p_qty:1
 });
 const stockTravel=addStock("Moving",5,2);
 const stockCamp=addStock("Camping",5,2);
 const town=()=>buyer.rpc("c34_t46_get_town_presence_v1",{p_location_id:townId});
 const ensureNotTown=async state=>{
  const response=await town();assert.ifError(response.error);
  assert.ok(!response.data.roster.some(x=>x.id===merchantId),
   "B7 "+state+" merchant leaked into In Town roster");
  assert.ok(!response.data.presentMerchants.some(x=>x.id===merchantId),
   "B7 "+state+" merchant displayed as physically present in Bazaar");
 };
 let originalRestored=false;
 try{
  // A moving merchant is NOT in a town and remains able to trade using the
  // original signed buyer function plus B2 server-side seller eligibility.
  sql("UPDATE public.characters SET state='moving',location_id=NULL WHERE id="+q(merchantId));
  assert.equal(sql("SELECT state::text FROM public.characters WHERE id="+q(merchantId)),"moving");
  await ensureNotTown("moving");
  const startInv=Number(invCount(traveller.id));
  const moved=await buy(stockTravel);assert.ifError(moved.error);
  assert.equal(Number(moved.data),1);
  assert.equal(walletOf(traveller.id),"35");
  assert.equal(qty(sql,q,stockTravel),"1");
  assert.equal(Number(invCount(traveller.id)),startInv+1);
  assert.equal(inventoryByStock(sql,q,lit,traveller.id,stockTravel),1);
  assert.equal(sql("SELECT state::text FROM public.characters WHERE id="+q(merchantId)),"moving");
  console.log("PASS T46-C2B7-MOVING-SIGNED: real signed moving merchant without town location completes 5-GP/one stock/one inventory; seller stays moving, not town rostered");

  // A merchant camping mid-route must continue selling; camp state is not a
  // license to move, depart, expose hidden stock or alter location membership.
  sql("UPDATE public.characters SET state='camping',location_id=NULL WHERE id="+q(merchantId));
  assert.equal(sql("SELECT state::text FROM public.characters WHERE id="+q(merchantId)),"camping");
  await ensureNotTown("camping");
  const campInv=Number(invCount(traveller.id));
  const camp=await buy(stockCamp);assert.ifError(camp.error);
  assert.equal(Number(camp.data),1);
  assert.equal(walletOf(traveller.id),"30");
  assert.equal(qty(sql,q,stockCamp),"1");
  assert.equal(Number(invCount(traveller.id)),campInv+1);
  assert.equal(inventoryByStock(sql,q,lit,traveller.id,stockCamp),1);
  assert.equal(sql("SELECT state::text FROM public.characters WHERE id="+q(merchantId)),"camping");
  console.log("PASS T46-C2B7-CAMPING-SIGNED: genuine signed campsite sale 5 GP/one item; camping state retained, merchant stays off In Town roster");

  for(const [col,val] of [["is_hidden",true],["storefront_enabled",false]]){
   sql("UPDATE public.characters SET "+col+"=true WHERE id="+q(merchantId));
   if(col==="storefront_enabled"){
    sql("UPDATE public.characters SET storefront_enabled=false WHERE id="+q(merchantId));
   }
   const priorGP=walletOf(traveller.id),priorQty=qty(sql,q,stockCamp);
   const priorInv=invCount(traveller.id);
   const denied=await buy(stockCamp);
   assert.equal(denied.error?.code,"42501",
    "B7 camping merchant "+col+" denial expected: "+JSON.stringify(denied));
   assert.match(denied.error?.message||"",/Merchant unavailable/i);
   assert.equal(walletOf(traveller.id),priorGP);
   assert.equal(qty(sql,q,stockCamp),priorQty);
   assert.equal(invCount(traveller.id),priorInv);
   sql("UPDATE public.characters SET "+col+"=false WHERE id="+q(merchantId));
  }
  // Restore the original storefront-enabled state after the two tests.
  sql("UPDATE public.characters SET storefront_enabled=true WHERE id="+q(merchantId));
  console.log("PASS T46-C2B7-CAMPING-NEGATIVE: hidden seller and disabled storefront each return 42501 even while camping; no wallet/stock/inventory mutation");
 }finally{
  const where=q(merchantId),place=before.location_id===null?"NULL":String(before.location_id);
  const home=before.home_location_id===null?"NULL":String(before.home_location_id);
  sql("UPDATE public.characters SET state="+lit(before.state)+",location_id="+place+
   ",home_location_id="+home+",is_hidden="+(before.is_hidden?"true":"false")+
   ",storefront_enabled="+(before.storefront_enabled?"true":"false")+" WHERE id="+where);
  originalRestored=true;
 }
 assert.ok(originalRestored);
 assert.equal(sql("SELECT state::text FROM public.characters WHERE id="+q(merchantId)),before.state);

 // A reversed COMPOSITE manager transaction is an unapproved hypothetical,
 // not proof that deployed reroll has such a seller UPDATE. It can deadlock
 // with the B2 guarded buyer's seller-share->stock-update lock order.
 const raceStock=addStock("Deadlock Model",5,1);
 let admin=new LocalDeadlockSession(env);
 let buyerResult,managerOutcome;
 const preWallet=walletOf(traveller.id),preInv=invCount(traveller.id);
 try{
  await admin.send("BEGIN; SET LOCAL lock_timeout='12000ms'; "+
   "SELECT id FROM public.character_stock WHERE id="+q(raceStock)+" FOR UPDATE;");
  let completed=false;
  const pending=Promise.resolve(buy(raceStock)).then(result=>{completed=true;return result;});
  let observedLock=false;
  for(let i=0;i<32;i++){
   await sleep(110);
   if(completed)break;
   const blockers=Number(sql("SELECT count(*) FROM pg_stat_activity "+
    "WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' "+
    "AND query ILIKE '%buy_from_merchant%'"));
   if(blockers>0){observedLock=true;break;}
  }
  assert.ok(observedLock&&!completed,
   "B7 unable to establish source-original buyer awaiting locked stock before reverse manager step");
  const managerWait=admin.send("UPDATE public.characters SET updated_at=now() WHERE id="+q(merchantId)+";");
  [managerOutcome,buyerResult]=await bounded(
   Promise.all([Promise.resolve(managerWait).then(()=>({ok:true}),error=>({ok:false,error:String(error)})),pending]),
   "reversed stock-then-seller transaction deadlock",16000
  );
  const managerDeadlock=!managerOutcome.ok&&/deadlock detected/i.test(managerOutcome.error);
  const buyerDeadlock=buyerResult?.error?.code==="40P01";
  assert.ok(managerDeadlock||buyerDeadlock,
   "B7 expected a PostgreSQL deadlock victim when composite stock→seller meets buyer seller→stock: "+JSON.stringify({managerOutcome,buyerResult}));
  assert.ok(!(managerDeadlock&&buyerDeadlock),"B7 both deadlock victims unexpected");
  console.log("EXPECTED MODEL T46-C2B7-REVERSED-LOCK-DEADLOCK: synthetic privileged stock→seller composite deadlocks against signed guarded seller→stock buyer; victim "+
   (managerDeadlock?"manager transaction":"signed buyer")+"; this is NOT verified existing hosted reroll behavior");
 }finally{await admin.close()}
 // Verify rollback of deadlock victim and no partial buyer debit/delivery.
 const success=!buyerResult?.error&&Number(buyerResult?.data)===1;
 assert.equal(walletOf(traveller.id),String(Number(preWallet)-(success?5:0)));
 assert.equal(qty(sql,q,raceStock),success?"gone":"1");
 assert.equal(Number(invCount(traveller.id)),Number(preInv)+(success?1:0));
 assert.equal(inventoryByStock(sql,q,lit,traveller.id,raceStock),success?1:0);
 assert.equal(sql("SELECT is_hidden::text FROM public.characters WHERE id="+q(merchantId)),"false");
 console.log("PASS T46-C2B7-DEADLOCK-ROLLBACK: PostgreSQL 40P01 victim rolls back; at most one committed signed sale with exact GP/stock/inventory, no partial results");

 // Safe RELATIVE SQL quantity update model (not an authorized production RPC).
 // Contrasts B6's real signed DM stale absolute PATCH (3→2→4 wrong).
 const deltaStock=addStock("Atomic Delta Model",3,2);
 const startWallet=walletOf(traveller.id),initialInv=invCount(traveller.id);
 const priorQty=qty(sql,q,deltaStock);
 assert.equal(priorQty,"2");
 const consumed=await buy(deltaStock);assert.ifError(consumed.error);
 assert.equal(Number(consumed.data),1);
 assert.equal(qty(sql,q,deltaStock),"1");
 const adjusted=sql("UPDATE public.character_stock SET qty=qty+1 WHERE id="+q(deltaStock)+
  " RETURNING qty::text");
 assert.equal(adjusted,"2",
  "B7 relative increment must apply to authoritative 1→2, not stale UI 2+1→3");
 assert.equal(walletOf(traveller.id),String(Number(startWallet)-3));
 assert.equal(Number(invCount(traveller.id)),Number(initialInv)+1);
 console.log("PASS T46-C2B7-RELATIVE-DELTA-MODEL: source-shaped scratch buyer qty2→1, server-side relative +1 restores 2 (not stale absolute 3); privileged psql MODEL, not signed manager RPC or deployment");

 console.log("PASS T46-C2B7-SIGNED-RESEARCH: owner moving+camping sales, hidden/disabled negatives, current repository full reroll-source provenance, opposite-lock-order deadlock model and atomic-delta model; all disposable only");
}
