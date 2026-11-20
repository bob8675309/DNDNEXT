#!/usr/bin/env node
// C34 T46-P3-P2B: signed current Sheet print revoke RED vs temporary server checked candidate GREEN
// C34 non-map NPC research shell against exact held #345 Stage1/2/3 PRIVACY SQL,
// combined with source-derived T46 research-only character progression disclosure.
// Signed local PostgreSQL17/GoTrue/PostgREST; NO live data and no production route.
// This is a bounded candidate acceptance, NOT original full 31-trigger or release.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import crypto,{randomUUID} from "node:crypto";
import {spawn,spawnSync} from "node:child_process";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {createClient} from "@supabase/supabase-js";
import {PDFDocument} from "pdf-lib";

const env=process.env;
for(const [key,value] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 DNDNEXT_T46_P2_LOCAL_CONFIRM:"T46_P2_EXACT_PRIVACY_REAL_NEXT_SIGNED_ONLY"
}))assert.equal(env[key],value,"Refuse non-disposable T46-P2 execution "+key);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.ok(env.C33_BROWSER_CHROME&&path.isAbsolute(env.C33_BROWSER_CHROME));
assert.ok(env.C33_BROWSER_TOOL_ROOT&&path.isAbsolute(env.C33_BROWSER_TOOL_ROOT));
assert.notEqual(env.VERCEL,"1");

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const nextBin=path.join(root,"node_modules/next/dist/bin/next");
assert.ok(fs.existsSync(nextBin),"Pinned Next.js npm ci required");
const require=createRequire(path.join(env.C33_BROWSER_TOOL_ROOT,"t46-p2-playwright-anchor.cjs"));
const {chromium}=require("playwright-core");
const gitBlob=b=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
const immutable={
 "scripts/integration/c34/fixtures/forge_creation_replay_local_auth_pr351_pg17.sql":"aa701c679712475cd4f04d4e0a01fedc4616bafa",
 "scripts/fixtures/c33_forge_privacy_original_policy_join_pg17.sql":"12612c4acbe861817037e1ab5a79ddb7c40a55e9",
 "scripts/integration/c34/sources/02_npc_profile_stage1.sql":"9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3",
 "scripts/integration/c34/sources/03_npc_dossier_stage2.sql":"afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac",
 "scripts/integration/c34/sources/04_private_story_stage3.sql":"01e48823ac3a46aa5880e98200e97c2595501ce7",
 "scripts/integration/c34/candidates/t46_progression_visibility_discovery_pg17.sql":"fe2f8ee1bd694601912e28a03ccf3e9a6df4adaa",
 "sql/20260710_02_character_progression_foundation.sql":"b1b9781e06e9210a30c520b7f531bce7cbdbd82a",
 "sql/20260710_04_character_xp_level_up_review.sql":"81bce9bec9c59b3b673aeaada913cd054e4b74c7",
 "components/CharacterClassPanel.js":"d39d2bceab944d3d4ec42cc2cfda92609ce51a2b",
 "components/c34/NonMapNpcProfileResearchShell.jsx":"8ddd3c451449cbd8aa256d237f1f17902e614b98",
 "utils/c34/readNonMapNpcProfileCandidate.mjs":"80501d106db9788c466ab39e63a2f6c062a9b0a7"
};
const original={};
for(const [p,sha] of Object.entries(immutable)){
 const b=fs.readFileSync(path.join(root,p));
 assert.equal(gitBlob(b),sha,"Refusing original #345/current source drift "+p);
 original[p]=b.toString();
}
const own=(obj,k)=>Object.prototype.hasOwnProperty.call(obj,k);
const q=id=>{assert.match(id,/^[0-9a-f-]{36}$/i);return "'"+id+"'";};
const lit=v=>"'"+String(v).replaceAll("'","''")+"'";
function sql(query){
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",query],{cwd:root,env,encoding:"utf8",timeout:35000});
 assert.equal(r.status,0,"T46-P2 disposable PG17 statement failed: "+String(r.stderr).slice(-2300));
 return r.stdout.trim();
}
function fn(src,name) {
 const idx=src.toLowerCase().indexOf("create or replace function "+name.toLowerCase()+"(");
 assert.ok(idx>=0,"Missing original/research function "+name);
 const rem=src.slice(idx),term=/\n(?:\$\$|\$function\$|\$fn\$);/i.exec(rem);
 assert.ok(term,"Unterminated source function "+name);
 return rem.slice(0,term.index+term[0].length);
}
async function actor(label,role){
 const who=createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const email="t46-p2-"+label+"-"+randomUUID()+"@example.invalid";
 const password="T46P2-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const result=await who.auth.getUser();assert.ifError(result.error);
 sql("INSERT INTO public.user_profiles(id,role) VALUES("+q(result.data.user.id)+","+lit(role)+")");
 return {id:result.data.user.id,role,email,password,who};
}
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const invoke=(who,name,args)=>who.rpc(name,args);
const get=(who,id)=>invoke(who,"get_character_progression_v1",{p_character_id:id});
const discover=(who,id)=>invoke(who,"c34_t46_get_progression_discoveries_v1",{p_character_id:id});
const setDiscovery=(who,cid,viewer,key,revealed,source="gm_direct")=>
 invoke(who,"c34_t46_set_progression_discovery_v1",{
 p_character_id:cid,p_viewer_user_id:viewer,p_field_key:key,p_revealed:revealed,p_source:source,p_note:"GM adjudicated in disposable browser fixture"
 });
const guardDenied=(result,msg)=>{
 assert.ok(result.error,msg+" unexpectedly permitted");
 assert.equal(result.error.code,"42501",msg+" response: "+JSON.stringify(result.error));
};
assert.equal(sql("SELECT current_database()"),"postgres");
assert.match(sql("SHOW server_version"),/^17\./);
assert.equal(sql("SELECT to_regclass('private.character_creator_attribution') IS NOT NULL"),"t",
 "Expected exact #345 Stage3 installed before T46-P2");
assert.equal(sql("SELECT to_regclass('public.character_public_secret_revelations') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public.get_npc_dossier_admin_v1(uuid)') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
assert.equal(sql("SELECT (SELECT qual LIKE '%can_access_character_v1%' FROM pg_policies "+
 "WHERE schemaname='public' AND tablename='character_sheets' "+
 "AND policyname='character_sheets_select_visible_or_assigned')"),"t");
console.log("PASS T46-P2-ORIGINAL-PR345: all exact original #345 Stage1/2/3 functions, RLS, creator backstory and curated GM-only public clue installed in same disposable PG17");

// The #345 fixture has source-shaped reduced class tables and an original
// non-production private.test_admins helper. Add ONLY columns needed to install
// source-original July progression reader and current Class parent.
for(const c of ["edition text","primary_abilities text[] NOT NULL DEFAULT '{}'::text[]",
  "saving_throws text[] NOT NULL DEFAULT '{}'::text[]","caster_progression text",
  "summary text","raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb"]){
 sql("ALTER TABLE public.class_catalog ADD COLUMN IF NOT EXISTS "+c);
}
for(const c of ["cantrips_known integer","spells_known integer",
 "features jsonb NOT NULL DEFAULT '[]'::jsonb",
 "choices jsonb NOT NULL DEFAULT '[]'::jsonb",
 "raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb"]){
 sql("ALTER TABLE public.class_level_progression ADD COLUMN IF NOT EXISTS "+c);
}
const srcFoundation=original["sql/20260710_02_character_progression_foundation.sql"];
const srcReview=original["sql/20260710_04_character_xp_level_up_review.sql"];
const stage=original["scripts/integration/c34/candidates/t46_progression_visibility_discovery_pg17.sql"];
// Local role table+source-derived exact-role predicate; no hosted helper drift.
sql("CREATE TABLE IF NOT EXISTS public.user_profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),role text NOT NULL DEFAULT 'player')");
sql("ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY");
sql("REVOKE ALL ON public.user_profiles FROM PUBLIC,anon,authenticated");
sql(fn(stage,"private.current_user_is_admin"));
assert.equal(sql("SELECT pg_get_functiondef('private.current_user_is_admin()'::regprocedure) LIKE '%IN (''admin'', ''gm'', ''dm'')%'"),"t");
sql(fn(srcFoundation,"private.can_manage_character_progression_v1"));
sql(fn(srcFoundation,"public.xp_threshold_for_level_v1"));
sql(fn(srcReview,"public.can_manage_character_progression_v1"));
sql(fn(stage,"public.get_character_progression_v1"));
const tableStart=stage.indexOf("CREATE TABLE private.c34_t46_progression_discoveries");
const tableEnd=stage.indexOf("\nCREATE OR REPLACE FUNCTION public.c34_t46_set_progression_discovery_v1",tableStart);
assert.ok(tableStart>0&&tableEnd>tableStart,"Original scoped T46 discovery table section drift");
sql(stage.slice(tableStart,tableEnd));
sql(fn(stage,"public.c34_t46_set_progression_discovery_v1"));
sql(fn(stage,"public.c34_t46_get_progression_discoveries_v1"));
for(const name of ["get_character_progression_v1","can_manage_character_progression_v1",
 "c34_t46_get_progression_discoveries_v1"]){
 sql("REVOKE ALL ON FUNCTION public."+name+"(uuid) FROM PUBLIC,anon");
 sql("GRANT EXECUTE ON FUNCTION public."+name+"(uuid) TO authenticated");
}
sql("REVOKE ALL ON FUNCTION public.c34_t46_set_progression_discovery_v1(uuid,uuid,text,boolean,text,text) FROM PUBLIC,anon");
sql("GRANT EXECUTE ON FUNCTION public.c34_t46_set_progression_discovery_v1(uuid,uuid,text,boolean,text,text) TO authenticated");
sql("ALTER TABLE public.character_progression ENABLE ROW LEVEL SECURITY");
sql("REVOKE ALL ON public.character_progression,public.character_level_events FROM PUBLIC,anon,authenticated");
sql("ALTER TABLE public.class_catalog ENABLE ROW LEVEL SECURITY");
sql("CREATE POLICY t46_p2_class_catalog ON public.class_catalog FOR SELECT TO authenticated USING(true)");
sql("GRANT SELECT ON public.class_catalog TO authenticated");
sql("NOTIFY pgrst,'reload schema'");
assert.equal(sql("SELECT pg_get_functiondef('public.get_character_progression_v1(uuid)'::regprocedure) ILIKE '%if not private.can_manage_character_progression_v1%'"),"t");
console.log("PASS T46-P2-PROGRESSION-OVERLAY: source-original full JSON/XP reader plus ONE can_manage gate, exact T46 signed per-viewer sanitized discovery, scratch GM aliases, no active app schema/code changes");

// Genuine local signed accounts and source Stage3 GM pub/sub permissions.
const actors={};
for(const [name,role] of [["GM","gm"],["ADMIN","admin"],["DM","dm"],
 ["EDITOR","player"],["VIEWER","player"],["OUTSIDER","player"],["OTHER","player"]])
 actors[name]=await actor(name,role);
const ids={npc:randomUUID(),merchant:randomUUID(),hidden:randomUUID(),privatePc:randomUUID()};
function seed(id,name,kind,isHidden,xp,pc=false){
 const secret="T46_PRIVATE_GM_"+name.replaceAll(" ","_");
 const marker="T46_CANONICAL_PRIVATE_"+name.replaceAll(" ","_");
 const tags=pc?"ARRAY['player-character']::text[]":"'{}'::text[]";
 sql("INSERT INTO public.characters(id,name,kind,description,background,secret,is_hidden,tags) VALUES("+
  q(id)+","+lit(name)+","+lit(kind)+","+lit("This is approved public description for "+name)+
  ",'T46 REVEALABLE BACKGROUND',"+lit(secret)+","+(isHidden?"true":"false")+","+tags+")");
 const sheet={classKey:"fighter",level:1,xp,marker,
   gmNotes:"T46 NEVER PUBLIC NOTE",profileReveal:{background:true,secret:true}};
 sql("INSERT INTO public.character_sheets(character_id,sheet) VALUES("+q(id)+","+
  lit(JSON.stringify(sheet))+"::jsonb)");
 sql("INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,created_by) VALUES("+
  q(id)+",'00000000-0000-0000-0000-000000000001',1,"+xp+",false,"+q(actors.GM.id)+") "+
  "ON CONFLICT(character_id) DO UPDATE SET class_id=excluded.class_id,class_level=excluded.class_level,experience_points=excluded.experience_points,pending_level_up=excluded.pending_level_up");
 sql("INSERT INTO public.character_level_events(character_id,event_type,details,created_by) VALUES("+
  q(id)+",'gm_only_event',"+lit(JSON.stringify({privateNote:"T46_LEVEL_EVENT_NOT_PUBLIC"}))+"::jsonb,"+q(actors.GM.id)+")");
 return {secret,marker};
}
const fixtures={
 npc:seed(ids.npc,"T46 Arcane Scholar","npc",false,1300),
 merchant:seed(ids.merchant,"T46 Curio Merchant","merchant",false,450),
 hidden:seed(ids.hidden,"T46 Hidden Informant","npc",true,500),
 privatePc:seed(ids.privatePc,"T46 Private Player","npc",false,300,true)
};
for(const role of ["EDITOR","VIEWER"])
 sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) VALUES("+
  q(ids.npc)+","+q(actors[role].id)+","+(role==="EDITOR"?"true":"false")+",false,false)");
const canonical=id=>sql("SELECT md5(s.sheet::text)||'|'||p.class_level||'|'||p.experience_points FROM public.character_sheets s JOIN public.character_progression p ON p.character_id=s.character_id WHERE s.character_id="+q(id));
const snapshots=Object.fromEntries(Object.entries(ids).map(([name,id])=>[name,canonical(id)]));
for(const [name,role] of Object.entries(actors)){
 const c=await get(role.who,ids.npc);
 if(["ADMIN","GM","DM","EDITOR"].includes(name)){assert.ifError(c.error);assert.equal(c.data?.progression?.experience_points,1300);}
 else guardDenied(c,"Original source full progression "+name);
}
const outsider=actors.OUTSIDER;
const safe=await outsider.who.rpc("get_npc_profile_visible_v1",{p_character_id:ids.npc});
assert.ifError(safe.error);
assert.equal(safe.data?.name,"T46 Arcane Scholar");
assert.ok(!JSON.stringify(safe.data).includes(fixtures.npc.secret));
assert.ok(!JSON.stringify(safe.data).includes(fixtures.npc.marker));
const sheetDenied=await outsider.who.from("character_sheets").select("sheet").eq("character_id",ids.npc).maybeSingle();
assert.ifError(sheetDenied.error);assert.equal(sheetDenied.data,null);
const gmPub=await actors.GM.who.from("character_public_secret_revelations").insert({
 character_id:ids.npc,public_text:"A safe published clue: rumored to study in Gray Hall",is_revealed:true
});
assert.ifError(gmPub.error);
const approved=await outsider.who.rpc("get_npc_profile_visible_v1",{p_character_id:ids.npc});
assert.ifError(approved.error);
assert.match(approved.data?.lore?.secret||"",/safe published clue/);
assert.ok(!JSON.stringify(approved.data).includes(fixtures.npc.secret));
assert.equal((await discover(outsider.who,ids.npc)).data,null);
guardDenied(await setDiscovery(outsider.who,ids.npc,outsider.id,"class",true),"Untrusted self-approved dialogue outcome");
assert.ifError((await setDiscovery(actors.GM.who,ids.npc,outsider.id,"class",true,"dialogue")).error);
assert.equal((await discover(outsider.who,ids.npc)).data?.class?.name,"Fighter");
assert.equal((await discover(actors.OTHER.who,ids.npc)).data,null);
console.log("PASS T46-P2-SIGNED-COMBINED: ORIGINAL #345 Stage3 safe public Profile/approved GM clue with T46 exact player-scoped class revelation, original private GM Secret, XP/events/Sheet isolated");

const pageSource="import {useEffect,useRef,useState} from \"react\";\nimport dynamic from \"next/dynamic\";\nimport {supabase} from \"../utils/supabaseClient\";\nconst Actual=dynamic(()=>import(\"../components/character/CharacterInteractionPanel\"),{ssr:false});\nexport default function SourceProbe(){\nconst [uid,setUid]=useState(null),[selected,setSelected]=useState(\"\"),[kind,setKind]=useState(\"npc\"),[epoch,setEpoch]=useState(0);\nconst prev=useRef(null);\nuseEffect(()=>{const {data}=supabase.auth.onAuthStateChange((e,session)=>{\n const now=session?.user?.id||null,changed=prev.current!==now;prev.current=now;setUid(now);\n if(changed||e===\"SIGNED_OUT\"){setSelected(\"\");setEpoch(v=>v+1);}\n});\nwindow.__t46p3={\n login:async(email,password)=>{const r=await supabase.auth.signInWithPassword({email,password});if(r.error)throw Error(r.error.message);return r.data.user?.id;},\n logout:async()=>{const r=await supabase.auth.signOut();if(r.error)throw Error(r.error.message);return true;},\n choose:(id,k=\"npc\")=>{setSelected(id);setKind(k);setEpoch(v=>v+1);return true;},\n refresh:()=>{setEpoch(v=>v+1);return true;}\n};return()=>{data?.subscription?.unsubscribe();delete window.__t46p3};},[]);\nreturn <main data-testid=\"t46-p3-current-next\" className=\"container py-3\">\n<h1>Actual current source NPC/interaction, disposable signed negative</h1>\n{!uid?<p data-testid=\"t46-p3-signed-out\">Signed out; no panel mounted</p>:\n !selected?<p>No selected NPC</p>:\n <section key={uid+\":\"+selected+\":\"+epoch} data-testid=\"t46-p3-original-active\">\n  <Actual npc={{id:selected,kind}} initialView=\"profile\" isAdmin={false} onClose={()=>setSelected(\"\")}/>\n </section>}\n</main>;\n}";


// Exact unmodified held #345 original source is included as nonimported
// research fixtures. The *runner*, never the commit, temporarily replaces the
// ACTIVE checkout component, then restores it in finally even on test failure.
const secureSourcePath=path.join(root,"scripts/integration/c34/sources/05_original_pr345_NpcPanel.js");
const creatorSourcePath=path.join(root,"scripts/integration/c34/sources/06_original_pr345_CreatorBackstoryPanel.js");
const activeNpcSourcePath=path.join(root,"components/NpcPanel.js");
const activeCreatorPath=path.join(root,"components/CreatorBackstoryPanel.js");
assert.equal(gitBlob(fs.readFileSync(secureSourcePath)),
 "606db96649dcdf6646afbd4d24f67a6fc54426eb",
 "No modified original held PR #345 NPC panel candidate");
assert.equal(gitBlob(fs.readFileSync(creatorSourcePath)),
 "23b0e86aab7a80b7243365ba107c1d37a5ec5812",
 "No modified original held PR #345 CreatorBackstoryPanel candidate");
assert.ok(!fs.existsSync(activeCreatorPath),"Original current branch unexpectedly contains CreatorBackstoryPanel");
const originalActiveNpcBytes=fs.readFileSync(activeNpcSourcePath);
const currentSheetPanelPath=path.join(root,"components/CharacterSheetPanel.js");
const originalSheetPanelBytes=fs.readFileSync(currentSheetPanelPath);
assert.equal(gitBlob(originalSheetPanelBytes),"cb3511bf25a97be3a07c6e5d93ee62bb16570327");
let secureOverlayActive=false,creatorOverlayActive=false,sheetGuardApplied=false;

const routeFile="pages/__c34_t46_p3_current_active_probe.jsx",routePath=path.join(root,routeFile);
assert.ok(!fs.existsSync(routePath),"Refuse overwriting any existing route");
const active={
 "components/NpcPanel.js":"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db",
 "components/character/CharacterInteractionPanel.js":"28a2dde5696376ee39c01a498b76a146f30aaffa",
 "components/CharacterSheetPanel.js":"cb3511bf25a97be3a07c6e5d93ee62bb16570327",
 "pages/npcs.js":"7fc00b9b3ace6233d1648a3d017f8a05e072d722",
 "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a"
};
for(const [name,sha] of Object.entries(active))
 assert.equal(gitBlob(fs.readFileSync(path.join(root,name))),sha,"Current original consumer drift "+name);
let server=null,browser=null,serverLog="";
const pageErrors=[],offsite=[],requests=[];
async function freePort(){return new Promise((resolve,reject)=>{
 const s=net.createServer();s.once("error",reject);
 s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p));});
});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 fs.writeFileSync(routePath,pageSource,{flag:"wx"});
 const port=await freePort(),origin="http://127.0.0.1:"+port;
 server=spawn(process.execPath,[nextBin,"dev","--webpack","-H","127.0.0.1","-p",String(port)],{
  cwd:root,detached:true,stdio:["ignore","pipe","pipe"],
  env:{...env,NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
   NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1"}
 });
 for(const stream of [server.stdout,server.stderr])
  stream.on("data",x=>{serverLog=(serverLog+x.toString()).slice(-25000)});
 let ready=false;
 for(let n=0;n<110;n++){
  if(server.exitCode!==null)throw Error("Next source crash "+serverLog);
  try{
   const r=await fetch(origin+"/__c34_t46_p3_current_active_probe",{signal:AbortSignal.timeout(2900)});
   if(r.ok&&(await r.text()).includes("t46-p3-current-next")){ready=true;break}
  }catch{}
  await sleep(1250);
 }
 assert.ok(ready,"Actual current component probe did not compile "+serverLog);
 browser=await chromium.launch({headless:true,executablePath:env.C33_BROWSER_CHROME,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 const ctx=await browser.newContext({viewport:{width:1440,height:980}});
 const page=await ctx.newPage();
 // Capture only the BLOB built by the REAL unchanged CharacterSheetPanel's
 // Print Sheet button, without modifying the component or mocking pdf-lib.
 // Browser still creates its genuine popup and blob URL.
 await page.addInitScript(()=>{
  const originalCreate=URL.createObjectURL.bind(URL);
  URL.createObjectURL=function(blob){
   if(blob instanceof Blob&&blob.type==="application/pdf")
    window.__c34LastActualPrintBlob=blob;
   return originalCreate(blob);
  };
 });
 page.on("pageerror",e=>pageErrors.push(e.message));
 page.on("request",req=>{
  const u=req.url();
  if(u.includes("/rest/v1/"))requests.push({url:u,method:req.method()});
 });
 await page.route("**/*",route=>{
  const u=route.request().url();
  if(u.startsWith(origin)||u.startsWith(env.DNDNEXT_C34_LOCAL_URL)||
     u.startsWith("ws://127.0.0.1:"+port))return route.continue();
  offsite.push(u.slice(0,180));return route.abort();
 });
 await page.goto(origin+"/__c34_t46_p3_current_active_probe",{waitUntil:"domcontentloaded",timeout:90000});
 await page.waitForFunction(()=>!!window.__t46p3,null,{timeout:90000});
 const op=(action,...args)=>page.evaluate(async({action,args})=>{
  const fn=window.__t46p3?.[action];if(typeof fn!=="function")throw Error(action+" missing");
  return fn(...args);
 },{action,args});
 const login=async name=>assert.equal(await op("login",actors[name].email,actors[name].password),actors[name].id);

 async function clickRealPrintAndValidatePdf(label){
  await page.evaluate(()=>{window.__c34LastActualPrintBlob=null;});
  const button=page.getByRole("button",{name:"Print Sheet"});
  await button.waitFor({timeout:35000});
  await page.waitForFunction(()=>{
   const btn=Array.from(document.querySelectorAll("button"))
    .find(x=>x.textContent?.trim()==="Print Sheet");
   return !!btn&&!btn.disabled;
  },null,{timeout:35000});
  const popupPromise=ctx.waitForEvent("page",{timeout:25000});
  await button.click();
  const popup=await popupPromise;
  await page.waitForFunction(()=>window.__c34LastActualPrintBlob?.size>1000,null,{timeout:70000});
  const bytes=await page.evaluate(async()=>{
   const blob=window.__c34LastActualPrintBlob;
   return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  assert.ok(bytes.length>15000,label+" real Sheet PDF bytes too small");
  assert.equal(String.fromCharCode(...bytes.slice(0,5)),"%PDF-",label+" not PDF");
  const result=await PDFDocument.load(Uint8Array.from(bytes),{ignoreEncryption:true});
  assert.equal(result.getPageCount(),3,label+" not exactly 3 official pages");
  assert.match(result.getTitle()||"",/T46 Arcane Scholar.*DNDNext Character Sheet/i,
   label+" wrong canonical printed actor");
  await popup.close().catch(()=>{});
  console.log("PASS "+label+": real unchanged CharacterSheetPanel Print Sheet onClick -> original official pdf-lib overlay, %PDF- binary, 3 pages, expected actor title, actual browser popup");
  return {bytes:bytes.length,pages:result.getPageCount()};
 }

 const choose=async(id,kind="npc")=>{
  await op("choose",id,kind);
  await page.getByTestId("t46-p3-original-active").waitFor({timeout:20000});
  await page.locator(".npc-panel-inner").waitFor({timeout:65000});
 };
 const logout=async()=>{
  await op("logout");await page.getByTestId("t46-p3-signed-out").waitFor({timeout:20000});
  assert.equal(await page.getByTestId("t46-p3-original-active").count(),0);
 };
 assert.equal(await page.getByTestId("t46-p3-original-active").count(),0);
 await login("OUTSIDER");await choose(ids.npc);
 await sleep(2000);
 const rawCharacters=requests.some(x=>x.method==="GET"&&x.url.includes("/rest/v1/characters?"));
 const rawSheet=requests.some(x=>x.method==="GET"&&x.url.includes("/rest/v1/character_sheets?"));
 assert.ok(rawCharacters,"Actual current NPC component did not request RAW characters");
 assert.ok(rawSheet,"Actual current NPC component did not request RAW Sheet");
 const denied=await actors.OUTSIDER.who.from("character_sheets").select("sheet").eq("character_id",ids.npc).maybeSingle();
 assert.ifError(denied.error);assert.equal(denied.data,null);
 const text=await page.getByTestId("t46-p3-original-active").innerText();
 assert.ok(!text.includes(fixtures.npc.marker),"Outsider raw Sheet appeared");
 assert.ok(!text.includes(fixtures.npc.secret),"Outsider GM secret appeared");
 console.log("EXPECTED ORIGINAL RED T46-P3-P1A: actual unmodified NPC/Interaction issues raw characters+Sheet reads under signed OUTSIDER. Stage1 RLS blocks Sheet, but client is NOT yet a server-projected Profile.");
 await choose(ids.merchant,"merchant");
 await choose(ids.hidden);
 await logout();
 console.log("PASS T46-P3-P1A SOURCE BOUNDARY: real current NPC/merchant/hidden selection, signed-out fixture clears panel; original private fields remained server-protected");
 await login("GM");await choose(ids.npc);
 const dossier=await actors.GM.who.rpc("get_npc_dossier_admin_v1",{p_character_id:ids.npc});
 assert.ifError(dossier.error);
 assert.ok(JSON.stringify(dossier.data).includes(fixtures.npc.secret));
 await logout();
 // At this exact point the signed baseline recorded unmodified active source's
 // raw characters + raw Sheet request, while source-original Stage1 RLS denied
 // the OUTSIDER. Now trial the held #345 active NpcPanel in this CI checkout.
 fs.copyFileSync(secureSourcePath,activeNpcSourcePath);
 secureOverlayActive=true;
 fs.copyFileSync(creatorSourcePath,activeCreatorPath,fs.constants.COPYFILE_EXCL);
 creatorOverlayActive=true;
 assert.equal(gitBlob(fs.readFileSync(activeNpcSourcePath)),
  "606db96649dcdf6646afbd4d24f67a6fc54426eb");
 assert.equal(gitBlob(fs.readFileSync(activeCreatorPath)),
  "23b0e86aab7a80b7243365ba107c1d37a5ec5812");

 // Candidate patch ONLY in disposable CI checkout. No active app/held #345
 // source file is modified in the Git commit. Original byte assertions are
 // checked BEFORE injecting one explicit opt-in prop and a fresh server check.
 const sourceNpc=fs.readFileSync(activeNpcSourcePath,"utf8");
 const npcProp='                  printProfile={printableProfile}';
 assert.equal(sourceNpc.split(npcProp).length,2,"Exact held NPC print identity prop drift");
 fs.writeFileSync(activeNpcSourcePath,sourceNpc.replace(npcProp,
  npcProp+'\n                  freshPrintAuthorizationCharacterId={npcId}'));
 const originalSheet=originalSheetPanelBytes.toString("utf8");
 const before='  printProfile = null,';
 assert.equal(originalSheet.split(before).length,2,"Original Sheet props insertion drift");
 let guardedSheet=originalSheet.replace(before,
  '  freshPrintAuthorizationCharacterId = null,\n'+before);
 const originalPrintStart='  async function openOfficialPrintableSheet() {\n';
 assert.equal(guardedSheet.split(originalPrintStart).length,2,"Original onClick print function drift");
 guardedSheet=guardedSheet.replace(originalPrintStart,originalPrintStart+
  '    let printActor = null;\n'+
  '    const recheckServerPrintPermission = async () => {\n'+
  '      const cid = freshPrintAuthorizationCharacterId;\n'+
  '      if (!cid) return;\n'+
  '      if (characterId !== cid) throw new Error("Character Sheet print identity mismatch.");\n'+
  '      const before = await supabase.auth.getUser();\n'+
  '      const uid = before?.data?.user?.id;\n'+
  '      if (before.error || !uid || (printActor && printActor !== uid))\n'+
  '        throw new Error("Character Sheet print authorization expired.");\n'+
  '      printActor = uid;\n'+
  '      const authority = await supabase.rpc("can_manage_character_progression_v1", { p_character_id: cid });\n'+
  '      const after = await supabase.auth.getUser();\n'+
  '      if (authority.error || authority.data !== true || after.error || after?.data?.user?.id !== printActor)\n'+
  '        throw new Error("Character Sheet print authorization expired.");\n'+
  '    };\n');
 const firstPrint='    try {\n      const model = buildPrintableCharacterSheetModel({';
 assert.equal(guardedSheet.split(firstPrint).length,2,"Original model print start drift");
 guardedSheet=guardedSheet.replace(firstPrint,
  '    try {\n      await recheckServerPrintPermission();\n      const model = buildPrintableCharacterSheetModel({');
 const beforeObjectUrl='      const pdfBytes = await buildOfficialCharacterSheetPdf({ model });\n      const blob = new Blob(';
 assert.equal(guardedSheet.split(beforeObjectUrl).length,2,"Original final PDF exposure drift");
 guardedSheet=guardedSheet.replace(beforeObjectUrl,
  '      const pdfBytes = await buildOfficialCharacterSheetPdf({ model });\n      await recheckServerPrintPermission();\n      const blob = new Blob(');
 fs.writeFileSync(currentSheetPanelPath,guardedSheet);
 sheetGuardApplied=true;
 // This is only an additive per-actor action guard; it does NOT fix the
 // original manager's bulk Sheet cache, stale Profile DOM or other exports.
 assert.ok(fs.readFileSync(currentSheetPanelPath,"utf8").includes("recheckServerPrintPermission"));

 await sleep(1500); // allow webpack file watcher to notice exact source swap
 await page.reload({waitUntil:"domcontentloaded",timeout:95000});
 await page.waitForFunction(()=>!!window.__t46p3,null,{timeout:90000});
 requests.length=0;
 await login("OUTSIDER");await choose(ids.npc);
 await page.getByRole("heading",{name:"T46 Arcane Scholar"}).waitFor({timeout:65000});
 await sleep(1200);
 assert.ok(requests.some(r=>r.url.includes("/rest/v1/rpc/get_npc_profile_visible_v1")),
  "Held original #345 secure profile RPC not called");
 assert.ok(!requests.some(r=>r.method==="GET"&&r.url.includes("/rest/v1/characters?")),
  "Held original #345 public Profile still requested raw characters");
 assert.ok(!requests.some(r=>r.method==="GET"&&r.url.includes("/rest/v1/character_sheets?")),
  "Held original #345 OUTSIDER public Profile requested full raw Sheet");
 const safeBody=await page.getByTestId("t46-p3-original-active").innerText();
 assert.ok(!safeBody.includes(fixtures.npc.secret));
 assert.ok(!safeBody.includes(fixtures.npc.marker));
 assert.ok(!safeBody.includes("T46_LEVEL_EVENT_NOT_PUBLIC"));
 assert.ok(!safeBody.includes("1,300"));
 console.log("PASS T46-P3-P1B-PLAYER: exact held PR #345 NpcPanel mounted inside current actual Interaction; Stage1–3 server Profile, no raw characters/Sheet outsider reads, no XP/GM secrets");
 // Same signed player switches to a merchant and hidden NPC without inheriting
 // any previous NPC story. The original source remains unchanged.
 await choose(ids.merchant,"merchant");
 await page.getByRole("heading",{name:"T46 Curio Merchant"}).waitFor({timeout:60000});
 await choose(ids.hidden);
 const hiddenBody=await page.getByTestId("t46-p3-original-active").innerText();
 assert.ok(!hiddenBody.includes(fixtures.hidden.secret));
 assert.ok(!hiddenBody.includes(fixtures.npc.secret));
 await logout();
 // The actual shared Interaction is source-exact; when current signed GM role
 // resolves, the original secure PR #345 dossier and private Sheet are allowed.
 await login("GM");await choose(ids.npc);
 await page.getByRole("heading",{name:"T46 Arcane Scholar"}).waitFor({timeout:60000});
 await page.getByText(fixtures.npc.secret,{exact:false}).first().waitFor({timeout:55000});
 const gmTabs=page.getByRole("button",{name:"Sheet & Rolls"});
 await gmTabs.first().click();
 await page.getByRole("button",{name:"Print Sheet"}).waitFor({timeout:45000});
 await clickRealPrintAndValidatePdf("T46-P3-P2A-GM-AUTHORIZED");
 console.log("PASS T46-P3-P1B-GM: current actual Interaction resolves GM role and mounts exact #345 private dossier + authorized active Sheet/Print button, no source/client replacement in repository");
 // A current signed actor with a narrow can_edit permission may view the
 // canonical Sheet while the RLS says yes, then loses that right on the SAME
 // JWT after revocation+component revalidation (not mere JWT rotation).
 await logout();await login("EDITOR");await choose(ids.npc);
 await page.getByRole("heading",{name:"T46 Arcane Scholar"}).waitFor({timeout:55000});
 await page.getByRole("button",{name:"Sheet & Rolls"}).first().click();
 await page.getByRole("button",{name:"Print Sheet"}).waitFor({timeout:45000});
 await clickRealPrintAndValidatePdf("T46-P3-P2A-EDITOR-BEFORE-REVOKE");
 sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+q(ids.npc)+
  " AND user_id="+q(actors.EDITOR.id));
 guardDenied(await get(actors.EDITOR.who,ids.npc),"revoked SAME JWT original progression reader");
 // Intentionally preserve the genuine original client RED: this component is
 // still mounted; server RLS has changed, but the private Sheet and Print
 // remain in React state. The real button can export WITHOUT a fresh ACL read.
 assert.equal(await page.getByRole("button",{name:"Print Sheet"}).count(),1,
  "Cached private Print control disappeared automatically; unexpected source change");
 // The original UI still holds stale private state, but a fresh server check
 // MUST prevent a new PDF blob from being created after revoke.
 await page.evaluate(()=>{window.__c34LastActualPrintBlob=null;});
 const blockedPopupPromise=ctx.waitForEvent("page",{timeout:20000});
 await page.getByRole("button",{name:"Print Sheet"}).click();
 const blockedPopup=await blockedPopupPromise;
 await page.getByText("Character Sheet print authorization expired.",{exact:false})
  .waitFor({timeout:30000});
 assert.equal(await page.evaluate(()=>window.__c34LastActualPrintBlob?.size||0),0,
  "Revoked editor generated new Sheet PDF despite signed check");
 await blockedPopup.close().catch(()=>{});
 console.log("PASS T46-P3-P2B-REVOKED-EDITOR: same-JWT revoked editor still has stale panel but cannot generate NEW PDF/print blob with candidate server-authorized action guard; original RED remains at prior SHA #44673071627");
 await op("refresh");
 await page.getByTestId("t46-p3-original-active").waitFor({timeout:15000});
 await page.getByRole("heading",{name:"T46 Arcane Scholar"}).waitFor({timeout:55000});
 const afterEditRevoke=await page.getByTestId("t46-p3-original-active").innerText();
 assert.ok(!afterEditRevoke.includes(fixtures.npc.marker));
 assert.ok(!afterEditRevoke.includes(fixtures.npc.secret));
 assert.equal(await page.getByRole("button",{name:"Print Sheet"}).count(),0);
 console.log("PASS T46-P3-P1B-EDITOR-REVOKE: active original safe parent revalidated after same-JWT can_edit revoke; private Sheet/Print not rendered");
 await logout();await login("GM");await choose(ids.npc);
 await page.getByText(fixtures.npc.secret,{exact:false}).first().waitFor({timeout:55000});
 sql("UPDATE public.user_profiles SET role='player' WHERE id="+q(actors.GM.id));
 guardDenied(await get(actors.GM.who,ids.npc),"same-JWT GM demotion full progression");
 // GM demotion without remount must also block a cached print action even
 // though the old dossier DOM remains visible until the next refresh.
 await page.getByRole("button",{name:"Sheet & Rolls"}).first().click();
 await page.getByRole("button",{name:"Print Sheet"}).waitFor({timeout:30000});
 await page.evaluate(()=>{window.__c34LastActualPrintBlob=null;});
 const demotedPopupPromise=ctx.waitForEvent("page",{timeout:20000});
 await page.getByRole("button",{name:"Print Sheet"}).click();
 const demotedPopup=await demotedPopupPromise;
 await page.getByText("Character Sheet print authorization expired.",{exact:false})
  .waitFor({timeout:30000});
 assert.equal(await page.evaluate(()=>window.__c34LastActualPrintBlob?.size||0),0,
  "Demoted GM generated new private Sheet PDF after same-JWT role change");
 await demotedPopup.close().catch(()=>{});
 console.log("PASS T46-P3-P2B-DEMOTED-GM: server-current source alias demotion blocks NEW PDF without component remount; old cached dossier DOM remains separate unresolved defect");
 await op("refresh");
 await page.getByRole("heading",{name:"T46 Arcane Scholar"}).waitFor({timeout:55000});
 const afterRole=await page.getByTestId("t46-p3-original-active").innerText();
 assert.ok(!afterRole.includes(fixtures.npc.secret));
 assert.ok(!afterRole.includes(fixtures.npc.marker));
 assert.equal(await page.getByRole("button",{name:"Print Sheet"}).count(),0);
 await logout();
 console.log("PASS T46-P3-P1B-GM-REVOKE: current Interaction + exact #345 NpcPanel clears private profile and Sheet/Print after source role demotion with same-JWT refresh; no rollout or automatic live auth subscription claimed");
 for(const [name,id] of Object.entries(ids))
  assert.equal(canonical(id),snapshots[name],"Canonical sheet/progression changed "+name);
 assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
 assert.deepEqual(pageErrors,[],"Actual Next source runtime errors "+serverLog.slice(-4000));
 assert.ok(offsite.every(x=>x.startsWith("https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/")),
  "Unknown external browser request "+JSON.stringify(offsite.slice(0,4)));
 console.log("PASS T46-P3-P2B real clicked original three-page PDF authorized GM/editor + candidate blocks same-JWT revoked editor/GM Print without remount; UI caches and production remain UNFIXED.");
}finally{
 // Restore original checked-out live component bytes even on Chromium failure.
 // Fixture copies are untracked temporary files, never a source commit.
 if(sheetGuardApplied)fs.writeFileSync(currentSheetPanelPath,originalSheetPanelBytes);
 assert.equal(gitBlob(fs.readFileSync(currentSheetPanelPath)),"cb3511bf25a97be3a07c6e5d93ee62bb16570327",
  "Temporary original Sheet panel action guard survived CI cleanup");
 if(secureOverlayActive)fs.writeFileSync(activeNpcSourcePath,originalActiveNpcBytes);
 if(creatorOverlayActive&&fs.existsSync(activeCreatorPath))fs.rmSync(activeCreatorPath);
 assert.equal(gitBlob(fs.readFileSync(activeNpcSourcePath)),
  "e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db",
  "Failed to restore original current NPC component on CI checkout");
 assert.ok(!fs.existsSync(activeCreatorPath),"Temporary CreatorBackstoryPanel survived CI");
 if(browser)await browser.close().catch(()=>{});
 if(server){
  try{process.kill(-server.pid,"SIGTERM")}catch{}
  await sleep(500);
  try{process.kill(-server.pid,"SIGKILL")}catch{}
 }
 if(fs.existsSync(routePath))fs.rmSync(routePath);
 assert.ok(!fs.existsSync(routePath),"Temporary active page must be removed");
}
