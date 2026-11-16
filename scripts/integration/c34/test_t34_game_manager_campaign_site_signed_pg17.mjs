#!/usr/bin/env node
// C34 T34 genuine signed original-source game-vs-site auth; LOCAL CI ONLY.
// Run AFTER T33 and earlier original signed tests. No hosted services.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createClient} from "@supabase/supabase-js";
const env=process.env;
for(const [k,v] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 C34_T34_SIGNED_CONFIRM:"SOURCE_EXACT_GAME_TECH_BOUNDARY_PG17_ONLY",
}))assert.equal(env[k],v,"T34 refuses hosted SQL "+k);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.ok(env.RUNNER_TEMP&&path.isAbsolute(env.RUNNER_TEMP));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const exec=args=>spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",...args],{
 cwd:root,env,encoding:"utf8",timeout:90000});
const sql=s=>{const r=exec(["-qAt","-c",s]);
 assert.equal(r.status,0,"T34 local query "+r.stderr?.slice(-2200));return r.stdout.trim();};
const install=(code,label)=>{
 const file=path.join(env.RUNNER_TEMP,"c34-t34-"+label+".sql");
 assert.ok(!fs.existsSync(file),"T34 temporary SQL preexists");
 try{fs.writeFileSync(file,code,{flag:"wx",mode:0o600});
  const r=exec(["-q","-f",file]);
  assert.equal(r.status,0,label+" genuine local SQL: "+r.stderr?.slice(-3200));
 }finally{try{fs.unlinkSync(file);}catch{}}
};
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const hash=p=>{const r=spawnSync("git",["hash-object",p],{
 cwd:root,encoding:"utf8",timeout:8000});assert.equal(r.status,0);return r.stdout.trim();};
const cpath="sql/20261016_01_campaign_item_pool_final_constraints.sql";
const spath="sql/20260921_01_admin_site_activity_v1.sql";
assert.equal(hash(cpath),"c804ccd4ea3c1746ad114daa18af8f173bf02128");
assert.equal(hash(spath),"e3a5c7ae7c712a8657e151cf9ccf60ffaccf465a");
const catalog=read(cpath),site=read(spath);
function extract(src,start,end){
 assert.equal(src.split(start).length-1,1,"original function start drift");
 assert.equal(src.split(end).length-1,1,"original function end drift");
 const a=src.indexOf(start),b=src.indexOf(end,a+start.length);
 assert.ok(b>a);return src.slice(a,b).trim();
}
function patch(body,a,b){
 assert.equal(body.split(a).length-1,1,"original guarded source drift");
 return body.replace(a,b);
}
const theme=extract(catalog,
 "CREATE OR REPLACE FUNCTION private.merchant_theme_from_identity_v1(",
 "CREATE OR REPLACE FUNCTION private.merchant_item_theme_eligible_v2(");
const originalSetter=extract(catalog,
 "CREATE OR REPLACE FUNCTION public.set_campaign_future_tech_enabled_v1(",
 "REVOKE ALL ON FUNCTION public.reroll_merchant_inventory_v2");
const newSetter=patch(originalSetter,
 "SELECT coalesce(up.role='admin',false)",
 "SELECT coalesce(up.role IN ('admin','gm','dm'),false)");
const originalSite=extract(site,
 "create or replace function public.get_recent_site_activity_v1()",
 "revoke all on function public.get_recent_site_activity_v1()");
const newSite=patch(originalSite,
 "if not private.current_user_is_admin() then",
 "if not private.current_user_is_site_admin_v1() then");
const quote=id=>{assert.match(id,/^[0-9a-f-]{36}$/i);return "'"+id+"'";};
const fresh=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const originalBuy="1dbe8c24c4c718396d7256f6f7465354";
const buyHash=()=>sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))");
assert.equal(buyHash(),originalBuy);
assert.ok(Number(sql("SELECT position('role IN (' IN pg_get_functiondef('private.current_user_is_admin()'::regprocedure))"))>0,
 "T34 requires installed T31 disposable game-master predicate");
const merchant=sql("SELECT id::text FROM public.characters WHERE name='T26 Probe Merchant' AND kind='merchant' LIMIT 1");
const npc=sql("SELECT id::text FROM public.characters WHERE name='T22 Profile NPC' AND kind='npc' LIMIT 1");
assert.match(merchant,/^[0-9a-f-]{36}$/i);assert.match(npc,/^[0-9a-f-]{36}$/i);
const actors={};
for(const role of ["admin","gm","dm","player","editor","unknown"]){
 const who=fresh(),email="t34-"+role+"-"+randomUUID()+"@example.invalid";
 const password="T34-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const u=await who.auth.getUser();assert.ifError(u.error);
 sql("INSERT INTO public.user_profiles(id,role) VALUES("+quote(u.data.user.id)+",'"+role+
  "') ON CONFLICT(id) DO UPDATE SET role=excluded.role");
 actors[role]={who,id:u.data.user.id,email,password};
}
// Genuine last-source merchant theme accepts text[]. The earlier local
// Forge/T28 fixtures may already have text[] or JSONB tags, with a protected
// player-tag guard trigger. First T34 signed RED proved DROP COLUMN forbidden;
// second RED proved assuming the type is JSONB is also incorrect. Inspect
// original local type; NEVER alter/drop the column or its guard trigger.
const actualTagShape=sql(
 "SELECT format_type(a.atttypid,a.atttypmod) FROM pg_attribute a "+
 "WHERE a.attrelid='public.characters'::regclass AND a.attname='tags' "+
 "AND a.attnum>0 AND NOT a.attisdropped");
assert.ok(["text[]","jsonb"].includes(actualTagShape),
 "T34 refuses unexpected original player-tag column type "+actualTagShape);
console.log("T34-DISPOSABLE-TAGS-SHAPE: "+actualTagShape+"; original column and trigger preserved");
install([
 "BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='75s';",
 "DO $g$ BEGIN IF current_database()<>'postgres' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999",
 " OR to_regclass('private.test_admins') IS NULL OR to_regclass('public.campaign_item_pool_settings') IS NULL",
 " OR to_regprocedure('public.set_campaign_future_tech_enabled_v1(boolean)') IS NOT NULL",
 " OR to_regclass('public.site_visit_activity') IS NOT NULL",
 " THEN RAISE EXCEPTION 'T34 refuses non-original local fixture'; END IF; END $g$;",
 "ALTER TABLE public.campaign_item_pool_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc',now()), ADD COLUMN IF NOT EXISTS updated_by uuid;",
 "DO $tags$ BEGIN IF to_regprocedure('private.current_user_is_admin()') IS NULL OR",
 " (SELECT format_type(a.atttypid,a.atttypmod) FROM pg_attribute a",
 "  WHERE a.attrelid='public.characters'::regclass AND a.attname='tags'",
 "    AND a.attnum>0 AND NOT a.attisdropped) NOT IN ('text[]','jsonb')",
 " OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='characters_guard_player_tags_v1' AND NOT tgisinternal)",
 " THEN RAISE EXCEPTION 'T34 refuses missing protected player-tags trigger or unsupported tag type'; END IF; END $tags$;",
 "UPDATE public.characters SET storefront_enabled=false WHERE storefront_enabled IS TRUE;",
 "UPDATE public.characters SET storefront_enabled=true WHERE id="+quote(merchant)+";",
 "CREATE TABLE IF NOT EXISTS public.players(user_id uuid PRIMARY KEY,name text);",
 "ALTER TABLE public.players ADD COLUMN IF NOT EXISTS user_id uuid;",
 "ALTER TABLE public.players ADD COLUMN IF NOT EXISTS name text;",
 "COMMIT;"
].join("\n"),"fixture");
// Only IF the original column is JSONB: scratch overload delegates to the
// untouched original text[] theme function. If it is already text[], use
// original source directly without any extra SQL helper.
const tagsOverload=[
 "CREATE OR REPLACE FUNCTION private.merchant_theme_from_identity_v1(",
 " p_name text,p_role text,p_affiliation text,p_title text,p_tagline text,p_tags jsonb)",
 "RETURNS text LANGUAGE sql IMMUTABLE",
 "SET search_path TO 'pg_catalog','public','private'",
 "AS $t34_tags$",
 " SELECT private.merchant_theme_from_identity_v1(",
 "  p_name,p_role,p_affiliation,p_title,p_tagline,",
 "  ARRAY(SELECT jsonb_array_elements_text(",
 "   CASE WHEN jsonb_typeof(p_tags)='array' THEN p_tags ELSE '[]'::jsonb END))",
 " );",
 "$t34_tags$;"
].join("\n");
install(theme+"\n"+(actualTagShape==="jsonb"?tagsOverload+"\n":"")+originalSetter+"\n"+
 "REVOKE ALL ON FUNCTION public.set_campaign_future_tech_enabled_v1(boolean) FROM PUBLIC,anon,authenticated;\n"+
 "GRANT EXECUTE ON FUNCTION public.set_campaign_future_tech_enabled_v1(boolean) TO authenticated,service_role;\n"+
 "NOTIFY pgrst,'reload schema';","original-setter");
install(site+"\nNOTIFY pgrst,'reload schema';","original-site");
let oldAdmin;
for(let n=0;n<20;n++){
 oldAdmin=await actors.admin.who.rpc("set_campaign_future_tech_enabled_v1",{p_enabled:false});
 if(oldAdmin.error?.code!=="PGRST202")break;
 await new Promise(resolve=>setTimeout(resolve,300));
}
assert.ifError(oldAdmin.error);
assert.equal(oldAdmin.data?.[0]?.future_tech_enabled,false);
assert.equal(oldAdmin.data?.[0]?.rerolled_merchants,1);
const oldGM=await actors.gm.who.rpc("set_campaign_future_tech_enabled_v1",{p_enabled:true});
assert.ok(oldGM.error && oldGM.error.code!=="PGRST202","original setter must deny GM");
const oldVisit=await actors.gm.who.rpc("get_recent_site_activity_v1");
assert.ifError(oldVisit.error);
assert.ok(oldVisit.data?.length>0,"original site activity broad helper positive fixture");
console.log("PASS T34-ORIGINAL-RED: original campaign setter denies GM; broad game helper exposes original private site activity to GM (disposable only)");

// Preserve FULL original setter, original reroll, all catalog logic and
// original site activity body. Only two exact authorization predicates change.
const siteHelper=[
 "CREATE OR REPLACE FUNCTION private.current_user_is_site_admin_v1()",
 "RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER",
 "SET search_path TO 'pg_catalog','public','auth'",
 "AS $site$ SELECT auth.uid() IS NOT NULL AND EXISTS(",
 " SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.role='admin'",
 "); $site$;",
 "REVOKE ALL ON FUNCTION private.current_user_is_site_admin_v1() FROM PUBLIC,anon,authenticated;",
 "GRANT EXECUTE ON FUNCTION private.current_user_is_site_admin_v1() TO authenticated;"
].join("\n");
install([
 "BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='75s';",
 "DO $g$ BEGIN IF md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))<>'"+originalBuy+"'",
 " OR to_regprocedure('public.get_recent_site_activity_v1()') IS NULL",
 " OR to_regprocedure('public.set_campaign_future_tech_enabled_v1(boolean)') IS NULL",
 " THEN RAISE EXCEPTION 'T34 refuse changed original source'; END IF; END $g$;",
 siteHelper,newSetter,newSite,
 "REVOKE ALL ON FUNCTION public.set_campaign_future_tech_enabled_v1(boolean), public.get_recent_site_activity_v1() FROM PUBLIC,anon,authenticated;",
 "GRANT EXECUTE ON FUNCTION public.set_campaign_future_tech_enabled_v1(boolean) TO authenticated,service_role;",
 "GRANT EXECUTE ON FUNCTION public.get_recent_site_activity_v1() TO authenticated;",
 "COMMIT; NOTIFY pgrst,'reload schema';"
].join("\n"),"role-split");
assert.ok(Number(sql("SELECT position('current_user_is_site_admin_v1()' IN pg_get_functiondef('public.get_recent_site_activity_v1()'::regprocedure))"))>0);
assert.ok(Number(sql("SELECT position('up.role IN (' IN pg_get_functiondef('public.set_campaign_future_tech_enabled_v1(boolean)'::regprocedure))"))>0);
const state=()=>sql("SELECT future_tech_enabled::text||':'||coalesce(updated_by::text,'none')||':'"+
 " (SELECT count(*)::text FROM public.character_stock WHERE character_id="+quote(merchant)+")"+
 " FROM public.campaign_item_pool_settings WHERE id=1");
for(const [role,val] of [["admin",true],["gm",false],["dm",true]]){
 const actor=actors[role];
 const done=await actor.who.rpc("set_campaign_future_tech_enabled_v1",{p_enabled:val});
 assert.ifError(done.error);
 assert.equal(done.data?.[0]?.future_tech_enabled,val);
 assert.equal(done.data?.[0]?.rerolled_merchants,1);
 assert.equal(sql("SELECT updated_by::text FROM public.campaign_item_pool_settings WHERE id=1"),actor.id);
 assert.ok(Number(sql("SELECT count(*) FROM public.character_stock WHERE character_id="+quote(merchant)))>0);
 const dossier=await actor.who.rpc("get_npc_dossier_admin_v1",{p_character_id:npc});
 assert.ifError(dossier.error);
 console.log("PASS T34-GAME-"+role.toUpperCase()+": full original campaign pool toggle and merchant reroll plus Stage2 dossier");
}
const adminSite=await actors.admin.who.rpc("get_recent_site_activity_v1");
assert.ifError(adminSite.error);assert.ok(adminSite.data?.length>0);
console.log("PASS T34-SITE-ADMIN: technical Admin original site report intact");
const before=state();
for(const role of ["player","editor","unknown"]){
 const who=actors[role].who;
 const game=await who.rpc("set_campaign_future_tech_enabled_v1",{p_enabled:false});
 const siteData=await who.rpc("get_recent_site_activity_v1");
 assert.ok(game.error&&siteData.error,"unprivileged read/write "+role);
 assert.notEqual(game.error.code,"PGRST202");assert.notEqual(siteData.error.code,"PGRST202");
 assert.equal(state(),before,"unprivileged mutation "+role);
 console.log("PASS T34-NEGATIVE-"+role.toUpperCase()+": campaign write + technical site read denied");
}
for(const role of ["gm","dm"]){
 const siteData=await actors[role].who.rpc("get_recent_site_activity_v1");
 assert.ok(siteData.error&&siteData.error.code!=="PGRST202",role+" site privacy");
 const table=await actors[role].who.from("site_visit_activity").select("visitor_key").limit(1);
 assert.ok(table.error,role+" site base table access");
 console.log("PASS T34-SITE-"+role.toUpperCase()+": game manager cannot access technical visit/account telemetry");
}
const anon=fresh();
assert.ok((await anon.rpc("get_recent_site_activity_v1")).error);
assert.ok((await anon.rpc("set_campaign_future_tech_enabled_v1",{p_enabled:false})).error);
assert.equal(state(),before);
console.log("PASS T34-ANON: no direct RPC or table privilege bypass");
sql("UPDATE public.user_profiles SET role='gm' WHERE id="+quote(actors.admin.id));
assert.ok((await actors.admin.who.rpc("get_recent_site_activity_v1")).error);
const gameAfterDemote=await actors.admin.who.rpc("set_campaign_future_tech_enabled_v1",{p_enabled:false});
assert.ifError(gameAfterDemote.error);assert.equal(gameAfterDemote.data?.[0]?.rerolled_merchants,1);
console.log("PASS T34-DEMOTION: same-JWT admin→GM loses site data but retains GAME authority");
const same=fresh();
assert.ifError((await same.auth.signInWithPassword({
 email:actors.dm.email,password:actors.dm.password})).error);
assert.ifError((await same.rpc("set_campaign_future_tech_enabled_v1",{p_enabled:true})).error);
assert.ifError((await same.auth.signOut()).error);
assert.ifError((await same.auth.signInWithPassword({
 email:actors.unknown.email,password:actors.unknown.password})).error);
const afterSwitch=state();
assert.ok((await same.rpc("set_campaign_future_tech_enabled_v1",{p_enabled:false})).error);
assert.ok((await same.rpc("get_recent_site_activity_v1")).error);
assert.equal(state(),afterSwitch);
assert.equal(buyHash(),originalBuy);
console.log("PASS T34-SWITCH: DM→unknown same-client game/technical privileges revoked");
console.log("PASS T34-SIGNED: source-original full setter/body + one role guard, independent site strict predicate, original buyer unchanged");
