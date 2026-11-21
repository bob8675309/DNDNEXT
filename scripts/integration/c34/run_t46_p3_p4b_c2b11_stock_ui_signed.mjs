// C34 T46-P3-P4B-C2-B11: genuine local signed Stock UI browser cutover.
// Runs AFTER accepted B2-B10 in the SAME isolated PG17/GoTrue/PostgREST fixture.
// Original and guarded merchant components are OVERLAID ONLY IN THIS RUNNER
// and restored byte-for-byte in finally. No world map, live SQL or deployment.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import {spawn} from "node:child_process";
import {randomUUID,createHash} from "node:crypto";
import {buildB11StockUiOverlay} from "./candidates/t46_p3_p4b_c2b11_stock_ui_overlay.mjs";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const gitBlob=b=>createHash("sha1").update(Buffer.concat([
  Buffer.from("blob "+b.length+"\0"),b
])).digest("hex");
const port=()=>new Promise((resolve,reject)=>{
  const s=net.createServer();
  s.once("error",reject);
  s.listen(0,"127.0.0.1",()=>{const n=s.address().port;s.close(()=>resolve(n))});
});
const requireLocal=env=>{
 for(const [k,v] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"
 }))assert.equal(env[k],v,"B11 refuses non-disposable "+k);
 assert.notEqual(env.VERCEL,"1");
};
async function startNext(env,root,guarded){
 const p=await port(),origin="http://127.0.0.1:"+p;
 let tail="",child=spawn(process.execPath,[
  path.join(root,"node_modules/next/dist/bin/next"),"dev",
  "--webpack","-H","127.0.0.1","-p",String(p)
 ],{cwd:root,detached:true,stdio:["ignore","pipe","pipe"],env:{
  ...env,NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1",
  NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
  NEXT_PUBLIC_C34_T46_P4B_TOWN_PRESENCE:"1",
  NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP:guarded?"1":"0",
  NEXT_PUBLIC_C34_T33_TOWN_STAGE2_SAFE_PROFILE:guarded?"1":"0"
 }});
 for(const s of [child.stdout,child.stderr])
  s.on("data",x=>tail=(tail+x.toString()).slice(-25000));
 for(let i=0;i<120;i++){
  if(child.exitCode!==null)throw Error("B11 Next died: "+tail);
  try{
   const response=await fetch(origin+"/__c34_t46_p4b_login",
    {signal:AbortSignal.timeout(2200)});
   if(response.ok&&(await response.text()).includes("P4B local signed login"))
    return {origin,child,tail:()=>tail};
  }catch{}
  await sleep(950);
 }
 throw Error("B11 Next not ready: "+tail);
}
async function stopNext(child){
 if(!child)return;
 try{process.kill(-child.pid,"SIGTERM")}catch{}
 await sleep(500);
 try{process.kill(-child.pid,"SIGKILL")}catch{}
 await sleep(450);
}
export async function runT46C2B11StockUiSigned({
 env,root,actors,newActor,merchantId,townId,browser,sql,q,lit,walletOf,invCount
}){
 requireLocal(env);
 const originalBuyer=sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))");
 const originalQty=sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)'::regprocedure))");
 const originalStock=sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_merchant_stock_v1(uuid,text,uuid,jsonb,text,numeric,integer,jsonb)'::regprocedure))");
 assert.equal(sql("SELECT current_setting('server_version_num')::integer BETWEEN 170000 AND 179999"),"t");
 const paths=["components/MerchantPanel.js","components/c34/MerchantPanelT28P2Research.jsx"];
 const bytes=paths.map(file=>fs.readFileSync(path.join(root,file)));
 const candidates=bytes.map((b,i)=>buildB11StockUiOverlay(b,{guarded:i===1}));
 const shelf=()=>JSON.parse(sql("SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb)::text FROM public.character_stock s WHERE s.character_id="+q(merchantId)));
 const byId=id=>JSON.parse(sql("SELECT coalesce((SELECT row_to_json(s)::text FROM public.character_stock s WHERE s.id="+q(id)+"),'null')"));
 const qty=id=>sql("SELECT coalesce((SELECT qty::text FROM public.character_stock WHERE id="+q(id)+"),'gone')");
 const namedId=name=>sql("SELECT coalesce((SELECT id::text FROM public.character_stock WHERE character_id="+q(merchantId)+" AND display_name="+lit(name)+" ORDER BY id DESC LIMIT 1),'')");
 const saveRow=(name,n=2,price=4)=>{
  const id=randomUUID();
  sql("INSERT INTO public.character_stock(id,character_id,display_name,price_gp,qty,card_payload) VALUES("+
   q(id)+","+q(merchantId)+","+lit(name)+","+price+","+n+","+
   lit(JSON.stringify({item_name:name,item_type:"Potion",item_rarity:"Common",item_id:"b11-"+id}))+"::jsonb)");
  return id;
 };
 const buyer=await newActor("B11_BUYER","player");
 sql("INSERT INTO public.player_wallets(user_id,gp) VALUES("+q(buyer.id)+",100)");
 const buyerBefore=Number(walletOf(buyer.id)),itemsBefore=Number(invCount(buyer.id));
 const purchase=id=>buyer.who.rpc("buy_from_merchant",{
  p_merchant_id:merchantId,p_stock_uuid:id,p_qty:1
 });
 let next=null,page=null;let activeLabel="";
 const logRequests=[];
 const noRawWrites=(since,label)=>{
  const unsafe=logRequests.slice(since).filter(r=>
   r.url.includes("/rest/v1/character_stock")&&
   ["POST","PATCH","PUT","DELETE"].includes(r.method));
  assert.deepEqual(unsafe,[],label+" emitted direct stock DML");
 };
 const waitRpc=p=>p.waitForResponse(r=>r.request().method()==="POST"&&
  r.url().includes("/rest/v1/rpc/c34_t46_manage_merchant_stock_v1"),
  {timeout:45000});
 async function signIn(page,origin,actor){
  await page.goto(origin+"/__c34_t46_p4b_login",{waitUntil:"domcontentloaded",timeout:95000});
  await page.waitForFunction(()=>!!window.__p4bLogin,null,{timeout:60000});
  assert.equal(await page.evaluate(async a=>window.__p4bLogin(a.email,a.password),
   {email:actor.email,password:actor.password}),actor.id);
 }
 async function openShop(page,origin,actor){
  await signIn(page,origin,actor);
  await page.goto(origin+"/town/"+townId,{waitUntil:"domcontentloaded",timeout:100000});
  await page.getByRole("heading",{name:"T46 Research Test Town"}).waitFor({timeout:65000});
  await page.getByRole("button",{name:"Bazaar / market",exact:true}).first().click({force:true});
  const card=page.locator('div[class*="marketCard"]').filter({hasText:"T46 Curio Merchant"}).first();
  await card.getByRole("button",{name:"Browse Wares"}).click({force:true});
  const side=page.locator(".town-profile-sidepanel");
  await side.getByRole("button",{name:"Let me browse your wares."}).waitFor({timeout:50000});
  await side.getByRole("button",{name:"Let me browse your wares."}).click({force:true});
  await side.getByRole("button",{name:"Return to Profile"}).waitFor({timeout:45000});
  return side;
 }
 async function tools(side){
  await side.getByRole("button",{name:"Merchant tools",exact:true}).waitFor({timeout:40000});
  await side.getByRole("button",{name:"Merchant tools",exact:true}).click({force:true});
  await side.getByRole("button",{name:"Add item",exact:true}).waitFor({timeout:40000});
  await side.getByTestId("c34-b11-stock-controls").waitFor({timeout:40000});
 }
 async function add(page,side,name,expectedStatus=200){
  await side.getByPlaceholder("Paste JSON or type an item name…").fill(name);
  const waiting=waitRpc(page);
  await side.getByRole("button",{name:"Add item",exact:true}).click({force:true});
  const result=await waiting;
  assert.equal(result.status(),expectedStatus,
   "B11 "+activeLabel+" add status "+await result.text());
  return result;
 }
 async function remove(page,side,id,status=200){
  const waiting=waitRpc(page);
  await side.getByTestId("c34-b11-remove-"+id).click({force:true});
  const result=await waiting;
  assert.equal(result.status(),status,"B11 remove status "+await result.text());
  return result;
 }
 async function dump(page,side,status=200){
  const waiting=waitRpc(page);
  await side.getByRole("button",{name:"Dump stock"}).click({force:true});
  const result=await waiting;
  assert.equal(result.status(),status,"B11 dump status "+await result.text());
  return result;
 }
 try{
  // Both original variants are source-locked and temporary, never a production import.
  for(let i=0;i<paths.length;i++)
   fs.writeFileSync(path.join(root,paths[i]),candidates[i]);
  for(const guarded of [false,true]){
   activeLabel=guarded?"GUARDED":"ORIGINAL";
   const proc=await startNext(env,root,guarded);next=proc.child;
   page=await browser.newPage({viewport:{width:1440,height:1080}});
   const errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   page.on("dialog",dialog=>dialog.accept());
   page.on("request",r=>{
    if(r.url().includes("/rest/v1/"))
     logRequests.push({method:r.method(),url:r.url()});
   });
   const signedManager=guarded?actors.GM:actors.ADMIN;
   let side=await openShop(page,proc.origin,signedManager);
   await tools(side);
   const marker="B11 "+activeLabel+" add "+randomUUID().slice(0,8);
   const before=logRequests.length;
   await add(page,side,marker);
   const added=namedId(marker);
   assert.ok(added,"B11 "+activeLabel+" generated stock missing");
   await side.getByTestId("c34-b11-remove-"+added).waitFor({timeout:35000});
   assert.equal(qty(added),"1");
   noRawWrites(before,activeLabel+" add");
   await remove(page,side,added);
   assert.equal(qty(added),"gone");
   noRawWrites(before,activeLabel+" remove");
   console.log("PASS T46-C2B11-"+activeLabel+"-ADD-REMOVE: genuine signed "+signedManager.role+
    " Town/Bazaar -> Profile -> Shop, atomic B10 add/remove, no raw stock INSERT/DELETE/PATCH");

   // Reopen to ensure a fresh full-shelf snapshot before a buyer changes stock.
   const staleRow=saveRow("B11 "+activeLabel+" stale",2,4);
   side=await openShop(page,proc.origin,signedManager);
   await tools(side);
   await side.getByTestId("c34-b11-remove-"+staleRow).waitFor({timeout:35000});
   const wallet0=Number(walletOf(buyer.id)),items0=Number(invCount(buyer.id));
   assert.ifError((await purchase(staleRow)).error);
   assert.equal(qty(staleRow),"1");
   const stale=await remove(page,side,staleRow,409);
   assert.equal((await stale.json()).code,"40001");
   assert.equal(qty(staleRow),"1");
   assert.equal(Number(walletOf(buyer.id)),wallet0-4);
   assert.equal(Number(invCount(buyer.id)),items0+1);
   noRawWrites(before,activeLabel+" stale remove");
   console.log("PASS T46-C2B11-"+activeLabel+"-REMOVE-CAS: signed browser stale full-row remove rejects 40001 after real buyer; 4GP and one item only");

   // A missing function cannot authorize a client insert/delete fallback.
   const missing=async route=>route.fulfill({status:404,contentType:"application/json",
    body:JSON.stringify({code:"PGRST202",message:"Missing local B11 RPC"})});
   await page.route("**/rest/v1/rpc/c34_t46_manage_merchant_stock_v1",missing);
   try{
    const name="B11 "+activeLabel+" missing "+randomUUID().slice(0,6);
    const stockBefore=JSON.stringify(shelf()),i=logRequests.length;
    await add(page,side,name,404);
    assert.equal(namedId(name),"");
    assert.equal(JSON.stringify(shelf()),stockBefore);
    noRawWrites(i,activeLabel+" unavailable RPC");
   }finally{await page.unroute("**/rest/v1/rpc/c34_t46_manage_merchant_stock_v1",missing)}
   console.log("PASS T46-C2B11-"+activeLabel+"-MISSING-FAIL-CLOSED: RPC404 no direct browser stock writes and full shelf unchanged");

   // Guarded Town has owner-equivalent GM/DM permissions; original gets Admin.
   if(guarded){
    side=await openShop(page,proc.origin,actors.DM);await tools(side);
    const dmName="B11 DM stock "+randomUUID().slice(0,6);
    await add(page,side,dmName);
    assert.ok(namedId(dmName),"Signed DM add missing");
    const staleShelf=JSON.stringify(shelf());
    const buyerRow=saveRow("B11 dump concurrency",2,3);
    // Refresh to include the new row in the panel snapshot.
    side=await openShop(page,proc.origin,actors.DM);await tools(side);
    await side.getByTestId("c34-b11-remove-"+buyerRow).waitFor({timeout:30000});
    const gp0=Number(walletOf(buyer.id)),item0=Number(invCount(buyer.id));
    assert.ifError((await purchase(buyerRow)).error);
    const staleDump=await dump(page,side,409);
    assert.equal((await staleDump.json()).code,"40001");
    assert.equal(qty(buyerRow),"1");
    assert.equal(Number(walletOf(buyer.id)),gp0-3);
    assert.equal(Number(invCount(buyer.id)),item0+1);
    side=await openShop(page,proc.origin,actors.DM);await tools(side);
    const priorCount=shelf().length;
    assert.ok(priorCount>=2);
    const i=logRequests.length;await dump(page,side);
    assert.equal(shelf().length,0);
    noRawWrites(i,"guarded dump");
    console.log("PASS T46-C2B11-GUARDED-DUMP-CAS: signed DM stale full-shelf dump rejected after buyer; fresh full-shelf atomic clear, correct GP/item");

    // A player can browse/buy, but must never receive manager tools.
    const player=await newActor("B11_PLAYER","player");
    side=await openShop(page,proc.origin,player);
    assert.equal(await side.getByRole("button",{name:"Merchant tools",exact:true}).count(),0);
    console.log("PASS T46-C2B11-PLAYER-UI: genuine signed player still sees Profile/Shop without stock manager controls");

    // Signed GM role revoked after the page rendered must be rejected by the
    // actual DB function, even before the browser refreshes its cached role.
    const revoked=await newActor("B11_REVOKED","gm");
    side=await openShop(page,proc.origin,revoked);await tools(side);
    sql("UPDATE public.user_profiles SET role='player' WHERE id="+q(revoked.id));
    const revName="B11 revoked "+randomUUID().slice(0,6);
    const stockBefore=JSON.stringify(shelf());
    const response=await add(page,side,revName,403);
    assert.equal((await response.json()).code,"42501");
    assert.equal(JSON.stringify(shelf()),stockBefore);
    assert.equal(namedId(revName),"");
    console.log("PASS T46-C2B11-REVOKED-RPC: cached signed manager UI after genuine DB role revocation fails 42501, no server stock mutation");
   }
   assert.deepEqual(errors,[],"B11 "+activeLabel+" browser errors "+JSON.stringify(errors)+" "+proc.tail().slice(-3300));
   await page.close();page=null;
   await stopNext(next);next=null;
  }
  assert.equal(Number(walletOf(buyer.id)),buyerBefore-11);
  assert.equal(Number(invCount(buyer.id)),itemsBefore+3);
  assert.equal(sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))"),originalBuyer);
  assert.equal(sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)'::regprocedure))"),originalQty);
  assert.equal(sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_merchant_stock_v1(uuid,text,uuid,jsonb,text,numeric,integer,jsonb)'::regprocedure))"),originalStock);
  console.log("PASS T46-C2B11-SIGNED-BROWSER: original+guarded real Next signed UI, Admin/GM/DM add/remove/dump, buyer-stale full snapshots, missing RPC fail closed, player/revoked negatives, wallet/inventory, preserved B2-B10 SQL functions");
 }finally{
  if(page)await page.close().catch(()=>{});
  await stopNext(next);
  for(let i=0;i<paths.length;i++){
   fs.writeFileSync(path.join(root,paths[i]),bytes[i]);
   assert.equal(gitBlob(fs.readFileSync(path.join(root,paths[i]))),gitBlob(bytes[i]),
    "B11 failed to restore checked-in storefront "+paths[i]);
  }
  assert.equal(gitBlob(fs.readFileSync(path.join(root,"components/MapPageClient.js"))),
   "61f8738da2ca3d8635b5a413bfdc18c094228a0a");
 }
}
