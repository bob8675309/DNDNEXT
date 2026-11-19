#!/usr/bin/env node
// T41: original signed public Rest orchestration / private Rage restoration
// source-original RED and explicitly NON-ORIGINAL Option A GREEN in local PG17.
// Extends historical #364 I1-P; retains #369 I2-E / T40 action evidence.
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
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  C34_T41_SIGNED_CONFIRM:"SIGNED_ORIGINAL_REST_ACCOUNT_MIRROR_LOCAL_ONLY"
}))assert.equal(env[key],value,"T41 unsafe execution environment: "+key);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.notEqual(env.VERCEL,"1");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const q=id=>{assert.match(id,/^[0-9a-f-]{36}$/i);return "'"+id+"'";};
const quoted=s=>"'"+String(s).replaceAll("'","''")+"'";
const blob=buffer=>crypto.createHash("sha1").update(Buffer.concat([
  Buffer.from("blob "+buffer.length+"\0"),buffer
])).digest("hex");
function source(filename,expected){
  const data=fs.readFileSync(path.join(root,filename));
  assert.equal(blob(data),expected,"T41 original Git blob drift: "+filename);
  return data.toString();
}
const rest=source("sql/20260810_90_rest_class_feature_restoration.sql",
  "2bd48d73398a3e9095b61ee288c0377d464edfc6");
const resources=source("sql/20260802_03_character_sheet_spell_resources.sql",
  "f96a3788334fe306374dfd4b5fdf4e00992d3924");
const guard=source("sql/20260802_06_character_resource_active_encounter_lock.sql",
  "be7844fe16b14b73f4fb03f68069f9eb0af3dbf8");
function sql(statement){
  const run=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{
    cwd:root,env,encoding:"utf8",timeout:35000
  });
  assert.equal(run.status,0,"T41 disposable SQL failed: "+String(run.stderr).slice(-2500));
  return run.stdout.trim();
}
function extractFn(src,name){
  const anchor="create or replace function "+name+"(";
  const start=src.toLowerCase().indexOf(anchor.toLowerCase());
  assert.ok(start>=0,"Missing source-original function "+name);
  const body=src.slice(start);
  const match=/\n(?:\$function\$|\$\$);/.exec(body);
  assert.ok(match,"Missing SQL source terminator for "+name);
  return body.slice(0,match.index+match[0].length);
}
function extractTable(src,name){
  const start=src.toLowerCase().indexOf(("create table if not exists "+name+" (").toLowerCase());
  assert.ok(start>=0,"Missing original table "+name);
  const end=src.indexOf("\n);",start);
  assert.ok(end>start);
  return src.slice(start,end+3);
}
function installOriginal(src,name){sql(extractFn(src,name));}
const accountMirror=[
  "  update public.players p",
  "  set sheet=v_sheet,updated_at=now()",
  "  where p.user_id in (",
  "    select cp.user_id",
  "    from public.character_permissions cp",
  "    where cp.character_id=p_character_id and cp.can_edit",
  "  );"
].join("\n");
const originalRest=extractFn(rest,"private.restore_character_rest_action_state_v1");
const originalPublic=extractFn(rest,"public.complete_character_rest_v1");
assert.equal(originalRest.split(accountMirror).length,2);
assert.ok(!originalPublic.includes("update public.players"));
const greenRest=originalRest.replace(accountMirror,
  "  -- T41 explicitly NON-ORIGINAL Option A: legacy account sheet is a frozen historical snapshot.");
assert.notEqual(greenRest,originalRest);
assert.ok(!greenRest.includes("update public.players"));
for(const invariant of [
  "for update of cs","v_class_source='XPHB' and p_rest_type='short_rest'",
  "elsif p_rest_type='long_rest'","where character_id=p_character_id",
  "'active',false","'restoredClassFeatureUses',v_restored"
])assert.ok(greenRest.includes(invariant),"Rest authority drift "+invariant);
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
async function actor(label,role){
  const who=client(),email="t41-"+label+"-"+randomUUID()+"@example.invalid";
  const password="T41-"+randomUUID()+"!";
  assert.ifError((await who.auth.signUp({email,password})).error);
  assert.ifError((await who.auth.signInWithPassword({email,password})).error);
  const user=await who.auth.getUser(),claims=await who.auth.getClaims();
  assert.ifError(user.error);assert.ifError(claims.error);
  const id=user.data.user.id;
  assert.equal(claims.data.claims.sub,id);
  assert.equal(claims.data.claims.role,"authenticated");
  sql("INSERT INTO public.user_profiles(id,role) VALUES("+q(id)+","+quoted(role)+
    ") ON CONFLICT (id) DO UPDATE SET role=excluded.role");
  return {who,id};
}
async function rpc(who,id,type){
  let result;
  for(let attempt=0;attempt<35;attempt++){
    result=await who.who.rpc("complete_character_rest_v1",{
      p_character_id:id,p_rest_type:type
    });
    if(result.error?.code!=="PGRST202")break;
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  assert.notEqual(result.error?.code,"PGRST202","T41 Rest RPC unavailable in signed PostgREST");
  return result;
}
async function makeCharacter(gm,label,classId,classKey,sourceBook,uses=3,remaining=0){
  const created=await gm.who.rpc("create_character_v1",{p_payload:{
    name:"T41 "+label+" "+randomUUID().slice(0,8),kind:"npc",
    creation_request_id:randomUUID(),description:"Local REST fixture",
    secret:"private T41 synthetic test",
    sheet:{classKey,classSource:sourceBook,level:5,rages:uses,
      marker:"T41 "+label,actionState:classKey==="barbarian"?
        {rage:{active:true,usesRemaining:remaining,usesMax:uses}}:{}}
  }});
  assert.ifError(created.error);
  const id=created.data;assert.match(id,/^[0-9a-f-]{36}$/i);
  sql("INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points) VALUES("+
    q(id)+","+q(classId)+",5,0) ON CONFLICT(character_id) DO UPDATE SET "+
    "class_id=excluded.class_id,class_level=excluded.class_level");
  assert.equal(sql("SELECT lower(class_key) FROM public.class_catalog WHERE id="+q(classId)),
    classKey.toLowerCase());
  assert.equal(sql("SELECT sheet->>'classKey' FROM public.character_sheets WHERE character_id="+q(id)),classKey);
  return id;
}
function link(id,who,edit=true){
  sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) "+
    "VALUES("+q(id)+","+q(who.id)+","+(edit?"true":"false")+",false,false) "+
    "ON CONFLICT(character_id,user_id) DO UPDATE SET can_edit=excluded.can_edit");
}
function history(who,marker){
  sql("INSERT INTO public.players(user_id,name,sheet) VALUES("+
    q(who.id)+","+quoted(marker)+","+
    quoted(JSON.stringify({marker,legacyCharacter:"DIFFERENT_PREVIOUS_CHARACTER"}))+"::jsonb)");
  assert.equal(sql("SELECT sheet->>'marker' FROM public.players WHERE user_id="+q(who.id)),marker);
}
const canonical=id=>sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+q(id));
const legacy=who=>sql("SELECT md5(sheet::text) FROM public.players WHERE user_id="+q(who.id));
const state=id=>JSON.parse(sql("SELECT coalesce(sheet#>'{actionState,rage}','{}'::jsonb)::text "+
    "FROM public.character_sheets WHERE character_id="+q(id)));
const logCount=id=>Number(sql("SELECT count(*) FROM public.character_rest_log WHERE character_id="+q(id)));
function originalFingerprint(sig,expected){
  assert.equal(sql("SELECT md5(pg_get_functiondef("+quoted(sig)+"::regprocedure))"),
    expected,"T41 deployed-original source fingerprint mismatch: "+sig);
}
assert.equal(sql("SELECT current_database()"),"postgres");
assert.match(sql("SHOW server_version"),/^17\./);
assert.equal(sql("SELECT to_regclass('auth.users') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('private.can_manage_character_progression_v1(uuid)') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public.complete_character_rest_v1(uuid,text)') IS NULL"),"t");

// Source-exact original Rest dependencies; ONLY reduced missing tables/columns
// are added to this disposable, already-signed C34 PG17 schema.
sql("ALTER TABLE public.class_catalog ADD COLUMN IF NOT EXISTS caster_progression text");
for(const addition of [
  "id uuid DEFAULT gen_random_uuid()",
  "created_at timestamptz DEFAULT now()",
  "uses_max integer","uses_remaining integer","recharge text"
])sql("ALTER TABLE public.character_spells ADD COLUMN IF NOT EXISTS "+addition);
if(sql("SELECT to_regclass('public.character_spell_slots') IS NULL")==="t")
  sql(extractTable(resources,"public.character_spell_slots"));
if(sql("SELECT to_regclass('public.character_rest_log') IS NULL")==="t")
  sql(extractTable(resources,"public.character_rest_log"));
sql("ALTER TABLE public.character_spell_slots ENABLE ROW LEVEL SECURITY");
sql("ALTER TABLE public.character_rest_log ENABLE ROW LEVEL SECURITY");
sql("REVOKE ALL ON public.character_spell_slots FROM PUBLIC,anon,authenticated");
sql("REVOKE ALL ON public.character_rest_log FROM PUBLIC,anon,authenticated");
installOriginal(resources,"private.sync_character_spell_slots_v1");
installOriginal(resources,"private.character_sheet_resource_profile_json_v1");

// Install the original log/slot/use encounter veto handlers, NOT a fake veto.
// Only minimum scratch encounter tables are added for this inherited C34 fixture.
sql("CREATE TABLE IF NOT EXISTS public.encounters ("+
  "id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,status text,"+
  "version integer DEFAULT 1,updated_at timestamptz DEFAULT now())");
sql("CREATE TABLE IF NOT EXISTS public.encounter_participants ("+
  "id uuid PRIMARY KEY DEFAULT gen_random_uuid(),encounter_id uuid REFERENCES public.encounters(id),"+
  "character_id uuid REFERENCES public.characters(id))");
for(const col of ["name text","status text","version integer DEFAULT 1",
                  "updated_at timestamptz DEFAULT now()"])
  sql("ALTER TABLE public.encounters ADD COLUMN IF NOT EXISTS "+col);
installOriginal(guard,"private.character_active_encounter_v1");
installOriginal(guard,"private.assert_character_resource_not_active_v1");
installOriginal(guard,"private.guard_character_rest_insert_v1");
installOriginal(guard,"private.guard_character_spell_slot_update_v1");
installOriginal(guard,"private.guard_character_spell_use_update_v1");
sql("DROP TRIGGER IF EXISTS character_rest_active_encounter_guard ON public.character_rest_log; "+
    "CREATE TRIGGER character_rest_active_encounter_guard BEFORE INSERT ON public.character_rest_log "+
    "FOR EACH ROW EXECUTE FUNCTION private.guard_character_rest_insert_v1()");
sql("DROP TRIGGER IF EXISTS character_spell_slots_active_encounter_guard ON public.character_spell_slots; "+
    "CREATE TRIGGER character_spell_slots_active_encounter_guard BEFORE UPDATE OF slots_remaining "+
    "ON public.character_spell_slots FOR EACH ROW EXECUTE FUNCTION private.guard_character_spell_slot_update_v1()");
sql("DROP TRIGGER IF EXISTS character_spell_uses_active_encounter_guard ON public.character_spells; "+
    "CREATE TRIGGER character_spell_uses_active_encounter_guard BEFORE UPDATE OF uses_remaining "+
    "ON public.character_spells FOR EACH ROW EXECUTE FUNCTION private.guard_character_spell_use_update_v1()");
sql(originalRest);
sql(originalPublic);
sql("REVOKE ALL ON FUNCTION public.complete_character_rest_v1(uuid,text) FROM PUBLIC,anon");
sql("GRANT EXECUTE ON FUNCTION public.complete_character_rest_v1(uuid,text) TO authenticated");
sql("REVOKE ALL ON FUNCTION private.restore_character_rest_action_state_v1(uuid,text) "+
    "FROM PUBLIC,anon,authenticated");
sql("NOTIFY pgrst,'reload schema'");
originalFingerprint("private.sync_character_spell_slots_v1(uuid)",
  "6c276ab2135fb90894fd8684e39ce1c3");
originalFingerprint("private.character_sheet_resource_profile_json_v1(uuid)",
  "2c798f8351282d80e63ab8e9e9019272");
originalFingerprint("private.restore_character_rest_action_state_v1(uuid,text)",
  "d75edf2ac583e3790882155c702e2165");
originalFingerprint("public.complete_character_rest_v1(uuid,text)",
  "fffbf0705d640a7d2bfb08aa78ad521a");
assert.equal(sql("SELECT has_function_privilege('anon','public.complete_character_rest_v1(uuid,text)','EXECUTE')"),"f");
assert.equal(sql("SELECT has_function_privilege('authenticated','public.complete_character_rest_v1(uuid,text)','EXECUTE')"),"t");
assert.equal(sql("SELECT has_function_privilege('authenticated','private.restore_character_rest_action_state_v1(uuid,text)','EXECUTE')"),"f");
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgname='character_rest_active_encounter_guard' AND NOT tgisinternal"),"1");
console.log("PASS T41-ORIGINAL-SOURCE: migration90 and original spell/guard helpers source-fingerprinted; original public Rest, no world-map writer");

const admin=await actor("gm","gm");
const redEditor=await actor("red-editor","player"),outsider=await actor("outsider","player");
const safe=await actor("safe","player"),safeEditor=await actor("safe-editor","player");
const phbUser=await actor("phb","player"),wizardUser=await actor("wizard","player");
sql("INSERT INTO private.test_admins(id) VALUES("+q(admin.id)+") ON CONFLICT DO NOTHING");
const XPHB="00000000-0000-0000-0000-000000000041";
const PHB="00000000-0000-0000-0000-000000000042";
for(const [id,book] of [[XPHB,"XPHB"],[PHB,"PHB"]]){
  sql("INSERT INTO public.class_catalog(id,class_key,class_name,source,ruleset,hit_die) VALUES("+
     q(id)+",'barbarian','Barbarian',"+quoted(book)+","+
     quoted(book==="XPHB"?"2024":"2014")+",12)");
}
const redId=await makeCharacter(admin,"original-XPHB",XPHB,"barbarian","XPHB",3,0);
const safeId=await makeCharacter(admin,"option-A-XPHB",XPHB,"barbarian","XPHB",3,0);
const phbId=await makeCharacter(admin,"option-A-PHB",PHB,"barbarian","PHB",3,0);
const wizardId=await makeCharacter(admin,"wizard-resources",
  "00000000-0000-0000-0000-000000000002","wizard","XPHB",0,0);
link(redId,admin);link(redId,redEditor);
link(safeId,safe);link(safeId,safeEditor);link(phbId,phbUser);link(wizardId,wizardUser);
for(const [who,marker] of [
  [admin,"T41_ORIGINAL_ADMIN_HISTORY"],[redEditor,"T41_ORIGINAL_COEDITOR_HISTORY"],
  [safe,"T41_SAFE_OWNER_HISTORY"],[safeEditor,"T41_SAFE_EDITOR_HISTORY"],
  [phbUser,"T41_PHB_OWNER_HISTORY"],[wizardUser,"T41_WIZARD_OWNER_HISTORY"]
])history(who,marker);
const historicalAdmin=legacy(admin),historicalEditor=legacy(redEditor);
const frozenSafe=legacy(safe),frozenEditor=legacy(safeEditor);
const frozenPHB=legacy(phbUser),frozenWizard=legacy(wizardUser);
const wizardBefore=canonical(wizardId),phbBefore=canonical(phbId);
const redBefore=canonical(redId);
for(const [who,id,type] of [[outsider,redId,"short_rest"],[admin,redId,"nap"]]){
  const res=await rpc(who,id,type);assert.ok(res.error);
  assert.equal(res.error.code,type==="nap"?"22023":"42501");
}
const anonymous=await client().rpc("complete_character_rest_v1",{
  p_character_id:redId,p_rest_type:"short_rest"
});
assert.ok(anonymous.error);
assert.equal(canonical(redId),redBefore);
assert.equal(legacy(admin),historicalAdmin);assert.equal(legacy(redEditor),historicalEditor);
assert.equal(logCount(redId),0);
console.log("PASS T41-ORIGINAL-NEGATIVES: outsider, anonymous, invalid type fail before canonical, log or legacy writes");

let result=await rpc(admin,redId,"short_rest");
assert.ifError(result.error);
assert.equal(result.data?.restResult?.restoredClassFeatureUses,1);
assert.equal(result.data?.restResult?.restType,"short_rest");
assert.equal(state(redId).usesRemaining,1);
assert.equal(state(redId).active,false);
assert.equal(logCount(redId),1);
assert.equal(legacy(admin),canonical(redId));
assert.equal(legacy(redEditor),canonical(redId));
assert.notEqual(legacy(admin),historicalAdmin);
assert.notEqual(legacy(redEditor),historicalEditor);
assert.equal(canonical(wizardId),wizardBefore);
assert.equal(canonical(phbId),phbBefore);
console.log("PASS T41-ORIGINAL-SIGNED-RED: original public Short Rest + private Rage writer clobbers TWO unrelated linked historical accounts");

const publicMd5=sql("SELECT md5(pg_get_functiondef('public.complete_character_rest_v1(uuid,text)'::regprocedure))");
sql(greenRest);
sql("NOTIFY pgrst,'reload schema'");
assert.notEqual(sql("SELECT md5(pg_get_functiondef('private.restore_character_rest_action_state_v1(uuid,text)'::regprocedure))"),
  "d75edf2ac583e3790882155c702e2165");
assert.equal(sql("SELECT md5(pg_get_functiondef('public.complete_character_rest_v1(uuid,text)'::regprocedure))"),publicMd5);
assert.equal(sql("SELECT has_function_privilege('authenticated','private.restore_character_rest_action_state_v1(uuid,text)','EXECUTE')"),"f");
console.log("PASS T41-OPTION-A-SOURCE: only private Rest full-account projection omitted locally; public Rest and source Rage/rest math untouched");

result=await rpc(safe,safeId,"short_rest");assert.ifError(result.error);
assert.equal(result.data.restResult.restoredClassFeatureUses,1);
assert.equal(state(safeId).usesRemaining,1);assert.equal(state(safeId).active,false);
assert.equal(legacy(safe),frozenSafe);assert.equal(legacy(safeEditor),frozenEditor);
result=await rpc(safeEditor,safeId,"short_rest");assert.ifError(result.error);
assert.equal(result.data.restResult.restoredClassFeatureUses,1);
assert.equal(state(safeId).usesRemaining,2);
result=await rpc(safeEditor,safeId,"long_rest");assert.ifError(result.error);
assert.equal(result.data.restResult.restoredClassFeatureUses,1);
assert.equal(state(safeId).usesRemaining,3);
assert.equal(logCount(safeId),3);
assert.equal(legacy(safe),frozenSafe);assert.equal(legacy(safeEditor),frozenEditor);
console.log("PASS T41-OPTION-A-XPHB: genuine owner and coeditor +1 each short rest, full long refill, logs and both historical accounts frozen");

result=await rpc(phbUser,phbId,"short_rest");assert.ifError(result.error);
assert.equal(result.data.restResult.restoredClassFeatureUses,0);
assert.equal(state(phbId).usesRemaining,0);
assert.equal(state(phbId).active,false);
result=await rpc(phbUser,phbId,"long_rest");assert.ifError(result.error);
assert.equal(result.data.restResult.restoredClassFeatureUses,3);
assert.equal(state(phbId).usesRemaining,3);
assert.equal(logCount(phbId),2);
assert.equal(legacy(phbUser),frozenPHB);
console.log("PASS T41-OPTION-A-PHB: PHB short grants no Rage use, long fully restores, historical account remains frozen");

// Source-original spell-slot helper and limited-use restoration for a real
// non-Barbarian Rest caller. A Wizard source slot array is scratch data only.
sql("UPDATE public.class_level_progression SET spell_slots='[2]'::jsonb "+
  "WHERE class_id='00000000-0000-0000-0000-000000000002' AND class_level=1");
sql("UPDATE public.character_progression SET class_level=1 WHERE character_id="+q(wizardId));
sql("SELECT private.sync_character_spell_slots_v1("+q(wizardId)+")");
const spellId="00000000-0000-0000-0000-000000000943";
sql("INSERT INTO public.spells_catalog(id,name,level,classes,source) VALUES("+
  q(spellId)+",'T41 Synthetic Test Spell',1,ARRAY['Wizard'],'XPHB')");
sql("INSERT INTO public.character_spells(character_id,spell_id,source_type,source_label,"+
  "prepared,always_available,casting_stat,raw_payload,source_key,known,"+
  "uses_max,uses_remaining,recharge) VALUES("+
  q(wizardId)+","+q(spellId)+",'class','T41',true,false,'int','{}'::jsonb,"+
  "'class',true,2,0,'short_rest')");
sql("UPDATE public.character_spell_slots SET slots_remaining=0 WHERE character_id="+q(wizardId));
assert.equal(sql("SELECT slots_remaining FROM public.character_spell_slots WHERE character_id="+q(wizardId)),"0");
const wizardResourceBefore=canonical(wizardId);
result=await rpc(wizardUser,wizardId,"short_rest");assert.ifError(result.error);
assert.equal(result.data.restResult.restoredClassFeatureUses,0);
assert.equal(result.data.restResult.restoredSpellUses,2);
assert.equal(result.data.restResult.restoredSpellSlots,0);
assert.equal(sql("SELECT slots_remaining FROM public.character_spell_slots WHERE character_id="+q(wizardId)),"0");
assert.equal(sql("SELECT uses_remaining FROM public.character_spells WHERE character_id="+q(wizardId)+
  " AND spell_id="+q(spellId)),"2");
assert.equal(canonical(wizardId),wizardResourceBefore);
assert.equal(legacy(wizardUser),frozenWizard);
result=await rpc(wizardUser,wizardId,"long_rest");assert.ifError(result.error);
assert.equal(result.data.restResult.restoredSpellSlots,2);
assert.equal(sql("SELECT slots_remaining FROM public.character_spell_slots WHERE character_id="+q(wizardId)),"2");
assert.equal(logCount(wizardId),2);
assert.equal(legacy(wizardUser),frozenWizard);
console.log("PASS T41-OPTION-A-RESOURCES: source-original non-Barbarian short spell-use, long slot restoration and rest logs unchanged");

// Source-original active encounter veto via BEFORE INSERT on rest log.
// This must undo the prior canonical Rage change in the same RPC transaction.
sql("UPDATE public.character_sheets SET sheet=jsonb_set(sheet,'{actionState,rage}',"+
  "'{\"active\":true,\"usesRemaining\":0,\"usesMax\":3}'::jsonb,true) WHERE character_id="+q(safeId));
const encounterId=randomUUID();
sql("INSERT INTO public.encounters(id,name,status,version) VALUES("+
  q(encounterId)+",'T41 synthetic active battle','active',1)");
sql("INSERT INTO public.encounter_participants(id,encounter_id,character_id) VALUES("+
  q(randomUUID())+","+q(encounterId)+","+q(safeId)+")");
const vetoCanonical=canonical(safeId),vetoLogs=logCount(safeId);
const blocked=await rpc(safeEditor,safeId,"short_rest");
assert.ok(blocked.error);assert.equal(blocked.error.code,"55000");
assert.equal(canonical(safeId),vetoCanonical);
assert.equal(logCount(safeId),vetoLogs);
assert.equal(legacy(safe),frozenSafe);assert.equal(legacy(safeEditor),frozenEditor);
sql("UPDATE public.encounters SET status='completed' WHERE id="+q(encounterId));
result=await rpc(safeEditor,safeId,"short_rest");assert.ifError(result.error);
assert.equal(state(safeId).usesRemaining,1);
assert.equal(logCount(safeId),vetoLogs+1);
console.log("PASS T41-OPTION-A-ENCOUNTER: exact-original active-encounter trigger veto rolls back Rage and log atomically; complete encounter allows rest");

// Same JWT must immediately lose delegated edit privilege, with another
// previously linked editor retaining character-scoped access.
const beforeRevocation=canonical(safeId),beforeLogs=logCount(safeId);
sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+
  q(safeId)+" AND user_id="+q(safe.id));
const revoked=await rpc(safe,safeId,"short_rest");
assert.ok(revoked.error);assert.equal(revoked.error.code,"42501");
const denied=await rpc(outsider,safeId,"short_rest");
assert.ok(denied.error);assert.equal(denied.error.code,"42501");
assert.equal(canonical(safeId),beforeRevocation);assert.equal(logCount(safeId),beforeLogs);
result=await rpc(safeEditor,safeId,"long_rest");assert.ifError(result.error);
assert.equal(state(safeId).usesRemaining,3);
assert.equal(legacy(safe),frozenSafe);assert.equal(legacy(safeEditor),frozenEditor);
assert.equal(legacy(phbUser),frozenPHB);assert.equal(legacy(wizardUser),frozenWizard);
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
console.log("PASS T41-OPTION-A-REVOKE: same JWT editor revoked, outsider denied, second editor continues, unrelated histories and world-map untouched");
console.log("PASS T41: original Rest RED and deliberately NON-ORIGINAL one-clause Rest Option A GREEN in disposable signed local PG17; release HOLD");
