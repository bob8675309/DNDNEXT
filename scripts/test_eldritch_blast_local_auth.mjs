#!/usr/bin/env node
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
import {readEldritchSignedInState,assertNoEldritchCombatMutation,
 assertEldritchCommittedOnce} from "./lib/eldritchBlastSignedInAssertions.mjs";
const e=process.env,url=e.DNDNEXT_EB_LOCAL_URL,key=e.DNDNEXT_EB_LOCAL_ANON_KEY;
assert.ok(e.GITHUB_ACTIONS==="true"&&e.CI==="true"&&
 e.DNDNEXT_EB_LOCAL_CI_CONFIRM==="CI_DISPOSABLE_LOCAL_ONLY"&&
 e.PGPORT==="54322"&&e.PGDATABASE==="postgres"&&
 (e.PGHOST==="127.0.0.1"||e.PGHOST==="localhost"),"Not a local CI environment");
assert.ok(/^http:\/\/(?:localhost|127\.0\.0\.1):54321\/?$/.test(url||"")&&key,"Remote API forbidden");
const id=n=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
function db(q){
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",q],
  {encoding:"utf8",env:{...e,PGUSER:"postgres"}});
 if(r.status!==0)throw Error("Local database fixture command failed: "+r.stderr);
 return r.stdout.trim();
}
const clients=[0,1].map(()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
const users=[],password="Disposable-"+randomUUID()+"!X9";
try{
 for(const client of clients){
  const email="eb-test-"+randomUUID()+"@example.invalid";
  const signup=await client.auth.signUp({email,password});assert.ifError(signup.error);
  const login=await client.auth.signInWithPassword({email,password});assert.ifError(login.error);
  assert.ok(login.data.session?.access_token);
  const u=await client.auth.getUser();assert.ifError(u.error);
  assert.equal(u.data.user.id,login.data.user.id);
  const jwt=await client.auth.getClaims();assert.ifError(jwt.error);
  assert.equal(jwt.data.claims.sub,login.data.user.id);
  assert.equal(jwt.data.claims.role,"authenticated");
  assert.notEqual(jwt.data.claims.is_anonymous,true);
  users.push({client,uid:login.data.user.id});
 }
 const [a,b]=users;assert.notEqual(a.uid,b.uid);
 db("update public.encounter_participants set controller_user_id='"+a.uid+"' where id=public.fixture_uuid(11)");
 db("update public.encounter_participants set controller_user_id='"+b.uid+"' where id=public.fixture_uuid(21)");
 const identity=await a.client.rpc("eb_ci_identity_v1");assert.ifError(identity.error);
 assert.equal(identity.data.uid,a.uid);assert.equal(identity.data.role,"authenticated");
 const actor=id(11),target=id(21),assignment=id(51),encounter=id(1),rid=randomUUID();
 const req=uuid=>({p_caster_id:actor,p_assignment_id:assignment,p_target_ids:[target],p_request_id:uuid});
 const ctx={encounterId:encounter,actorId:actor,targets:[target],requestId:rid};
 const before=await readEldritchSignedInState(a.client,ctx);assert.equal(before.logs.length,0);
 const forbidden=await b.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(randomUUID()));
 assert.equal(forbidden.error?.code,"42501","Other user's cast not denied");
 assertNoEldritchCombatMutation(before,await readEldritchSignedInState(a.client,ctx),"Foreign player");
 const cast=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(rid));
 assert.ifError(cast.error);
 const after=await readEldritchSignedInState(a.client,ctx);
 assertEldritchCommittedOnce(before,after,cast.data,[target],rid);
 const again=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(rid));
 assert.ifError(again.error);assert.deepEqual(again.data,cast.data);
 assertNoEldritchCombatMutation(after,await readEldritchSignedInState(a.client,ctx),"Replay");
 const foreign=await b.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(rid));
 assert.equal(foreign.error?.code,"42501");
 const altered=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",
  {...req(rid),p_target_ids:[id(22)]});
 assert.equal(altered.error?.code,"42501");
 assertNoEldritchCombatMutation(after,await readEldritchSignedInState(a.client,ctx),"Wrong intent");
 assert.equal(Number(db("select count(*) from public.encounter_command_requests where request_id='"+rid+"'")),1);
 console.log("PASS real Supabase JWTs, signed-in RLS, unauthorized user, exactly one action/version/HP/log/ledger write, replay/intent denial");
}finally{await Promise.allSettled(clients.map(x=>x.auth.signOut()));}
