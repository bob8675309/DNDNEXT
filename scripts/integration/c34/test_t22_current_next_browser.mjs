#!/usr/bin/env node
// test_t22_current_next_browser.mjs
// C34 T22: REAL CURRENT-HEAD NEXT.JS PAGES ROUTER + Chromium + LOCAL signed
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

const env=process.env;
for(const [name,value] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
 PGPORT:"54322",PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 C34_T22_BROWSER_CONFIRM:"CURRENT_NEXT_DISPOSABLE_LOCAL_ONLY"
})) assert.equal(env[name],value,"Unsafe T22 environment "+name);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.ok(env.C33_BROWSER_TOOL_ROOT&&path.isAbsolute(env.C33_BROWSER_TOOL_ROOT));
assert.ok(env.C33_BROWSER_CHROME&&path.isAbsolute(env.C33_BROWSER_CHROME));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const probe=path.join(root,"pages/__c34_t22_probe.jsx");
const sourcePage=path.join(root,"scripts/integration/c34/fixtures/t22_nonmap_next_probe_page.jsx");
assert.ok(fs.existsSync(sourcePage)&&!fs.existsSync(probe),
 "T22 refuses existing/production route overwrite");
const require=createRequire(path.join(env.C33_BROWSER_TOOL_ROOT,"t22-playwright-anchor.cjs"));
const {chromium}=require("playwright-core");
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const sql=query=>{
 const out=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",query],
  {env,encoding:"utf8",timeout:25000});
 assert.equal(out.status,0,"T22 local-only SQL: "+out.stderr?.slice(-750));
 return out.stdout.trim();
};
const q=id=>{assert.match(id,/^[0-9a-f-]{36}$/i);return "'"+id+"'";};
async function createRole(label){
 const who=client(),email="c34-t22-"+label+"-"+randomUUID()+"@example.invalid";
 const password="T22-"+randomUUID()+"!";
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
 return {name:"T22 signed source creator",creation_request_id:randomUUID(),secret:null,
  sheet:{classKey:"fighter",level:1,marker:"T22_CANONICAL_SHEET",
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
  name,kind,creation_request_id:randomUUID(),description:"T22 APPROVED PUBLIC PROFILE",
  background:"T22 APPROVED PUBLIC BACKGROUND",
  motivation:"T22 UNREVEALED MOTIVATION",secret,
  sheet:{classKey:"fighter",level:1,marker:"T22_GM_CANONICAL_SHEET",
   profileReveal:{background:true,secret:true},
   gmNotes:"T22_PRIVATE_SHEET_KEPT_BY_RLS"}
 }});
 assert.ifError(out.error);assert.match(out.data,/^[a-f0-9-]{36}$/i);
 sql("UPDATE public.characters SET is_hidden=false WHERE id="+q(out.data));
 return out.data;
}
const roles={};
for(const name of ["CREATOR","COEDITOR","INVONLY","CONVERT","GM","OUTSIDER"])
 roles[name]=await createRole(name.toLowerCase());
sql("INSERT INTO private.test_admins(id) VALUES("+q(roles.GM.id)+")");
const personal="T22_ORIGINAL_CREATOR_PRIVATE_STORY";
const creator=await roles.CREATOR.who.rpc("create_player_character_with_private_backstory_v1",{
 p_payload:fighterPayload(),p_spell_choices:[],p_magic_selections:[],
 p_private_backstory:personal
});
assert.ifError(creator.error);const creatorId=creator.data;
const gmSecret="T22_GM_DOSSIER_NEVER_PUBLIC";
const npcId=await createGmCharacter(roles.GM,"npc","T22 Profile NPC",gmSecret);
const merchantId=await createGmCharacter(roles.GM,"merchant",
 "T22 Profile Merchant","T22_MERCHANT_PRIVATE");
for(const cid of [creatorId,npcId]){
 sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) VALUES("+
 q(cid)+","+q(roles.COEDITOR.id)+",true,false,false),("+
 q(cid)+","+q(roles.INVONLY.id)+",false,true,false),("+
 q(cid)+","+q(roles.CONVERT.id)+",false,false,true)");
}
console.log("PASS C34-T22-SEED: actual signed creator private Story, GM NPC/merchant and separate coeditor/inventory/convert/outsider rights on T21 local DB");

let server=null,browser=null,serverLogs="";
fs.copyFileSync(sourcePage,probe);
try{
 assert.match(fs.readFileSync(probe,"utf8"),/NonMapNpcProfileResearchShell/,
  "T22 temporary route must import the actual current-head candidate component");
 const nextPort=await port(),origin="http://127.0.0.1:"+nextPort;
 const nextBin=path.join(root,"node_modules/next/dist/bin/next");
 assert.ok(fs.existsSync(nextBin),"npm ci required before T22 Next browser");
 server=spawn(process.execPath,[nextBin,"dev","-H","127.0.0.1","-p",String(nextPort)],{
  cwd:root,env:{...env,NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
   NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1"},
  detached:true,stdio:["ignore","pipe","pipe"]
 });
 for(const channel of [server.stdout,server.stderr])
  channel.on("data",b=>{serverLogs=(serverLogs+b.toString()).slice(-10000)});
 const route=origin+"/__c34_t22_probe";
 let ready=false;
 for(let attempt=0;attempt<110;attempt++){
  if(server.exitCode!==null)throw Error("T22 Next dev died: "+serverLogs);
  try{
   const response=await fetch(route,{signal:AbortSignal.timeout(2800)});
   if(response.ok&&(await response.text()).includes("c34-t22-next-page")){
    ready=true;break;
   }
  }catch(_err){}
  await new Promise(resolve=>setTimeout(resolve,1400));
 }
 assert.ok(ready,"T22 current-Next source Pages Router did not compile: "+serverLogs);
 console.log("PASS C34-T22-NEXT: current #379 Next 16 Pages Router compiled disposable untracked Profile test route; original _app unchanged");

 browser=await chromium.launch({executablePath:env.C33_BROWSER_CHROME,
  headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const ctx=await browser.newContext({viewport:{width:1280,height:900}});
 const page=await ctx.newPage(),offsite=[],errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",async r=>{
  const url=r.request().url();
  if(url.startsWith(origin)||url.startsWith(env.DNDNEXT_C34_LOCAL_URL)||
      url.startsWith("ws://127.0.0.1:"+nextPort))return r.continue();
  // External Bootstrap CDN/Next telemetry are intentionally blocked.
  // Any unexpected hosted Supabase URL is a prohibited regression.
  if(/supabase\.co|supabase\.in|service_role/i.test(url))
   offsite.push(url.slice(0,130));
  await r.abort();
 });
 await page.goto(route,{waitUntil:"domcontentloaded",timeout:30000});
 await page.waitForFunction(()=>!!window.__C34_T22_TEST_API__,null,{timeout:30000});
 // The app normally loads Bootstrap via CDN. CI injects lockfile-installed
 // local Bootstrap so no remote stylesheet access is necessary.
 await page.addStyleTag({path:path.join(root,"node_modules/bootstrap/dist/css/bootstrap.min.css")});
 const api=(name,...args)=>page.evaluate(async([name,args])=>{
  const fn=window.__C34_T22_TEST_API__?.[name];if(!fn)throw Error("Missing test UI API "+name);
  return fn(...args);
 },[name,args]);
 const choose=async cid=>{await api("select",cid);
  await page.locator('[data-testid="c34-t22-nonmap"]').waitFor({state:"visible",timeout:18000});};
 const login=async label=>{
  const who=roles[label];
  const id=await api("login",who.email,who.password);
  assert.equal(id,who.id,"T22 real browser signed identity "+label);
 };
 const logout=async()=>{await api("logout");};
 const has=async selector=>(await page.locator(selector).count())>0;
 const secretAbsent=async()=>{
  const body=await page.locator('[data-testid="c34-t22-next-page"]').innerText();
  assert.ok(!body.includes(gmSecret),"T22 exposed GM secret to non-GM");
  assert.ok(!body.includes(personal),"T22 exposed creator Story to non-author");
 };
 await choose(npcId);
 await page.getByText("Profile unavailable to this session.").waitFor();
 await secretAbsent();
 console.log("PASS C34-T22-B01: anonymous browser Profile fails closed, no private Story/GM secret");

 await login("OUTSIDER");
 await page.getByRole("heading",{name:"T22 Profile NPC"}).waitFor();
 await page.getByText("T22 APPROVED PUBLIC PROFILE").waitFor();
 await page.getByText("T22 APPROVED PUBLIC BACKGROUND").waitFor();
 assert.equal(await has('[aria-label="GM-only dossier"]'),false);
 assert.equal(await has('[aria-label="Authorized character sheet"]'),false);
 await secretAbsent();
 console.log("PASS C34-T22-B02: real outsider gets allowlisted public Profile/revealed background; legacy reveal.secret suppressed");

 await logout();await login("COEDITOR");
 await page.getByRole("button",{name:"Print authorized Sheet"}).waitFor();
 assert.equal(await has('[aria-label="GM-only dossier"]'),false);
 await page.getByRole("button",{name:"Print authorized Sheet"}).click();
 await page.locator('[data-testid="c34-t22-print-receipt"]').waitFor();
 assert.match(await page.locator('[data-testid="c34-t22-print-receipt"]').innerText(),
  /T22_GM_CANONICAL_SHEET/);
 await secretAbsent();
 console.log("PASS C34-T22-B03: real coeditor current-Next UI exposes authorized Sheet/Print callback, not GM dossier");

 await logout();await login("INVONLY");
 await page.getByRole("heading",{name:"T22 Profile NPC"}).waitFor();
 assert.equal(await has('[aria-label="Authorized character sheet"]'),false);
 assert.equal(await has('[aria-label="GM-only dossier"]'),false);
 await secretAbsent();
 await logout();await login("CONVERT");
 await page.getByRole("heading",{name:"T22 Profile NPC"}).waitFor();
 assert.equal(await has('[aria-label="Authorized character sheet"]'),false);
 await secretAbsent();
 console.log("PASS C34-T22-B04: inventory-only and convert-only users cannot print, inspect GM or private Story");

 await logout();await login("CREATOR");await choose(creatorId);
 const editor=page.locator('section[aria-label="Private character backstory"]');
 await editor.waitFor({state:"visible",timeout:16000});
 await page.waitForFunction(value=>
  document.querySelector('section[aria-label="Private character backstory"] textarea')?.value===value,
  personal,{timeout:16000});
 const edited="T22_CREATOR_EDITED_PRIVATE_STORY";
 await editor.locator("textarea").fill(edited);
 await editor.getByRole("button",{name:"Save private backstory"}).click();
 // A successful source-original RLS write + fresh UI read is required.
 for(let n=0;n<30;n++){
  if(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id="+q(creatorId))===edited)break;
  await page.waitForTimeout(200);
 }
 assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id="+q(creatorId)),edited);
 assert.equal(sql("SELECT secret IS NULL FROM public.characters WHERE id="+q(creatorId)),"t");
 console.log("PASS C34-T22-B05: current Next signed creator private Story edit writes original RLS table, not GM Secret");

 await logout();
 await editor.waitFor({state:"detached",timeout:10000});
 assert.ok(!(await page.locator('[data-testid="c34-t22-next-page"]').innerText()).includes(edited),
 "Private Story survived sign-out");
 await login("COEDITOR");
 await page.getByRole("heading",{name:"T22 signed source creator"}).waitFor();
 assert.equal(await has('[aria-label="Private character backstory"]'),false);
 await page.getByRole("button",{name:"Print authorized Sheet"}).waitFor();
 console.log("PASS C34-T22-B06: logout synchronously removes private UI; coeditor keeps Sheet but cannot read author's Story");

 await logout();await login("GM");await choose(npcId);
 await page.getByText(gmSecret,{exact:true}).waitFor();
 await choose(creatorId);
 await editor.waitFor({state:"visible",timeout:15000});
 await page.waitForFunction(value=>
   document.querySelector('section[aria-label="Private character backstory"] textarea')?.value===value,
   edited,{timeout:15000});
 assert.ok(!(await page.locator('[data-testid="c34-t22-next-page"]').innerText()).includes(gmSecret),
  "T22 previous NPC GM dossier persisted across selection");
 console.log("PASS C34-T22-B07: signed GM independently reads dossier and creator Story; character selection clears previous GM content");

 await choose(merchantId);
 await page.getByRole("heading",{name:"T22 Profile Merchant"}).waitFor();
 await page.getByRole("button",{name:"Let me browse your wares."}).click();
 await page.getByRole("heading",{name:/Merchant storefront/}).waitFor();
 await page.getByRole("button",{name:"Return to Profile"}).click();
 await page.getByRole("heading",{name:"T22 Profile Merchant"}).waitFor();
 assert.equal(await has('[aria-label="GM-only dossier"]'),true);
 console.log("PASS C34-T22-B08: current-Next research merchant Profile → local Shop handoff → Profile; real live storefront deliberately NOT mounted");

 await logout();await page.getByText("Profile unavailable to this session.").waitFor();
 assert.ok(!(await page.locator('[data-testid="c34-t22-next-page"]').innerText()).includes("T22_MERCHANT_PRIVATE"));
 assert.deepEqual(offsite,[],"T22 browser attempted hosted Supabase");
 assert.deepEqual(errors,[],"T22 current Next page emitted JS exceptions: "+errors.join("; "));
 assert.ok(page.url().startsWith(origin));
 console.log("PASS C34-T22-B09: role/logout cleanup, browser errors and all offsite Supabase requests checked; no map route reached");
 console.log("C34 T22 CURRENT-HEAD REAL NEXT.JS LOCAL CHROMIUM + SIGNED PRIVACY UI PASS; no active route, deployment or shop integration.");
}finally{
 if(browser)await browser.close().catch(()=>{});
 if(server?.pid){try{process.kill(-server.pid,"SIGTERM")}catch{server.kill("SIGTERM")}}
 try{fs.unlinkSync(probe)}catch{}
 assert.ok(!fs.existsSync(probe),"T22 scratch route cleanup must succeed");
}
