#!/usr/bin/env node
// test_t24_current_next_manager_browser.mjs
// C34 T24: REAL CURRENT-HEAD NEXT.JS PAGES ROUTER + Chromium + LOCAL signed
// GoTrue/PostgREST/PG17. Synthetic test data only, no checked-in test route.
// Original #345 browser and historical negative tests run separately unchanged.
// NO production environment, no service-role key, no map or active UI import.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn,spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";

const env=process.env;
for(const [name,value] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
 PGPORT:"54322",PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 C34_T24_BROWSER_CONFIRM:"CURRENT_NEXT_DISPOSABLE_LOCAL_ONLY"
})) assert.equal(env[name],value,"Unsafe T24 environment "+name);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.ok(env.C33_BROWSER_TOOL_ROOT&&path.isAbsolute(env.C33_BROWSER_TOOL_ROOT));
assert.ok(env.C33_BROWSER_CHROME&&path.isAbsolute(env.C33_BROWSER_CHROME));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const probe=path.join(root,"pages/__c34_t24_probe.jsx");
const sourcePage=path.join(root,"scripts/integration/c34/fixtures/t24_nonmap_manager_next_probe_page.jsx");
assert.ok(fs.existsSync(sourcePage)&&!fs.existsSync(probe),
 "T24 refuses existing/production route overwrite");
const require=createRequire(path.join(env.C33_BROWSER_TOOL_ROOT,"t24-playwright-anchor.cjs"));
const {chromium}=require("playwright-core");
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const sql=query=>{
 const out=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",query],
  {env,encoding:"utf8",timeout:25000});
 assert.equal(out.status,0,"T24 local-only SQL: "+out.stderr?.slice(-750));
 return out.stdout.trim();
};
const q=id=>{assert.match(id,/^[0-9a-f-]{36}$/i);return "'"+id+"'";};
async function createRole(label){
 const who=client(),email="c34-t24-"+label+"-"+randomUUID()+"@example.invalid";
 const password="T24-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const user=await who.auth.getUser();assert.ifError(user.error);
 return {who,id:user.data.user.id,email,password};
}
async function port(){
 return await new Promise((resolve,reject)=>{
  const s=net.createServer();
  s.once("error",reject);
  s.listen(0,"127.0.0.1",()=>{
   const value=s.address().port;
   s.close(()=>resolve(value));
  });
 });
}
function fighterPayload(){
 return {name:"T24 signed source creator",creation_request_id:randomUUID(),secret:null,
  sheet:{classKey:"fighter",level:1,marker:"T24_CANONICAL_SHEET",
   background:"Soldier",meta:{backgroundSource:"XPHB",speciesKey:"Elf"},
   featGrantInstances:[{instanceId:"c34-t5-origin-lucky",
     optionId:"00000000-0000-0000-0000-000000009154",name:"Lucky",
     source:"XPHB",optionType:"feat",acquisitionLevel:1,choices:{},fixedEffects:[]}],
   feats:["Lucky"],
   classFeatureChoices:{fightingStyle:{kind:"fighting-style",count:1,
     level:1,label:"Fighting Style",
     selections:[{name:"Defense",key:"defense",source:"XPHB"}]}},
   classFeatureChoiceSummary:[{groupId:"fightingStyle",key:"defense",
     name:"Defense",source:"XPHB"}],
   startingEquipmentSelections:{mode:"package",classOption:"A",ruleset:"vanilla",
     backgroundId:"00000000-0000-0000-0000-000000009150",
     backgroundOption:"A",choices:{}}
  }};
}
async function createGmCharacter(gm,kind,name,secret){
 const out=await gm.who.rpc("create_character_v1",{p_payload:{
  name,kind,creation_request_id:randomUUID(),description:"T24 APPROVED PUBLIC PROFILE",
  background:"T24 APPROVED PUBLIC BACKGROUND",
  motivation:"T24 UNREVEALED MOTIVATION",secret,
  sheet:{classKey:"fighter",level:1,marker:"T24_GM_CANONICAL_SHEET",
   profileReveal:{background:true,secret:true},
   gmNotes:"T24_PRIVATE_SHEET_KEPT_BY_RLS"}
 }});
 assert.ifError(out.error);assert.match(out.data,/^[a-f0-9-]{36}$/i);
 sql("UPDATE public.characters SET is_hidden=false WHERE id="+q(out.data));
 return out.data;
}
const roles={};
for(const name of ["CREATOR","COEDITOR","INVONLY","CONVERT","GM","OUTSIDER"])
 roles[name]=await createRole(name.toLowerCase());
sql("INSERT INTO private.test_admins(id) VALUES("+q(roles.GM.id)+")");
const personal="T24_ORIGINAL_CREATOR_PRIVATE_STORY";
const creator=await roles.CREATOR.who.rpc("create_player_character_with_private_backstory_v1",{
 p_payload:fighterPayload(),p_spell_choices:[],p_magic_selections:[],
 p_private_backstory:personal
});
assert.ifError(creator.error);const creatorId=creator.data;
const gmSecret="T24_GM_DOSSIER_NEVER_PUBLIC";
const npcId=await createGmCharacter(roles.GM,"npc","T24 Profile NPC",gmSecret);
const merchantId=await createGmCharacter(roles.GM,"merchant",
 "T24 Profile Merchant","T24_MERCHANT_PRIVATE");
for(const cid of [creatorId,npcId]){
 sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) VALUES("+
 q(cid)+","+q(roles.COEDITOR.id)+",true,false,false),("+
 q(cid)+","+q(roles.INVONLY.id)+",false,true,false),("+
 q(cid)+","+q(roles.CONVERT.id)+",false,false,true)");
}
console.log("PASS C34-T24-SEED: actual signed creator private Story, GM NPC/merchant and separate coeditor/inventory/convert/outsider rights on T21 local DB");


const temp=path.join(env.RUNNER_TEMP||"/tmp","c34-t24-manager-pdf-"+randomUUID());
fs.mkdirSync(temp,{recursive:true});
let server=null,browser=null,serverLogs="";
fs.copyFileSync(sourcePage,probe);
try{
 assert.match(fs.readFileSync(probe,"utf8"),/NonMapNpcManagerResearchShell/);
 const nextPort=await port(),origin="http://127.0.0.1:"+nextPort;
 const nextBin=path.join(root,"node_modules/next/dist/bin/next");
 assert.ok(fs.existsSync(nextBin),"npm ci required before T24 Next browser");
 server=spawn(process.execPath,[nextBin,"dev","-H","127.0.0.1","-p",String(nextPort)],{
  cwd:root,env:{...env,NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
   NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1"},
  detached:true,stdio:["ignore","pipe","pipe"]
 });
 for(const channel of [server.stdout,server.stderr])
  channel.on("data",b=>{serverLogs=(serverLogs+b.toString()).slice(-15000)});
 const route=origin+"/__c34_t24_probe";
 let ready=false;
 for(let attempt=0;attempt<110;attempt++){
  if(server.exitCode!==null)throw Error("T24 Next dev exited: "+serverLogs);
  try{
   const response=await fetch(route,{signal:AbortSignal.timeout(2800)});
   if(response.ok&&(await response.text()).includes("c34-t24-next-page")){
    ready=true;break;
   }
  }catch(_err){}
  await new Promise(resolve=>setTimeout(resolve,1400));
 }
 assert.ok(ready,"T24 current-Next isolated manager did not compile: "+serverLogs);
 console.log("PASS C34-T24-NEXT: current Next.js _app + isolated manager candidate route, no checked-in active page");

 browser=await chromium.launch({executablePath:env.C33_BROWSER_CHROME,
  headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const ctx=await browser.newContext({viewport:{width:1280,height:900}});
 const page=await ctx.newPage(),offsite=[],errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",async requestRoute=>{
  const url=requestRoute.request().url();
  if(url.startsWith(origin)||url.startsWith(env.DNDNEXT_C34_LOCAL_URL)||
     url.startsWith("ws://127.0.0.1:"+nextPort))
    return requestRoute.continue();
  if(/supabase\.co|supabase\.in|service_role/i.test(url))
   offsite.push(url.slice(0,160));
  return requestRoute.abort();
 });
 await page.goto(route,{waitUntil:"domcontentloaded",timeout:30000});
 await page.waitForFunction(()=>!!window.__C34_T24_TEST_API__,null,{timeout:30000});
 await page.addStyleTag({path:path.join(root,"node_modules/bootstrap/dist/css/bootstrap.min.css")});
 const api=(name,...args)=>page.evaluate(async([name,args])=>{
  const method=window.__C34_T24_TEST_API__?.[name];
  if(!method)throw Error("Missing T24 API "+name);
  return method(...args);
 },[name,args]);
 const choose=async(id)=>{await api("select",id);};
 const login=async label=>{
  const who=roles[label];
  const id=await api("login",who.email,who.password);
  assert.equal(id,who.id,"Real GoTrue identity "+label);
 };
 const logout=async()=>api("logout");
 const body=()=>page.locator('[data-testid="c34-t24-next-page"]').innerText();
 const has=async selector=>(await page.locator(selector).count())>0;
 const noSecrets=async()=>{
  const view=await body();
  for(const marker of [gmSecret,personal,"T24_MERCHANT_PRIVATE"])
   assert.ok(!view.includes(marker),"T24 leaked private marker "+marker);
 };
 const pdfText=async(key)=>{
  const bytes=await api("getPdfBytes");
  assert.ok(Array.isArray(bytes)&&bytes.length>1000,"Missing true PDF bytes");
  const pdf=await PDFDocument.load(Uint8Array.from(bytes));
  assert.equal(pdf.getPageCount(),3,"Must remain 3-page official PDF");
  const file=path.join(temp,key+".pdf");
  fs.writeFileSync(file,Buffer.from(bytes));
  const output=spawnSync("pdftotext",["-layout",file,"-"],
     {env,encoding:"utf8",timeout:20000});
  assert.equal(output.status,0,"T24 pdftotext: "+output.stderr);
  return output.stdout;
 };
 await choose(npcId);
 await page.locator('[data-testid="t24-unavailable"]').waitFor({state:"visible"});
 await noSecrets();
 assert.equal(await has('button:has-text("Print role-safe PDF")'),false);
 console.log("PASS C34-T24-B01: anonymous manager selection never grants profile, GM dossier or PDF");

 await login("OUTSIDER");
 await page.getByRole("heading",{name:"T24 Profile NPC"}).waitFor();
 await page.getByText("T24 APPROVED PUBLIC PROFILE").waitFor();
 assert.equal(await has('[aria-label="GM-only dossier"]'),false);
 assert.equal(await has('button:has-text("Print role-safe PDF")'),false);
 await noSecrets();
 console.log("PASS C34-T24-B02: signed outsider sees only public non-map NPC Profile");

 await logout();await login("COEDITOR");
 await page.getByRole("heading",{name:"T24 Profile NPC"}).waitFor();
 await page.locator('[data-testid="t24-rights"]').getByText(/Edit: true/).waitFor();
 await page.getByRole("button",{name:"Print role-safe PDF"}).waitFor();
 assert.equal(await has('[aria-label="GM-only dossier"]'),false);
 await page.getByRole("button",{name:"Print role-safe PDF"}).click();
 await page.locator('[data-testid="t24-pdf-status"]').getByText("public-ready").waitFor({timeout:30000});
 const publicPdf=await pdfText("coeditor-public");
 assert.ok(publicPdf.includes("T24 Profile NPC"),"current official PDF lost selected NPC identity");
 for(const marker of [gmSecret,personal,"T24_PRIVATE_SHEET_KEPT_BY_RLS","Secret: "])
  assert.ok(!publicPdf.includes(marker),"Coeditor PDF contains protected material "+marker);
 console.log("PASS C34-T24-B03: real coeditor can print true current 3-page PDF without GM Secret/private Story");

 await logout();await login("INVONLY");
 await page.getByRole("heading",{name:"T24 Profile NPC"}).waitFor();
 await page.locator('[data-testid="t24-rights"]').getByText(/Inventory: true/).waitFor();
 assert.equal(await has('button:has-text("Print role-safe PDF")'),false);
 assert.equal(await api("getPdfBytes"),null,"Previous account PDF survived signout");
 await logout();await login("CONVERT");
 await page.getByRole("heading",{name:"T24 Profile NPC"}).waitFor();
 await page.locator('[data-testid="t24-rights"]').getByText(/Convert: true/).waitFor();
 assert.equal(await has('button:has-text("Print role-safe PDF")'),false);
 await noSecrets();
 console.log("PASS C34-T24-B04: inventory-only/convert-only unable to see sensitive data or print, no stale prior-user PDF");

 await logout();await login("COEDITOR");
 await page.getByRole("button",{name:"Print role-safe PDF"}).waitFor();
 sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+q(npcId)+
     " AND user_id="+q(roles.COEDITOR.id));
 await page.getByRole("button",{name:"Refresh permissions"}).click();
 await page.getByRole("heading",{name:"T24 Profile NPC"}).waitFor();
 await page.locator('[data-testid="t24-rights"]').getByText(/Edit: false/).waitFor();
 assert.equal(await has('button:has-text("Print role-safe PDF")'),false);
 assert.equal(await has('[data-testid="t24-editor-background"]'),false);
 await noSecrets();
 console.log("PASS C34-T24-B05: real DB permission revocation + manager refresh immediately denies editor/print");

 await logout();await login("GM");
 await page.getByText(gmSecret,{exact:true}).waitFor();
 await page.getByRole("button",{name:"Print role-safe PDF"}).click();
 await page.locator('[data-testid="t24-pdf-status"]').getByText("public-ready").waitFor({timeout:30000});
 const gmPublicPdf=await pdfText("gm-public");
 assert.ok(!gmPublicPdf.includes(gmSecret),"GM public-copy PDF contained GM Secret");
 await page.getByRole("button",{name:"Print GM PDF"}).click();
 await page.locator('[data-testid="t24-pdf-status"]').getByText("gm-ready").waitFor({timeout:30000});
 const gmPrivatePdf=await pdfText("gm-private");
 assert.ok(gmPrivatePdf.includes(gmSecret),"Authorized GM PDF lost original GM Secret");
 console.log("PASS C34-T24-B06: signed GM dossier and two true 3-page PDFs; public copy private-safe, explicit GM copy includes Secret");

 await choose(merchantId);
 await page.getByRole("heading",{name:"T24 Profile Merchant"}).waitFor();
 assert.equal(await has('[data-testid="t24-merchant-profile"]'),true);
 assert.ok(!(await body()).includes(gmSecret),"Previously selected NPC secret persisted into merchant");
 await page.getByText("T24_MERCHANT_PRIVATE",{exact:true}).waitFor();
 console.log("PASS C34-T24-B07: genuine GM merchant Profile selection wipes NPC dossier; live shop not mounted");

 // Delay one real PostgREST profile RPC and switch selection before it resolves.
 // The old request must never replace newer merchant state after release.
 let releaseLate=()=>{},capture=false;
 const gate=new Promise(resolve=>{releaseLate=resolve});
 await page.route("**/rest/v1/rpc/get_npc_profile_visible_v1",async routeObj=>{
  const request=routeObj.request();
  let payload={};try{payload=request.postDataJSON()||{}}catch{}
  if(!capture&&payload.p_character_id===npcId){
   capture=true;await gate;
  }
  try{await routeObj.continue()}catch{}
 });
 await choose(npcId);
 for(let i=0;i<80&&!capture;i++)await page.waitForTimeout(100);
 assert.ok(capture,"Never intercepted delayed signed NPC Profile RPC");
 await choose(merchantId);
 await page.getByRole("heading",{name:"T24 Profile Merchant"}).waitFor();
 releaseLate();
 await page.waitForTimeout(1800);
 assert.ok(!(await body()).includes(gmSecret),"Delayed previous NPC dossier reached active merchant");
 assert.equal(await page.getByRole("heading",{name:"T24 Profile Merchant"}).count(),1);
 await page.unroute("**/rest/v1/rpc/get_npc_profile_visible_v1");
 console.log("PASS C34-T24-B08: actual delayed signed PostgREST response cannot overwrite switched merchant selection");

 await logout();
 await page.locator('[data-testid="t24-unavailable"]').waitFor({state:"visible"});
 assert.equal(await api("getPdfBytes"),null,"Private PDF persisted after signout");
 assert.ok(!(await body()).includes("T24_MERCHANT_PRIVATE"));
 await login("OUTSIDER");
 await page.getByRole("heading",{name:"T24 Profile Merchant"}).waitFor();
 assert.equal(await has('[aria-label="GM-only dossier"]'),false);
 await noSecrets();
 await logout();
 assert.deepEqual(offsite,[],"T24 attempted hosted Supabase");
 assert.deepEqual(errors,[],"T24 runtime errors: "+errors.join("; "));
 assert.ok(page.url().startsWith(origin));
 console.log("PASS C34-T24-B09: GM→outsider account change and logout clear dossier/PDF; no page exceptions/offsite requests");
 console.log("C34 T24 B01–B09 LOCAL CURRENT NEXT MANAGER CANDIDATE SIGNED PASS; existing pages/npcs.js remains UNCHANGED.");
}finally{
 if(browser)await browser.close().catch(()=>{});
 if(server?.pid){try{process.kill(-server.pid,"SIGTERM")}catch{server.kill("SIGTERM")}}
 try{fs.unlinkSync(probe)}catch{}
 fs.rmSync(temp,{recursive:true,force:true});
 assert.ok(!fs.existsSync(probe),"T24 scratch route cleanup must succeed");
}
