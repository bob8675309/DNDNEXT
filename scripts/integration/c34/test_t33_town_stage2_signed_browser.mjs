#!/usr/bin/env node
// C34 T33: genuine current Next Pages Router /town and source-derived NPC
// Stage2-safe Profile. Disposable PG17+GoTrue/PostgREST only; NO hosted calls.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn,spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
const env=process.env;
for(const [k,v] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 C34_T33_BROWSER_CONFIRM:"SIGNED_STAGE2_TOWN_GAME_MASTER_LOCAL_ONLY",
}))assert.equal(env[k],v,"T33 refuses unsafe environment "+k);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.ok(env.C33_BROWSER_TOOL_ROOT && path.isAbsolute(env.C33_BROWSER_TOOL_ROOT));
assert.ok(env.C33_BROWSER_CHROME && path.isAbsolute(env.C33_BROWSER_CHROME));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const nextBin=path.join(root,"node_modules/next/dist/bin/next");
assert.ok(fs.existsSync(nextBin),"T33 requires pinned npm ci Next");
const require=createRequire(path.join(env.C33_BROWSER_TOOL_ROOT,"t33-playwright-anchor.cjs"));
const {chromium}=require("playwright-core");
const localUrl=env.DNDNEXT_C34_LOCAL_URL;
const newClient=()=>createClient(localUrl,env.DNDNEXT_C34_LOCAL_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
});
const sql=q=>{
 const out=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",q],{
  cwd:root,env,encoding:"utf8",timeout:30000,
 });
 assert.equal(out.status,0,"T33 disposable SQL error "+out.stderr?.slice(-1200));
 return out.stdout.trim();
};
const quote=id=>{assert.match(id,/^[a-f0-9-]{36}$/i);return "'"+id+"'";};
const npcid=sql("SELECT id::text FROM public.characters WHERE name='T22 Profile NPC' AND kind='npc' LIMIT 1");
const merchantId=sql("SELECT id::text FROM public.characters WHERE name='T26 Probe Merchant' AND kind='merchant' LIMIT 1");
assert.match(npcid,/^[a-f0-9-]{36}$/i);
assert.match(merchantId,/^[a-f0-9-]{36}$/i);
assert.equal(sql("SELECT name FROM public.locations WHERE id=910020"),"C34 Signed Bazaar");
assert.equal(sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))"),
 "1dbe8c24c4c718396d7256f6f7465354");
// Original Stage2 column access must remain denied to EVERY signed role.
sql("UPDATE public.characters SET location_id=910020,is_hidden=false WHERE id="+quote(npcid));
async function make(role){
 const who=newClient(),email="t33-"+role+"-"+randomUUID()+"@example.invalid";
 const password="T33-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const user=await who.auth.getUser();assert.ifError(user.error);
 const id=user.data.user.id;
 sql("INSERT INTO public.user_profiles(id,role) VALUES("+quote(id)+",'"+role+
  "') ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role");
 const blocked=await who.from("characters").select("id,background,motivation,quirk,mannerism,voice").eq("id",npcid).single();
 assert.equal(blocked.error?.code,"42501","T33 original Stage2 forbidden character SELECT must stay blocked");
 const gm=await who.rpc("get_npc_dossier_admin_v1",{p_character_id:npcid});
 if(["admin","gm","dm"].includes(role)){
  assert.ifError(gm.error);assert.equal(gm.data.secret,"T22_GM_DOSSIER_NEVER_PUBLIC");
 }else assert.ok(gm.error,role+" must not access direct original Stage2 dossier");
 return {id,role,email,password};
}
const roles={};
for(const role of ["admin","gm","dm","player","unknown"])roles[role]=await make(role);
console.log("PASS T33-SIGNED-ACL: Admin/GM/DM genuine Stage2 dossier allowed while all five direct narrative columns stay 42501; player/unknown denied");
const authPath="pages/__c34_t33_auth_probe.jsx";
const npcPath="pages/__c34_t33_npc_probe.jsx";
for(const p of [authPath,npcPath])assert.ok(!fs.existsSync(path.join(root,p)),"Refuse overwriting existing or tracked scratch route "+p);
const authCode=[
 'import { useEffect } from "react";',
 'import { supabase } from "../utils/supabaseClient";',
 'export default function T33AuthProbe(){',
 ' useEffect(()=>{window.__t33sb=supabase;},[]);',
 ' return <main data-testid="t33-auth-probe">Local signed actor only</main>;',
 '}','',
].join("\n");
const npcCode=[
 'import { useEffect } from "react";',
 'import dynamic from "next/dynamic";',
 'import { supabase } from "../utils/supabaseClient";',
 'const SafePanel=dynamic(()=>import("../components/character/CharacterInteractionPanelTownT33Research"),{ssr:false});',
 'export default function T33NpcProbe(){',
 ' useEffect(()=>{window.__t33sb=supabase;},[]);',
 ' const npc={id:'+JSON.stringify(npcid)+',kind:"npc",name:"T22 Profile NPC"};',
 ' return <main data-testid="t33-npc-probe"><SafePanel character={npc} isAdmin={true} initialView="profile" useGuardedTownMerchant={true} locations={[]} /></main>;',
 '}','',
].join("\n");
let browser=null,server=null,serverLog="";
const offsite=[],errors=[];
async function freePort(){
 return new Promise((resolve,reject)=>{
  const s=net.createServer();
  s.once("error",reject);
  s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p));});
 });
}
try{
 fs.writeFileSync(path.join(root,authPath),authCode,{flag:"wx"});
 fs.writeFileSync(path.join(root,npcPath),npcCode,{flag:"wx"});
 const port=await freePort(),origin="http://127.0.0.1:"+port;
 server=spawn(process.execPath,[nextBin,"dev","-H","127.0.0.1","-p",String(port)],{
  cwd:root,detached:true,stdio:["ignore","pipe","pipe"],
  env:{...env,
   NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP:"1",
   NEXT_PUBLIC_C34_T33_TOWN_STAGE2_SAFE_PROFILE:"1",
   NEXT_PUBLIC_SUPABASE_URL:localUrl,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
   NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1"},
 });
 for(const stream of [server.stdout,server.stderr])
  stream.on("data",chunk=>serverLog=(serverLog+chunk.toString()).slice(-22000));
 // Next dev takes time to bind and compile the generated route. Do NOT
 // mistake connection-refused during startup for a privacy/browser failure.
 const readinessUrl=origin+"/__c34_t33_auth_probe";
 let ready=false;
 for(let attempt=0;attempt<110;attempt++){
  if(server.exitCode!==null)throw Error("T33 Next exited before ready: "+serverLog);
  try{
   const reply=await fetch(readinessUrl,{signal:AbortSignal.timeout(2400)});
   if(reply.ok && (await reply.text()).includes("t33-auth-probe")){
    ready=true;
    break;
   }
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,1200));
 }
 assert.ok(ready,"T33 current Next did not compile signed local auth route: "+serverLog);
 console.log("PASS T33-NEXT-READY: real pinned Next server and generated local-only auth route compiled");
 browser=await chromium.launch({headless:true,executablePath:env.C33_BROWSER_CHROME,
   args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext();
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",async route=>{
  const u=route.request().url();
  if(u.startsWith(origin)||u.startsWith(localUrl)||u.startsWith("ws://127.0.0.1:"))
    return route.continue();
  if(/supabase\.co|supabase\.in|service_role/i.test(u))offsite.push(u.slice(0,200));
  return route.abort();
 });
 const useActor=async role=>{
  await page.goto(origin+"/__c34_t33_auth_probe",{waitUntil:"domcontentloaded",timeout:90000});
  await page.waitForFunction(()=>!!window.__t33sb,null,{timeout:90000});
  const actor=roles[role];
  const id=await page.evaluate(async creds=>{
   await window.__t33sb.auth.signOut();
   const {data,error}=await window.__t33sb.auth.signInWithPassword(creds);
   if(error)throw Error(error.message);
   return data.user.id;
  },{email:actor.email,password:actor.password});
  assert.equal(id,actor.id,role+" signed actor");
 };
 const secret="T22_GM_DOSSIER_NEVER_PUBLIC";
 for(const role of ["admin","gm","dm","player","unknown"]){
  await useActor(role);
  await page.goto(origin+"/__c34_t33_npc_probe",{waitUntil:"domcontentloaded",timeout:90000});
  const panel=page.getByTestId("t33-stage2-profile-ready");
  await panel.waitFor({timeout:70000});
  const body=await panel.innerText();
  const manager=["admin","gm","dm"].includes(role);
  assert.equal(body.includes(secret),manager,role+" Stage2 private dossier");
  assert.equal(body.includes("NPC Dossier & Player Reveals"),manager,role+" NPC manager tools");
  if(!manager){
   assert.ok(!body.includes("T22_GM_CANONICAL_SHEET"),role+" private Sheet leaked");
   assert.equal(await panel.getByRole("button",{name:"Reveal",exact:true}).count(),0,
    role+" must not publish protected lore");
  }
  console.log("PASS T33-ROLE-"+role.toUpperCase()+": REAL Next/Chromium source Stage2/Profile manager secrecy, parent isAdmin ignored");
  if(role==="gm"){
   // Same authenticated JWT, server-side role revocation, no fresh sign-in.
   sql("UPDATE public.user_profiles SET role='player' WHERE id="+quote(roles.gm.id));
   await page.reload({waitUntil:"domcontentloaded",timeout:90000});
   const revoked=page.getByTestId("t33-stage2-profile-ready");
   await revoked.waitFor({timeout:70000});
   const revokedText=await revoked.innerText();
   assert.ok(!revokedText.includes(secret),"Demoted GM retained original dossier");
   assert.ok(!revokedText.includes("NPC Dossier & Player Reveals"),"Demoted GM retained NPC manager UI");
   console.log("PASS T33-ROLE-REVOKE: same JWT demotion removes signed dossier and manager UI");
  }
 }
 await useActor("dm");
 await page.goto(origin+"/town/910020",{waitUntil:"domcontentloaded",timeout:90000});
 await page.getByRole("heading",{name:"C34 Signed Bazaar"}).waitFor({timeout:70000});
 await page.getByRole("button",{name:"Bazaar / market",exact:true}).click();
 await page.getByRole("button",{name:"Browse Wares",exact:true}).click();
 const town=page.locator(".town-profile-sidepanel");
 const safe=town.getByTestId("t33-stage2-profile-ready");
 await safe.waitFor({timeout:70000});
 const profile=town.getByRole("button",{name:"Profile",exact:true});
 await profile.waitFor({timeout:30000});
 assert.match(await profile.getAttribute("class")||"",/\bbtn-primary\b/);
 assert.ok((await safe.innerText()).includes("T26 Probe Merchant"));
 assert.ok((await safe.innerText()).includes("NPC Dossier & Player Reveals"));
 console.log("PASS T33-TOWN-DM-ENTRY: actual town Bazaar Browse Wares opens source-safe Profile with true signed DM");
 await town.getByRole("button",{name:"Shop",exact:true}).click();
 await town.getByRole("button",{name:"Return to Profile",exact:true}).waitFor({timeout:45000});
 await town.getByRole("button",{name:"Return to Profile",exact:true}).click();
 await safe.waitFor({timeout:30000});
 assert.match(await profile.getAttribute("class")||"",/\bbtn-primary\b/);
 await town.getByRole("button",{name:"Let me browse your wares."}).click();
 await town.getByRole("button",{name:"Return to Profile",exact:true}).waitFor({timeout:45000});
 console.log("PASS T33-TOWN-PROFILE-SHOP: current tracked town DM Profile → Shop → Profile → Shop");
 // Same page actor transition. T28 parent must evict entire private panel.
 const signedOut=await page.evaluate(async()=>{const {error}=await window.__sb.auth.signOut();return error?.message||null;});
 assert.equal(signedOut,null);
 await town.waitFor({state:"detached",timeout:35000});
 const player=roles.player;
 const switched=await page.evaluate(async credentials=>{
  const {data,error}=await window.__sb.auth.signInWithPassword(credentials);
  if(error)throw Error(error.message);
  return data.user.id;
 },{email:player.email,password:player.password});
 assert.equal(switched,player.id);
 await page.getByRole("heading",{name:"C34 Signed Bazaar"}).waitFor({timeout:70000});
 await page.getByRole("button",{name:"Bazaar / market",exact:true}).click();
 await page.getByRole("button",{name:"Browse Wares",exact:true}).click();
 const newPanel=page.locator(".town-profile-sidepanel");
 await newPanel.getByTestId("t33-stage2-profile-ready").waitFor({timeout:70000});
 const playerText=await newPanel.innerText();
 assert.ok(!playerText.includes("NPC Dossier & Player Reveals"));
 assert.ok(!playerText.includes("T26_MERCHANT_SECRET"));
 assert.equal(await newPanel.getByRole("button",{name:"Merchant tools",exact:true}).count(),0);
 console.log("PASS T33-TOWN-ACTOR-SWITCH: same page DM logout to player clears private town/Profile/merchant tools");
 assert.deepEqual(offsite,[],"T33 attempted offsite Supabase: "+offsite.join(","));
 assert.deepEqual(errors,[],"T33 current Next browser errors: "+errors.join(","));
 console.log("PASS T33-SIGNED-CHROMIUM: actual town and NPC Stage2 equal Admin/GM/DM, player/unknown denied, shop/actor clear, unchanged original source");
}finally{
 if(browser)await browser.close().catch(()=>{});
 if(server?.pid){try{process.kill(-server.pid,"SIGTERM");}catch{server.kill("SIGTERM");}}
 for(const p of [authPath,npcPath]){try{fs.unlinkSync(path.join(root,p));}catch{}}
 for(const p of [authPath,npcPath])assert.ok(!fs.existsSync(path.join(root,p)),"T33 local route not removed "+p);
}
