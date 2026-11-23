#!/usr/bin/env node
// Source-original historical RED vs separate, unmounted current-role research GREEN.
// Fails outside disposable GitHub Actions PG17+GoTrue/PostgREST.
import assert from "node:assert/strict";
import {createHash,randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {setTimeout as sleep} from "node:timers/promises";
import {createClient} from "@supabase/supabase-js";
const e=process.env;
for(const [k,v] of Object.entries({GITHUB_ACTIONS:"true",CI:"true",
 DNDNEXT_PR334_ROLE_LOCAL_CONFIRM:"PR334_DISPOSABLE_GOTRUE_ONLY",
 PGHOST:"127.0.0.1",PGPORT:"54322",PGDATABASE:"postgres"}))
 assert.equal(e[k],v,"Unsafe environment "+k);
assert.equal(e.DNDNEXT_PR334_ROLE_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(e.DNDNEXT_PR334_ROLE_LOCAL_ANON_KEY?.length>60);
function pg(args){const z=spawnSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1",...args],{
 encoding:"utf8",timeout:25000,env:{...e,PGUSER:"postgres"}});
 assert.equal(z.status,0,z.stderr?.slice(0,700));return z.stdout.trim();}
const db=s=>pg(["-c",s]),file=p=>pg(["-f",p]);
assert.ok(Number(db("select current_setting('server_version_num')"))>=170000);
assert.equal(db("select case when to_regclass('auth.users') is null then 'no' else 'yes' end"),"yes");
assert.equal(db("select case when to_regclass('public.user_profiles') is null and to_regclass('public.characters') is null then 'empty' else 'exists' end"),"empty");
const patch=readFileSync("sql/20260612_90_patch0_crafting_authorization_hardening.sql","utf8");
assert.equal(createHash("sha1").update("blob "+Buffer.byteLength(patch)+"\0").update(patch).digest("hex"),"d60b0ded3f94cd9f7db9aa687e72ee0fc589c416");
const begin=patch.indexOf("CREATE OR REPLACE FUNCTION private.current_user_is_admin()");
const marker="GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO PUBLIC, anon, authenticated, service_role;";
const end=patch.indexOf(marker,begin);
assert.ok(begin>=0&&end>begin);
const original=patch.slice(begin,end+marker.length);
assert.match(original,/up\.role = 'admin'/);
assert.match(original,/RETURN COALESCE\(target_role, 'player'\) <> 'player';/);
db("CREATE SCHEMA IF NOT EXISTS private; REVOKE ALL ON SCHEMA private FROM PUBLIC; GRANT USAGE ON SCHEMA private TO authenticated;");
db("CREATE TABLE public.user_profiles(id uuid primary key references auth.users(id),role text not null);"
 +"CREATE TABLE public.characters(id uuid primary key,name text,background text,motivation text,quirk text,mannerism text,voice text,secret text,tags text[]);"
 +"CREATE TABLE public.character_sheets(character_id uuid primary key references public.characters(id),sheet jsonb);"
 +"CREATE TABLE public.character_permissions(character_id uuid references public.characters(id),user_id uuid references auth.users(id),can_edit boolean not null default false,can_inventory boolean not null default false,can_convert boolean not null default false,primary key(character_id,user_id));"
 +"CREATE TABLE private.character_creator_attribution(character_id uuid primary key references public.characters(id),creator_user_id uuid references auth.users(id));"
 +"REVOKE ALL ON public.user_profiles,public.characters,public.character_sheets,public.character_permissions FROM PUBLIC,anon,authenticated;");
db(original);
file("scripts/fixtures/pr334_role_original_consumers_disposable_pg17.sql");
db("NOTIFY pgrst, 'reload schema'");
const make=()=>createClient(e.DNDNEXT_PR334_ROLE_LOCAL_URL,e.DNDNEXT_PR334_ROLE_LOCAL_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const users={},pass="Pr334-"+randomUUID()+"!9x";
for(const role of ["admin","gm","dm","player","unknown","creator","editor","inventory"]){
 const c=make(),email="pr334-"+randomUUID()+"@example.invalid";
 assert.ifError((await c.auth.signUp({email,password:pass})).error);
 assert.ifError((await c.auth.signInWithPassword({email,password:pass})).error);
 const u=await c.auth.getUser();assert.ifError(u.error);
 const jwt=await c.auth.getClaims();assert.ifError(jwt.error);
 assert.equal(jwt.data.claims.sub,u.data.user.id);
 users[role]={c,uid:u.data.user.id};
 const dbRole=["creator","editor","inventory"].includes(role)?"player":role;
 db("INSERT INTO public.user_profiles(id,role) VALUES('"+u.data.user.id+"','"+dbRole+"')");
}
const id=randomUUID();
db("INSERT INTO public.characters(id,name,background,motivation,quirk,mannerism,voice,secret,tags) VALUES('"+id+"','NPC','Background','Motivation','Quirk','Mannerism','Voice','GM SECRET',ARRAY['player-character']);"
 +"INSERT INTO public.character_sheets(character_id,sheet) VALUES('"+id+"','{\"level\":2}');"
 +"INSERT INTO private.character_creator_attribution(character_id,creator_user_id) VALUES('"+id+"','"+users.creator.uid+"');"
 +"INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES('"+id+"','"+users.creator.uid+"',true),('"+id+"','"+users.editor.uid+"',true);"
 +"INSERT INTO public.character_permissions(character_id,user_id,can_inventory) VALUES('"+id+"','"+users.inventory.uid+"',true);");
db("NOTIFY pgrst, 'reload schema'");await sleep(1200);
async function rpc(w,fn,args={}){
 const c=w==="anon"?make():users[w].c;
 for(let i=0;i<8;i++){const z=await c.rpc(fn,args);
 if(["PGRST202","PGRST200"].includes(z.error?.code)){await sleep(400);continue;}
 return z;}throw Error("PostgREST signature unavailable: "+fn);}
function yes(z,n){assert.ifError(z.error);return z.data;}
function no(z,n){assert.ok(z.error,n+" unexpectedly succeeded: "+JSON.stringify(z.data));}
for(const role of ["admin","gm","dm","player","unknown"]){
 assert.equal(yes(await rpc(role,"is_admin"),role+" strict"),role==="admin");
 assert.equal(yes(await rpc(role,"is_admin",{uid:users[role].uid}),role+" uid"),role!=="player");
}
assert.equal(yes(await rpc("gm","is_admin",{uid:users.admin.uid}),"gm spoof"),false);
assert.equal(yes(await rpc("unknown","is_admin",{uid:users.admin.uid}),"unknown spoof"),false);
console.log("PR334-ORIGINAL-HELPERS-RED expected: strict admin vs any nonplayer own-role");
assert.equal(yes(await rpc("admin","get_npc_dossier_admin_v1",{p_character_id:id}),"original dossier").secret,"GM SECRET");
for(const role of ["gm","dm","player","unknown","creator","editor","inventory"])
 no(await rpc(role,"get_npc_dossier_admin_v1",{p_character_id:id}),role+" original dossier");
for(const role of ["admin","creator","editor"])
 assert.equal(yes(await rpc(role,"get_character_editor_narrative_v1",{p_character_id:id}),role+" original narrative").background,"Background");
for(const role of ["gm","dm","player","unknown","inventory"])
 assert.equal(yes(await rpc(role,"get_character_editor_narrative_v1",{p_character_id:id}),role+" original narrative"),null);
for(const role of ["admin","creator"])
 assert.equal(yes(await rpc(role,"can_edit_creator_backstory_v1",{p_character_id:id}),role+" original Story"),true);
for(const role of ["gm","dm","player","unknown","editor","inventory"])
 assert.equal(yes(await rpc(role,"can_edit_creator_backstory_v1",{p_character_id:id}),role+" original Story"),false);
console.log("PR334-ORIGINAL-CONSUMERS-RED expected: strict GM/DM dossier/Story denial");
file("scripts/fixtures/pr334_role_current_policy_candidate_pg17.sql");
db("NOTIFY pgrst, 'reload schema'");await sleep(1200);
for(const role of ["admin","gm","dm","player","unknown","creator","editor","inventory"])
 assert.equal(yes(await rpc(role,"p13_research_current_actor_is_manager_v1"),role+" manager"),["admin","gm","dm"].includes(role));
for(const role of ["admin","gm","dm"]){
 assert.equal(yes(await rpc(role,"p13_research_get_npc_dossier_v1",{p_character_id:id}),role+" dossier").secret,"GM SECRET");
 assert.equal(yes(await rpc(role,"p13_research_get_editor_narrative_v1",{p_character_id:id}),role+" narrative").background,"Background");
 assert.equal(yes(await rpc(role,"p13_research_can_edit_creator_backstory_v1",{p_character_id:id}),role+" Story"),true);
}
for(const role of ["player","unknown","creator","editor","inventory"])
 no(await rpc(role,"p13_research_get_npc_dossier_v1",{p_character_id:id}),role+" restricted dossier");
for(const role of ["creator","editor"]){
 const n=yes(await rpc(role,"p13_research_get_editor_narrative_v1",{p_character_id:id}),role+" narrative");
 assert.equal(n.background,"Background");assert.equal(n.secret,undefined);}
for(const role of ["player","unknown","inventory"])
 assert.equal(yes(await rpc(role,"p13_research_get_editor_narrative_v1",{p_character_id:id}),role+" narrative"),null);
assert.equal(yes(await rpc("creator","p13_research_can_edit_creator_backstory_v1",{p_character_id:id}),"creator"),true);
for(const role of ["editor","inventory","player","unknown"])
 assert.equal(yes(await rpc(role,"p13_research_can_edit_creator_backstory_v1",{p_character_id:id}),role+" Story"),false);
console.log("PR334-CANDIDATE-JWT-GREEN expected: exact admin/gm/dm and editor/Story split");
db("UPDATE public.user_profiles SET role='player' WHERE id='"+users.gm.uid+"'");
assert.equal(yes(await rpc("gm","p13_research_current_actor_is_manager_v1"),"demoted manager"),false);
no(await rpc("gm","p13_research_get_npc_dossier_v1",{p_character_id:id}),"demoted GM");
assert.equal(yes(await rpc("gm","p13_research_can_edit_creator_backstory_v1",{p_character_id:id}),"demoted Story"),false);
db("UPDATE public.character_permissions SET can_edit=false WHERE character_id='"+id+"' AND user_id='"+users.creator.uid+"'");
assert.equal(yes(await rpc("creator","p13_research_can_edit_creator_backstory_v1",{p_character_id:id}),"revoked creator"),false);
assert.equal(yes(await rpc("creator","p13_research_get_editor_narrative_v1",{p_character_id:id}),"revoked narrative"),null);
assert.equal(yes(await rpc("editor","p13_research_get_editor_narrative_v1",{p_character_id:id}),"retained editor").voice,"Voice");
assert.equal(yes(await rpc("editor","p13_research_can_edit_creator_backstory_v1",{p_character_id:id}),"collaborator not creator"),false);
no(await rpc("unknown","p13_research_current_actor_is_manager_v1",{uid:users.admin.uid}),"spoofed UID");
for(const fn of ["p13_research_current_actor_is_manager_v1","p13_research_get_npc_dossier_v1","p13_research_can_edit_creator_backstory_v1"])
 no(await rpc("anon",fn,fn.includes("dossier")||fn.includes("story")?{p_character_id:id}:{}),"anon "+fn);
console.log("PR334-REVOKE-SPOOF-ANON-GREEN expected: same-JWT demotion and denial");
console.log("PR334 ROLE RESEARCH PASS: disposable subset only, no main/production effect");
