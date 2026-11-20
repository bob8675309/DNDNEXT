#!/usr/bin/env node
// C34 T46-P3-P4B-A: signed current-town raw-query negative and safe town-scoped roster projection
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


const RAW_TOWN_COLS="id,name,kind,race,role,affiliation,status,state,location_id,last_known_location_id,projected_destination_id,is_hidden,map_icon_id,tags,portrait_url,portrait_storage_path,portrait_thumb_url,portrait_shop_url,portrait_source,image_url";
const MERCHANT_COLS="id,name,kind,race,role,affiliation,status,state,location_id,home_location_id,storefront_enabled,storefront_title,storefront_tagline,storefront_bg_url,storefront_bg_image_url,storefront_bg_video_url,portrait_url,portrait_storage_path,portrait_thumb_url,portrait_shop_url,image_url,tags";

const townSource=fs.readFileSync(path.join(root,"pages/town/[id].js"),"utf8");
const townSheetSource=fs.readFileSync(path.join(root,"components/TownSheet.js"),"utf8");
assert.equal(gitBlob(townSource),"c66508b798645e189bb900e63bc17b85b8662e10",
 "Original current town route source changed");
assert.equal(gitBlob(townSheetSource),"5399097e48f548956807cd93476fefe03e4dee28",
 "Original Bazaar/Crafters source changed");
assert.equal(gitBlob(fs.readFileSync(path.join(root,"components/MapPageClient.js"))),
 "61f8738da2ca3d8635b5a413bfdc18c094228a0a",
 "Protected world map source changed");
assert.equal(process.env.NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP,"undefined");
assert.ok(!process.env.NEXT_PUBLIC_C34_T33_TOWN_STAGE2_SAFE_PROFILE);
assert.ok(townSource.includes('T28_P2_TOWN_SHOP_ENABLED && requestedView === "shop" ? "profile" : requestedView'));
assert.ok(townSheetSource.includes('onOpenShop(merchant, "shop")'));
console.log("PASS T46-P3-P4B-A-SOURCE: exact original town, Bazaar, default-OFF T28/T33 and protected map hash, not mounted or modified");
// Supply only missing column shapes that the live town SELECT actually names.
// These ALTERs are disposable fixture schema compatibility, NOT permission grants.
sql("ALTER TABLE public.characters ADD COLUMN projected_destination_id bigint");
sql("ALTER TABLE public.characters ADD COLUMN map_icon_id uuid");
sql("ALTER TABLE public.characters ADD COLUMN storefront_bg_url text");
sql("ALTER TABLE public.characters ADD COLUMN storefront_bg_image_url text");
sql("ALTER TABLE public.characters ADD COLUMN storefront_bg_video_url text");
const townId=81247,otherTownId=81248;
sql("INSERT INTO public.locations(id) VALUES ("+townId+"),("+otherTownId+")");
sql("UPDATE public.characters SET location_id="+townId+",state='resting',tags=ARRAY['enchanter'] WHERE id="+q(ids.npc));
sql("UPDATE public.characters SET location_id="+townId+",home_location_id="+townId+",state='resting',storefront_enabled=true,storefront_title='Curio Test Bazaar' WHERE id="+q(ids.merchant));
sql("UPDATE public.characters SET location_id="+townId+",state='resting' WHERE id="+q(ids.hidden));
sql("UPDATE public.characters SET location_id="+otherTownId+",state='resting' WHERE id="+q(ids.privatePc));
const travellingMerchant=randomUUID();
const extra=seed(travellingMerchant,"T46 Visiting Merchant","merchant",false,0);
sql("UPDATE public.characters SET location_id="+otherTownId+",home_location_id="+townId+",state='moving',storefront_enabled=true WHERE id="+q(travellingMerchant));
const mainBefore=Object.fromEntries(Object.entries(ids).map(([name,id])=>[name,canonical(id)]));
const beforeTownGm=await actors.GM.who.from("characters").select(RAW_TOWN_COLS)
 .in("kind",["npc","merchant"]).eq("location_id",townId).order("name",{ascending:true});
assert.ok(beforeTownGm.error,"Original live town direct roster SELECT unexpectedly succeeds under held Stage2 restricted columns");
assert.equal(beforeTownGm.error.code,"42501", "Unexpected town query failure reason "+JSON.stringify(beforeTownGm.error));
const outsiderDirect=await actors.OUTSIDER.who.from("characters").select(RAW_TOWN_COLS)
 .in("kind",["npc","merchant"]).eq("location_id",townId);
assert.equal(outsiderDirect.error?.code,"42501","Direct town player roster unexpectedly bypassed Stage2 column restrictions");
const merchantDirect=await actors.GM.who.from("characters").select(MERCHANT_COLS)
 .eq("kind","merchant").eq("location_id",townId);
assert.equal(merchantDirect.error?.code,"42501","Original merchant query source/columns unexpectedly no longer restricted");
console.log("EXPECTED ORIGINAL RED T46-P3-P4B-A: current town roster+merchant direct SELECT cannot run under held original #345 Stage2 source column grants; never widen broad raw ACL as fix");
const candidate=fs.readFileSync(path.join(root,
 "scripts/integration/c34/candidates/t46_p3_p4b_town_presence_pg17.sql"),"utf8");
assert.ok(candidate.includes("get_npc_profile_visible_v1(c.id)"));
assert.ok(!candidate.includes("character_sheets"));
sql(candidate);sql("NOTIFY pgrst,'reload schema'");
for(let n=0;n<30;n++){
 const check=await actors.GM.who.rpc("c34_t46_get_town_presence_v1",{p_location_id:townId});
 if(!check.error)break;
 if(n===29)assert.ifError(check.error);
 await new Promise(r=>setTimeout(r,240));
}
const load=(who,id=townId)=>who.rpc("c34_t46_get_town_presence_v1",{p_location_id:id});
const checkNoRaw=(obj,label)=>{
 const serial=JSON.stringify(obj);
 for(const [name,x] of Object.entries(fixtures)){
  assert.ok(!serial.includes(x.secret),label+" leaked original GM Secret "+name);
  assert.ok(!serial.includes(x.marker),label+" leaked canonical Sheet "+name);
 }
 assert.ok(!serial.includes(extra.secret),label+" leaked travelling merchant Secret");
 assert.ok(!serial.includes(extra.marker),label+" leaked travelling merchant Sheet");
 assert.ok(!serial.includes("T46_LEVEL_EVENT_NOT_PUBLIC"),label+" leaked level event");
 assert.ok(!serial.includes("experience_points"),label+" leaked raw XP");
};
for(const role of ["GM","ADMIN","DM","OUTSIDER","OTHER","EDITOR","VIEWER"]){
 const obj=await load(actors[role].who);assert.ifError(obj.error);
 const expectedGm=["GM","ADMIN","DM"].includes(role);
 assert.equal(obj.data.roster.length,expectedGm?3:2,role+" wrong in-town roster");
 assert.equal(obj.data.presentMerchants.length,1,role+" duplicate or missing present merchant");
 assert.equal(obj.data.residentMerchants.length,2,role+" missed travelling resident merchant");
 assert.ok(obj.data.roster.some(x=>x.id===ids.merchant));
 assert.ok(obj.data.residentMerchants.some(x=>x.id===travellingMerchant));
 assert.ok(!obj.data.roster.some(x=>x.id===travellingMerchant),
   role+" travelling resident mistakenly listed in-town");
 assert.ok(!obj.data.roster.some(x=>x.id===ids.privatePc),
   role+" cross-town NPC wrongly present");
 if(!expectedGm) {
  assert.ok(!obj.data.roster.some(x=>x.id===ids.hidden),role+" hidden NPC leaked");
  checkNoRaw(obj.data,role);
  assert.equal(obj.data.roster.find(x=>x.id===ids.npc)?.lore?.secret,
   "A safe published clue: rumored to study in Gray Hall");
 }
 assert.ok(!JSON.stringify(obj.data).includes('"character_sheet"'),role+" canonical Sheet key sent in town response");
}
console.log("PASS T46-P3-P4B-A-PRESENCE: signed GM/DM/admin+players get location-correct roster and Bazaar present/resident merchants, without adding raw SELECT grants or canonical Sheet; hidden filtered for players");
const nonce=createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const unsigned=await load(nonce);assert.ok(unsigned.error||unsigned.data?.roster?.length===0,
 "Anonymous town projection exposed rows");
const invalid=await load(actors.OUTSIDER.who,-100);assert.ifError(invalid.error);
assert.deepEqual(invalid.data,{roster:[],presentMerchants:[],residentMerchants:[]});
sql("UPDATE public.user_profiles SET role='player' WHERE id="+q(actors.GM.id));
const changed=await load(actors.GM.who);assert.ifError(changed.error);
assert.equal(changed.data.roster.length,2,"GM demotion not rechecked on same JWT");
checkNoRaw(changed.data,"Same JWT GM downgrade");
sql("UPDATE public.characters SET is_hidden=true WHERE id="+q(ids.merchant));
const nowHidden=await load(actors.OUTSIDER.who);assert.ifError(nowHidden.error);
assert.equal(nowHidden.data.presentMerchants.length,0);
assert.equal(nowHidden.data.residentMerchants.length,1);
assert.ok(!nowHidden.data.roster.some(x=>x.id===ids.merchant));
console.log("PASS T46-P3-P4B-A-REVOKE: same-JWT demoted GM, hidden merchant, signed client sees server-enforced roster/market changes; anonymous denied");
for(const [name,id] of Object.entries(ids))
 assert.equal(canonical(id),mainBefore[name],"Source original canonical Sheet/progression changed for "+name);
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
console.log("PASS T46-P3-P4B-A signed disposable town negative→safe projection, no current pages/town or TownSheet source changes, no hosted SQL, P4B browser/consumer parity STILL OPEN");
