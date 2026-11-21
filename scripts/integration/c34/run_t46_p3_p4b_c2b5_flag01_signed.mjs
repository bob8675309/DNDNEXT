// T46-P3-P4B-C2-B5: signed original-current-town 00 vs 01 flag parity.
// Research only; called by existing B4 fixture AFTER all B2/B3/B4 checks.
// T28 OFF: T33=1 must NOT secretly activate T33/T28 guarded descendants.
// No hosted endpoints, no source modifications, no production SQL or map edits.
import assert from "node:assert/strict";

const buyerRequest=r=>r.method()==="POST"&&
 /\/rest\/v1\/rpc\/buy_from_merchant(?:\?|$)/.test(r.url());

async function openOriginalShop(side,stockName){
 await side.getByRole("button",{name:"Let me browse your wares."}).click({force:true});
 const stockOption=side.getByRole("listbox",{name:"Merchant stock"})
  .getByRole("option",{name:new RegExp(stockName)});
 await stockOption.waitFor({timeout:40000});
 // Stock existence is NOT selection. The original source sorts the shelf by
 // display_name and defaults to the first row, often a different price.
 await stockOption.click({force:true});
 await side.getByRole("button",{name:"Buy for 3 gp",exact:true})
  .waitFor({timeout:25000});
}
async function signOut(page){
 const error=await page.evaluate(async()=>{
  const {error}=await window.__c34B4Auth.auth.signOut();
  return error?.message||null;
 });
 assert.equal(error,null,"B5 genuine logout failed");
}
async function confirmDeniedClientRights(page,priorManagerId,merchantId){
 const result=await page.evaluate(async ids=>{
  const dossier=await window.__c34B4Auth.rpc("get_npc_dossier_admin_v1",
   {p_character_id:ids.merchantId});
  const otherWallet=await window.__c34B4Auth.rpc("wallet_get",
   {p_user:ids.priorManagerId});
  const who=await window.__c34B4Auth.auth.getUser();
  return {
   actorId:who.data?.user?.id||null,
   dossierData:dossier.data,
   dossierCode:dossier.error?.code||null,
   walletData:otherWallet.data,
   walletCode:otherWallet.error?.code||null
  };
 },{priorManagerId,merchantId});
 assert.equal(result.dossierCode,"42501",
  "Signed nonmanager unexpectedly granted original GM dossier: "+JSON.stringify(result));
 assert.equal(result.walletCode,"42501",
  "Signed nonmanager unexpectedly read a different actor's GP: "+JSON.stringify(result));
 assert.equal(result.dossierData,null);
 assert.equal(result.walletData,null);
 return result;
}

export async function runT46C2B5Flag01Town({
 env,root,browser,startNext,authIn,gotoTown,signInTown,
 actors,townId,merchantId,sql,q,lit,walletOf,invCount
}){
 assert.equal(env.CI,"true");
 assert.equal(env.GITHUB_ACTIONS,"true");
 assert.equal(env.DNDNEXT_C34_LOCAL_CONFIRM,"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY");
 assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
 assert.equal(walletOf(actors.OUTSIDER.id),"15",
  "B5 must run after signed accepted B4 buyer 27→21→15");
 assert.equal(walletOf(actors.OTHER.id),"0");
 assert.equal(sql("SELECT pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure) ILIKE '%Merchant unavailable%'"),"t",
  "B5 must retain source-derived B2 guarded buyer eligibility");
 const stockId=sql("SELECT id::text FROM public.character_stock WHERE display_name='T46 C2B4 Late Safe Stock' AND character_id="+q(merchantId));
 assert.match(stockId,/^[a-f0-9-]{36}$/i);
 assert.equal(sql("SELECT qty::text FROM public.character_stock WHERE id="+q(stockId)),"2");
 const stockName="T46 C2B4 Late Safe Stock",snapshots=[];
 let activeServer=null;
 try{
  for(const t33 of [0,1]){
   // Real Next.js compilation under TWO distinct compile-time flag values.
   // The previous B4 server has already been stopped; use same signed data.
   activeServer=await startNext({env,root,flagT28:0,flagT33:t33});
   const origin=activeServer.origin;
   const page=await browser.newPage({viewport:{width:1400,height:1060}});
   const errors=[],offsite=[],apiRequests=[];
   try{
    page.on("pageerror",e=>errors.push("B5-0"+t33+":"+e.message));
    page.on("request",r=>{
     if(r.url().includes("/rest/v1/"))apiRequests.push(r.url());
    });
    await page.route("**/*",rt=>{
     const url=rt.request().url();
     if(url.startsWith(origin)||url.startsWith(env.DNDNEXT_C34_LOCAL_URL)||
        url.startsWith("ws://127.0.0.1:"))return rt.continue();
     if(/supabase\.co|service_role/i.test(url))offsite.push(url.slice(0,180));
     return rt.abort();
    });
    await authIn(page,origin,actors.DM);
    let side=await gotoTown(page,origin,townId);
    await side.getByTestId("t46-intel").waitFor({timeout:50000});
    await side.locator(".npc-name").getByText("T46 Curio Merchant",{exact:true})
     .waitFor({timeout:45000});
    assert.equal(await side.getByTestId("t33-stage2-profile-ready").count(),0,
     "T33 UI unexpectedly mounted while T28=0 and T33="+t33);
    const profile=side.getByRole("button",{name:"Profile",exact:true});
    await profile.waitFor({timeout:30000});
    assert.match(await profile.getAttribute("class")||"",/\bbtn-primary\b/,
     "Original T46 Profile-first entry lost under 0"+t33);
    const managerDossier=(await side.innerText()).includes("NPC Dossier & Player Reveals");
    assert.equal(managerDossier,true,"Signed DM lost original manager dossier under 0"+t33);
    assert.equal(await side.getByRole("button",{name:"Return to Profile"}).count(),0);
    await openOriginalShop(side,stockName);
    await side.getByRole("button",{name:"Merchant tools",exact:true})
     .waitFor({timeout:30000});
    await side.locator(".merchant-preview-purchase").getByText("0 gp",{exact:true})
     .waitFor({timeout:30000});
    const dmSnapshot={
     profileSelected:true,merchantName:"T46 Curio Merchant",
     originalIntel:true,stage2T33Ready:false,managerDossier:true,
     merchantTools:true,stockName,stockQty:"2",managerWallet:"0 gp"
    };
    assert.ok(apiRequests.some(s=>s.includes("/rest/v1/rpc/c34_t46_get_town_presence_v1")),
     "B5 actual town stopped using local signed presence RPC");
    assert.ok(apiRequests.some(s=>s.includes("/rest/v1/character_stock?")),
     "B5 original actual MerchantPanel did not request real signed PostgREST stock");
    assert.ok(!apiRequests.some(s=>s.includes("/rest/v1/rpc/c34_game_manager_capabilities_research_v1")),
     "B5 0"+t33+" unexpectedly loaded protected T33 manager capability RPC");
    await signOut(page);
    // T28=0 contains NO actor-boundary teardown. Capture actual DOM state,
    // compare 00 vs 01 rather than inventing a claim that this is secure.
    await page.waitForTimeout(300);
    const afterLogout={
     panelMounted:(await page.locator(".town-profile-sidepanel").count())===1,
     dmEditorStillRendered:(await side.getByRole("button",{name:"Merchant tools",exact:true}).count())>0,
     t33ProfileReady:(await side.getByTestId("t33-stage2-profile-ready").count())>0
    };
    await signInTown(page,actors.OTHER);
    const denied=await confirmDeniedClientRights(page,actors.DM.id,merchantId);
    assert.equal(denied.actorId,actors.OTHER.id);
    console.log("PASS T46-C2B5-FLAG-0"+t33+"-SERVER-DENY: real signed 0-GP player cannot call GM dossier or another account's wallet despite any retained old client DOM");
    // A fresh route navigation MUST recompute server-current role for the
    // newly signed actor; do not equate stale DOM with valid server rights.
    side=await gotoTown(page,origin,townId);
    await side.getByTestId("t46-intel").waitFor({timeout:50000});
    assert.ok(!(await side.innerText()).includes("NPC Dossier & Player Reveals"),
     "Fresh nonmanager Profile showed a previous DM's private dossier");
    assert.equal(await side.getByTestId("t33-stage2-profile-ready").count(),0);
    await openOriginalShop(side,stockName);
    assert.equal(await side.getByRole("button",{name:"Merchant tools",exact:true}).count(),0);
    await side.locator(".merchant-preview-purchase").getByText("0 gp",{exact:true})
     .waitFor({timeout:30000});
    const playerSnapshot={
     isCurrentPlayer:true,managerDossier:false,
     merchantTools:false,originalIntel:true,
     stockName,stockQty:"2",playerWallet:"0 gp",
     deniedPrivateDossier:true,deniedOtherWallet:true
    };
    const snapshot={dmSnapshot,afterLogout,playerSnapshot};
    snapshots.push(snapshot);
    console.log("PASS T46-C2B5-FLAG-0"+t33+"-SOURCE-TOWN: actual original Bazaar/Profile/Shop, DM→OTHER same-page auth and fresh lower-role panel; T33 child never mounted");
    if(t33===1){
     assert.deepEqual(snapshot,snapshots[0],
      "Actual T28=0,T33=1 differed from 00 original UI/actor state. B5 cannot claim 01 parity");
     console.log("PASS T46-C2B5-FLAG-01-PARITY: signed real Next browser 00 and 01 identical Profile/Shop, manager/player role and post-logout DOM boundaries; isolated source flag T33 does not activate T33 without T28");

     // Signed 0-GP buyer negative through the CURRENT original storefront.
     const qtyBefore=sql("SELECT qty::text FROM public.character_stock WHERE id="+q(stockId));
     const beforeInventory=invCount(actors.OTHER.id);
     const buyError=page.waitForResponse(r=>buyerRequest(r.request()),{timeout:32000});
     await side.getByRole("button",{name:"Buy for 3 gp",exact:true}).click({force:true});
     const rejected=await buyError;
     assert.ok(rejected.status()>=400,"Original zero-GP buyer unexpectedly accepted");
     await side.locator(".merchant-market-notice-error")
      .filter({hasText:/Insufficient funds/i}).waitFor({timeout:32000});
     assert.equal(walletOf(actors.OTHER.id),"0");
     assert.equal(sql("SELECT qty::text FROM public.character_stock WHERE id="+q(stockId)),qtyBefore);
     assert.equal(invCount(actors.OTHER.id),beforeInventory);
     console.log("PASS T46-C2B5-FLAG-01-ZERO-BUY: actual original storefront 0-GP signed player denied, no stock/wallet/inventory mutation");

     await signOut(page);
     await signInTown(page,actors.OUTSIDER);
     side=await gotoTown(page,origin,townId);
     await side.getByTestId("t46-intel").waitFor({timeout:45000});
     assert.ok(!(await side.innerText()).includes("NPC Dossier & Player Reveals"));
     await openOriginalShop(side,stockName);
     await side.locator(".merchant-preview-purchase").getByText("15 gp",{exact:true})
      .waitFor({timeout:32000});
     assert.equal(await side.getByRole("button",{name:"Merchant tools",exact:true}).count(),0);
     const buyerInventoryBefore=Number(invCount(actors.OUTSIDER.id));
     // Exactly the same original post-commit wallet-refresh false-error as B3
     // (the 01 bit is proven inert), using the real B2 guarded SQL buyer.
     let walletFaultCount=0;
     const fault=route=>{
      walletFaultCount++;
      return route.fulfill({status:503,contentType:"application/json",
       body:JSON.stringify({code:"PGRST500",message:"B5 wallet read unavailable AFTER commit"})});
     };
     await page.route("**/rest/v1/rpc/wallet_get",fault);
     try{
      const expected200=page.waitForResponse(r=>buyerRequest(r.request()),{timeout:35000});
      await side.getByRole("button",{name:"Buy for 3 gp",exact:true}).click({force:true});
      const ok=await expected200;
      assert.equal(ok.status(),200,"B5 source-guarded buyer failed before wallet fault");
      assert.equal(Number(await ok.json()),1);
      await side.locator(".merchant-market-notice-error")
       .filter({hasText:"B5 wallet read unavailable AFTER commit"}).waitFor({timeout:35000});
      assert.ok(walletFaultCount>=1,"B5 postcommit wallet_get fault was not reached");
      assert.equal(walletOf(actors.OUTSIDER.id),"12",
       "B5 buyer must be actually debited 15→12 despite erroneous original UI");
      assert.equal(sql("SELECT qty::text FROM public.character_stock WHERE id="+q(stockId)),"1");
      assert.equal(Number(invCount(actors.OUTSIDER.id)),buyerInventoryBefore+1);
      assert.equal(await side.locator(".merchant-market-notice-success").count(),0,
       "B5 original source mistakenly behaved like T28 guarded success warning");
      console.log("EXPECTED ORIGINAL T46-C2B5-FLAG-01-POSTCOMMIT-RED: actual signed original 01 current town committed 15→12 GP/2→1/one inventory item; wallet_get 503 misleadingly displays purchase failed. NO claim of protected 01");
     }finally{await page.unroute("**/rest/v1/rpc/wallet_get",fault)}
    }
    assert.deepEqual(offsite,[],"B5 offsite HTTP request "+offsite.join(","));
    assert.deepEqual(errors,[],"B5 browser uncaught exceptions "+errors.join(","));
   }finally{await page.close().catch(()=>{});await activeServer.stop();activeServer=null}
  }
  assert.equal(snapshots.length,2);
  assert.deepEqual(snapshots[0],snapshots[1],
   "B5 00 and 01 source-equivalent browser snapshots diverged");
  assert.equal(walletOf(actors.OUTSIDER.id),"12");
  assert.equal(walletOf(actors.OTHER.id),"0");
  console.log("PASS T46-C2B5-SIGNED-RESEARCH: signed 00≈01 current-town parity with actual held original Stage2 source, ROLE server denials, original 01 false postcommit negative, unchanged previous B4 guarded 11 and expected 10 Stage2 RED; release HOLD");
 }finally{if(activeServer)await activeServer.stop()}
}
