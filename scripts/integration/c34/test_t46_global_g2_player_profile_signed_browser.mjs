#!/usr/bin/env node
// T46-GLOBAL-G2: exact current globally mounted PlayerCharacterProfilePanel
// browser ORIGINAL denied broad fallback RED -> local research guard candidate.
// Genuine signed disposable PG17/GoTrue/PostgREST, Next16 + Chromium.
// No hosted SQL, no production gameplay, no map edits or deploy.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import crypto,{randomUUID} from "node:crypto";
import {spawn,spawnSync} from "node:child_process";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {createClient} from "@supabase/supabase-js";
import {buildG2GlobalPlayerProfileOverlay} from "./candidates/t46_global_g2_player_profile_overlay.mjs";

const env=process.env;
for(const [key,value] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
 PGPORT:"54322",PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"
}))assert.equal(env[key],value,"Refuse non-disposable G2 "+key);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.ok(env.C33_BROWSER_CHROME&&path.isAbsolute(env.C33_BROWSER_CHROME));
assert.ok(env.C33_BROWSER_TOOL_ROOT&&path.isAbsolute(env.C33_BROWSER_TOOL_ROOT));
assert.notEqual(env.VERCEL,"1");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const nextBin=path.join(root,"node_modules/next/dist/bin/next");
assert.ok(fs.existsSync(nextBin));
const require=createRequire(path.join(env.C33_BROWSER_TOOL_ROOT,"t46-global-g2-playwright.cjs"));
const {chromium}=require("playwright-core");
const gitBlob=buf=>crypto.createHash("sha1").update(
 Buffer.concat([Buffer.from("blob "+buf.length+"\0"),buf])).digest("hex");
const pinned={
 "components/PlayerCharacterProfilePanelUnified.js":"8a561e51eafd9e8507db7a4d3f15fd4699d6d1b8",
 "components/PlayerCharacterProfilePanel.js":"647615f83d931e4878cd2fd6794d54bef5f83aa1",
 "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a",
 "scripts/integration/c34/sources/02_npc_profile_stage1.sql":"9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3",
 "scripts/integration/c34/sources/03_npc_dossier_stage2.sql":"afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac",
 "scripts/integration/c34/sources/04_private_story_stage3.sql":"01e48823ac3a46aa5880e98200e97c2595501ce7"
};
for(const [file,sha] of Object.entries(pinned))
 assert.equal(gitBlob(fs.readFileSync(path.join(root,file))),sha,
  "Original source/drift changed "+file);
const originalPanelPath=path.join(root,"components/PlayerCharacterProfilePanelUnified.js");
const originalPanel=fs.readFileSync(originalPanelPath);
assert.ok(originalPanel.toString("utf8").includes('supabase.rpc("get_my_player_characters_v2")'));
const probeFile=path.join(root,"pages/__c34_t46_global_g2_probe.jsx");
assert.ok(!fs.existsSync(probeFile),"Refuse existing real Next route overwrite");
const probeSource=[
 'import {useEffect} from "react";',
 'import {supabase} from "../utils/supabaseClient";',
 'export default function G2Probe(){',
 '  useEffect(()=>{',
 '    window.__g2={',
 '      login:async(email,password)=>{const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw Error(error.message);return data.user?.id;},',
 '      logout:async()=>{const {error}=await supabase.auth.signOut();if(error)throw Error(error.message);return true;},',
 '      uid:async()=>{const {data}=await supabase.auth.getSession();return data.session?.user?.id||null;},',
 '      open:()=>window.dispatchEvent(new CustomEvent("dndnext:open-player-profile"))',
 '    };',
 '    return()=>{delete window.__g2;};',
 '  },[]);',
 '  return <main data-testid="t46-g2-global-original-probe"><h1>T46 G2 Original Global Profile</h1><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent("dndnext:open-player-profile"))}>Open Player Profile</button></main>;',
 '}'
].join("\n");
const q=v=>{assert.match(v,/^[0-9a-f-]{36}$/i);return "'"+v+"'";};
const lit=v=>"'"+String(v).replaceAll("'","''")+"'";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function sql(statement){
 const result=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],
  {cwd:root,env,encoding:"utf8",timeout:30000});
 assert.equal(result.status,0,"Disposable G2 SQL failed: "+String(result.stderr).slice(-1900));
 return result.stdout.trim();
}
async function actor(name) {
 const who=createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const email="t46-global-g2-"+name+"-"+randomUUID()+"@example.invalid";
 const password="T46G2-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const {data,error}=await who.auth.getUser();assert.ifError(error);
 return {id:data.user.id,email,password,who};
}
async function freePort(){return new Promise((resolve,reject)=>{
 const s=net.createServer();s.once("error",reject);
 s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p));});
});}
function hasOriginalRawFallback(url) {
 const u=new URL(url);
 return u.pathname==="/rest/v1/characters"
   && (u.searchParams.get("select")||"").includes("background,motivation,quirk,mannerism,voice")
   && u.searchParams.get("tags")==="cs.{player-character}";
}
function actorArgs(u){return {email:u.email,password:u.password};}
function jsonHasPrivate(data,markers){const x=JSON.stringify(data);return markers.some(s=>x.includes(s));}
const panelSelector=".persistent-player-character-profile .player-character-forge-toolbar";
async function startNext(){
 const port=await freePort(),origin="http://127.0.0.1:"+port;
 const server=spawn(process.execPath,[nextBin,"dev","--webpack","-H","127.0.0.1","-p",String(port)],{
  cwd:root,detached:true,stdio:["ignore","pipe","pipe"],
  env:{...env,NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1",
   NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
   NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP:"0",NEXT_PUBLIC_C34_T33_TOWN_STAGE2_SAFE_PROFILE:"0"}
 });
 let log="";
 for(const stream of [server.stdout,server.stderr])
  stream.on("data",value=>{log=(log+value.toString()).slice(-27000);});
 let ready=false;
 for(let tries=0;tries<115;tries++){
  if(server.exitCode!==null)throw Error("Original G2 Next exit "+log);
  try {
   const response=await fetch(origin+"/__c34_t46_global_g2_probe",{signal:AbortSignal.timeout(2500)});
   if(response.ok&&(await response.text()).includes("T46 G2 Original Global Profile")){ready=true;break;}
  }catch{}
  await sleep(1050);
 }
 assert.ok(ready,"Original G2 Next route failed "+log);
 return {server,origin,readLog:()=>log};
}
async function stopNext(serve) {
 if(!serve)return;
 try{process.kill(-serve.server.pid,"SIGTERM")}catch{}
 await sleep(700);
 try{process.kill(-serve.server.pid,"SIGKILL")}catch{}
 await sleep(350);
}
async function openPage(browser,origin){
 const page=await browser.newPage({viewport:{width:1440,height:1024}});
 const raw=[],rpc=[],errors=[];
 page.on("pageerror",err=>errors.push(err.message));
 page.on("request",req=>{
  if(hasOriginalRawFallback(req.url()))raw.push(req.url());
  if(req.url().includes("/rest/v1/rpc/get_my_player_characters_v2"))rpc.push(req.url());
 });
 await page.goto(origin+"/__c34_t46_global_g2_probe",{waitUntil:"domcontentloaded",timeout:95000});
 await page.waitForFunction(()=>!!window.__g2,null,{timeout:75000});
 const call=async(name,...args)=>page.evaluate(async({name,args})=>{
  const fn=window.__g2?.[name];
  if(typeof fn!=="function")throw Error("G2 probe API not mounted: "+name);
  return fn(...args);
 },{name,args});
 return {page,raw,rpc,errors,call};
}
async function toolbarEntries(page){return page.locator(panelSelector+" select option").allTextContents();}
async function expectCharacter(page,name,excluded=null){
 await page.locator(panelSelector+" select").waitFor({state:"attached",timeout:55000});
 await page.waitForFunction(args=>{
  const selector=".persistent-player-character-profile .player-character-forge-toolbar select";
  const e=document.querySelector(selector);
  const labels=[...(e?.options||[])].map(x=>x.textContent||"");
  return labels.some(x=>x.includes(args.name))
    && (!args.excluded||labels.every(x=>!x.includes(args.excluded)));
 },{name,excluded},{timeout:55000});
 const entries=await toolbarEntries(page);
 assert.ok(entries.some(x=>x.includes(name)),name+" missing actual global toolbar");
 if(excluded)assert.ok(entries.every(x=>!x.includes(excluded)),excluded+" stale account row retained");
}
const actors={};
for(const name of ["EDITOR","OWNER","INVENTORY","CONVERT","OUTSIDER","GM"])
 actors[name]=await actor(name);
const pcEditor=randomUUID(),pcOwner=randomUUID();
const editorName="T46 G2 Assigned Editor PC",ownerName="T46 G2 Separate Owner PC";
const secret="T46_G2_PRIVATE_STORY_"+randomUUID(),sheetKey="T46_G2_PRIVATE_SHEET_"+randomUUID();
const originalFingerprint=()=>{
 return sql("SELECT string_agg(id::text||':'||md5(sheet::text),'|' ORDER BY id) "+
 "FROM (SELECT character_id AS id,sheet FROM public.character_sheets "+
 "WHERE character_id IN ("+q(pcEditor)+","+q(pcOwner)+")) s");
};
assert.equal(sql("SELECT current_database()"),"postgres");
assert.ok(sql("SHOW server_version").startsWith("17."));
assert.equal(sql("SELECT to_regprocedure('public.get_my_player_characters_v2()') IS NOT NULL"),"t");
assert.notEqual(sql("SELECT md5(pg_get_functiondef('public.get_my_player_characters_v2()'::regprocedure))"),
 "deca87aaad0dce214743c87cdca03f36","Exact held #345 Stage1 must already be installed");
sql("ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS name text");
sql("ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY");
sql("CREATE POLICY t46_g2_locations ON public.locations FOR SELECT TO authenticated USING(true)");
sql("GRANT SELECT(id,name) ON public.locations TO authenticated");
sql("ALTER TABLE public.players ENABLE ROW LEVEL SECURITY");
sql("CREATE POLICY t46_g2_players ON public.players FOR SELECT TO authenticated USING(user_id=auth.uid())");
sql("GRANT SELECT(id,user_id,name) ON public.players TO authenticated");
for(const [id,name,token] of [[pcEditor,editorName,secret],[pcOwner,ownerName,"T46_G2_OTHER_PRIVATE_"+randomUUID()]]){
 sql("INSERT INTO public.characters(id,name,kind,tags,is_hidden,secret,background,status,description) VALUES("+
 q(id)+","+lit(name)+",'npc',ARRAY['player-character']::text[],true,"+lit(token)+",'Private G2 backstory','active','Public G2 description')");
 sql("INSERT INTO public.character_sheets(character_id,sheet) VALUES("+
 q(id)+","+lit(JSON.stringify({classKey:"fighter",level:6,xp:14000,privateMarker:sheetKey}))+"::jsonb)");
}
for(const [who,id,canEdit,canInventory,canConvert] of [
 [actors.EDITOR,pcEditor,true,false,false],
 [actors.OWNER,pcOwner,true,false,false],
 [actors.INVENTORY,pcEditor,false,true,false],
 [actors.CONVERT,pcEditor,false,false,true]]){
 sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) VALUES("+
 q(id)+","+q(who.id)+","+canEdit+","+canInventory+","+canConvert+")");
}
// Actual same-name non-owner: cannot obtain a delegated PC by legacy name match.
sql("INSERT INTO public.players(user_id,name) VALUES("+q(actors.OUTSIDER.id)+","+lit(editorName)+")");
sql("INSERT INTO private.test_admins(id) VALUES("+q(actors.GM.id)+")");
sql("NOTIFY pgrst,'reload schema'");
const sheetBefore=originalFingerprint();
for(const name of ["EDITOR","OWNER","INVENTORY","CONVERT","OUTSIDER","GM"]){
 const result=await actors[name].who.rpc("get_my_player_characters_v2");
 assert.ifError(result.error);
 const rows=result.data;
 assert.ok(Array.isArray(rows));
 assert.equal(rows.length,["OUTSIDER","GM"].includes(name)?0:1,name+" prebrowser authorized roster");
 if(["INVENTORY","CONVERT"].includes(name)) {
  assert.deepEqual(rows[0].character_sheet,{});
  assert.ok(!jsonHasPrivate(rows,[secret,sheetKey]));
 }
}
console.log("PASS T46-GLOBAL-G2-SERVER: original #345 Stage1 secure role-scoped player RPC, real local signed actors and no unrelated full Sheet");
let serve=null,browser=null,overlaid=false,routeCreated=false;
try{
 fs.writeFileSync(probeFile,probeSource,{flag:"wx"});routeCreated=true;
 browser=await chromium.launch({headless:true,executablePath:env.C33_BROWSER_CHROME,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 // ORIGINAL red: cause actual original global loader's valid signed RPC to
 // become temporarily unavailable, keep real PostgREST delegated permissions
 // query active, and observe actual original raw narrative fallback 403/42501.
 serve=await startNext();
 const original=await openPage(browser,serve.origin);
 await original.page.route("**/rest/v1/rpc/get_my_player_characters_v2",route=>route.fulfill({
  status:404,contentType:"application/json",
  body:JSON.stringify({code:"PGRST202",message:"Disposable G2 forced unavailable RPC"})
 }));
 const forbidden=original.page.waitForResponse(r=>hasOriginalRawFallback(r.url()),{timeout:35000});
 assert.equal(await original.call("login",actors.EDITOR.email,actors.EDITOR.password),actors.EDITOR.id);
 const rawResp=await forbidden;
 assert.equal(rawResp.status(),403,"Original raw 42501 reader was unexpectedly granted");
 const denied=await rawResp.json();
 assert.equal(denied.code,"42501","Original Stage2 forbidden narrative did not deny raw fallback");
 assert.equal(original.raw.length,1,"Expected exactly one original global broad fallback");
 assert.ok(original.raw[0].includes("id=in."),"Actual original delegated scope query missing");
 assert.ok(!JSON.stringify(denied).includes(secret));
 console.log("EXPECTED ORIGINAL T46-GLOBAL-G2-UI-RED: original globally mounted profile falls back from unavailable signed RPC to forbidden narrative-column characters REST, 403/42501; not a town request");
 await original.page.close();
 await stopNext(serve);serve=null;
 assert.equal(gitBlob(fs.readFileSync(originalPanelPath)),pinned["components/PlayerCharacterProfilePanelUnified.js"]);
 const candidate=buildG2GlobalPlayerProfileOverlay(originalPanel.toString("utf8"));
 assert.ok(!candidate.includes('.from("characters")'));
 fs.writeFileSync(originalPanelPath,candidate);overlaid=true;
 serve=await startNext();
 // Test actual current _app mounted global component: signed editor/owner
 // and delegated inventory/convert selection from Stage1 projection.
 for(const name of ["EDITOR","OWNER","INVENTORY","CONVERT"]){
  const p=await openPage(browser,serve.origin);
  const actor=actors[name];
  const rpcResp=p.page.waitForResponse(r=>r.url().includes("/rest/v1/rpc/get_my_player_characters_v2"),{timeout:50000});
  assert.equal(await p.call("login",actor.email,actor.password),actor.id);
  const response=await rpcResp;
  assert.equal(response.status(),200,"Signed RPC not actually executed "+name);
  const rows=await response.json();
  assert.equal(rows.length,1);
  if(["INVENTORY","CONVERT"].includes(name)){
   assert.deepEqual(rows[0].character_sheet,{});
   assert.ok(!jsonHasPrivate(rows,[secret,sheetKey]));
  }
  await expectCharacter(p.page,name==="OWNER"?ownerName:editorName);
  assert.equal(p.raw.length,0,"G2 candidate issued original global raw character query "+name);
  if(["INVENTORY","CONVERT"].includes(name))
   assert.ok(!(await p.page.locator("body").textContent()).includes(secret),
    "Delegated global panel rendered private server narrative");
  await p.page.close();
 }
 console.log("PASS T46-GLOBAL-G2-GLOBAL-AUTH: original _app mounted PlayerProfile real signed editor/owner/inventory/convert toolbar, safe Stage1 delegation, no raw fallback");
 // Missing RPC (PGRST202) must fail closed without a second raw SQL attempt,
 // then recover when signed RPC returns. Do not mislabel missing RPC as no PC.
 const fault=await openPage(browser,serve.origin);
 await fault.page.route("**/rest/v1/rpc/get_my_player_characters_v2",route=>route.fulfill({
  status:404,contentType:"application/json",
  body:JSON.stringify({code:"PGRST202",message:"G2 intentionally unavailable server RPC"})
 }));
 const faultResp=fault.page.waitForResponse(r=>r.url().includes("/rest/v1/rpc/get_my_player_characters_v2"),{timeout:55000});
 await fault.call("login",actors.EDITOR.email,actors.EDITOR.password);
 assert.equal((await faultResp).status(),404);
 await fault.page.waitForFunction(()=>document.body.textContent.includes("Could not load your linked character profiles."),null,{timeout:45000});
 assert.equal(fault.raw.length,0,"Failed RPC provoked original forbidden raw fallback");
 assert.equal(await fault.page.locator(panelSelector).count(),0,"Failed RPC left previously authorized Sheet in UI");
 await fault.page.unroute("**/rest/v1/rpc/get_my_player_characters_v2");
 await fault.call("open");
 await expectCharacter(fault.page,editorName);
 assert.equal(fault.raw.length,0);
 console.log("PASS T46-GLOBAL-G2-FAIL-CLOSED: actual missing signed RPC yields no direct characters fetch or fake creator attachment; explicit UI retry recovers original authorized PC");
 await fault.page.close();
 // Same-name outsider must NOT bind a hidden PC by public players.name.
 for(const name of ["OUTSIDER","GM"]){
  const p=await openPage(browser,serve.origin);
  assert.equal(await p.call("login",actors[name].email,actors[name].password),actors[name].id);
  await p.page.waitForFunction(()=>document.body.textContent.includes("This account does not have a linked character yet."),null,{timeout:45000});
  assert.equal(await p.page.locator(panelSelector).count(),0,name+" got unauthorized PC");
  assert.equal(p.raw.length,0,name+" attempted broad name/other PC fallback");
  await p.page.close();
 }
 console.log("PASS T46-GLOBAL-G2-NO-NAME: outsider sharing a character name and GM without delegated rights cannot bind other PCs or read broad characters");
 // Loaded current player must be cleared before refocus network result; when
 // permissions demote on SAME JWT, Stage1 returns reduced data. Then revoke:
 // suspended global UI must not retain the previous sheet/selection.
 const revoke=await openPage(browser,serve.origin);
 await revoke.call("login",actors.EDITOR.email,actors.EDITOR.password);
 await expectCharacter(revoke.page,editorName);
 await revoke.call("open");
 await revoke.page.locator(panelSelector+" select").waitFor({state:"visible",timeout:50000});
 sql("UPDATE public.character_permissions SET can_edit=false,can_inventory=true WHERE character_id="+q(pcEditor)+
  " AND user_id="+q(actors.EDITOR.id));
 const demoteCall=revoke.page.waitForResponse(r=>r.url().includes("/rest/v1/rpc/get_my_player_characters_v2"),{timeout:45000});
 await revoke.page.evaluate(()=>window.dispatchEvent(new Event("focus")));
 const demoted=await demoteCall;
 assert.equal(demoted.status(),200);
 const demotedRows=await demoted.json();
 assert.equal(demotedRows[0]?.permission?.can_edit,false);
 assert.deepEqual(demotedRows[0]?.character_sheet,{});
 await expectCharacter(revoke.page,editorName);
 assert.ok(!(await revoke.page.locator("body").textContent()).includes(secret),
  "Demoted actor retained original private character narrative in global DOM");
 sql("UPDATE public.character_permissions SET can_inventory=false WHERE character_id="+q(pcEditor)+
  " AND user_id="+q(actors.EDITOR.id));
 const revokeCall=revoke.page.waitForResponse(r=>r.url().includes("/rest/v1/rpc/get_my_player_characters_v2"),{timeout:45000});
 await revoke.page.evaluate(()=>window.dispatchEvent(new Event("focus")));
 assert.deepEqual(await (await revokeCall).json(),[],"Revoked signed account had unauthorized player selection");
 await revoke.page.waitForFunction(()=>!document.querySelector(".persistent-player-character-profile .player-character-forge-toolbar"),null,{timeout:45000});
 await revoke.page.waitForFunction(()=>document.querySelector(".npc-page-profile-panel-backdrop")?.getAttribute("aria-hidden")==="true",null,{timeout:45000});
 assert.equal(await revoke.page.locator(".npc-page-profile-panel-backdrop").getAttribute("aria-hidden"),"true");
 assert.equal(revoke.raw.length,0,"Revocation triggered direct private fallback");
 console.log("PASS T46-GLOBAL-G2-SAME-JWT: actual already-open/suspended global profile loses editor Sheet then loses character on signed server permission revocation and focus");
 await revoke.page.close();
 // Same-mounted actor swap, with a real signed old RPC response held until
 // after another signed account's current response has loaded and rendered.
 const switching=await openPage(browser,serve.origin);
 let heldOnce=false,releaseHeld,signalHeld;
 const released=new Promise(resolve=>{releaseHeld=resolve});
 const captured=new Promise(resolve=>{signalHeld=resolve});
 await switching.page.route("**/rest/v1/rpc/get_my_player_characters_v2",async route=>{
  if(!heldOnce){
   heldOnce=true;
   const response=await route.fetch();
   signalHeld();
   await released;
   await route.fulfill({response});
  }else await route.continue();
 });
 // Re-grant editor temporarily to exercise the originally owned profile.
 sql("UPDATE public.character_permissions SET can_edit=true WHERE character_id="+q(pcEditor)+
  " AND user_id="+q(actors.EDITOR.id));
 await switching.call("login",actors.EDITOR.email,actors.EDITOR.password);
 await Promise.race([captured,sleep(35000).then(()=>{throw Error("Old actor source RPC never held")})]);
 await switching.call("login",actors.OWNER.email,actors.OWNER.password);
 await expectCharacter(switching.page,ownerName,editorName);
 releaseHeld();
 await sleep(1300);
 await expectCharacter(switching.page,ownerName,editorName);
 assert.equal(switching.raw.length,0,"Account change triggered raw global fallback");
 assert.equal(await switching.call("uid"),actors.OWNER.id);
 console.log("PASS T46-GLOBAL-G2-ACTOR-EPOCH: actual signed account switch while previous actor's real 200 RPC response is delayed cannot replace new owner selection; no stale Profile/Sheet");
 await switching.page.close();
 assert.equal(originalFingerprint(),sheetBefore,"Canonical Sheet mutated by G2");
 assert.equal(gitBlob(fs.readFileSync(path.join(root,"components/MapPageClient.js"))),
  pinned["components/MapPageClient.js"],"Protected world map changed");
 console.log("PASS T46-GLOBAL-G2-SIGNED: original global 42501 fallback RED, source-locked candidate fail-closed and authorized selection/actor/cache focus GREEN, original #345 Stage1 unchanged, all production and world map untouched");
}finally{
 if(browser)await browser.close().catch(()=>{});
 if(serve)await stopNext(serve);
 if(overlaid)fs.writeFileSync(originalPanelPath,originalPanel);
 if(routeCreated&&fs.existsSync(probeFile))fs.rmSync(probeFile);
 assert.equal(gitBlob(fs.readFileSync(originalPanelPath)),
  pinned["components/PlayerCharacterProfilePanelUnified.js"],
  "G2 failed to restore original global source byte for byte");
 assert.ok(!fs.existsSync(probeFile),"G2 ephemeral route survived");
 assert.equal(gitBlob(fs.readFileSync(path.join(root,"components/MapPageClient.js"))),
  pinned["components/MapPageClient.js"],"Protected map changed");
}
