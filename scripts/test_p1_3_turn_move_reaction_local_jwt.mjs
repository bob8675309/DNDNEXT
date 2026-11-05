#!/usr/bin/env node
// P1.3 LOCAL disposable PG17/GoTrue/PostgREST only. Source-exact command bodies.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
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
 if(p.status!==0)throw Error("Disposable database command failed: "+p.stderr);
 return p.stdout.trim();
}
const number=sql=>Number(db(sql));
const client=()=>createClient(e.DNDNEXT_P13_LOCAL_URL,e.DNDNEXT_P13_LOCAL_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const move=(who,actor,path,request)=>who.rpc("p13_candidate_move_v1",{
 p_participant_id:actor,p_path:path,p_request_id:request
});
const end=(who,actor,request)=>who.rpc("p13_candidate_end_turn_v1",{
 p_participant_id:actor,p_request_id:request
});
const react=(who,w,choice,item,request)=>who.rpc("p13_candidate_reaction_v1",{
 p_window_id:w,p_choice:choice,p_inventory_item_id:item,p_request_id:request
});
const fail=(result,pattern,name)=>{
 assert.ok(result.error,name+" unexpectedly succeeded");
 assert.match(result.error.message,pattern,name+": "+result.error.message);
};
const accounts=[],password="TempP13-"+randomUUID()+"-X9!";
for(const label of ["ADMIN","MOVER","REACTOR","OUTSIDER"]){
 const who=client(),email="p13-turnflow-"+randomUUID()+"@example.invalid";
 const sign=await who.auth.signUp({email,password});assert.ifError(sign.error);
 const login=await who.auth.signInWithPassword({email,password});assert.ifError(login.error);
 const verify=await who.auth.getUser(),claims=await who.auth.getClaims();
 assert.ifError(verify.error);assert.ifError(claims.error);
 assert.equal(claims.data.claims.sub,verify.data.user.id);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.notEqual(claims.data.claims.is_anonymous,true);
 accounts.push({who,uid:verify.data.user.id,label});
}
const [gm,mover,reactor,outsider]=accounts;
assert.equal(new Set(accounts.map(x=>x.uid)).size,4);
db("INSERT INTO public.p13_auth_admins(user_id) VALUES('"+gm.uid+"')");
db("UPDATE public.encounter_participants SET controller_user_id='"+mover.uid+
 "' WHERE id IN ('"+id(1030)+"','"+id(1040)+"','"+id(1050)+"')");
db("UPDATE public.encounter_participants SET controller_user_id='"+reactor.uid+
 "' WHERE id IN ('"+id(1031)+"','"+id(1041)+"','"+id(1051)+"')");
console.log("PASS 70: four real local signed GoTrue identities, independent mover/reactor permissions");

// A one-hex move away from hostile reaction reach should pause and create W.
const path=[{q:-1,r:0}],firstMoveId=randomUUID();
fail(await move(outsider.who,id(1030),path,randomUUID()),/P13_ACCESS_DENIED/,"Outsider move");
const first=await move(mover.who,id(1030),path,firstMoveId);
assert.ifError(first.error);assert.equal(first.data.reactionRequired,true);
assert.equal(first.data.blockedStep.q,-1);
assert.equal(db("SELECT q FROM public.encounter_participants WHERE id='"+id(1030)+"'"),"0");
const windowId=first.data.reactionWindowId;
assert.match(windowId,/^[0-9a-f-]{36}$/i);
assert.equal(number("SELECT count(*) FROM public.encounter_reaction_windows WHERE id='"+windowId+"' AND status='pending'"),1);
const moveReplay=await move(mover.who,id(1030),path,firstMoveId);
assert.ifError(moveReplay.error);assert.deepEqual(moveReplay.data,first.data);
fail(await move(mover.who,id(1030),[{q:0,r:-1}],firstMoveId),
 /P13_REQUEST_CONFLICT/,"Changed ordered movement intent");
console.log("PASS 71: exact-source movement opens one pending W; immutable ordered path and replay");

// Attack is unsupported in this candidate, not silently resolved via a mock.
fail(await react(reactor.who,windowId,"attack",null,randomUUID()),
 /P13_GM_ASSISTED_REACTION_ATTACK/,"Unproven opportunity attack");
fail(await react(reactor.who,windowId,"pass",id(4001),randomUUID()),
 /P13_GM_ASSISTED_REACTION_ATTACK/,"Pass with weapon ID");
assert.equal(number("SELECT count(*) FROM public.encounter_reaction_windows WHERE id='"+windowId+"' AND status='pending'"),1);
console.log("PASS 72: source-unproven Attack branch fails closed without reaction mutation");

const passId=randomUUID();
fail(await react(outsider.who,windowId,"pass",null,randomUUID()),
 /P13_ACCESS_DENIED/,"Outsider reaction");
const pass=await react(reactor.who,windowId,"pass",null,passId);
assert.ifError(pass.error);assert.equal(pass.data.choice,"pass");
assert.equal(pass.data.reactionSpent,false);
assert.equal(db("SELECT status FROM public.encounter_reaction_windows WHERE id='"+windowId+"'"),"resolved");
const passReplay=await react(reactor.who,windowId,"pass",null,passId);
assert.ifError(passReplay.error);assert.deepEqual(passReplay.data,pass.data);
fail(await react(reactor.who,windowId,"pass",null,randomUUID()),
 /P13_WINDOW_RESOLVED/,"New request for resolved window");
assert.equal(number("SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id='"+id(903)+"' AND event_type='reaction_pass'"),1);
console.log("PASS 73: real reactor Pass, exact replay once, fresh resolved-window call denied");

// Following resolved reaction, a NEW Move UUID finishes previously blocked step.
const resume=await move(mover.who,id(1030),path,randomUUID());
assert.ifError(resume.error);assert.equal(resume.data.reactionRequired,false);
assert.equal(resume.data.q,-1);
assert.equal(db("SELECT q FROM public.encounter_participants WHERE id='"+id(1030)+"'"),"-1");
assert.equal(db("SELECT movement_spent_ft FROM public.encounter_participants WHERE id='"+id(1030)+"'"),"5");
fail(await move(mover.who,id(1030),[{q:-2,r:0,extra:1}],randomUUID()),
 /P13_INVALID_PATH/,"Extra movement operand");
console.log("PASS 74: source Move completes after Pass with new UUID; unknown path keys blocked");

// End Turn must expire condition/effect and atomically select next participant.
const endId=randomUUID();
const endResult=await end(mover.who,id(1030),endId);
assert.ifError(endResult.error);
assert.equal(endResult.data.nextParticipantId,id(1031));
assert.equal(endResult.data.round,1);
assert.equal(db("SELECT active_participant_id FROM public.encounters WHERE id='"+id(903)+"'"),id(1031));
assert.equal(number("SELECT count(*) FROM public.encounter_conditions WHERE participant_id='"+id(1030)+"'"),0);
assert.equal(number("SELECT count(*) FROM public.encounter_timed_effects WHERE participant_id='"+id(1030)+"'"),0);
assert.equal(number("SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id='"+id(903)+"' AND event_type IN ('condition_expired','effect_expired')"),2);
const endReplay=await end(mover.who,id(1030),endId);
assert.ifError(endReplay.error);assert.deepEqual(endReplay.data,endResult.data);
fail(await move(mover.who,id(1030),[{q:-2,r:0}],randomUUID()),
 /active turn/i,"Movement after completed End Turn");
console.log("PASS 75: exact End Turn expires effects, hands off turn, old-turn retry replays once");

db("UPDATE public.encounter_participants SET is_hidden=true WHERE id='"+id(1031)+"'");
fail(await end(mover.who,id(1030),endId),/P13_REQUEST_REJECTED/,
 "Formerly visible next participant now hidden");
db("UPDATE public.encounter_participants SET is_hidden=false WHERE id='"+id(1031)+"'");
db("UPDATE public.encounter_participants SET controller_user_id=NULL WHERE id='"+id(1030)+"'");
fail(await end(mover.who,id(1030),endId),/P13_ACCESS_DENIED/,
 "Revoked End Turn original requester");
console.log("PASS 76: End Turn cached next-actor visibility and original actor authority rechecked");

db("UPDATE public.encounter_participants SET controller_user_id=NULL WHERE id='"+id(1031)+"'");
fail(await react(reactor.who,windowId,"pass",null,passId),/P13_ACCESS_DENIED/,
 "Revoked reaction original requester");
const oldRequest=randomUUID();
db("INSERT INTO public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by,result) "+
 "VALUES('"+oldRequest+"','"+id(903)+"','"+id(1031)+"','reaction',NULL,'{}'::jsonb)");
db("UPDATE public.encounter_participants SET controller_user_id='"+reactor.uid+"' WHERE id='"+id(1031)+"'");
fail(await react(reactor.who,windowId,"pass",null,oldRequest),
 /P13_REQUEST_REJECTED/,"Legacy unverifiable reaction UUID");
console.log("PASS 77: R2 reaction revocation and R1 unverifiable original UUID fail closed");

const prior=id(904),raceActor=id(1040),raceP=[{q:-1,r:0}];
const [raceMove,raceEnd]=await Promise.all([
 move(mover.who,raceActor,raceP,randomUUID()),
 end(mover.who,raceActor,randomUUID())
]);
assert.ifError(raceEnd.error);
if(raceMove.error)assert.match(raceMove.error.message,/active turn/i);
else assert.equal(raceMove.data.q,-1);
assert.equal(db("SELECT active_participant_id FROM public.encounters WHERE id='"+prior+"'"),id(1041));
assert.equal(number("SELECT count(*) FROM public.encounter_command_requests WHERE encounter_id='"+prior+"' AND command_type='end_turn'"),1);
assert.equal(number("SELECT count(*) FROM public.encounter_command_requests WHERE encounter_id='"+prior+"' AND command_type='move'"),raceMove.error?0:1);
console.log("PASS 78: concurrent genuine-JWT End Turn and Move serialize E-first; no deadlock or ghost ledger");

const reactWindow=id(5050);
const [passA,passB]=await Promise.all([
 react(reactor.who,reactWindow,"pass",null,randomUUID()),
 react(reactor.who,reactWindow,"pass",null,randomUUID())
]);
assert.equal([passA,passB].filter(x=>!x.error).length,1);
fail([passA,passB].find(x=>x.error),/P13_WINDOW_RESOLVED/,
 "Concurrent new UUID on resolved reaction");
assert.equal(number("SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id='"+id(905)+"' AND event_type='reaction_pass'"),1);
console.log("PASS 79: two different UUIDs competing for W permit one resolved reaction");

const duplicateWindow=id(5051),dupId=randomUUID();
const [sameA,sameB]=await Promise.all([
 react(reactor.who,duplicateWindow,"pass",null,dupId),
 react(reactor.who,duplicateWindow,"pass",null,dupId)
]);
assert.ifError(sameA.error);assert.ifError(sameB.error);
assert.deepEqual(sameA.data,sameB.data);
assert.equal(number("SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id='"+id(905)+"' AND event_type='reaction_pass'"),2);
assert.equal(number("SELECT count(*) FROM private.p13_guarded_commands WHERE request_id='"+dupId+"' AND result IS NOT NULL"),1);
console.log("PASS 80: concurrent same-UUID reaction Pass returns one result with one W/log resolution");

const anon=client();
const probes=[
 await move(anon,id(1040),raceP,randomUUID()),
 await end(anon,id(1040),randomUUID()),
 await react(anon,duplicateWindow,"pass",null,randomUUID()),
 await mover.who.rpc("encounter_move_active_participant_v1",{
  p_participant_id:raceActor,p_path:raceP,p_request_id:randomUUID()
 }),
 await mover.who.rpc("encounter_end_turn_v1",{
  p_participant_id:raceActor,p_request_id:randomUUID()
 }),
 await reactor.who.rpc("encounter_resolve_opportunity_reaction_v1",{
  p_window_id:duplicateWindow,p_choice:"pass",p_inventory_item_id:null,p_request_id:randomUUID()
 })
];
for(const probe of probes){
 assert.ok(probe.error,"Ungated or anonymous RPC unexpectedly exposed");
 assert.equal(probe.error.code,"42501");
}
console.log("PASS 81: direct source RPCs and anonymous candidate access denied in modeled grants");
console.log("CASES 70–81 passed: isolated original End Turn / Move / Reaction-Pass model, NOT universal tactical authorization.");
