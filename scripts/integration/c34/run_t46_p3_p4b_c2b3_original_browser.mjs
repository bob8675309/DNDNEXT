// T46-P3-P4B-C2-B3: signed disposable CURRENT-source commerce race characterization.
// Research only: no hosted SQL, product imports, protected map, or released correction.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto, {randomUUID} from "node:crypto";

const COPY="components/__c34_c2b3_original_merchant_probe.jsx";
const ROUTE="pages/__c34_t46_c2b3_original_probe.jsx";
const ORIGINAL_MERCHANT_BLOB="22e4d0810603bc0322904573cb5fe0c14bad1f88";
const ORIGINAL_WALLET_BLOB="f34b99f1d6eee66420d57bdcefdc6d3427092e25";
const ORIGINAL_MAP_BLOB="61f8738da2ca3d8635b5a413bfdc18c094228a0a";
const sha=data=>crypto.createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+data.length+"\0"),data])).digest("hex");
const bounded=(p,label)=>Promise.race([
 p,new Promise((_,reject)=>setTimeout(()=>reject(Error("C2-B3 timed out "+label)),26000))
]);

export function writeC2B3OriginalProbe(root,merchantBytes,merchantId){
 assert.equal(sha(merchantBytes),ORIGINAL_MERCHANT_BLOB);
 assert.equal(sha(fs.readFileSync(path.join(root,"utils/useWallet.js"))),ORIGINAL_WALLET_BLOB);
 assert.equal(sha(fs.readFileSync(path.join(root,"components/MapPageClient.js"))),ORIGINAL_MAP_BLOB);
 assert.match(merchantId,/^[0-9a-f-]{36}$/i);
 for(const rel of [COPY,ROUTE])assert.ok(!fs.existsSync(path.join(root,rel)),
  "Refuse preexisting original-commerce probe "+rel);
 // Exact bytes copied BEFORE the unrelated held #345 Return-to-Profile overlay
 // changes the checked-in MerchantPanel's temporary filesystem representation.
 fs.writeFileSync(path.join(root,COPY),merchantBytes,{flag:"wx"});
 const probe=[
  "// DISPOSABLE T46 C2-B3 original-byte MerchantPanel mount; NEVER COMMIT.",
  'import {useEffect,useState} from "react";',
  'import MerchantPanel from "../components/__c34_c2b3_original_merchant_probe";',
  'import {supabase} from "../utils/supabaseClient";',
  "const merchant="+JSON.stringify({
   id:merchantId,name:"T46 Curio Merchant",kind:"merchant",storefront_enabled:true
  })+";",
  "export default function C2B3OriginalProbe(){",
  ' const [actor,setActor]=useState(null); const [show,setShow]=useState(false);',
  " useEffect(()=>{",
  "  window.__c34B3Supabase=supabase;",
  "  const {data}=supabase.auth.onAuthStateChange((event,session)=>{",
  "   setActor(session?.user?.id||null);",
  "  });",
  "  return ()=>{data?.subscription?.unsubscribe();delete window.__c34B3Supabase;};",
  " },[]);",
  ' return <main data-testid="c2b3-root">',
  '  <output data-testid="c2b3-actor">{actor||"ANON"}</output>',
  '  <button type="button" data-testid="c2b3-mount" onClick={()=>setShow(true)}>Mount original storefront</button>',
  '  {show?<section data-testid="c2b3-original-mounted"><MerchantPanel merchant={merchant}',
  '    isAdmin={false} locations={[]} presentation="panel" onClose={()=>setShow(false)} /></section>:null}',
  ' </main>;',
  "}"
 ].join("\n")+"\n";
 fs.writeFileSync(path.join(root,ROUTE),probe,{flag:"wx"});
 assert.equal(sha(fs.readFileSync(path.join(root,COPY))),ORIGINAL_MERCHANT_BLOB);
 return {copy:COPY,route:ROUTE};
}

export function removeC2B3Probe(root){
 for(const rel of [ROUTE,COPY]){
  if(fs.existsSync(path.join(root,rel)))fs.rmSync(path.join(root,rel));
 }
}

async function holdResponse(page,glob,match,label){
 let unlock,signalReady,signalError,signalDone;
 const gate=new Promise(resolve=>{unlock=resolve});
 const ready=new Promise((resolve,reject)=>{signalReady=resolve;signalError=reject});
 const done=new Promise(resolve=>{signalDone=resolve});
 let captured=false;
 const handler=async route=>{
  if(captured||!match(route.request())){await route.continue();return}
  captured=true;
  try{
   const upstream=await route.fetch();
   const result={status:upstream.status(),body:await upstream.json()};
   signalReady(result);
   await gate;
   await route.fulfill({response:upstream});
  }catch(error){signalError(error);throw error}
  finally{signalDone()}
 };
 await page.route(glob,handler);
 return {
  ready:bounded(ready,label+" real upstream"),
  release:()=>unlock(),
  done:()=>bounded(done,label+" delayed delivery"),
  close:async()=>{unlock();await page.unroute(glob,handler)}
 };
}
const stockReq=id=>r=>{
 try{return r.method()==="GET"&&
  new URL(r.url()).searchParams.get("character_id")==="eq."+id}
 catch{return false}
};
const walletReq=r=>r.method()==="POST"&&
 /\/rest\/v1\/rpc\/wallet_get(?:\?|$)/.test(r.url());
const buyerReq=r=>r.method()==="POST"&&
 /\/rest\/v1\/rpc\/buy_from_merchant(?:\?|$)/.test(r.url());

export async function runC2B3SignedCommerce({
 root,browser,origin,page,side,actors,merchantId,visitingMerchantId,
 sql,q,lit,walletOf,invCount
}){
 const buyer=actors.OUTSIDER;
 assert.equal(walletOf(buyer.id),"36","B3 must inherit all unchanged B2 browser + guarded RPC receipts");
 const before=Number(invCount(buyer.id));
 const firstStock=randomUUID(), firstName="T46 C2B3 Committed Refresh Item";
 sql("INSERT INTO public.character_stock(id,character_id,item_id,display_name,price_gp,qty,card_payload) VALUES("+
  q(firstStock)+","+q(merchantId)+",'c2b3-refresh',"+lit(firstName)+",5,2,"+
  lit(JSON.stringify({item_type:"Potion",item_rarity:"Common"}))+"::jsonb)");
 await side.getByRole("button",{name:"Let me browse your wares."}).click({force:true});
 const shelf=side.getByRole("listbox",{name:"Merchant stock"});
 await shelf.getByRole("option",{name:new RegExp(firstName)}).click({force:true});
 await side.locator(".merchant-preview-purchase").getByText("36 gp",{exact:true})
  .waitFor({timeout:26000});

 // Genuine server-side purchase commits; only the FOLLOW-UP wallet read is
 // deliberately failed. Original handleBuy reports failure despite the debit.
 const readFailure="C2B3 wallet read unavailable AFTER committed purchase";
 let faultCount=0;
 const walletFault=async route=>{
  faultCount++;
  await route.fulfill({status:503,contentType:"application/json",
   body:JSON.stringify({code:"PGRST500",message:readFailure})});
 };
 await page.route("**/rest/v1/rpc/wallet_get",walletFault);
 try{
  const responsePromise=page.waitForResponse(buyerReq,{timeout:32000});
  await side.getByRole("button",{name:"Buy for 5 gp",exact:true}).click({force:true});
  const result=await responsePromise;
  assert.equal(result.status(),200,"Signed guarded buyer did not commit before refresh failure");
  assert.equal(Number(await result.json()),1);
  await side.locator(".merchant-market-notice").filter({hasText:readFailure})
   .waitFor({timeout:32000});
  assert.ok(faultCount>=1,"No genuine browser wallet-refresh request was faulted");
  assert.equal(walletOf(buyer.id),"31","Buyer server GP must commit 36→31 despite error UI");
  assert.equal(sql("SELECT qty::text FROM public.character_stock WHERE id="+q(firstStock)),"1");
  assert.equal(Number(invCount(buyer.id)),before+1);
  assert.ok(!(await side.locator(".merchant-market-notice").innerText()).includes("Purchased "+firstName),
   "Original post-commit failure wrongly claimed success");
  console.log("EXPECTED ORIGINAL T46-C2B3-POSTCOMMIT-RED: real guarded purchase committed 36→31/2→1/one item, unchanged original MerchantPanel misleadingly displayed wallet_get 503 as purchase error");
 }finally{
  await page.unroute("**/rest/v1/rpc/wallet_get",walletFault);
 }
 await side.getByRole("button",{name:"Return to Profile"}).click({force:true});
 await side.locator(".npc-profile-description-card").waitFor({timeout:30000});

 // True original MerchantPanel bytes in separate disposable Next route.
 // The active real town needs a Profile Return button only for its own test;
 // this original-byte clone deliberately avoids that research overlay.
 const secondStock=randomUUID(),secondName="T46 C2B3 Delayed Buyer Charm";
 sql("INSERT INTO public.character_stock(id,character_id,item_id,display_name,price_gp,qty,card_payload) VALUES("+
  q(secondStock)+","+q(merchantId)+",'c2b3-delayed',"+lit(secondName)+",4,2,"+
  lit(JSON.stringify({item_type:"Potion",item_rarity:"Common"}))+"::jsonb)");
 const pageErrors=[];
 const auth=async p=>{
  await p.waitForFunction(()=>!!window.__c34B3Supabase?.auth,null,{timeout:30000});
  const id=await p.evaluate(async input=>{
   const {data,error}=await window.__c34B3Supabase.auth.signInWithPassword(input);
   if(error)throw Error(error.message);
   return data.user.id;
  },{email:buyer.email,password:buyer.password});
  assert.equal(id,buyer.id);
  await p.getByTestId("c2b3-actor").getByText(buyer.id).waitFor({timeout:15000});
 };
 const logout=async p=>{
  await p.evaluate(async()=>{
   const {error}=await window.__c34B3Supabase.auth.signOut();
   if(error)throw Error(error.message);
  });
  await p.getByTestId("c2b3-actor").getByText("ANON").waitFor({timeout:15000});
 };
 const sourcePage=await browser.newPage({viewport:{width:1400,height:1060}});
 try{
  sourcePage.on("pageerror",error=>pageErrors.push(error.message));
  await sourcePage.goto(origin+"/__c34_t46_c2b3_original_probe",{
   waitUntil:"domcontentloaded",timeout:85000});
  await auth(sourcePage);
  const stock=await holdResponse(sourcePage,"**/rest/v1/character_stock*",
   stockReq(merchantId),"B3 original stock signed 200");
  const wallet=await holdResponse(sourcePage,"**/rest/v1/rpc/wallet_get",
   walletReq,"B3 original wallet signed 200");
  try{
   await sourcePage.getByTestId("c2b3-mount").click();
   const [stock200,gp200]=await Promise.all([stock.ready,wallet.ready]);
   assert.equal(stock200.status,200);
   assert.equal(gp200.status,200);
   assert.ok(stock200.body.some(row=>row.display_name===secondName));
   assert.equal(Number(gp200.body),31);
   await logout(sourcePage);
   assert.equal(await sourcePage.getByTestId("c2b3-original-mounted").count(),1);
   stock.release();wallet.release();
   await Promise.all([stock.done(),wallet.done()]);
   const original=sourcePage.getByTestId("c2b3-original-mounted");
   await original.getByRole("listbox",{name:"Merchant stock"})
    .getByRole("option",{name:new RegExp(secondName)}).waitFor({timeout:24000});
   await original.locator(".merchant-preview-purchase").getByText("31 gp",{exact:true})
    .waitFor({timeout:24000});
   console.log("EXPECTED ORIGINAL T46-C2B3-LATE-STOCK-WALLET-RED: unchanged source MerchantPanel/useWallet rendered 200 signed stock and 31 GP after logout in persistent scratch owner");
  }finally{await stock.close();await wallet.close()}
 }finally{await sourcePage.close().catch(()=>{})}
 assert.deepEqual(pageErrors,[],"C2-B3 original mounted page exceptions");

 // Separate fresh signed browser repeats the original late BUY case. Hold a
 // completed 200 HTTP body, not a synthetic/mock response, across real logout.
 const latePage=await browser.newPage({viewport:{width:1400,height:1060}});
 const lateErrors=[];
 try{
  latePage.on("pageerror",error=>lateErrors.push(error.message));
  await latePage.goto(origin+"/__c34_t46_c2b3_original_probe",{
   waitUntil:"domcontentloaded",timeout:85000});
  await auth(latePage);
  await latePage.getByTestId("c2b3-mount").click();
  const original=latePage.getByTestId("c2b3-original-mounted");
  await original.getByRole("listbox",{name:"Merchant stock"})
   .getByRole("option",{name:new RegExp(secondName)}).click({force:true});
  await original.locator(".merchant-preview-purchase").getByText("31 gp",{exact:true})
   .waitFor({timeout:25000});
  const beforeLate=Number(invCount(buyer.id));
  const buy=await holdResponse(latePage,"**/rest/v1/rpc/buy_from_merchant",
   buyerReq,"B3 original late buyer response");
  try{
   await original.getByRole("button",{name:"Buy for 4 gp",exact:true}).click({force:true});
   const accepted=await buy.ready;
   assert.equal(accepted.status,200);
   assert.equal(Number(accepted.body),1);
   assert.equal(walletOf(buyer.id),"27");
   assert.equal(sql("SELECT qty::text FROM public.character_stock WHERE id="+q(secondStock)),"1");
   assert.equal(Number(invCount(buyer.id)),beforeLate+1);
   await logout(latePage);
   assert.equal(await original.count(),1,"Original shop intentionally persists across logout");
   buy.release();
   await buy.done();
   // The current original async purchase path does not validate actor
   // generation before scheduling post-commit fetchStock/refreshWallet.
   await original.locator(".merchant-preview-purchase").getByText("31 gp",{exact:true})
    .waitFor({timeout:22000});
   console.log("EXPECTED ORIGINAL T46-C2B3-LATE-BUY-RED: guarded real signed buyer committed 31→27/2→1/one item, its real 200 response delivered AFTER logout to mounted original MerchantPanel (stale GP retained)");
  }finally{await buy.close()}
 }finally{await latePage.close().catch(()=>{})}
 assert.deepEqual(lateErrors,[],"C2-B3 late buy original page exceptions");
 // Review-only flag matrix: T33 can only select safe Profile while T28 is ON.
 const town=fs.readFileSync(path.join(root,"pages/town/[id].js"),"utf8");
 assert.match(town,/T28_P2_TOWN_SHOP_ENABLED = process\.env\.NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP === "1"/);
 assert.match(town,/T33_TOWN_SAFE_ENABLED = T28_P2_TOWN_SHOP_ENABLED && process\.env\.NEXT_PUBLIC_C34_T33_TOWN_STAGE2_SAFE_PROFILE === "1"/);
 const matrix=[[0,0,"original"],[0,1,"original"],[1,0,"t28-research"],[1,1,"t33-research"]];
 for(const [t28,t33,expected] of matrix){
  const value=t28?(t33?"t33-research":"t28-research"):"original";
  assert.equal(value,expected);
 }
 console.log("PASS T46-C2B3-FLAG-SOURCE: original 00/01, T28 10, T33 11 source-derived branches; ON variant REAL-browser parity remains untested");
 console.log("PASS T46-C2B3-SIGNED-RESEARCH: original-byte late stock/wallet/buyer 200 RED, actual guarded browser postcommit wallet-refresh false-error RED; source+role/stock provenance preserved, NO production fix");
}
