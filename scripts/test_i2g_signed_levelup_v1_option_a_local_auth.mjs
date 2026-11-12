#!/usr/bin/env node
// I2-G narrow original level-up v1: genuine signed GoTrue/PostgREST invocation.
// Original SQL is unmodified and hash-pinned; only featureless Fighter 1->2
// helper is reduced. This is a separate disposable PG17 instance, NOT the
// signed modern v3 Forge/Story/31-trigger graph and never a hosted migration.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";

const e=process.env;
for(const [k,v] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGDATABASE:"postgres",DNDNEXT_I2G_LOCAL_CONFIRM:"I2G_SIGNED_LEVELUP_V1_DISPOSABLE_ONLY"
}))assert.equal(e[k],v,"Unsafe I2-G level-up research environment: "+k);
assert.match(e.DNDNEXT_I2G_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_I2G_LOCAL_ANON_KEY);
const sql=q=>{
 const p=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",q],{
  encoding:"utf8",timeout:20000,env:{...e,PGUSER:"postgres"}});
 assert.equal(p.status,0,"I2G local SQL failed: "+p.stderr+"\n"+q.slice(0,280));
 return p.stdout.trim();
};
const fixture=path=>{
 const p=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-f",path],{
  encoding:"utf8",timeout:25000,env:{...e,PGUSER:"postgres"}});
 assert.equal(p.status,0,"I2G scratch fixture failed: "+p.stderr);
 return p.stdout.trim();
};
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const newClient=()=>createClient(e.DNDNEXT_I2G_LOCAL_URL,e.DNDNEXT_I2G_LOCAL_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const originalHash="1500703592c3cb8e1738126eac508e6a";
const signature="public.complete_character_level_up_v1(uuid,jsonb)";
const md5=()=>sql("SELECT md5(pg_get_functiondef("+quote(signature)+"::regprocedure))");
const sheet=id=>sql("SELECT sheet::text FROM public.character_sheets WHERE character_id="+quote(id));
const legacy=u=>sql("SELECT sheet::text FROM public.players WHERE user_id="+quote(u.uid));
const stamp=u=>sql("SELECT updated_at::text FROM public.players WHERE user_id="+quote(u.uid));
const snapshot=users=>users.map(u=>({u,old:legacy(u),time:stamp(u)}));
const unchanged=(snaps,context)=>snaps.forEach(s=>{
 assert.equal(legacy(s.u),s.old,context+" legacy sheet unchanged for "+s.u.name);
 assert.equal(stamp(s.u),s.time,context+" legacy timestamp unchanged for "+s.u.name);
});
const level=(u,id,select={hp_method:"fixed"})=>u.client.rpc("complete_character_level_up_v1",{
 p_character_id:id,p_selections:select
});
const randomId=()=>randomUUID();
const users=[];
for(const name of ["owner","editor","outsider","historical"]){
 const client=newClient();
 const email="i2g-"+randomUUID()+"@example.invalid", password="I2G-"+randomUUID()+"-OK!";
 assert.ifError((await client.auth.signUp({email,password})).error);
 const login=await client.auth.signInWithPassword({email,password}); assert.ifError(login.error);
 const claims=await client.auth.getClaims();assert.ifError(claims.error);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.equal(claims.data.claims.sub,login.data.user.id);
 const u={name,uid:login.data.user.id,client};
 sql("INSERT INTO public.players(user_id,sheet) VALUES("+quote(u.uid)+",'{}'::jsonb)");
 users.push(u);
}
const [owner,editor,outsider,historical]=users;
assert.equal(new Set(users.map(x=>x.uid)).size,4);
const classId="00000000-0000-0000-0000-000000008201";
function createChar(name){
 const id=randomId();
 const data={classKey:"fighter",rulesetSource:"XPHB",ruleset:"2024",level:1,
   hp:12,maxHp:12,abilities:{con:{score:12}},
   meta:{classKey:"fighter",rulesetSource:"XPHB",level:1}};
 sql("INSERT INTO public.characters(id,name,kind) VALUES("+quote(id)+","+quote(name)+",'npc');"+
   "INSERT INTO public.character_sheets(character_id,sheet) VALUES("+quote(id)+","+
    quote(JSON.stringify(data))+"::jsonb);"+
   "INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,created_by)"+
    " VALUES("+quote(id)+","+quote(classId)+",1,300,true,"+quote(owner.uid)+")"+
    " ON CONFLICT(character_id) DO UPDATE SET class_id=excluded.class_id,"+
    "class_level=excluded.class_level,experience_points=excluded.experience_points,"+
    "pending_level_up=excluded.pending_level_up,created_by=excluded.created_by;"+
   "INSERT INTO public.character_level_up_sessions(character_id,from_level,to_level,metadata_ready,status,created_by)"+
    " VALUES("+quote(id)+",1,2,true,'open',"+quote(owner.uid)+");"+
   "INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES"+
    "("+quote(id)+","+quote(owner.uid)+",true),"+
    "("+quote(id)+","+quote(editor.uid)+",true);");
 return id;
}
const A=createChar("I2G untouched owner Fighter A");
const B=createChar("I2G source RED shared Fighter B");
const C=createChar("I2G untouched editor Fighter C");
const D=createChar("I2G scratch GREEN shared Fighter D");
const E=createChar("I2G negative-only Fighter E");
const sheetA=sheet(A),sheetC=sheet(C);
sql("UPDATE public.players SET sheet=(SELECT sheet FROM public.character_sheets WHERE character_id="+quote(A)+"),updated_at=now() WHERE user_id="+quote(owner.uid));
sql("UPDATE public.players SET sheet=(SELECT sheet FROM public.character_sheets WHERE character_id="+quote(C)+"),updated_at=now() WHERE user_id="+quote(editor.uid));
sql("UPDATE public.players SET sheet="+quote(JSON.stringify({old:"unmarked historical snapshot",level:7}))+"::jsonb WHERE user_id="+quote(historical.uid));
const originalSnap=snapshot(users);
assert.equal(md5(),originalHash);
assert.equal(sql("SELECT has_function_privilege('authenticated',"+quote(signature)+",'EXECUTE')"),"t");
assert.equal(sql("SELECT has_function_privilege('anon',"+quote(signature)+",'EXECUTE')"),"f");
console.log("PASS I2G-01 exact original level-up v1 source MD5 and signed role privilege in reduced featureless Fighter local PG17");

const denied=await level(outsider,B);
assert.ok(denied.error,"Unrelated signed user unexpectedly levelled B");
assert.equal(denied.error.code,"42501");
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id="+quote(B)),"1");
unchanged(originalSnap,"original outsider denied");
console.log("PASS I2G-02 outsider JWT denied by unchanged canonical permission check, without legacy or progression writes");

const red=await level(owner,B);
assert.ifError(red.error);
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id="+quote(B)),"2");
assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets WHERE character_id="+quote(B)),"2");
assert.equal(sql("SELECT sheet->>'maxHp' FROM public.character_sheets WHERE character_id="+quote(B)),"19");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id="+quote(B)+" AND event_type='level_up_completed'"),"1");
assert.equal(legacy(owner),sheet(B),"original source should overwrite owner legacy sheet");
assert.equal(legacy(editor),sheet(B),"original source should overwrite editor legacy sheet");
assert.notEqual(legacy(owner),originalSnap[0].old);
assert.notEqual(legacy(editor),originalSnap[1].old);
assert.equal(sheet(A),sheetA);
assert.equal(sheet(C),sheetC);
assert.equal(legacy(historical),originalSnap[3].old);
console.log("PASS I2G-03 EXPECTED SOURCE RED: real owner JWT original v1 level-up succeeds canonically but clobbers BOTH unrelated editable account snapshots");

fixture("scripts/fixtures/i2g_option_a_levelup_v1_scratch_pg17.sql");
assert.notEqual(md5(),originalHash);
assert.ok(sql("SELECT pg_get_functiondef("+quote(signature)+"::regprocedure)").includes("I2G_OPTION_A_NO_LEGACY_LEVELUP_V1_WRITE"));
assert.equal(sql("SELECT has_function_privilege('authenticated',"+quote(signature)+",'EXECUTE')"),"t");
console.log("PASS I2G-04 source-exact reversible candidate installed only after original RED; unchanged public v5 and role ACL");

sql("UPDATE public.players SET sheet=(SELECT sheet FROM public.character_sheets WHERE character_id="+quote(D)+"),updated_at=now() WHERE user_id="+quote(owner.uid));
sql("UPDATE public.players SET sheet=(SELECT sheet FROM public.character_sheets WHERE character_id="+quote(C)+"),updated_at=now() WHERE user_id="+quote(editor.uid));
const frozen=snapshot(users);
assert.equal(legacy(owner),sheet(D),"same-character historical account setup");
const invalid=await level(owner,E,{hp_method:"invalid"});
assert.ok(invalid.error,"Invalid HP method unexpectedly succeeded");
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id="+quote(E)),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id="+quote(E)),"0");
unchanged(frozen,"invalid HP rollback");
console.log("PASS I2G-05 malformed source action rolls back with no account or canonical level events");

const green=await level(editor,D);
assert.ifError(green.error);
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id="+quote(D)),"2");
assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets WHERE character_id="+quote(D)),"2");
assert.equal(sql("SELECT sheet->>'maxHp' FROM public.character_sheets WHERE character_id="+quote(D)),"19");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id="+quote(D)+" AND event_type='level_up_completed'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_up_sessions WHERE character_id="+quote(D)+" AND status='completed'"),"1");
unchanged(frozen,"coeditor signed canonical success");
assert.equal(sheet(A),sheetA);assert.equal(sheet(C),sheetC);
console.log("PASS I2G-06 real coeditor JWT canonical level-up and event/session/HP unchanged; same/other-character legacy snapshots and timestamps frozen");

const repeat=await level(owner,D);
assert.ok(repeat.error,"Already-completed review unexpectedly accepted repeat");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id="+quote(D)),"1");
unchanged(frozen,"level-up replay rejected");
console.log("PASS I2G-07 replay denied and exactly one canonical level event remains");

const outsiderAgain=await level(outsider,E);
assert.ok(outsiderAgain.error);assert.equal(outsiderAgain.error.code,"42501");
sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+quote(E)+" AND user_id="+quote(owner.uid));
const revoked=await level(owner,E);
assert.ok(revoked.error);assert.equal(revoked.error.code,"42501");
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id="+quote(E)),"1");
unchanged(frozen,"revoked/outsider denied");
console.log("PASS I2G-08 revoked current editor and unrelated JWT denied without changing canonical or legacy sheets");

assert.equal(sql("SELECT md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))"),"02d74b973a763c53c595be20e35e512f");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.complete_character_level_up_base_v3(uuid,jsonb)'::regprocedure))"),"e33639d549ef557976a3970ea51f5238");
unchanged(frozen,"source and historical integrity");
console.log("PASS I2G-09 original modern v5/base-v3 source unchanged, all legacy frozen, test-only class helper limitation explicit");
console.log("I2G-01..09 SUCCESS only in reduced signed P1.3 Fighter PG17: NOT signed modern Forge/v3/Story/31 triggers, full class choices, production role/browser/concurrency or recovery approval.");
