#!/usr/bin/env node
// P1.3 real-JWT privacy: characterize source-derived initial leaks,
// then test a separate RESEARCH-ONLY "Unknown Events" viewer projection.
// Disposable GitHub Actions Supabase/PostgreSQL 17 only. No production changes.
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
function psql(args){
 const result=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt",...args],{
  encoding:"utf8",timeout:20000,env:{...e,PGUSER:"postgres"}
 });
 if(result.status!==0)throw Error("Disposable database command failed: "+result.stderr);
 return result.stdout.trim();
}
const db=sql=>psql(["-c",sql]), count=sql=>Number(db(sql));
const make=()=>createClient(e.DNDNEXT_P13_LOCAL_URL,e.DNDNEXT_P13_LOCAL_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const end=(who,actor,request)=>who.rpc("p13_candidate_end_turn_v1",{
 p_participant_id:actor,p_request_id:request
});
const move=(who,actor,path,request)=>who.rpc("p13_candidate_move_v1",{
 p_participant_id:actor,p_path:path,p_request_id:request
});
const path=[{q:-1,r:0}];
const accounts=[],pwd="P13Privacy-"+randomUUID()+"-X9!";
for(const label of ["GM","PLAYER","OUTSIDER"]){
 const who=make(),email="p13-privacy-"+randomUUID()+"@example.invalid";
 const signed=await who.auth.signUp({email,password:pwd});assert.ifError(signed.error);
 const login=await who.auth.signInWithPassword({email,password:pwd});assert.ifError(login.error);
 const current=await who.auth.getUser(),claims=await who.auth.getClaims();
 assert.ifError(current.error);assert.ifError(claims.error);
 assert.equal(current.data.user.id,claims.data.claims.sub);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.notEqual(claims.data.claims.is_anonymous,true);
 accounts.push({who,uid:current.data.user.id,label});
}
const [gm,player,outsider]=accounts;
assert.equal(new Set(accounts.map(a=>a.uid)).size,3);
db("INSERT INTO public.p13_auth_admins(user_id) VALUES('"+gm.uid+"')");
db("UPDATE public.encounter_participants SET controller_user_id='"+player.uid+
 "' WHERE id IN ('"+id(1060)+"','"+id(1070)+"','"+id(1080)+"','"+id(1090)+"')");
async function visible(who,actor){
 const response=await who.from("encounter_participants").select("id").eq("id",actor);
 assert.ifError(response.error);return response.data;
}
function denied(response,pattern,label){
 assert.ok(response.error,label+" unexpectedly succeeded");
 assert.match(response.error.message,pattern,label+": "+response.error.message);
}
function opaque(response,uuid,label){
 assert.ifError(response.error);
 assert.deepEqual(response.data,{requestId:uuid,notice:"Unknown Events"},
  label+" leaked hidden identity/window/movement data");
 const raw=JSON.stringify(response.data);
 for(const secret of [
  "nextParticipantId","reactorParticipantId","reactionWindowId",
  "blockedStep","from_q","to_q","reactionRequired","encounterId"
 ]) assert.ok(!raw.includes(secret),label+" leaked "+secret);
}
console.log("PASS 82: three genuine JWT identities and synthetic hidden actors established");

// BEFORE projector: source-derived P1.3 guard returns hidden next actor on
// fresh End Turn. This is an EXPECTED UNSAFE baseline, not an acceptance pass.
assert.deepEqual(await visible(player.who,id(1061)),[]);
const baselineEndId=randomUUID();
const baselineEnd=await end(player.who,id(1060),baselineEndId);
assert.ifError(baselineEnd.error);
assert.equal(baselineEnd.data.nextParticipantId,id(1061));
assert.equal(db("SELECT active_participant_id FROM public.encounters WHERE id='"+id(906)+"'"),id(1061));
console.log("PASS 83 [EXPECTED UNSAFE]: original guarded End Turn exposed hidden next actor ID to real player JWT");

// BEFORE projector: source-derived Move leaks hidden reactor and W ID.
assert.deepEqual(await visible(player.who,id(1071)),[]);
const baselineMoveId=randomUUID();
const baselineMove=await move(player.who,id(1070),path,baselineMoveId);
assert.ifError(baselineMove.error);
assert.equal(baselineMove.data.reactorParticipantId,id(1071));
assert.equal(baselineMove.data.reactionRequired,true);
assert.ok(baselineMove.data.reactionWindowId);
assert.equal(count("SELECT count(*) FROM public.encounter_reaction_windows WHERE id='"+
 baselineMove.data.reactionWindowId+"' AND status='pending'"),1);
console.log("PASS 84 [EXPECTED UNSAFE]: source Move exposed hidden reactor and reaction-window ID");

psql(["-f","scripts/fixtures/p1_3_hidden_activity_projection_pg17.sql"]);
console.log("PASS 85: separate scratch-only source-wrapper projection installed; original processors unchanged");

// First-execution privacy: ensure the real End Turn updates source DB but
// private next actor identity is absent from response JSON.
const playerEndId=randomUUID();
assert.deepEqual(await visible(player.who,id(1081)),[]);
opaque(await end(player.who,id(1080),playerEndId),playerEndId,"Hidden next actor");
assert.equal(db("SELECT active_participant_id FROM public.encounters WHERE id='"+id(908)+"'"),id(1081));
assert.equal(count("SELECT count(*) FROM private.p13_guarded_commands WHERE request_id='"+
 playerEndId+"' AND result->>'nextParticipantId'='"+id(1081)+"'"),1);
console.log("PASS 86: hidden next actor first execution returns only 'Unknown Events' while turn advances");

// First-execution Move must still create authoritative W, but not disclose W
// or hidden reactor ID in public response.
const playerMoveId=randomUUID();
opaque(await move(player.who,id(1090),path,playerMoveId),playerMoveId,"Hidden reactor");
assert.equal(count("SELECT count(*) FROM public.encounter_reaction_windows WHERE encounter_id='"+
 id(909)+"' AND status='pending' AND reactor_participant_id='"+id(1091)+"'"),1);
assert.equal(count("SELECT count(*) FROM private.p13_guarded_commands WHERE request_id='"+
 playerMoveId+"' AND result->>'reactorParticipantId'='"+id(1091)+"'"),1);
console.log("PASS 87: hidden reactor first execution returns no actor/window ID while reaction W persists");

// On exact retries the projector must run again, not return internal ledger raw.
opaque(await end(player.who,id(1080),playerEndId),playerEndId,"Hidden next actor replay");
opaque(await move(player.who,id(1090),path,playerMoveId),playerMoveId,"Hidden reactor replay");
denied(await move(player.who,id(1090),[{q:0,r:-1}],playerMoveId),
 /P13_REQUEST_CONFLICT/,"Changed hidden Move input");
console.log("PASS 88: hidden-response replay is reprojected and typed intent remains immutable");

// Same hidden source details remain available to explicitly authorized GM.
const gmEndId=randomUUID();
const gmEnd=await end(gm.who,id(1100),gmEndId);
assert.ifError(gmEnd.error);
assert.equal(gmEnd.data.nextParticipantId,id(1101));
const gmMoveId=randomUUID();
const gmMove=await move(gm.who,id(1110),path,gmMoveId);
assert.ifError(gmMove.error);
assert.equal(gmMove.data.reactorParticipantId,id(1111));
assert.ok(gmMove.data.reactionWindowId);
assert.equal(gmMove.data.reactionRequired,true);
console.log("PASS 89: GM retains original authorized next-actor and reactor details");

// No function result is a grant to an unrelated account; cached private row
// and hidden participants also stay inaccessible via player Data API.
denied(await end(outsider.who,id(1080),playerEndId),
 /P13_ACCESS_DENIED/,"Outsider hidden End Turn replay");
denied(await move(outsider.who,id(1090),path,playerMoveId),
 /P13_ACCESS_DENIED/,"Outsider hidden Move replay");
assert.deepEqual(await visible(outsider.who,id(1081)),[]);
assert.deepEqual(await visible(outsider.who,id(1091)),[]);
const direct=await outsider.who.from("encounter_command_requests").select("result").limit(1);
assert.ok(direct.error,"Unprivileged player unexpectedly read original raw command ledger");
console.log("PASS 90: unrelated signed-in JWT denied hidden replay and direct raw ledger");

// R2: if original player's controller grant is revoked, even generic replay
// is denied, and neither source command is executed again.
db("UPDATE public.encounter_participants SET controller_user_id=NULL WHERE id IN ('"+
 id(1080)+"','"+id(1090)+"')");
denied(await end(player.who,id(1080),playerEndId),
 /P13_ACCESS_DENIED/,"Revoked End Turn replay");
denied(await move(player.who,id(1090),path,playerMoveId),
 /P13_ACCESS_DENIED/,"Revoked Move replay");
assert.equal(count("SELECT count(*) FROM public.encounter_command_requests WHERE request_id IN ('"+
 playerEndId+"','"+playerMoveId+"')"),2);
console.log("PASS 91: R2 post-revocation blocks opaque replay without duplicate source mutation");

// Visibility transition: an unhidden next actor can be returned only after
// current authority is restored, confirming projection depends on current
// viewer rights rather than permanently discarding source data.
db("UPDATE public.encounter_participants SET controller_user_id='"+player.uid+
 "' WHERE id='"+id(1080)+"'");
db("UPDATE public.encounter_participants SET is_hidden=false WHERE id='"+id(1081)+"'");
const nowVisible=await end(player.who,id(1080),playerEndId);
assert.ifError(nowVisible.error);
assert.equal(nowVisible.data.nextParticipantId,id(1081));
db("UPDATE public.encounter_participants SET is_hidden=true WHERE id='"+id(1081)+"'");
opaque(await end(player.who,id(1080),playerEndId),playerEndId,"Reconcealed actor");
console.log("PASS 92: current visibility determines replay projection; reconcealment removes identity");
console.log("P1.3 cases 82–92 PASS in disposable genuine-GoTrue baseline/projection. 'Unknown Events' timing policy remains UNDECIDED; NOT a production solution.");
