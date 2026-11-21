// T46-P3-P4B-C2-B6: signed source-original guarded buyer / manager stock
// concurrency research against DISPOSABLE local PostgreSQL17/GoTrue/PostgREST.
// Original buyer B2 remains authoritative. NO hosted SQL or gameplay imports.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const blob=data=>crypto.createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+data.length+"\0"),data])).digest("hex");
const bounded=(promise,label,ms=24000)=>Promise.race([
 promise,new Promise((_,reject)=>setTimeout(()=>reject(Error("B6 bounded timeout: "+label)),ms))
]);
class LocalPgTransaction{
 constructor(env){
  assert.equal(env.GITHUB_ACTIONS,"true");
  assert.equal(env.DNDNEXT_C34_LOCAL_CONFIRM,"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY");
  assert.equal(env.PGHOST,"127.0.0.1");
  assert.equal(env.PGPORT,"54322");
  this.proc=spawn("psql",["-X","-qAt","-v","ON_ERROR_STOP=1"],{
   env,stdio:["pipe","pipe","pipe"]
  });
  this.stderr="";this.stdout="";this.queue=new Map();this.seq=0;this.exitError=null;
  this.proc.stderr.on("data",bytes=>{
   this.stderr=(this.stderr+bytes.toString()).slice(-4000);
  });
  this.proc.stdout.on("data",bytes=>{
   this.stdout+=bytes.toString();
   let end;
   while((end=this.stdout.indexOf("\n"))>=0){
    const line=this.stdout.slice(0,end).trim();this.stdout=this.stdout.slice(end+1);
    if(this.queue.has(line)){
     const resolve=this.queue.get(line);this.queue.delete(line);resolve();
    }
   }
  });
  this.proc.on("exit",(code)=>{
   this.exitError=Error("B6 local psql transaction exited "+code+": "+this.stderr);
   for(const [,resolve] of this.queue)resolve(this.exitError);
   this.queue.clear();
  });
 }
 async send(statement){
  assert.ok(!this.exitError,"psql child exited: "+this.stderr);
  const marker="B6_SESSION_DONE_"+(++this.seq)+"_"+randomUUID().replaceAll("-","");
  const wait=new Promise((resolve,reject)=>{
   this.queue.set(marker,(error)=>error?reject(error):resolve());
  });
  this.proc.stdin.write(statement+"\nSELECT '"+marker+"';\n");
  return bounded(wait,"psql serial "+marker);
 }
 async close(){
  try{
   if(!this.exitError)await this.send("ROLLBACK;");
  }catch{}
  this.proc.stdin.end("\\q\n");
  await sleep(90);
  if(this.proc.exitCode===null)try{this.proc.kill("SIGTERM")}catch{}
 }
}
const qtyOf=(sql,q,id)=>sql(
 "SELECT COALESCE((SELECT qty::text FROM public.character_stock WHERE id="+q(id)+"),'gone')");
const cardCount=(sql,q,lit,user,stock)=>Number(sql(
 "SELECT count(*) FROM public.inventory_items WHERE user_id="+q(user)+
 " AND card_payload->>'stock_id'="+lit(stock)));
async function expectSafeManagerMutation(sql,manager,buyer,q,stock){
 // Direct MerchantPanel.js's source-actual PATCH qty operation on scratch RLS.
 const before=qtyOf(sql,q,stock);
 const unauthorized=await buyer.from("character_stock").update({qty:99})
  .eq("id",stock).select("id,qty");
 assert.ok(unauthorized.error || !unauthorized.data?.length,
  "Signed nonmanager unexpectedly PATCHed source merchant stock under scratch ACL");
 assert.equal(qtyOf(sql,q,stock),before);
 const selected=await manager.from("character_stock").select("id,qty").eq("id",stock).single();
 assert.ifError(selected.error);
 return selected.data;
}
export async function runT46C2B6MerchantConcurrency({
 env,root,actors,newActor,merchantId,sql,q,lit,walletOf,invCount
}){
 for(const [key,value] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGDATABASE:"postgres",DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"
 }))assert.equal(env[key],value,"B6 refuses nonlocal environment "+key);
 assert.equal(walletOf(actors.OUTSIDER.id),"12","B6 requires B5 signed 15→12 state");
 const buyerSource=fs.readFileSync(path.join(root,
  "scripts/fixtures/forge_original_merchant_buy_source_pg17.sql"));
 const originalPanel=fs.readFileSync(path.join(root,"components/MerchantPanel.js"));
 const guard=fs.readFileSync(path.join(root,
  "scripts/integration/c34/candidates/t46_p3_p4b_c2b_merchant_eligibility_guard.mjs"));
 assert.equal(blob(buyerSource),"72fd9f0f80a83adaec67caf80a762e238f1dcd8c");
 assert.equal(blob(originalPanel),"22e4d0810603bc0322904573cb5fe0c14bad1f88");
 assert.equal(blob(guard),"bde3cb3bd79a20fa2777a902c8e091d591d56f28");
 const panel=originalPanel.toString(),buy=buyerSource.toString();
 assert.match(panel,/\.update\(\{ qty \}\)\s*\.eq\("id", stockId\)/,
  "Original manager update is not an absolute quantity PATCH");
 assert.match(panel,/\.delete\(\)\s*\.eq\("character_id", merchant.id\)/,
  "Original non-atomic dump/replacement source drift");
 assert.match(buy,/from public\.character_stock[\s\S]*?for update;/i);
 assert.match(buy,/from public\.player_wallets where user_id = buyer for update;/i);
 assert.equal(sql("SELECT pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure) ILIKE '%Merchant unavailable%'"),"t",
  "B6 guarded buyer was not installed");
 assert.equal(sql("SELECT pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure) ILIKE '%for share%'"),"t",
  "B6 merchant FOR SHARE visibility lock absent");
 assert.equal(sql("SELECT current_setting('server_version_num')::int BETWEEN 170000 AND 179999"),"t");
 const a=await newActor("B6_BUYER_A","player");
 const b=await newActor("B6_BUYER_B","player");
 sql("INSERT INTO public.player_wallets(user_id,gp) VALUES ("+
  q(a.id)+",20),("+q(b.id)+",20)");
 assert.equal(walletOf(a.id),"20");assert.equal(walletOf(b.id),"20");
 const newStock=(label,qty,price)=> {
  const id=randomUUID();
  sql("INSERT INTO public.character_stock(id,character_id,item_id,display_name,price_gp,qty,card_payload) VALUES ("+
   q(id)+","+q(merchantId)+",'c2b6-"+label+"',"+lit("T46 C2B6 "+label)+
   ","+price+","+qty+","+lit(JSON.stringify({item_type:"Potion",item_rarity:"Common"}))+"::jsonb)");
  return id;
 };
 const purchase=(actor,stock)=>actor.who.rpc("buy_from_merchant",{
  p_merchant_id:merchantId,p_stock_uuid:stock,p_qty:1
 });
 const walletA=()=>Number(walletOf(a.id)),walletB=()=>Number(walletOf(b.id));
 assert.equal(sql("SELECT is_hidden::text FROM public.characters WHERE id="+q(merchantId)),"false");
 assert.equal(sql("SELECT storefront_enabled::text FROM public.characters WHERE id="+q(merchantId)),"true");
 // S1: Two independently JWT-signed purchasers queue behind the same locked
 // one-unit shelf row; row FOR UPDATE must allow EXACTLY one debit/delivery.
 const raceStock=newStock("One Unit",1,5);
 let held=new LocalPgTransaction(env);
 try{
  await held.send("BEGIN; SELECT 1 FROM public.character_stock WHERE id="+q(raceStock)+" FOR UPDATE;");
  let settled=0;
  const reqA=purchase(a,raceStock).finally(()=>{settled++});
  const reqB=purchase(b,raceStock).finally(()=>{settled++});
  await sleep(280);
  assert.equal(settled,0,"Both real signed buyers must remain pending while shelf row locked");
  await held.send("COMMIT;");
  const [outA,outB]=await bounded(Promise.all([reqA,reqB]),"competing signed buyers",28000);
  const accepted=[outA,outB].filter(x=>!x.error&&Number(x.data)===1);
  const denied=[outA,outB].filter(x=>x.error);
  assert.equal(accepted.length,1,"Source row lock failed one-unit single-winner buyer: "+JSON.stringify([outA,outB]));
  assert.equal(denied.length,1,"Second original buyer was not rejected");
  assert.match(denied[0].error?.message||"",/Stock not found|Not enough stock/i);
  assert.equal(qtyOf(sql,q,raceStock),"gone");
  assert.equal(walletA()+walletB(),35,"Two buyers must only debit exactly 5 GP in total");
  assert.equal(cardCount(sql,q,lit,a.id,raceStock)+cardCount(sql,q,lit,b.id,raceStock),1,
   "Double-buy minted missing or duplicate inventory items");
  console.log("PASS T46-C2B6-ONE-UNIT-SIGNED: two real JWT buyers queued behind one stock FOR UPDATE, exactly one 5-GP debit/one inventory, other stock denial and shelf deletion");
 }finally{await held.close()}
 // S2: Source B2 seller FOR SHARE must revalidate a merchant whose admin
 // row update was ALREADY acquired before a buyer RPC reached this seller.
 const hiddenStock=newStock("Visibility Flip",1,4);
 held=new LocalPgTransaction(env);
 try{
  await held.send("BEGIN; UPDATE public.characters SET is_hidden=true WHERE id="+q(merchantId)+";");
  let settled=false;
  const pending=purchase(a,hiddenStock).finally(()=>{settled=true});
  await sleep(240);
  assert.equal(settled,false,"Buyer bypassed uncommitted merchant visibility update");
  await held.send("COMMIT;");
  const rejected=await bounded(pending,"buyer queued behind merchant hidden row");
  assert.equal(rejected.error?.code,"42501",
   "Buyer allowed visible→hidden merchant AFTER source eligibility lock: "+JSON.stringify(rejected));
  assert.match(rejected.error?.message||"",/Merchant unavailable/i);
  assert.equal(qtyOf(sql,q,hiddenStock),"1");
  assert.equal(cardCount(sql,q,lit,a.id,hiddenStock),0);
  console.log("PASS T46-C2B6-MERCHANT-HIDE-LOCK: signed buyer waits for earlier seller-row UPDATE, then 42501 hidden merchant; no stock or inventory mutation");
 }finally{
  await held.close();
  sql("UPDATE public.characters SET is_hidden=false WHERE id="+q(merchantId));
 }
 // Manager's actual MerchantPanel source issues independent REST PATCH with
 // ABSOLUTE pre-rendered quantity; test-only GM RLS enables exact same PATCH.
 // This fixture is NOT source-original hosted stock-management ACL.
 sql("GRANT UPDATE (qty) ON public.character_stock TO authenticated");
 sql("CREATE POLICY c34_c2b6_signed_manager_qty_proxy ON public.character_stock "+
  "FOR UPDATE TO authenticated USING (private.current_user_is_admin()) "+
  "WITH CHECK (private.current_user_is_admin())");
 sql("NOTIFY pgrst,'reload schema'");
 try{
  const deltaStock=newStock("Stale Manager Count",3,2);
  // RLS schema reload is asynchronous; use bounded real manager probing.
  let snapshot;
  for(let retry=0;retry<20;retry++){
   try{
    snapshot=await expectSafeManagerMutation(sql,actors.DM.who,b.who,q,deltaStock);
    break;
   }catch(err){
    if(retry===19)throw err;
    await sleep(250);
   }
  }
  assert.equal(snapshot.qty,3);
  const oldWallet=walletA(),oldInv=invCount(a.id);
  const accepted=await purchase(a,deltaStock);
  assert.ifError(accepted.error);assert.equal(Number(accepted.data),1);
  assert.equal(qtyOf(sql,q,deltaStock),"2");
  assert.equal(walletA(),oldWallet-2);
  assert.equal(Number(invCount(a.id)),Number(oldInv)+1);
  // Exact frontend incQty semantics from STALE snapshot: 3+1 = 4, although
  // proper +1 relative to now 2 should result in 3 (no absolute CAS guard).
  const patched=await actors.DM.who.from("character_stock").update({
   qty:snapshot.qty+1
  }).eq("id",deltaStock).select("id,qty");
  assert.ifError(patched.error);
  assert.equal(patched.data?.[0]?.qty,4,
   "Signed DM direct original-source PATCH failed in scoped local RLS proxy");
  assert.equal(qtyOf(sql,q,deltaStock),"4");
  assert.equal(cardCount(sql,q,lit,a.id,deltaStock),1);
  console.log("EXPECTED ORIGINAL T46-C2B6-STALE-QTY-RED: actual signed DM absolute PATCH reads 3, buyer decrements 3→2, stale +1 sets 4 not atomic 3; no wallet double debit. Scratch management RLS proxy ONLY, not live hosted permission proof");
 }finally{
  sql("DROP POLICY IF EXISTS c34_c2b6_signed_manager_qty_proxy ON public.character_stock");
  sql("REVOKE UPDATE (qty) ON public.character_stock FROM authenticated");
  sql("NOTIFY pgrst,'reload schema'");
 }
 // S4: Manager source's direct DELETE can win the same stock-row lock,
 // causing an already-started buyer to fail closed. This psql transaction
 // reproduces SQL delete/lock ordering, NOT a hosted signed manager ACL.
 const deleteStock=newStock("Pending Delete",1,3);
 held=new LocalPgTransaction(env);
 try{
  await held.send("BEGIN; DELETE FROM public.character_stock WHERE id="+q(deleteStock)+";");
  let settled=false;
  const pending=purchase(b,deleteStock).finally(()=>{settled=true});
  await sleep(240);
  assert.equal(settled,false,"Buyer bypassed uncommitted manager source-shape stock DELETE");
  const preWallet=walletB(),preInv=invCount(b.id);
  await held.send("COMMIT;");
  const denied=await bounded(pending,"buyer after committed source-shape DELETE");
  assert.match(denied.error?.message||"",/Stock not found/i);
  assert.equal(walletB(),preWallet);
  assert.equal(invCount(b.id),preInv);
  assert.equal(qtyOf(sql,q,deleteStock),"gone");
  console.log("PASS T46-C2B6-DELETE-FIRST: held source-shape merchant DELETE wins stock FOR UPDATE; signed buyer fails Stock not found, no debit/delivery (psql manager SQL, not hosted ACL)");
 }finally{await held.close()}
 assert.equal(sql("SELECT is_hidden::text FROM public.characters WHERE id="+q(merchantId)),"false");
 assert.equal(sql("SELECT storefront_enabled::text FROM public.characters WHERE id="+q(merchantId)),"true");
 assert.equal(sql("SELECT to_regprocedure('public.buy_from_merchant(uuid,uuid,integer)') IS NOT NULL"),"t");
 console.log("PASS T46-C2B6-SIGNED-RESEARCH: source-original B2 guard lock concurrency, no oversell, hidden seller serialization, stale UI quantity overwrite RED, source-shaped DELETE denial; roaming/camping state and composite stock→seller deadlock policy remain open, no hosted SQL");
}
