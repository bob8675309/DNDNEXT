#!/usr/bin/env node
import {buildTownPresenceOverlay} from "./candidates/t46_p3_p4b_b_town_overlay.mjs";
import {buildHeldNpcWithIntelAndPrint,buildGuardedSheetPanel,buildMerchantReturnToProfile} from "./candidates/t46_p3_p4a_composed_overlays.mjs";
// C34 T46-P3-P4B-C2-B1: original C2-A signed PASS plus hidden-merchant direct purchase RED
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
 "utils/c34/readNonMapNpcProfileCandidate.mjs":"80501d106db9788c466ab39e63a2f6c062a9b0a7",
 "scripts/fixtures/forge_original_merchant_buy_source_pg17.sql":"72fd9f0f80a83adaec67caf80a762e238f1dcd8c",
 "scripts/integration/c34/candidates/t46_p3_p4b_c2_merchant_buy_pg17.sql":"c96a524407dcdcaf35ced189958d0832ab7e8dce",
 "scripts/integration/c34/test_t46_p3_p4b_b_real_town_browser_signed.mjs":"40e88676f0c50e98ed16edf0be58f84dd1598f23",
 "components/MerchantStorefrontView.js":"9460eb1ea15994b9b0ed2abefba660e9b4c9370c",
 "utils/useWallet.js":"f34b99f1d6eee66420d57bdcefdc6d3427092e25",
 "scripts/integration/c34/test_t46_p3_p4b_c2_signed_merchant_purchase.mjs":"00f4f580c59c76fc515f2c877a27622cb94f033b"
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
assert.equal(gitBlob(Buffer.from(townSource)),"c66508b798645e189bb900e63bc17b85b8662e10",
 "Original current town route source changed");
assert.equal(gitBlob(Buffer.from(townSheetSource)),"5399097e48f548956807cd93476fefe03e4dee28",
 "Original Bazaar/Crafters source changed");
assert.equal(gitBlob(fs.readFileSync(path.join(root,"components/MapPageClient.js"))),
 "61f8738da2ca3d8635b5a413bfdc18c094228a0a",
 "Protected world map source changed");
assert.notEqual(process.env.NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP,"1");
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


// P4B-B: source-exact actual Town Page / Bazaar browser, opt-in LOCAL ONLY.
sql("UPDATE public.user_profiles SET role='gm' WHERE id="+q(actors.GM.id));
sql("UPDATE public.characters SET is_hidden=false WHERE id="+q(ids.merchant));
for(const col of ["name text","description text","quests jsonb NOT NULL DEFAULT '[]'::jsonb","updated_at timestamptz DEFAULT now()","town_map_image_path text","town_map_image_width integer","town_map_image_height integer"]) sql("ALTER TABLE public.locations ADD COLUMN "+col);
sql("UPDATE public.locations SET name='T46 Research Test Town',description='Disposable town.' WHERE id="+townId);
sql("ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY");
sql("CREATE POLICY p4b_local_town ON public.locations FOR SELECT TO authenticated USING(true)");
sql("GRANT SELECT ON public.locations TO authenticated");
sql("CREATE TABLE public.town_map_labels(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),location_id bigint,key text,name text,x numeric,y numeric,tone text,sort_order integer DEFAULT 0)");
sql("ALTER TABLE public.town_map_labels ENABLE ROW LEVEL SECURITY");
sql("CREATE POLICY p4b_local_labels ON public.town_map_labels FOR SELECT TO authenticated USING(true)");
sql("GRANT SELECT ON public.town_map_labels TO authenticated");
sql(fs.readFileSync(path.join(root,"scripts/integration/c34/candidates/t46_p3_p3_nonmap_manager_roster_pg17.sql"),"utf8"));
sql(fs.readFileSync(path.join(root,"scripts/integration/c34/candidates/t46_p3_p4b_c2_merchant_buy_pg17.sql"),"utf8"));
const buySource=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-f",
 "scripts/fixtures/forge_original_merchant_buy_source_pg17.sql"],
 {cwd:root,env,encoding:"utf8",timeout:35000});
assert.equal(buySource.status,0,"Original C2 buy source install failed: "+String(buySource.stderr).slice(-1300));
assert.equal(sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))"),
 "1dbe8c24c4c718396d7256f6f7465354","C2 original buyer body changed");
sql("REVOKE ALL ON FUNCTION public.buy_from_merchant(uuid,uuid,integer) FROM PUBLIC,anon,authenticated");
sql("GRANT EXECUTE ON FUNCTION public.buy_from_merchant(uuid,uuid,integer) TO authenticated");
const stockId=randomUUID(),stockLabel="T46 C2 Traveler Elixir";
sql("INSERT INTO public.character_stock(id,character_id,item_id,display_name,price_gp,qty,card_payload) VALUES("+
 q(stockId)+","+q(ids.merchant)+",'c2-traveler-elixir',"+lit(stockLabel)+",12,3,"+
 lit(JSON.stringify({item_type:"Potion",item_rarity:"Common",item_description:"T46 C2 signed local stock",item_weight:"0.2"}))+"::jsonb)");
sql("INSERT INTO public.player_wallets(user_id,gp) VALUES("+
 q(actors.OUTSIDER.id)+",72),("+q(actors.OTHER.id)+",0),("+q(actors.EDITOR.id)+",60)");
const walletOf=user=>sql("SELECT gp::text FROM public.player_wallets WHERE user_id="+q(user));
const stockQty=()=>sql("SELECT COALESCE((SELECT qty::text FROM public.character_stock WHERE id="+q(stockId)+"),'gone')");
const invCount=user=>sql("SELECT count(*) FROM public.inventory_items WHERE user_id="+q(user));
const beforeInv=invCount(actors.OUTSIDER.id),beforeOtherInv=invCount(actors.OTHER.id);
const beforeCanonical=Object.fromEntries(Object.entries(ids).map(([name,id])=>[name,canonical(id)]));
sql("NOTIFY pgrst,'reload schema'");
let signedStock;
for(let retry=0;retry<22;retry++){
 signedStock=await actors.OUTSIDER.who.from("character_stock").select("id,display_name,qty,price_gp").eq("character_id",ids.merchant);
 if(!signedStock.error&&signedStock.data?.some(x=>x.id===stockId))break;
 await new Promise(done=>setTimeout(done,290));
}
assert.ifError(signedStock.error);
assert.ok(signedStock.data?.some(x=>x.id===stockId&&x.qty===3),"Signed merchant stock RLS inaccessible");
const anonStock=await client().from("character_stock").select("id").eq("character_id",ids.merchant);
assert.ok(anonStock.error||(anonStock.data?.length===0),"Anonymous read merchant stock");
const wrongWallet=await actors.OTHER.who.rpc("wallet_get",{p_user:actors.OUTSIDER.id});
assert.equal(wrongWallet.error?.code,"42501","Buyer read other actor wallet");
const anonBuy=await client().rpc("buy_from_merchant",{
 p_merchant_id:ids.merchant,p_stock_uuid:stockId,p_qty:1
});
assert.ok(anonBuy.error,"Anon purchase unexpectedly accepted");
assert.equal(stockQty(),"3");
let deniedOther;
for(let retry=0;retry<20;retry++){
 deniedOther=await actors.OTHER.who.rpc("buy_from_merchant",{
  p_merchant_id:ids.merchant,p_stock_uuid:stockId,p_qty:1
 });
 if(/Insufficient funds/i.test(deniedOther.error?.message||""))break;
 await new Promise(done=>setTimeout(done,200));
}
assert.ok(/Insufficient funds/i.test(deniedOther.error?.message||""),
 "Original buyer not callable/signed or unexpected failure: "+JSON.stringify(deniedOther));
const wrongStock=await actors.OUTSIDER.who.rpc("buy_from_merchant",{
 p_merchant_id:travellingMerchant,p_stock_uuid:stockId,p_qty:1
});
assert.ok(/Stock not found/i.test(wrongStock.error?.message||""),
 "Mismatched merchant-stock UUID accepted");
const oversell=await actors.OUTSIDER.who.rpc("buy_from_merchant",{
 p_merchant_id:ids.merchant,p_stock_uuid:stockId,p_qty:77
});
assert.ok(/Not enough stock/i.test(oversell.error?.message||""),
 "Oversell did not reject original locked stock");
assert.equal(walletOf(actors.OUTSIDER.id),"72");
assert.equal(walletOf(actors.OTHER.id),"0");
assert.equal(stockQty(),"3");
assert.equal(invCount(actors.OUTSIDER.id),beforeInv);
assert.equal(invCount(actors.OTHER.id),beforeOtherInv);
const anonInventory=await client().from("inventory_items").select("id").limit(1);
assert.ok(anonInventory.error||(anonInventory.data?.length===0),"Anonymous accessed private inventory");
console.log("PASS T46-P3-P4B-C2-SERVER-NEG: genuine signed buyer/unauth/insufficient/oversell/mismatched-stock and wallet-other negatives; zero ledger mutation, exact original buyer MD5");
const townPath=path.join(root,"pages/town/[id].js");
const npcPath=path.join(root,"components/NpcPanel.js"),creatorPath=path.join(root,"components/CreatorBackstoryPanel.js");
const sheetPath=path.join(root,"components/CharacterSheetPanel.js"),merchantPath=path.join(root,"components/MerchantPanel.js");
const townBytes=fs.readFileSync(townPath),npcBytes=fs.readFileSync(npcPath),sheetBytes=fs.readFileSync(sheetPath),merchantBytes=fs.readFileSync(merchantPath);
const heldNpc=fs.readFileSync(path.join(root,"scripts/integration/c34/sources/05_original_pr345_NpcPanel.js"));
const heldCreator=fs.readFileSync(path.join(root,"scripts/integration/c34/sources/06_original_pr345_CreatorBackstoryPanel.js"));
assert.equal(gitBlob(townBytes),"c66508b798645e189bb900e63bc17b85b8662e10");
assert.equal(gitBlob(npcBytes),"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db");
assert.equal(gitBlob(sheetBytes),"cb3511bf25a97be3a07c6e5d93ee62bb16570327");
assert.equal(gitBlob(merchantBytes),"22e4d0810603bc0322904573cb5fe0c14bad1f88");
assert.equal(gitBlob(heldNpc),"606db96649dcdf6646afbd4d24f67a6fc54426eb");
assert.equal(gitBlob(heldCreator),"23b0e86aab7a80b7243365ba107c1d37a5ec5812");
assert.ok(!fs.existsSync(creatorPath));
const probePath=path.join(root,"pages/__c34_t46_p4b_login.jsx");
assert.ok(!fs.existsSync(probePath));
const loginSource=[
'import {useEffect} from "react";',
'import {supabase} from "../utils/supabaseClient";',
'export default function TownLoginProbe(){',
' useEffect(()=>{window.__p4bLogin=async(email,password)=>{const x=await supabase.auth.signInWithPassword({email,password});if(x.error)throw new Error(x.error.message);return x.data.user?.id;};return()=>{delete window.__p4bLogin};},[]);',
' return <div data-testid="p4b-local-login">P4B local signed login</div>;',
'}'
].join("\n");
let overlaid=false,npcOverlaid=false,sheetOverlaid=false,merchantOverlaid=false,creatorOverlaid=false;
let server=null,browser=null,serverLog="",pageErrors=[],requests=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){return new Promise((resolve,reject)=>{const sock=net.createServer();sock.once("error",reject);sock.listen(0,"127.0.0.1",()=>{const p=sock.address().port;sock.close(()=>resolve(p))})})}
try{
 const candidate=buildTownPresenceOverlay(townBytes.toString("utf8"));
 assert.ok(candidate.includes("T46_P4B_TOWN_PRESENCE_ENABLED"));
 assert.ok(candidate.includes("c34_t46_get_town_presence_v1"));
 fs.writeFileSync(townPath,candidate);overlaid=true;
 fs.writeFileSync(npcPath,buildHeldNpcWithIntelAndPrint(heldNpc.toString("utf8")));npcOverlaid=true;
 fs.writeFileSync(sheetPath,buildGuardedSheetPanel(sheetBytes.toString("utf8")));sheetOverlaid=true;
 fs.writeFileSync(merchantPath,buildMerchantReturnToProfile(merchantBytes.toString("utf8")));merchantOverlaid=true;
 fs.writeFileSync(creatorPath,heldCreator,{flag:"wx"});creatorOverlaid=true;
 fs.writeFileSync(probePath,loginSource,{flag:"wx"});
 const port=await freePort(),origin="http://127.0.0.1:"+port;
 server=spawn(process.execPath,[nextBin,"dev","--webpack","-H","127.0.0.1","-p",String(port)],{cwd:root,detached:true,stdio:["ignore","pipe","pipe"],env:{...env,NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1",NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,NEXT_PUBLIC_C34_T46_P4B_TOWN_PRESENCE:"1",NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP:"0",NEXT_PUBLIC_C34_T33_TOWN_STAGE2_SAFE_PROFILE:"0"}});
 for(const output of [server.stdout,server.stderr])output.on("data",x=>{serverLog=(serverLog+x.toString()).slice(-22000)});
 let ready=false;
 for(let i=0;i<115;i++){
  if(server.exitCode!==null)throw Error("Town Next exited: "+serverLog);
  try{const r=await fetch(origin+"/__c34_t46_p4b_login",{signal:AbortSignal.timeout(2800)});if(r.ok&&(await r.text()).includes("P4B local signed login")){ready=true;break}}catch{}
  await sleep(1050);
 }
 assert.ok(ready,"Signed town login route failed "+serverLog);
 browser=await chromium.launch({headless:true,executablePath:env.C33_BROWSER_CHROME,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1400,height:1060}});
 page.on("pageerror",e=>pageErrors.push(e.message));
 page.on("request",r=>{if(r.url().includes("/rest/v1/"))requests.push(r.url())});
 await page.goto(origin+"/__c34_t46_p4b_login",{waitUntil:"domcontentloaded",timeout:95000});
 await page.waitForFunction(()=>!!window.__p4bLogin,null,{timeout:85000});
 const who=actors.OUTSIDER;
 assert.equal(await page.evaluate(async a=>window.__p4bLogin(a.email,a.password),{email:who.email,password:who.password}),who.id);
 await page.goto(origin+"/town/"+townId,{waitUntil:"domcontentloaded",timeout:100000});
 await page.getByRole("heading",{name:"T46 Research Test Town"}).waitFor({timeout:75000});
 await page.getByRole("button",{name:"Bazaar / market",exact:true}).first().click({force:true});
 await page.getByText("Bazaar of T46 Research Test Town").waitFor({timeout:45000});
 await page.getByText("T46 Curio Merchant",{exact:true}).first().waitFor({timeout:45000});
 await page.getByText("T46 Visiting Merchant",{exact:true}).first().waitFor({timeout:45000});
 assert.ok(!requests.some(u=>u.includes("/rest/v1/characters?")),"Town still uses original raw character SELECT");
 assert.ok(requests.some(u=>u.includes("/rest/v1/rpc/c34_t46_get_town_presence_v1")));
 assert.ok(!(await page.locator(".town-route-page").innerText()).includes("T46 Hidden Informant"));
 console.log("PASS T46-P3-P4B-B-TOWN: actual signed original TownSheet/Bazaar, present and resident merchant, hidden suppressed, signed town RPC not raw character SELECT");
 const card=page.locator('div[class*="marketCard"]').filter({hasText:"T46 Curio Merchant"}).first();
 await card.getByRole("button",{name:"Browse Wares"}).click({force:true});
 const side=page.locator(".town-profile-sidepanel");
 await side.locator(".npc-name").getByText("T46 Curio Merchant",{exact:true}).waitFor({timeout:60000});
 await side.getByTestId("t46-intel").waitFor({timeout:40000});
 await side.getByRole("button",{name:"Let me browse your wares."}).click({force:true});
 await side.getByRole("button",{name:"Return to Profile"}).waitFor({timeout:50000});

 const shelf=side.getByRole("listbox",{name:"Merchant stock"});
 await shelf.getByRole("option",{name:new RegExp(stockLabel)}).waitFor({timeout:40000});
 const buyButton=side.getByRole("button",{name:"Buy for 12 gp",exact:true});
 await buyButton.waitFor({timeout:40000});
 const buyResponse=page.waitForResponse(r=>r.request().method()==="POST"&&
  r.url().includes("/rest/v1/rpc/buy_from_merchant"),{timeout:40000});
 await buyButton.click({force:true});
 const receipt=await buyResponse;
 assert.equal(receipt.status(),200,"Original C2 buyer POST failed "+await receipt.text());
 assert.equal(Number(await receipt.json()),1,"Original buyer did not return one purchased item");
 await side.locator(".merchant-market-notice").filter({hasText:"Purchased "+stockLabel}).waitFor({timeout:40000});
 assert.equal(walletOf(actors.OUTSIDER.id),"60","Browser buyer wallet not debited 72→60");
 assert.equal(stockQty(),"2","Browser original stock not decremented 3→2");
 assert.equal(Number(invCount(actors.OUTSIDER.id))-Number(beforeInv),1,
  "Browser original merchant buy did not deliver one inventory item");
 assert.equal(walletOf(actors.OTHER.id),"0","Original buyer altered other account GP");
 assert.equal(invCount(actors.OTHER.id),beforeOtherInv,"Original buyer granted other account inventory");
 const purchaseItem=JSON.parse(sql("SELECT row_to_json(x)::text FROM ("+
  "SELECT item_name,item_type,item_rarity,owner_type,owner_id,is_equipped,card_payload "+
  "FROM public.inventory_items WHERE user_id="+q(actors.OUTSIDER.id)+
  " ORDER BY id DESC LIMIT 1) x"));
 assert.equal(purchaseItem.item_name,stockLabel);
 assert.equal(purchaseItem.item_type,"Potion");
 assert.equal(purchaseItem.owner_type,"player");
 assert.equal(purchaseItem.owner_id,actors.OUTSIDER.id);
 assert.equal(purchaseItem.is_equipped,false);
 assert.equal(purchaseItem.card_payload.purchase_price_gp,12);
 assert.equal(purchaseItem.card_payload.purchase_total_gp,12);
 assert.equal(purchaseItem.card_payload.purchase_qty,1);
 assert.equal(purchaseItem.card_payload.merchant_id,ids.merchant);
 assert.equal(purchaseItem.card_payload.stock_id,stockId);
 await side.locator(".merchant-preview-purchase").getByText("60 gp",{exact:true}).waitFor({timeout:40000});
 console.log("PASS T46-P3-P4B-C2-PURCHASE: real signed town Bazaar -> held #345 Profile-first -> original MerchantPanel Shop -> unchanged original buyer committed 72→60 gp, 3→2 qty and exact inventory/payload; original wallet hook refreshed");
 await side.getByRole("button",{name:"Return to Profile"}).click({force:true});
 await side.locator(".npc-profile-description-card").waitFor({timeout:40000});
 assert.ok(!(await side.innerText()).includes(fixtures.merchant.secret));
 console.log("PASS T46-P3-P4B-B-MERCHANT: actual town Bazaar Browse Wares routes Profile first, real Shop Talk and Return to Profile; no private Story");

// Independent actual OTHER signed browser: merchant is publicly browsable,
// but the original server buyer must reject zero-GP without any changes.
const insufficient=await browser.newPage({viewport:{width:1400,height:1060}});
try{
 await insufficient.goto(origin+"/__c34_t46_p4b_login",{waitUntil:"domcontentloaded",timeout:90000});
 await insufficient.waitForFunction(()=>!!window.__p4bLogin,null,{timeout:60000});
 const noGp=actors.OTHER;
 assert.equal(await insufficient.evaluate(async a=>window.__p4bLogin(a.email,a.password),
  {email:noGp.email,password:noGp.password}),noGp.id);
 await insufficient.goto(origin+"/town/"+townId,{waitUntil:"domcontentloaded",timeout:90000});
 await insufficient.getByRole("heading",{name:"T46 Research Test Town"}).waitFor({timeout:45000});
 await insufficient.getByRole("button",{name:"Bazaar / market",exact:true}).first().click({force:true});
 await insufficient.locator('div[class*="marketCard"]').filter({hasText:"T46 Curio Merchant"})
  .getByRole("button",{name:"Browse Wares"}).first().click({force:true});
 const badSide=insufficient.locator(".town-profile-sidepanel");
 await badSide.getByRole("button",{name:"Let me browse your wares."}).waitFor({timeout:40000});
 await badSide.getByRole("button",{name:"Let me browse your wares."}).click({force:true});
 await badSide.getByRole("listbox",{name:"Merchant stock"})
  .getByRole("option",{name:new RegExp(stockLabel)}).waitFor({timeout:40000});
 const badCall=insufficient.waitForResponse(r=>r.request().method()==="POST"&&
  r.url().includes("/rest/v1/rpc/buy_from_merchant"),{timeout:40000});
 await badSide.getByRole("button",{name:"Buy for 12 gp",exact:true}).click({force:true});
 const badResponse=await badCall;
 assert.ok(badResponse.status()>=400,"Insufficient funds was erroneously accepted by buyer");
 assert.match((await badResponse.json()).message||"",/Insufficient funds/i);
 await badSide.locator(".merchant-market-notice").filter({hasText:"Insufficient funds"}).waitFor({timeout:30000});
 assert.equal(walletOf(noGp.id),"0");
 assert.equal(stockQty(),"2");
 assert.equal(invCount(noGp.id),beforeOtherInv);
 console.log("PASS T46-P3-P4B-C2-INSUFFICIENT-UI: signed second buyer actual town/Profile/Shop shows original insufficient GP error and no wallet, stock or inventory mutation");
}finally{await insufficient.close().catch(()=>{});}
for(const [name,id] of Object.entries(ids))
 assert.equal(canonical(id),beforeCanonical[name],"Canonical Sheet/XP changed by original purchase "+name);

 // Genuine original policy gap: the town and public shelf must hide this
 // disabled merchant. The unchanged original SECURITY DEFINER buyer
 // nevertheless uses only auth.uid(), stock id+merchant UUID and GP.
 // Preserve SOURCE RED, never label this merchant state as authorized.
 const hiddenMerchant=randomUUID(),hiddenStock=randomUUID();
 const hiddenName="T46 C2 PRIVATE CLOSED MERCHANT";
 sql("INSERT INTO public.characters(id,name,kind,is_hidden,storefront_enabled,state,location_id,home_location_id) VALUES("+
  q(hiddenMerchant)+","+lit(hiddenName)+",'merchant',true,false,'resting',"+townId+","+townId+")");
 sql("INSERT INTO public.character_stock(id,character_id,item_id,display_name,price_gp,qty,card_payload) VALUES("+
  q(hiddenStock)+","+q(hiddenMerchant)+",'c2-hidden-item','C2 Hidden Purchase Item',5,2,"+
  "'{\"item_type\":\"Potion\",\"item_rarity\":\"Rare\"}'::jsonb)");
 const invisible=await actors.OUTSIDER.who.from("character_stock").select("id").eq("character_id",hiddenMerchant);
 assert.ok(invisible.error||(invisible.data||[]).length===0,
  "Closed/hidden merchant shelf unexpectedly visible to outsider through stock RLS");
 const present=await actors.OUTSIDER.who.rpc("c34_t46_get_town_presence_v1",{p_location_id:townId});
 assert.ifError(present.error);
 assert.ok(!JSON.stringify(present.data).includes(hiddenName),
  "Closed/hidden merchant appeared in town projection to signed outsider");
 assert.equal(walletOf(actors.OUTSIDER.id),"60","C2-B original red setup wallet drift");
 const previousInventory=Number(invCount(actors.OUTSIDER.id));
 const originalHidden=await actors.OUTSIDER.who.rpc("buy_from_merchant",{
  p_merchant_id:hiddenMerchant,p_stock_uuid:hiddenStock,p_qty:1
 });
 assert.ifError(originalHidden.error,
  "Original buyer unexpectedly began enforcing hidden merchant; review source MD5 before relabeling");
 assert.equal(Number(originalHidden.data),1);
 assert.equal(walletOf(actors.OUTSIDER.id),"55",
  "Hidden merchant direct RPC did not charge signed player original 5 gp");
 assert.equal(sql("SELECT qty FROM public.character_stock WHERE id="+q(hiddenStock)),"1");
 assert.equal(Number(invCount(actors.OUTSIDER.id)),previousInventory+1,
  "Hidden merchant direct RPC did not deliver player inventory");
 assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE user_id="+q(actors.OUTSIDER.id)+
  " AND card_payload->>'stock_id'="+lit(hiddenStock)),"1");
 const outsiderTownAfter=await actors.OUTSIDER.who.rpc("c34_t46_get_town_presence_v1",{p_location_id:townId});
 assert.ifError(outsiderTownAfter.error);
 assert.ok(!JSON.stringify(outsiderTownAfter.data).includes(hiddenName));
 console.log("EXPECTED ORIGINAL T46-P3-P4B-C2-B1-HIDDEN-RED: unchanged buy_from_merchant SECURITY DEFINER accepted signed purchase from hidden, disabled merchant by UUID even though source-original town projection AND shelf RLS suppressed it; separate server auth gate required; LOCAL ONLY");

 assert.deepEqual(pageErrors,[],"Actual town browser error: "+serverLog.slice(-5500));
 for(const [name,id] of Object.entries(ids))assert.equal(canonical(id),mainBefore[name],"canonical Sheet/XP changed "+name);
 console.log("PASS T46-P3-P4B-C2-SIGNED: original B town/Profile/Shop + unchanged original buyer transaction, signed positive/negative roles, local wallet_get synthetic, source/map restored; actor stale stock/wallet/late buy and flags remain open");
 console.log("PASS T46-P3-P4B-C2-B1-RESEARCH: original source-only hidden seller RED proven with signed local buyer, old C2-A purchase still green; full C2 visibility and stale-actor release gate HOLD");
}finally{
 if(browser)await browser.close().catch(()=>{});
 if(server){try{process.kill(-server.pid,"SIGTERM")}catch{}await sleep(500);try{process.kill(-server.pid,"SIGKILL")}catch{}}
 if(overlaid)fs.writeFileSync(townPath,townBytes);
 if(npcOverlaid)fs.writeFileSync(npcPath,npcBytes);
 if(sheetOverlaid)fs.writeFileSync(sheetPath,sheetBytes);
 if(merchantOverlaid)fs.writeFileSync(merchantPath,merchantBytes);
 if(creatorOverlaid&&fs.existsSync(creatorPath))fs.rmSync(creatorPath);
 if(fs.existsSync(probePath))fs.rmSync(probePath);
 assert.equal(gitBlob(fs.readFileSync(townPath)),"c66508b798645e189bb900e63bc17b85b8662e10");
 assert.equal(gitBlob(fs.readFileSync(npcPath)),"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db");
 assert.equal(gitBlob(fs.readFileSync(sheetPath)),"cb3511bf25a97be3a07c6e5d93ee62bb16570327");
 assert.equal(gitBlob(fs.readFileSync(merchantPath)),"22e4d0810603bc0322904573cb5fe0c14bad1f88");
 assert.ok(!fs.existsSync(creatorPath));assert.ok(!fs.existsSync(probePath));
}
