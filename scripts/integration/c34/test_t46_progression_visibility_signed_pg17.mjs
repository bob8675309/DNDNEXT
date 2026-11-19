#!/usr/bin/env node
// T46: source-exact original progression + original visible Sheet RLS RED,
// followed by UNRELEASED C34 research-only role/Sheet/progression/discovery GREEN.
// Genuine disposable GoTrue identities and PG17/PostgREST. NO hosted services.
// Reuses only the reduced P1.3 Fighter fixture; NOT complete source/catalogue/
// account Auth policy, PR #345 stage1-3 consumer/browser or release proof.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto,{randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createClient} from "@supabase/supabase-js";
const env=process.env;
for(const [key,value] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_P13_LEVELUP_LOCAL_CONFIRM:"P13_SOURCE_V5_LOCAL_AUTH_ONLY",
 DNDNEXT_T46_VISIBILITY_CONFIRM:"T46_LOCAL_REVEAL_PROGRESSION_SOURCE_ORIGINAL_RED_SCRATCH_GREEN"
}))assert.equal(env[key],value,"T46 refuses nonlocal execution: "+key);
assert.equal(env.DNDNEXT_P13_LEVELUP_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_P13_LEVELUP_ANON_KEY);
assert.notEqual(env.VERCEL,"1");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const protectedFiles={
 "sql/20260710_02_character_progression_foundation.sql":"b1b9781e06e9210a30c520b7f531bce7cbdbd82a",
 "sql/20260710_04_character_xp_level_up_review.sql":"81bce9bec9c59b3b673aeaada913cd054e4b74c7",
 "sql/20260721_01_character_data_rls_phase_1.sql":"5d9a53590a030ac15a45be654016dbbe00651fff",
 "scripts/fixtures/p1_3_admin_grant_original_source_pg17.sql":"8269b57301a92751937c0a6a0c9529e8e7eb6848",
 "scripts/fixtures/p1_3_npc_visible_sheet_original_functions_pg17.sql":"9c479d3f044268f73da3a5515d229096ce03f94a",
 "scripts/integration/c34/sources/02_npc_profile_stage1.sql":"9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3",
 "scripts/integration/c34/sources/04_private_story_stage3.sql":"01e48823ac3a46aa5880e98200e97c2595501ce7",
 "scripts/fixtures/p1_3_levelup_v5_local_auth_pg17.sql":"6619cc35a9e927696868bf13d3c8942116c9c8c3"
};
const gitBlob=b=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
const originals={};
for(const [p,sha] of Object.entries(protectedFiles)){
 const blob=fs.readFileSync(path.join(root,p));
 assert.equal(gitBlob(blob),sha,"Source-original drift "+p);
 originals[p]=blob.toString();
}
function origFunction(src,name){
 const i=src.toLowerCase().indexOf("create or replace function "+name.toLowerCase()+"(");
 assert.ok(i>=0,"Original function not found "+name);
 const t=src.slice(i),m=/\n(?:\$\$|\$function\$);/i.exec(t);
 assert.ok(m,"Original function terminator missing "+name);
 return t.slice(0,m.index+m[0].length);
}
function sql(statement){
 const p=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{
 cwd:root,env,encoding:"utf8",timeout:35000
 });
 assert.equal(p.status,0,"T46 disposable PG17 SQL failure: "+String(p.stderr).slice(-2500));
 return p.stdout.trim();
}
function script(file){
 const p=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-f",file],{
 cwd:root,env,encoding:"utf8",timeout:35000
 });
 assert.equal(p.status,0,"T46 local-only candidate failed: "+String(p.stderr).slice(-2800));
}
const q=id=>{assert.match(id,/^[a-f0-9-]{36}$/i);return "'"+id+"'";};
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
const api=()=>createClient(env.DNDNEXT_P13_LEVELUP_URL,env.DNDNEXT_P13_LEVELUP_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const rpc=(who,name,args)=>who.rpc(name,args);
const get=(who,id)=>rpc(who,"get_character_progression_v1",{p_character_id:id});
const clues=(who,id)=>rpc(who,"c34_t46_get_progression_discoveries_v1",{p_character_id:id});
const grant=(who,id,target,key,revealed,source="gm_direct",note="")=>rpc(who,"c34_t46_set_progression_discovery_v1",{
 p_character_id:id,p_viewer_user_id:target,p_field_key:key,p_revealed:revealed,p_source:source,p_note:note
});
const fetchSheet=(who,id)=>who.from("character_sheets").select("sheet").eq("character_id",id).maybeSingle();
const requireDenied=(value,label)=>{assert.ok(value.error,"Expected deny "+label);assert.equal(value.error.code,"42501",label+" response: "+JSON.stringify(value.error));};
assert.equal(sql("SELECT current_database()"),"postgres");
assert.match(sql("SHOW server_version"),/^17\./);
assert.equal(sql("SELECT to_regclass('private.p13_levelup_case_guard') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");

// Source-exact visibility baseline. NEVER install directly in any hosted DB.
// Test-local table columns are added only to represent production row shape.
sql("ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false");
sql("ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[]");
for(const field of ["can_inventory","can_convert"])
 sql("ALTER TABLE public.character_permissions ADD COLUMN IF NOT EXISTS "+field+" boolean NOT NULL DEFAULT false");
sql("CREATE TABLE public.user_profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),role text NOT NULL DEFAULT 'player')");
sql("ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY");
sql("REVOKE ALL ON public.user_profiles FROM PUBLIC,anon,authenticated");
sql(origFunction(originals["scripts/fixtures/p1_3_admin_grant_original_source_pg17.sql"],"private.current_user_is_admin"));
assert.equal(sql("SELECT md5(pg_get_functiondef('private.current_user_is_admin()'::regprocedure))"),
 "1fc5fbcb121b2862eeab869edfb3a209");
sql(origFunction(originals["scripts/fixtures/p1_3_npc_visible_sheet_original_functions_pg17.sql"],"private.can_access_character_v1"));
sql(origFunction(originals["sql/20260710_02_character_progression_foundation.sql"],"public.xp_threshold_for_level_v1"));
sql(origFunction(originals["sql/20260710_02_character_progression_foundation.sql"],"public.get_character_progression_v1"));
sql(origFunction(originals["sql/20260710_04_character_xp_level_up_review.sql"],"public.can_manage_character_progression_v1"));
sql("REVOKE ALL ON FUNCTION public.can_manage_character_progression_v1(uuid) FROM PUBLIC,anon");
sql("GRANT EXECUTE ON FUNCTION public.can_manage_character_progression_v1(uuid) TO authenticated");
sql("REVOKE ALL ON FUNCTION public.get_character_progression_v1(uuid) FROM PUBLIC,anon");
sql("GRANT EXECUTE ON FUNCTION public.get_character_progression_v1(uuid) TO authenticated");
sql("GRANT USAGE ON SCHEMA private TO authenticated");
sql("GRANT EXECUTE ON FUNCTION private.can_access_character_v1(uuid,text) TO authenticated");
sql("ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY");
sql("CREATE POLICY t46_original_visible_roster ON public.characters FOR SELECT TO authenticated "+
 "USING (NOT coalesce(is_hidden,false) OR (select private.can_access_character_v1(id,'read')))");
sql("GRANT SELECT ON public.characters TO authenticated");
sql("DROP POLICY IF EXISTS p13_sheet_editor_read ON public.character_sheets");
const rls=originals["sql/20260721_01_character_data_rls_phase_1.sql"];
const anchor="create policy character_sheets_select_visible_or_assigned",offset=rls.indexOf(anchor);
assert.ok(offset>=0);
const originalSheetPolicy=rls.slice(offset,rls.indexOf(";",offset)+1);
sql(originalSheetPolicy);
sql("ALTER TABLE public.character_progression ENABLE ROW LEVEL SECURITY");
sql("REVOKE ALL ON public.character_progression,public.character_level_events FROM PUBLIC,anon,authenticated");
sql("NOTIFY pgrst,'reload schema'");
console.log("PASS T46-BASELINE-SOURCE: original admin-only helper + original progress reader + original visible-Sheet RLS installed from immutable sources; no original app changed");

// All real local actors are signed with GoTrue, no token spoofing.
async function actor(name){
 const client=api(),email="t46-"+name+"-"+randomUUID()+"@example.invalid",
  password="LocalT46-"+randomUUID()+"!";
 assert.ifError((await client.auth.signUp({email,password})).error);
 assert.ifError((await client.auth.signInWithPassword({email,password})).error);
 const result=await client.auth.getUser();
 assert.ifError(result.error);
 return {id:result.data.user.id,who:client};
}
const a={};
for(const name of ["admin","gm","dm","owner","editor","inventory","viewer","outsider","other"])
 a[name]=await actor(name);
for(const [name,user] of Object.entries(a)){
 sql("INSERT INTO public.user_profiles(id,role) VALUES("+q(user.id)+","+
 lit(["admin","gm","dm"].includes(name)?name:"player")+")");
 sql("INSERT INTO public.players(user_id,sheet) VALUES("+q(user.id)+","+
 lit(JSON.stringify({historicalAccount:"T46_"+name,shouldRemainFrozen:true}))+"::jsonb)");
}
const classId="'00000000-0000-0000-0000-000000008201'";
const ids={visible:randomUUID(),hidden:randomUUID(),pc:randomUUID()};
function character(id,name,hidden,player=false){
 sql("INSERT INTO public.characters(id,name,kind,is_hidden,tags) VALUES("+q(id)+","+
  lit(name)+",'npc',"+(hidden?"true":"false")+","+(player?"ARRAY['player-character']::text[]":"'{}'::text[]")+")");
 sql("INSERT INTO public.character_sheets(character_id,sheet) VALUES("+q(id)+","+
  lit(JSON.stringify({marker:"T46_CANONICAL_"+name,classKey:"fighter",level:1,
   xp:300,privateNpcStory:"DO NOT EVER RETURN VIA CLUE READER"}))+"::jsonb)");
 sql("INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,created_by)"+
  " VALUES("+q(id)+","+classId+",1,300,true,"+q(a.owner.id)+")");
 sql("INSERT INTO public.character_level_events(character_id,event_type,details,created_by) VALUES("+
  q(id)+",'secret_gm_event',"+lit(JSON.stringify({gmNote:"DO NOT RETURN VIA CLUE READER"}))+"::jsonb,"+q(a.owner.id)+")");
}
character(ids.visible,"Visible Stranger",false);
character(ids.hidden,"Hidden NPC",true);
character(ids.pc,"Private Player Character",false,true);
for(const [name,edit,inventory] of [["owner",true,false],["editor",true,false],
 ["inventory",false,true],["viewer",false,false]]){
 sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory)"+
  " VALUES("+q(ids.visible)+","+q(a[name].id)+","+(edit?"true":"false")+","+
  (inventory?"true":"false")+")");
}
sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES("+
 q(ids.pc)+","+q(a.owner.id)+",true)");
const canonical=id=>sql("SELECT md5(cs.sheet::text)||'|'||cp.class_level||'|'||cp.experience_points||'|'||cp.pending_level_up"+
 " FROM public.character_sheets cs JOIN public.character_progression cp ON cp.character_id=cs.character_id"+
 " WHERE cs.character_id="+q(id));
const snap=Object.fromEntries(Object.entries(ids).map(([k,v])=>[k,canonical(v)]));
const originalHistory=Object.fromEntries(Object.entries(a).map(([k,v])=>[k,
 sql("SELECT md5(sheet::text) FROM public.players WHERE user_id="+q(v.id))]));
const leak=await get(a.outsider.who,ids.visible);
assert.ifError(leak.error);
assert.equal(leak.data?.progression?.experience_points,300);
assert.ok(leak.data?.events?.length>0,"Original outsider reader should disclose event history");
const raw=await fetchSheet(a.outsider.who,ids.visible);
assert.ifError(raw.error);
assert.match(raw.data?.sheet?.privateNpcStory||"",/DO NOT EVER RETURN/);
assert.ifError((await get(a.admin.who,ids.visible)).error);
const gmBefore=await rpc(a.gm.who,"can_manage_character_progression_v1",{p_character_id:ids.visible});
assert.ifError(gmBefore.error);assert.equal(gmBefore.data,false);

console.log("PASS T46-ORIGINAL-RED: unrelated signed outsider can read true original class/XP/events + original full visible Sheet; old Admin-only helper excludes gm/dm; no synthetic proxy");

// Exact held research #345 Stage1 Sheet policy plus source-original reader-only
// one-line authorization and local equivalent GM tier, all scratch ONLY.
script("scripts/integration/c34/candidates/t46_progression_visibility_discovery_pg17.sql");
assert.equal(sql("SELECT pg_get_functiondef('public.get_character_progression_v1(uuid)'::regprocedure) ILIKE '%if not private.can_manage_character_progression_v1%'"),"t");
assert.equal(sql("SELECT pg_get_functiondef('private.current_user_is_admin()'::regprocedure) LIKE '%IN (''admin'', ''gm'', ''dm'')%'"),"t");
for(const role of ["admin","gm","dm","owner","editor"]){
 const result=await get(a[role].who,ids.visible);
 assert.ifError(result.error);
 assert.equal(result.data.progression.experience_points,300);
 assert.ok(result.data.events.length>0);
}
for(const role of ["inventory","viewer","outsider","other"]){
 requireDenied(await get(a[role].who,ids.visible),"Private progression "+role);
 const sheet=await fetchSheet(a[role].who,ids.visible);
 assert.ifError(sheet.error);
 assert.equal(sheet.data,null,"No full raw Sheet for "+role);
}
assert.ifError((await fetchSheet(a.owner.who,ids.visible)).error);
assert.ok((await fetchSheet(a.owner.who,ids.visible)).data?.sheet);
assert.ifError((await fetchSheet(a.gm.who,ids.visible)).error);
assert.ok((await fetchSheet(a.gm.who,ids.visible)).data?.sheet);
requireDenied(await get(a.outsider.who,ids.hidden),"Hidden full progression");
requireDenied(await get(a.outsider.who,ids.pc),"Player full progression");
const direct=await a.outsider.who.from("character_progression").select("experience_points").eq("character_id",ids.visible);
assert.ok(direct.error || (direct.data||[]).length===0,"Direct CP exposed to outsider");
console.log("PASS T46-SCRATCH-GREEN-CORE: admin/gm/dm and can_edit see original full; outsider/linked view/inventory cannot read full progress or Sheet; source-original character-specific ACL and #345 Stage1 policy only");

// Empty until explicit targeted GM disclosure, even when NPC roster is visible.
for(const name of ["outsider","other","viewer"]){
 const result=await clues(a[name].who,ids.visible);
 assert.ifError(result.error);assert.equal(result.data,null);
}
requireDenied(await grant(a.outsider.who,ids.visible,a.outsider.id,"xp",true),"Outsider cannot self-grant");
requireDenied(await grant(a.editor.who,ids.visible,a.outsider.id,"xp",true),"Delegated editor cannot publish GM discovery");
for(const type of ["events","secret","sheet","pending_level_up"]){
 const result=await grant(a.gm.who,ids.visible,a.outsider.id,type,true);
 assert.ok(result.error,"Arbitrary hidden field accepted: "+type);
 assert.equal(result.error.code,"22023");
}
const classGrant=await grant(a.gm.who,ids.visible,a.outsider.id,"class",true,"dialogue","GM-approved after interview");
assert.ifError(classGrant.error);
let result=await clues(a.outsider.who,ids.visible);
assert.ifError(result.error);
assert.deepEqual(result.data,{characterId:ids.visible,class:{name:"Fighter",source:"XPHB"}});
assert.equal((await clues(a.other.who,ids.visible)).data,null,"Different user cannot inherit discovered clue");
let levelGrant=await grant(a.dm.who,ids.visible,a.outsider.id,"level",true,"ability_check","GM adjudicated successful Insight");
assert.ifError(levelGrant.error);
result=await clues(a.outsider.who,ids.visible);
assert.ifError(result.error);
assert.deepEqual(result.data,{characterId:ids.visible,class:{name:"Fighter",source:"XPHB"},level:1});
assert.ok(!JSON.stringify(result.data).includes("DO NOT EVER RETURN"));
assert.ok(!Object.hasOwn(result.data,"events"));
assert.ok(!Object.hasOwn(result.data,"pending_level_up"));
assert.ok(!Object.hasOwn(result.data,"nextLevel"));
const xpGrant=await grant(a.admin.who,ids.visible,a.outsider.id,"xp",true,"gm_direct","Explicit XP disclosure");
assert.ifError(xpGrant.error);
result=await clues(a.outsider.who,ids.visible);
assert.ifError(result.error);
assert.equal(result.data.xp,300);
const revoked=await grant(a.gm.who,ids.visible,a.outsider.id,"xp",false);
assert.ifError(revoked.error);
result=await clues(a.outsider.who,ids.visible);
assert.ifError(result.error);
assert.equal(Object.hasOwn(result.data,"xp"),false);
const hiddenGrant=await grant(a.gm.who,ids.hidden,a.outsider.id,"class",true,"ability_check","GM-only clue when visible");
assert.ifError(hiddenGrant.error);
assert.equal((await clues(a.outsider.who,ids.hidden)).data,null,"Hidden character must not reveal even granted clue");
sql("UPDATE public.characters SET is_hidden=true WHERE id="+q(ids.visible));
assert.equal((await clues(a.outsider.who,ids.visible)).data,null,"Hiding cancels clue exposure without deleting evidence");
sql("UPDATE public.characters SET is_hidden=false WHERE id="+q(ids.visible));
result=await clues(a.outsider.who,ids.visible);
assert.ifError(result.error);
assert.ok(result.data.class && result.data.level===1);
assert.equal(sql("SELECT count(*) FROM private.c34_t46_progression_discoveries WHERE character_id="+q(ids.visible)),"3");
const noTable=await a.outsider.who.from("c34_t46_progression_discoveries").select("*");
assert.ok(noTable.error,"Private discovery table must not be exposed by Data API");
console.log("PASS T46-PER-VIEWER-SECRETS: first contact hides class/level/XP; independent GM-adjudicated dialogue/check reveals are per-actor, scoped and revocable; hidden blocks all; GM secret and canonical Sheet never exposed");

// Revoked can_edit and demoted GM are rechecked at current DB role even if JWT
// itself remains the same. Never trust client isAdmin/is_hidden/reveal toggle.
sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+q(ids.visible)+
 " AND user_id="+q(a.editor.id));
requireDenied(await get(a.editor.who,ids.visible),"Same-JWT revoked editor");
const revokedSheet=await fetchSheet(a.editor.who,ids.visible);
assert.ifError(revokedSheet.error);assert.equal(revokedSheet.data,null);
sql("UPDATE public.user_profiles SET role='player' WHERE id="+q(a.gm.id));
requireDenied(await get(a.gm.who,ids.visible),"Same-JWT demoted GM full reader");
requireDenied(await grant(a.gm.who,ids.visible,a.other.id,"class",true),"Same-JWT demoted GM publish");
assert.ifError((await get(a.dm.who,ids.visible)).error);
assert.ifError((await grant(a.dm.who,ids.visible,a.other.id,"class",true)).error);
const otherResult=await clues(a.other.who,ids.visible);
assert.ifError(otherResult.error);assert.ok(otherResult.data.class);
const anonymous=api();
for(const name of ["get_character_progression_v1","c34_t46_get_progression_discoveries_v1"]){
 const x=await rpc(anonymous,name,{p_character_id:ids.visible});assert.ok(x.error,"Anon original/clue RPC must fail "+name);
}
const anonGrant=await grant(anonymous,ids.visible,a.other.id,"xp",true);
assert.ok(anonGrant.error);
for(const [k,id] of Object.entries(ids))assert.equal(canonical(id),snap[k],"Canonical changed "+k);
for(const [name,actor] of Object.entries(a))
 assert.equal(sql("SELECT md5(sheet::text) FROM public.players WHERE user_id="+q(actor.id)),originalHistory[name],
  "Historical independent account snapshot changed "+name);
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
console.log("PASS T46-REVOCATION-GUARDS: same-JWT can_edit and GM role demotion fail closed; DM retains capability; untrusted and anon cannot publish; no canonical/legacy history writes or world-map triggers");
console.log("PASS T46 RESEARCH ONLY: signed ORIGINAL progression/SHEET RED followed by explicit SCRATCH research candidate GREEN. No PR #345 real full original Stage1-3 co-residence, real Next NPC/Profile/Level Up browser, production RLS or automatic dice-trigger grant acceptance. Release HOLD.");
