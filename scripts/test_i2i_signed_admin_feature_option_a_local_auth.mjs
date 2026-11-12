#!/usr/bin/env node
// I2-I genuine signed Admin grant through ORIGINAL public.grant_character_option_v1
// invoking ORIGINAL private.sync_admin_feature_array_v1, source RED then narrow
// reversible Option A scratch GREEN. Reduced P1.3 PG17 source fixture, real
// GoTrue/PostgREST. NO production DB connection, migration, or permission change.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";

const e=process.env;
for(const [k,v] of Object.entries({
  GITHUB_ACTIONS:"true",CI:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGDATABASE:"postgres",DNDNEXT_I2I_LOCAL_CONFIRM:"I2I_ORIGINAL_SIGNED_ADMIN_DISPOSABLE_ONLY"
}))assert.equal(e[k],v,"Unsafe I2I environment "+k);
assert.match(e.DNDNEXT_I2I_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_I2I_LOCAL_ANON_KEY);
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const psql=(args)=>{
 const p=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",...args],{
  encoding:"utf8",timeout:30000,env:{...e,PGUSER:"postgres"}
 });
 assert.equal(p.status,0,"Scratch PG17 SQL failure: "+p.stderr+"\n"+(p.stdout||"").slice(-500));
 return p.stdout.trim();
};
const sql=q=>psql(["-qAt","-c",q]);
const fixture=path=>psql(["-q","-f",path]);
const api=()=>createClient(e.DNDNEXT_I2I_LOCAL_URL,e.DNDNEXT_I2I_LOCAL_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const sheets=ch=>sql("SELECT sheet::text FROM public.character_sheets WHERE character_id="+quote(ch));
const legacy=w=>sql("SELECT sheet::text FROM public.players WHERE user_id="+quote(w.uid));
const timestamp=w=>sql("SELECT updated_at::text FROM public.players WHERE user_id="+quote(w.uid));
const history=users=>users.map(u=>({user:u,sheet:legacy(u),time:timestamp(u)}));
const frozen=(x,scenario)=>{for(const before of x){
 assert.equal(legacy(before.user),before.sheet,scenario+" historical legacy sheet "+before.user.name);
 assert.equal(timestamp(before.user),before.time,scenario+" historical timestamp "+before.user.name);
}};
const md5=sig=>sql("SELECT md5(pg_get_functiondef("+quote(sig)+"::regprocedure))");
const countGrant=(ch,opt)=>Number(sql("SELECT count(*) FROM public.character_option_grants WHERE character_id="+quote(ch)+" AND option_id="+quote(opt)));
const feature=(ch,path,name)=>sql("SELECT coalesce((sheet->"+quote(path)+") ? "+quote(name)+",false)::text FROM public.character_sheets WHERE character_id="+quote(ch));
const norm=ch=>sql("SELECT coalesce(jsonb_array_length(sheet->'adminGrantedFeats'),0)::text FROM public.character_sheets WHERE character_id="+quote(ch));
const originalHelper="f2b6190ecc9400772e054892f63cdc47";
const originalGrant="aa0f6a0c6c6a6f2b9aacf57bd40e434c";
const adminOpt="00000000-0000-0000-0000-000000008292";
const boonOpt="00000000-0000-0000-0000-000000008293";
const people=[];
const password="I2I-"+randomUUID()+"-Pass9!";
for(const name of ["admin","owner","coeditor","outsider","archive"]){
 const client=api(),email="i2i-"+randomUUID()+"@example.invalid";
 assert.ifError((await client.auth.signUp({email,password})).error);
 const login=await client.auth.signInWithPassword({email,password});assert.ifError(login.error);
 const user=await client.auth.getUser();assert.ifError(user.error);
 const claims=await client.auth.getClaims();assert.ifError(claims.error);
 assert.equal(user.data.user.id,login.data.user.id);
 assert.equal(claims.data.claims.sub,login.data.user.id);
 assert.equal(claims.data.claims.role,"authenticated");
 people.push({name,client,uid:login.data.user.id});
}
const [admin,owner,coeditor,outsider,archive]=people;
assert.equal(new Set(people.map(p=>p.uid)).size,5);
for(const u of people)sql("INSERT INTO public.players(user_id,sheet) VALUES("+quote(u.uid)+",'{}'::jsonb)");
sql("INSERT INTO public.user_profiles(id,role) VALUES("+quote(admin.uid)+",'admin')");
function addCharacter(name){
 const ch=randomUUID();
 const initial={classKey:"fighter",rulesetSource:"XPHB",ruleset:"2024",
 level:1,hp:12,maxHp:12,abilities:{con:{score:12}},
 meta:{classKey:"fighter",rulesetSource:"XPHB",level:1}};
 sql("INSERT INTO public.characters(id,name,kind) VALUES("+quote(ch)+","+quote(name)+",'npc');"+
 "INSERT INTO public.character_sheets(character_id,sheet) VALUES("+quote(ch)+","+
  quote(JSON.stringify(initial))+"::jsonb);"+
 "INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES"+
 "("+quote(ch)+","+quote(owner.uid)+",true),"+
 "("+quote(ch)+","+quote(coeditor.uid)+",true)");
 return ch;
}
const A=addCharacter("I2I old owner archive character A");
const B=addCharacter("I2I original signed Admin RED character B");
const C=addCharacter("I2I coeditor archive character C");
const D=addCharacter("I2I signed Admin GREEN character D");
const E=addCharacter("I2I denied and ACL-only character E");
const sheetA=sheets(A),sheetC=sheets(C);
const grant=(who,ch,opt=adminOpt,note="I2I original source")=>who.client.rpc("grant_character_option_v1",{
 p_character_id:ch,p_option_id:opt,p_notes:note
});
assert.equal(md5("private.sync_admin_feature_array_v1(uuid,text,text,boolean)"),originalHelper);
assert.equal(md5("public.grant_character_option_v1(uuid,uuid,text)"),originalGrant);
assert.equal(md5("private.current_user_is_admin()"),"1fc5fbcb121b2862eeab869edfb3a209");
assert.equal(md5("private.guard_direct_character_authority_mutation_v1()"),"04596b0a3fdfb71c1b357056e8c6023b");
assert.equal(sql("SELECT has_function_privilege('authenticated','public.grant_character_option_v1(uuid,uuid,text)','EXECUTE')"),"t");
assert.equal(sql("SELECT has_function_privilege('anon','public.grant_character_option_v1(uuid,uuid,text)','EXECUTE')"),"f");
console.log("PASS I2I-01 original public Admin grant and private feature writer exact MD5s, genuine signed entrypoint, role ACL and original guards");

sql("UPDATE public.players SET sheet=(SELECT sheet FROM public.character_sheets WHERE character_id="+quote(A)+") WHERE user_id="+quote(owner.uid));
sql("UPDATE public.players SET sheet=(SELECT sheet FROM public.character_sheets WHERE character_id="+quote(C)+") WHERE user_id="+quote(coeditor.uid));
sql("UPDATE public.players SET sheet="+quote(JSON.stringify({legacy:"unmarked archived profile",level:11}))+"::jsonb WHERE user_id="+quote(archive.uid));
sql("UPDATE public.players SET sheet="+quote(JSON.stringify({legacy:"admin account independent",level:8}))+"::jsonb WHERE user_id="+quote(admin.uid));
const first=history(people);
for(const who of [owner,coeditor,outsider]){
 const denied=await grant(who,B,adminOpt,"not authorized");
 assert.ok(denied.error,who.name+" improperly allowed original Admin grant");
 assert.equal(denied.error.code,"42501");
}
const anon=await api().rpc("grant_character_option_v1",{
 p_character_id:B,p_option_id:adminOpt,p_notes:"anonymous"});
assert.ok(anon.error,"Anonymous user granted source-original Admin feat");
assert.equal(countGrant(B,adminOpt),0);
assert.equal(feature(B,"adminGrantedFeats","Lucky"),"false");
frozen(first,"denied nonadmin and anon");
console.log("PASS I2I-02 original signed non-Admin/coeditor/outsider and anonymous grant denied with no G/CS/account changes");

const red=await grant(admin,B,adminOpt,"Original signed RED");
assert.ifError(red.error);
assert.equal(red.data.grant.granted_by,admin.uid);
assert.equal(red.data.option.name,"Lucky");
assert.equal(countGrant(B,adminOpt),1);
assert.equal(feature(B,"adminGrantedFeats","Lucky"),"true");
assert.equal(norm(B),"1");
assert.equal(legacy(owner),sheets(B),"Original private source overwrites unrelated owner account");
assert.equal(legacy(coeditor),sheets(B),"Original private source overwrites unrelated coeditor account");
assert.notEqual(legacy(owner),first.find(x=>x.user===owner).sheet);
assert.notEqual(legacy(coeditor),first.find(x=>x.user===coeditor).sheet);
assert.equal(sheets(A),sheetA);assert.equal(sheets(C),sheetC);
assert.equal(legacy(archive),first.find(x=>x.user===archive).sheet);
assert.equal(legacy(admin),first.find(x=>x.user===admin).sheet);
assert.equal(md5("private.sync_admin_feature_array_v1(uuid,text,text,boolean)"),originalHelper);
console.log("PASS I2I-03 ORIGINAL RED: genuine signed Admin grants Lucky correctly in G/CS but original private Admin helper clobbers TWO unrelated editable legacy account sheets");

fixture("scripts/fixtures/i2i_option_a_admin_feature_scratch_pg17.sql");
const changed=sql("SELECT pg_get_functiondef('private.sync_admin_feature_array_v1(uuid,text,text,boolean)'::regprocedure)");
assert.ok(changed.includes("I2I_OPTION_A_NO_ADMIN_FEATURE_LEGACY_ACCOUNT_WRITE"));
assert.ok(!changed.toLowerCase().includes("update public.players"));
assert.notEqual(md5("private.sync_admin_feature_array_v1(uuid,text,text,boolean)"),originalHelper);
assert.equal(md5("public.grant_character_option_v1(uuid,uuid,text)"),originalGrant);
assert.equal(md5("private.guard_direct_character_authority_mutation_v1()"),"04596b0a3fdfb71c1b357056e8c6023b");
console.log("PASS I2I-04 one original source-reversible local account UPDATE no-oped after RED, public Admin RPC and authority guard unchanged");

sql("UPDATE public.players SET sheet=(SELECT sheet FROM public.character_sheets WHERE character_id="+quote(D)+"),updated_at=now() WHERE user_id="+quote(owner.uid));
sql("UPDATE public.players SET sheet=(SELECT sheet FROM public.character_sheets WHERE character_id="+quote(C)+"),updated_at=now() WHERE user_id="+quote(coeditor.uid));
const after=history(people);
assert.equal(legacy(owner),sheets(D),"same-character archival sheet explicitly set");
const green=await grant(admin,D,adminOpt,"Signed scratch GREEN");
assert.ifError(green.error);
assert.equal(green.data.grant.granted_by,admin.uid);
assert.equal(countGrant(D,adminOpt),1);
assert.equal(feature(D,"adminGrantedFeats","Lucky"),"true");
assert.equal(norm(D),"1");
frozen(after,"signed Admin Option A GREEN");
assert.equal(sheets(A),sheetA);assert.equal(sheets(C),sheetC);
console.log("PASS I2I-05 SCRATCH GREEN: real signed Admin grants canonical Lucky and G provenance; same-character and unrelated historical account sheet/timestamp frozen");

const same=sql("SELECT id::text FROM public.character_option_grants WHERE character_id="+quote(D)+" AND option_id="+quote(adminOpt));
const again=await grant(admin,D,adminOpt,"Retained single grant, new note");
assert.ifError(again.error);
assert.equal(countGrant(D,adminOpt),1);
assert.equal(sql("SELECT id::text FROM public.character_option_grants WHERE character_id="+quote(D)+" AND option_id="+quote(adminOpt)),same);
assert.equal(sql("SELECT notes FROM public.character_option_grants WHERE character_id="+quote(D)+" AND option_id="+quote(adminOpt)),"Retained single grant, new note");
assert.equal(norm(D),"1");
frozen(after,"repeat source grant idempotency");
console.log("PASS I2I-06 repeat source-original signed Admin upsert preserves grant ID, no duplicate feat and frozen legacy accounts");

sql("INSERT INTO public.character_option_catalog(id,name,source,option_type,metadata) VALUES("+quote(boonOpt)+",'Boon of Fortitude','XPHB','boon','{}'::jsonb)");
const boon=await grant(admin,D,boonOpt,"Separate boon type");
assert.ifError(boon.error);
assert.equal(countGrant(D,boonOpt),1);
assert.equal(feature(D,"adminGrantedBoons","Boon of Fortitude"),"true");
assert.equal(feature(D,"adminGrantedFeats","Lucky"),"true");
frozen(after,"source boon branch");
console.log("PASS I2I-07 source-original authenticated Admin boon branch and feat coexist canonically; legacy snapshots unchanged");

const fakeOption=await grant(admin,E,randomUUID(),"unknown option");
assert.ok(fakeOption.error,"Unknown option succeeded");
const missing=await grant(admin,randomUUID(),adminOpt,"missing character");
assert.ok(missing.error,"Unknown target succeeded");
assert.equal(countGrant(E,adminOpt),0);
assert.equal(feature(E,"adminGrantedFeats","Lucky"),"false");
frozen(after,"invalid option and missing target rollback");
console.log("PASS I2I-08 invalid option and missing character fail atomically with no G/CS/account writes");

sql("UPDATE public.user_profiles SET role='player' WHERE id="+quote(admin.uid));
const revoked=await grant(admin,E,adminOpt,"same JWT revoked");
assert.ok(revoked.error);
assert.equal(revoked.error.code,"42501");
assert.equal(countGrant(E,adminOpt),0);
frozen(after,"admin role revocation");
console.log("PASS I2I-09 original live role lookup denies same signed JWT after Admin role revocation; G and all accounts frozen");

assert.equal(md5("public.grant_character_option_v1(uuid,uuid,text)"),originalGrant);
assert.equal(md5("public.complete_character_level_up_v5(uuid,jsonb)"),"02d74b973a763c53c595be20e35e512f");
assert.equal(sql("SELECT count(*) FROM public.character_option_grants WHERE character_id="+quote(D)),"2");
frozen(after,"original grant/version provenance");
console.log("PASS I2I-10 unchanged public Grant and v5 sources; one feat and one boon canonical, all snapshots still frozen");

// Separate, precisely limited database-role ACL risk characterization.
// LIVE read-only grants: authenticated has USAGE on private schema and EXECUTE
// on the original SECURITY DEFINER helper. The P1.3 local fixture revokes it.
// Restore those grants only inside a ROLLED-BACK isolated transaction and
// deliberately show an authenticated SQL role (not a real PostgREST endpoint)
// can invoke the helper without an Admin JWT or grant row. This is NOT proof
// that a production REST API exposes the private schema.
const beforeACL=sheets(E);
const aclBaseline=sql(
 "SELECT has_schema_privilege('authenticated','private','USAGE')::text||','||"+
 "has_function_privilege('authenticated','private.sync_admin_feature_array_v1(uuid,text,text,boolean)','EXECUTE')::text"
);
// psql -c with multiple commands only returns the last libpq result;
// the SELECT before ROLLBACK is not exposed to stdout. We must assert
// the effect INSIDE the same transaction before rollback, fail closed.
sql(
 "BEGIN;"+
 "GRANT USAGE ON SCHEMA private TO authenticated;"+
 "GRANT EXECUTE ON FUNCTION private.sync_admin_feature_array_v1(uuid,text,text,boolean) TO authenticated;"+
 "SET LOCAL ROLE authenticated;"+
 "SELECT private.sync_admin_feature_array_v1("+quote(E)+",'boon','SQL Role Test Only',true);"+
 "RESET ROLE;"+
 "DO $i2i_acl$ BEGIN "+
 "IF NOT EXISTS (SELECT 1 FROM public.character_sheets WHERE character_id="+quote(E)+
 " AND coalesce((sheet->'adminGrantedBoons') ? 'SQL Role Test Only',false))"+
 " THEN RAISE EXCEPTION 'I2I local authenticated SQL role did not project canonical boon'; END IF;"+
 " IF EXISTS (SELECT 1 FROM public.character_option_grants WHERE character_id="+quote(E)+
 ") THEN RAISE EXCEPTION 'I2I direct private helper unexpectedly added a grant row'; END IF;"+
 " END $i2i_acl$;"+
 "ROLLBACK;"
);
assert.equal(sql(
 "SELECT has_schema_privilege('authenticated','private','USAGE')::text||','||"+
 "has_function_privilege('authenticated','private.sync_admin_feature_array_v1(uuid,text,text,boolean)','EXECUTE')::text"
),aclBaseline,"Local SQL-role parity probe MUST restore initial schema and helper grants");
assert.equal(sheets(E),beforeACL,"transaction rollback must restore ACL-probe canonical bytes");
assert.equal(countGrant(E,adminOpt),0);
frozen(after,"rolled back direct SQL role call");
console.log("PASS I2I-11 separate LOCAL SQL authenticated-role grant parity demonstrates direct SECURITY DEFINER helper invocation without Admin context in rolled-back scratch; PUBLIC REST exposure NOT established");

console.log("I2-I authentic signed original Admin grant source RED/scratch GREEN I2I-01..11 COMPLETE only in reduced P1.3 PG17; production API schema exposure, ACL policy, actual Forge trigger graph, browser/consumer/backup parity remain UNVERIFIED.");
