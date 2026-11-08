#!/usr/bin/env node
// C3F: Actual original ten-step NewNpcModalV3 React user navigation, real
// signed PostgREST and original create_player_character_v3 through the
// staged atomic creator-private Story adapter. Source-keyed catalog rows are
// REDUCED, and the controller draft is deliberately hydrated to test a real
// resumed Forge; this is NOT blank-draft or complete-catalog acceptance.
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
})) assert.equal(env[key],value,"C3F refuses nonlocal environment: "+key);
assert.match(env.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(env.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_ANON_KEY);
const toolsRoot=env.C33_BROWSER_TOOL_ROOT,chrome=env.C33_BROWSER_CHROME;
assert.ok(toolsRoot&&path.isAbsolute(toolsRoot)&&chrome&&path.isAbsolute(chrome),
 "Pinned browser tools + local Chromium paths required");
const {chromium}=createRequire(path.join(toolsRoot,"c33f-playwright-anchor.cjs"))("playwright-core");
const origin=env.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_URL.replace(/\/$/,"");
const password="C33F-signed-"+randomUUID()+"!";
const email="c33f-player-"+randomUUID()+"@example.invalid";
const client=createClient(origin,env.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const signed=await client.auth.signUp({email,password});assert.ifError(signed.error);
const logged=await client.auth.signInWithPassword({email,password});assert.ifError(logged.error);
const person=logged.data.user?.id;assert.match(person||"",/^[0-9a-f-]{36}$/);
const getClasses=await client.from("class_catalog_preferred")
 .select("id,class_key,source").eq("class_key","fighter").single();assert.ifError(getClasses.error);
assert.equal(getClasses.data.id,"00000000-0000-0000-0000-000000000001");
const getOptions=await client.from("character_option_catalog_preferred")
 .select("id,option_type,name,source").in("option_type",["species","background"]).order("name");
assert.ifError(getOptions.error);
assert.equal(getOptions.data.length,2);
const equip=await client.rpc("get_player_forge_starting_equipment_v1",{
 p_class_id:"00000000-0000-0000-0000-000000000001",
 p_background_id:"00000000-0000-0000-0000-000000009912",
 p_level:1
});assert.ifError(equip.error);assert.equal(equip.data?.catalogReady,true);
assert.equal(equip.data?.classKey,"fighter");
console.log("PASS C3F00: signed PostgREST sees XPHB keyed class/species/background plus original source getter");

const id=randomUUID(),storyMarker="C33F Authored Browser Story "+randomUUID();
const storageValue={
 version:1,
 controller:{step:0,draft:{
  creationRequestId:id,
  name:"C33F Chromium Dwarf Fighter",role:"Fighter",level:1,kind:"npc",
  speciesOptionId:"00000000-0000-0000-0000-000000009911",
  backgroundOptionId:"00000000-0000-0000-0000-000000009912",
  classOptionId:"00000000-0000-0000-0000-000000000001",
  speciesKey:"dwarf",customBackground:"Soldier",classKey:"fighter",
  abilityMethod:"standard",
  baseAbilities:{str:15,dex:13,con:14,int:8,wis:12,cha:10},
  speciesBonus:{mode:"twoOne",plusTwo:"str",plusOne:"con",plusOnes:[],featId:""},
  selectedClassSkills:["perception","survival"],
  startingEquipment:{mode:"market",ruleset:"dndnext-homebrew",marketPurchases:[],keepStartingGold:true},
  backgroundNarrative:"",secret:"",
  portraitLibraryId:"00000000-0000-0000-0000-000000009914",
  portraitName:"C3F Dwarf Fixture Portrait",
  portraitUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==",
  portraitSource:"library",
 }},
 choices:{
  species:{speciesId:"00000000-0000-0000-0000-000000009911",
   speciesName:"Dwarf",rules:[],selections:{}},
  class:{classId:"00000000-0000-0000-0000-000000000001",
   classKey:"fighter",className:"Fighter",classSource:"XPHB",
   level:1,options:[],catalogReady:true,selectedKey:"",
   featureGroups:[],featureSelections:{},featureCatalogReady:true},
  source:{draftVersion:3,selections:{},defaultedGroups:{}}
 }
};
const temp=mkdtempSync(path.join(tmpdir(),"dndnext-c33f-full-")),bundle=path.join(temp,"original-forge.js");
let browser=null,server=null;
try{
 const bundler=path.join(toolsRoot,"node_modules",".bin","esbuild");
 execFileSync(bundler,[
  path.resolve("scripts/browser/c33_original_forge_full_dom.jsx"),
  "--bundle","--platform=browser","--format=iife","--jsx=automatic",
  "--loader:.js=jsx","--target=chrome120","--log-level=error",
  "--define:process.env.NEXT_PUBLIC_SUPABASE_URL="+JSON.stringify(origin),
  "--define:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="+JSON.stringify(env.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_ANON_KEY),
  "--outfile="+bundle
 ],{stdio:"pipe",timeout:120000});
 const js=readFileSync(bundle);
 server=createServer((req,res)=>{
  if(req.url==="/"){
   res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
   res.end('<!doctype html><html lang="en"><meta charset="utf-8"><title>C3F Original Forge</title><body><div id="c33f-root"></div><script src="/original-forge.js"></script></body></html>');
  }else if(req.url==="/original-forge.js"){
   res.writeHead(200,{"Content-Type":"application/javascript","Cache-Control":"no-store"});
   res.end(js);
  }else{
   res.writeHead(404,{"Content-Type":"text/plain"});res.end("Not found");
  }
 });
 await new Promise(done=>server.listen(0,"127.0.0.1",done));
 const base="http://127.0.0.1:"+server.address().port;
 browser=await chromium.launch({executablePath:chrome,headless:true,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:1560,height:1080}});
 await context.addInitScript(({draft})=>{
  const key="dndnext:player-character-forge:draft:v1:c33-full-original-form";
  localStorage.setItem(key,JSON.stringify(draft));
 },{draft:storageValue});
 const page=await context.newPage();
 const pageErrors=[],offsite=[],requests=[],httpErrors=[];
 page.on("pageerror",e=>pageErrors.push(String(e.message||e)));
 page.on("response",response=>{if(response.status()>=400)httpErrors.push({
   status:response.status(),url:response.url().split("?")[0]
 });});
 page.on("requestfailed",req=>requests.push(req.url()+" "+req.failure()?.errorText));
 await page.route("**/*",async route=>{
  const address=new URL(route.request().url()),allow=address.origin===base||address.origin===origin;
  if(allow)await route.continue();
  else{offsite.push(address.origin);await route.abort();}
 });
 await page.goto(base,{waitUntil:"load"});
 await page.waitForFunction(()=>window.__C33F_HOST_READY__===true,{timeout:15000});
 const signedIn=await page.evaluate(async({email,password})=>window.__C33F_LOGIN__(email,password),{
  email,password
 });
 assert.equal(signedIn,person,"Browser login not same genuine GoTrue player");
 const modal=page.locator(".npc-forge-modal-v2.is-player-mode");
 await modal.waitFor({state:"visible",timeout:30000});
 const nav=modal.locator(".npc-forge-steps button");
 assert.equal(await nav.count(),10,"Must be ORIGINAL ten-step player Forge");
 const expected=["Species","Background","Class","Abilities","Training",
  "Spells","Equipment","Identity","Story","Review"];
 assert.deepEqual((await nav.allTextContents()).map(s=>s.replace(/\d+/g,"").trim()),expected);
 console.log("PASS C3F01: actual original NewNpcModalV3 renders ten player steps, real signed session, draft hydration");
 const getCurrent=async()=>modal.locator(".npc-forge-steps button.is-current").innerText();
 const alert=async()=>modal.locator(".npc-forge-error").allTextContents();
 const validation=async()=>modal.locator("[data-forge-validation-message]")
   .evaluateAll(nodes=>nodes.map(node=>({message:node.dataset.forgeValidationMessage,
     className:node.className})));
 await page.evaluate(()=>{
  window.__C33F_VALIDATION_TRACE__=[];
  window.__C33F_EVENT_TRACE__=[];
  const matchContinue=(event)=>event.type==="click"
    && event.target?.closest?.("button")?.textContent?.trim()==="Continue";
  const originalPrevent=Event.prototype.preventDefault;
  Event.prototype.preventDefault=function(...args){
    if(matchContinue(this))window.__C33F_EVENT_TRACE__.push({
      kind:"preventDefault",stack:(new Error()).stack?.slice(0,700)
    });
    return originalPrevent.apply(this,args);
  };
  const originalBubbleStop=Event.prototype.stopPropagation;
  Event.prototype.stopPropagation=function(...args){
    if(matchContinue(this))window.__C33F_EVENT_TRACE__.push({
      kind:"stopPropagation",stack:(new Error()).stack?.slice(0,750)
    });
    return originalBubbleStop.apply(this,args);
  };
  const originalStop=Event.prototype.stopImmediatePropagation;
  Event.prototype.stopImmediatePropagation=function(...args){
    if(matchContinue(this))window.__C33F_EVENT_TRACE__.push({
      kind:"stopImmediatePropagation",stack:(new Error()).stack?.slice(0,700)
    });
    return originalStop.apply(this,args);
  };
  const root=document.querySelector(".npc-forge-modal-v2");
  new MutationObserver(changes=>{
   for(const change of changes){
    if(change.type!=="attributes"||change.attributeName!=="data-forge-validation-message")continue;
    const message=change.target.getAttribute("data-forge-validation-message");
    if(message)window.__C33F_VALIDATION_TRACE__.push({
      message,step:document.querySelector(".npc-forge-steps button.is-current")?.textContent
    });
   }
  }).observe(root,{subtree:true,attributes:true,attributeFilter:["data-forge-validation-message"]});
 });
 for(let n=0;n<9;n++){
  const current=(await getCurrent()).trim();
  assert.ok(current.includes(expected[n]),"Wrong original current step "+n+": "+current);
  if(n===0){
   // Exercise the actual required source-owned origin language fields, rather
   // than forging a pre-completed selection in the hydrated browser draft.
   const languages=modal.locator('.npc-forge-species-fact-choice[data-icon-kind="languages"]');
   await languages.waitFor({state:"visible",timeout:15000});
   if(!(await languages.evaluate(el=>el.open)))await languages.locator("summary").click();
   const slots=languages.locator(".npc-forge-embedded-choice__slots select");
   await slots.first().waitFor({state:"visible",timeout:12000});
   assert.equal(await slots.count(),2,"Original Species step must ask for two Standard languages");
   await slots.nth(0).selectOption({label:"Dwarvish"});
   await slots.nth(1).selectOption({label:"Elvish"});
   await page.waitForFunction(()=>{
     const node=document.querySelector('.npc-forge-species-fact-choice[data-icon-kind="languages"]');
     return node?.classList.contains("is-complete")===true;
   },null,{timeout:12000});
   const openCompleted = await modal.locator("details.npc-forge-species-fact-choice.is-complete[open]").count();
   assert.ok(openCompleted > 0,"C3F must click Continue while completed Species details remain open");
   console.log("PASS C3F_ORIGIN_LANGUAGES: real Dwarf Species source-choice dropdowns accepted two distinct languages; completed detail is open before Continue");
  }
  if(n===8){
   const generate=modal.getByRole("button",{name:/Generate character story & world fit/i});
   await generate.click();
   const privateInput=modal.locator(".npc-forge-step-story label")
     .filter({hasText:"Private backstory (creator and GM only)"}).locator("textarea");
   await privateInput.waitFor({state:"visible"});
   const generated=await privateInput.inputValue();
   assert.ok(generated.length>20,"Original Story generator did not populate private text");
   await privateInput.fill(generated+"\n"+storyMarker);
   assert.ok((await privateInput.inputValue()).includes(storyMarker));
   console.log("PASS C3F02: actual player Story Generate click fills private field and author can edit");
  }
  if(n===2||n===5||n===6)await page.waitForTimeout(550);
  await modal.getByRole("button",{name:"Continue",exact:true}).click();
  if(n===0){
   await page.waitForTimeout(300);
   const trace=await page.evaluate(()=>{
    const button=document.querySelector(".npc-forge-modal-v2 .npc-forge-footer .btn-primary");
    const reactKey=button&&Object.keys(button).find(k=>k.startsWith("__reactProps$"));
    const fiberKey=button&&Object.keys(button).find(k=>k.startsWith("__reactFiber$"));
    return {
      events:window.__C33F_VALIDATION_TRACE__,
      nativeEvents:window.__C33F_EVENT_TRACE__,
      current:document.querySelector(".npc-forge-steps button.is-current")?.textContent,
      button:button?.outerHTML.slice(0,400),
      reactProps:reactKey?Object.keys(button[reactKey]):[],
      reactClickType:reactKey?typeof button[reactKey]?.onClick:"missing",
      hasFiber:Boolean(fiberKey),
      localController:JSON.parse(localStorage.getItem("dndnext:player-character-forge:draft:v1:c33-full-original-form")||"{}")?.controller?.step,
    };
   });
   console.log("C3F first-step click trace",JSON.stringify({trace,httpErrors}));
  }
  try{
   await page.waitForFunction(target=>{
    const selected=document.querySelector(".npc-forge-modal-v2 .npc-forge-steps button.is-current");
    return selected?.textContent?.includes(target);
   },expected[n+1],{timeout:15000});
  }catch(cause){
   throw new Error("Original Forge failed to advance "+expected[n]+"→"+expected[n+1]+
     " (current="+(await getCurrent())+", errors="+JSON.stringify(await alert())+
     ", guidance="+JSON.stringify(await validation())+
     ", incomplete="+JSON.stringify(await modal.locator(".npc-forge-source-choice-group.is-required, .npc-forge-species-fact-choice.is-required").allTextContents())+
     ", pageerrors="+JSON.stringify(pageErrors)+
     ", httpErrors="+JSON.stringify(httpErrors)+
     ", validationTrace="+JSON.stringify(await page.evaluate(()=>window.__C33F_VALIDATION_TRACE__))+
     ", eventTrace="+JSON.stringify(await page.evaluate(()=>window.__C33F_EVENT_TRACE__))+"): "+cause.message);
  }
  console.log("PASS C3F_STEP_"+String(n+1).padStart(2,"0")+": original "+expected[n]+" → "+expected[n+1]+" via Continue");
 }
 assert.match(await modal.getByText("Confirm your player character").innerText(),/Confirm your player character/);
 const createdButton=modal.getByRole("button",{name:"Create Player Character",exact:true});
 await createdButton.click();
 try{
  await page.waitForFunction(()=>Boolean(window.__C33F_CREATED__?.id),null,{timeout:18000});
 }catch(cause){
  throw new Error("Original Forge Review→Create failed, UI alerts="+JSON.stringify(await alert())+
    " and browser errors="+JSON.stringify(pageErrors)+": "+cause.message);
 }
 const made=await page.evaluate(()=>window.__C33F_CREATED__);
 assert.match(made.id,/^[a-f0-9-]{36}$/i);
 const check=await client.rpc("get_my_player_characters_v2");
 assert.ifError(check.error);
 const sql=query=>{
  const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",query],
   {env:{...env,PGUSER:"postgres"},encoding:"utf8",timeout:20000});
  assert.equal(r.status,0,r.stderr);return r.stdout.trim();
 };
 assert.equal(sql("SELECT secret IS NULL FROM public.characters WHERE id='"+made.id+"'"),"t");
 assert.equal(sql("SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id='"+
   made.id+"'"),person);
 assert.equal(sql("SELECT strpos(secret_text,"+String.fromCharCode(39)+storyMarker+String.fromCharCode(39)+
   ")>0 FROM public.character_backstory_secrets WHERE character_id='"+made.id+"'"),"t");
 assert.equal(sql("SELECT sheet#>>'{meta,creator}' FROM public.character_sheets WHERE character_id='"+
   made.id+"'"),"shared_character_forge_player_v2");
 assert.deepEqual(pageErrors,[],"Actual original Forge emitted runtime browser errors");
 console.log("PASS C3F03: Chromium Review→original v3 atomic creator Story RPC, creator attribution, sheet + secret separation");
 console.log("BOUNDARY C3F: original unified Forge ten-step HYDRATED-DRAFT browser path with reduced source-keyed catalogs; no blank-form rule-completeness, full original 31-trigger, integrated Profile/Print/Town/merchant or production approval.");
}finally{
 if(browser)await browser.close();
 if(server)await new Promise(resolve=>server.close(resolve));
 rmSync(temp,{recursive:true,force:true});
}
