#!/usr/bin/env node
// T28-P2 REAL /town/[id] Bazaar -> Profile -> Shop test, disposable signed CI ONLY.
import assert from "node:assert/strict";
export async function runT28P2RealTownSignedBrowser({context,origin,localUrl,users,townId,merchant,stockLabel,offsite,errors}) {
 assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
 assert.equal(localUrl,"http://127.0.0.1:54321");
 assert.equal(townId,910020);
 const page=await context.newPage(),errorStart=errors.length,offsiteStart=offsite.length;
 try {
  page.on("pageerror",e=>errors.push("T28-P2-TOWN:"+e.message));
  await page.route("**/*",async route=>{
   const u=route.request().url();
   if(u.startsWith(origin)||u.startsWith(localUrl))return route.continue();
   if(/supabase\.co|supabase\.in|service_role/i.test(u))offsite.push("T28-P2-TOWN:"+u.slice(0,160));
   return route.abort();
  });
  await page.goto(origin+"/__c34_t28_p2_probe",{waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForFunction(()=>!!window.__sb?.auth,null,{timeout:60000});
  const id=await page.evaluate(async creds=>{
   const {data,error}=await window.__sb.auth.signInWithPassword(creds);
   if(error)throw Error(error.message);
   return data.user.id;
  },{email:users.GM.email,password:users.GM.password});
  assert.equal(id,users.GM.id);
  // Unlike the earlier probe, this is the actual tracked Pages Router town UI.
  await page.goto(origin+"/town/"+townId,{waitUntil:"domcontentloaded",timeout:60000});
  await page.getByRole("heading",{name:"C34 Signed Bazaar"}).waitFor({timeout:35000});
  await page.getByRole("button",{name:"Bazaar / market",exact:true}).click();
  const browse=page.getByRole("button",{name:"Browse Wares",exact:true});
  await browse.first().waitFor({timeout:25000});
  assert.equal(await browse.count(),1,"Exactly one disposable town merchant expected");
  await browse.click();
  // The global app toolbar also has a "Profile" button (class nav-link).
  // Scope tab assertions to the actual selected town merchant overlay.
  const sidepanel=page.locator(".town-profile-sidepanel");
  await sidepanel.waitFor({timeout:35000});
  const profile=sidepanel.getByRole("button",{name:"Profile",exact:true});
  await profile.waitFor({timeout:35000});
  assert.match(await profile.getAttribute("class")||"",/\bbtn-primary\b/,
    "Actual Bazaar Browse Wares bypassed Profile-first");
  assert.equal(await page.getByText(stockLabel,{exact:true}).count(),0,
    "Shop shelf leaked before Profile-to-Shop navigation");
  assert.ok((await sidepanel.innerText()).includes("T26 Probe Merchant"));
  console.log("PASS T28-P2-REAL-TOWN-ENTRY signed real Bazaar Browse Wares starts Profile");
  await sidepanel.getByRole("button",{name:"Shop",exact:true}).click();
  await page.getByText(stockLabel,{exact:true}).first().waitFor({timeout:25000});
  await sidepanel.getByRole("button",{name:"Return to Profile",exact:true}).click();
  assert.match(await profile.getAttribute("class")||"",/\bbtn-primary\b/);
  await page.getByText(stockLabel,{exact:true}).first().waitFor({state:"detached",timeout:15000});
  await sidepanel.getByRole("button",{name:"Let me browse your wares."}).click();
  await page.getByText(stockLabel,{exact:true}).first().waitFor({timeout:25000});
  console.log("PASS T28-P2-REAL-TOWN-SHOP Profile -> guarded Shop -> Profile -> Shop");
  const error=await page.evaluate(async()=>{
   const {error}=await window.__sb.auth.signOut();
   return error?.message||null;
  });
  assert.equal(error,null);
  await page.getByText(stockLabel,{exact:true}).first().waitFor({state:"detached",timeout:18000});
  console.log("PASS T28-P2-REAL-TOWN-SIGNOUT guarded real town stock cleared on logout");
  await sidepanel.waitFor({state:"detached",timeout:18000});
  console.log("PASS T28-P2-REAL-TOWN-ACTOR-CLEAR signed logout evicted the entire prior town Profile, not only shop stock");
  const outsiderId=await page.evaluate(async creds=>{
    const {data,error}=await window.__sb.auth.signInWithPassword(creds);
    if(error)throw Error(error.message);
    return data.user.id;
  },{email:users.OUTSIDER.email,password:users.OUTSIDER.password});
  assert.equal(outsiderId,users.OUTSIDER.id);
  await page.getByRole("heading",{name:"C34 Signed Bazaar"}).waitFor({timeout:35000});
  await page.getByRole("button",{name:"Bazaar / market",exact:true}).click();
  const newBrowse=page.getByRole("button",{name:"Browse Wares",exact:true});
  await newBrowse.waitFor({timeout:25000});
  await newBrowse.click();
  const outsiderPanel=page.locator(".town-profile-sidepanel");
  const outsiderProfile=outsiderPanel.getByRole("button",{name:"Profile",exact:true});
  await outsiderProfile.waitFor({timeout:25000});
  assert.match(await outsiderProfile.getAttribute("class")||"",/\bbtn-primary\b/);
  assert.equal(await outsiderPanel.getByRole("button",{name:"Merchant tools",exact:true}).count(),0,
    "Previous GM merchant editor controls survived a switch to outsider");
  await outsiderPanel.getByRole("button",{name:"Shop",exact:true}).click();
  await outsiderPanel.getByText(stockLabel,{exact:true}).first().waitFor({timeout:25000});
  assert.equal(await outsiderPanel.getByRole("button",{name:"Merchant tools",exact:true}).count(),0);
  console.log("PASS T28-P2-REAL-TOWN-ACTOR-SWITCH signed outsider reloads town+public shop without prior GM Admin controls");

  assert.deepEqual(offsite.slice(offsiteStart),[]);
  assert.deepEqual(errors.slice(errorStart),[]);
 }finally{await page.close().catch(()=>{});}
}
