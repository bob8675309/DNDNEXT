#!/usr/bin/env node
// C3B: real original CreatorBackstoryPanel (not a stand-in) and genuine
// disposable browser GoTrue sessions, permissions and PostgREST writes.
// Boundary: this is NOT the full NewNpcModalV3 ten-step form/browser creation.
// C3J/C3S source-original v3 RPC + atomic private story already execute in the
// same ephemeral PG17 before this React component acceptance.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const env=process.env;
for(const [key,value] of Object.entries({
 GITHUB_ACTIONS:"true",CI:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGDATABASE:"postgres",DNDNEXT_C33_FORGE_PRIVACY_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_ONLY"
})) assert.equal(env[key],value,"C3B refuses nonlocal execution: "+key);
assert.match(env.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(env.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_ANON_KEY);
const toolsRoot=env.C33_BROWSER_TOOL_ROOT,chrome=env.C33_BROWSER_CHROME;
assert.ok(toolsRoot&&path.isAbsolute(toolsRoot), "Disposable pinned browser tool directory required");
assert.ok(chrome&&path.isAbsolute(chrome), "Local Chromium executable required");
const required=createRequire(path.join(toolsRoot,"c33-playwright-anchor.cjs"));
const {chromium}=required("playwright-core");
const portOrigin=env.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_URL.replace(/\/$/,"");
const password="C33-browser-"+randomUUID()+"!";
const client=()=>createClient(portOrigin,env.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const sql=(query)=>{
 const cmd=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",query],{
  env:{...env,PGUSER:"postgres"},encoding:"utf8",timeout:20000
 });
 assert.equal(cmd.status,0,"Disposable-only SQL failure: "+cmd.stderr);
 return cmd.stdout.trim();
};
const roles={};
for(const role of ["CREATOR","COEDITOR","INV_ONLY","GM","OUTSIDER"]){
 const who=client(),email="c33-browser-"+randomUUID()+"@example.invalid";
 const signed=await who.auth.signUp({email,password});
 assert.ifError(signed.error);
 const login=await who.auth.signInWithPassword({email,password});
 assert.ifError(login.error);
 const u=await who.auth.getUser();
 assert.ifError(u.error);
 roles[role]={email,who,id:u.data.user.id};
}
sql("INSERT INTO private.test_admins(id) VALUES ('"+roles.GM.id+"')");
const payload={name:"C3B Browser Original Forge private story",creation_request_id:randomUUID(),
 secret:null,sheet:{classKey:"fighter",level:1,marker:"C33_BROWSER_COMPONENT"}};
const initialSecret="C3B authored Story text, never a GM secret";
const created=await roles.CREATOR.who.rpc("create_player_character_with_private_backstory_v1",{
 p_payload:payload,p_spell_choices:[],p_magic_selections:[],
 p_private_backstory:initialSecret
});
assert.ifError(created.error);
const charId=created.data;
assert.match(charId,/^[a-f0-9-]{36}$/i);
sql("INSERT INTO public.character_permissions (character_id,user_id,can_edit,can_inventory,can_convert) VALUES "+
 "('"+charId+"','"+roles.COEDITOR.id+"',true,true,false),"+
 "('"+charId+"','"+roles.INV_ONLY.id+"',false,true,false)");
assert.equal(sql("SELECT secret IS NULL FROM public.characters WHERE id='"+charId+"'"),"t");
assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id='"+charId+"'"),initialSecret);
console.log("PASS C3B00: original signed Forge v3 RPC creates private story; real co-editor/inventory/GM users seeded, GM secret remains NULL");

const dir=mkdtempSync(path.join(tmpdir(),"dndnext-c33-browser-")),bundle=path.join(dir,"bundle.js");
const bundler=path.join(toolsRoot,"node_modules",".bin","esbuild");
let server=null,browser=null;
try{
 execFileSync(bundler,[
  path.resolve("scripts/browser/c33_creator_backstory_dom.jsx"),
  "--bundle","--platform=browser","--format=iife","--jsx=automatic",
  "--loader:.js=jsx","--target=chrome120","--log-level=error",
  "--define:process.env.NEXT_PUBLIC_SUPABASE_URL="+JSON.stringify(portOrigin),
  "--define:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="+JSON.stringify(env.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_ANON_KEY),
  "--outfile="+bundle
 ],{timeout:90000,stdio:"pipe"});
 const js=readFileSync(bundle);
 server=createServer((req,res)=>{
  if(req.url==="/"){
   res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
   res.end('<!doctype html><html lang="en"><meta charset="utf-8"><title>C3.3 Creator Story Browser</title><body><div id="c33-browser-root"></div><script>window.__C33_CHARACTER_ID__='+JSON.stringify(charId)+'</script><script src="/bundle.js"></script></body></html>');
  }else if(req.url==="/bundle.js"){
   res.writeHead(200,{"Content-Type":"application/javascript","Cache-Control":"no-store"});res.end(js);
  }else{res.writeHead(404,{"Content-Type":"text/plain"});res.end("Not found")}
 });
 await new Promise(done=>server.listen(0,"127.0.0.1",done));
 const base="http://127.0.0.1:"+server.address().port;
 browser=await chromium.launch({executablePath:chrome,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:1280,height:920}});
 const page=await context.newPage(),pageErrors=[],offsite=[];
 page.on("pageerror",e=>pageErrors.push(e.message));
 await page.route("**/*",async route=>{
   const origin=new URL(route.request().url()).origin;
   if(origin===base||origin===portOrigin)await route.continue();
   else {offsite.push(origin);await route.abort();}
 });
 await page.goto(base,{waitUntil:"load"});
 await page.waitForFunction(()=>window.__C33_BROWSER_READY__===true);
 const privatePanel=page.locator('section[aria-label="Private character backstory"]');
 const signIn=async role=>{
   const data=roles[role];
   const userId=await page.evaluate(async info=>window.__C33_AUTH_LOGIN__(info.email,info.password),{
     email:data.email,password
   });
   assert.equal(userId,data.id,role+" real browser GoTrue identity mismatch");
 };
 const signOut=async()=>page.evaluate(()=>window.__C33_AUTH_LOGOUT__());
 const waitText=async value=>{
   await privatePanel.waitFor({state:"visible",timeout:15000});
   await page.waitForFunction(text=>{
     const node=document.querySelector('section[aria-label="Private character backstory"] textarea');
     return node?.value===text;
   },value,{timeout:15000});
 };

 // Anonymous visitors cannot even render a private editor.
 await page.waitForTimeout(350);
 assert.equal(await privatePanel.count(),0);
 console.log("PASS C3B01: anonymous original creator-panel UI has no private editor");

 await signIn("CREATOR");
 await waitText(initialSecret);
 assert.match(await privatePanel.innerText(),/Only the original creator/);
 const edited="C3B signed Chromium creator edited backstory";
 await privatePanel.locator("textarea").fill(edited);
 await privatePanel.getByRole("button",{name:"Save private backstory"}).click();
 await privatePanel.getByText("Saved",{exact:true}).waitFor();
 assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id='"+charId+"'"),edited);
 assert.equal(sql("SELECT secret IS NULL FROM public.characters WHERE id='"+charId+"'"),"t");
 console.log("PASS C3B02: signed creator edits ORIGINAL React panel via Chromium, real RLS upsert, no GM-secret write");

 await signOut();await signIn("COEDITOR");await page.waitForTimeout(400);
 assert.equal(await privatePanel.count(),0,"Co-editor must not see creator-only UI");
 const denied=await roles.COEDITOR.who.from("character_backstory_secrets").select("secret_text").eq("character_id",charId);
 assert.ifError(denied.error);assert.deepEqual(denied.data,[]);
 console.log("PASS C3B03: genuine can_edit co-editor denied original private-story panel and direct RLS row");

 await signOut();await signIn("INV_ONLY");await page.waitForTimeout(400);
 assert.equal(await privatePanel.count(),0);
 console.log("PASS C3B04: real inventory-only actor has no creator-private editor");

 await signOut();await signIn("GM");
 await waitText(edited);
 const gmUpdated="C3B GM independently updated original creator note";
 await privatePanel.locator("textarea").fill(gmUpdated);
 await privatePanel.getByRole("button",{name:"Save private backstory"}).click();
 await privatePanel.getByText("Saved",{exact:true}).waitFor();
 assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id='"+charId+"'"),gmUpdated);
 console.log("PASS C3B05: authenticated campaign GM can inspect/change creator text without changing GM Secrets");

 await signOut();await signIn("CREATOR");await waitText(gmUpdated);
 await page.evaluate(()=>window.__C33_CHANGE_CHARACTER__("00000000-0000-0000-0000-000000000001"));
 await page.waitForTimeout(400);
 assert.equal(await privatePanel.count(),0,"Character switch must clear previous private-backstory panel");
 console.log("PASS C3B06: creator sees authorized GM update and selection switch removes sensitive UI");

 await signOut();await signIn("OUTSIDER");await page.waitForTimeout(400);
 assert.equal(await privatePanel.count(),0);
 assert.deepEqual(pageErrors,[],"Original CreatorBackstoryPanel emitted browser errors");
 assert.deepEqual(offsite,[],"C3B browser attempted off-site request");
 console.log("PASS C3B07: signed outsider denied, no page errors or offsite network requests");
 console.log("C3.3 REAL CHROMIUM CREATOR-BACKSTORY AUTH UI PASS (C3B00–C3B07). Original React component; genuine GoTrue, private RLS and Admin. Not a full NewNpcModalV3 form browser test.");
}finally{
 if(browser)await browser.close();
 if(server)await new Promise(resolve=>server.close(resolve));
 rmSync(dir,{recursive:true,force:true});
}
