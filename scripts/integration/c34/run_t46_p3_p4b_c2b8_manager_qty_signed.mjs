// C34 T46-P3-P4B-C2-B8. Candidate manager stock operations only in
// disposable signed PostgreSQL17/GoTrue/PostgREST; NOT a production feature.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto,{randomUUID} from "node:crypto";
import {spawn,spawnSync} from "node:child_process";

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const gitBlob=data=>crypto.createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+data.length+"\0"),data])).digest("hex");
const waitFor=(p,what,ms=20000)=>Promise.race([
 p,new Promise((_,reject)=>setTimeout(()=>reject(Error("B8 timeout "+what)),ms))
]);
class HeldTransaction {
 constructor(env){
  this.process=spawn("psql",["-X","-qAt","-v","ON_ERROR_STOP=1"],{
   env,stdio:["pipe","pipe","pipe"]});
  this.stdout="";this.stderr="";this.waits=new Map();this.failure=null;
  this.process.stdin.on("error",()=>{});
  this.process.stdout.on("data",bytes=>{
   this.stdout+=bytes.toString();
   let i;
   while((i=this.stdout.indexOf("\n"))>=0){
    const line=this.stdout.slice(0,i).trim();
    this.stdout=this.stdout.slice(i+1);
    if(this.waits.has(line)){
     const settle=this.waits.get(line);this.waits.delete(line);settle();
    }
   }
  });
  this.process.stderr.on("data",bytes=>{this.stderr=(this.stderr+bytes.toString()).slice(-5000)});
  this.process.on("error",error=>this.fail(error));
  this.process.on("exit",code=>this.fail(Error("B8 transaction exited "+code+": "+this.stderr)));
 }
 fail(error){
  this.failure=error;
  for(const [,reject] of this.waits)reject(error);
  this.waits.clear();
 }
 async run(statement){
  if(this.failure)throw this.failure;
  const marker="B8_MARK_"+randomUUID().replaceAll("-","");
  const promise=new Promise((resolve,reject)=>this.waits.set(marker,(e)=>e?reject(e):resolve()));
  this.process.stdin.write(statement+"\nSELECT '"+marker+"';\n");
  return waitFor(promise,marker,12000);
 }
 async close(){
  if(!this.failure)try{await this.run("ROLLBACK;")}catch{}
  if(this.process.exitCode===null)try{this.process.kill("SIGTERM")}catch{}
  await pause(100);
 }
}

export async function runT46C2B8ManagerQuantity({
 env,root,actors,newActor,merchantId,sql,q,lit,walletOf,invCount
}){
 for(const [key,value] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"
 }))assert.equal(env[key],value,"B8 refuses hosted or non-disposable env "+key);
 const file=path.join(root,"scripts/integration/c34/candidates/t46_p3_p4b_c2b8_manager_quantity_pg17.sql");
 const bytes=fs.readFileSync(file);
 assert.ok(bytes.toString().includes("C34 T46-P3-P4B-C2-B8"));
 assert.ok(!bytes.toString().includes("CREATE OR REPLACE FUNCTION public.buy_from_merchant"));
 assert.equal(sql("SELECT to_regprocedure('public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)') IS NULL"),"t");
 const buyerDefinition=sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))");
 const originalStockPanel=fs.readFileSync(path.join(root,"components/MerchantPanel.js"));
 // The parent B2-B5 suite deliberately overlays the merchant panel in memory,
 // so compare only the pinned original bytes in the parent, never this overlay.
 assert.match(originalStockPanel.toString(),/async function incQty\(stockId, by = 1\)/);
 assert.equal(sql("SELECT current_setting('server_version_num')::integer BETWEEN 170000 AND 179999"),"t");
 const install=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-f",file],{
  cwd:root,env,encoding:"utf8",timeout:30000});
 assert.equal(install.status,0,"B8 candidate install failed: "+String(install.stderr).slice(-2500));
 const sig="'public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)'";
 assert.equal(sql("SELECT has_function_privilege('anon',"+sig+",'EXECUTE')"),"f");
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+sig+",'EXECUTE')"),"t");
 assert.equal(sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))"),buyerDefinition);
 assert.match(sql("SELECT pg_get_functiondef("+sig+"::regprocedure)"),/FOR SHARE/i);
 assert.match(sql("SELECT pg_get_functiondef("+sig+"::regprocedure)"),/FOR UPDATE/i);

 const [admin,gm,outsider]=await Promise.all([
  newActor("B8_ADMIN","admin"),newActor("B8_GM","gm"),newActor("B8_PLAYER","player")
 ]);
 const managerRoles=[admin,gm,actors.DM];
 const invoke=(actor,id,mode,value,expectedQty=null,expectedUpdatedAt=null)=>actor.who.rpc(
  "c34_t46_manage_stock_qty_v1",{
   p_stock_id:id,p_mode:mode,p_value:value,
   p_expected_qty:expectedQty,p_expected_updated_at:expectedUpdatedAt
  });
 const shelf=(id)=>JSON.parse(sql("SELECT row_to_json(t)::text FROM ("+
  "SELECT qty,updated_at FROM public.character_stock WHERE id="+q(id)+") t"));
 const stockQty=id=>sql("SELECT COALESCE((SELECT qty::text FROM public.character_stock WHERE id="+q(id)+"),'gone')");
 const add=(name,qty,price=3,payload={item_type:"Potion",item_rarity:"Common"})=>{
  const id=randomUUID();
  sql("INSERT INTO public.character_stock(id,character_id,item_id,display_name,price_gp,qty,card_payload) VALUES("+
    q(id)+","+q(merchantId)+","+lit("c2b8-"+name)+","+lit("T46 B8 "+name)+
    ","+price+","+qty+","+lit(JSON.stringify(payload))+"::jsonb)");
  return id;
 };
 const denied=(reply,code,context)=>{
  assert.ok(reply.error,context+" expected failure "+JSON.stringify(reply));
  assert.equal(reply.error.code,code,context+": "+JSON.stringify(reply.error));
 };
 const isolated=add("ROLE CONTRACT",3);
 const pre=shelf(isolated);
 for(const actor of [outsider,actors.OUTSIDER]){
  denied(await invoke(actor,isolated,"delta",2),"42501","player role");
 }
 denied(await invoke({who:actors.OUTSIDER.who},isolated,"set",5,3,pre.updated_at),"42501","player set");
 denied(await invoke({who:{rpc:(...a)=>actors.OUTSIDER.who.rpc(...a)}},isolated,"delta",1),"42501","unprivileged");
 assert.equal(stockQty(isolated),"3");
 // The ordinary direct UPDATE path remains protected. A signed player cannot
 // bypass the RPC even when knowing the stock UUID.
 const direct=await outsider.who.from("character_stock").update({qty:999})
  .eq("id",isolated).select("id,qty");
 assert.ok(direct.error||!direct.data?.length,"B8 nonmanager direct REST UPDATE was unexpectedly allowed");
 assert.equal(stockQty(isolated),"3");
 console.log("PASS T46-C2B8-ACL: signed player denied 42501, anon no EXECUTE, raw stock PATCH denied, no mutation");
 for(const [i,actor] of managerRoles.entries()){
  const ret=await invoke(actor,isolated,"delta",i+1);
  assert.ifError(ret.error);assert.equal(Number(ret.data),3+(i+1)*(i+2)/2);
 }
 assert.equal(stockQty(isolated),"9");
 console.log("PASS T46-C2B8-MANAGERS: genuinely signed admin, gm and dm each update same shelf via atomic relative delta");
 let snap=shelf(isolated);
 let set=await invoke(gm,isolated,"set",12,snap.qty,snap.updated_at);
 assert.ifError(set.error);assert.equal(Number(set.data),12);
 const stale=await invoke(admin,isolated,"set",40,snap.qty,snap.updated_at);
 denied(stale,"40001","stale CAS");
 assert.equal(stockQty(isolated),"12");
 snap=shelf(isolated);
 assert.notEqual(snap.updated_at,pre.updated_at);
 const staleAt=await invoke(admin,isolated,"set",25,snap.qty,pre.updated_at);
 denied(staleAt,"40001","CAS revision changed despite equal count");
 set=await invoke(admin,isolated,"set",8,snap.qty,snap.updated_at);
 assert.ifError(set.error);assert.equal(Number(set.data),8);
 assert.equal(stockQty(isolated),"8");
 console.log("PASS T46-C2B8-CAS: absolute set requires qty + updated_at, stale CAS fails 40001; fresh set commits");

 for(const [mode,value,expected,stamp,code] of [
  ["delta",0,null,null,"22023"],["delta",-9,null,null,"22023"],
  ["delta",2147483647,null,null,"22003"],["bad",5,null,null,"22023"],
  ["set",-1,8,shelf(isolated).updated_at,"22023"],
  ["set",1,null,null,"22023"],
  ["set",1,8,null,"22023"],
  ["delta",1,8,shelf(isolated).updated_at,"22023"]
 ]){
  denied(await invoke(admin,isolated,mode,value,expected,stamp),code,"bad qty "+mode+"/"+value);
  assert.equal(stockQty(isolated),"8","Invalid operation mutated stock");
 }
 let zero=await invoke(gm,isolated,"delta",-8);
 assert.ifError(zero.error);assert.equal(Number(zero.data),0);
 assert.equal(stockQty(isolated),"0","Zero-stock row must stay for GM restock");
 denied(await invoke(gm,isolated,"delta",-1),"22023","zero underflow");
 snap=shelf(isolated);
 set=await invoke(gm,isolated,"set",2,snap.qty,snap.updated_at);
 assert.ifError(set.error);assert.equal(Number(set.data),2);
 const deletion=add("REMOVED",1);
 sql("DELETE FROM public.character_stock WHERE id="+q(deletion));
 denied(await invoke(gm,deletion,"delta",1),"P0002","deleted row must not resurrect");
 denied(await invoke(gm,deletion,"set",3,1,new Date().toISOString()),"P0002","CAS on deleted row");
 assert.equal(stockQty(deletion),"gone");
 const npc=randomUUID(),npcStock=randomUUID();
 sql("INSERT INTO public.characters(id,name,kind,is_hidden,storefront_enabled,state) VALUES("+
  q(npc)+",'B8 Unsupported NPC','npc',false,true,'resting')");
 sql("INSERT INTO public.character_stock(id,character_id,item_id,display_name,price_gp,qty,card_payload) VALUES("+
  q(npcStock)+","+q(npc)+",'b8-npc','Not merchant',2,4,'{}'::jsonb)");
 denied(await invoke(admin,npcStock,"delta",1),"42501","NPC is not eligible merchant stock");
 assert.equal(stockQty(npcStock),"4");
 console.log("PASS T46-C2B8-BOUNDS: negative/overflow/zero/removed/nonmerchant and invalid-mode fail atomically; exhausted zero retained for restock");

 // Race scenario 1: a signed manager increment and signed buyer both queue
 // behind a privileged stock-row lock; either serialization must balance
 // initial two -> buyer -1 + manager +1 = exactly two.
 const race=add("BUYER VS MANAGER",2,5);
 const shopper=await newActor("B8_BUYER","player");
 sql("INSERT INTO public.player_wallets(user_id,gp) VALUES ("+q(shopper.id)+",25)");
 const walletStart=walletOf(shopper.id),invStart=Number(invCount(shopper.id));
 let txn=new HeldTransaction(env);
 try{
  await txn.run("BEGIN; SELECT id FROM public.character_stock WHERE id="+q(race)+" FOR UPDATE;");
  let settled=0;
  const buy=Promise.resolve(shopper.who.rpc("buy_from_merchant",{
   p_merchant_id:merchantId,p_stock_uuid:race,p_qty:1
  })).finally(()=>settled++);
  const mgr=Promise.resolve(invoke(admin,race,"delta",1)).finally(()=>settled++);
  await pause(240);
  assert.equal(settled,0,"buyer or manager bypassed stock row lock");
  await txn.run("COMMIT;");
  const [purchase,managed]=await waitFor(Promise.all([buy,mgr]),"manager+buyer race");
  assert.ifError(purchase.error);assert.equal(Number(purchase.data),1);
  assert.ifError(managed.error);
  assert.equal(stockQty(race),"2");
  assert.equal(walletOf(shopper.id),String(Number(walletStart)-5));
  assert.equal(Number(invCount(shopper.id)),invStart+1);
  console.log("PASS T46-C2B8-RACE: signed original guarded buyer and signed admin delta serialize on stock, exact final stock2, 5GP debit, one item");
 }finally{await txn.close()}

 // Fresh signed CAS snapshot becomes obsolete once original purchase commits;
 // a stale absolute set may never restore/overwrite sold units.
 const conflict=add("PURCHASE INVALIDATES CAS",3,4);
 const old=shelf(conflict),wBefore=walletOf(shopper.id),iBefore=Number(invCount(shopper.id));
 const sold=await shopper.who.rpc("buy_from_merchant",{
  p_merchant_id:merchantId,p_stock_uuid:conflict,p_qty:1
 });
 assert.ifError(sold.error);assert.equal(Number(sold.data),1);
 denied(await invoke(actors.DM,conflict,"set",6,old.qty,old.updated_at),"40001","buyer invalidates CAS");
 assert.equal(stockQty(conflict),"2");
 assert.equal(walletOf(shopper.id),String(Number(wBefore)-4));
 assert.equal(Number(invCount(shopper.id)),iBefore+1);
 console.log("PASS T46-C2B8-BUYER-CAS: original signed purchase invalidates manager stale set; no overwritten sale");
 assert.equal(sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))"),buyerDefinition);
 console.log("PASS T46-C2B8-SIGNED-RESEARCH: genuine role and serialization acceptance in disposable PG17; original buyer/recipes/infinite-GP inherited B2-B7, hosted reroll still unverified");
}
