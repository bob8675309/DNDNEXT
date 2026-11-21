// C34 T46-P3-P4B-C2-B9: exact Oct16 reroll SOURCE, isolated dependency
// fixture, seller-first source-derived proposal, genuine signed manager/buyer
// contention, and disposable original MerchantPanel browser overlay.
// No hosted SQL, production code, protected world map, or release cutover.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import {randomUUID,createHash} from "node:crypto";
import {spawn} from "node:child_process";
import {sourceOriginalB9Reroll,buildB9LockedReroll,buildB9StockUiOverlay} from "./candidates/t46_p3_p4b_c2b9_reroll_source.mjs";

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const bounded=(p,msg,ms=28000)=>Promise.race([
 p,new Promise((_,reject)=>setTimeout(()=>reject(Error("B9 bounded: "+msg)),ms))
]);
class HeldStock {
 constructor(env){
  this.proc=spawn("psql",["-X","-qAt","-v","ON_ERROR_STOP=1"],{
   env,stdio:["pipe","pipe","pipe"]});
  this.buffer="";this.stderr="";this.waiting=new Map();this.dead=null;
  this.proc.stdin.on("error",()=>{});
  this.proc.stdout.on("data",bytes=>{
   this.buffer+=bytes.toString();
   let i;
   while((i=this.buffer.indexOf("\n"))>=0){
    const line=this.buffer.slice(0,i).trim();
    this.buffer=this.buffer.slice(i+1);
    if(this.waiting.has(line)){
     this.waiting.get(line)();this.waiting.delete(line);
    }
   }
  });
  this.proc.stderr.on("data",bytes=>this.stderr=(this.stderr+bytes.toString()).slice(-3000));
  this.proc.on("error",e=>{this.dead=e});
  this.proc.on("exit",code=>{this.dead=Error("B9 psql exit "+code+" "+this.stderr)});
 }
 async send(statement){
  assert.ifError(this.dead);
  const marker="B9_"+randomUUID().replaceAll("-","");
  const wait=new Promise(resolve=>this.waiting.set(marker,resolve));
  this.proc.stdin.write(statement+"\nSELECT '"+marker+"';\n");
  await bounded(wait,"psql held stock",20000);
  assert.ifError(this.dead);
 }
 async close(){
  if(!this.dead)try{await this.send("ROLLBACK;")}catch{}
  if(this.proc.exitCode===null)this.proc.kill("SIGTERM");
  await sleep(100);
 }
}
async function freePort(){
 return await new Promise((resolve,reject)=>{
  const sock=net.createServer();
  sock.once("error",reject);
  sock.listen(0,"127.0.0.1",()=>{
   const n=sock.address().port;sock.close(()=>resolve(n));
  });
 });
}
const fail=(result,code,label)=>{
 assert.ok(result.error,label+": expected denial but got "+JSON.stringify(result));
 assert.equal(result.error.code,code,label+": "+JSON.stringify(result.error));
};

export async function runT46C2B9RerollUiSigned({
 env,root,actors,newActor,merchantId,townId,browser,sql,q,lit,walletOf,invCount
}){
 for(const [k,v] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGDATABASE:"postgres",DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"
 }))assert.equal(env[k],v,"B9 refuses external environment "+k);
 assert.equal(sql("SELECT to_regprocedure('public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)') IS NOT NULL"),"t",
  "B9 must run after accepted B8 manager candidate");
 const originalSource=fs.readFileSync(path.join(root,"sql/20261016_01_campaign_item_pool_final_constraints.sql"));
 const {original,selectionHelpers}=sourceOriginalB9Reroll(originalSource);
 const candidate=buildB9LockedReroll(original);
 const originalBuyer=sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))");
 const originalManager=sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)'::regprocedure))");
 assert.equal(sql("SELECT to_regprocedure('public.reroll_merchant_inventory_v2(uuid,text,integer)') IS NULL"),"t",
  "Scratch reroll test requires fresh uninstalled source");

 // The ORIGINAL October 16 source's catalog-selection helpers are installed
 // byte-for-byte. Only the absent dependency and seed catalog are isolated
 // simplified fixtures; do not claim hosted item/rarity population parity.
 sql(`CREATE TABLE public.campaign_item_pool_settings (
   id smallint PRIMARY KEY, future_tech_enabled boolean NOT NULL DEFAULT false
  ); INSERT INTO public.campaign_item_pool_settings(id,future_tech_enabled) VALUES (1,false);`);
 sql(`CREATE TABLE public.items_catalog (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   item_key text, item_name text NOT NULL, item_type text,
   item_rarity text, price_gp numeric NOT NULL,
   payload jsonb NOT NULL DEFAULT '{}'::jsonb,
   merchant_tags text[] NOT NULL DEFAULT '{}'::text[]
 );`);
 sql(`INSERT INTO public.items_catalog(item_key,item_name,item_type,item_rarity,price_gp,payload,merchant_tags)
 SELECT 'b9-'||i,'B9 Catalog Item '||i,'Adventuring Gear',
        CASE WHEN i%4=0 THEN 'Very Rare' WHEN i%4=1 THEN 'Mundane'
             WHEN i%4=2 THEN 'Uncommon' ELSE 'Rare' END,
        3,jsonb_build_object('item_type','Adventuring Gear','source','XPHB'),
        ARRAY['general']::text[]
 FROM generate_series(1,64) AS i;`);
 sql(selectionHelpers);
 if(sql("SELECT to_regprocedure('private.merchant_alchemy_crafted_payload_v1(jsonb)') IS NULL")==="t"){
  sql(`CREATE FUNCTION private.merchant_alchemy_crafted_payload_v1(p_payload jsonb)
   RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO pg_catalog, public, private
   AS $$ SELECT coalesce(p_payload,'{}'::jsonb) $$;`);
 }
 const grant=`REVOKE ALL ON FUNCTION public.reroll_merchant_inventory_v2(uuid,text,integer) FROM PUBLIC, anon, authenticated;
 GRANT EXECUTE ON FUNCTION public.reroll_merchant_inventory_v2(uuid,text,integer) TO authenticated;
 NOTIFY pgrst, 'reload schema';`;
 sql(original);sql(grant);
 const [admin,gm,shopper]=await Promise.all([
  newActor("B9_ADMIN","admin"),newActor("B9_GM","gm"),newActor("B9_BUYER","player")
 ]);
 sql("INSERT INTO public.player_wallets(user_id,gp) VALUES ("+q(shopper.id)+",35)");
 const reroll=(actor,id,count=12)=>actor.who.rpc("reroll_merchant_inventory_v2",{
  p_merchant_id:id,p_theme:"general",p_count:count
 });
 const buy=(stock)=>shopper.who.rpc("buy_from_merchant",{
  p_merchant_id:rerollMerchant,p_stock_uuid:stock,p_qty:1
 });
 const rerollMerchant=randomUUID();
 sql("INSERT INTO public.characters(id,name,kind,is_hidden,storefront_enabled,state,location_id) VALUES("+
  q(rerollMerchant)+",'B9 Signed Source Merchant','merchant',false,true,'moving',NULL)");
 const directStock=(seller,id,qty=2,price=5)=>{
  sql("INSERT INTO public.character_stock(id,character_id,item_id,display_name,price_gp,qty,card_payload) VALUES("+
   q(id)+","+q(seller)+",'b9-manual','B9 Existing Manual Stock',"+price+","+qty+
   ",'{\"item_type\":\"Potion\",\"item_rarity\":\"Common\"}'::jsonb)");
 };
 const first=randomUUID();directStock(rerollMerchant,first);
 const stockRows=()=>Number(sql("SELECT count(*) FROM public.character_stock WHERE character_id="+q(rerollMerchant)));
 const stockQty=id=>sql("SELECT COALESCE((SELECT qty::text FROM public.character_stock WHERE id="+q(id)+"),'gone')");
 const olderGm=await reroll(gm,rerollMerchant);fail(olderGm,"P0001","original admin-only GM role");
 assert.match(olderGm.error.message,/Only admins/i);
 assert.equal(stockQty(first),"2");
 const origAdmin=await reroll(admin,rerollMerchant);
 assert.ifError(origAdmin.error);
 assert.equal(Number(origAdmin.data[0].inserted_count),12);
 assert.equal(stockRows(),12);
 assert.equal(stockQty(first),"gone");
 assert.equal(sql("SELECT is_hidden::text FROM public.characters WHERE id="+q(rerollMerchant)),"false");
 console.log("EXPECTED ORIGINAL T46-C2B9-GM-REROLL-RED: exact pinned Oct16 SQL allowed signed admin but denied genuine signed GM; original shelf replaced atomically from seeded catalog, not hosted source parity");

 // Candidate changes precisely the app manager role predicate and merchant
 // lock preface, while retaining the source-original item selection and
 // original DELETE/INSERT body byte-for-byte.
 sql(candidate);sql(grant);
 const nowSql=sql("SELECT pg_get_functiondef('public.reroll_merchant_inventory_v2(uuid,text,integer)'::regprocedure)");
 assert.match(nowSql,/FOR UPDATE/i);
 assert.match(nowSql,/role IN \('admin',\s*'gm',\s*'dm'\)/i);
 assert.ok(nowSql.indexOf("FOR UPDATE")<nowSql.indexOf("DELETE FROM public.character_stock"));
 assert.equal(sql("SELECT has_function_privilege('anon','public.reroll_merchant_inventory_v2(uuid,text,integer)','EXECUTE')"),"f");
 const gmResult=await reroll(gm,rerollMerchant);
 assert.ifError(gmResult.error);
 assert.equal(Number(gmResult.data[0].inserted_count),12);
 const dmResult=await reroll(actors.DM,rerollMerchant);
 assert.ifError(dmResult.error);
 assert.equal(Number(dmResult.data[0].inserted_count),12);
 const playerResult=await reroll(shopper,rerollMerchant);
 fail(playerResult,"42501","ordinary player reroll");
 assert.equal(stockRows(),12);
 // Original moving merchant is NOT recast as town resident after reroll.
 assert.equal(sql("SELECT state::text FROM public.characters WHERE id="+q(rerollMerchant)),"moving");
 assert.equal(sql("SELECT location_id IS NULL FROM public.characters WHERE id="+q(rerollMerchant)),"t");
 console.log("PASS T46-C2B9-REROLL-ROLES: full source-derived signed GM+DM/admin management, player 42501 and anon no execute, merchant stays moving, stock source selection preserved");

 // Simultaneous reroll and buyer on an old UUID: B9 locks merchant FOR UPDATE
 // before it can delete any shelf rows, buyer waits for seller FOR SHARE.
 const oldId=sql("SELECT id::text FROM public.character_stock WHERE character_id="+q(rerollMerchant)+" ORDER BY id LIMIT 1");
 let lock=new HeldStock(env),managerPending,buyerPending;
 const w0=walletOf(shopper.id),i0=Number(invCount(shopper.id));
 try{
  await lock.send("BEGIN; SELECT id FROM public.character_stock WHERE id="+q(oldId)+" FOR UPDATE;");
  let managerDone=false,buyerDone=false;
  managerPending=Promise.resolve(reroll(gm,rerollMerchant)).then(v=>{managerDone=true;return v});
  let blocked=false;
  for(let t=0;t<45;t++){
   await sleep(110);
   if(managerDone)break;
   if(Number(sql("SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() "+
    "AND wait_event_type='Lock' AND query ILIKE '%reroll_merchant_inventory_v2%'"))>0){
    blocked=true;break;
   }
  }
  assert.ok(blocked&&!managerDone,"B9 could not prove reroll acquired seller FIRST before stock wait");
  buyerPending=Promise.resolve(buy(oldId)).then(v=>{buyerDone=true;return v});
  await sleep(240);
  assert.equal(managerDone,false,"B9 manager evaded held stock row");
  assert.equal(buyerDone,false,"B9 buyer bypassed merchant exclusive lock");
  await lock.send("COMMIT;");
  const [updated,denied]=await bounded(Promise.all([managerPending,buyerPending]),"reroll+buyer",33000);
  assert.ifError(updated.error);
  assert.equal(Number(updated.data[0].inserted_count),12);
  assert.match(denied.error?.message||"",/Stock not found|Not enough stock/i);
  assert.equal(denied.error?.code==="40P01",false,"B9 reverse-order deadlock regression");
  assert.equal(stockQty(oldId),"gone");
  assert.equal(walletOf(shopper.id),w0);
  assert.equal(Number(invCount(shopper.id)),i0);
  assert.equal(stockRows(),12);
  console.log("PASS T46-C2B9-REROLL-BUYER-RACE: signed GM seller-exclusive-before-stock reroll serializes with signed original seller-share buyer; old UUID denied after replacement, no 40P01, 0GP/0inventory, exactly 12 new shelf rows");
 }finally{await lock.close()}

 // A signed B8 manager delta must not resurrect a source-deleted old stock.
 const deltaOld=await gm.who.rpc("c34_t46_manage_stock_qty_v1",{
  p_stock_id:oldId,p_mode:"delta",p_value:1,
  p_expected_qty:null,p_expected_updated_at:null
 });
 fail(deltaOld,"P0002","manager delta on rerolled deleted UUID");
 const newId=sql("SELECT id::text FROM public.character_stock WHERE character_id="+q(rerollMerchant)+" ORDER BY id LIMIT 1");
 const deltaNew=await gm.who.rpc("c34_t46_manage_stock_qty_v1",{
  p_stock_id:newId,p_mode:"delta",p_value:1,
  p_expected_qty:null,p_expected_updated_at:null
 });
 assert.ifError(deltaNew.error);assert.equal(Number(deltaNew.data),2);
 console.log("PASS T46-C2B9-REROLL-DELTA: old removed UUID fails B8 atomic delta, new shelf stock supports signed GM increment");

 // An insertion failure AFTER DELETE must restore the original shelf under
 // single SQL transaction atomicity; no wallet/inventory side effects.
 const brokenMerchant=randomUUID(),preservedId=randomUUID();
 sql("INSERT INTO public.characters(id,name,kind,is_hidden,storefront_enabled,state) VALUES("+
   q(brokenMerchant)+",'B9 Rollback Merchant','merchant',false,true,'camping')");
 directStock(brokenMerchant,preservedId,4,6);
 sql(`CREATE FUNCTION private.c34_b9_fail_new_stock_v1() RETURNS trigger
 LANGUAGE plpgsql SET search_path TO pg_catalog,public,private AS $$
 BEGIN
  IF NEW.character_id='${brokenMerchant}'::uuid AND NEW.note LIKE 'auto_reroll:%' THEN
   RAISE EXCEPTION 'B9 injected stock insertion failure' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
 END $$;`);
 sql("CREATE TRIGGER c34_b9_injected_stock_failure BEFORE INSERT ON public.character_stock "+
  "FOR EACH ROW EXECUTE FUNCTION private.c34_b9_fail_new_stock_v1()");
 try{
  const bad=await reroll(admin,brokenMerchant);
  fail(bad,"P0001","injected reroll insert after DELETE");
  assert.match(bad.error.message,/B9 injected/);
  assert.equal(stockQty(preservedId),"4","Reroll failure did not rollback deletion");
  assert.equal(sql("SELECT count(*) FROM public.character_stock WHERE character_id="+q(brokenMerchant)),"1");
  assert.equal(walletOf(shopper.id),w0);
  assert.equal(Number(invCount(shopper.id)),i0);
  console.log("PASS T46-C2B9-REROLL-ROLLBACK: deliberately failed stock INSERT after source-original DELETE rolls back entire reroll, original stock intact and zero purchase side effects");
 }finally{
  sql("DROP TRIGGER IF EXISTS c34_b9_injected_stock_failure ON public.character_stock");
  sql("DROP FUNCTION IF EXISTS private.c34_b9_fail_new_stock_v1()");
 }

 // Exact original merchant panel overlay (Return to Profile already mounted
 // by B2 parent), replaced temporarily ONLY for local Next browser tests.
 const panelPath=path.join(root,"components/MerchantPanel.js");
 const previous=fs.readFileSync(panelPath);
 const oldPanel=previous.toString();
 assert.match(oldPanel,/Return to Profile/);
 assert.match(oldPanel,/\.update\(\{ qty \}\)/,"B9 original stale absolute PATCH must remain available as RED");
 const patched=buildB9StockUiOverlay(oldPanel);
 let next=null,page=null,tail="",pageErrors=[],requests=[];
 try{
  fs.writeFileSync(panelPath,patched);
  const port=await freePort(),origin="http://127.0.0.1:"+port;
  next=spawn(process.execPath,[path.join(root,"node_modules/next/dist/bin/next"),"dev",
   "--webpack","-H","127.0.0.1","-p",String(port)],{
   cwd:root,detached:true,stdio:["ignore","pipe","pipe"],
   env:{...env,NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1",
    NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
    NEXT_PUBLIC_C34_T46_P4B_TOWN_PRESENCE:"1",
    NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP:"1",
    NEXT_PUBLIC_C34_T33_TOWN_STAGE2_SAFE_PROFILE:"1"}
  });
  for(const stream of [next.stdout,next.stderr])
   stream.on("data",b=>tail=(tail+b.toString()).slice(-26000));
  let ready=false;
  for(let t=0;t<115;t++){
   if(next.exitCode!==null)throw Error("B9 Next exited: "+tail);
   try{
    const response=await fetch(origin+"/__c34_t46_p4b_login",{signal:AbortSignal.timeout(2300)});
    if(response.ok&&(await response.text()).includes("P4B local signed login")){ready=true;break}
   }catch{}
   await sleep(1050);
  }
  assert.ok(ready,"B9 signed local Next not ready: "+tail);
  page=await browser.newPage({viewport:{width:1440,height:1080}});
  page.on("pageerror",e=>pageErrors.push(e.message));
  page.on("dialog",dialog=>dialog.accept());
  page.on("request",r=>{if(r.url().includes("/rest/v1/"))
   requests.push({method:r.method(),url:r.url()})});
  await page.goto(origin+"/__c34_t46_p4b_login",{waitUntil:"domcontentloaded",timeout:95000});
  await page.waitForFunction(()=>!!window.__p4bLogin,null,{timeout:85000});
  assert.equal(await page.evaluate(async a=>window.__p4bLogin(a.email,a.password),
   {email:actors.DM.email,password:actors.DM.password}),actors.DM.id);
  const uiRow=randomUUID(),uiName="T46 B9 Click Quantity";
  directStock(merchantId,uiRow,2,4);
  sql("UPDATE public.character_stock SET display_name="+lit(uiName)+" WHERE id="+q(uiRow));
  await page.goto(origin+"/town/"+townId,{waitUntil:"domcontentloaded",timeout:100000});
  await page.getByRole("heading",{name:"T46 Research Test Town"}).waitFor({timeout:70000});
  await page.getByRole("button",{name:"Bazaar / market",exact:true}).first().click({force:true});
  const card=page.locator('div[class*="marketCard"]').filter({hasText:"T46 Curio Merchant"}).first();
  await card.getByRole("button",{name:"Browse Wares"}).click({force:true});
  const side=page.locator(".town-profile-sidepanel");
  await side.getByRole("button",{name:"Let me browse your wares."}).waitFor({timeout:45000});
  await side.getByRole("button",{name:"Let me browse your wares."}).click({force:true});
  await side.getByRole("button",{name:"Merchant tools",exact:true}).waitFor({timeout:40000});
  await side.getByRole("button",{name:"Merchant tools",exact:true}).click({force:true});
  const row=side.getByTestId("c34-b9-stock-"+uiRow);
  await row.getByText(uiName+": 2 in stock").waitFor({timeout:40000});
  const preBuyerGp=walletOf(actors.OUTSIDER.id),preBuyerInv=Number(invCount(actors.OUTSIDER.id));
  const buyBefore=await actors.OUTSIDER.who.rpc("buy_from_merchant",{
   p_merchant_id:merchantId,p_stock_uuid:uiRow,p_qty:1
  });
  assert.ifError(buyBefore.error);
  assert.equal(stockQty(uiRow),"1");
  // The DM browser still renders qty2. Server delta must increment the
  // authoritative new qty1 -> 2, never stale cached 2+1 -> 3.
  const incResponse=page.waitForResponse(r=>r.request().method()==="POST"&&
   r.url().includes("/rest/v1/rpc/c34_t46_manage_stock_qty_v1"),{timeout:40000});
  await row.getByRole("button",{name:"Add one "+uiName}).click({force:true});
  const inc=await incResponse;
  assert.equal(inc.status(),200,"B9 signed browser manager delta error: "+await inc.text());
  await row.getByText(uiName+": 2 in stock").waitFor({timeout:40000});
  assert.equal(stockQty(uiRow),"2","B9 browser overwrote sold unit with stale PATCH");
  assert.equal(walletOf(actors.OUTSIDER.id),String(Number(preBuyerGp)-4));
  assert.equal(Number(invCount(actors.OUTSIDER.id)),preBuyerInv+1);
  assert.ok(!requests.some(x=>x.method==="PATCH"&&x.url.includes("/rest/v1/character_stock")));
  console.log("PASS T46-C2B9-BROWSER-DELTA: genuine signed DM original town/Profile/Shop tools clicks +1 after buyer qty2→1, server 1→2 not stale 3; original buyer 4GP/one delivery, no PATCH");

  // Explicit absolute set must fail on stale snapshot after another signed
  // buyer, not silently overwrite their stock and inventory transfer.
  const boughtAgain=await actors.OUTSIDER.who.rpc("buy_from_merchant",{
   p_merchant_id:merchantId,p_stock_uuid:uiRow,p_qty:1
  });
  assert.ifError(boughtAgain.error);
  assert.equal(stockQty(uiRow),"1");
  const casResponse=page.waitForResponse(r=>r.request().method()==="POST"&&
    r.url().includes("/rest/v1/rpc/c34_t46_manage_stock_qty_v1"),{timeout:40000});
  await row.getByRole("button",{name:"Set two "+uiName}).click({force:true});
  const staleCas=await casResponse;
  assert.ok(staleCas.status()>=400,"B9 stale absolute set incorrectly succeeded");
  assert.equal((await staleCas.json()).code,"40001");
  assert.equal(stockQty(uiRow),"1");
  assert.equal(walletOf(actors.OUTSIDER.id),String(Number(preBuyerGp)-8));
  assert.equal(Number(invCount(actors.OUTSIDER.id)),preBuyerInv+2);
  console.log("PASS T46-C2B9-BROWSER-CAS: genuine signed DM Set 2 with stale rendered qty/revision rejected 40001 after second signed purchase; exact wallet and inventory preserved");

  // With the 3-arg RPC missing, browser must FAIL CLOSED instead of deleting
  // stock and reinserting a partial shelf through independent REST requests.
  const beforeFallback=Number(sql("SELECT count(*) FROM public.character_stock WHERE character_id="+q(merchantId)));
  const beforeCalls=requests.length;
  const rpcUnavailable=async route=>route.fulfill({status:404,contentType:"application/json",
   body:JSON.stringify({code:"PGRST202",message:"Could not find the function public.reroll_merchant_inventory_v2"})});
  await page.route("**/rest/v1/rpc/reroll_merchant_inventory_v2",rpcUnavailable);
  try{
   await side.getByRole("button",{name:/^Reroll /}).click({force:true});
   await page.waitForResponse(r=>r.request().method()==="POST"&&
     r.url().includes("/rest/v1/rpc/reroll_merchant_inventory_v2"),{timeout:35000});
   await sleep(550);
   assert.ok(!requests.slice(beforeCalls).some(x=>x.method==="DELETE"&&
    x.url.includes("/rest/v1/character_stock")),
    "B9 missing RPC called unsafe browser DELETE/INSERT fallback");
   assert.equal(Number(sql("SELECT count(*) FROM public.character_stock WHERE character_id="+q(merchantId))),beforeFallback);
  }finally{await page.unroute("**/rest/v1/rpc/reroll_merchant_inventory_v2",rpcUnavailable)}
  assert.deepEqual(pageErrors,[],"B9 browser page errors "+JSON.stringify(pageErrors)+" "+tail.slice(-4000));
  console.log("PASS T46-C2B9-BROWSER-FAIL-CLOSED: simulated missing primary reroll RPC never performs browser DELETE/INSERT fallback; original shelf remains intact");
 }finally{
  if(page)await page.close().catch(()=>{});
  if(next){try{process.kill(-next.pid,"SIGTERM")}catch{}await sleep(550);
   try{process.kill(-next.pid,"SIGKILL")}catch{}}
  fs.writeFileSync(panelPath,previous);
  assert.deepEqual(fs.readFileSync(panelPath),previous,"B9 did not restore parent original MerchantPanel overlay bytes");
 }
 assert.equal(sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))"),originalBuyer);
 assert.equal(sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)'::regprocedure))"),originalManager);
 console.log("PASS T46-C2B9-SIGNED-RESEARCH: source-pinned original reroll, owner roles + seller lock candidate, real buyer/manager concurrency, rollback, browser delta/CAS/fail-closed; ALL disposable, production HOLD");
}
