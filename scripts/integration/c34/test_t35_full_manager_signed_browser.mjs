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
import { deriveT35FullManager,T35_TEMP_ROUTE } from "./derive_t35_full_npc_manager.mjs";

const env=process.env;
for(const [key,expected] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
 PGPORT:"54322",PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 C34_T35_BROWSER_CONFIRM:"CURRENT_FULL_MANAGER_THREE_GAME_MASTER_LOCAL_ONLY"
}))assert.equal(env[key],expected,"Unsafe T25 env "+key);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.ok(env.C33_BROWSER_TOOL_ROOT&&path.isAbsolute(env.C33_BROWSER_TOOL_ROOT));
assert.ok(env.C33_BROWSER_CHROME&&path.isAbsolute(env.C33_BROWSER_CHROME));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const probe=path.join(root,T35_TEMP_ROUTE);
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

 const secret="T25_GM_SECRET_NEVER_PUBLIC";
 const npc=await createCharacter(users.GM,"npc","T35 Probe NPC",secret);
 const merchant=await createCharacter(users.GM,"merchant","T35 Probe Merchant","T25_MERCHANT_SECRET");

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
 const {output,edits,baseEdits}=deriveT35FullManager(fs.readFileSync(path.join(root,"pages/npcs.js"),"utf8"));
 assert.ok(edits.length>=4 && baseEdits.length>=12);
 fs.writeFileSync(probe,output,{flag:"wx"});
 const nextPort=await freePort(),origin="http://127.0.0.1:"+nextPort;
 const nextBin=path.join(root,"node_modules/next/dist/bin/next");
 assert.ok(fs.existsSync(nextBin),"T25 needs npm ci and pinned Next.js");
 server=spawn(process.execPath,[nextBin,"dev","--webpack","-H","127.0.0.1","-p",String(nextPort)],{
  cwd:root,detached:true,stdio:["ignore","pipe","pipe"],
  env:{...env,NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
   NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1"}
 });
 for(const stream of [server.stdout,server.stderr])
  stream.on("data",b=>serverLog=(serverLog+b.toString()).slice(-16000));
 const route=origin+"/__c34_t35_probe";
 let ready=false;
 for(let i=0;i<110;i++){
  if(server.exitCode!==null)throw Error("T25 Next exited "+serverLog);
  try{
   const response=await fetch(route,{signal:AbortSignal.timeout(2400)});
   if(response.ok&&(await response.text()).includes("npcs-page-root")){ready=true;break}
  }catch{}
  await new Promise(done=>setTimeout(done,1200));
 }
 assert.ok(ready,"T25 derived actual manager failed Next compile "+serverLog);
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
 await page.getByText("T35 Probe NPC",{exact:true}).first().waitFor({timeout:30000});
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
 assert.ok((await body()).includes("T35 Probe NPC"));
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
 assert.ok(extracted.stdout.includes("T35 Probe NPC"));
 assert.ok(!extracted.stdout.includes(secret),"Explicit public PDF leaked GM Secret");
 assert.ok(!extracted.stdout.includes("T25_NOBODY_PRINTS_GM_NOTES"),"PDF rendered GM-only sheet notes");
 console.log("PASS T25-C03 original live manager Print Sheet generates true safe 3-page PDF");
 try {
 await page.locator(".npc-roster-list").getByRole("button",{name:/T35 Probe Merchant/}).click();
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
 await page.getByText("T35 Probe Merchant",{exact:true}).first().waitFor();
 assert.ok(!(await body()).includes(secret),"NPC dossier remained after merchant switch");
 console.log("PASS T25-C04 merchant roster switch clears NPC secret and retains original manager controls");
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
  console.log("PASS T35-MANAGER-"+role+": FULL current manager, signed role, Stage2 dossier, authorized sheet");
  if(role==="ADMIN"){
   // Same actor token, server profile demotion. The UI must evict private
   // dossier, sheet and generated PDF on explicit permission refresh.
   sql("UPDATE public.user_profiles SET role='player' WHERE id="+q(users.ADMIN.id));
   await page.getByTestId("t25-refresh-permissions").click();
   await page.getByTestId("t25-sheet-restricted").waitFor({timeout:60000});
   assert.equal(await page.getByRole("button",{name:"Print Sheet"}).count(),0);
   assert.ok(!(await body()).includes(secret));
   assert.ok(!(await body()).includes("T25 PRIVATE MOTIVATION"));
   console.log("PASS T35-REVOCATION: same-JWT Admin→player evicts source manager dossier/Sheet/PDF");
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
 assert.ok(!(await body()).includes(secret));
 console.log("PASS T35-UNKNOWN: unknown role denied despite broad legacy is_admin(uid)");

 await logout();await login("OUTSIDER");
 await page.getByText("T35 Probe NPC",{exact:true}).first().waitFor();
 await page.getByTestId("t25-sheet-restricted").waitFor();
 assert.equal(await page.getByRole("button",{name:"Print Sheet"}).count(),0,"Outsider retained Print Sheet");
 assert.ok(!(await body()).includes(secret),"Outsider saw prior GM dossier");
 assert.ok(!(await body()).includes("T25 PRIVATE MOTIVATION"));
 console.log("PASS T25-C05 GM-to-outsider signed account switch denies private narrative");
 await logout();await login("COEDITOR");
 await page.locator(".npc-roster-list").getByRole("button",{name:/T35 Probe NPC/}).click();
 await page.getByRole("button",{name:"Print Sheet"}).waitFor();
 sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+q(npc)+
  " AND user_id="+q(users.COEDITOR.id));
 await page.getByTestId("t25-refresh-permissions").click();
 await page.getByTestId("t25-sheet-restricted").waitFor({timeout:30000});
 assert.equal(await page.getByRole("button",{name:"Print Sheet"}).count(),0,"Revoked editor retained Print Sheet");
 assert.ok(!(await body()).includes(secret),"Revoked editor saw GM secret");
 console.log("PASS T25-C06 real local permission revocation and explicit refresh clear elevated manager data");
 assert.deepEqual(offsite,[],"T25 attempted an offsite Supabase request");
 assert.deepEqual(errors,[],"T25 browser exceptions "+errors.join("; "));
 console.log("PASS T35-SIGNED-CHROMIUM: full original manager+true 3-page PDF, exact Admin/GM/DM, unknown/outsider/editor negatives, same-JWT demotion; research only");
}finally {
 if(browser)await browser.close().catch(()=>{});
 if(server?.pid){try{process.kill(-server.pid,"SIGTERM")}catch{server.kill("SIGTERM")}}
 try{fs.unlinkSync(probe)}catch{}
 fs.rmSync(pdfDir,{recursive:true,force:true});
 assert.ok(!fs.existsSync(probe),"T25 must remove disposable Next route in finally");
}
