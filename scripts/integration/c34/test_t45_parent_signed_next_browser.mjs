#!/usr/bin/env node
// C34 T45-P1. SOURCE-ORIGINAL parent Level Up review, signed disposable PG17,
// real GoTrue/PostgREST and unchanged current Next.js/Chromium CharacterClassPanel.
// Does NOT install SQL or make network requests to hosted infrastructure.
// The existing P1.3 fixture's class-choice/caster helpers and catalogs are REDUCED.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import crypto,{randomUUID} from "node:crypto";
import {spawn,spawnSync} from "node:child_process";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {createClient} from "@supabase/supabase-js";

const env=process.env;
for(const [key,value] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_P13_LEVELUP_LOCAL_CONFIRM:"P13_SOURCE_V5_LOCAL_AUTH_ONLY",
  DNDNEXT_T45_PARENT_CONFIRM:"T45_ORIGINAL_REVIEW_PARENT_LOCAL_PG17"
}))assert.equal(env[key],value,"Unsafe T45 execution context "+key);
assert.equal(env.DNDNEXT_P13_LEVELUP_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_P13_LEVELUP_ANON_KEY);
assert.ok(env.C33_BROWSER_CHROME && path.isAbsolute(env.C33_BROWSER_CHROME));
assert.ok(env.C33_BROWSER_TOOL_ROOT && path.isAbsolute(env.C33_BROWSER_TOOL_ROOT));
assert.notEqual(env.VERCEL,"1");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const nextBin=path.join(root,"node_modules/next/dist/bin/next");
assert.ok(fs.existsSync(nextBin),"npm ci needed for real Next 16 parent");
const require=createRequire(path.join(env.C33_BROWSER_TOOL_ROOT,"t45-playwright-anchor.cjs"));
const {chromium}=require("playwright-core");
const gitBlob=b=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
const protectedSources={
 "components/CharacterClassPanel.js":"d39d2bceab944d3d4ec42cc2cfda92609ce51a2b",
 "components/CharacterLevelUpChoices.js":"3fa76acd1811a77b0c3e93711906bfb5afb17584",
 "sql/20260710_02_character_progression_foundation.sql":"b1b9781e06e9210a30c520b7f531bce7cbdbd82a",
 "sql/20260710_04_character_xp_level_up_review.sql":"81bce9bec9c59b3b673aeaada913cd054e4b74c7",
 "sql/20260710_07_transactional_level_up_completion.sql":"4a39927c667fab9a2dd87ef1785aadb785e47d38",
 "sql/20260808_15_level_up_review_fail_closed_choice_deltas.sql":"aa71d3dc8cad6e679bdd95b32f857207621597cb",
 "scripts/fixtures/p1_3_levelup_v5_local_auth_pg17.sql":"6619cc35a9e927696868bf13d3c8942116c9c8c3"
};
const src={};
for(const [p,sha] of Object.entries(protectedSources)){
 const b=fs.readFileSync(path.join(root,p));
 assert.equal(gitBlob(b),sha,"Refusing drift in original source: "+p);
 src[p]=b.toString();
}
assert.match(src["components/CharacterClassPanel.js"],/<CharacterLevelUpChoices character=\{character\} review=\{levelUpReview\}/);
function originalFunction(source,name){
 const match=source.toLowerCase().indexOf("create or replace function "+name.toLowerCase()+"(");
 assert.ok(match>=0,"Missing immutable original "+name);
 const remaining=source.slice(match);
 const term=/\n(?:\$\$|\$function\$);/i.exec(remaining);
 assert.ok(term,"Unterminated original "+name);
 return remaining.slice(0,term.index+term[0].length);
}
const q=id=>{assert.match(id,/^[a-f0-9-]{36}$/i);return "'"+id+"'";};
const lit=value=>"'"+String(value).replaceAll("'","''")+"'";
function sql(query){
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",query],{cwd:root,env,encoding:"utf8",timeout:35000});
 assert.equal(r.status,0,"T45 PG17-only SQL failure: "+String(r.stderr).slice(-1800));
 return r.stdout.trim();
}
const canonical=id=>sql("SELECT class_level||'|'||experience_points||'|'||pending_level_up FROM public.character_progression WHERE character_id="+q(id))+
 "|"+sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+q(id));
const session=id=>sql("SELECT COALESCE((SELECT id::text FROM public.character_level_up_sessions WHERE character_id="+q(id)+" AND status='open'),'') ");
const count=(id,type)=>Number(sql("SELECT count(*) FROM public.character_level_events WHERE character_id="+q(id)+" AND event_type="+lit(type)));
const rpc=async(who,name,id)=>who.rpc(name,{p_character_id:id});
const api=()=>createClient(env.DNDNEXT_P13_LEVELUP_URL,env.DNDNEXT_P13_LEVELUP_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});

assert.equal(sql("SELECT current_database()"),"postgres");
assert.match(sql("SHOW server_version"),/^17\./);
assert.equal(sql("SELECT to_regclass('private.p13_levelup_case_guard') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public.complete_character_level_up_v5(uuid,jsonb)') IS NOT NULL"),"t");
const originalV5Fingerprint=sql("SELECT md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))");

// Restore ONLY the source-original parent review functions. This isolated
// P1.3 fixture intentionally lacks production catalog columns; add those
// locally, never alter an original repository SQL file.
for(const col of [
 "edition text","primary_abilities text[] NOT NULL DEFAULT '{}'::text[]",
 "saving_throws text[] NOT NULL DEFAULT '{}'::text[]",
 "caster_progression text","summary text",
 "raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb"
])sql("ALTER TABLE public.class_catalog ADD COLUMN IF NOT EXISTS "+col);
for(const col of ["choices jsonb NOT NULL DEFAULT '[]'::jsonb",
 "raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb"])
 sql("ALTER TABLE public.class_level_progression ADD COLUMN IF NOT EXISTS "+col);
sql("ALTER TABLE public.character_level_up_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()");
sql("UPDATE public.class_level_progression SET raw_payload=jsonb_build_object('source','5etools_class_progression') WHERE class_level=2 AND class_id='00000000-0000-0000-0000-000000008201'");
sql("ALTER TABLE public.class_catalog ENABLE ROW LEVEL SECURITY");
sql("DROP POLICY IF EXISTS t45_catalog_reader ON public.class_catalog");
sql("CREATE POLICY t45_catalog_reader ON public.class_catalog FOR SELECT TO authenticated USING(true)");
sql("REVOKE ALL ON public.class_catalog FROM PUBLIC,anon");
sql("GRANT SELECT ON public.class_catalog TO authenticated");
const found=src["sql/20260710_02_character_progression_foundation.sql"];
const initial=src["sql/20260710_04_character_xp_level_up_review.sql"];
const latestRead=src["sql/20260710_07_transactional_level_up_completion.sql"];
const latestBegin=src["sql/20260808_15_level_up_review_fail_closed_choice_deltas.sql"];
const sources=[
 [found,["public.xp_threshold_for_level_v1","public.get_character_progression_v1"]],
 [latestRead,["private.highest_spell_level_from_slots_v1","private.level_has_feature_v1",
               "private.unsupported_level_choice_features_v1","public.get_character_level_up_review_v1"]],
 [initial,["public.can_manage_character_progression_v1","public.cancel_character_level_up_v1",
           "private.cancel_invalid_level_up_session_v1"]],
 [latestBegin,["public.begin_character_level_up_v1"]]
];
for(const [file,names] of sources)for(const name of names){
 sql(originalFunction(file,name));
 assert.ok(sql("SELECT pg_get_functiondef("+lit(name+"("+
  (name.endsWith("xp_threshold_for_level_v1")?"integer":
  name.endsWith("highest_spell_level_from_slots_v1")?"jsonb":
  name.endsWith("level_has_feature_v1")?"jsonb,text":
  name.endsWith("unsupported_level_choice_features_v1")?"jsonb":
  name.endsWith("cancel_invalid_level_up_session_v1")?"":"uuid")+")")+"::regprocedure)").toLowerCase().includes(name.toLowerCase()),
  "Original pg_get_functiondef missing "+name);
}
sql("DROP TRIGGER IF EXISTS cancel_invalid_level_up_session_v1 ON public.character_progression");
sql("CREATE TRIGGER cancel_invalid_level_up_session_v1 AFTER UPDATE OF class_level,pending_level_up ON public.character_progression FOR EACH ROW EXECUTE FUNCTION private.cancel_invalid_level_up_session_v1()");
for(const name of ["get_character_progression_v1","get_character_level_up_review_v1",
                   "can_manage_character_progression_v1","begin_character_level_up_v1",
                   "cancel_character_level_up_v1"]){
 sql("REVOKE ALL ON FUNCTION public."+name+"(uuid) FROM PUBLIC,anon");
 sql("GRANT EXECUTE ON FUNCTION public."+name+"(uuid) TO authenticated");
 assert.equal(sql("SELECT has_function_privilege('anon','public."+name+"(uuid)','EXECUTE')"),"f");
}
sql("REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated");
sql("NOTIFY pgrst,'reload schema'");
assert.equal(sql("SELECT md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))"),originalV5Fingerprint);
console.log("PASS T45-P1-ORIGINAL-SQL: original reader/can-manage/latest begin/latest review/cancel/trigger installed from pinned source; unchanged public v5, original class choice helpers reduced");

// The original P1.3 fixture deliberately installs the real can_manage
// source with a test-only always-false site-admin helper. Thus this suite tests
// can_edit owner/coeditor/linked-reader/outsider/anon, NOT revised GM/DM parity.
async function actor(label){
 const who=api(),email="t45-"+label+"-"+randomUUID()+"@example.invalid",password="LocalT45-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const user=await who.auth.getUser();
 assert.ifError(user.error);
 return {id:user.data.user.id,email,password,who};
}
const actors={};
for(const name of ["owner","editor","viewer","outsider"])actors[name]=await actor(name);
const id=randomUUID(),notReadyId=randomUUID(),foreignId=randomUUID();
const cls="'00000000-0000-0000-0000-000000008201'";
function character(characterId,name,owner,pending){
 sql("INSERT INTO public.characters(id,name,kind) VALUES("+q(characterId)+","+lit(name)+",'npc')");
 sql("INSERT INTO public.character_sheets(character_id,sheet) VALUES("+q(characterId)+","+
  lit(JSON.stringify({marker:"T45_CANONICAL_"+name,level:1,hp:12,maxHp:12}))+"::jsonb)");
 sql("INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,created_by) "+
  "VALUES("+q(characterId)+","+cls+",1,"+(pending?300:0)+","+(pending?"true":"false")+","+q(owner.id)+")");
}
character(id,"Parent Review Main",actors.owner,true);
character(notReadyId,"Threshold Not Reached",actors.owner,false);
character(foreignId,"Unrelated Canonical",actors.outsider,true);
for(const [who,allowed] of [[actors.owner,true],[actors.editor,true],[actors.viewer,false]]){
 sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES("+q(id)+","+q(who.id)+","+(allowed?"true":"false")+")");
}
sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES("+q(notReadyId)+","+q(actors.owner.id)+",true)");
sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES("+q(foreignId)+","+q(actors.outsider.id)+",true)");
for(const [name,user] of Object.entries(actors)){
 sql("INSERT INTO public.players(user_id,sheet) VALUES("+q(user.id)+","+
  lit(JSON.stringify({originalAccount:"T45_"+name,independent:true}))+"::jsonb)");
}
const originalHistory=Object.fromEntries(Object.entries(actors).map(([name,u])=>[name,
 sql("SELECT md5(sheet::text) FROM public.players WHERE user_id="+q(u.id))]));
const foreignCanonical=canonical(foreignId),before=canonical(id);
const anon=api();
for(const [caller,expected] of [[actors.owner,true],[actors.editor,true],
 [actors.viewer,false],[actors.outsider,false]]){
 const x=await rpc(caller.who,"can_manage_character_progression_v1",id);
 assert.ifError(x.error);assert.equal(x.data,expected,"Unexpected original editor ACL");
}
for(const [who,label] of [[actors.viewer,"linked reader"],[actors.outsider,"outsider"]]){
 for(const action of ["begin_character_level_up_v1","get_character_level_up_review_v1","cancel_character_level_up_v1"]){
  const x=await rpc(who.who,action,id);
  assert.ok(x.error,label+" must not call "+action);
  assert.equal(x.error.code,"42501");
 }
}
for(const action of ["get_character_progression_v1","can_manage_character_progression_v1",
 "begin_character_level_up_v1","get_character_level_up_review_v1","cancel_character_level_up_v1"]){
 const x=await rpc(anon,action,id);
 assert.ok(x.error,"anonymous unexpectedly called "+action);
}
const xpDenied=await rpc(actors.owner.who,"begin_character_level_up_v1",notReadyId);
assert.ok(xpDenied.error);
assert.match(xpDenied.error.message,/XP threshold/i);
assert.equal(session(notReadyId),"");
assert.equal(count(notReadyId,"level_up_review_started"),0);
const foreign=await rpc(actors.outsider.who,"get_character_progression_v1",id);
assert.ifError(foreign.error);
assert.equal(foreign.data?.progression?.character_id,id,
 "Original source reader cross-character observation changed; check privacy policy");
assert.equal(foreign.data?.xp?.current,300);
const viewer=await rpc(actors.viewer.who,"get_character_progression_v1",id);
assert.ifError(viewer.error);
assert.equal(viewer.data?.progression?.character_id,id);
console.log("PASS T45-P1-READER-VISIBILITY: disposable signed ORIGINAL SECURITY DEFINER progression reader returns foreign character XP/class to unrelated authenticated account; review remains 42501; privacy policy/release HOLD");
const initialReview=await rpc(actors.owner.who,"get_character_level_up_review_v1",id);
assert.ifError(initialReview.error);assert.equal(initialReview.data,null);
const begin=await rpc(actors.owner.who,"begin_character_level_up_v1",id);
assert.ifError(begin.error);
assert.equal(begin.data?.metadataReady,true);
assert.equal(begin.data?.canComplete,true);
const firstSession=begin.data.session.id;
assert.equal(session(id),firstSession);
assert.equal(count(id,"level_up_review_started"),1);
assert.equal(canonical(id),before);
const repeat=await rpc(actors.editor.who,"begin_character_level_up_v1",id);
assert.ifError(repeat.error);assert.equal(repeat.data.session.id,firstSession);
assert.equal(count(id,"level_up_review_started"),1);
const review=await rpc(actors.editor.who,"get_character_level_up_review_v1",id);
assert.ifError(review.error);
assert.equal(review.data.session.id,firstSession);
assert.equal(review.data.canComplete,true);
assert.equal(canonical(id),before);
console.log("PASS T45-P1-SESSION: XP pending, original latest begin/get, session-id stable across authorized actor, one start event, no pre-Apply canonical write");

const probe="pages/__c34_t45_parent_probe.jsx",probePath=path.join(root,probe);
assert.ok(!fs.existsSync(probePath),"Refuse overwriting existing Next page");
const probeSource=[
 'import {useEffect,useState} from "react";',
 'import dynamic from "next/dynamic";',
 'import {supabase} from "../utils/supabaseClient";',
 'const ClassPanel=dynamic(()=>import("../components/CharacterClassPanel"),{ssr:false});',
 'export default function T45ParentProbe(){',
 ' const [entry,setEntry]=useState(null);',
 ' useEffect(()=>{window.__t45sb=supabase;window.__t45open=(next)=>setEntry({...next,nonce:(window.__t45nonce=(window.__t45nonce||0)+1)});},[]);',
 ' return <main data-testid="t45-real-parent" style={{background:"#171927",color:"#eeeeee",padding:24,minHeight:"100vh"}}>',
 '  <h1>T45 unchanged original parent, server-returned review only</h1>',
 '  {entry?<ClassPanel key={entry.id+"-"+entry.nonce} character={{id:entry.id,name:entry.name}} isAdmin={false}/>:<p>Not mounted</p>}',
 ' </main>;',
 '}'
].join("\n");
let browser=null,server=null,serverLog="";
const pageErrors=[],offsite=[],observedRpcs=[],responseData=[];
async function port(){
 return new Promise((resolve,reject)=>{
  const s=net.createServer();s.once("error",reject);
  s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p));});
 });
}
try{
 fs.writeFileSync(probePath,probeSource,{flag:"wx"});
 const number=await port(),origin="http://127.0.0.1:"+number;
 server=spawn(process.execPath,[nextBin,"dev","--webpack","-H","127.0.0.1","-p",String(number)],{
  cwd:root,detached:true,stdio:["ignore","pipe","pipe"],
  env:{...env,NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_P13_LEVELUP_URL,
       NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_P13_LEVELUP_ANON_KEY,
       NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1"}
 });
 for(const stream of [server.stdout,server.stderr])stream.on("data",part=>{serverLog=(serverLog+part.toString()).slice(-25000);});
 let ready=false;
 for(let k=0;k<110;k++){
  if(server.exitCode!==null)throw Error("T45 Next server exit "+serverLog);
  try{
   const resp=await fetch(origin+"/__c34_t45_parent_probe",{signal:AbortSignal.timeout(2800)});
   if(resp.ok && (await resp.text()).includes("t45-real-parent")){ready=true;break;}
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,1200));
 }
 assert.ok(ready,"Original parent failed Next webpack build: "+serverLog);
 browser=await chromium.launch({headless:true,executablePath:env.C33_BROWSER_CHROME,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:1400,height:960}});
 const page=await context.newPage();
 page.on("pageerror",err=>pageErrors.push(err.message));
 page.on("request",request=>{
  const x=request.url();
  if(x.includes("/rest/v1/rpc/")){
   const name=x.split("/rest/v1/rpc/")[1].split("?")[0];
   observedRpcs.push(name);
  }
 });
 page.on("response",async resp=>{
  const u=resp.url();
  if(u.includes("/rest/v1/rpc/get_character_level_up_review_v1") && resp.ok()){
   try{responseData.push(await resp.json());}catch{}
  }
 });
 await page.route("**/*",route=>{
  const u=route.request().url();
  if(u.startsWith(origin)||u.startsWith(env.DNDNEXT_P13_LEVELUP_URL)||
     u.startsWith("ws://127.0.0.1:"))return route.continue();
  offsite.push(u.slice(0,150));
  return route.abort();
 });
 await page.goto(origin+"/__c34_t45_parent_probe",{waitUntil:"domcontentloaded",timeout:90000});
 await page.waitForFunction(()=>!!window.__t45sb && !!window.__t45open,null,{timeout:90000});
 async function sign(actor){
  const value=await page.evaluate(async credentials=>{
   await window.__t45sb.auth.signOut();
   const result=await window.__t45sb.auth.signInWithPassword(credentials);
   if(result.error)throw Error(result.error.message);
   return result.data.user.id;
  },{email:actor.email,password:actor.password});
  assert.equal(value,actor.id);
 }
 async function open(){
  await page.evaluate(entry=>window.__t45open(entry),{id,name:"Parent Review Main"});
  await page.locator(".class-summary-card").waitFor({state:"visible",timeout:35000});
  await page.getByText("Level up ready").waitFor({state:"visible",timeout:35000});
 }
 await sign(actors.owner);await open();
 await page.locator(".class-level-up-review").waitFor({state:"visible",timeout:35000});
 assert.ok(responseData.some(data=>data?.session?.id===firstSession),
  "Real parent must fetch original server-backed review session (NO synthetic review prop)");
 await page.getByRole("button",{name:"Refresh",exact:true}).click();
 await page.locator(".class-level-up-review").waitFor({state:"visible",timeout:35000});
 assert.equal(session(id),firstSession);
 await page.getByRole("button",{name:"Refresh Level-Up Review"}).click();
 await page.getByText("Level-up review opened. No character values have been changed yet.").waitFor({timeout:35000});
 assert.equal(session(id),firstSession);
 assert.equal(count(id,"level_up_review_started"),1);
 await page.reload({waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>!!window.__t45sb && !!window.__t45open,null,{timeout:50000});
 await sign(actors.owner);await open();
 await page.locator(".class-level-up-review").waitFor({state:"visible",timeout:35000});
 assert.equal(session(id),firstSession);
 console.log("PASS T45-P1-REAL-PARENT: actual Next CharacterClassPanel fetches original progression/access/review RPC and server SESSION across refresh and hard reload");

 await page.getByRole("button",{name:"Cancel review"}).click();
 await page.getByText("Level-up review cancelled. XP and level were not changed.").waitFor({timeout:35000});
 assert.equal(session(id),"");
 assert.equal(count(id,"level_up_review_cancelled"),1);
 assert.equal(canonical(id),before);
 await page.getByRole("button",{name:"Review Level Up"}).click();
 await page.locator(".class-level-up-review").waitFor({state:"visible",timeout:35000});
 const secondSession=session(id);
 assert.ok(secondSession && secondSession!==firstSession);
 assert.equal(count(id,"level_up_review_started"),2);
 assert.equal(canonical(id),before);
 console.log("PASS T45-P1-PARENT-CANCEL-REOPEN: genuine UI cancel and begin original RPC, new session, frozen canonical class/XP/sheet");

 await sign(actors.editor);await open();
 await page.locator(".class-level-up-review").waitFor({state:"visible",timeout:35000});
 assert.equal(session(id),secondSession);
 await sign(actors.viewer);await open();
 await page.getByText("Level up ready").waitFor({state:"visible",timeout:35000});
 assert.equal(await page.getByRole("button",{name:"Review Level Up"}).count(),0);
 assert.equal(await page.locator(".class-level-up-review").count(),0);
 await sign(actors.outsider);await open();
 assert.equal(await page.getByRole("button",{name:"Review Level Up"}).count(),0);
 assert.equal(await page.locator(".class-level-up-review").count(),0);
 console.log("PASS T45-P1-PARENT-ROLES: linked editor sees server review, linked read-only and outsider see original progression but no gated review");

 await sign(actors.owner);await open();
 await page.locator(".class-level-up-review").waitFor({state:"visible",timeout:35000});
 sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+q(id)+
  " AND user_id="+q(actors.owner.id));
 const revoked=await rpc(actors.owner.who,"begin_character_level_up_v1",id);
 assert.ok(revoked.error);assert.equal(revoked.error.code,"42501");
 await page.getByRole("button",{name:"Refresh",exact:true}).click();
 await page.getByText("Level up ready").waitFor({state:"visible",timeout:35000});
 assert.equal(await page.getByRole("button",{name:"Review Level Up"}).count(),0);
 assert.equal(await page.locator(".class-level-up-review").count(),0);
 await sign(actors.editor);await open();
 await page.locator(".class-level-up-review").waitFor({state:"visible",timeout:35000});
 const editorReview=await rpc(actors.editor.who,"get_character_level_up_review_v1",id);
 assert.ifError(editorReview.error);assert.equal(editorReview.data.session.id,secondSession);
 console.log("PASS T45-P1-REVOCATION: same JWT former owner denied by source original after can_edit revoke; authorized editor reads unchanged review");

 sql("UPDATE public.character_progression SET pending_level_up=false WHERE character_id="+q(id));
 assert.equal(session(id),"","Original after-update trigger must invalidate stale open session");
 assert.equal(sql("SELECT status FROM public.character_level_up_sessions WHERE id="+q(secondSession)),"cancelled");
 await page.getByRole("button",{name:"Refresh",exact:true}).click();
 await page.locator(".class-summary-card").waitFor({state:"visible",timeout:35000});
 assert.equal(await page.locator(".class-level-up-review").count(),0);
 const after=canonical(id);
 assert.equal(after,before.replace("|true|","|false|"),"Only intentional fixture pending flag changed");
 assert.equal(canonical(foreignId),foreignCanonical);
 for(const [name,user] of Object.entries(actors))
  assert.equal(sql("SELECT md5(sheet::text) FROM public.players WHERE user_id="+q(user.id)),originalHistory[name],
   "T45 inadvertently changed another account's historical snapshot");
 assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
 assert.ok(observedRpcs.includes("get_character_progression_v1"));
 assert.ok(observedRpcs.includes("can_manage_character_progression_v1"));
 assert.ok(observedRpcs.includes("get_character_level_up_review_v1"));
 assert.ok(observedRpcs.includes("begin_character_level_up_v1"));
 assert.ok(observedRpcs.includes("cancel_character_level_up_v1"));
 assert.deepEqual(pageErrors,[],"T45 unchanged original parent threw browser errors");
 assert.deepEqual(offsite,[],"T45 blocked all non-loopback browser traffic");
 assert.equal(sql("SELECT md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))"),originalV5Fingerprint);
 console.log("PASS T45-P1-INVALIDATE: ORIGINAL progression AFTER UPDATE cancels stale session; Next refresh removes review, all canonical unrelated rows and independent account histories frozen");
 console.log("PASS T45-P1-HOLD: original parent/review lifecycle signed under reduced local Fighter metadata; outsider progression visible in genuine original source test, OWNER VISIBILITY POLICY OPEN; NO production or release");
}finally{
 if(browser)await browser.close().catch(()=>{});
 if(server){
  try{process.kill(-server.pid,"SIGTERM");}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
  try{process.kill(-server.pid,"SIGKILL");}catch{}
 }
 if(fs.existsSync(probePath))fs.rmSync(probePath);
 assert.ok(!fs.existsSync(probePath),"Disposable original Next probe survived teardown");
}
