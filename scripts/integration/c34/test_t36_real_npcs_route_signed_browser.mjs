#!/usr/bin/env node
// T25 REAL derived current manager on disposable Next.js + local PG17/GoTrue.
// No hosted services, no active route edits, no live DB writes or deployments.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { spawn,spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { makeT36Source,reconcileT36Route,T36_LOCAL_ROUTE,T36_MARKER } from "./prepare_t36_npcs_route.mjs";

const env=process.env;
for(const [key,expected] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
 PGPORT:"54322",PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 C34_T36_BROWSER_CONFIRM:"ACTUAL_NPCS_REWRITE_THREE_GAME_MASTERS_LOCAL_ONLY"
}))assert.equal(env[key],expected,"Unsafe T25 env "+key);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.ok(env.C33_BROWSER_TOOL_ROOT&&path.isAbsolute(env.C33_BROWSER_TOOL_ROOT));
assert.ok(env.C33_BROWSER_CHROME&&path.isAbsolute(env.C33_BROWSER_CHROME));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const probe=path.join(root,T36_LOCAL_ROUTE);
const pdfDir=path.join(env.RUNNER_TEMP||"/tmp","c34-t25-pdf-"+randomUUID());
assert.ok(!fs.existsSync(probe),"T25 refuses overwriting a tracked or preexisting route");
const require=createRequire(path.join(env.C33_BROWSER_TOOL_ROOT,"t25-playwright-anchor.cjs"));
const {chromium}=require("playwright-core");
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const sql=query=>{
 const out=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",query],
  {env,encoding:"utf8",timeout:25000});
 assert.equal(out.status,0,"T25 local-only SQL "+out.stderr?.slice(-700));
 return out.stdout.trim();
};
const q=id=>{assert.match(id,/^[0-9a-f-]{36}$/i);return "'"+id+"'";};
async function createRole(name){
 const who=client(),email="t25-"+name+"-"+randomUUID()+"@example.invalid";
 const password="T25-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const result=await who.auth.getUser();assert.ifError(result.error);
 return {who,id:result.data.user.id,email,password};
}
async function freePort(){return new Promise((resolve,reject)=>{
 const s=net.createServer();s.once("error",reject);
 s.listen(0,"127.0.0.1",()=>{const port=s.address().port;s.close(()=>resolve(port))});
})}
async function createCharacter(gm,kind,name,secret){
 const result=await gm.who.rpc("create_character_v1",{p_payload:{
  name,kind,creation_request_id:randomUUID(),
  description:"T25 APPROVED PUBLIC DESCRIPTION",
  background:"T25 PUBLIC BACKGROUND",motivation:"T25 PRIVATE MOTIVATION",
  secret,sheet:{classKey:"fighter",level:1,marker:"T25_REAL_SHEET",
    profileReveal:{background:true,secret:true},
    gmNotes:"T25_NOBODY_PRINTS_GM_NOTES"}
 }});
 assert.ifError(result.error);assert.match(result.data,/^[a-f0-9-]{36}$/i);
 sql("UPDATE public.characters SET is_hidden=false WHERE id="+q(result.data));
 return result.data;
}

// The original stage2 ACL is part of the test authority. Do not grant
// SELECT or change the fixture schema to make the legacy query pass.
// Narrow T24 verified columns are the only direct SELECT roster contract.
let server=null,browser=null,serverLog="";
fs.mkdirSync(pdfDir,{recursive:true});
try {
 const users={};
 for(const name of ["GM","DM","ADMIN","COEDITOR","INVONLY","OUTSIDER","UNKNOWN"])
  users[name]=await createRole(name.toLowerCase());
 sql("INSERT INTO private.test_admins(id) VALUES("+q(users.GM.id)+")");
 // Legacy test_admins seeds only original T25 character creation; the T35
 // server capability and Stage2 dossier must use signed canonical roles.
 for(const [label,role] of [["GM","gm"],["DM","dm"],["ADMIN","admin"],
    ["COEDITOR","player"],["INVONLY","player"],["OUTSIDER","player"],
    ["UNKNOWN","unknown"]]){
  sql("INSERT INTO public.user_profiles(id,role) VALUES("+q(users[label].id)+",'"+role+
    "') ON CONFLICT(id) DO UPDATE SET role=excluded.role");
 }
 // RED: the REAL stage2 source forbids a wide legacy manager roster read.
 // Never grant this to authenticated or bypass the column ACL for testing.
 const legacy=await users.GM.who.from("characters").select(
  "id,name,kind,background,motivation,quirk,mannerism,voice"
 ).eq("kind","npc").limit(1);
 assert.ok(legacy.error,"T25 must prove original wide roster SELECT stays blocked");
 assert.equal(legacy.error.code,"42501",
  "Unexpected wide roster failure; never substitute a blanket SELECT grant");
 // GREEN: T24 already demonstrated exact BASIC public roster query under
 // the same signed auth/RLS. Fail before running browser if this contract drifts.
 const safe=await users.GM.who.from("characters")
  .select("id,name,kind,role,description,location_id,storefront_enabled,is_hidden,portrait_url")
  .in("kind",["npc","merchant"]).limit(2);
 assert.ifError(safe.error);
 console.log("PASS T25-ACL-RED-GREEN: original wide roster denied (42501), T24 narrow signed projection succeeds");

 const secret="T36_GM_SECRET_NEVER_PUBLIC";
 const npc=await createCharacter(users.GM,"npc","T36 Probe NPC",secret);
 const merchant=await createCharacter(users.GM,"merchant","T36 Probe Merchant","T25_MERCHANT_SECRET");

 const merchantSigned=await users.GM.who.from("characters")
  .select("id,name,kind,role,description,location_id,storefront_enabled,is_hidden,portrait_url")
  .eq("kind","merchant").order("name",{ascending:true});
 assert.ifError(merchantSigned.error);
 assert.ok((merchantSigned.data||[]).some(row=>row.id===merchant),
   "Signed GM merchant must exist in T24 approved narrow roster");
 console.log("PASS T25-ACL-MERCHANT: signed merchant exists in exact T24-safe name-ordered roster");

 for(const [label,edit,inventory] of [["COEDITOR",true,false],["INVONLY",false,true]])
  sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) VALUES("+
   q(npc)+","+q(users[label].id)+","+(edit?"true":"false")+","+(inventory?"true":"false")+",false)");
 // Authentic original Stage2 REVOKE makes this original current Manager
 // PostgREST UPDATE fail for signed GM. Never weaken SELECT privileges.
 const before=await users.GM.who.rpc("get_npc_dossier_admin_v1",{p_character_id:npc});
 assert.ifError(before.error);
 const oldPatch={role:null,affiliation:null,
  description:"T25 APPROVED PUBLIC DESCRIPTION",
  background:"T25 PUBLIC BACKGROUND",motivation:"T25 PRIVATE MOTIVATION",
  quirk:null,mannerism:null,voice:null,updated_at:new Date().toISOString()};
 const originalWrite=await users.GM.who.from("characters")
  .update(oldPatch).eq("id",npc);
 assert.equal(originalWrite.error?.code,"42501",
  "T36 source-original Stage2 original PostgREST narrative writer changed; stop rather than restore global SELECT");
 console.log("PASS T36-NARRATIVE-ORIGINAL-RED: original full manager direct table UPDATE correctly denied under original Stage2 column ACL");
 // Only install research SQL in the signed/disposable PG17 CI after T1–T35.
 const install=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-q","-f",
   path.join(root,"scripts/integration/c34/t36_disposable_npc_narrative_save_pg17.sql")],{
   env,cwd:root,encoding:"utf8",timeout:75000
 });
 assert.equal(install.status,0,"T36 protected local narrative RPC SQL: "+install.stderr?.slice(-2200));
 assert.equal(sql("SELECT has_column_privilege('authenticated','public.characters','background','SELECT')::text"),"false",
  "T36 must preserve the source-original Stage2 narrative SELECT revoke");
 // PostgREST's NOTIFY schema refresh is asynchronous. Retry ONLY its
 // temporary missing-function cache error; no authorization errors ignored.
 const call=async(label,patch)=>{
  let response;
  for(let attempt=0;attempt<40;attempt++){
   response=await users[label].who.rpc("c34_npc_narrative_save_research_v1",{
    p_character_id:npc,p_patch:patch
   });
   if(response.error?.code!=="PGRST202")break;
   await new Promise(resolve=>setTimeout(resolve,300));
  }
  assert.notEqual(response.error?.code,"PGRST202","T36 guarded narrative RPC did not enter PostgREST schema cache");
  return response;
 };
 for(const label of ["ADMIN","GM","DM"]){
  const updated="T36 "+label+" GUARDED-NARRATIVE";
  const result=await call(label,{quirk:updated});
  assert.ifError(result.error);assert.equal(result.data,true);
  const dossier=await users[label].who.rpc("get_npc_dossier_admin_v1",{p_character_id:npc});
  assert.ifError(dossier.error);assert.equal(dossier.data?.quirk,updated);
  console.log("PASS T36-NARRATIVE-WRITER-"+label+
    ": authenticated current game manager can save only selected narrative with original Stage2 preserved");
 }
 const editor=await call("COEDITOR",{quirk:"T36 COEDITOR AUTHORIZED"});
 assert.ifError(editor.error);assert.equal(editor.data,true,
  "Original can_edit delegate must retain narrative rights without accessing GM secret");
 const initialProtected=await users.GM.who.rpc("get_npc_dossier_admin_v1",{p_character_id:npc});
 assert.ifError(initialProtected.error);
 for(const label of ["INVONLY","OUTSIDER","UNKNOWN"]){
  const result=await call(label,{quirk:"T36 FORBIDDEN "+label});
  assert.equal(result.error?.code,"42501","T36 noneditor denied");
 }
 const anonWrite=await client().rpc("c34_npc_narrative_save_research_v1",{
  p_character_id:npc,p_patch:{quirk:"T36 ANON FORBIDDEN"}
 });
 assert.ok(anonWrite.error);
 const afterProtected=await users.GM.who.rpc("get_npc_dossier_admin_v1",{p_character_id:npc});
 assert.ifError(afterProtected.error);
 assert.equal(afterProtected.data?.quirk,initialProtected.data?.quirk);
 console.log("PASS T36-NARRATIVE-NONMANAGER: player/unknown/inventory-only and anonymous denied, no mutation");
 for(const forbidden of ["secret","tags","kind","location_id","map_icon_id","updated_at"]){
  const attack=await call("GM",{[forbidden]:"FORGED"});
  assert.equal(attack.error?.code,"22023",
    "T36 narrative writer accepted non-narrative field "+forbidden);
 }
 const afterForge=await users.GM.who.rpc("get_npc_dossier_admin_v1",{p_character_id:npc});
 assert.ifError(afterForge.error);
 assert.equal(afterForge.data?.secret,secret);
 assert.equal(afterForge.data?.quirk,initialProtected.data?.quirk);
 console.log("PASS T36-NARRATIVE-SECRET-DENY: no secret/map/tags/kind/time forgery or bypass");
 const generated=makeT36Source();
 assert.match(generated,/data-c34-t36="source-derived-stage2"/);
 assert.ok(!fs.existsSync(probe),"T36 refuses tracked or preexisting scratch route");
 const nextBin=path.join(root,"node_modules/next/dist/bin/next");
 assert.ok(fs.existsSync(nextBin),"T36 needs pinned npm-ci Next.js");
 // In the very same disposable signed fixture, prove the flag OFF
 // serves the untouched original /npcs and does not expose a generated page.
 const offPort=await freePort(),offOrigin="http://127.0.0.1:"+offPort;
 let offServer=null,offLog="";
 try{
  offServer=spawn(process.execPath,[nextBin,"dev","--webpack","-H","127.0.0.1","-p",String(offPort)],{
   cwd:root,detached:true,stdio:["ignore","pipe","pipe"],
   env:{...env,NEXT_PUBLIC_C34_T36_NPCS_RESEARCH:"0",
    NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
    NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1"},
  });
  for(const stream of [offServer.stdout,offServer.stderr])
    stream.on("data",chunk=>offLog=(offLog+chunk.toString()).slice(-12000));
  let offReady=false;
  for(let attempt=0;attempt<100;attempt++){
   if(offServer.exitCode!==null)throw Error("T36 original /npcs exited: "+offLog);
   try{
    const off=await fetch(offOrigin+"/npcs",{signal:AbortSignal.timeout(3000)});
    const html=await off.text();
    if(off.ok&&html.includes("npcs-page-root")){
     assert.ok(!html.includes(T36_MARKER),"T36 flag OFF returned experimental manager");
     offReady=true;break;
    }
   }catch{}
   await new Promise(resolve=>setTimeout(resolve,950));
  }
  assert.ok(offReady,"T36 original flag OFF route did not compile: "+offLog);
  const hidden=await fetch(offOrigin+"/__c34_t36_npcs",{signal:AbortSignal.timeout(6000)});
  assert.equal(hidden.status,404,"T36 disabled source-derived target exposed");
  assert.ok(!fs.existsSync(probe),"T36 OFF unexpectedly wrote generated Pages Router source");
  console.log("PASS T36-ROUTE-OFF: genuine local Next unchanged /npcs 200, candidate 404, no generated source");
 }finally{
  if(offServer?.pid){try{process.kill(-offServer.pid,"SIGTERM")}catch{offServer.kill("SIGTERM")}}
  await new Promise(resolve=>setTimeout(resolve,1100));
 }
 // Prepare ON exactly once in this test process. Next config merely
 // validates the pre-generated source and can never regenerate it on exit.
 const signedOn={...env,NEXT_PUBLIC_C34_T36_NPCS_RESEARCH:"1",
  C34_T36_LOCAL_CONFIRM:"SIGNED_LOCAL_PG17_T36_ONLY"};
 assert.ok(reconcileT36Route(signedOn,{prepare:true}),
  "T36 signed source preparation failed");
 assert.ok(fs.existsSync(probe),"T36 prepared route missing before Next startup");
 const nextPort=await freePort(),origin="http://127.0.0.1:"+nextPort;
 server=spawn(process.execPath,[nextBin,"dev","--webpack","-H","127.0.0.1","-p",String(nextPort)],{
  cwd:root,detached:true,stdio:["ignore","pipe","pipe"],
  env:{...env,NEXT_PUBLIC_C34_T36_NPCS_RESEARCH:"1",
   C34_T36_LOCAL_CONFIRM:"SIGNED_LOCAL_PG17_T36_ONLY",
   NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
   NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1"}
 });
 for(const stream of [server.stdout,server.stderr])
  stream.on("data",b=>serverLog=(serverLog+b.toString()).slice(-16000));
 const route=origin+"/npcs";
 let ready=false;
 for(let i=0;i<110;i++){
  if(server.exitCode!==null)throw Error("T25 Next exited "+serverLog);
  try{
   const response=await fetch(route,{signal:AbortSignal.timeout(2400)});
   if(response.ok&&(await response.text()).includes(T36_MARKER)){ready=true;break}
  }catch{}
  await new Promise(done=>setTimeout(done,1200));
 }
 assert.ok(ready,"T25 derived actual manager failed Next compile "+serverLog);
 assert.ok(fs.existsSync(probe),"T36 ON flag did not generate full manager route");
 console.log("PASS T36-ROUTE-ON: actual /npcs rewrite serves T35 source-derived full manager");
 console.log("PASS T25-C01 derived original 2420-line NPC manager compiled on current Next with unchanged _app");
 browser=await chromium.launch({executablePath:env.C33_BROWSER_CHROME,
  headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
 const page=await context.newPage(),offsite=[],errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",async r=>{
  const url=r.request().url();
  if(url.startsWith(origin)||url.startsWith(env.DNDNEXT_C34_LOCAL_URL)||
     url.startsWith("ws://127.0.0.1:"+nextPort))return r.continue();
  if(/supabase\.co|supabase\.in|service_role/i.test(url))offsite.push(url.slice(0,160));
  return r.abort();
 });
 await page.addInitScript(()=>{
  const originalCreate=URL.createObjectURL.bind(URL);
  window.__T25_PDF_BYTES__=null;
  URL.createObjectURL=blob=>{
   if(blob?.type==="application/pdf")
    blob.arrayBuffer().then(buf=>window.__T25_PDF_BYTES__=Array.from(new Uint8Array(buf)));
   return originalCreate(blob);
  };
 });
 const login=async(label)=>{
  const {email,password}=users[label];
  const response=await page.evaluate(async({email,password})=>{
   const {data,error}=await window.__sb.auth.signInWithPassword({email,password});
   if(error)throw Error(error.message);
   return data.user.id;
  },{email,password});
  assert.equal(response,users[label].id);
  await page.reload({waitUntil:"domcontentloaded"});
 };
 const logout=async()=>{
  await page.evaluate(async()=>{
   const {error}=await window.__sb.auth.signOut();
   if(error)throw Error(error.message);
  });
 };
 const body=()=>page.locator(".npcs-page-root").innerText();
 await page.goto(route+"?focus=npc:"+npc,{waitUntil:"domcontentloaded",timeout:30000});
 await page.waitForFunction(()=>!!window.__sb?.auth,null,{timeout:30000});
 await page.addStyleTag({path:path.join(root,"node_modules/bootstrap/dist/css/bootstrap.min.css")});
 await login("GM");
 try {
 await page.getByText("T36 Probe NPC",{exact:true}).first().waitFor({timeout:30000});
 } catch(error) {
  const details=await page.evaluate(async()=>{
   const user=await window.__sb?.auth?.getUser().catch(e=>({error:{message:String(e)}}));
   const jwt=user?.data?.user?.id||"no-actor";
   const direct=await window.__sb?.from("characters")
    .select("id,name,kind").eq("kind","npc").limit(5)
    .then(v=>({error:v.error?.message||null,code:v.error?.code||null,rows:v.data?.map(x=>({id:x.id,name:x.name}))}))
    .catch(e=>({exception:String(e)}));
   return {jwt,direct,body:document.body.innerText.slice(0,4000)};
  });
  console.error("T25-DIAG-C02",JSON.stringify({
   details,pageUrl:page.url(),pageErrors:errors,offsite,
   nextServerLog:serverLog.slice(-7000)
  }));
  throw error;
 }
 await page.locator('.npcs-page-root['+T36_MARKER+']').waitFor({state:"visible",timeout:30000});
 await page.locator('[data-testid="t25-selected-character"]').waitFor({state:"visible",timeout:30000});
 assert.equal(await page.getByTestId("t25-selected-character").getAttribute("data-character-id"),npc,
  "Focus route must select requested NPC ID, never whichever roster completes first");
 try {
 await page.getByText("T25 APPROVED PUBLIC DESCRIPTION").first().waitFor({timeout:30000});
 } catch(error){
  const state=await page.evaluate(async(id)=>{
   const auth=await window.__sb.auth.getUser();
   const profile=await window.__sb.rpc("get_npc_profile_visible_v1",{p_character_id:id});
   return {userId:auth.data?.user?.id||null,status:profile.error?.code||"ok",
    profileId:profile.data?.id||null,description:profile.data?.description||null,
    visibleText:document.body.innerText.slice(0,3000)};
  },npc);
  console.error("T25-DIAG-C02-DESCRIPTION",JSON.stringify({state,pageErrors:errors}));
  throw error;
 }
 assert.ok((await body()).includes("T36 Probe NPC"));
 try {
  await page.getByText("T25 PUBLIC BACKGROUND",{exact:true}).first().waitFor({timeout:30000});
 } catch(error){
  const probe=await page.evaluate(async(id)=>{
   const user=await window.__sb.auth.getUser();
   const profile=await window.__sb.rpc("get_npc_profile_visible_v1",{p_character_id:id});
   const gm=await window.__sb.rpc("get_npc_dossier_admin_v1",{p_character_id:id});
   return {
    actorPresent:!!user?.data?.user,
    profileStatus:profile.error?.code||"ok",
    profileId:profile.data?.id||null,
    profileBackground:profile.data?.lore?.background||null,
    gmStatus:gm.error?.code||"ok",
    gmId:gm.data?.id||null,
    visibleText:document.body.innerText.slice(0,3500),
   };
  },npc);
  console.error("T25-DIAG-BACKGROUND",JSON.stringify({probe,pageErrors:errors}));
  throw error;
 }
 console.log("PASS T25-C02 original deep-link and GM selected Profile load without page-wide sheet cache");
 await page.getByRole("button",{name:"Print Sheet"}).waitFor({timeout:30000});
 await page.getByRole("button",{name:"Print Sheet"}).click();
 await page.waitForFunction(()=>Array.isArray(window.__T25_PDF_BYTES__)&&window.__T25_PDF_BYTES__.length>1000,null,{timeout:30000});
 const bytes=await page.evaluate(()=>window.__T25_PDF_BYTES__);
 const pdf=await PDFDocument.load(Uint8Array.from(bytes));
 assert.equal(pdf.getPageCount(),3);
 const file=path.join(pdfDir,"gm-public.pdf");fs.writeFileSync(file,Buffer.from(bytes));
 const extracted=spawnSync("pdftotext",["-layout",file,"-"],{env,encoding:"utf8",timeout:20000});
 assert.equal(extracted.status,0,extracted.stderr);
 assert.ok(extracted.stdout.includes("T36 Probe NPC"));
 assert.ok(!extracted.stdout.includes(secret),"Explicit public PDF leaked GM Secret");
 assert.ok(!extracted.stdout.includes("T25_NOBODY_PRINTS_GM_NOTES"),"PDF rendered GM-only sheet notes");
 console.log("PASS T25-C03 original live manager Print Sheet generates true safe 3-page PDF");
 // T36 tests the actual derived UI Edit/Done code path, not a synthetic
 // direct SQL patch. The original five-column Stage2 ACL remains enforced.
 await page.getByRole("button",{name:"Edit",exact:true}).first().click();
 const editTexts=page.locator("textarea");
 const idx=await editTexts.evaluateAll(nodes=>
   nodes.findIndex(node=>node.value==="T25 PUBLIC BACKGROUND"));
 assert.ok(idx>=0,"T36 actual Edit did not expose the selected background textarea");
 const modified="T36 SIGNED GM NARRATIVE SAVE";
 await editTexts.nth(idx).fill(modified);
 await page.getByRole("button",{name:"Done",exact:true}).click();
 // The full original Sheet component catches onSave errors internally. A
 // timeout without inspecting its inline error hides the real authority bug.
 try{
  await page.getByRole("button",{name:"Edit",exact:true}).first().waitFor({timeout:14000});
 }catch(original){
  const stage2=await users.GM.who.rpc("get_npc_dossier_admin_v1",{p_character_id:npc});
  const diagnostic=await page.evaluate(()=>{
   const root=document.querySelector(".csheet");
   const visible=e=>e&&!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length);
   return {
    errors:[...(root?.querySelectorAll(".alert-danger")||[])].map(e=>e.textContent?.trim()),
    buttons:[...(root?.querySelectorAll("button")||[])].filter(visible)
      .map(e=>({text:e.textContent?.trim(),disabled:e.disabled})).slice(0,25),
    editor:!!root?.classList?.contains("csheet--edit"),
    roleLabel:document.querySelector(".npcs-page-root .ms-auto.small")?.textContent?.trim()||null,
   };
  });
  console.error("T36-DIAG-SAVE-ORIGINAL-SHEET",JSON.stringify({
   ...diagnostic,stage2Error:stage2.error?.code||null,
   narrativeStored:stage2.data?.background==="T36 SIGNED GM NARRATIVE SAVE",
   pageErrors:errors.slice(-8)
  }));
  throw original;
 }
 const saved=await users.GM.who.rpc("get_npc_dossier_admin_v1",{p_character_id:npc});
 assert.ifError(saved.error);
 assert.equal(saved.data?.background,modified,
  "T36 actual /npcs Edit→Done original narrative persistence denied");
 console.log("PASS T36-NARRATIVE-GM: real full manager Edit/Done writes Stage2 narrative via original authorized server path");

 // After narrative editing, a lower roster entry can become covered by
 // the original detail panel. Use the actual UI search to move the target
 // into the TOP of the independently scrolling roster before normal click.
 // No force/DOM handler, so an inaccessible button is still a real failure.
 await page.getByPlaceholder("Search NPCs & merchants…").fill("T36 Probe Merchant");
 const targetMerchant=page.locator(".npc-roster-list")
  .getByRole("button",{name:/T36 Probe Merchant/});
 await targetMerchant.waitFor({state:"visible",timeout:15000});
 assert.equal(await page.locator(".npc-roster-list button").count(),1,
  "T36 expected one merchant after user-visible roster filter");
 try {
 await targetMerchant.click();
 } catch(error) {
  const probe=await page.evaluate(async()=>{
   const r=await window.__sb.from("characters")
     .select("id,name,kind,role,description,location_id,storefront_enabled,is_hidden,portrait_url")
     .eq("kind","merchant").order("name",{ascending:true});
   return {error:r.error?.message||null,code:r.error?.code||null,
    rows:(r.data||[]).map(v=>({id:v.id,name:v.name})).slice(0,10),
    visibleText:document.body.innerText.slice(0,2400)};
  });
  console.error("T25-DIAG-C04-MERCHANT",JSON.stringify({probe,pageErrors:errors}));
  throw error;
 }
 await page.getByText("T36 Probe Merchant",{exact:true}).first().waitFor();
 assert.ok(!(await body()).includes(secret),"NPC dossier remained after merchant switch");
 console.log("PASS T25-C04 merchant roster switch clears NPC secret and retains original manager controls");
 let t37LastBackground=modified;
 // T35: full current NPC manager and current signed server-role check for
 // owner-approved game administrators ADMIN and DM, not just historical GM.
 for(const role of ["ADMIN","DM"]){
  await logout();await login(role);
  await page.goto(route+"?focus=npc:"+npc,{waitUntil:"domcontentloaded",timeout:90000});
  await page.getByTestId("t25-selected-character").waitFor({timeout:60000});
  assert.equal(await page.getByTestId("t25-selected-character").getAttribute("data-character-id"),npc);
  await page.getByRole("button",{name:"Print Sheet"}).waitFor({timeout:60000});
  const verified=await page.evaluate(async id=>{
   const role=await window.__sb.rpc("c34_game_manager_capabilities_research_v1");
   const dossier=await window.__sb.rpc("get_npc_dossier_admin_v1",{p_character_id:id});
   return {status:role.error?.code||"ok",role:role.data?.role,
     canManage:role.data?.canManageNpcPlayers,
     dossierCode:dossier.error?.code||null,dossierId:dossier.data?.id,
     secret:dossier.data?.secret};
  },npc);
  assert.equal(verified.status,"ok");assert.equal(verified.role,role.toLowerCase());
  assert.equal(verified.canManage,true);assert.equal(verified.dossierCode,null);
  assert.equal(verified.dossierId,npc);assert.equal(verified.secret,secret);
  console.log("PASS T36-MANAGER-"+role+": actual /npcs full manager, signed original Stage2 dossier and Sheet");
  // T37-P1 extends the proven real-route GM UI Save to BOTH other game
  // managers. This runs against the actual source-derived /npcs page, not a
  // mocked editor or broad characters-column GRANT.
  await page.getByText(t37LastBackground,{exact:true}).first().waitFor({timeout:30000});
  await page.getByRole("button",{name:"New NPC",exact:true}).click();
  const forge=page.locator(".npc-forge-modal");
  await forge.waitFor({state:"visible",timeout:30000});
  assert.ok((await forge.innerText()).includes("Species"),
    "T37 full source-original NewNpcModal did not render the actual Forge steps");
  await forge.getByRole("button",{name:"Cancel",exact:true}).click();
  await forge.waitFor({state:"detached",timeout:30000});
  console.log("PASS T37-CREATOR-ENTRY-"+role+
    ": real full NewNpcModal opens and cancels without creating a character");
  await page.getByRole("button",{name:"Edit",exact:true}).first().click();
  const t37Index=await page.locator("textarea").evaluateAll(
    (nodes,expectedBackground)=>nodes.findIndex(node=>node.value===expectedBackground),
    t37LastBackground
  );
  assert.ok(t37Index>=0,"T37 "+role+" real Sheet Edit missing selected background");
  const t37Next="T37 "+role+" SIGNED ORIGINAL UI SAVE";
  await page.locator("textarea").nth(t37Index).fill(t37Next);
  await page.getByRole("button",{name:"Done",exact:true}).click();
  await page.getByRole("button",{name:"Edit",exact:true}).first().waitFor({timeout:30000});
  const t37Saved=await users[role].who.rpc("get_npc_dossier_admin_v1",{
    p_character_id:npc
  });
  assert.ifError(t37Saved.error);
  assert.equal(t37Saved.data?.background,t37Next,
    "T37 "+role+" actual /npcs UI narrative save failed original Stage2 readback");
  assert.equal(t37Saved.data?.secret,secret,
    "T37 "+role+" narrative edit unexpectedly changed the GM-only secret");
  t37LastBackground=t37Next;
  console.log("PASS T37-NARRATIVE-"+role+
    ": real Edit/Done persists original NPC background, secret unchanged");
  if(role==="ADMIN"){
   // Same actor token, server profile demotion. The UI must evict private
   // dossier, sheet and generated PDF on explicit permission refresh.
   sql("UPDATE public.user_profiles SET role='player' WHERE id="+q(users.ADMIN.id));
   const revokedNarrative=await users.ADMIN.who.rpc("c34_npc_narrative_save_research_v1",{
    p_character_id:npc,p_patch:{quirk:"T36 DEMOTED FORBIDDEN"}
   });
   assert.equal(revokedNarrative.error?.code,"42501",
     "T36 same JWT Admin demotion retained write authority");
   await page.getByTestId("t25-refresh-permissions").click();
   await page.getByTestId("t25-sheet-restricted").waitFor({timeout:60000});
   assert.equal(await page.getByRole("button",{name:"Print Sheet"}).count(),0);
   assert.equal(await page.getByRole("button",{name:"New NPC",exact:true}).count(),0,
     "T37 revoked Admin retained NPC creator entry");
   console.log("PASS T37-CREATOR-REVOKED: same-JWT Admin->player loses real New NPC action");
   assert.ok(!(await body()).includes(secret));
   assert.ok(!(await body()).includes("T25 PRIVATE MOTIVATION"));
   console.log("PASS T36-REVOCATION: real /npcs same-JWT Admin→player evicts dossier/Sheet/PDF");
  }
 }
 await logout();await login("UNKNOWN");
 await page.goto(route+"?focus=npc:"+npc,{waitUntil:"domcontentloaded",timeout:90000});
 await page.getByTestId("t25-selected-character").waitFor({timeout:60000});
 await page.getByTestId("t25-sheet-restricted").waitFor({timeout:60000});
 assert.equal(await page.getByRole("button",{name:"Print Sheet"}).count(),0);
 const unknown=await page.evaluate(async id=>{
  const role=await window.__sb.rpc("c34_game_manager_capabilities_research_v1");
  const dossier=await window.__sb.rpc("get_npc_dossier_admin_v1",{p_character_id:id});
  return {role:role.data?.role,canManage:role.data?.canManageNpcPlayers,
    blocked:!!dossier.error};
 },npc);
 assert.equal(unknown.role,"unknown");
 assert.equal(unknown.canManage,false);assert.equal(unknown.blocked,true);
 assert.equal(await page.getByRole("button",{name:"New NPC",exact:true}).count(),0,
   "T37 unknown actor saw original Forge creator entry");
 console.log("PASS T37-CREATOR-UNKNOWN: unknown role cannot open original NPC Forge");
 assert.ok(!(await body()).includes(secret));
 console.log("PASS T36-UNKNOWN: real /npcs unknown role denied despite legacy is_admin(uid)");

 await logout();await login("OUTSIDER");
 await page.getByText("T36 Probe NPC",{exact:true}).first().waitFor();
 await page.getByTestId("t25-sheet-restricted").waitFor();
 assert.equal(await page.getByRole("button",{name:"Print Sheet"}).count(),0,"Outsider retained Print Sheet");
 assert.ok(!(await body()).includes(secret),"Outsider saw prior GM dossier");
 assert.ok(!(await body()).includes("T25 PRIVATE MOTIVATION"));
 console.log("PASS T25-C05 GM-to-outsider signed account switch denies private narrative");
 await logout();await login("COEDITOR");
 await page.locator(".npc-roster-list").getByRole("button",{name:/T36 Probe NPC/}).click();
 await page.getByRole("button",{name:"Print Sheet"}).waitFor();
 sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+q(npc)+
  " AND user_id="+q(users.COEDITOR.id));
 const revokedEditor=await users.COEDITOR.who.rpc("c34_npc_narrative_save_research_v1",{
  p_character_id:npc,p_patch:{quirk:"T36 REVOKED DELEGATE FORBIDDEN"}
 });
 assert.equal(revokedEditor.error?.code,"42501",
  "T36 same JWT collaborator lost can_edit but retained narrative write");
 await page.getByTestId("t25-refresh-permissions").click();
 await page.getByTestId("t25-sheet-restricted").waitFor({timeout:30000});
 assert.equal(await page.getByRole("button",{name:"Print Sheet"}).count(),0,"Revoked editor retained Print Sheet");
 assert.ok(!(await body()).includes(secret),"Revoked editor saw GM secret");
 console.log("PASS T25-C06 real local permission revocation and explicit refresh clear elevated manager data");
 assert.deepEqual(offsite,[],"T25 attempted an offsite Supabase request");
 assert.deepEqual(errors,[],"T25 browser exceptions "+errors.join("; "));
 console.log("PASS T36-SIGNED-CHROMIUM: actual /npcs OFF/ON, full original manager 3-page PDF, signed Admin/GM/DM, unknown/editor negatives, same-JWT demotion, local only");
}finally {
 if(browser)await browser.close().catch(()=>{});
 // Next dev may still be compiling after SIGTERM; if cleanup happens
 // before its process group exits, the watcher can regenerate the untracked
 // Pages Router alias. Wait for process teardown before exact-source deletion.
 if(server?.pid){
  try{process.kill(-server.pid,"SIGTERM")}catch{server.kill("SIGTERM")}
  if(server.exitCode===null && server.signalCode===null){
   await Promise.race([
    new Promise(resolve=>{
     server.once("close",resolve);
     if(server.exitCode!==null||server.signalCode!==null)resolve();
    }),
    new Promise(resolve=>setTimeout(resolve,8000))
   ]);
  }
 }
 // Source-verified cleanup is stricter than unlink: cannot delete unknown files.
 reconcileT36Route({...env,NEXT_PUBLIC_C34_T36_NPCS_RESEARCH:"0"},{cleanup:true});
 fs.rmSync(pdfDir,{recursive:true,force:true});
 assert.ok(!fs.existsSync(probe),"T36 generated Pages Router alias must be absent after signed test");
 await new Promise(resolve=>setTimeout(resolve,1100));
 assert.ok(!fs.existsSync(probe),"T36 Next watcher regenerated generated route after teardown");
 console.log("PASS T36-ROUTE-CLEANUP: Next terminated; exact generated page remains absent");
}
