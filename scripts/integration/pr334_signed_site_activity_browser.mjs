#!/usr/bin/env node
// Genuine signed Chromium+Next Pages Router research, mounted only as disposable
// pages/admin/__pr334_site_activity_research.jsx, deleted in finally.
// Reuses already-authenticated local PG17/GoTrue data in the owning test runner.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import net from "node:net";
import {derivePr334SiteActivityProbe,PR334_TEMP_PAGE,PR334_ORIGINAL_PAGE_SHA}
 from "./pr334_derive_site_activity_probe.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function unusedPort(){return new Promise((resolve,reject)=>{
 const server=net.createServer();
 server.once("error",reject);
 server.listen(0,"127.0.0.1",()=>{
  const port=server.address().port;server.close(()=>resolve(port));
 });
});}
export async function verifyPr334SiteBrowser({users,password,db}){
 const env=process.env;
 for(const [k,v] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  DNDNEXT_PR334_ROLE_LOCAL_CONFIRM:"PR334_DISPOSABLE_GOTRUE_ONLY",
  PR334_SITE_BROWSER_CONFIRM:"TEMP_SOURCE_DERIVED_NEXT_CHROMIUM_ONLY"}))
  assert.equal(env[k],v,"Unsafe PR334 real browser environment "+k);
 assert.equal(env.DNDNEXT_PR334_ROLE_LOCAL_URL,"http://127.0.0.1:54321");
 assert.ok(path.isAbsolute(env.PR334_BROWSER_TOOL_ROOT||""));
 assert.ok(path.isAbsolute(env.PR334_BROWSER_CHROME||""));
 const createRequireFromBrowser=createRequire(path.join(env.PR334_BROWSER_TOOL_ROOT,"pr334-browser-require.cjs"));
 const {chromium}=createRequireFromBrowser("playwright-core");
 const original=path.join(root,"pages/admin/activity.js");
 const probe=path.join(root,PR334_TEMP_PAGE);
 const derived=derivePr334SiteActivityProbe();
 assert.ok(!fs.existsSync(probe),"Refuse to overwrite existing or real page route");
 const stat=fs.statSync(original);assert.ok(stat.isFile());
 assert.ok(!derived.includes("supabase.rpc(\"is_admin\")"));
 let server=null,browser=null,logs="";
 try{
  fs.writeFileSync(probe,derived,{flag:"wx"});
  const port=await unusedPort(),origin="http://127.0.0.1:"+port;
  const route=origin+"/admin/__pr334_site_activity_research";
  const nextBin=path.join(root,"node_modules/next/dist/bin/next");
  assert.ok(fs.existsSync(nextBin),"Missing npm ci current Next installation");
  server=spawn(process.execPath,[nextBin,"dev","-H","127.0.0.1","-p",String(port)],{
   cwd:root,detached:true,stdio:["ignore","pipe","pipe"],
   env:{...env,NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_PR334_ROLE_LOCAL_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_PR334_ROLE_LOCAL_ANON_KEY,
    NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1"}
  });
  for(const stream of [server.stdout,server.stderr])
   stream.on("data",b=>{logs=(logs+b.toString()).slice(-16000);});
  let ready=false;
  for(let i=0;i<100;i++){
   if(server.exitCode!==null)throw Error("Next exited during probe: "+logs);
   try{
    const response=await fetch(route,{signal:AbortSignal.timeout(2200)});
    if(response.ok&&(await response.text()).includes("Recent site activity")){ready=true;break;}
   }catch(_){}
   await pause(1200);
  }
  assert.ok(ready,"Actual original-derived Next.js page failed compilation: "+logs);
  console.log("PASS PR334-SITE-REAL-NEXT: exact original page SHA "+PR334_ORIGINAL_PAGE_SHA+", disposable only");

  browser=await chromium.launch({executablePath:env.PR334_BROWSER_CHROME,
    headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  const ctx=await browser.newContext({viewport:{width:1320,height:900}});
  const page=await ctx.newPage(),errors=[],offsite=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",async routeObj=>{
   const url=routeObj.request().url();
   if(url.startsWith(origin)||url.startsWith(env.DNDNEXT_PR334_ROLE_LOCAL_URL)||
      url.startsWith("ws://127.0.0.1:"+port))return routeObj.continue();
   if(/supabase\.co|supabase\.in|service_role/i.test(url))offsite.push(url.slice(0,140));
   return routeObj.abort();
  });
  await page.goto(route,{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForFunction(()=>Boolean(window.__PR334_SITE_TEST__),null,{timeout:30000});
  const api=(name,...args)=>page.evaluate(async([name,args])=>{
   const fn=window.__PR334_SITE_TEST__?.[name];
   if(!fn)throw Error("Missing site research API "+name);
   return fn(...args);
  },[name,args]);
  const denied=async(label)=>{
   await page.getByText("Application Game Master access is required to view site activity.").waitFor({timeout:23000});
   const body=await page.locator("body").innerText();
   assert.ok(!body.includes("Local Test Player"),label+" leaked previous actor's private row");
   assert.ok(!body.includes("/character"),label+" leaked previous account visited path");
  };
  const allowed=async(label)=>{
   await page.getByRole("heading",{name:"Recent site activity"}).waitFor({timeout:30000});
   await page.getByText("Local Test Player").waitFor({timeout:23000});
   assert.ok((await page.getByText("Anonymous visitor",{exact:false}).count())>=1,label+" anonymous row lost");
   const body=await page.locator("body").innerText();
   assert.ok(body.includes("/landing")&&body.includes("/character"),label+" original visitor path missing");
   assert.ok(!body.includes("service_role"),"Browser exposed internal service role");
   const raw=await api("rawVisit");
   assert.ok(raw.error||raw.data?.length===0,label+" raw site visitor table exposed");
   assert.ok((await page.getByRole("button",{name:"Refresh"}).count())===1);
  };
  // Real user email in test runner can differ; always use the exact synthetic
  // GoTrue address supplied by caller instead of guessing identity.
  const enter=async label=>{
   const u=users[label];
   assert.ok(u?.email&&u?.uid,label+" unsigned fixture");
   assert.equal(await api("login",u.email,password),u.uid);
  };
  await denied("anon initial");
  assert.ok(!await api("currentUser"),"Browser must start signed out");
  console.log("PASS PR334-SITE-BROWSER-ANON: original page derived route denies unsigned visitor");
  await enter("admin");await allowed("admin");
  await page.getByRole("button",{name:"Refresh"}).click();await allowed("admin refresh");
  console.log("PASS PR334-SITE-BROWSER-ADMIN: signed original table + Refresh and raw-table denial");
  await enter("gm");await allowed("gm switched without reload");
  console.log("PASS PR334-SITE-BROWSER-GM: direct same-page Admin->GM switch, owner permissions preserved");
  await enter("dm");await allowed("dm");
  console.log("PASS PR334-SITE-BROWSER-DM: signed DM original report visible");

  // Start a delayed original report Refresh; switch identity before response
  // arrives. The old response must never repopulate private DOM under player.
  let delayNext=true;
  await page.route("**/rest/v1/rpc/p13_research_get_recent_site_activity_v1",async r=>{
   if(delayNext){delayNext=false;await pause(1600);}
   await r.continue();
  });
  await page.getByRole("button",{name:"Refresh"}).click();
  await pause(110);
  await enter("player");
  await denied("player switched during pending DM report");
  await pause(1900);
  await denied("late DM response after switch");
  console.log("PASS PR334-SITE-BROWSER-LATE: previous actor's in-flight report never repopulates denied player DOM");
  await page.unroute("**/rest/v1/rpc/p13_research_get_recent_site_activity_v1");

  for(const label of ["unknown","creator","editor","inventory"]){
   await enter(label);await denied(label);
   assert.ok((await api("rawVisit")).error,"Raw site table unexpectedly readable by "+label);
  }
  console.log("PASS PR334-SITE-BROWSER-DENY: player/unknown/creator/editor/inventory fail closed");

  await enter("gm");await allowed("gm for logout");
  await api("logout");await denied("same page logout");
  assert.equal(await api("currentUser"),null);
  console.log("PASS PR334-SITE-BROWSER-LOGOUT: private rows cleared after signout");

  await enter("dm");await allowed("dm for demotion");
  db("UPDATE public.user_profiles SET role='player' WHERE id='"+users.dm.uid+"'");
  await page.getByRole("button",{name:"Refresh"}).click();
  await denied("same signed DM JWT demoted");
  console.log("PASS PR334-SITE-BROWSER-REVOKE: server role change denies Refresh on same JWT, private rows cleared");
  assert.deepEqual(offsite,[],"Hosted external Supabase access attempted");
  assert.deepEqual(errors,[],"Real Next browser React errors");
  console.log("PASS PR334-SITE-BROWSER-SIGNED: no hosted requests, no page errors, no production route");
 }finally{
  if(browser)await browser.close();
  if(server){
   try{process.kill(-server.pid,"SIGTERM");}catch(_){}
   server.kill("SIGTERM");
  }
  if(fs.existsSync(probe))fs.unlinkSync(probe);
  assert.ok(!fs.existsSync(probe),"Failed to delete CI-only site activity page");
  assert.ok(fs.existsSync(original),"Original site activity route lost");
 }
}
