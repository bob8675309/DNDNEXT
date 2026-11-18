#!/usr/bin/env node
// T40: source-original standalone Rage RPC signed RED and single-clause,
// explicitly NON-ORIGINAL Option A GREEN. Paired rest writer is NOT fixed.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto,{randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createClient} from "@supabase/supabase-js";

const env=process.env;
for(const [k,v] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 C34_T40_SIGNED_CONFIRM:"SIGNED_ORIGINAL_RAGE_ACTION_LOCAL_ONLY"
}))assert.equal(env[k],v,"T40 refuses unsafe environment: "+k);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.notEqual(env.VERCEL,"1");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const q=id=>{assert.match(id,/^[0-9a-f-]{36}$/i);return "'"+id+"'";};
const sq=s=>"'"+String(s).replaceAll("'","''")+"'";
function sql(s){
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",s],{
  cwd:root,env,encoding:"utf8",timeout:30000
 });
 assert.equal(r.status,0,"T40 disposable SQL: "+String(r.stderr).slice(-1600));
 return r.stdout.trim();
}
function sqlFile(p){
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-q","-f",p],{
  cwd:root,env,encoding:"utf8",timeout:35000
 });
 assert.equal(r.status,0,"T40 original SQL: "+String(r.stderr).slice(-1600));
}
const blob=b=>crypto.createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
const raw=fs.readFileSync(path.join(root,"sql/20260802_02_character_sheet_feature_actions.sql"));
const rest=fs.readFileSync(path.join(root,"sql/20260810_90_rest_class_feature_restoration.sql"));
assert.equal(blob(raw),"a7e432a0f6be939f038a7926f81e9b81e36a903b");
assert.equal(blob(rest),"2bd48d73398a3e9095b61ee288c0377d464edfc6");
const content=raw.toString();
const a=content.indexOf("create or replace function public.update_character_sheet_action_state_v1(");
const e=content.indexOf("\n$$;",a);
assert.ok(a>0&&e>a);
const original=content.slice(a,e+4);
const mirror=[
 "  update public.players p",
 "  set sheet=v_sheet,updated_at=now()",
 "  where p.user_id in (",
 "    select cp.user_id",
 "    from public.character_permissions cp",
 "    where cp.character_id=p_character_id and cp.can_edit",
 "  );"
].join("\n");
assert.equal(original.split(mirror).length,2,"T40 original account mirror must be present once");
assert.ok(rest.toString().includes(mirror),"T40 must preserve provenance of the separate rest writer");
const candidate=original.replace(mirror,
 "  -- T40 deliberately NON-ORIGINAL Option A: do not overwrite linked account legacy sheets.");
assert.notEqual(candidate,original);
assert.ok(!candidate.includes("update public.players p"));
assert.match(candidate,/update public\.character_sheets\s+set sheet=v_sheet,updated_at=now\(\)\s+where character_id=p_character_id;/);
assert.match(candidate,/v_operation not in \('activate','deactivate','reset'\)/);
assert.match(candidate,/private\.can_manage_character_progression_v1\(p_character_id\)/);
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
async function actor(label,role){
 const who=client(),email="t40-"+label+"-"+randomUUID()+"@example.invalid",password="T40-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const identity=await who.auth.getUser();assert.ifError(identity.error);
 const jwt=await who.auth.getClaims();assert.ifError(jwt.error);
 const id=identity.data.user.id;assert.equal(jwt.data.claims.sub,id);
 assert.equal(jwt.data.claims.role,"authenticated");
 sql("INSERT INTO public.user_profiles(id,role) VALUES("+q(id)+","+sq(role)+
  ") ON CONFLICT(id) DO UPDATE SET role=excluded.role");
 return {who,id};
}
async function character(manager,label,classKey="barbarian",rages=3){
 const out=await manager.who.rpc("create_character_v1",{p_payload:{
  name:"T40 "+label+" "+randomUUID().slice(0,8),kind:"npc",
  creation_request_id:randomUUID(),
  description:"T40 local standalone Sheet action test",secret:"T40 PRIVATE",
  sheet:{classKey,level:5,classSource:"XPHB",rages,
    marker:"T40 "+label,actionState:{}}
 }});
 assert.ifError(out.error);
 assert.match(out.data,/^[0-9a-f-]{36}$/i);
 assert.equal(sql("SELECT sheet->>'classKey' FROM public.character_sheets WHERE character_id="+q(out.data)),classKey);
 return out.data;
}
function link(cid,who,edit=true){
 sql("INSERT INTO public.character_permissions"+
  "(character_id,user_id,can_edit,can_inventory,can_convert) VALUES("+
  q(cid)+","+q(who.id)+","+(edit?"true":"false")+",false,false) "+
  "ON CONFLICT(character_id,user_id) DO UPDATE SET can_edit=excluded.can_edit");
}
function history(who,marker){
 sql("INSERT INTO public.players(user_id,name,sheet) VALUES("+
 q(who.id)+","+sq(marker)+","+sq(JSON.stringify({marker,legacyCharacter:"HISTORIC_DIFFERENT"}))+"::jsonb)");
 assert.equal(sql("SELECT sheet->>'marker' FROM public.players WHERE user_id="+q(who.id)),marker);
}
const md5=(table,where)=>sql("SELECT md5(sheet::text) FROM "+table+" WHERE "+where);
const canonical=id=>md5("public.character_sheets","character_id="+q(id));
const account=who=>md5("public.players","user_id="+q(who.id));
const state=id=>JSON.parse(sql("SELECT coalesce(sheet#>'{actionState,rage}','{}'::jsonb)::text "+
 "FROM public.character_sheets WHERE character_id="+q(id)));
async function action(who,id,op="activate",key="rage"){
 let result;
 for(let n=0;n<35;n++){
  result=await who.who.rpc("update_character_sheet_action_state_v1",{
   p_character_id:id,p_action_key:key,p_operation:op
  });
  if(result.error?.code!=="PGRST202")break;
  await new Promise(resolve=>setTimeout(resolve,300));
 }
 assert.notEqual(result.error?.code,"PGRST202","T40 signed PostgREST action never available");
 return result;
}
assert.equal(sql("SELECT current_database()"),"postgres");
assert.match(sql("SHOW server_version"),/^17\./);
assert.equal(sql("SELECT to_regclass('auth.users') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('private.can_manage_character_progression_v1(uuid)') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public.create_character_v1(jsonb)') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
sqlFile("sql/20260802_02_character_sheet_feature_actions.sql");
sql("NOTIFY pgrst,'reload schema'");
assert.equal(sql("SELECT has_function_privilege('anon','public.update_character_sheet_action_state_v1(uuid,text,text)','EXECUTE')"),"f");
assert.equal(sql("SELECT has_function_privilege('authenticated','public.update_character_sheet_action_state_v1(uuid,text,text)','EXECUTE')"),"t");
const originalHash=sql("SELECT md5(pg_get_functiondef('public.update_character_sheet_action_state_v1(uuid,text,text)'::regprocedure))");
console.log("PASS T40-SETUP: pinned original feature-action RPC and distinct rest writer, signed disposable PG17");

const gm=await actor("gm","gm"),editor=await actor("linked-editor","player");
const outsider=await actor("outsider","player"),safe=await actor("safe-editor","player"),safeOther=await actor("safe-coeditor","player");
sql("INSERT INTO private.test_admins(id) VALUES("+q(gm.id)+") ON CONFLICT DO NOTHING");
const redId=await character(gm,"original-rage");
const greenId=await character(gm,"candidate-rage");
const fighterId=await character(gm,"non-barbarian","fighter",0);
link(redId,gm);link(redId,editor);
link(greenId,safe);link(greenId,safeOther);
history(gm,"T40_ORIGINAL_OWNER_FROZEN");
history(editor,"T40_ORIGINAL_EDITOR_FROZEN");
history(safe,"T40_OPTION_A_OWNER_FROZEN");
history(safeOther,"T40_OPTION_A_EDITOR_FROZEN");
const redBefore=canonical(redId),greenBefore=canonical(greenId),fighterBefore=canonical(fighterId);
const gmBefore=account(gm),editorBefore=account(editor),safeBefore=account(safe),otherBefore=account(safeOther);
for(const [who,id,op,key] of [
 [outsider,redId,"activate","rage"],
 [gm,redId,"charge","rage"],
 [gm,redId,"activate","invented-feature"],
 [gm,fighterId,"activate","rage"]
]){
 const r=await action(who,id,op,key);
 assert.ok(r.error,"T40 original invalid request not rejected "+op+" / "+key);
}
const anon=await client().rpc("update_character_sheet_action_state_v1",{
 p_character_id:redId,p_action_key:"rage",p_operation:"activate"
});
assert.ok(anon.error);
assert.equal(canonical(redId),redBefore);
assert.equal(canonical(greenId),greenBefore);
assert.equal(canonical(fighterId),fighterBefore);
assert.equal(account(gm),gmBefore);assert.equal(account(editor),editorBefore);
console.log("PASS T40-ORIGINAL-NEGATIVES: outsider, anonymous, invalid operation/action and non-Barbarian denied before account writes");

let r=await action(gm,redId);
assert.ifError(r.error);
assert.equal(r.data?.actionKey,"rage");
assert.equal(r.data?.active,true);
assert.equal(r.data?.usesRemaining,2);
assert.equal(r.data?.usesMax,3);
assert.equal(state(redId).usesRemaining,2);
assert.equal(canonical(greenId),greenBefore);
assert.equal(canonical(fighterId),fighterBefore);
assert.notEqual(gmBefore,canonical(redId));
assert.notEqual(editorBefore,canonical(redId));
assert.equal(account(gm),canonical(redId),"ORIGINAL RED overwritten legacy GM history");
assert.equal(account(editor),canonical(redId),"ORIGINAL RED overwritten separate coeditor history");
console.log("PASS T40-ORIGINAL-SIGNED-RED: authentic source Rage activate copies entire canonical target Sheet over TWO different linked historical account sheets");

r=await action(editor,redId,"deactivate");assert.ifError(r.error);
assert.equal(r.data?.active,false);assert.equal(r.data?.usesRemaining,2);
assert.equal(account(gm),canonical(redId));assert.equal(account(editor),canonical(redId));
console.log("PASS T40-ORIGINAL-COEDITOR: linked editor can deactivate original source action; broad account mirror confirmed again");

sql(candidate);
sql("NOTIFY pgrst,'reload schema'");
assert.notEqual(sql("SELECT md5(pg_get_functiondef('public.update_character_sheet_action_state_v1(uuid,text,text)'::regprocedure))"),originalHash);
assert.equal(sql("SELECT has_function_privilege('anon','public.update_character_sheet_action_state_v1(uuid,text,text)','EXECUTE')"),"f");
assert.equal(sql("SELECT has_function_privilege('authenticated','public.update_character_sheet_action_state_v1(uuid,text,text)','EXECUTE')"),"t");
console.log("PASS T40-OPTION-A-SOURCE: only original linked-account full-sheet projection removed, source RPC/permission/response intact");

r=await action(safe,greenId);
assert.ifError(r.error);
assert.equal(r.data?.active,true);assert.equal(r.data?.usesRemaining,2);
assert.equal(state(greenId).usesRemaining,2);
assert.notEqual(canonical(greenId),greenBefore);
assert.equal(account(safe),safeBefore);assert.equal(account(safeOther),otherBefore);
const redAfter=canonical(redId);
assert.equal(canonical(fighterId),fighterBefore);
console.log("PASS T40-OPTION-A-SIGNED-GREEN: source Rage action updates scoped canonical Sheet; both distinct linked historic accounts remain frozen");

r=await action(safeOther,greenId,"deactivate");assert.ifError(r.error);
assert.equal(r.data?.usesRemaining,2);assert.equal(r.data?.active,false);
r=await action(safeOther,greenId,"activate");assert.ifError(r.error);
assert.equal(r.data?.usesRemaining,1);
r=await action(safeOther,greenId,"activate");assert.ifError(r.error);
assert.equal(r.data?.usesRemaining,1,"already active must not consume again");
r=await action(safeOther,greenId,"deactivate");assert.ifError(r.error);
r=await action(safeOther,greenId,"activate");assert.ifError(r.error);
assert.equal(r.data?.usesRemaining,0);
r=await action(safeOther,greenId,"deactivate");assert.ifError(r.error);
const exhausted=await action(safeOther,greenId,"activate");
assert.ok(exhausted.error);assert.equal(exhausted.error.code,"22023");
assert.equal(state(greenId).usesRemaining,0);
assert.equal(account(safe),safeBefore);assert.equal(account(safeOther),otherBefore);
console.log("PASS T40-OPTION-A-RESOURCE: coeditor activate/deactivate, active no-op and zero-use rejection preserve account and canonical isolation");

r=await action(safe,greenId,"reset");assert.ifError(r.error);
assert.equal(r.data?.usesRemaining,3);assert.equal(r.data?.active,false);
for(const [op,key] of [["charge","rage"],["activate","invalid"],["activate",""]]){
 const bad=await action(safe,greenId,op,key);assert.ok(bad.error);
}
assert.equal(state(greenId).usesRemaining,3);
assert.equal(account(safe),safeBefore);assert.equal(account(safeOther),otherBefore);
console.log("PASS T40-OPTION-A-RESET: original standalone reset and invalid actions preserve frozen account snapshots; rest path NOT tested");

sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+q(greenId)+" AND user_id="+q(safe.id));
const beforeRevoke=canonical(greenId);
const revoked=await action(safe,greenId,"activate");
assert.ok(revoked.error);assert.equal(revoked.error.code,"42501","revocation must take effect on existing JWT");
const denied=await action(outsider,greenId,"activate");assert.ok(denied.error);
assert.equal(canonical(greenId),beforeRevoke);
const permitted=await action(safeOther,greenId,"activate");
assert.ifError(permitted.error);assert.equal(permitted.data?.usesRemaining,2);
assert.equal(canonical(redId),redAfter);
assert.equal(canonical(fighterId),fighterBefore);
assert.equal(account(safe),safeBefore);assert.equal(account(safeOther),otherBefore);
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
console.log("PASS T40-OPTION-A-REVOKE: same JWT loses character edit right, outsider denied, permitted editor still works, account isolation preserved");
console.log("PASS T40 ORIGINAL ACTION SIGNED RED / DELIBERATE NON-ORIGINAL OPTION A ACTION GREEN; separate rest writer still HOLD, no production SQL or world map");
