#!/usr/bin/env node
// T44 CURRENT production CharacterLevelUpChoices/SourceChoiceFields mounted in
// a disposable Next Pages Router probe; browser signs genuine GoTrue JWTs,
// chooses actual rendered source options, and posts to ORIGINAL public v5.
// Synthetic server-shaped review props are INJECTED by the probe, not fetched
// via original CharacterClassPanel/get_character_level_up_review_v1. Consequently
// NOT full live review-parent/Forge/canonical catalog/browser release acceptance.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import crypto,{randomUUID} from "node:crypto";
import {spawn,spawnSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
const env=process.env;
for(const [key,value] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_P13_LEVELUP_LOCAL_CONFIRM:"P13_SOURCE_V5_LOCAL_AUTH_ONLY",
 DNDNEXT_T44_SIGNED_BROWSER_CONFIRM:"CURRENT_NEXT_EXACT_COMPONENT_LOCAL_ONLY"
}))assert.equal(env[key],value,"T44 rejects unsafe host "+key);
assert.equal(env.DNDNEXT_P13_LEVELUP_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_P13_LEVELUP_ANON_KEY);
assert.ok(env.C33_BROWSER_CHROME && path.isAbsolute(env.C33_BROWSER_CHROME));
assert.ok(env.C33_BROWSER_TOOL_ROOT && path.isAbsolute(env.C33_BROWSER_TOOL_ROOT));
assert.notEqual(env.VERCEL,"1");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const nextBin=path.join(root,"node_modules/next/dist/bin/next");
assert.ok(fs.existsSync(nextBin),"T44 needs npm-ci current Next");
const require=createRequire(path.join(env.C33_BROWSER_TOOL_ROOT,"t44-playwright-anchor.cjs"));
const {chromium}=require("playwright-core");
const q=id=>{assert.match(id,/^[a-f0-9-]{36}$/i);return "'"+id+"'";};
const literal=s=>"'"+String(s).replaceAll("'","''")+"'";
const blob=b=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
function original(pathName,sha){const data=fs.readFileSync(path.join(root,pathName));assert.equal(blob(data),sha,"T44 protected original source changed "+pathName);return data.toString();}
const p13=original("scripts/fixtures/p1_3_levelup_v5_original_source_pg17.sql","b3168d0c9ec92ae1c0c389ccf55655209f2841f8");
const choices=original("sql/20260808_18_metamagic_mystic_arcanum_progression.sql","ce7d4ec3f37eeb0a29b8a07cd64609ee9627642f");
for(const [p,sha] of [
 ["components/CharacterLevelUpChoices.js","3fa76acd1811a77b0c3e93711906bfb5afb17584"],
 ["components/SourceChoiceFields.js","31128be6bdded46542aea1b62f7ea3c78b6839a7"],
 ["components/CharacterInvocationRecovery.js","c58774853c6140981592fa84b9040c0fcb4a8c58"],
 ["components/CharacterClassPanel.js","d39d2bceab944d3d4ec42cc2cfda92609ce51a2b"],
 ["utils/supabaseClient.js","13b3339c4c99702bc667f1a1bc9b2ea36a70b18b"]
])original(p,sha);
const expected={
 "public.complete_character_level_up_v5(uuid,jsonb)":"02d74b973a763c53c595be20e35e512f",
 "public.complete_character_level_up_v4(uuid,jsonb)":"f8338ef170c6e27b972e777eeae406b8",
 "public.complete_character_level_up_v3(uuid,jsonb)":"4467e166234c67fc12dd73da0e46b379",
 "private.complete_character_level_up_base_v3(uuid,jsonb)":"e33639d549ef557976a3970ea51f5238",
 "private.sync_player_forge_class_spell_summary_v1(uuid)":"5b1b275a268a57591a2e35a05ce7480d",
 "private.can_manage_character_progression_v1(uuid)":"ac70e4ec033d86c4e0a254d50d429a45"
};
const baseMirror=[
 "  update public.players p set sheet = v_sheet, updated_at = now()",
 "  where p.user_id in (",
 "    select cp.user_id from public.character_permissions cp where cp.character_id = p_character_id",
 "  );"
].join("\n");
const summaryMirror=[
 "  update public.players p set sheet=v_sheet,updated_at=now()",
 "  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);"
].join("\n");
const extraMirror="  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
function fn(src,name){
 const i=src.toLowerCase().indexOf("create or replace function "+name.toLowerCase()+"(");
 assert.ok(i>=0,"T44 original function unavailable: "+name);
 const tail=src.slice(i),end=/\n(?:\$function\$|\$\$);/.exec(tail);
 assert.ok(end);
 return tail.slice(0,end.index+end[0].length);
}
const base=fn(p13,"private.complete_character_level_up_base_v3");
const summary=fn(p13,"private.sync_player_forge_class_spell_summary_v1");
const extra=fn(choices,"private.apply_additional_level_class_choices_v1");
for(const [src,clause] of [[base,baseMirror],[summary,summaryMirror],[extra,extraMirror]])
 assert.equal(src.split(clause).length,2,"historical source mirror changed");
const candidate=(src,clause)=>src.replace(clause,"  -- T44 NON-ORIGINAL scratch Option A: account-history projection disabled.");
const green=[candidate(base,baseMirror),candidate(summary,summaryMirror),candidate(extra,extraMirror)];
for(const s of green)assert.doesNotMatch(s,/update public\.players p/);
function sql(s){
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",s],{
  cwd:root,env,encoding:"utf8",timeout:30000
 });
 assert.equal(r.status,0,"T44 disposable PG17 SQL failure: "+String(r.stderr).slice(-2200));
 return r.stdout.trim();
}
function verify(hashMap=expected){
 for(const [name,hash] of Object.entries(hashMap))
  assert.equal(sql("SELECT md5(pg_get_functiondef("+literal(name)+"::regprocedure))"),hash,"T44 original pg_get_functiondef drift: "+name);
}
assert.equal(sql("SELECT current_database()"),"postgres");
assert.match(sql("SHOW server_version"),/^17\./);
assert.equal(sql("SELECT to_regclass('private.p13_levelup_case_guard') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public.t42_local_additional_choice_probe_v1(uuid,integer,jsonb)') IS NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public.complete_character_level_up_v5(uuid,jsonb)') IS NOT NULL"),"t");
assert.equal(sql("SELECT has_function_privilege('anon','public.complete_character_level_up_v5(uuid,jsonb)','EXECUTE')"),"f");
assert.equal(sql("SELECT has_function_privilege('authenticated','public.complete_character_level_up_v5(uuid,jsonb)','EXECUTE')"),"t");
// T43 ended with separate local Option A installed. Stage ORIGINAL private
// function bodies first and verify deployed-original source fingerprints.
sql(base);sql(summary);sql(extra);
verify();
assert.equal(sql("SELECT pg_get_functiondef('private.apply_additional_level_class_choices_v1(uuid,integer,jsonb)'::regprocedure) LIKE '%update public.players p%'"),"t");
console.log("PASS T44-ORIGINAL-SOURCE: current Level Up UI assets pinned, original public v5/v4/v3/base and 3 linked-account writers reinstated; no proxy");

// The production UI also performs *five* signed catalog queries. T43's
// intentionally reduced server schema did not provide these. T44 adds exact
// SELECT column surfaces as explicitly SYNTHETIC, local-only SQL; source-legal
// Metamagic/Arcanum options themselves still come from ORIGINAL public getter.
for(const col of [
 "school_code text","ritual boolean NOT NULL DEFAULT false",
 "casting_time text","description text"
])sql("ALTER TABLE public.spells_catalog ADD COLUMN IF NOT EXISTS "+col);
sql("CREATE OR REPLACE VIEW public.spells_catalog_preferred WITH (security_invoker=true) AS "+
 "SELECT id,name,level,spell_key,source,classes,school,school_code,ritual,casting_time,description "+
 "FROM public.spells_catalog WHERE source='XPHB'");
sql("CREATE TABLE IF NOT EXISTS public.items_catalog("+
 "id uuid PRIMARY KEY DEFAULT gen_random_uuid(),item_name text,item_key text,item_type text,item_rarity text,payload jsonb)");
sql("CREATE TABLE IF NOT EXISTS public.class_feature_option_catalog("+
 "id uuid PRIMARY KEY DEFAULT gen_random_uuid(),option_key text,option_type text,name text,"+
 "source text,class_key text,description text,prerequisites jsonb,metadata jsonb)");
for(const table of ["spells_catalog","items_catalog","class_feature_option_catalog"]){
 sql("ALTER TABLE public."+table+" ENABLE ROW LEVEL SECURITY");
 sql("DROP POLICY IF EXISTS t44_signed_catalog_read ON public."+table);
 sql("CREATE POLICY t44_signed_catalog_read ON public."+table+" FOR SELECT TO authenticated USING(true)");
 sql("REVOKE ALL ON public."+table+" FROM PUBLIC,anon");
 sql("GRANT SELECT ON public."+table+" TO authenticated");
}
sql("REVOKE ALL ON public.spells_catalog_preferred FROM PUBLIC,anon");
sql("GRANT SELECT ON public.spells_catalog_preferred TO authenticated");
sql("ALTER TABLE public.character_spells ENABLE ROW LEVEL SECURITY");
sql("DROP POLICY IF EXISTS t44_owned_character_spells_read ON public.character_spells");
sql("CREATE POLICY t44_owned_character_spells_read ON public.character_spells FOR SELECT TO authenticated "+
 "USING(EXISTS(SELECT 1 FROM public.character_permissions cp "+
 "WHERE cp.character_id=character_spells.character_id AND cp.user_id=auth.uid() AND cp.can_edit))");
sql("REVOKE ALL ON public.character_spells FROM PUBLIC,anon");
sql("GRANT SELECT ON public.character_spells TO authenticated");
sql("NOTIFY pgrst,'reload schema'");
console.log("PASS T44-UI-CATALOG-STAGE: five original UI SELECT surfaces available from synthetic local-only tables/views; signed RLS limits personal spell rows");

// All test actors belong to disposable GoTrue; credentials are never printed
// or sent off local loopback. New characters are test-only SQL seeded, not Forge.
const api=()=>createClient(env.DNDNEXT_P13_LEVELUP_URL,env.DNDNEXT_P13_LEVELUP_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
async function makeActor(name){
 const who=api(),email="t44-"+name+"-"+randomUUID()+"@example.invalid",
  password="LocalT44-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const u=await who.auth.getUser(),claims=await who.auth.getClaims();
 assert.ifError(u.error);assert.ifError(claims.error);
 assert.equal(claims.data.claims.role,"authenticated");
 return {id:u.data.user.id,email,password,who};
}
const a={};
for(const label of ["red-owner","red-editor","red-viewer","green-owner","green-editor","green-viewer","outsider"])
 a[label]=await makeActor(label);
const pairs=[["red-owner","T44_RED_OWNER_HISTORY"],["red-editor","T44_RED_EDITOR_HISTORY"],["red-viewer","T44_RED_VIEWER_HISTORY"],["green-owner","T44_GREEN_OWNER_HISTORY"],["green-editor","T44_GREEN_EDITOR_HISTORY"],["green-viewer","T44_GREEN_VIEWER_HISTORY"]];
for(const [name,marker] of pairs){
 sql("INSERT INTO public.players(user_id,sheet) VALUES("+q(a[name].id)+","+
  literal(JSON.stringify({marker,independentHistoricalCharacter:true}))+"::jsonb) "+
  "ON CONFLICT(user_id) DO UPDATE SET sheet=excluded.sheet,updated_at=now()");
}
const origHist=(who)=>sql("SELECT md5(sheet::text) FROM public.players WHERE user_id="+q(who.id));
const before=Object.fromEntries(pairs.map(([name])=>[name,origHist(a[name])]));
const ids={
 sorcerer:"00000000-0000-0000-0000-000000008243",
 warlock:"00000000-0000-0000-0000-000000008244"
};
const canonical=id=>sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+q(id));
const level=id=>Number(sql("SELECT class_level FROM public.character_progression WHERE character_id="+q(id)));
const events=id=>Number(sql("SELECT count(*) FROM public.character_level_events WHERE character_id="+q(id)+" AND event_type='level_up_completed'"));
const completions=id=>Number(sql("SELECT count(*) FROM public.character_level_up_sessions WHERE character_id="+q(id)+" AND status='completed'"));
const choicesFor=(id,group)=>JSON.parse(sql("SELECT coalesce(sheet#>'{classFeatureChoices,"+group+",selections}','[]'::jsonb)::text FROM public.character_sheets WHERE character_id="+q(id))).map(x=>x.name);
function char(key,owner,coeditor,viewer,label){
 const id=randomUUID(),from=key==="warlock"?10:1,to=from+1;
 const sheet=JSON.stringify({classKey:key,rulesetSource:"XPHB",ruleset:"2024",
  level:from,hp:key==="warlock"?60:10,maxHp:key==="warlock"?60:10,
  abilities:{con:{score:12}},meta:{classKey:key,rulesetSource:"XPHB",level:from},marker:"T44 "+label});
 sql("INSERT INTO public.characters(id,name,kind) VALUES("+q(id)+","+literal("T44 "+label)+",'npc')");
 sql("INSERT INTO public.character_sheets(character_id,sheet) VALUES("+q(id)+","+literal(sheet)+"::jsonb)");
 sql("INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,created_by) "+
 "VALUES("+q(id)+","+q(ids[key])+","+from+","+(from===10?100000:300)+",true,"+q(owner.id)+") "+
 "ON CONFLICT(character_id) DO UPDATE SET class_id=excluded.class_id,class_level=excluded.class_level,"+
 "experience_points=excluded.experience_points,pending_level_up=excluded.pending_level_up,created_by=excluded.created_by");
 sql("INSERT INTO public.character_level_up_sessions(character_id,from_level,to_level,metadata_ready,status,created_by) "+
 "VALUES("+q(id)+","+from+","+to+",true,'open',"+q(owner.id)+")");
 const session=sql("SELECT id::text FROM public.character_level_up_sessions "+
  "WHERE character_id="+q(id)+" AND status='open' LIMIT 1");
 for(const [who,edit] of [[owner,true],[coeditor,true],[viewer,false]]){
  sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit) "+
   "VALUES("+q(id)+","+q(who.id)+","+(edit?"true":"false")+") "+
   "ON CONFLICT(character_id,user_id) DO UPDATE SET can_edit=excluded.can_edit");
 }
 return {id,key,from,to,session,name:"T44 "+label};
}
const red=char("sorcerer",a["red-owner"],a["red-editor"],a["red-viewer"],"Browser Original Metamagic");
const greenS=char("sorcerer",a["green-owner"],a["green-editor"],a["green-viewer"],"Browser Option A Metamagic");
const greenW=char("warlock",a["green-owner"],a["green-editor"],a["green-viewer"],"Browser Option A Mystic Arcanum");
const revoked=char("warlock",a["green-owner"],a["green-editor"],a["green-viewer"],"Browser Revocation Arcanum");
const initialRed=canonical(red.id),initialGreenS=canonical(greenS.id),initialGreenW=canonical(greenW.id);
const spell="00000000-0000-0000-0000-000000008245";
const getReview=record=>({session:{id:record.session,fromLevel:record.from,toLevel:record.to},
 metadataReady:true,canComplete:true,preview:{classKey:record.key,fromLevel:record.from,
 toLevel:record.to,newCantrips:0,newLeveledSpells:0,highestSpellLevel:0,
 features:[],choices:[],requiredXp:record.from===10?100000:300}});
assert.equal(sql("SELECT to_regprocedure('public.get_character_level_up_review_v1(uuid)') IS NULL"),"t",
 "T44 must not invent original review parent RPC");
console.log("PASS T44-SIGNED-FIXTURES: real signed GoTrue actors, distinct owner/editor/viewer histories, source-level sessions and synthetic review-prop boundary");

const routeFile="pages/__c34_t44_level_up_probe.jsx";
const routePath=path.join(root,routeFile);
assert.ok(!fs.existsSync(routePath),"T44 refuses overwriting existing/production Next page");
const routeSource=[
 'import { useEffect,useState } from "react";',
 'import dynamic from "next/dynamic";',
 'import { supabase } from "../utils/supabaseClient";',
 'const OriginalLevelUp=dynamic(()=>import("../components/CharacterLevelUpChoices"),{ssr:false});',
 'export default function T44LevelUpProbe(){',
 ' const [data,setData]=useState(null);',
 ' const [done,setDone]=useState(false);',
 ' useEffect(()=>{window.__t44sb=supabase;window.__t44open=(item)=>{window.__t44Completed=null;setDone(false);setData(item);};},[]);',
 ' const completed=async result=>{window.__t44Completed=result;setDone(true);};',
 ' return <main data-testid="t44-next-probe" style={{padding:"28px",maxWidth:"1100px",margin:"0 auto",color:"#eee",background:"#141724"}}>',
 '  <h1>Local-only signed CharacterLevelUpChoices</h1>',
 '  {done?<strong data-testid="t44-complete">The original component returned successful original RPC data</strong>:',
 '   data?<OriginalLevelUp key={data.review.session.id} character={{id:data.id,name:data.name}} review={data.review} onCompleted={completed}/>:',
 '   <p data-testid="t44-idle">Source component not yet mounted</p>}',
 ' </main>;',
 '}'
].join("\n");
let browser=null,server=null,serverLog="";
const offsite=[],pageErrors=[],rpcCalls=[],requestBad=[];
async function port(){
 return new Promise((resolve,reject)=>{
  const s=net.createServer();
  s.once("error",reject);
  s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p));});
 });
}
try{
 fs.writeFileSync(routePath,routeSource,{flag:"wx"});
 const number=await port(),origin="http://127.0.0.1:"+number;
 server=spawn(process.execPath,[nextBin,"dev","--webpack","-H","127.0.0.1","-p",String(number)],{
  cwd:root,detached:true,stdio:["ignore","pipe","pipe"],
  env:{...env,NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_P13_LEVELUP_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_P13_LEVELUP_ANON_KEY,
   NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1"}
 });
 for(const stream of [server.stdout,server.stderr])
  stream.on("data",chunk=>{serverLog=(serverLog+chunk.toString()).slice(-25000);});
 let ready=false;
 for(let attempt=0;attempt<110;attempt++){
  if(server.exitCode!==null)throw Error("T44 exact Next server exited: "+serverLog);
  try{
   const response=await fetch(origin+"/__c34_t44_level_up_probe",{signal:AbortSignal.timeout(2500)});
   if(response.ok && (await response.text()).includes("t44-next-probe")){ready=true;break;}
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,1200));
 }
 assert.ok(ready,"T44 original component did not compile in real Next: "+serverLog);
 console.log("PASS T44-NEXT-READY: actual pinned Next 16 Pages Router served dynamically mounted unmodified Level Up component");
 browser=await chromium.launch({headless:true,executablePath:env.C33_BROWSER_CHROME,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:1440,height:940}});
 const page=await context.newPage();
 page.on("pageerror",e=>pageErrors.push(e.message));
 page.on("request",r=>{
  const u=r.url();
  if(u.includes("/rest/v1/rpc/complete_character_level_up_v5")){
   try{rpcCalls.push({url:u,payload:r.postDataJSON()});}
   catch(e){requestBad.push(String(e));}
  }
 });
 await page.route("**/*",async route=>{
  const u=route.request().url();
  if(u.startsWith(origin)||u.startsWith(env.DNDNEXT_P13_LEVELUP_URL)
    ||u.startsWith("ws://127.0.0.1:"))return route.continue();
  if(/supabase\.co|supabase\.in|service_role/i.test(u))offsite.push(u.slice(0,180));
  return route.abort();
 });
 await page.goto(origin+"/__c34_t44_level_up_probe",{waitUntil:"domcontentloaded",timeout:90000});
 await page.waitForFunction(()=>!!window.__t44sb&&!!window.__t44open,null,{timeout:90000});
 async function sign(who){
  const identity=await page.evaluate(async creds=>{
   await window.__t44sb.auth.signOut();
   const x=await window.__t44sb.auth.signInWithPassword(creds);
   if(x.error)throw Error(x.error.message);
   return x.data.user.id;
  },{email:who.email,password:who.password});
  assert.equal(identity,who.id,"browser genuine signed GoTrue actor identity");
 }
 async function openCase(record){
  await page.evaluate(record=>window.__t44open({id:record.id,name:record.name,review:{
   session:{id:record.session,fromLevel:record.from,toLevel:record.to},
   metadataReady:true,canComplete:true,preview:{
    classKey:record.key,fromLevel:record.from,toLevel:record.to,
    newCantrips:0,newLeveledSpells:0,highestSpellLevel:0,features:[],choices:[]
   }
  }}),record);
  await page.locator(".level-up-choice-form").waitFor({state:"visible",timeout:30000});
 }
 async function waitGroup(label){
  const section=page.locator(".npc-forge-source-choice-group").filter({hasText:label}).first();
  await section.waitFor({state:"visible",timeout:35000});
  await page.getByText("Loading source-legal class choices…").waitFor({state:"hidden",timeout:35000});
  const error=await page.locator(".level-up-choice-form > .alert-danger").allInnerTexts();
  assert.deepEqual(error,[],"T44 UI was not ready for user choices");
  return section;
 }
 async function pickMetamagic(){
  const group=await waitGroup("Metamagic");
  for(const name of ["Quickened Spell","Subtle Spell"]){
   await group.locator(".npc-forge-rich-choice__list button").filter({hasText:name}).first().click();
   await group.locator(".npc-forge-rich-choice__detail button").getByText("Choose",{exact:true}).click();
  }
  await group.locator("header em").getByText("Complete",{exact:true}).waitFor();
 }
 async function pickArcanum(){
  const group=await waitGroup("Mystic Arcanum");
  const row=group.locator(".npc-forge-source-spell-picker__row")
    .filter({hasText:"T43 Synthetic XPHB Warlock Sixth"});
  await row.waitFor();
  await row.getByRole("button",{name:"Available"}).click();
  await group.locator("header em").getByText("Complete",{exact:true}).waitFor();
 }
 async function submit(record){
  const first=rpcCalls.length;
  const promise=page.waitForResponse(r=>r.url().includes("/rest/v1/rpc/complete_character_level_up_v5"),
   {timeout:40000});
  await page.getByRole("button",{name:"Apply Level "+record.to}).click();
  const response=await promise;
  assert.equal(rpcCalls.length,first+1,"Browser must call one original public v5 RPC");
  const call=rpcCalls.at(-1);
  assert.equal(call.payload.p_character_id,record.id);
  assert.equal(call.payload.p_selections.hp_method,"fixed");
  assert.deepEqual(call.payload.p_selections.spell_choices,[]);
  assert.equal(call.payload.p_selections.class_choice_selections[
   record.key==="warlock"?"warlock-mystic-arcanum-6":"sorcerer-metamagic"
  ].selection.length,record.key==="warlock"?1:2);
  return response;
 }
 async function successful(record){
  const reply=await submit(record);
  assert.ok(reply.ok(),"T44 browser original v5 rejected: "+(await reply.text()).slice(0,750));
  await page.getByTestId("t44-complete").waitFor({timeout:25000});
  assert.equal(await page.evaluate(()=>!!window.__t44Completed),true);
  assert.equal(level(record.id),record.to);
  assert.equal(events(record.id),1);assert.equal(completions(record.id),1);
 }
 const initialCalls=rpcCalls.length;
 await sign(a["red-owner"]);
 await openCase(red);
 await waitGroup("Metamagic");
 await page.getByRole("button",{name:"Apply Level 2"}).click();
 await page.getByText("Complete every permanent class choice gained at this level.").waitFor();
 assert.equal(rpcCalls.length,initialCalls,"client must reject incomplete permanent choices before v5 RPC");
 assert.equal(level(red.id),1);
 await pickMetamagic();
 await successful(red);
 assert.deepEqual(choicesFor(red.id,"sorcerer-metamagic"),["Quickened Spell","Subtle Spell"]);
 assert.notEqual(canonical(red.id),initialRed);
 for(const n of ["red-owner","red-editor","red-viewer"])
  assert.equal(origHist(a[n]),canonical(red.id),"original browser red must expose FULL 3-account legacy mirror incl read-only");
 console.log("PASS T44-ORIGINAL-UI-SORCERER-RED: actual Next component requires 2 Metamagics, sends real signed v5, saves canonical but overwrites 3 independent historical account Sheets");

 // Explicitly separate, NON-ORIGINAL Option A after the unmodified source RED:
 // freeze all 3 ORIGINAL whole-account mirrors *only inside disposable PG17*.
 for(const s of green)sql(s);
 assert.equal(sql("SELECT pg_get_functiondef('private.apply_additional_level_class_choices_v1(uuid,integer,jsonb)'::regprocedure) LIKE '%update public.players p%'"),"f");
 for(const f of ["public.complete_character_level_up_v5(uuid,jsonb)",
  "public.complete_character_level_up_v4(uuid,jsonb)",
  "public.complete_character_level_up_v3(uuid,jsonb)"])
  assert.equal(sql("SELECT md5(pg_get_functiondef("+literal(f)+"::regprocedure))"),expected[f]);
 console.log("PASS T44-OPTION-A-SOURCE: 3 historical private mirrors omitted locally; all original public UI target RPC source identities preserved");

 await sign(a["green-owner"]);
 await openCase(greenS);
 await pickMetamagic();
 await successful(greenS);
 assert.deepEqual(choicesFor(greenS.id,"sorcerer-metamagic"),["Quickened Spell","Subtle Spell"]);
 assert.notEqual(canonical(greenS.id),initialGreenS);
 for(const n of ["green-owner","green-editor","green-viewer"])
  assert.equal(origHist(a[n]),before[n],"original NEXT UI with Option A must freeze all 3 historical sheets");
 console.log("PASS T44-OPTION-A-UI-SORCERER: real Next UI→real signed public v5, canonical class+HP/session/event, all historical accounts frozen");

 await openCase(greenW);
 await pickArcanum();
 await successful(greenW);
 assert.equal(sql("SELECT count(*) FROM public.character_spells WHERE character_id="+q(greenW.id)+
  " AND spell_id="+q(spell)+" AND source_key='warlock-mystic-arcanum-6' AND recharge='long-rest'"),"1");
 assert.notEqual(canonical(greenW.id),initialGreenW);
 for(const n of ["green-owner","green-editor","green-viewer"])
  assert.equal(origHist(a[n]),before[n]);
 console.log("PASS T44-OPTION-A-UI-WARLOCK: real source spell-picker Next UI chooses synthetic 6th-level XPHB Arcanum; signed actual v5 persists typed long-rest spell, historical account frozen");

 // Same session/JWT: permission revoked after UI choices are rendered.
 await openCase(revoked);
 await pickArcanum();
 const beforeRevocation=canonical(revoked.id);
 sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+q(revoked.id)+
  " AND user_id="+q(a["green-owner"].id));
 const denied=await submit(revoked);
 assert.equal(denied.status(),403,"stale signed JWT must not retain editing access");
 await page.locator(".level-up-choice-form > .alert-danger").getByText(/permission|manage|level/i).waitFor();
 assert.equal(level(revoked.id),10);assert.equal(canonical(revoked.id),beforeRevocation);
 assert.equal(events(revoked.id),0);assert.equal(completions(revoked.id),0);
 await sign(a["green-editor"]);
 await openCase(revoked);
 await pickArcanum();
 await successful(revoked);
 for(const n of ["green-owner","green-editor","green-viewer"])
  assert.equal(origHist(a[n]),before[n]);
 console.log("PASS T44-UI-REVOKE: same-JWT revoked actor gets original v5 42501/HTTP403 in browser; separately authorized editor succeeds after real re-sign; no history overwrite");

 // Even when injected a review flag, a read-only linked account is denied
 // by original source-owned class-choice getter. We do NOT claim this bypasses
 // the actual CharacterClassPanel parent, which normally withholds the review.
 await sign(a["red-viewer"]);
 await openCase(red);
 const start=rpcCalls.length;
 await page.locator(".level-up-choice-form > .alert-danger").first().waitFor({timeout:35000});
 const alerts=await page.locator(".level-up-choice-form > .alert-danger").allInnerTexts();
 assert.ok(alerts.length>0);
 await page.getByRole("button",{name:"Apply Level 2"}).click();
 assert.equal(rpcCalls.length,start,"read-only UI must block submission after original option-fetch denial");
 assert.equal(events(red.id),1);
 assert.deepEqual(pageErrors,[],"Browser runtime exception in ORIGINAL component: "+JSON.stringify(pageErrors));
 assert.deepEqual(offsite,[],"Unexpected production/off-loopback Supabase traffic");
 assert.deepEqual(requestBad,[]);
 assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
 console.log("PASS T44-UI-READONLY: source-qualified options denied for linked read-only account, browser does not call v5; no browser exceptions or off-loopback Supabase");
 console.log("PASS T44 RESEARCH ONLY: actual unmodified Next CharacterLevelUpChoices + SourceChoiceFields signed original v5 RED/Option A GREEN, NOT full original review parent, class catalog, Forge or deploy");
} finally{
 if(browser)await browser.close().catch(()=>{});
 if(server){
  try{process.kill(-server.pid,"SIGTERM");}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
  try{process.kill(-server.pid,"SIGKILL");}catch{}
 }
 if(fs.existsSync(routePath))fs.rmSync(routePath);
 assert.ok(!fs.existsSync(routePath),"T44 disposable Next probe page survived cleanup");
}
