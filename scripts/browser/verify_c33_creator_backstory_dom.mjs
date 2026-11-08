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
 secret:null,sheet:{classKey:"fighter",level:1,marker:"C33_BROWSER_COMPONENT",
 startingEquipmentSelections:{mode:"package",classOption:"A",ruleset:"vanilla"}}};
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
 
// C3P: source-original GM NPC with a deliberately revealed public background,
// an obsolete 'reveal secret' bit (which MUST NOT disclose GM Secrets), and a
// sheet that should never be returned to inventory-only/outsider users.
const gmOnly="C3P_GM_SECRET_NEVER_IN_PLAYER_PROFILE";
const gmSheetNote="C3P_PRIVATE_SHEET_NOT_FOR_OUTSIDERS";
const npcCreate=await roles.GM.who.rpc("create_character_v1",{p_payload:{
 name:"C3P source NPC",kind:"npc",creation_request_id:randomUUID(),
 description:"C3P_APPROVED_PUBLIC_DESCRIPTION",
 background:"C3P_APPROVED_PUBLIC_BACKGROUND",
 motivation:"C3P_GM_ONLY_MOTIVATION",
 secret:gmOnly,
 sheet:{classKey:"fighter",level:1,marker:"C3P_PROFILE_SHEET",
  profileReveal:{background:true,secret:true},gmNotes:gmSheetNote}
}});
assert.ifError(npcCreate.error);
const profileId=npcCreate.data;
assert.match(profileId,/^[a-f0-9-]{36}$/i);
sql("UPDATE public.characters SET is_hidden=false WHERE id='"+profileId+"'");
sql("INSERT INTO public.character_permissions (character_id,user_id,can_edit,can_inventory,can_convert) VALUES "+
 "('"+profileId+"','"+roles.COEDITOR.id+"',true,true,false),"+
 "('"+profileId+"','"+roles.INV_ONLY.id+"',false,true,false)");
assert.equal(sql("SELECT secret FROM public.characters WHERE id='"+profileId+"'"),gmOnly);
console.log("PASS C3P00: original GM NPC, genuine role permissions and adversarial legacy secret reveal seeded in disposable DB");


const dir=mkdtempSync(path.join(tmpdir(),"dndnext-c33-browser-")),bundle=path.join(dir,"bundle.js");
const bundler=path.join(toolsRoot,"node_modules",".bin","esbuild");
let server=null,browser=null;
try{
 execFileSync(bundler,[
  path.resolve("scripts/browser/c33_creator_backstory_dom.jsx"),
  "--bundle","--platform=browser","--format=iife","--jsx=automatic",
  "--loader:.js=jsx","--target=chrome120","--log-level=error",
  // esbuild is not the Next server bundler; swap ONLY framework machinery.
  "--alias:next/router="+path.resolve("scripts/browser/c33_next_router_shim.js"),
  "--alias:next/dynamic="+path.resolve("scripts/browser/c33_next_dynamic_shim.js"),
  "--define:process.env.NEXT_PUBLIC_SUPABASE_URL="+JSON.stringify(portOrigin),
  "--define:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="+JSON.stringify(env.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_ANON_KEY),
  "--outfile="+bundle
 ],{timeout:90000,stdio:"pipe"});
 const js=readFileSync(bundle);
 server=createServer((req,res)=>{
  if(req.url==="/"){
   res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
   res.end('<!doctype html><html lang="en"><meta charset="utf-8"><title>C3.3 Creator Story Browser</title><body><div id="c33-browser-root"></div><script>window.__C33_CHARACTER_ID__='+JSON.stringify(charId)+';window.__C33_PROFILE_ID__='+JSON.stringify(profileId)+'</script><script src="/bundle.js"></script></body></html>');
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

 // C3P original NPC Profile is mounted, not an HTML stand-in. The localhost
 // source/RLS data plane and signed role checks are unchanged from C3B.
 await page.evaluate(()=>window.__C33_OPEN_NPC_PROFILE__());
 const panel=page.locator(".npc-panel-inner");
 await panel.waitFor({state:"visible",timeout:15000});
 await panel.getByText("C3P_APPROVED_PUBLIC_DESCRIPTION",{exact:true}).waitFor({timeout:15000});
 const outsiderText=await panel.innerText();
 assert(outsiderText.includes("C3P_APPROVED_PUBLIC_BACKGROUND"),"Public reveal absent from NPC Profile");
 for(const marker of [gmOnly,gmSheetNote,"C3P_GM_ONLY_MOTIVATION"]){
   assert(!outsiderText.includes(marker),"Outsider NPC Profile leaked "+marker);
 }
 assert.match(outsiderText,/Known Lore/);
 assert.equal(await panel.getByRole("button",{name:"Print Sheet"}).count(),0);
 console.log("PASS C3P01: original outsider NPC Profile renders approved public lore; old reveal.secret bit does not expose GM secret or raw sheet");

 await panel.getByRole("button",{name:"Sheet & Rolls"}).click();
 await panel.getByText("No character sheet has been created for this character yet.").waitFor({timeout:15000});
 assert.equal(await panel.getByRole("button",{name:"Print Sheet"}).count(),0);
 const outsiderSheet=await roles.OUTSIDER.who.from("character_sheets")
   .select("sheet").eq("character_id",profileId);
 assert.ifError(outsiderSheet.error);
 assert.deepEqual(outsiderSheet.data,[],"Outsider raw JSON sheet forbidden");
 console.log("PASS C3P02: real outsider Sheet/Print path fails closed under stage1 full-sheet RLS");

 await signOut();await signIn("INV_ONLY");
 await panel.getByText("C3P_APPROVED_PUBLIC_DESCRIPTION",{exact:true}).waitFor({timeout:15000});
 await panel.getByRole("button",{name:"Sheet & Rolls"}).click();
 await panel.getByText("No character sheet has been created for this character yet.").waitFor({timeout:15000});
 assert.equal(await panel.getByRole("button",{name:"Print Sheet"}).count(),0);
 assert.deepEqual((await roles.INV_ONLY.who.from("character_sheets")
   .select("sheet").eq("character_id",profileId)).data,[]);
 console.log("PASS C3P03: inventory-only NPC Profile retains public lore but cannot mount printable canonical sheet");

 await signOut();await signIn("COEDITOR");
 await panel.getByText("C3P_APPROVED_PUBLIC_DESCRIPTION",{exact:true}).waitFor({timeout:15000});
 assert(!((await panel.innerText()).includes(gmOnly)),"Co-editor Profile leaked GM secret");
 await panel.getByRole("button",{name:"Sheet & Rolls"}).click();
 await panel.getByRole("button",{name:"Print Sheet"}).waitFor({timeout:15000});
 console.log("PASS C3P04: signed can_edit co-editor retains canonical sheet/Print entry without GM-only Profile secret");

 await signOut();await signIn("GM");
 await panel.getByText(gmOnly,{exact:true}).waitFor({timeout:15000});
 assert.match(await panel.innerText(),/NPC Dossier & Player Reveals/);
 await panel.getByRole("button",{name:"Sheet & Rolls"}).click();
 await panel.getByRole("button",{name:"Print Sheet"}).waitFor({timeout:15000});
 assert.equal(sql("SELECT secret FROM public.characters WHERE id='"+profileId+"'"),gmOnly);
 console.log("PASS C3P05: signed GM original NpcPanel displays private dossier and canonical printable sheet affordance");

 await signOut();
 await page.waitForTimeout(300);
 assert(!((await panel.innerText()).includes(gmOnly)),"GM secret persisted across logout and keyed profile remount");
 assert.deepEqual(pageErrors,[],"Original NPC Profile emitted browser errors");
 assert.deepEqual(offsite,[],"Original NPC Profile requested off-site data");
 console.log("C3P genuine original NpcPanel signed-role browser gate PASS. Print button authorization only: PDF output, full Next route stack and merchant/town integrations are separate.");

}finally{
 if(browser)await browser.close();
 if(server)await new Promise(resolve=>server.close(resolve));
 rmSync(dir,{recursive:true,force:true});
}
