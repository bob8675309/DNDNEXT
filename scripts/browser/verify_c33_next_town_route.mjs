#!/usr/bin/env node
// C3T: actual Next.js Pages Router (NO router/dynamic mocks) against
// genuine signed local GoTrue and staged source-original NPC privacy.
// Narrow scope: town market→merchant Profile→Shop→Profile, GM logout.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawn,spawnSync} from "node:child_process";
import {createRequire} from "node:module";
import path from "node:path";
import {createClient} from "@supabase/supabase-js";
const e=process.env;
for(const [key,value] of Object.entries({GITHUB_ACTIONS:"true",CI:"true",
 PGHOST:"127.0.0.1",PGPORT:"54322",PGDATABASE:"postgres",
 DNDNEXT_C33_FORGE_PRIVACY_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_ONLY"}))
 assert.equal(e[key],value,"C3T refuses nonlocal test: "+key);
assert.match(e.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_ANON_KEY);
assert.ok(path.isAbsolute(e.C33_BROWSER_TOOL_ROOT||""));
assert.ok(path.isAbsolute(e.C33_BROWSER_CHROME||""));
const {chromium}=createRequire(path.join(e.C33_BROWSER_TOOL_ROOT,"c33-playwright-anchor.cjs"))("playwright-core");
const api=e.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_URL.replace(/\/$/,""),secretKey=e.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_ANON_KEY;
const password="C3T-"+randomUUID()+"!";
const client=()=>createClient(api,secretKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
function sql(q){const x=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",q],{
 env:{...e,PGUSER:"postgres"},encoding:"utf8",timeout:20000});
 assert.equal(x.status,0,x.stderr);return x.stdout.trim()}
async function role(label){
 const who=client(),email="c3t-"+label+"-"+randomUUID()+"@example.invalid";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const u=await who.auth.getUser();assert.ifError(u.error);
 return {who,email,password,id:u.data.user.id}
}
const outsider=await role("outsider"),gm=await role("gm"),
      coeditor=await role("coeditor"),inventoryOnly=await role("inventory-only");
sql("INSERT INTO private.test_admins(id) VALUES ('"+gm.id+"')");
const gmSecret="C3T_GM_ONLY_LEGACY_SECRET";
const m=await gm.who.rpc("create_character_v1",{p_payload:{
 name:"C3T town merchant",kind:"merchant",creation_request_id:randomUUID(),
 description:"C3T_PUBLIC_DESCRIPTION",background:"C3T_PUBLIC_HISTORY",
 secret:gmSecret,storefront_enabled:true,
 sheet:{classKey:"fighter",level:1,profileReveal:{background:true,secret:true}}
}});
assert.ifError(m.error);assert.match(m.data,/^[0-9a-f-]{36}$/i);
sql("UPDATE public.characters SET location_id=99001,home_location_id=99001,state='resting',is_hidden=false,storefront_enabled=true WHERE id='"+m.data+"'");
console.log("PASS C3T01: genuine local signed GM merchant creation and town roster");
const rosterRead=await outsider.who.from("characters")
 .select("id,name,kind,location_id,home_location_id,is_hidden,storefront_enabled")
 .eq("id",m.data).maybeSingle();
assert.ifError(rosterRead.error);
assert.equal(rosterRead.data?.id,m.data,"Local signed outsider cannot SELECT visible merchant after creation");
console.log("PASS C3T01A: true outsider PostgREST can read source-qualified merchant roster identity");
const c3iSecret="C3I_GM_PRIVATE_SECRET";
const c3iNpc=await gm.who.rpc("create_character_v1",{p_payload:{
 name:"C3I route NPC",kind:"npc",creation_request_id:randomUUID(),
 description:"C3I_PUBLIC_DESCRIPTION",secret:c3iSecret,
 sheet:{classKey:"fighter",level:1,profileReveal:{secret:true}}
}});
assert.ifError(c3iNpc.error);assert.match(c3iNpc.data,/^[a-f0-9-]{36}$/i);
sql("UPDATE public.characters SET location_id=99001,state='resting',is_hidden=false WHERE id='"+c3iNpc.data+"'");
sql("INSERT INTO public.character_permissions (character_id,user_id,can_edit,can_inventory,can_convert) VALUES"+
 "('"+c3iNpc.data+"','"+coeditor.id+"',true,true,false),"+
 "('"+c3iNpc.data+"','"+inventoryOnly.id+"',false,true,false)");
console.log("PASS C3I00: original signed NPC and four independent role accounts seeded");
const origin="http://127.0.0.1:41820";
let dev=null,browser=null,log="";
try{
 dev=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-H","127.0.0.1","-p","41820"],{
 cwd:process.cwd(),stdio:["ignore","pipe","pipe"],env:{
 ...e,NEXT_PUBLIC_SUPABASE_URL:api,NEXT_PUBLIC_SUPABASE_ANON_KEY:secretKey,NEXT_TELEMETRY_DISABLED:"1"}});
 const append=x=>{log=(log+String(x)).slice(-15000)};
 dev.stdout.on("data",append);dev.stderr.on("data",append);
 let up=false;const deadline=Date.now()+120000;
 while(Date.now()<deadline){
   if(dev.exitCode!==null)throw Error("Next dev exited:\n"+log);
   try{if((await fetch(origin+"/town/99001")).status===200){up=true;break}}catch{}
   await new Promise(r=>setTimeout(r,1800));
 }
 assert.ok(up,"Real Next town route did not become ready:\n"+log);
 browser=await chromium.launch({executablePath:e.C33_BROWSER_CHROME,headless:true,
 args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 const errors=[];page.on("pageerror",x=>errors.push(x.message));
 await page.route("**/*",r=>{
  const u=new URL(r.request().url());
  return u.origin===origin||u.origin===api?r.continue():r.abort();
 });
 await page.goto(origin+"/town/99001",{waitUntil:"domcontentloaded",timeout:100000});
 await page.waitForFunction(()=>Boolean(window.__sb?.auth),null,{timeout:60000});
 async function login(who){
   const uid=await page.evaluate(async c=>{
     const x=await window.__sb.auth.signInWithPassword({email:c.email,password:c.password});
     if(x.error)throw Error(x.error.message);
     return x.data.user.id;
   },{email:who.email,password:who.password});
   assert.equal(uid,who.id);
   await page.reload({waitUntil:"domcontentloaded",timeout:100000});
   await page.getByRole("heading",{name:"C3T scratch town"}).waitFor({timeout:45000});
   assert.equal((await page.evaluate(async()=> (await window.__sb.auth.getUser()).data.user?.id)),who.id);
 }
 async function openMerchant(){
   await page.getByRole("button",{name:"Bazaar / market",exact:true}).click();
   const read=await page.evaluate(async id=>{
     const fields="id,name,kind,race,role,affiliation,status,state,location_id,last_known_location_id,projected_destination_id,is_hidden,map_icon_id,tags,portrait_url,portrait_storage_path,portrait_thumb_url,portrait_shop_url,portrait_source,image_url";
     const merchants="id,name,kind,race,role,affiliation,status,state,location_id,home_location_id,storefront_enabled,storefront_title,storefront_tagline,storefront_bg_url,storefront_bg_image_url,storefront_bg_video_url,portrait_url,portrait_storage_path,portrait_thumb_url,portrait_shop_url,image_url,tags";
     const [roster,market]=await Promise.all([
       window.__sb.from("characters").select(fields).eq("id",id),
       window.__sb.from("characters").select(merchants).eq("id",id),
     ]);
     return {
       rosterError:roster.error?.message||null,rosterCode:roster.error?.code||null,
       marketError:market.error?.message||null,marketCode:market.error?.code||null,
       rosterNames:(roster.data||[]).map(x=>x.name),
       marketNames:(market.data||[]).map(x=>x.name),
       body:document.body.innerText.slice(0,3400)
     };
   },m.data);
   console.log("C3T_BROWSER_MARKET_DIAGNOSTIC",JSON.stringify(read));
   await page.getByText("C3T town merchant",{exact:true}).first().waitFor({timeout:12000});
   await page.getByRole("button",{name:"Browse Wares",exact:true}).click();
   const d=page.getByRole("dialog",{name:"C3T town merchant profile"});
   await d.waitFor({state:"visible",timeout:25000});
   await d.getByText("C3T_PUBLIC_DESCRIPTION",{exact:true}).waitFor({timeout:25000});
   return d
 }
 await login(outsider);
 let d=await openMerchant();
 assert.equal(await d.getByText(gmSecret,{exact:true}).count(),0);
 assert.equal(await d.getByText(/C3T town merchant.s Wares/).count(),0);
 console.log("PASS C3T02: real Next town Browse Wares starts at player-safe Profile, never direct shop");
 await d.getByRole("button",{name:"Let me browse your wares."}).click({timeout:20000});
 await d.getByText(/C3T town merchant.s Wares/).first().waitFor({timeout:35000});
 await d.getByRole("button",{name:"Profile",exact:true}).click();
 await d.getByText("Known Lore",{exact:true}).waitFor();
 await d.locator('.npc-panel-header button[aria-label="Close"]').click();
 await d.waitFor({state:"hidden"});
 console.log("PASS C3T03: real Next lazy merchant Shop→Profile and close");
 await login(gm);
 d=await openMerchant();
 await d.getByText(gmSecret,{exact:true}).waitFor({timeout:30000});
 console.log("PASS C3T04: actual Next town signed GM sees privileged dossier");
 await page.evaluate(async()=>{const x=await window.__sb.auth.signOut();if(x.error)throw Error(x.error.message)});
 await d.waitFor({state:"hidden",timeout:15000});
 assert.equal(await d.getByText(gmSecret,{exact:true}).count(),0,
   "C3T05: GM secret remains on screen after sign-out");
 assert.equal(await page.getByRole("button",{name:"Show Admin Tools"}).count(),0,
   "C3T05: signed-out town still exposes GM map/admin controls");
 assert.deepEqual(errors,[],"Next route browser runtime exceptions");
 console.log("PASS C3T05: original Next town closes privileged Profile and revokes GM controls on real sign-out");

 // C3I: ACTUAL Next inventory route, original global _app overlay, genuine
 // NPC Profile/sheet readers, signed role authority and session invalidation.
 async function inventoryProfile(roleUser,kind,id,expectedName){
   await page.goto(origin+"/town/99001",{waitUntil:"domcontentloaded",timeout:85000});
   await page.waitForFunction(()=>Boolean(window.__sb?.auth),null,{timeout:30000});
   await login(roleUser);
   await page.goto(origin+"/inventory?ownerType="+kind+"&ownerId="+id,
     {waitUntil:"domcontentloaded",timeout:85000});
   await page.getByRole("button",{name:"Open Profile",exact:true}).waitFor({timeout:40000});
   await page.getByRole("button",{name:"Open Profile",exact:true}).click();
   const panel=page.getByRole("dialog",{name:expectedName+" character profile"});
   await panel.waitFor({state:"visible",timeout:25000});
   return panel;
 }
 async function closeGlobal(panel){
   await page.keyboard.press("Escape");
   await panel.waitFor({state:"hidden",timeout:15000});
 }
 let inv=await inventoryProfile(outsider,"npc",c3iNpc.data,"C3I route NPC");
 await inv.getByText("C3I_PUBLIC_DESCRIPTION",{exact:true}).waitFor({timeout:25000});
 assert.equal(await inv.getByText(c3iSecret,{exact:true}).count(),0);
 await inv.getByRole("button",{name:"Sheet & Rolls"}).click();
 await inv.getByText("No character sheet has been created for this character yet.").waitFor({timeout:20000});
 assert.equal(await inv.getByRole("button",{name:"Print Sheet"}).count(),0);
 assert.equal(await page.getByText("You do not have permission to view this inventory.").count(),1);
 await closeGlobal(inv);
 console.log("PASS C3I01: signed outsider actual Next inventory NPC Profile public; inventory and Sheet/Print denied");
 inv=await inventoryProfile(inventoryOnly,"npc",c3iNpc.data,"C3I route NPC");
 await page.waitForFunction(()=>!document.body.innerText.includes("You do not have permission to view this inventory."),null,{timeout:20000});
 await inv.getByRole("button",{name:"Sheet & Rolls"}).click();
 await inv.getByText("No character sheet has been created for this character yet.").waitFor({timeout:20000});
 assert.equal(await inv.getByRole("button",{name:"Print Sheet"}).count(),0);
 assert.equal(await inv.getByText(c3iSecret,{exact:true}).count(),0);
 await closeGlobal(inv);
 console.log("PASS C3I02: signed inventory-only user granted inventory but denied canonical NPC Sheet/Print");
 inv=await inventoryProfile(coeditor,"npc",c3iNpc.data,"C3I route NPC");
 await inv.getByRole("button",{name:"Sheet & Rolls"}).click();
 await inv.getByRole("button",{name:"Print Sheet"}).waitFor({timeout:25000});
 assert.equal(await inv.getByText(c3iSecret,{exact:true}).count(),0);
 await closeGlobal(inv);
 console.log("PASS C3I03: real can_edit coeditor retains Sheet/Print via global Profile, no GM Secret");
 inv=await inventoryProfile(gm,"merchant",m.data,"C3T town merchant");
 await inv.getByText(gmSecret,{exact:true}).waitFor({timeout:25000});
 await page.getByText("Inventory Browser",{exact:true}).waitFor({timeout:25000});
 console.log("PASS C3I04: actual Next merchant inventory global Profile renders signed GM dossier");
 await page.evaluate(async()=>{
   const out=await window.__sb.auth.signOut();
   if(out.error)throw Error(out.error.message);
 });
 await inv.waitFor({state:"hidden",timeout:15000});
 assert.equal(await inv.getByText(gmSecret,{exact:true}).count(),0,
   "C3I05: global GM private Profile still visible after signed logout");
 assert.equal(await page.getByText("Inventory Browser",{exact:true}).count(),0,
   "C3I05: stale inventory Admin browser remains after logout");
 console.log("PASS C3I05: actual Next inventory signout clears global GM dossier and Admin browser");
 assert.deepEqual(errors,[],"Real Next inventory browser JS exceptions");
}finally{
 if(browser)await browser.close();
 if(dev){
   dev.kill("SIGTERM");
   await Promise.race([new Promise(r=>dev.once("exit",r)),new Promise(r=>setTimeout(r,5000))]);
   if(dev.exitCode===null)dev.kill("SIGKILL");
 }
}

