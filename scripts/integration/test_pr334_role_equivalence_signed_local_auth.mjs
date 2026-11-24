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
 users[role]={c,uid:u.data.user.id,email};
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
async function rpc(w,fn,args={},missingSignatureIsDenial=false){
 const c=w==="anon"?make():users[w].c;
 for(let i=0;i<8;i++){const z=await c.rpc(fn,args);
 if(["PGRST202","PGRST200"].includes(z.error?.code)){
   // Anonymous EXECUTE is revoked, so PostgREST intentionally hides the RPC.
   // An unexpected client-supplied uid also has no matching RPC signature.
   // Keep retrying missing signatures for all *authorized* expected calls.
   if(missingSignatureIsDenial) return z;
   await sleep(400);continue;
 }
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
no(await rpc("unknown","p13_research_current_actor_is_manager_v1",{uid:users.admin.uid},true),"spoofed UID");
for(const fn of ["p13_research_current_actor_is_manager_v1","p13_research_get_npc_dossier_v1","p13_research_can_edit_creator_backstory_v1"])
 no(await rpc("anon",fn,fn.includes("dossier")||fn.includes("story")?{p_character_id:id}:{},true),"anon "+fn);
console.log("PR334-REVOKE-SPOOF-ANON-GREEN expected: same-JWT demotion and denial");

// Tactical-encounter source consumer: execute the actual original map-control SQL
// in the same disposable instance, then version only the guard predicate.
const originalTactical=readFileSync("sql/20260727_01_encounter_map_foundation.sql","utf8");
assert.equal(createHash("sha1").update("blob "+Buffer.byteLength(originalTactical)+"\0").update(originalTactical).digest("hex"),
 "0429f6dc5bd51bc17e7b8403cbdae02306b28b34");
assert.match(originalTactical,/not public\.is_admin\(v_uid\)/);
file("sql/20260727_01_encounter_map_foundation.sql");
db("NOTIFY pgrst, 'reload schema'");await sleep(1200);
// Restore the same signed GM identity after the already-proven demotion denial.
db("UPDATE public.user_profiles SET role='gm' WHERE id='"+users.gm.uid+"'");
const callMap=(who,fn)=>rpc(who,fn,{p_name:"pr334-tactical-"+randomUUID()},who==="anon");
const isUUID=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s||"");
for(const who of ["admin","gm","dm","unknown"]){
 const result=yes(await callMap(who,"admin_upsert_encounter_map_v1"),who+" original tactical upsert");
 assert.ok(isUUID(result),who+" map UUID");
}
for(const who of ["player","creator","editor","inventory"])
 no(await callMap(who,"admin_upsert_encounter_map_v1"),who+" original tactical");
no(await callMap("anon","admin_upsert_encounter_map_v1"),"anon original tactical");
assert.equal(Number(db("select count(*) from public.encounter_maps where name like 'pr334-tactical-%'")),4);
console.log("PR334-ORIGINAL-TACTICAL-RED: signed noncanonical role can create map via exact original tactical SECURITY DEFINER RPC");
// Same unmodified original SQL body except a versioned name and single new-policy guard.
const tacticalStart=originalTactical.indexOf("create or replace function public.admin_upsert_encounter_map_v1(");
const tacticalEndMark="end;$function$;";
const tacticalEnd=originalTactical.indexOf(tacticalEndMark,tacticalStart);
assert.ok(tacticalStart>=0&&tacticalEnd>tacticalStart);
const actualBody=originalTactical.slice(tacticalStart,tacticalEnd+tacticalEndMark.length);
assert.equal((actualBody.match(/not public\.is_admin\(v_uid\)/g)||[]).length,1);
const guardedBody=actualBody
 .replace("public.admin_upsert_encounter_map_v1(","public.p13_research_admin_upsert_encounter_map_v1(")
 .replace("not public.is_admin(v_uid)","not private.p13_research_current_actor_is_manager_v1()");
assert.ok(guardedBody!==actualBody);
db(guardedBody
 +"\nREVOKE ALL ON FUNCTION public.p13_research_admin_upsert_encounter_map_v1(uuid,text,text,integer,integer,text,text,boolean,jsonb) FROM PUBLIC,anon;"
 +"\nGRANT EXECUTE ON FUNCTION public.p13_research_admin_upsert_encounter_map_v1(uuid,text,text,integer,integer,text,text,boolean,jsonb) TO authenticated;");
db("NOTIFY pgrst, 'reload schema'");await sleep(1200);
for(const who of ["admin","gm","dm"])
 assert.ok(isUUID(yes(await callMap(who,"p13_research_admin_upsert_encounter_map_v1"),who+" tactical new-policy")),who+" guarded map");
for(const who of ["player","unknown","creator","editor","inventory"])
 no(await callMap(who,"p13_research_admin_upsert_encounter_map_v1"),who+" guarded tactical");
no(await callMap("anon","p13_research_admin_upsert_encounter_map_v1"),"anon guarded tactical");
assert.equal(Number(db("select count(*) from public.encounter_maps where name like 'pr334-tactical-%'")),7);
console.log("PR334-TACTICAL-JWT-GREEN: exact source-body role substitution; admin/gm/dm yes, unknown/player/anon no");
// ORIGINAL encounter lifecycle source, not TC1/lock/replay acceptance.
const lifecycle=readFileSync("sql/20260727_03_live_encounter_sessions.sql","utf8");
assert.equal(createHash("sha1").update("blob "+Buffer.byteLength(lifecycle)+"\0").update(lifecycle).digest("hex"),
 "1a985be6a3b32196cafc52d5eebaeff29a6a6c1c");
db("CREATE TABLE public.npc_visual_assets(id uuid primary key); ALTER TABLE public.characters ADD COLUMN visual_asset_id uuid;");
file("sql/20260727_03_live_encounter_sessions.sql");
db("NOTIFY pgrst, 'reload schema'");await sleep(1100);
const mapId=db("SELECT id FROM public.encounter_maps WHERE name LIKE 'pr334-tactical-%' AND is_active ORDER BY created_at LIMIT 1");
assert.ok(isUUID(mapId));
const createEncounter=(who,fn)=>rpc(who,fn,{p_map_id:mapId,p_name:"pr334-encounter-"+randomUUID()},who==="anon");
const originalEncounters=[];
for(const who of ["admin","gm","dm","unknown"]){
 const result=yes(await createEncounter(who,"admin_create_encounter_v1"),who+" original encounter");
 assert.ok(isUUID(result));originalEncounters.push(result);
}
for(const who of ["player","creator","editor","inventory"])
 no(await createEncounter(who,"admin_create_encounter_v1"),who+" original create");
no(await createEncounter("anon","admin_create_encounter_v1"),"anon original create");
assert.equal(Number(db("SELECT count(*) FROM public.encounters WHERE name LIKE 'pr334-encounter-%'")),4);
const origSession=originalEncounters[0];
yes(await rpc("unknown","admin_set_encounter_status_v1",{p_encounter_id:origSession,p_status:"ready"}),"unknown original status");
assert.equal(db("SELECT status FROM public.encounters WHERE id='"+origSession+"'"),"ready");
assert.equal(Number(db("SELECT version FROM public.encounters WHERE id='"+origSession+"'")),2);
console.log("PR334-ORIGINAL-LIFECYCLE-RED: signed unknown created encounter and changed original status");
function preservedVersionedLifecycle(name,renamed){
 const first=lifecycle.indexOf("create or replace function public."+name+"(");
 assert.ok(first>=0,"Missing original function "+name);
 const end=lifecycle.indexOf("$function$;",first);
 assert.ok(end>first);
 const body=lifecycle.slice(first,end+"$function$;".length),check="not public.is_admin(v_uid)";
 assert.equal(body.split(check).length-1,1,"Unexpected original guard count");
 return body.replace("public."+name+"(","public."+renamed+"(")
  .replace(check,"not private.p13_research_current_actor_is_manager_v1()");
}
const newCreate="p13_research_admin_create_encounter_v1",newStatus="p13_research_admin_set_encounter_status_v1";
db(preservedVersionedLifecycle("admin_create_encounter_v1",newCreate)
 +"\n"+preservedVersionedLifecycle("admin_set_encounter_status_v1",newStatus)
 +"\nREVOKE ALL ON FUNCTION public."+newCreate+"(uuid,text,jsonb) FROM PUBLIC,anon;"
 +"\nGRANT EXECUTE ON FUNCTION public."+newCreate+"(uuid,text,jsonb) TO authenticated;"
 +"\nREVOKE ALL ON FUNCTION public."+newStatus+"(uuid,text) FROM PUBLIC,anon;"
 +"\nGRANT EXECUTE ON FUNCTION public."+newStatus+"(uuid,text) TO authenticated;");
db("NOTIFY pgrst, 'reload schema'");await sleep(1100);
const newEncounters=[];
for(const who of ["admin","gm","dm"]){
 const result=yes(await createEncounter(who,newCreate),who+" new encounter");
 assert.ok(isUUID(result));newEncounters.push(result);
}
for(const who of ["unknown","player","creator","editor","inventory"])
 no(await createEncounter(who,newCreate),who+" new encounter deny");
no(await createEncounter("anon",newCreate),"anon new encounter deny");
assert.equal(Number(db("SELECT count(*) FROM public.encounters WHERE name LIKE 'pr334-encounter-%'")),7);
const guardedSession=newEncounters[0];
for(const who of ["unknown","player","creator","editor","inventory"])
 no(await rpc(who,newStatus,{p_encounter_id:guardedSession,p_status:"ready"}),who+" status denial");
no(await rpc("anon",newStatus,{p_encounter_id:guardedSession,p_status:"ready"},true),"anon status denial");
assert.equal(db("SELECT status FROM public.encounters WHERE id='"+guardedSession+"'"),"draft");
assert.equal(Number(db("SELECT version FROM public.encounters WHERE id='"+guardedSession+"'")),1);
yes(await rpc("gm",newStatus,{p_encounter_id:guardedSession,p_status:"ready"}),"GM status");
assert.equal(db("SELECT status FROM public.encounters WHERE id='"+guardedSession+"'"),"ready");
assert.equal(Number(db("SELECT version FROM public.encounters WHERE id='"+guardedSession+"'")),2);
db("UPDATE public.user_profiles SET role='player' WHERE id='"+users.gm.uid+"'");
no(await rpc("gm",newStatus,{p_encounter_id:guardedSession,p_status:"initiative"}),"same JWT demoted GM");
assert.equal(db("SELECT status FROM public.encounters WHERE id='"+guardedSession+"'"),"ready");
assert.equal(Number(db("SELECT version FROM public.encounters WHERE id='"+guardedSession+"'")),2);
yes(await rpc("dm",newStatus,{p_encounter_id:guardedSession,p_status:"initiative"}),"DM status");
assert.equal(db("SELECT status FROM public.encounters WHERE id='"+guardedSession+"'"),"initiative");
assert.equal(Number(db("SELECT version FROM public.encounters WHERE id='"+guardedSession+"'")),3);
console.log("PR334-LIFECYCLE-JWT-GREEN: exact-source body guards; status and version atomicity");

// The original generic wallet_add function is service-role-only, despite its
// strict private-admin check. Never broaden to browser managers accidentally.
const wallet=readFileSync("sql/20260724_01_security_hardening_roadmap.sql","utf8");
assert.equal(createHash("sha1").update("blob "+Buffer.byteLength(wallet)+"\0").update(wallet).digest("hex"),
 "d7dc873a141f25745aeb9ce29023da1f176b396d");
const walletStart=wallet.indexOf("CREATE OR REPLACE FUNCTION public.wallet_add(");
const walletEnd=wallet.indexOf("$function$;",walletStart);
assert.ok(walletStart>=0&&walletEnd>walletStart);
const walletBody=wallet.slice(walletStart,walletEnd+"$function$;".length);
assert.match(walletBody,/NOT private\.current_user_is_admin\(\)/);
db("CREATE TABLE public.player_wallets(user_id uuid PRIMARY KEY REFERENCES auth.users(id),gp numeric NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now());"
 +"ALTER TABLE public.player_wallets ENABLE ROW LEVEL SECURITY;"
 +"REVOKE ALL ON public.player_wallets FROM PUBLIC,anon,authenticated;");
db(walletBody
 +"\nREVOKE EXECUTE ON FUNCTION public.wallet_add(uuid,numeric) FROM PUBLIC,anon,authenticated;"
 +"\nGRANT EXECUTE ON FUNCTION public.wallet_add(uuid,numeric) TO service_role;");
assert.equal(db("SELECT has_function_privilege('authenticated','public.wallet_add(uuid,numeric)','EXECUTE')"),"f");
assert.equal(db("SELECT has_function_privilege('service_role','public.wallet_add(uuid,numeric)','EXECUTE')"),"t");
db("NOTIFY pgrst, 'reload schema'");await sleep(1100);
for(const who of ["admin","gm","dm","unknown","player","creator","editor","inventory","anon"])
 no(await rpc(who,"wallet_add",{p_user:users.player.uid,p_delta:100},true),who+" generic wallet_add denial");
assert.equal(Number(db("SELECT count(*) FROM public.player_wallets")),0);
console.log("PR334-WALLET-BROWSER-DENIAL-GREEN: generic wallet_add service-only; no balance writes");

// Nov 16 OWNER policy supersedes historic C34 T34 site-Admin-only scope:
// admin/gm/dm are ONE in-application administrator tier, including carefully
// scoped website activity. C34 T34 historical RED/GREEN MUST remain untouched.
// Test a distinct versioned original-source site reader, not a global helper
// edit or an unauthorized change to the real /admin/activity UI.
const siteOriginal=readFileSync("sql/20260921_01_admin_site_activity_v1.sql","utf8");
assert.equal(createHash("sha1").update("blob "+Buffer.byteLength(siteOriginal)+"\0").update(siteOriginal).digest("hex"),
 "e3a5c7ae7c712a8657e151cf9ccf60ffaccf465a");
const siteBegin=siteOriginal.indexOf("create or replace function public.get_recent_site_activity_v1(");
const siteEnd=siteOriginal.indexOf("$;",siteBegin);
assert.ok(siteBegin>=0&&siteEnd>siteBegin,"Original site activity RPC source unavailable");
const originalSiteFn=siteOriginal.slice(siteBegin,siteEnd+3);
const oldSiteGuard="if not private.current_user_is_admin() then";
assert.equal(originalSiteFn.split(oldSiteGuard).length-1,1,"Original website reporter must have exactly one strict helper guard");
// Earlier encounter same-JWT demotion intentionally left GM as player. Restore
// ONLY its disposable role before independently testing current owner policy.
db("UPDATE public.user_profiles SET role='gm' WHERE id='"+users.gm.uid+"'");
assert.equal(db("SELECT to_regclass('public.players') IS NULL"),"t");
db("CREATE TABLE public.players(user_id uuid PRIMARY KEY REFERENCES auth.users(id),name text);"
 +"REVOKE ALL ON public.players FROM PUBLIC,anon,authenticated;"
 +"INSERT INTO public.players(user_id,name) VALUES('"+users.player.uid+"','Local Test Player');");
file("sql/20260921_01_admin_site_activity_v1.sql");
const anonVisit=randomUUID(),signedVisit=randomUUID();
db("NOTIFY pgrst, 'reload schema'");await sleep(1100);
yes(await rpc("anon","record_site_visit_v1",{p_visitor_key:anonVisit,p_path:"/landing"}),"source original anon visit");
yes(await rpc("player","record_site_visit_v1",{p_visitor_key:signedVisit,p_path:"/character"}),"source original signed visit");
assert.equal(db("SELECT count(*) FROM public.site_visit_activity"),"2");
const originalSiteData=yes(await rpc("admin","get_recent_site_activity_v1"),"original strict Admin site report");
assert.ok(Array.isArray(originalSiteData)&&originalSiteData.length>=2);
for(const role of ["gm","dm","unknown","player","creator","editor","inventory"])
 no(await rpc(role,"get_recent_site_activity_v1"),role+" historic original site policy");
no(await rpc("anon","get_recent_site_activity_v1",{},true),"anon original site read");
console.log("PR334-SITE-HISTORICAL-RED: exact original site report denies GM/DM under superseded T34 policy");
const versionedSiteFn=originalSiteFn
 .replace("public.get_recent_site_activity_v1(","public.p13_research_get_recent_site_activity_v1(")
 .replace(oldSiteGuard,"if not private.p13_research_current_actor_is_manager_v1() then");
assert.equal(versionedSiteFn.split("private.current_user_is_admin()").length-1,0);
db(versionedSiteFn
 +"\nREVOKE ALL ON FUNCTION public.p13_research_get_recent_site_activity_v1() FROM PUBLIC,anon;"
 +"\nGRANT EXECUTE ON FUNCTION public.p13_research_get_recent_site_activity_v1() TO authenticated;");
db("NOTIFY pgrst, 'reload schema'");await sleep(1100);
const allowedFields=["activity_kind","activity_key","email","display_name","role",
 "account_created_at","last_sign_in_at","first_seen","last_seen",
 "visit_count","last_path","last_activity_at"].sort();
assert.deepEqual(yes(await rpc("admin","p13_research_get_recent_site_activity_v1"),"candidate admin site"),originalSiteData);
for(const role of ["gm","dm"]){
 const rows=yes(await rpc(role,"p13_research_get_recent_site_activity_v1"),role+" candidate site");
 assert.deepEqual(rows,originalSiteData,role+" website report full source parity");
 assert.ok(rows.length>=2);
 for(const row of rows)assert.deepEqual(Object.keys(row).sort(),allowedFields);
 const anonRow=rows.find(row=>row.activity_kind==="visitor"&&row.activity_key===anonVisit);
 assert.ok(anonRow,"Missing source original anonymous row");
 assert.equal(anonRow.email,null,"Cannot attach an email to an anonymous visitor");
 assert.equal(anonRow.last_path,"/landing");
 const signedRow=rows.find(row=>row.activity_kind==="account"&&row.activity_key===users.player.uid);
 assert.equal(signedRow?.last_path,"/character","Site report lost real signed visit attribution");
 assert.equal(signedRow?.display_name,"Local Test Player");
}
for(const role of ["unknown","player","creator","editor","inventory"])
 no(await rpc(role,"p13_research_get_recent_site_activity_v1"),role+" current owner policy deny");
no(await rpc("anon","p13_research_get_recent_site_activity_v1",{},true),"anon revised site denial");
// Application report authorization must never imply direct raw table access.
for(const who of ["admin","gm","dm","player","unknown","creator","editor","inventory","anon"]){
 const client=who==="anon"?make():users[who].c;
 const direct=await client.from("site_visit_activity").select("visitor_key,user_id").limit(1);
 assert.ok(direct.error||(Array.isArray(direct.data)&&direct.data.length===0),
  who+" gained forbidden raw site_visit_activity access");
}
console.log("PR334-SITE-BASE-TABLE-DENY: all app roles including managers barred from raw visitor table");
db("UPDATE public.user_profiles SET role='GM' WHERE id='"+users.unknown.uid+"'");
no(await rpc("unknown","p13_research_get_recent_site_activity_v1"),"noncanonical uppercase GM denial");
db("UPDATE public.user_profiles SET role='unknown' WHERE id='"+users.unknown.uid+"'");
db("UPDATE public.user_profiles SET role='player' WHERE id='"+users.dm.uid+"'");
no(await rpc("dm","p13_research_get_recent_site_activity_v1"),"same signed JWT demoted DM website report");
assert.equal(db("SELECT count(*) FROM public.site_visit_activity"),"2");
assert.equal(db("SELECT has_function_privilege('anon','public.p13_research_get_recent_site_activity_v1()','EXECUTE')"),"f");
assert.equal(db("SELECT has_function_privilege('authenticated','public.p13_research_get_recent_site_activity_v1()','EXECUTE')"),"t");
console.log("PR334-SITE-REVISED-JWT-GREEN: owner one-tier app site report, unchanged fields, visitor privacy, exact role/anon/revocation negatives");
// Independent current-source Next browser gate runs only after ALL previous
// original-source signed checks. The temporary page is written+deleted by its
// own harness; this audit adds no permanent /admin/activity runtime change.
db("UPDATE public.user_profiles SET role='dm' WHERE id='"+users.dm.uid+"'");
const {verifyPr334SiteBrowser}=await import("./pr334_signed_site_activity_browser.mjs");
await verifyPr334SiteBrowser({users,password:pass,db});
console.log("PR334 ROLE RESEARCH PASS: exact-source signed SQL plus actual temporary Next/Chromium website-role actor isolation, nonproduction only");

