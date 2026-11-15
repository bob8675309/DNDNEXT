#!/usr/bin/env node
// C34 T28-P2 mounted non-map signed Next/GoTrue/PostgREST/PG17 acceptance.
// Run ONLY via preexisting disposable-local T26 runner after original T28-P1.
// Exact ORIGINAL buy_from_merchant executes; wallet_get/set P2 fixtures synthetic.
import assert from "node:assert/strict";

const bounded=(promise,name,ms=24000)=>Promise.race([
 promise,new Promise((_,reject)=>setTimeout(()=>reject(Error("T28-P2 timeout: "+name)),ms))
]);
async function holdSigned(page,glob,accept,name) {
 let release,readyResolve,readyReject,doneResolve;
 const gate=new Promise(resolve=>{release=resolve});
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject});
 const done=new Promise(resolve=>{doneResolve=resolve});
 let captured=false,deliveryError=null,capturedResult=null;
 const handler=async route=>{
  const req=route.request();
  if(captured||!accept(req)){await route.continue().catch(()=>{});return;}
  captured=true;
  try {
   const upstream=await route.fetch();
   const parsed=await upstream.json();
   capturedResult={status:upstream.status(),parsed};
   readyResolve(capturedResult);
   await gate;
   await route.fulfill({response:upstream});
  } catch(error) {
   deliveryError=String(error?.message||error);
   readyReject(error);
  } finally {doneResolve();}
 };
 await page.route(glob,handler);
 return {
  ready:bounded(ready,name+" signed PostgREST response"),
  release,done:()=>bounded(done,name+" browser delivery"),
  end:async()=>{release();await page.unroute(glob,handler);},
  state:()=>({captured,deliveryError,capturedResult})
 };
}
const stockRequest=id=>r=>{
 if(r.method()!=="GET")return false;
 try{return new URL(r.url()).searchParams.get("character_id")==="eq."+id}
 catch{return false}
};
const walletRequest=r=>r.method()==="POST" && /\/rest\/v1\/rpc\/wallet_get(?:\?|$)/.test(r.url());
const buyRequest=r=>r.method()==="POST" && /\/rest\/v1\/rpc\/buy_from_merchant(?:\?|$)/.test(r.url());
const q=s=>{assert.match(s,/^[a-f0-9-]{36}$/i);return "'"+s+"'"};

export async function runT28P2MountedCommerceSignedBrowser({
 context,origin,localUrl,users,merchant,alternateMerchant,
 stockId,stockLabel,alternateStockLabel,offsite,errors,inspect
}) {
 const page=await context.newPage(),holders=[];
 const hold=async(...args)=>{const h=await holdSigned(page,...args);holders.push(h);return h};
 const value=()=>page.getByTestId("t28p2-wallet-value");
 const shop=()=>page.getByTestId("t28p2-mounted-shop");
 const waitValue=async target=>page.waitForFunction(target=>
  document.querySelector('[data-testid="t28p2-wallet-value"]')?.textContent===String(target),
  String(target),{timeout:18000});
 const waitActor=async target=>page.waitForFunction(target=>
  document.querySelector('[data-testid="t28p2-actor"]')?.textContent===target,
  target,{timeout:18000});
 const signIn=async label=>{
  const {email,password,id}=users[label];
  const signed=await page.evaluate(async input=>{
   const {data,error}=await window.__sb.auth.signInWithPassword({
    email:input.email,password:input.password
   });
   if(error)throw Error(error.message);
   return data.user.id;
  },{email,password});
  assert.equal(signed,id);
  await waitActor(id);
 };
 const signOut=async()=>{
  await page.evaluate(async()=>{
   const {error}=await window.__sb.auth.signOut();
   if(error)throw Error(error.message);
  });
  await waitActor("ANON");
 };
 const hasItem=async label=>await shop().getByText(label,{exact:true}).count();
 try {
  page.on("pageerror",e=>errors.push("T28-P2:"+e.message));
  await page.route("**/*",async route=>{
   const url=route.request().url();
   if(url.startsWith(origin)||url.startsWith(localUrl))return route.continue();
   if(/supabase\.co|supabase\.in|service_role/i.test(url))offsite.push("T28-P2:"+url.slice(0,160));
   return route.abort();
  });
  await page.goto(origin+"/__c34_t28_p2_probe",{waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForFunction(()=>document.querySelector('[data-testid="t28p2-root"]')?.dataset.ready==="true"
   &&!!window.__sb?.auth,null,{timeout:60000});
  assert.equal(await page.getByTestId("t28p2-actor").innerText(),"ANON");
  assert.equal(await value().innerText(),"NONE");
  assert.equal(await shop().count(),1,"Original-source-derived shop must persist");

  await signIn("GM");
  await waitValue(79);
  await shop().getByText(stockLabel,{exact:true}).first().waitFor({timeout:20000});
  console.log("PASS T28-P2-MOUNT: source-derived real merchant and wallet signed current Next/React and PG17");

  // Withhold genuine authorized 200 responses from BOTH guarded mounted components.
  // A same-actor switch starts the old merchant's fresh stock request.
  await page.getByTestId("t28p2-switch-merchant").click();
  await shop().getByText(alternateStockLabel,{exact:true}).first().waitFor({timeout:20000});
  const delayedStock=await hold("**/rest/v1/character_stock*",stockRequest(merchant),"P2 original stock hold");
  await page.getByTestId("t28p2-switch-merchant").click();
  await page.waitForFunction(id=>
   document.querySelector('[data-testid="t28p2-merchant-id"]')?.textContent===id,
   merchant,{timeout:15000});
  const stockData=await delayedStock.ready;
  assert.equal(stockData.status,200);
  assert.ok(Array.isArray(stockData.parsed)&&stockData.parsed.some(row=>row.display_name===stockLabel));
  const delayedWallet=await hold("**/rest/v1/rpc/wallet_get",walletRequest,"P2 wallet hold");
  await page.getByTestId("t28p2-wallet-refresh").click();
  const walletData=await delayedWallet.ready;
  assert.equal(walletData.status,200);
  assert.equal(Number(walletData.parsed),79);
  await signOut();
  await waitValue("NONE");
  delayedStock.release();delayedWallet.release();
  await Promise.all([delayedStock.done(),delayedWallet.done()]);
  await page.waitForTimeout(350);
  assert.equal(await value().innerText(),"NONE");
  assert.equal(await hasItem(stockLabel),0);
  assert.equal(await shop().count(),1,"Non-map merchant must stay mounted across logout");
  assert.equal(delayedStock.state().deliveryError,null);
  assert.equal(delayedWallet.state().deliveryError,null);
  console.log("PASS T28-P2-LATE: ORIGINAL-source-shaped guarded merchant and wallet reject genuine signed 200 stock/GP delivered after logout");

  // Same signed GM may switch target wallet; P2 scratch security allows Admin.
  await signIn("GM");
  await waitValue(79);
  await page.getByTestId("t28p2-select-wallet-other").click();
  await waitValue(0);
  await page.getByTestId("t28p2-select-wallet-self").click();
  await waitValue(79);
  console.log("PASS T28-P2-TARGET: real signed local Admin wallet target changes 79→0→79 without actor switch");

  // Synthetic P2 wallet_set has explicit Admin-only ACL; actual client hook's
  // set() uses its unchanged original p_user/p_amount RPC shape and guarded refresh.
  await page.getByTestId("t28p2-wallet-set").click();
  await waitValue(66);
  assert.equal(inspect("SELECT gp FROM public.player_wallets WHERE user_id="+q(users.GM.id)),"66");
  console.log("PASS T28-P2-SET: synthetic local Admin wallet_set 66, guarded real signed refresh, database reconciled");

  // Execute SOURCE-ORIGINAL real production buy_from_merchant SQL in scratch.
  await shop().getByRole("button",{name:/Buy for 12 gp/}).first().click();
  await waitValue(54);
  assert.equal(inspect("SELECT gp FROM public.player_wallets WHERE user_id="+q(users.GM.id)),"54");
  assert.equal(inspect("SELECT qty FROM public.character_stock WHERE id="+q(stockId)),"2");
  assert.equal(inspect("SELECT count(*) FROM public.inventory_items WHERE user_id="+q(users.GM.id)),"1");
  console.log("PASS T28-P2-BUY: source-original buy_from_merchant atomic debit, stock qty and inventory row 66→54");

  // A second genuinely accepted buy is held AFTER the server commits but
  // BEFORE the original-source-derived MerchantPanel receives success.
  const delayedBuy=await hold("**/rest/v1/rpc/buy_from_merchant",buyRequest,"P2 original buy callback hold");
  await shop().getByRole("button",{name:/Buy for 12 gp/}).first().click();
  const purchaseData=await delayedBuy.ready;
  assert.equal(purchaseData.status,200,"Original source purchase must have committed");
  assert.equal(inspect("SELECT gp FROM public.player_wallets WHERE user_id="+q(users.GM.id)),"42");
  assert.equal(inspect("SELECT qty FROM public.character_stock WHERE id="+q(stockId)),"1");
  await signOut();
  await waitValue("NONE");
  delayedBuy.release();await delayedBuy.done();
  await page.waitForTimeout(350);
  assert.equal(await value().innerText(),"NONE");
  assert.ok(!(await shop().innerText()).includes("Purchased "+stockLabel),
    "Late original server purchase response must NOT create a signed-out success notice");
  assert.equal(inspect("SELECT count(*) FROM public.inventory_items WHERE user_id="+q(users.GM.id)),"2");
  console.log("PASS T28-P2-BUY-LATE: original server transaction committed once, stale post-logout success UI suppressed");

  // Opposing role sees ONLY own wallet and cannot call Admin-only wallet_set.
  await signIn("OUTSIDER");
  await waitValue(0);
  await shop().getByText(stockLabel,{exact:true}).first().waitFor({timeout:20000});
  const forbidden=await users.OUTSIDER.who.rpc("wallet_set",{p_user:null,p_amount:999});
  assert.ok(forbidden.error,"Outsider may not set a wallet");
  assert.equal(forbidden.error.code,"42501");
  const forbiddenOther=await users.OUTSIDER.who.rpc("wallet_get",{p_user:users.GM.id});
  assert.ok(forbiddenOther.error,"Outsider may not read GM wallet");
  assert.equal(forbiddenOther.error.code,"42501");
  // Original buy function must refuse a signed outsider with GP 0 without
  // stock/owner mutation; merchant shelf is visible by current signed policy.
  const outsiderBuy=await users.OUTSIDER.who.rpc("buy_from_merchant",{
   p_merchant_id:merchant,p_stock_uuid:stockId,p_qty:1
  });
  assert.ok(outsiderBuy.error,"Insufficient-funds original buy unexpectedly accepted");
  assert.equal(inspect("SELECT qty FROM public.character_stock WHERE id="+q(stockId)),"1");
  assert.equal(inspect("SELECT count(*) FROM public.inventory_items WHERE user_id="+q(users.OUTSIDER.id)),"0");
  console.log("PASS T28-P2-ROLES: outsider cannot set/read GM GP or buy unaffordable item; no unauthorized ledger or stock change");
  await signOut();
  await waitValue("NONE");
 } finally {
  for(const h of holders)await h.end().catch(()=>{});
  await page.close().catch(()=>{});
 }
}
