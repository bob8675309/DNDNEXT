#!/usr/bin/env node
// P1.3 actual source v5→v4→v3→base-v3 versus sheet's original CS→CP trigger.
// Genuine GoTrue JWT/PostgREST for BOTH competing transactions; test-only
// CS timing hook, source-original levelup functions and source fingerprint gate.
// Only featureless Fighter 1→2 tails are reduced, NOT full class/game coverage.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
const e=process.env;
for(const [key,val] of Object.entries({
 GITHUB_ACTIONS:"true",CI:"true",
 DNDNEXT_P13_LEVELUP_LOCAL_CONFIRM:"P13_SOURCE_V5_LOCAL_AUTH_ONLY",
 PGHOST:"127.0.0.1",PGPORT:"54322",PGDATABASE:"postgres"
})) assert.equal(e[key],val,"Unsafe P1.3 levelup test environment "+key);
assert.match(e.DNDNEXT_P13_LEVELUP_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_P13_LEVELUP_ANON_KEY);
const id=n=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
const sql=query=>{
 const p=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",query],{
  encoding:"utf8",timeout:15000,env:{...e,PGUSER:"postgres"}
 });
 assert.equal(p.status,0,"Scratch PG17 SQL failed: "+p.stderr);
 return p.stdout.trim();
};
const api=()=>createClient(e.DNDNEXT_P13_LEVELUP_URL,e.DNDNEXT_P13_LEVELUP_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const signed=[];
const password="LocalP13Levelup-"+randomUUID()+"-X9!";
for(const name of ["OWNER","COEDITOR","OUTSIDER"]){
 const client=api(),email="p13-levelup-"+randomUUID()+"@example.invalid";
 const up=await client.auth.signUp({email,password});
 assert.ifError(up.error);
 const log=await client.auth.signInWithPassword({email,password});
 assert.ifError(log.error);
 const user=await client.auth.getUser();
 const claims=await client.auth.getClaims();
 assert.ifError(user.error);assert.ifError(claims.error);
 assert.equal(user.data.user.id,log.data.user.id);
 assert.equal(claims.data.claims.sub,user.data.user.id);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.notEqual(user.data.user.is_anonymous,true);
 signed.push({name,client,uid:user.data.user.id});
}
const [owner,coeditor,outsider]=signed;
assert.equal(new Set(signed.map(x=>x.uid)).size,3);
const cClass=id(8201),cSolo=id(8211),cRace=id(8212),cRevoked=id(8213);
function addCharacter(char,name){
 const initSheet=JSON.stringify({
  classKey:"fighter",rulesetSource:"XPHB",ruleset:"2024",level:1,
  hp:12,maxHp:12,abilities:{con:{score:12}},
  meta:{classKey:"fighter",rulesetSource:"XPHB",level:1}
 });
 sql("INSERT INTO public.characters(id,name,kind) VALUES('"+char+"','"+name+"','npc');"+
 "INSERT INTO public.character_sheets(character_id,sheet) VALUES('"+char+"','"+initSheet.replaceAll("'","''")+"'::jsonb);"+
 // Original sheet AFTER INSERT has ALREADY seeded character_progression with NULL
 // created_by. Match the original Forge v2 finalization with UPSERT, not INSERT.
 "INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,created_by)"+
 " VALUES('"+char+"','"+cClass+"',1,300,true,'"+owner.uid+"')"+
 " ON CONFLICT(character_id) DO UPDATE SET class_id=excluded.class_id,"+
 " class_level=excluded.class_level,experience_points=excluded.experience_points,"+
 " pending_level_up=excluded.pending_level_up,created_by=excluded.created_by;"+
 "INSERT INTO public.character_level_up_sessions(character_id,from_level,to_level,metadata_ready,status,created_by)"+
 " VALUES('"+char+"',1,2,true,'open','"+owner.uid+"');"+
 "INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES"+
 "('"+char+"','"+owner.uid+"',true),('"+char+"','"+coeditor.uid+"',true);");
}
addCharacter(cSolo,"P13 Source Fighter Solo");
addCharacter(cRace,"P13 Source Fighter Concurrent");
addCharacter(cRevoked,"P13 Source Fighter Revoked");
const level=(who,char)=>who.client.rpc("complete_character_level_up_v5",{
 p_character_id:char,p_selections:{hp_method:"fixed"}
});
const edit=(who,char,note)=>who.client.rpc("p13_test_sheet_edit_hold_v1",{
 p_character_id:char,p_note:note
});
const noLevel=await level(outsider,cSolo);
assert.ok(noLevel.error,"Unrelated authenticated JWT was allowed to level character");
assert.equal(noLevel.error.code,"42501");
const noSheet=await edit(outsider,cSolo,"intruder");
assert.ok(noSheet.error,"Outsider JWT was allowed to write sheet through held test helper");
assert.equal(noSheet.error.code,"42501");
console.log("PASS F07 real GoTrue outsider cannot level-up or edit sheet via source permissions");

const normal=await level(owner,cSolo);
assert.ifError(normal.error);
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id='"+cSolo+"'"),"2");
assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets WHERE character_id='"+cSolo+"'"),"2");
assert.equal(sql("SELECT sheet->>'maxHp' FROM public.character_sheets WHERE character_id='"+cSolo+"'"),"19");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+cSolo+"' AND event_type='level_up_completed'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_up_sessions WHERE character_id='"+cSolo+"' AND status='completed'"),"1");
const repeated=await level(owner,cSolo);
assert.ok(repeated.error,"Second level-up with no open session was accepted");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+cSolo+"' AND event_type='level_up_completed'"),"1");
console.log("PASS F08 genuine signed-in original v5→v4→v3→base Fighter lv1→2 advances HP, CS, CP and one session/event; replay cannot duplicate");

sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id='"+cRevoked+"' AND user_id='"+owner.uid+"'");
const revoked=await level(owner,cRevoked);
assert.ok(revoked.error,"Revoked original controller was permitted to level-up");
assert.equal(revoked.error.code,"42501");
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id='"+cRevoked+"'"),"1");
console.log("PASS F09 original permission helper enforces current edit-grant revocation for signed JWT");

const sleeping=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
// Supabase PostgREST builders are lazy: .then() starts the authenticated HTTP
// request before polling pg_locks. Without this, no prelock can be observed.
const levelPromise=owner.client.rpc("p13_test_levelup_cp_prelock_v1",{p_character_id:cRace}).then(x=>x);
const deadline=Date.now()+3500;
let observedPrelock=false;
while(Date.now()<deadline){
 const held=sql("SELECT count(*) FROM pg_locks WHERE locktype='advisory'"+
 " AND classid='9313'::oid AND objid='1'::oid AND granted='t'");
 if(held==="1"){observedPrelock=true;break;}
 await sleeping(80);
}
assert.ok(observedPrelock,"Test-only signed-in owner CP prelock marker not observed");
const sheetPromise=edit(coeditor,cRace,"original sheet CS-first hold").then(x=>x);
const both=await Promise.all([sheetPromise,levelPromise]);
const failures=both.filter(x=>x.error);
const successful=both.filter(x=>!x.error);
assert.equal(failures.length,1,"Expected one actual two-user 40P01 victim: "+JSON.stringify(both));
assert.equal(successful.length,1,"Expected one surviving original source transaction");
assert.equal(failures[0].error.code,"40P01","Expected PostgreSQL deadlock SQLSTATE, not timeout/permission: "+JSON.stringify(both));
const raceLevel=Number(sql("SELECT class_level FROM public.character_progression WHERE character_id='"+cRace+"'"));
assert.ok([1,2].includes(raceLevel));
if(raceLevel===1){
 const after=await level(owner,cRace);
 assert.ifError(after.error);
}
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id='"+cRace+"'"),"2");
assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets WHERE character_id='"+cRace+"'"),"2");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+cRace+"' AND event_type='level_up_completed'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_up_sessions WHERE character_id='"+cRace+"' AND status='completed'"),"1");
console.log("PASS F10 synthetic CP prelock + original signed JWT v5 CP→CS versus original signed JWT CS→CP sheet edit produces real 40P01, one victim and exactly one level/event; production timing NOT established");

console.log("P1.3 original full source v5-v4-v3/base F06-F10 accepted for a Fighter lv1→2 using REDUCED class-choice helpers and local editor RLS; not global grant/inventory or production trigger proof.");

// F11-F16 original Admin G grant vs v5 CP/CS, genuine Admin/owner JWTs.
// Source originals, timing and reduced-RLS limits documented in matching report.
const originalGrantFixture=spawnSync('psql',[
 '-X','-v','ON_ERROR_STOP=1','-f',
 'scripts/fixtures/p1_3_admin_grant_levelup_extension_pg17.sql'
],{encoding:'utf8',timeout:15000,env:{...e,PGUSER:'postgres'}});
assert.equal(originalGrantFixture.status,0,'F11 Admin grant fixture: '+originalGrantFixture.stderr);
console.log('PASS F11 original Admin G/CS source fingerprint and scratch ACL gates installed');
const adminClient=api(),adminEmail='p13-original-grant-'+randomUUID()+'@example.invalid';
const adminSignup=await adminClient.auth.signUp({email:adminEmail,password});assert.ifError(adminSignup.error);
const adminLogin=await adminClient.auth.signInWithPassword({email:adminEmail,password});assert.ifError(adminLogin.error);
const adminClaims=await adminClient.auth.getClaims();assert.ifError(adminClaims.error);
assert.equal(adminClaims.data.claims.sub,adminLogin.data.user.id);
assert.equal(adminClaims.data.claims.role,'authenticated');
const adminUid=adminLogin.data.user.id;
assert.ok(!signed.some(x=>x.uid===adminUid));
sql(`INSERT INTO public.user_profiles(id,role) VALUES('${adminUid}','admin')`);
const aOption=id(8292),aSolo=id(8293),aRace=id(8294);
addCharacter(aSolo,'P13 Source Admin Grant Solo');
addCharacter(aRace,'P13 Source Admin Grant and Level-up Race');
const g=(client,char,note)=>client.rpc('grant_character_option_v1',{
 p_character_id:char,p_option_id:aOption,p_notes:note
});
const gc=char=>Number(sql(`SELECT count(*) FROM public.character_option_grants WHERE character_id='${char}' AND option_id='${aOption}'`));
const gb=char=>sql(`SELECT granted_by FROM public.character_option_grants WHERE character_id='${char}' AND option_id='${aOption}'`);
const fc=char=>Number(sql(`SELECT count(*) FROM public.character_sheets cs, LATERAL jsonb_array_elements_text(coalesce(cs.sheet->'adminGrantedFeats','[]'::jsonb)) f(name) WHERE cs.character_id='${char}' AND f.name='Lucky'`));
const anonymousGrant=await g(api(),aSolo,'anonymous');
assert.ok(anonymousGrant.error,'Anonymous original grant unexpectedly succeeded');
for(const other of signed){
 const denied=await g(other.client,aSolo,'not-admin');
 assert.ok(denied.error,`Non-admin ${other.name} granted feat`);
 assert.equal(denied.error.code,'42501');
}
assert.equal(gc(aSolo),0);assert.equal(fc(aSolo),0);
console.log('PASS F12 anonymous/three player JWTs denied source Admin grant without changing G/CS');
const normalGrant=await g(adminClient,aSolo,'source original Admin');
assert.ifError(normalGrant.error);
assert.equal(gc(aSolo),1);assert.equal(fc(aSolo),1);assert.equal(gb(aSolo),adminUid);
const repeatedGrant=await g(adminClient,aSolo,'updated original grant note');
assert.ifError(repeatedGrant.error);
assert.equal(gc(aSolo),1);assert.equal(fc(aSolo),1);
assert.equal(sql(`SELECT notes FROM public.character_option_grants WHERE character_id='${aSolo}'`),'updated original grant note');
console.log('PASS F13 original signed Admin actual G insert/upsert, one projected feat, verified grant attribution; no immutable replay claimed');
sql(`UPDATE public.user_profiles SET role='player' WHERE id='${adminUid}'`);
const revokedAdmin=await g(adminClient,aSolo,'after-revocation');
assert.ok(revokedAdmin.error);assert.equal(revokedAdmin.error.code,'42501');
assert.equal(gc(aSolo),1);assert.equal(fc(aSolo),1);
sql(`UPDATE public.user_profiles SET role='admin' WHERE id='${adminUid}'`);
console.log('PASS F14 current DB-admin revocation denies same signed JWT; unchanged grant and sheet');

// All unchanged production functions run directly. Only the CP prelock and
// the separate AFTER-CS probe impose repeatable, artificial timing.
const gLevelPromise=owner.client.rpc('p13_test_grant_race_levelup_prelock_v1',{
 p_character_id:aRace
}).then(x=>x);
const pollMarker=async(key,deadline)=>{
 while(Date.now()<deadline){
  if(sql(`SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND classid='${key}'::oid AND objid='1'::oid AND granted`)==='1') return true;
  await sleeping(85);
 }
 return false;
};
assert.ok(await pollMarker(9315,Date.now()+3500),'Source v5 CP prelock marker not observed');
const gGrantPromise=g(adminClient,aRace,'G contention').then(x=>x);
assert.ok(await pollMarker(9314,Date.now()+2700),'Admin source G->CS lock probe not observed');
const [gLevelResult,gGrantResult]=await Promise.all([gLevelPromise,gGrantPromise]);
const gFailures=[gLevelResult,gGrantResult].filter(x=>x.error);
assert.equal(gFailures.length,1,'Expected one real 40P01 deadlock victim: '+JSON.stringify([gLevelResult,gGrantResult]));
assert.equal(gFailures[0].error.code,'40P01','Expected actual PG17 SQLSTATE 40P01');
if(gGrantResult.error){assert.equal(gc(aRace),0);assert.equal(fc(aRace),0);}
else{assert.equal(gc(aRace),1);assert.equal(fc(aRace),1);}
if(gLevelResult.error){
 assert.equal(sql(`SELECT class_level FROM public.character_progression WHERE character_id='${aRace}'`),'1');
 assert.equal(sql(`SELECT count(*) FROM public.character_level_events WHERE character_id='${aRace}' AND event_type='level_up_completed'`),'0');
}else assert.equal(sql(`SELECT class_level FROM public.character_progression WHERE character_id='${aRace}'`),'2');
console.log('PASS F15 source-original Admin G->CS->CP versus signed owner source-original v5 CP->CS: genuine test-timed 40P01 and rollback');
if(gLevelResult.error){const retry=await level(owner,aRace);assert.ifError(retry.error);}
if(gGrantResult.error){const retry=await g(adminClient,aRace,'G contention');assert.ifError(retry.error);}
assert.equal(gc(aRace),1);assert.equal(fc(aRace),1);assert.equal(gb(aRace),adminUid);
assert.equal(sql(`SELECT class_level FROM public.character_progression WHERE character_id='${aRace}'`),'2');
assert.equal(sql(`SELECT sheet->>'level' FROM public.character_sheets WHERE character_id='${aRace}'`),'2');
assert.equal(sql(`SELECT count(*) FROM public.character_level_events WHERE character_id='${aRace}' AND event_type='level_up_completed'`),'1');
assert.equal(sql(`SELECT count(*) FROM public.character_level_up_sessions WHERE character_id='${aRace}' AND status='completed'`),'1');
console.log('PASS F16 retry converges to one canonical G, sheet feat, level event/session, correct Admin provenance; no inventory or full trigger parity claimed');
