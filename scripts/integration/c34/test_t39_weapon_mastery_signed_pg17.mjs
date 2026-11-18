#!/usr/bin/env node
// T39: EXACT original XPHB Weapon Mastery RPC RED, then a distinctly
// NON-ORIGINAL, disposable-only Option A account-mirror removal GREEN.
// Actual signed GoTrue/PostgREST/PostgreSQL17. NO hosted credentials or writes.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto, { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const env=process.env;
for(const [key,value] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  C34_T39_SIGNED_CONFIRM:"SIGNED_ORIGINAL_WEAPON_MASTERY_LOCAL_ONLY"
}))assert.equal(env[key],value,"T39 refuses unsafe environment "+key);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.notEqual(env.VERCEL,"1");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const q=id=>{assert.match(id,/^[0-9a-f-]{36}$/i);return "'"+id+"'";};
const sq=s=>"'"+String(s).replaceAll("'","''")+"'";
function sql(s){
  const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",s],
    {cwd:root,env,encoding:"utf8",timeout:30000});
  assert.equal(r.status,0,"T39 disposable SQL failed: "+String(r.stderr).slice(-1800));
  return r.stdout.trim();
}
function sqlFile(p){
  const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-q","-f",p],
    {cwd:root,env,encoding:"utf8",timeout:35000});
  assert.equal(r.status,0,"T39 source SQL failed: "+String(r.stderr).slice(-1800));
  return r.stdout.trim();
}
const md5Sheet=(table,predicate)=>sql("SELECT md5(sheet::text) FROM "+table+" WHERE "+predicate);
const canonical=id=>md5Sheet("public.character_sheets","character_id="+q(id));
const account=id=>md5Sheet("public.players","user_id="+q(id));
function sourceFunc(sqlText,name){
  const start=sqlText.toLowerCase().indexOf("create or replace function "+name.toLowerCase()+"(");
  assert.ok(start>=0,"Original function not found: "+name);
  const stop=sqlText.indexOf("\n$$;",start);
  assert.ok(stop>start,"Unterminated original source function: "+name);
  return sqlText.slice(start,stop+4);
}
function gitBlobHash(buffer){
  return crypto.createHash("sha1").update(Buffer.concat([
    Buffer.from("blob "+buffer.length+"\0"),buffer
  ])).digest("hex");
}
const bytes=fs.readFileSync(path.join(root,"sql/20260808_45_runtime_weapon_mastery.sql"));
assert.equal(gitBlobHash(bytes),"8c270f53de4eaf076cbf13b0d42b64eb811e8d90",
  "T39 original source changed; stop without executing a stale fixture");
const source=bytes.toString("utf8");
const originalFn=sourceFunc(source,"public.configure_character_weapon_mastery_v1");
const originalGet=sourceFunc(source,"public.get_character_weapon_mastery_v1");
const originalCount=sourceFunc(source,"private.xphb_class_weapon_mastery_count_v1");
const originalOptions=sourceFunc(source,"private.xphb_class_weapon_mastery_options_v1");
const mirror="  update public.players p set sheet=v_sheet,updated_at=now()\n"+
  "  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
assert.equal(originalFn.split(mirror).length,2,"Original mirror must occur EXACTLY ONCE");
const candidateFn=originalFn.replace(mirror,
  "  -- T39 Option A NON-ORIGINAL candidate: do not overwrite account-wide legacy players.sheet.");
assert.equal(candidateFn,originalFn.replace(mirror,
  "  -- T39 Option A NON-ORIGINAL candidate: do not overwrite account-wide legacy players.sheet."));
assert.ok(!candidateFn.includes("update public.players p set sheet=v_sheet"));
assert.equal(sourceFunc(source,"public.get_character_weapon_mastery_v1"),originalGet);

const makeClient=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
async function signed(label){
  const client=makeClient(),email="t39-"+label+"-"+randomUUID()+"@example.invalid";
  const password="T39-"+randomUUID()+"!";
  assert.ifError((await client.auth.signUp({email,password})).error);
  assert.ifError((await client.auth.signInWithPassword({email,password})).error);
  const identity=await client.auth.getUser();
  assert.ifError(identity.error);
  const jwt=await client.auth.getClaims();assert.ifError(jwt.error);
  assert.equal(jwt.data.claims.role,"authenticated");
  assert.equal(jwt.data.claims.sub,identity.data.user.id);
  return {id:identity.data.user.id,client};
}
async function rpc(actor,ids,id){
  let r;
  for(let i=0;i<35;i++){
    r=await actor.client.rpc("configure_character_weapon_mastery_v1",{
      p_character_id:id,p_item_ids:ids
    });
    if(r.error?.code!=="PGRST202")break;
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  assert.notEqual(r.error?.code,"PGRST202","T39 original RPC never became visible to signed PostgREST");
  return r;
}
function link(id,user){
  sql("INSERT INTO public.character_permissions"+
    "(character_id,user_id,can_inventory,can_edit,can_convert) VALUES("+
    q(id)+","+q(user.id)+",false,true,false) "+
    "ON CONFLICT(character_id,user_id) DO UPDATE SET can_edit=true");
}
function seedAccount(user,marker){
  sql("INSERT INTO public.players(user_id,name,sheet) VALUES("+
    q(user.id)+","+sq("T39 signed "+marker)+","+
    sq(JSON.stringify({marker,kind:"legacy-historical-do-not-overwrite"}))+"::jsonb)");
  assert.equal(sql("SELECT sheet->>'marker' FROM public.players WHERE user_id="+q(user.id)),marker);
}
function chooseTarget(exclude){
  const excluded=exclude?" AND cp.character_id<>"+q(exclude):"";
  return sql("SELECT cp.character_id FROM public.character_progression cp "+
    "JOIN public.class_catalog c ON c.id=cp.class_id "+
    "JOIN public.character_sheets cs ON cs.character_id=cp.character_id "+
    "WHERE lower(c.class_key)='fighter' AND upper(c.source)='XPHB' "+
    "AND cp.class_level=1"+excluded+" "+
    "AND NOT EXISTS(SELECT 1 FROM public.character_runtime_feature_choices r "+
    "WHERE r.character_id=cp.character_id AND r.feature_key='class-weapon-mastery') "+
    "ORDER BY cp.character_id LIMIT 1");
}
const classKey=id=>sql("SELECT c.class_key||'|'||cp.class_level::text "+
  "FROM public.character_progression cp JOIN public.class_catalog c ON c.id=cp.class_id "+
  "WHERE cp.character_id="+q(id));

assert.equal(sql("SELECT current_database()||'|'||(current_setting('server_version_num')::int BETWEEN 170000 AND 179999)::text"),"postgres|true");
assert.equal(sql("SELECT to_regclass('auth.users') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regclass('private.test_admins') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regclass('public.character_runtime_feature_choices') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regclass('public.items_catalog') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public.configure_character_weapon_mastery_v1(uuid,uuid[])') IS NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");

// Install source-original dependencies only when absent in the inherited
// reduced disposable fixture, not as live migrations or authority shortcuts.
if(sql("SELECT to_regprocedure('private.can_manage_character_progression_v1(uuid)') IS NULL")==="t"){
  const originalProgress=fs.readFileSync(path.join(root,"sql/20260710_02_character_progression_foundation.sql"),"utf8");
  const helper=sourceFunc(originalProgress,"private.can_manage_character_progression_v1");
  assert.match(helper,/private\.current_user_is_admin\(\)/);
  assert.match(helper,/cp\.user_id\s*=\s*auth\.uid\(\)/);
  assert.match(helper,/cp\.can_edit/);
  sql(helper);
}
if(sql("SELECT to_regclass('public.character_rest_log') IS NULL")==="t"){
  const rest=fs.readFileSync(path.join(root,"sql/20260802_03_character_sheet_spell_resources.sql"),"utf8");
  const start=rest.indexOf("create table if not exists public.character_rest_log (");
  const end=rest.indexOf("\n);",start);
  assert.ok(start>=0&&end>start,"Original rest-log table DDL missing");
  sql(rest.slice(start,end+3));
  sql("ALTER TABLE public.character_rest_log ENABLE ROW LEVEL SECURITY");
  sql("REVOKE ALL ON public.character_rest_log FROM PUBLIC,anon,authenticated");
}
sqlFile("sql/20260808_45_runtime_weapon_mastery.sql");
sql("NOTIFY pgrst,'reload schema'");
assert.equal(sql("SELECT has_function_privilege('anon','public.configure_character_weapon_mastery_v1(uuid,uuid[])','EXECUTE')"),"f");
assert.equal(sql("SELECT has_function_privilege('authenticated','public.configure_character_weapon_mastery_v1(uuid,uuid[])','EXECUTE')"),"t");
assert.equal(sql("SELECT pg_get_functiondef('public.get_character_weapon_mastery_v1(uuid)'::regprocedure) LIKE '%can_manage_character_progression_v1%'"),"t");
const originalMd5=sql("SELECT md5(pg_get_functiondef('public.configure_character_weapon_mastery_v1(uuid,uuid[])'::regprocedure))");
const getMd5=sql("SELECT md5(pg_get_functiondef('public.get_character_weapon_mastery_v1(uuid)'::regprocedure))");
console.log("PASS T39-SETUP: exact original runtime Weapon Mastery and XPHB source-choice code installed in disposable PG17 only");

const owner=await signed("original-owner"),coeditor=await signed("original-linked"),outsider=await signed("outsider");
const greenOwner=await signed("option-a-owner"),greenLinked=await signed("option-a-linked");
const originalId=chooseTarget(null);
assert.match(originalId,/^[0-9a-f-]{36}$/i,"Existing inherited signed fixture must provide XPHB Fighter 1");
const secondId=chooseTarget(originalId);
assert.match(secondId,/^[0-9a-f-]{36}$/i,"T39 must compare two independently stored characters");
assert.notEqual(secondId,originalId);
assert.equal(classKey(originalId),"fighter|1");
assert.equal(classKey(secondId),"fighter|1");
link(originalId,owner);
link(originalId,coeditor);
link(secondId,owner);
link(secondId,greenOwner);
link(secondId,greenLinked);
const beforeSecond=canonical(secondId);
seedAccount(owner,"T39_RED_OWNER_FROZEN");
seedAccount(coeditor,"T39_RED_LINKED_FROZEN");
seedAccount(greenOwner,"T39_GREEN_OWNER_FROZEN");
seedAccount(greenLinked,"T39_GREEN_LINKED_FROZEN");
const ownerBefore=account(owner.id),linkedBefore=account(coeditor.id);
const greenOwnerBefore=account(greenOwner.id),greenLinkedBefore=account(greenLinked.id);

// Four source-shaped but SYNTHETIC XPHB-only mundane item IDs. Names and
// nonempty mastery metadata match original eligibility; not live catalog IDs.
const names=["Dagger","Longsword","Shortbow","Mace"];
const mastery=["Nick","Sap","Vex","Sap"];
const weapons=names.map((name,i)=>{
  const id=randomUUID(),key="T39:"+id;
  const payload={source:"XPHB",weapon:true,firearm:false,
    weaponCategory:i===1||i===2?"martial":"simple",
    mastery:[mastery[i]],property:["F|XPHB"],damageText:"1d6"};
  sql("INSERT INTO public.items_catalog(id,item_key,item_name,item_type,item_rarity,description,weight_lb,payload) "+
    "VALUES("+q(id)+","+sq(key)+","+sq(name)+",'weapon','mundane',"+
    sq("T39 synthetic original-option test only")+",2,"+sq(JSON.stringify(payload))+"::jsonb)");
  return id;
});
const first=weapons.slice(0,3),swapped=[weapons[3],weapons[1],weapons[2]];
assert.equal(sql("SELECT jsonb_array_length(private.xphb_class_weapon_mastery_options_v1('fighter'))>=4"),"t");
const originalBefore=canonical(originalId);
const invalidCount=await rpc(owner,[first[0],first[1]],originalId);
assert.ok(invalidCount.error,"Original count validation must reject 2/3 slots");
const duplicate=await rpc(owner,[first[0],first[0],first[1]],originalId);
assert.ok(duplicate.error,"Original duplicate validation must reject");
const forged=await rpc(owner,[first[0],first[1],randomUUID()],originalId);
assert.ok(forged.error,"Original synthetic forged item must fail");
const denied=await rpc(outsider,first,originalId);
assert.ok(denied.error,"Original outsider must be denied");
assert.equal(denied.error.code,"42501");
assert.equal(canonical(originalId),originalBefore);
assert.equal(account(owner.id),ownerBefore);
assert.equal(account(coeditor.id),linkedBefore);
const anonymous=await makeClient().rpc("configure_character_weapon_mastery_v1",{
  p_character_id:originalId,p_item_ids:first
});
assert.ok(anonymous.error,"Anonymous original function must be denied");
console.log("PASS T39-ORIGINAL-NEGATIVES: real JWT outsider, anonymous, count, duplicate and forged XPHB weapon reject atomically");

const red=await rpc(owner,first,originalId);
assert.ifError(red.error);
assert.equal(red.data?.available,true);
assert.equal(red.data?.capacity,3);
assert.equal(red.data?.selectedCount,3);
assert.equal(sql("SELECT jsonb_array_length(state->'selections') FROM public.character_runtime_feature_choices "+
  "WHERE character_id="+q(originalId)+" AND feature_key='class-weapon-mastery'"),"3");
assert.equal(sql("SELECT jsonb_array_length(sheet->'weaponMasteries') FROM public.character_sheets WHERE character_id="+q(originalId)),"3");
assert.equal(canonical(secondId),beforeSecond,"Original runtime choice cannot rewrite unrelated canonical character");
const targetHash=canonical(originalId);
assert.notEqual(ownerBefore,targetHash);
assert.notEqual(linkedBefore,targetHash);
assert.equal(account(owner.id),targetHash,"ORIGINAL RED: linked owner historical account must have been overwritten");
assert.equal(account(coeditor.id),targetHash,"ORIGINAL RED: linked editor historical account must have been overwritten");
console.log("PASS T39-ORIGINAL-SIGNED-RED: true source RPC overwrites BOTH unrelated signed historical account Sheets, keeps specific character canonical/runtime valid");

const noOpBefore=canonical(originalId);
const same=await rpc(owner,first,originalId);
assert.ifError(same.error);
assert.equal(canonical(originalId),noOpBefore);
const early=await rpc(owner,swapped,originalId);
assert.ok(early.error,"Original replacement before a later Long Rest must reject");
assert.equal(canonical(originalId),noOpBefore);
console.log("PASS T39-ORIGINAL-REST-CONTROL: original complete no-op inert, early replacement denied");

sql(candidateFn);
sql("NOTIFY pgrst,'reload schema'");
assert.notEqual(sql("SELECT md5(pg_get_functiondef('public.configure_character_weapon_mastery_v1(uuid,uuid[])'::regprocedure))"),originalMd5);
assert.equal(sql("SELECT md5(pg_get_functiondef('public.get_character_weapon_mastery_v1(uuid)'::regprocedure))"),getMd5);
assert.equal(sql("SELECT has_function_privilege('authenticated','public.configure_character_weapon_mastery_v1(uuid,uuid[])','EXECUTE')"),"t");
assert.equal(sql("SELECT has_function_privilege('anon','public.configure_character_weapon_mastery_v1(uuid,uuid[])','EXECUTE')"),"f");
console.log("PASS T39-OPTION-A-SOURCE: explicitly NON-ORIGINAL one-clause account mirror removal, original getter/ACL unchanged");

const redHashAfter=canonical(originalId),secondBeforeGreen=canonical(secondId);
const safe=await rpc(greenOwner,first,secondId);
assert.ifError(safe.error);
assert.equal(safe.data?.capacity,3);assert.equal(safe.data?.selectedCount,3);
assert.equal(sql("SELECT jsonb_array_length(sheet->'weaponMasteries') FROM public.character_sheets WHERE character_id="+q(secondId)),"3");
assert.equal(sql("SELECT jsonb_array_length(state->'selections') FROM public.character_runtime_feature_choices "+
  "WHERE character_id="+q(secondId)+" AND feature_key='class-weapon-mastery'"),"3");
assert.notEqual(canonical(secondId),secondBeforeGreen);
assert.equal(canonical(originalId),redHashAfter);
assert.equal(account(greenOwner.id),greenOwnerBefore);
assert.equal(account(greenLinked.id),greenLinkedBefore);
console.log("PASS T39-OPTION-A-SIGNED-GREEN: original runtime/canonical target works for SECOND character; both linked historical account Sheets frozen");

const beforeNoOp=canonical(secondId);
const noOp=await rpc(greenOwner,first,secondId);assert.ifError(noOp.error);
assert.equal(canonical(secondId),beforeNoOp);
const invalid=await rpc(greenOwner,[weapons[0],weapons[0],weapons[1]],secondId);
assert.ok(invalid.error);
const sourceInvalid=await rpc(greenOwner,[weapons[0],weapons[1],randomUUID()],secondId);
assert.ok(sourceInvalid.error);
const noRest=await rpc(greenOwner,swapped,secondId);assert.ok(noRest.error);
assert.equal(canonical(secondId),beforeNoOp);
assert.equal(account(greenOwner.id),greenOwnerBefore);
assert.equal(account(greenLinked.id),greenLinkedBefore);
console.log("PASS T39-OPTION-A-NEGATIVES: no-op and rejected forged/duplicate/early-swap preserve canonical and both account histories");

sql("INSERT INTO public.character_rest_log(character_id,rest_type,completed_by,completed_at) VALUES("+
  q(secondId)+",'long_rest',"+q(greenOwner.id)+",clock_timestamp())");
const switched=await rpc(greenOwner,swapped,secondId);
assert.ifError(switched.error);
assert.equal(switched.data?.selectedCount,3);
assert.equal(switched.data?.changedExisting,1);
assert.equal(account(greenOwner.id),greenOwnerBefore);
assert.equal(account(greenLinked.id),greenLinkedBefore);
assert.equal(canonical(originalId),redHashAfter);
const secondSwap=[weapons[3],weapons[0],weapons[2]];
const doubleSwap=await rpc(greenOwner,secondSwap,secondId);
assert.ok(doubleSwap.error,"Cannot change a second mastered weapon without another Long Rest");
const afterRest=canonical(secondId);
assert.equal(account(greenOwner.id),greenOwnerBefore);
assert.equal(account(greenLinked.id),greenLinkedBefore);
console.log("PASS T39-OPTION-A-LONG-REST: one legal replacement after signed new Long Rest; second swap fails without new rest; account snapshots unchanged");

sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+q(secondId)+
  " AND user_id="+q(greenOwner.id));
const revoked=await rpc(greenOwner,first,secondId);
assert.ok(revoked.error,"Same signed JWT must lose access when its database grant is revoked");
assert.equal(revoked.error.code,"42501");
assert.equal(canonical(secondId),afterRest);
assert.equal(account(greenOwner.id),greenOwnerBefore);
assert.equal(account(greenLinked.id),greenLinkedBefore);
const greenOutsider=await rpc(outsider,first,secondId);
assert.ok(greenOutsider.error);
assert.equal(canonical(originalId),redHashAfter);
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
console.log("PASS T39-OPTION-A-REVOKE: same JWT denied on grant revocation, outsider denied, source-original progression/rest and Sheet isolation retained");
console.log("PASS T39 ORIGINAL-SIGNED-RED / EXPLICIT NON-ORIGINAL-OPTION-A-SIGNED-GREEN; research only, no production migration, no paid agent, world map unchanged");
