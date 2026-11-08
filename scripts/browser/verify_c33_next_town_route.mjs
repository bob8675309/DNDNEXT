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
const outsider=await role("outsider"),gm=await role("gm");
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
}finally{
 if(browser)await browser.close();
 if(dev){
   dev.kill("SIGTERM");
   await Promise.race([new Promise(r=>dev.once("exit",r)),new Promise(r=>setTimeout(r,5000))]);
   if(dev.exitCode===null)dev.kill("SIGKILL");
 }
}

