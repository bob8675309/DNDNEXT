#!/usr/bin/env node
// T28-P1 imported from the existing genuine signed local C34 T26/T27 suite.
// No hosted requests, synthetic wallet+stock only, exact ORIGINAL shop/hook.
// This tests an intentionally persistent unsafe owner (RED) and independent
// scoped scratch candidate (GREEN). It is not deployed application behavior.
import assert from "node:assert/strict";

const timeout=(promise,label,ms=18000)=>Promise.race([
 promise,new Promise((_,reject)=>setTimeout(()=>reject(Error("T28 timed out: "+label)),ms))
]);
async function holdRealGet(page,glob,accept,label) {
 let release=()=>{},resolveReady=()=>{},resolveDone=()=>{},rejectReady=()=>{};
 const gate=new Promise(resolve=>{release=resolve;});
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
 const done=new Promise(resolve=>{resolveDone=resolve;});
 let captured=false,upstreamMeta=null,deliveryError=null;
 const handler=async route=>{
  const request=route.request();
  if(captured||request.method()!=="GET"&&!/\/rpc\/wallet_get/.test(request.url())||
      !accept(request)){
   try{await route.continue()}catch{}
   return;
  }
  captured=true;
  try{
   const upstream=await route.fetch();
   const parsed=await upstream.json();
   upstreamMeta={status:upstream.status(),parsed};
   resolveReady(upstreamMeta);
   await gate;
   await route.fulfill({response:upstream});
  }catch(err){
   deliveryError=String(err?.message || err);
   rejectReady(err);
  }finally{resolveDone();}
 };
 await page.route(glob,handler);
 return {
  ready:timeout(ready,label+" actual signed PostgREST GET"),
  release,done:()=>timeout(done,label+" delivery"),
  end:async()=>{release();await page.unroute(glob,handler);},
  status:()=>({captured,upstreamMeta,deliveryError})
 };
}
const isStock=id=>req=>{
 try{return new URL(req.url()).searchParams.get("character_id")==="eq."+id;}catch{return false;}
};
const isWallet=()=>req=>/\/rest\/v1\/rpc\/wallet_get(?:\?|$)/.test(req.url());

export async function runT28NonMapPersistentSignedBrowser({
 context,origin,localUrl,users,merchant,alternateMerchant,stockLabel,
 alternateStockLabel,expectedGmGp,offsite,errors
}) {
 const page=await context.newPage();
 const holders=[];
 const hold=async(...args)=>{const h=await holdRealGet(page,...args);holders.push(h);return h;};
 const auth=async(label)=>{
  const {email,password}=users[label];
  const id=await page.evaluate(async({email,password})=>{
   const {data,error}=await window.__sb.auth.signInWithPassword({email,password});
   if(error)throw Error(error.message);
   return data.user.id;
  },{email,password});
  assert.equal(id,users[label].id);
  await page.waitForFunction(id=>document.querySelector("[data-testid=t28-actor]")?.textContent===id,
   id,{timeout:12000});
 };
 const logout=async()=>{
  await page.evaluate(async()=>{
   const {error}=await window.__sb.auth.signOut();
   if(error)throw Error(error.message);
  });
  await page.getByTestId("t28-actor").getByText("ANON").waitFor({timeout:12000});
 };
 try{
  page.on("pageerror",e=>errors.push("T28:"+e.message));
  await page.route("**/*",async rt=>{
   const u=rt.request().url();
   if(u.startsWith(origin)||u.startsWith(localUrl))return rt.continue();
   if(/supabase\.co|supabase\.in|service_role/i.test(u))offsite.push("T28:"+u.slice(0,160));
   return rt.abort();
  });
  await page.goto(origin+"/__c34_t28_persistent_probe",{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForFunction(()=>!!window.__sb?.auth&&
   document.querySelector("[data-testid=t28-persistent-owner]")?.dataset.ready==="true",
   null,{timeout:30000});
  await page.getByTestId("t28-unsafe-wallet").getByText("0").waitFor({timeout:12000});
  assert.equal(await page.getByTestId("t28-actor").innerText(),"ANON",
   "Original negative control must be mounted BEFORE account signs in");
  await auth("GM");

  // REAL ORIGINAL RED: mount the current untouched MerchantPanel/useWallet
  // persistently, hold two AUTHORIZED PostgREST responses, log out while
  // both requests are in flight, then deliver their original pre-logout bytes.
  const stock=await hold("**/rest/v1/character_stock*",isStock(merchant),"original stock RED");
  await page.getByTestId("t28-original-open-shop").click();
  await page.getByTestId("t28-original-mounted-shop").waitFor({timeout:30000});
  const stockData=await stock.ready;
  assert.equal(stockData.status,200);
  assert.ok(Array.isArray(stockData.parsed)&&stockData.parsed.some(v=>v.display_name===stockLabel),
    "T28 original REAL signed stock must contain synthetic GM item");
  assert.equal(await page.getByTestId("t28-original-mounted-shop").getByText(stockLabel,{exact:true}).count(),0,
    "Stock reached merchant renderer before intentional hold");
  // Original MerchantPanel has its own hook; let its initial wallet request
  // complete before intercepting the specific imperative RAW refresh below.
  await page.waitForTimeout(500);
  const wallet=await hold("**/rest/v1/rpc/wallet_get",isWallet(),"original imperative wallet RED");
  await page.getByTestId("t28-original-refresh-wallet").click();
  const walletData=await wallet.ready;
  assert.equal(walletData.status,200);
  assert.equal(Number(walletData.parsed),expectedGmGp,
    "T28 wallet must contain actual GM-authorized local PostgREST data");
  assert.equal(await page.getByTestId("t28-unsafe-wallet").innerText(),"0");
  await logout();
  assert.equal(await page.getByTestId("t28-original-mounted-shop").count(),1,
    "T28 specifically tests original mounted owner retained through signout");
  stock.release();wallet.release();
  await Promise.all([stock.done(),wallet.done()]);
  await page.getByTestId("t28-original-mounted-shop")
   .getByRole("listbox",{name:"Merchant stock"})
   .getByRole("option",{name:new RegExp(stockLabel)}).waitFor({timeout:18000});
  await page.getByTestId("t28-unsafe-wallet").getByText(String(expectedGmGp)).waitFor({timeout:18000});
  assert.equal(stock.status().deliveryError,null);
  assert.equal(wallet.status().deliveryError,null);
  console.log("PASS T28-P1-RED: ORIGINAL mounted MerchantPanel + useWallet refresh accept real GM stock and GP responses AFTER SIGNED_OUT (scratch negative; not a deployed app proof)");
  await stock.end();await wallet.end();

  // The persistent owner remains; only the intentionally unsafe test lane
  // is detached. Candidate still does real signed PostgREST requests but its
  // state mutations are gated by actor+merchant request-epoch tickets.
  await page.getByTestId("t28-hide-unsafe").click();
  await page.getByTestId("t28-unsafe-original").waitFor({state:"detached"});
  await auth("GM");
  const guardedStock=await hold("**/rest/v1/character_stock*",isStock(merchant),"candidate late stock GREEN");
  const guardedWallet=await hold("**/rest/v1/rpc/wallet_get",isWallet(),"candidate late wallet GREEN");
  await page.getByTestId("t28-candidate-load").click();
  const [guardedStockData,guardedWalletData]=await Promise.all([guardedStock.ready,guardedWallet.ready]);
  assert.equal(guardedStockData.status,200);
  assert.ok(guardedStockData.parsed.some(v=>v.display_name===stockLabel));
  assert.equal(guardedWalletData.status,200);
  assert.equal(Number(guardedWalletData.parsed),expectedGmGp);
  await logout();
  assert.equal(await page.getByTestId("t28-persistent-owner").count(),1,
   "T28 candidate parent must survive SIGNED_OUT; not T27 parent unmount");
  guardedStock.release();guardedWallet.release();
  await Promise.all([guardedStock.done(),guardedWallet.done()]);
  await page.waitForTimeout(350);
  assert.equal(await page.getByTestId("t28-candidate-wallet").innerText(),"NONE");
  assert.equal(await page.getByTestId("t28-candidate-item").count(),0);
  assert.ok(!(await page.getByTestId("t28-candidate-scoped").innerText()).includes(stockLabel));
  assert.equal(guardedStock.status().deliveryError,null);
  assert.equal(guardedWallet.status().deliveryError,null);
  console.log("PASS T28-P1-GREEN: persistent NONMAP scratch parent rejects real late GM stock AND wallet_get bytes after signed logout");
  await guardedStock.end();await guardedWallet.end();

  // Distinguish merchant-selection from account scope. A merchant switch
  // invalidates only stock; in-flight wallet still belongs to this signed GM.
  await auth("GM");
  const switchStock=await hold("**/rest/v1/character_stock*",isStock(merchant),"merchant switch stock");
  const switchWallet=await hold("**/rest/v1/rpc/wallet_get",isWallet(),"merchant switch wallet");
  await page.getByTestId("t28-candidate-load").click();
  await Promise.all([switchStock.ready,switchWallet.ready]);
  await page.getByTestId("t28-switch-merchant").click();
  assert.equal(await page.getByTestId("t28-candidate-scoped").getAttribute("data-merchant-id"),
   alternateMerchant);
  switchStock.release();switchWallet.release();
  await Promise.all([switchStock.done(),switchWallet.done()]);
  await page.getByTestId("t28-candidate-wallet").getByText(String(expectedGmGp)).waitFor();
  assert.equal(await page.getByTestId("t28-candidate-item").count(),0,
   "Old selected merchant stock must not install after merchant switch");
  await switchStock.end();await switchWallet.end();
  await page.getByTestId("t28-candidate-load").click();
  await page.getByTestId("t28-candidate-scoped").getByText(alternateStockLabel,{exact:true})
   .waitFor({timeout:12000});
  assert.ok(!(await page.getByTestId("t28-candidate-stock").innerText()).includes(stockLabel));
  console.log("PASS T28-P1-SWITCH: signed GM merchant change rejects old stock but preserves same-account wallet refresh");

  // An outsider has no access to the prior GM wallet, even with a public
  // separately RLS-authorized merchant shelf. This proves auth switch from
  // the *actual* local GoTrue session, not fabricated identity fields.
  await logout();
  await auth("OUTSIDER");
  await page.getByTestId("t28-candidate-load").click();
  await page.getByTestId("t28-candidate-wallet").getByText("0").waitFor({timeout:12000});
  await page.getByTestId("t28-candidate-scoped").getByText(alternateStockLabel,{exact:true})
   .waitFor({timeout:12000});
  assert.notEqual(await page.getByTestId("t28-candidate-wallet").innerText(),
   String(expectedGmGp),"Outsider may not inherit GM GP");
  await logout();
  assert.equal(await page.getByTestId("t28-candidate-wallet").innerText(),"NONE");
  assert.equal(await page.getByTestId("t28-candidate-item").count(),0);
  console.log("PASS T28-P1-ROLE: original local GoTrue outsider cannot inherit GM GP across account switch, candidate clears on logout");
 }finally{
  for(const h of holders)await h.end().catch(()=>{});
  await page.close().catch(()=>{});
 }
}
