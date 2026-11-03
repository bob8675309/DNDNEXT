#!/usr/bin/env node
// P1.3 protected-replay candidate, disposable CI-only real GoTrue, no live rollout.
// Runs AFTER the original-source unsafe baseline; all IDs are scratch test rows.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync, spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
const e=process.env;
assert.equal(e.GITHUB_ACTIONS,"true");
assert.equal(e.CI,"true");
assert.equal(e.DNDNEXT_P13_LOCAL_CI_CONFIRM,"P13_DISPOSABLE_REAL_GOTRUE_ONLY");
assert.equal(e.PGHOST,"127.0.0.1");
assert.equal(e.PGPORT,"54322");
assert.equal(e.PGDATABASE,"postgres");
assert.match(e.DNDNEXT_P13_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_P13_LOCAL_ANON_KEY);
const id=n=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
function db(sql){
 const p=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",sql],{
   encoding:"utf8",timeout:15000,env:{...e,PGUSER:"postgres"}
 });
 if(p.status!==0)throw Error("Disposable DB command failed: "+p.stderr);
 return p.stdout.trim();
}
const number=sql=>Number(db(sql));
const make=()=>createClient(e.DNDNEXT_P13_LOCAL_URL,e.DNDNEXT_P13_LOCAL_ANON_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const ccast=(who,actor,spell,target,slot,request)=>who.rpc("p13_candidate_cast_spell_v1",{
  p_caster_id:actor,p_assignment_id:spell,p_target_id:target,p_slot_level:slot,p_request_id:request
});
const core=(who,actor,action,request)=>who.rpc("p13_candidate_core_action_v1",{
  p_participant_id:actor,p_action:action,p_request_id:request
});
function fail(r,expected,label){
 assert.ok(r.error,label+" unexpectedly succeeded");
 assert.match(r.error.message,expected,label+": "+r.error.message);
}
let users=[];const pass="TempP13-"+randomUUID()+"-X9!";
for(const role of ["ADMIN","C","D"]){
 const client=make(),email="p13-guarded-"+randomUUID()+"@example.invalid";
 let z=await client.auth.signUp({email,password:pass});assert.ifError(z.error);
 z=await client.auth.signInWithPassword({email,password:pass});assert.ifError(z.error);
 const u=await client.auth.getUser(),claims=await client.auth.getClaims();
 assert.ifError(u.error);assert.ifError(claims.error);
 assert.equal(u.data.user.id,claims.data.claims.sub);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.notEqual(claims.data.claims.is_anonymous,true);
 users.push({client,uid:u.data.user.id,role});
}
const [gm,c,d]=users;
assert.equal(new Set(users.map(u=>u.uid)).size,3);
db("INSERT INTO public.p13_auth_admins(user_id) VALUES('"+gm.uid+"')");
const p1=id(1011),p2=id(1014),target1=id(1012),target2=id(1015),
      spell1=id(3011),spell2=id(3015);
db("UPDATE public.encounter_participants SET controller_user_id='"+c.uid+"' WHERE id='"+p2+"'");
console.log("PASS 56: three distinct real JWTs for candidate test");

const firstId=randomUUID();
const first=await ccast(c.client,p2,spell2,target2,1,firstId);
assert.ifError(first.error);
assert.equal(first.data.targetId,target2);
assert.equal(number("SELECT slots_remaining FROM public.encounter_spell_slots WHERE id='"+id(4014)+"'"),0);
assert.equal(number("SELECT count(*) FROM private.p13_guarded_commands WHERE request_id='"+firstId+"' AND family='spell_single' AND requested_by='"+c.uid+"' AND result IS NOT NULL"),1);
console.log("PASS 57: candidate direct-owner cast commits one original-source spell + canonical intent");

const replay=await ccast(c.client,p2,spell2,target2,1,firstId);
assert.ifError(replay.error);assert.deepEqual(replay.data,first.data);
assert.equal(number("SELECT count(*) FROM public.encounter_combat_log WHERE actor_participant_id='"+p2+"' AND event_type='spell_cast'"),1);
fail(await ccast(c.client,p2,spell2,p2,2,firstId),/P13_REQUEST_CONFLICT/,"Changed typed intent");
console.log("PASS 58: same-owner exact replay returns identical cached result, changed target/slot rejected without another cast");

db("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_control) VALUES('"+id(614)+"','"+d.uid+"',false,true)");
fail(await ccast(d.client,p2,spell2,target2,1,firstId),/P13_ACCESS_DENIED/,"Combat-only grant remains unsupported in original source");
db("UPDATE public.character_permissions SET can_edit=true WHERE character_id='"+id(614)+"' AND user_id='"+d.uid+"'");
fail(await ccast(d.client,p2,spell2,target2,1,firstId),/P13_REQUEST_REJECTED/,"Another currently authorized controller reusing first owner's UUID");
console.log("PASS 59: shared editor cannot reuse another controller's request ID; combat-only integration remains pending");

db("UPDATE public.encounter_participants SET controller_user_id=NULL WHERE id='"+p2+"'");
fail(await ccast(c.client,p2,spell2,target2,1,firstId),/P13_ACCESS_DENIED/,"Original owner after revocation");
assert.equal(number("SELECT count(*) FROM public.encounter_combat_log WHERE actor_participant_id='"+p2+"' AND event_type='spell_cast'"),1);
console.log("PASS 60: revoked original owner does not see cached result");

db("UPDATE public.encounter_participants SET controller_user_id='"+c.uid+"' WHERE id IN ('"+p1+"','"+p2+"')");
db("UPDATE public.encounter_participants SET is_hidden=false WHERE id='"+target1+"'");
const legacyId=db("SELECT request_id FROM public.encounter_command_requests WHERE participant_id='"+p1+"' LIMIT 1");
assert.ok(legacyId);
fail(await ccast(c.client,p1,spell1,target1,1,legacyId),/P13_REQUEST_REJECTED/,"Unverifiable old ledger UUID");
console.log("PASS 61: existing legacy UUID not adopted without immutable original intent");

fail(await core(c.client,p2,"dash",firstId),/P13_REQUEST_CONFLICT/,"Cross-family UUID collision");
const otherEncounter=await ccast(c.client,p1,spell1,target1,1,firstId);
fail(otherEncounter,/P13_REQUEST_CONFLICT/,"Cross-encounter actor UUID collision");
console.log("PASS 62: global request ID cannot cross family, actor, or encounter");

db("UPDATE public.encounter_participants SET action_available=true WHERE id='"+p1+"'");
const coreId=randomUUID(),coreFirst=await core(c.client,p1,"dash",coreId);
assert.ifError(coreFirst.error);assert.equal(coreFirst.data.action,"dash");
assert.equal(db("SELECT action_available FROM public.encounter_participants WHERE id='"+p1+"'"),"f");
const coreReplay=await core(c.client,p1,"dash",coreId);
assert.ifError(coreReplay.error);assert.deepEqual(coreReplay.data,coreFirst.data);
fail(await core(c.client,p1,"dodge",coreId),/P13_REQUEST_CONFLICT/,"Changed core action");
fail(await ccast(c.client,p1,spell1,target1,1,coreId),/P13_REQUEST_CONFLICT/,"Cross-family core to spell");
assert.equal(number("SELECT count(*) FROM public.encounter_combat_log WHERE actor_participant_id='"+p1+"' AND event_type='core_action'"),1);
console.log("PASS 63: source-exact core-action shares guard, binds Dash intent and returns safe exact replay");

db("UPDATE public.encounter_participants SET action_available=true WHERE id='"+p2+"'");
db("UPDATE public.encounter_spell_slots SET slots_remaining=1 WHERE participant_id='"+p2+"'");
db("UPDATE public.encounters SET round=round+1 WHERE id='"+id(902)+"'");
const before=number("SELECT count(*) FROM public.encounter_combat_log WHERE actor_participant_id='"+p2+"'");
const [spellRace,coreRace]=await Promise.all([
 ccast(c.client,p2,spell2,target2,1,randomUUID()),
 core(d.client,p2,"dodge",randomUUID())
]);
const outcomes=[spellRace,coreRace];
assert.equal(outcomes.filter(x=>!x.error).length,1,"Two commands spent same Action");
assert.equal(outcomes.filter(x=>x.error).length,1);
assert.match(outcomes.find(x=>x.error).error.message,/Action already spent/);
assert.equal(number("SELECT count(*) FROM public.encounter_combat_log WHERE actor_participant_id='"+p2+"'"),before+1);
assert.equal(db("SELECT action_available FROM public.encounter_participants WHERE id='"+p2+"'"),"f");
console.log("PASS 64: simultaneous authorized signed-in Cast vs Dodge serializes one Action (E-first)");

// Request UUID replay race: same authenticated controller, same intent, new round.
// Both transactions must share one result (no duplicate log or slot).
db("UPDATE public.encounter_participants SET action_available=true WHERE id='"+p2+"'");
db("UPDATE public.encounter_spell_slots SET slots_remaining=1 WHERE participant_id='"+p2+"'");
db("UPDATE public.encounters SET round=round+1 WHERE id='"+id(902)+"'");
const base=number("SELECT count(*) FROM public.encounter_combat_log WHERE actor_participant_id='"+p2+"'");
const raceId=randomUUID();
const [sameA,sameB]=await Promise.all([
 ccast(c.client,p2,spell2,target2,1,raceId),
 ccast(c.client,p2,spell2,target2,1,raceId)
]);
assert.ifError(sameA.error);assert.ifError(sameB.error);
assert.deepEqual(sameA.data,sameB.data);
assert.equal(number("SELECT count(*) FROM public.encounter_combat_log WHERE actor_participant_id='"+p2+"'"),base+1);
assert.equal(number("SELECT slots_remaining FROM public.encounter_spell_slots WHERE participant_id='"+p2+"'"),0);
assert.equal(number("SELECT count(*) FROM private.p13_guarded_commands WHERE request_id='"+raceId+"' AND result IS NOT NULL"),1);
console.log("PASS 65: simultaneous identical JWT requests converge on one cached result/slot spend");

const anon=make(),anonymous=await ccast(anon,p2,spell2,target2,1,firstId);
assert.ok(anonymous.error);assert.equal(anonymous.error.code,"42501");
const original=await c.client.rpc("encounter_cast_spell_v9",{
 p_caster_id:p2,p_assignment_id:spell2,p_target_id:target2,p_slot_level:1,p_request_id:firstId
});
assert.ok(original.error);assert.equal(original.error.code,"42501");
const originalCore=await core(c.client,p1,"dash",coreId);
assert.ifError(originalCore.error);
const bypass=await c.client.rpc("encounter_use_core_action_v1",{
 p_participant_id:p1,p_action:"dash",p_request_id:coreId
});
assert.ok(bypass.error);assert.equal(bypass.error.code,"42501");
console.log("PASS 66: candidate denies anonymous access and original direct legacy bypass paths");

// Post-cast visibility changes must invalidate otherwise exact cached results.
db("UPDATE public.encounter_participants SET is_hidden=true WHERE id='"+target2+"'");
fail(await ccast(c.client,p2,spell2,target2,1,raceId),/P13_REQUEST_REJECTED/,
  "Previously visible result became hidden");
db("UPDATE public.encounter_participants SET is_hidden=false WHERE id='"+target2+"'");
console.log("PASS 67: hidden-result visibility rechecked on every exact replay");

// Overlapping revocation: the revoker's SQL transaction locks the editor grant
// before signed-in Cast tries FOR SHARE. The cast must see revocation after wait.
db("UPDATE public.encounter_participants SET controller_user_id=NULL,action_available=true WHERE id='"+p2+"'");
db("UPDATE public.encounter_spell_slots SET slots_remaining=1 WHERE participant_id='"+p2+"'");
db("UPDATE public.encounters SET round=round+1 WHERE id='"+id(902)+"'");
db("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_control) "+
   "VALUES('"+id(614)+"','"+c.uid+"',true,false) ON CONFLICT(character_id,user_id) "+
   "DO UPDATE SET can_edit=true");
const revokerSql="BEGIN; UPDATE public.character_permissions SET can_edit=false WHERE character_id='"+
  id(614)+"' AND user_id='"+c.uid+"'; SELECT 'REVOCATION_LOCKED'; SELECT pg_sleep(2.5); COMMIT;";
const worker=spawn("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",revokerSql],{
  env:{...e,PGUSER:"postgres"},stdio:["ignore","pipe","pipe"]
});
let workerError="";
worker.stderr.setEncoding("utf8");
worker.stderr.on("data",x=>{workerError+=x;});
await new Promise((resolve,reject)=>{
 let output="";
 const timeout=setTimeout(()=>reject(Error("Revocation lock readiness timeout: "+workerError)),7000);
 worker.stdout.setEncoding("utf8");
 worker.stdout.on("data",chunk=>{
  output+=chunk;
  if(output.includes("REVOCATION_LOCKED")){clearTimeout(timeout);resolve();}
 });
 worker.on("error",err=>{clearTimeout(timeout);reject(err);});
 worker.on("exit",(code)=>{if(!output.includes("REVOCATION_LOCKED")){clearTimeout(timeout);reject(Error("Revoker ended early "+code+" "+workerError));}});
});
const countBefore=number("SELECT count(*) FROM public.encounter_combat_log WHERE actor_participant_id='"+p2+"'");
const rejectedUUID=randomUUID();
const duringRevoke=await ccast(c.client,p2,spell2,target2,1,rejectedUUID);
fail(duringRevoke,/P13_ACCESS_DENIED/,"Cast after concurrent editor revocation");
await new Promise((resolve,reject)=>{
 if(worker.exitCode!==null)return worker.exitCode===0?resolve():reject(Error(workerError));
 worker.on("exit",code=>code===0?resolve():reject(Error("Revoker failure "+workerError)));
});
assert.equal(number("SELECT count(*) FROM private.p13_guarded_commands WHERE request_id='"+rejectedUUID+"'"),0);
assert.equal(number("SELECT count(*) FROM public.encounter_combat_log WHERE actor_participant_id='"+p2+"'"),countBefore);
assert.equal(number("SELECT slots_remaining FROM public.encounter_spell_slots WHERE participant_id='"+p2+"'"),1);
console.log("PASS 68: overlapping grant revocation serialized; late cast denied without side effects");

// An unresolved committed request row is not authorization to reroll/spend.
const pendingId=randomUUID();
const pendingIntent=JSON.stringify({
 family:"spell_single",version:"candidate-v1",legacyHandler:"v9",
 assignmentId:spell2,targetId:target2,slotLevel:1,spellKey:"cure-wounds|xphb"
}).replaceAll("'","''");
db("UPDATE public.encounter_participants SET controller_user_id='"+c.uid+"' WHERE id='"+p2+"'");
db("INSERT INTO private.p13_guarded_commands(request_id,encounter_id,actor_id,requested_by,family,canonical_intent) "+
 "VALUES('"+pendingId+"','"+id(902)+"','"+p2+"','"+c.uid+"','spell_single','"+pendingIntent+"'::jsonb)");
fail(await ccast(c.client,p2,spell2,target2,1,pendingId),/P13_PENDING_REQUEST/,
  "Persisted result-null pending command");
assert.equal(number("SELECT count(*) FROM public.encounter_command_requests WHERE request_id='"+pendingId+"'"),0);
assert.equal(number("SELECT slots_remaining FROM public.encounter_spell_slots WHERE participant_id='"+p2+"'"),1);
console.log("PASS 69: committed pending request fails closed without executing a second command");

console.log("P1.3 guarded candidate cases 56-69 PASS; LIMITED two-family proof, NOT global P1.3 acceptance or production mitigation.");
