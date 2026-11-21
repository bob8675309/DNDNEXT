// C34 T46-P3-P4B-C2-B4: source-original guarded merchant+T33 current real town
// signed Next16/Chromium against disposable C2-B2 local guarded buyer.
// NO shipped source modifications, no hosted services, no world map.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import {randomUUID,createHash} from "node:crypto";
import {spawn} from "node:child_process";

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function port(){
 return new Promise((resolve,reject)=>{
  const sock=net.createServer();sock.once("error",reject);
  sock.listen(0,"127.0.0.1",()=>{const p=sock.address().port;sock.close(()=>resolve(p))});
 });
}
const buyerReq=r=>r.method()==="POST"&&
 /\/rest\/v1\/rpc\/buy_from_merchant(?:\?|$)/.test(r.url());
const walletReq=r=>r.method()==="POST"&&
 /\/rest\/v1\/rpc\/wallet_get(?:\?|$)/.test(r.url());
const stockReq=id=>r=>{
 try{return r.method()==="GET"&&r.url().includes("/rest/v1/character_stock")&&
  new URL(r.url()).searchParams.get("character_id")==="eq."+id;}
 catch{return false}
};
async function holdActual(page,glob,accept,name){
 let release,resolveReady,rejectReady,resolveDone;
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject});
 const gate=new Promise(done=>{release=done});
 const done=new Promise(resolve=>{resolveDone=resolve});
 let once=false;
 const handler=async route=>{
  if(once||!accept(route.request())){await route.continue();return}
  once=true;
  try{
   const upstream=await route.fetch();
   const receipt={status:upstream.status(),json:await upstream.json()};
   resolveReady(receipt);await gate;
   await route.fulfill({response:upstream});
  }catch(error){rejectReady(error);throw error}
  finally{resolveDone()}
 };
 await page.route(glob,handler);
 const bounded=p=>Promise.race([p,new Promise((_,reject)=>
  setTimeout(()=>reject(Error("B4 HTTP timeout "+name)),30000))]);
 return {
  ready:bounded(ready),release:()=>release(),done:()=>bounded(done),
  close:async()=>{release();await page.unroute(glob,handler)}
 };
}
async function startNext({env,root,flagT28,flagT33}){
 const nextBin=path.join(root,"node_modules/next/dist/bin/next");
 const bind=await port(),origin="http://127.0.0.1:"+bind;
 let logs="";
 const proc=spawn(process.execPath,[nextBin,"dev","--webpack","-H","127.0.0.1","-p",String(bind)],{
  cwd:root,detached:true,stdio:["ignore","pipe","pipe"],
  env:{...env,NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1",
   NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
   NEXT_PUBLIC_C34_T46_P4B_TOWN_PRESENCE:"1",
   NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP:String(flagT28),
   NEXT_PUBLIC_C34_T33_TOWN_STAGE2_SAFE_PROFILE:String(flagT33)}
 });
 for(const stream of [proc.stdout,proc.stderr])
  stream.on("data",chunk=>{logs=(logs+chunk.toString()).slice(-22000)});
 const stop=async()=>{
  try{process.kill(-proc.pid,"SIGTERM")}catch{}
  await sleep(850);
  try{process.kill(-proc.pid,"SIGKILL")}catch{}
  await sleep(650);
 };
 try{
  let started=false;
  for(let attempt=0;attempt<110;attempt++){
   if(proc.exitCode!==null)throw Error("B4 Next "+flagT28+flagT33+" exited: "+logs);
   try{
    const r=await fetch(origin+"/__c34_t46_p4b_login",{signal:AbortSignal.timeout(2600)});
    if(r.ok&&(await r.text()).includes("P4B local signed login")){started=true;break}
   }catch{}
   await sleep(1050);
  }
  assert.ok(started,"B4 flagged Next "+flagT28+flagT33+" readiness failed "+logs);
  return {origin,stop,log:()=>logs};
 }catch(e){await stop();throw e}
}
async function authIn(page,origin,who){
 await page.goto(origin+"/__c34_t46_p4b_login",{waitUntil:"domcontentloaded",timeout:90000});
 await page.waitForFunction(()=>!!window.__p4bLogin,null,{timeout:50000});
 const id=await page.evaluate(input=>window.__p4bLogin(input.email,input.password),
  {email:who.email,password:who.password});
 assert.equal(id,who.id);
}
async function gotoTown(page,origin,townId){
 await page.goto(origin+"/town/"+townId,{waitUntil:"domcontentloaded",timeout:95000});
 await page.getByRole("heading",{name:"T46 Research Test Town"})
  .waitFor({timeout:65000});
 await page.waitForFunction(()=>!!window.__c34B4Auth?.auth,null,{timeout:50000});
 await page.getByRole("button",{name:"Bazaar / market",exact:true}).first().click({force:true});
 const card=page.locator('div[class*="marketCard"]').filter({hasText:"T46 Curio Merchant"}).first();
 await card.getByRole("button",{name:"Browse Wares"}).waitFor({timeout:45000});
 await card.getByRole("button",{name:"Browse Wares"}).click({force:true});
 const side=page.locator(".town-profile-sidepanel");
 await side.waitFor({timeout:35000});
 return side;
}
async function signedOut(page){
 const result=await page.evaluate(async()=> {
  const {error}=await window.__c34B4Auth.auth.signOut();
  return error?.message || null;
 });
 assert.equal(result,null);
 await page.locator(".town-profile-sidepanel").waitFor({state:"detached",timeout:30000});
}
async function signInTown(page,actor){
 const id=await page.evaluate(async credentials=>{
  const {data,error}=await window.__c34B4Auth.auth.signInWithPassword(credentials);
  if(error)throw Error(error.message);
  return data.user.id;
 },{email:actor.email,password:actor.password});
 assert.equal(id,actor.id);
}
export async function runT46C2B4FlaggedTown({
 env,root,browser,actors,townId,merchantId,sql,q,lit,walletOf,invCount
}){
 // Must only run after original B3 RED and guarded C2-B2 GREEN, with no
 // hosted URL, original current app sources, and the disposable SQL body.
 assert.equal(env.CI,"true");
 assert.equal(env.GITHUB_ACTIONS,"true");
 assert.equal(env.DNDNEXT_C34_LOCAL_CONFIRM,"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY");
 assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
 assert.equal(walletOf(actors.OUTSIDER.id),"27","B4 requires confirmed exact B3 receipts");
 assert.equal(sql("SELECT pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure) ILIKE '%Merchant unavailable%'"),"t");
 // Only the independent READ-ONLY T31 role projection is missing from the
 // B2 disposable fixture. The full T31 migration is NOT eligible here:
 // it requires the pre-B2 ORIGINAL buyer MD5 and rewrites manager helpers.
 const roleBytes=fs.readFileSync(path.join(root,
   "scripts/integration/c34/t31_disposable_game_manager_role_unification_pg17.sql"));
 const roleBlob=createHash("sha1").update(Buffer.concat([
  Buffer.from("blob "+roleBytes.length+"\\0"),roleBytes])).digest("hex");
 assert.equal(roleBlob,"46da7b3b33730df6f739e850c1c09b35699f040b",
  "T31 role projection original source drift");
 const roleText=roleBytes.toString("utf8");
 const roleStart=roleText.indexOf("CREATE OR REPLACE FUNCTION public.c34_game_manager_capabilities_research_v1()");
 const roleEnd=roleText.indexOf("\\nCOMMIT;",roleStart);
 assert.ok(roleStart>=0 && roleEnd>roleStart,"T31 original read-only function/grants missing");
 const roleOnly=roleText.slice(roleStart,roleEnd);
 assert.ok(roleOnly.includes("REVOKE ALL ON FUNCTION public.c34_game_manager_capabilities_research_v1()"));
 assert.ok(roleOnly.includes("GRANT EXECUTE ON FUNCTION public.c34_game_manager_capabilities_research_v1()"));
 sql(roleOnly);
 sql("NOTIFY pgrst, 'reload schema'");
 assert.equal(sql("SELECT pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure) ILIKE '%Merchant unavailable%'"),"t",
  "Role read-only projection changed B2 guarded original buyer");
 const townPath=path.join(root,"pages/town/[id].js");
 const currentTown=fs.readFileSync(townPath,"utf8");
 assert.ok(currentTown.includes("T46_P4B_TOWN_PRESENCE_ENABLED"),
  "B4 requires the existing source-derived disposable town projection");
 const anchor="export default function TownPage() {\n  const router = useRouter();";
 assert.equal(currentTown.split(anchor).length,2,"B4 town ephemeral auth hook source drift");
 const patchedTown=currentTown.replace(anchor,
  anchor+'\n  // B4 DISPOSABLE TEST ONLY: expose this existing local Supabase client to Chromium.\n'+
  '  useEffect(()=>{window.__c34B4Auth=supabase;return()=>{if(window.__c34B4Auth===supabase)delete window.__c34B4Auth}},[]);');
 assert.ok(!currentTown.includes("__c34B4Auth"));
 fs.writeFileSync(townPath,patchedTown);
 const stockId=randomUUID(),stockName="T46 C2B4 Guarded Stage2 Ember";
 sql("INSERT INTO public.character_stock(id,character_id,item_id,display_name,price_gp,qty,card_payload) VALUES("+
  q(stockId)+","+q(merchantId)+",'c2b4-guarded-ember',"+lit(stockName)+",6,2,"+
  lit(JSON.stringify({item_type:"Potion",item_rarity:"Common"}))+"::jsonb)");
 const before=Number(invCount(actors.OUTSIDER.id));
 const errors=[],offsite=[];
 let server=null;
 try{
  // 11: T28 merchant actor guard WITH T33 safe Stage2 source Profile.
  server=await startNext({env,root,flagT28:1,flagT33:1});
  const page=await browser.newPage({viewport:{width:1400,height:1060}});
  try{
   page.on("pageerror",e=>errors.push("B4-11:"+e.message));
   await page.route("**/*",route=>{
    const url=route.request().url();
    if(url.startsWith(server.origin)||url.startsWith(env.DNDNEXT_C34_LOCAL_URL)||
       url.startsWith("ws://127.0.0.1:"))return route.continue();
    if(/supabase\.co|service_role/i.test(url))offsite.push(url.slice(0,190));
    return route.abort();
   });
   await authIn(page,server.origin,actors.DM);
   let side=await gotoTown(page,server.origin,townId);
   await side.getByTestId("t33-stage2-profile-ready").waitFor({timeout:65000});
   const profile=side.getByRole("button",{name:"Profile",exact:true});
   await profile.waitFor({timeout:25000});
   assert.match(await profile.getAttribute("class")||"",/\bbtn-primary\b/);
   assert.ok((await side.innerText()).includes("NPC Dossier & Player Reveals"),
    "Signed DM manager role lost T33 dossier");
   await side.getByRole("button",{name:"Shop",exact:true}).click({force:true});
   await side.getByRole("listbox",{name:"Merchant stock"})
    .getByRole("option",{name:new RegExp(stockName)}).waitFor({timeout:35000});
   await side.getByRole("button",{name:"Merchant tools",exact:true}).waitFor({timeout:20000});
   console.log("PASS T46-C2B4-T33-ROLE-DM: true signed DM source-safe Stage2 merchant Profile-first, public stock and GM/DM merchant tools");
   await signedOut(page);
   await signInTown(page,actors.OUTSIDER);
   await page.getByRole("heading",{name:"T46 Research Test Town"}).waitFor({timeout:55000});
   await page.getByRole("button",{name:"Bazaar / market",exact:true}).first().click({force:true});
   const merchantCard=page.locator('div[class*="marketCard"]').filter({hasText:"T46 Curio Merchant"}).first();
   await merchantCard.getByRole("button",{name:"Browse Wares"}).click({force:true});
   side=page.locator(".town-profile-sidepanel");
   await side.getByTestId("t33-stage2-profile-ready").waitFor({timeout:55000});
   assert.ok(!(await side.innerText()).includes("NPC Dossier & Player Reveals"),
    "Unprivileged buyer inherited DM dossier after same-page actor switch");
   await side.getByRole("button",{name:"Shop",exact:true}).click({force:true});
   assert.equal(await side.getByRole("button",{name:"Merchant tools",exact:true}).count(),0,
    "Player inherited GM merchant tools");
   await side.getByRole("listbox",{name:"Merchant stock"})
    .getByRole("option",{name:new RegExp(stockName)}).click({force:true});
   await side.locator(".merchant-preview-purchase").getByText("27 gp",{exact:true})
    .waitFor({timeout:28000});
   console.log("PASS T46-C2B4-T33-ROLE-PLAYER: actual town signed DM→player role switch reauthorizes safe public Profile/Shop and revokes GM editor/dossier");
   // Guarded real buyer 200 is the transaction boundary. Only AFTER success
   // is the genuine display wallet_get forced to fail with test HTTP 503.
   let walletFaultCount=0;
   const walletFault=route=>{
    walletFaultCount++;
    return route.fulfill({status:503,contentType:"application/json",
      body:JSON.stringify({code:"PGRST500",message:"B4 wallet refresh unavailable"})});
   };
   await page.route("**/rest/v1/rpc/wallet_get",walletFault);
   try{
    const buyer200=page.waitForResponse(r=>buyerReq(r.request()),{timeout:30000});
    await side.getByRole("button",{name:"Buy for 6 gp",exact:true}).click({force:true});
    const reply=await buyer200;
    assert.equal(reply.status(),200);
    assert.equal(Number(await reply.json()),1);
    await side.locator(".merchant-market-notice-success")
     .filter({hasText:"Purchased "+stockName}).waitFor({timeout:30000});
    const notice=await side.locator(".merchant-market-notice-success").innerText();
    assert.match(notice,/Your balance could not be refreshed/i);
    assert.ok(walletFaultCount>=1,"B4 actual postcommit wallet refresh fault never hit");
    assert.equal(await side.locator(".merchant-market-notice-error").count(),0);
    await side.locator(".merchant-preview-purchase").getByText("Unavailable",{exact:true})
     .waitFor({timeout:25000});
    assert.equal(walletOf(actors.OUTSIDER.id),"21","B4 guarded purchase must commit 27→21");
    assert.equal(sql("SELECT qty::text FROM public.character_stock WHERE id="+q(stockId)),"1");
    assert.equal(Number(invCount(actors.OUTSIDER.id)),before+1);
    console.log("PASS T46-C2B4-T33-POSTCOMMIT-GREEN: real 11 town/Profile/Shop guarded 200 purchase 27→21/2→1/one item; wallet_get 503 shows SUCCESS plus unavailable balance warning, never false failure");
   }finally{await page.unroute("**/rest/v1/rpc/wallet_get",walletFault)}
   // Reopen Shop to start a new actor-scoped wallet_get and clear warning.
   await side.getByRole("button",{name:"Return to Profile",exact:true}).click({force:true});
   await side.getByRole("button",{name:"Shop",exact:true}).click({force:true});
   await side.getByRole("listbox",{name:"Merchant stock"})
    .getByRole("option",{name:new RegExp(stockName)}).click({force:true});
   await side.locator(".merchant-preview-purchase").getByText("21 gp",{exact:true})
    .waitFor({timeout:28000});
   // Withhold actual source-original guarded SQL success 200 (server already
   // committed) until the currently authenticated town actor signs out.
   const preLate=Number(invCount(actors.OUTSIDER.id));
   const lateBuy=await holdActual(page,"**/rest/v1/rpc/buy_from_merchant",
    buyerReq,"B4 T33 accepted late buyer");
   try{
    await side.getByRole("button",{name:"Buy for 6 gp",exact:true}).click({force:true});
    const received=await lateBuy.ready;
    assert.equal(received.status,200);
    assert.equal(Number(received.json),1);
    assert.equal(walletOf(actors.OUTSIDER.id),"15");
    assert.equal(sql("SELECT count(*) FROM public.character_stock WHERE id="+q(stockId)),"0");
    assert.equal(Number(invCount(actors.OUTSIDER.id)),preLate+1);
    await signedOut(page);
    lateBuy.release();await lateBuy.done();
    assert.equal(await page.locator(".town-profile-sidepanel").count(),0,
     "Late signed-out buyer resurrected stale town Profile/Shop");
    console.log("PASS T46-C2B4-T33-LATE-BUY-GREEN: local guarded buyer 200 committed 21→15/last stock gone/one item, delivered after real logout, no previous town Profile/shop resurrection");
   }finally{await lateBuy.close()}
   await signInTown(page,actors.OTHER);
   await page.getByRole("heading",{name:"T46 Research Test Town"})
    .waitFor({timeout:55000});
   await page.getByRole("button",{name:"Bazaar / market",exact:true}).first().click({force:true});
   await page.locator('div[class*="marketCard"]').filter({hasText:"T46 Curio Merchant"})
    .first().getByRole("button",{name:"Browse Wares"}).click({force:true});
   side=page.locator(".town-profile-sidepanel");
   await side.getByTestId("t33-stage2-profile-ready").waitFor({timeout:45000});
   await side.getByRole("button",{name:"Shop",exact:true}).click({force:true});
   assert.equal(await side.getByText(stockName,{exact:true}).count(),0);
   assert.equal(await side.locator(".merchant-market-notice-success").count(),0);
   assert.equal(await side.getByRole("button",{name:"Merchant tools",exact:true}).count(),0);
   assert.equal(walletOf(actors.OTHER.id),"0");
   console.log("PASS T46-C2B4-T33-OTHER: signed old buyer receipt not shown to new 0-GP actor; sold-out row gone, no inherited private admin");
   // A new stock/GP read resolves only AFTER logout in the real current-town
   // actor boundary. No artificially forged 200 response is used.
   const heldStockId=randomUUID(),heldName="T46 C2B4 Late Safe Stock";
   sql("INSERT INTO public.character_stock(id,character_id,item_id,display_name,price_gp,qty,card_payload) VALUES("+
    q(heldStockId)+","+q(merchantId)+",'c2b4-late-safe',"+lit(heldName)+",3,2,"+
    lit(JSON.stringify({item_type:"Potion",item_rarity:"Common"}))+"::jsonb)");
   await signedOut(page);
   await signInTown(page,actors.OUTSIDER);
   await page.getByRole("heading",{name:"T46 Research Test Town"})
    .waitFor({timeout:50000});
   await page.getByRole("button",{name:"Bazaar / market",exact:true}).first().click({force:true});
   await page.locator('div[class*="marketCard"]').filter({hasText:"T46 Curio Merchant"})
    .first().getByRole("button",{name:"Browse Wares"}).click({force:true});
   side=page.locator(".town-profile-sidepanel");
   await side.getByTestId("t33-stage2-profile-ready").waitFor({timeout:50000});
   const stock=await holdActual(page,"**/rest/v1/character_stock*",
    stockReq(merchantId),"B4 T33 stock 200 before logout");
   const gp=await holdActual(page,"**/rest/v1/rpc/wallet_get",
    walletReq,"B4 T33 GP 200 before logout");
   try{
    await side.getByRole("button",{name:"Shop",exact:true}).click({force:true});
    const [oldStock,oldGp]=await Promise.all([stock.ready,gp.ready]);
    assert.equal(oldStock.status,200);
    assert.ok(oldStock.json.some(s=>s.display_name===heldName));
    assert.equal(oldGp.status,200);
    assert.equal(Number(oldGp.json),15);
    await signedOut(page);
    stock.release();gp.release();
    await Promise.all([stock.done(),gp.done()]);
    assert.equal(await page.locator(".town-profile-sidepanel").count(),0);
    console.log("PASS T46-C2B4-T33-LATE-STOCK-GP-GREEN: real signed 200 private wallet 15 and public stock returned after logout; actual 11 town evicted stale component before render");
   }finally{await stock.close();await gp.close()}
  }finally{await page.close().catch(()=>{})}
  await server.stop();server=null;
  // 10 without T33: retain held PR345 Stage2. It MUST NOT be certified as
  // Stage2-safe merely because the T28 merchant hook is actor guarded.
  server=await startNext({env,root,flagT28:1,flagT33:0});
  const t28Page=await browser.newPage({viewport:{width:1400,height:1060}});
  try{
   t28Page.on("pageerror",e=>errors.push("B4-10:"+e.message));
   await authIn(t28Page,server.origin,actors.OUTSIDER);
   const forbiddenReads=[];
   t28Page.on("response",r=>{
    if(/\/rest\/v1\/characters(?:\?|$)/.test(r.url())&&r.status()>=400)
     forbiddenReads.push({status:r.status(),url:r.url()});
   });
   const side=await gotoTown(t28Page,server.origin,townId);
   await side.getByRole("button",{name:"Profile",exact:true}).waitFor({timeout:35000});
   await t28Page.waitForFunction(()=>document.querySelector(".town-profile-sidepanel")?.textContent?.toLowerCase().includes("permission denied")||
    document.querySelector(".town-profile-sidepanel")?.textContent?.toLowerCase().includes("permission")||
    document.querySelector(".town-profile-sidepanel")?.textContent?.toLowerCase().includes("profile unavailable"),
    null,{timeout:20000}).catch(()=>{});
   assert.ok(forbiddenReads.length>0,
    "Unexpected T28-only raw profile SELECT acceptance under unchanged Stage2 ACL; inspect whether access contract changed");
   assert.equal(await side.getByTestId("t33-stage2-profile-ready").count(),0,
    "T28-only research route unexpectedly mounted Stage2-safe T33 profile");
   console.log("EXPECTED ORIGINAL T46-C2B4-FLAG-10-STAGE2-RED: actual signed T28=1/T33=0 town Profile attempts prohibited raw character SELECT under unchanged #345 Stage2; do not widen RLS or treat 10 as secure release");
  }finally{await t28Page.close().catch(()=>{})}
  console.log("PASS T46-C2B4-FLAG-MATRIX: 00 original B3 real browser GREEN receipts, 11 T28+T33 guarded real buyer/actor GREEN, 10 Stage2 privacy profile RED characterized, 01 source-equivalent to 00 and independent browser still open");
  console.log("PASS T46-C2B4-SIGNED-RESEARCH: source-derived T28+T33 current real town guarded buyer, postcommit correctness, real signed late 200, cross-role and Stage2 boundary; research-only no production patch");
  assert.deepEqual(offsite,[],"B4 attempted offsite Supabase "+offsite.join(","));
  assert.deepEqual(errors,[],"B4 Chromium uncaught errors "+errors.join(","));
 }finally{
  if(server)await server.stop();
  fs.writeFileSync(townPath,currentTown);
  assert.equal(fs.readFileSync(townPath,"utf8"),currentTown,
   "B4 did not restore original prior disposable town overlay");
 }
}
