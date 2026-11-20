import {buildSecureManagerCandidate} from "./candidates/t46_p3_p3_manager_overlay.mjs";
#!/usr/bin/env node
// C34 T46-P3-P3B: source-exact actual /npcs roster & lazy Sheet signed disposable candidate
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


const contract=fs.readFileSync(path.join(root,
 "scripts/integration/c34/candidates/t46_p3_p3_nonmap_manager_roster_pg17.sql"),"utf8");
assert.ok(contract.includes("CREATE OR REPLACE FUNCTION public.c34_t46_get_npc_manager_roster_v1"));
assert.ok(contract.includes("CREATE OR REPLACE FUNCTION public.c34_t46_get_npc_manager_identity_v1"));
sql(contract);
sql("NOTIFY pgrst,'reload schema'");
const sleepUntil=ms=>new Promise(resolve=>setTimeout(resolve,ms));
for(let n=0;n<30;n++){
 const r=await actors.GM.who.rpc("c34_t46_get_npc_manager_roster_v1");
 if(!r.error)break;
 if(n===29)assert.ifError(r.error);
 await sleepUntil(250);
}
const gmAuth=await actors.GM.who.rpc("c34_t46_get_npc_manager_identity_v1");
assert.ifError(gmAuth.error);assert.equal(gmAuth.data,true);
const initialRoster=await actors.GM.who.rpc("c34_t46_get_npc_manager_roster_v1");
assert.ifError(initialRoster.error);assert.equal(initialRoster.data.length,4);
console.log("PASS T46-P3-P3B-SOURCE-DB: original Stage1->3 and signed roster/identity contract installed only disposable PG17");

const pageSource="import {useEffect,useRef,useState} from \"react\";\nimport dynamic from \"next/dynamic\";\nimport {supabase} from \"../utils/supabaseClient\";\nconst RealManager=dynamic(()=>import(\"./npcs\"),{ssr:false});\nexport default function RealManagerProbe(){\nconst [uid,setUid]=useState(null);\nconst prior=useRef(null);\nuseEffect(()=>{const {data}=supabase.auth.onAuthStateChange((event,session)=>{\n const next=session?.user?.id||null;prior.current=next;setUid(next);\n});\nwindow.__t46manager={\n login:async(email,pwd)=>{const r=await supabase.auth.signInWithPassword({email,password:pwd});if(r.error)throw Error(r.error.message);return r.data.user?.id;},\n logout:async()=>{const r=await supabase.auth.signOut();if(r.error)throw Error(r.error.message);return true;},\n};return()=>{data?.subscription?.unsubscribe();delete window.__t46manager};},[]);\nreturn <main data-testid=\"t46-p3-real-manager\" className=\"container-fluid\">\n {!uid?<p data-testid=\"t46-p3-manager-signed-out\">Signed out; manager not mounted</p>:\n <section data-testid=\"t46-p3-mounted-real-manager\"><RealManager/></section>}\n</main>;\n}";


const routeFile="pages/__c34_t46_p3_manager_probe.jsx",routePath=path.join(root,routeFile);
assert.ok(!fs.existsSync(routePath),"Refuse existing Next route overwrite");
const managerPath=path.join(root,"pages/npcs.js");
const originalManager=fs.readFileSync(managerPath);
assert.equal(gitBlob(originalManager),"7fc00b9b3ace6233d1648a3d017f8a05e072d722",
 "Exact active manager source changed; do not update candidate silently");
assert.equal(gitBlob(fs.readFileSync(path.join(root,"components/MapPageClient.js"))),
 "61f8738da2ca3d8635b5a413bfdc18c094228a0a","Protected map changed");
let overlaid=false,server=null,browser=null,serverLog="";
const reqs=[],errors=[],offsite=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){return new Promise((resolve,reject)=>{
 const s=net.createServer();s.once("error",reject);s.listen(0,"127.0.0.1",()=>{
  const p=s.address().port;s.close(()=>resolve(p));
 });
});}
try{
 const transformed=buildSecureManagerCandidate(originalManager.toString("utf8"));
 assert.ok(transformed.includes("c34_t46_get_npc_manager_roster_v1"));
 assert.ok(transformed.includes("c34_t46_get_npc_manager_identity_v1"));
 assert.ok(!transformed.includes('.select("character_id,sheet")'));
 assert.ok(!transformed.includes('loadCharacterSecrets(supabase'));
 fs.writeFileSync(managerPath,transformed);
 overlaid=true;
 fs.writeFileSync(routePath,pageSource,{flag:"wx"});
 const port=await freePort(),origin="http://127.0.0.1:"+port;
 server=spawn(process.execPath,[nextBin,"dev","--webpack","-H","127.0.0.1","-p",String(port)],{
  cwd:root,detached:true,stdio:["ignore","pipe","pipe"],
  env:{...env,NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
   NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1"}
 });
 for(const stream of [server.stdout,server.stderr])
  stream.on("data",x=>{serverLog=(serverLog+x.toString()).slice(-27000)});
 let ready=false;
 for(let i=0;i<110;i++){
  if(server.exitCode!==null)throw Error("Candidate manager Next crashed "+serverLog);
  try{
   const resp=await fetch(origin+"/__c34_t46_p3_manager_probe",{signal:AbortSignal.timeout(2900)});
   if(resp.ok&&(await resp.text()).includes("t46-p3-real-manager")){ready=true;break}
  }catch{}
  await sleep(1200);
 }
 assert.ok(ready,"Original manager candidate Next compile failed "+serverLog);
 browser=await chromium.launch({headless:true,executablePath:env.C33_BROWSER_CHROME,
  args:["--no-sandbox","--disable-dev-shm-usage"]});
 const ctx=await browser.newContext({viewport:{width:1480,height:1050}});
 const page=await ctx.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{
  if(r.url().includes("/rest/v1/"))reqs.push({method:r.method(),url:r.url()});
 });
 await page.route("**/*",route=>{
  const u=route.request().url();
  if(u.startsWith(origin)||u.startsWith(env.DNDNEXT_C34_LOCAL_URL)||
     u.startsWith("ws://127.0.0.1:"+port))return route.continue();
  offsite.push(u.slice(0,170));return route.abort();
 });
 await page.goto(origin+"/__c34_t46_p3_manager_probe",{waitUntil:"domcontentloaded",timeout:90000});
 await page.waitForFunction(()=>!!window.__t46manager,null,{timeout:90000});
 const op=(name,...args)=>page.evaluate(async({name,args})=>{
  const f=window.__t46manager?.[name];if(typeof f!=="function")throw Error(name+" missing");
  return f(...args);
 },{name,args});
 const login=async role=>{
  const r=await op("login",actors[role].email,actors[role].password);
  assert.equal(r,actors[role].id,role+" actor login failed");
  await page.getByTestId("t46-p3-mounted-real-manager").waitFor({timeout:20000});
 };
 const logout=async()=>{
  await op("logout");
  await page.getByTestId("t46-p3-manager-signed-out").waitFor({timeout:20000});
  assert.equal(await page.getByTestId("t46-p3-mounted-real-manager").count(),0);
 };
 const focus=async()=>{
  await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
 };
 const npcName=page.getByText("T46 Arcane Scholar",{exact:true}).first();
 await login("GM");
 await npcName.waitFor({timeout:70000});
 const print=page.getByRole("button",{name:"Print Sheet"});
 await print.waitFor({timeout:55000});
 assert.ok(reqs.some(x=>x.url.includes("/rest/v1/rpc/c34_t46_get_npc_manager_roster_v1")),
  "Real current manager candidate did not use new signed roster RPC");
 assert.ok(reqs.some(x=>x.url.includes("/rest/v1/rpc/c34_t46_get_npc_manager_identity_v1")),
  "Real manager did not use server GM role identity");
 assert.ok(!reqs.some(x=>x.url.includes("/rest/v1/characters?")),
  "Candidate roster still SELECTs unrestricted raw characters");
 assert.ok(!reqs.some(x=>x.url.includes("/rest/v1/character_sheets?")&&
   (x.url.includes("character_id%2Csheet")||x.url.includes("character_id,sheet"))),
  "Candidate triggered original BULK canonical Sheet preloader");
 const firstSheetRequests=reqs.filter(x=>x.url.includes("/rest/v1/character_sheets?"));
 assert.ok(firstSheetRequests.length>=1,"Authorized GM's selected Sheet was not loaded on demand");
 assert.ok(firstSheetRequests.every(x=>x.url.includes("character_id=eq.")),
  "Observed unscoped private Sheet read in browser "+JSON.stringify(firstSheetRequests.slice(0,3)));
 const gmScreen=await page.getByTestId("t46-p3-mounted-real-manager").innerText();
 assert.ok(gmScreen.includes(fixtures.npc.secret),"Actual GM roster lost private dossier");
 console.log("PASS T46-P3-P3B-GM: current real /npcs manager in disposable Next uses server GM roster, populated NPC/merchant, selected one Sheet by ID, no bulk canonical preload, preserves private GM Story");
 sql("UPDATE public.user_profiles SET role='player' WHERE id="+q(actors.GM.id));
 guardDenied(await get(actors.GM.who,ids.npc),"P3B same-JWT demoted GM progression");
 await focus();
 await page.waitForFunction(text=>!document.querySelector('[data-testid="t46-p3-mounted-real-manager"]')?.innerText.includes(text),
  fixtures.npc.secret,{timeout:55000});
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll("button"))
  .some(b=>b.textContent?.trim()==="Print Sheet"),null,{timeout:55000});
 const afterScreen=await page.getByTestId("t46-p3-mounted-real-manager").innerText();
 assert.ok(!afterScreen.includes(fixtures.npc.secret),"Demoted GM retained GM Story after focus");
 assert.ok(!afterScreen.includes(fixtures.npc.marker),"Demoted GM retained private canonical Sheet");
 assert.ok(!afterScreen.includes("T46 Hidden Informant"),"Demoted GM retained hidden NPC");
 console.log("PASS T46-P3-P3B-GM-DEMOTION: same JWT, no page reload or remount; focus-triggered role recheck clears previous GM roster/secret and private Sheet/Print, hides secret and hidden NPC");
 await logout();await login("EDITOR");
 await npcName.waitFor({timeout:65000});
 await print.waitFor({timeout:65000});
 assert.ok(!(await page.getByTestId("t46-p3-mounted-real-manager").innerText()).includes(fixtures.npc.secret),
  "can_edit promoted Editor to GM");
 sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+q(ids.npc)+
  " AND user_id="+q(actors.EDITOR.id));
 guardDenied(await get(actors.EDITOR.who,ids.npc),"P3B sameJWT revoked editor");
 await focus();
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll("button"))
  .some(b=>b.textContent?.trim()==="Print Sheet"),null,{timeout:55000});
 assert.ok(!(await page.getByTestId("t46-p3-mounted-real-manager").innerText()).includes(fixtures.npc.marker));
 console.log("PASS T46-P3-P3B-EDITOR-REVOKE: same JWT editor's private Sheet and Print disappear on focus, without explicit component remount");
 await logout();
 sql("UPDATE public.character_permissions SET can_inventory=true WHERE character_id="+q(ids.npc)+
  " AND user_id="+q(actors.VIEWER.id));
 await login("VIEWER");await npcName.waitFor({timeout:65000});
 await page.waitForTimeout(1200);
 assert.equal(await print.count(),0,"Inventory-only viewer gained private canonical Sheet Print");
 assert.ok(!(await page.getByTestId("t46-p3-mounted-real-manager").innerText()).includes(fixtures.npc.secret));
 await logout();await login("OUTSIDER");await npcName.waitFor({timeout:65000});
 await page.waitForTimeout(1200);
 assert.equal(await print.count(),0,"Public outsider gained private Sheet Print");
 assert.ok(!(await page.getByTestId("t46-p3-mounted-real-manager").innerText()).includes(fixtures.npc.secret));
 assert.ok(!(await page.getByTestId("t46-p3-mounted-real-manager").innerText()).includes("T46 Hidden Informant"));
 await logout();
 console.log("PASS T46-P3-P3B-PLAYER: real current manager renders player-safe NPC+merchant roster; inventory-only and outsider never see private Sheet, XP/GM Story or hidden NPC");
 for(const [name,id] of Object.entries(ids))
  assert.equal(canonical(id),snapshots[name],"Canonical sheet/progression changed "+name);
 assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
 assert.deepEqual(errors,[],"Actual manager runtime failure "+serverLog.slice(-4500));
 assert.ok(offsite.every(x=>x.startsWith("https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/")),
  "Unexpected external browser calls "+JSON.stringify(offsite.slice(0,5)));
 console.log("PASS T46-P3-P3B exact current manager signed candidate browser, one-Sheet lazy and actor-sensitive scrub, disposable-only. NO production cutover or feature parity accepted.");
}finally{
 if(browser)await browser.close().catch(()=>{});
 if(server){
  try{process.kill(-server.pid,"SIGTERM")}catch{}
  await sleep(500);try{process.kill(-server.pid,"SIGKILL")}catch{}
 }
 if(overlaid)fs.writeFileSync(managerPath,originalManager);
 if(fs.existsSync(routePath))fs.rmSync(routePath);
 assert.equal(gitBlob(fs.readFileSync(managerPath)),
  "7fc00b9b3ace6233d1648a3d017f8a05e072d722",
  "Disposable candidate did not restore exact original /npcs");
 assert.ok(!fs.existsSync(routePath),"Disposable Next route survived CI teardown");
}
