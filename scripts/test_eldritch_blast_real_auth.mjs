#!/usr/bin/env node
// REAL Supabase Auth/PostgREST acceptance harness. NEVER use production data.
// Required separate staging project and two normal test accounts. No service key.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { readEldritchSignedInState, assertNoEldritchCombatMutation,
  assertEldritchCommittedOnce } from './lib/eldritchBlastSignedInAssertions.mjs';

const e=process.env;
const prodRef='ucggczovhmauhshvhusx';
const url=e.DNDNEXT_EB_STAGING_URL;
const key=e.DNDNEXT_EB_STAGING_PUBLISHABLE_KEY;
if(!url||!key) throw new Error('Set staging URL and publishable API key (never a service_role key).');
const parsed=new URL(url);
const match=/^([a-z0-9-]+)\.supabase\.co$/.exec(parsed.hostname);
if(parsed.protocol!=='https:'||!match||match[1]===prodRef||parsed.pathname!=='/')
  throw new Error('Refusing non-Supabase, production or unexpected staging URL.');
const users=['A','B'].map(label=>{
 const email=e['DNDNEXT_EB_TEST_'+label+'_EMAIL'];
 const password=e['DNDNEXT_EB_TEST_'+label+'_PASSWORD'];
 if(!email||!password) throw new Error('Two distinct staging test-user credentials required.');
 return {label,email,password};
});
assert.notEqual(users[0].email.toLowerCase(),users[1].email.toLowerCase(),'Test accounts must differ.');
if(/^eyJ|service_role/i.test(key)) throw new Error('Use only a project publishable key, not a JWT/service key.');

async function signIn({label,email,password}) {
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data:login,error:loginError}=await client.auth.signInWithPassword({email,password});
 if(loginError||!login?.session?.access_token) throw new Error('Staging sign-in failed for test account '+label);
 const {data:checked,error:authError}=await client.auth.getUser();
 if(authError||!checked?.user?.id||checked.user.id!==login.user.id)
   throw new Error('Supabase Auth server did not confirm account '+label);
 const {data:claims,error:claimsError}=await client.auth.getClaims();
 if(claimsError||!claims?.claims||claims.claims.sub!==checked.user.id||
    claims.claims.role!=='authenticated'||claims.claims.is_anonymous===true||
    checked.user.is_anonymous===true)
   throw new Error('Signed JWT claims or non-anonymous identity invalid for account '+label);
 return {client,uid:checked.user.id};
}
const a=await signIn(users[0]);
const b=await signIn(users[1]);
try {
 assert.notEqual(a.uid,b.uid,'Two distinct real signed-in identities required');
 console.log('PASS: two distinct, non-anonymous accounts verified by Supabase Auth on isolated staging.');
 const confirm='YES_DISPOSABLE_STAGING_CAST_ONLY';
 if(e.DNDNEXT_EB_MUTATING_TEST_CONFIRM!==confirm) {
   console.log('PREFLIGHT ONLY. No encounter RPC called. Provide disposable encounter inputs and explicit confirmation for mutation tests.');
   process.exitCode=0;
 } else {
   const uuid=/^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i;
   const actor=e.DNDNEXT_EB_CASTER_ID;
   const spell=e.DNDNEXT_EB_ASSIGNMENT_ID;
   const targetText=e.DNDNEXT_EB_TARGET_IDS||'';
   const targets=targetText.split(',').map(s=>s.trim());
   if(!uuid.test(actor||'')||!uuid.test(spell||'')||
      !targets.length||targets.some(t=>!uuid.test(t))||
      e.DNDNEXT_EB_TEST_OWNER_UID!==a.uid)
     throw new Error('Missing valid disposable actor/assignment/targets or controller identity mismatch.');
   if(!e.DNDNEXT_EB_DISPOSABLE_ENCOUNTER_ID||!uuid.test(e.DNDNEXT_EB_DISPOSABLE_ENCOUNTER_ID))
     throw new Error('Disposable staging encounter ID must be provided.');
   // The confirmation UUID is not enough: verify the caster belongs to this
   // named disposable encounter, under the signed-in player's own RLS.
   const {data:encounter,error:encounterError}=await a.client.from('encounters')
     .select('id,name,status,active_participant_id')
     .eq('id',e.DNDNEXT_EB_DISPOSABLE_ENCOUNTER_ID).single();
   if(encounterError||!encounter||!String(encounter.name||'').startsWith('EB TEST - ')||
      encounter.status!=='active'||encounter.active_participant_id!==actor)
     throw new Error('Staging encounter must be active, named EB TEST - ..., and have the test caster on turn.');
   const {data:participant,error:participantError}=await a.client.from('encounter_participants')
     .select('id,encounter_id,controller_user_id,is_defeated,action_available')
     .eq('id',actor).single();
   if(participantError||!participant||participant.encounter_id!==encounter.id||
      participant.controller_user_id!==a.uid||participant.is_defeated||
      !participant.action_available)
     throw new Error('Test caster must be controlled by Player A, eligible and inside the disposable encounter.');
   const rpc='encounter_cast_eldritch_blast_candidate_v1';
   const request=(requestId,targetIds=targets)=>({
      p_caster_id:actor,p_assignment_id:spell,p_target_ids:targetIds,p_request_id:requestId
   });
   const isDenied=(error)=>{
     assert.ok(error,'Unauthorized request must be rejected');
     assert.notEqual(error.code,'PGRST202','RPC must actually be installed and exposed in staging');
     assert.ok(error.code==='42501'||/permission|not authorized|not permitted|access denied/i.test(error.message||''),
       'Expected permission rejection, got '+String(error.code));
   };
   // Read combat state through the SAME ordinary authenticated client used
   // to cast. Unexposed command ledger rows are checked separately by a
   // staging administrator; never use service_role to fabricate RLS here.
   const requestId=randomUUID();
   const stateContext={
     encounterId:encounter.id,actorId:actor,targets,requestId,
   };
   const before=await readEldritchSignedInState(a.client,stateContext);
   assert.equal(before.logs.length,0,'Request ID was not fresh');
   let result=await b.client.rpc(rpc,request(randomUUID()));
   isDenied(result.error);
   const afterUnauthorized=await readEldritchSignedInState(a.client,stateContext);
   assertNoEldritchCombatMutation(before,afterUnauthorized,'Foreign player rejection');
   result=await a.client.rpc(rpc,request(requestId));
   if(result.error) throw new Error('Authorized cast rejected: '+result.error.code+' '+result.error.message);
   const cast=result.data;
   assert.ok(cast?.spellKey?.toLowerCase()==='eldritch-blast|xphb');
   assert.equal(cast?.beamCount,targets.length);
   assert.deepEqual(cast?.targetIds,targets);
   const afterCast=await readEldritchSignedInState(a.client,stateContext);
   assertEldritchCommittedOnce(before,afterCast,cast,targets,requestId);
   const repeat=await a.client.rpc(rpc,request(requestId));
   if(repeat.error) throw new Error('Exact signed-in replay rejected: '+repeat.error.code);
   assert.deepEqual(repeat.data,cast,'Replay must preserve exact outcome with no second damage');
   assertNoEldritchCombatMutation(afterCast,
     await readEldritchSignedInState(a.client,stateContext),'Idempotent replay');
   const foreignReplay=await b.client.rpc(rpc,request(requestId));
   isDenied(foreignReplay.error);
   assertNoEldritchCombatMutation(afterCast,
     await readEldritchSignedInState(a.client,stateContext),'Foreign request replay');
   const changed=await a.client.rpc(rpc,request(requestId,[randomUUID(),...targets.slice(1)]));
   isDenied(changed.error);
   assertNoEldritchCombatMutation(afterCast,
     await readEldritchSignedInState(a.client,stateContext),'Changed target intent');
   console.log('PASS: actual JWT/RLS cast, exactly one version/Action/log, target HP/temp HP match each beam, unauthorized denial, exact replay and changed-intent rejection.');
   console.log('NOTE: Command-request ledger has no client SELECT RLS. Verify exactly one row separately on disposable staging via admin SQL.');
   console.log('NOTE: Revoked editor must be tested separately after staging permission changes; mock revocation is not real JWT acceptance.');
 }
} finally {
 await Promise.allSettled([a.client.auth.signOut(),b.client.auth.signOut()]);
}
