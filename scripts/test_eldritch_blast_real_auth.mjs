#!/usr/bin/env node
// REAL Supabase Auth/PostgREST acceptance harness. NEVER use production data.
// Required separate staging project and two normal test accounts. No service key.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

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
   // Rejection before action spending or HP changes. Not a service_role call.
   let result=await b.client.rpc(rpc,request(randomUUID()));
   isDenied(result.error);
   const requestId=randomUUID();
   result=await a.client.rpc(rpc,request(requestId));
   if(result.error) throw new Error('Authorized cast rejected: '+result.error.code+' '+result.error.message);
   const cast=result.data;
   assert.ok(cast?.spellKey?.toLowerCase()==='eldritch-blast|xphb');
   assert.equal(cast?.beamCount,targets.length);
   assert.deepEqual(cast?.targetIds,targets);
   const repeat=await a.client.rpc(rpc,request(requestId));
   if(repeat.error) throw new Error('Exact signed-in replay rejected: '+repeat.error.code);
   assert.deepEqual(repeat.data,cast,'Replay must preserve exact outcome with no second damage');
   const foreignReplay=await b.client.rpc(rpc,request(requestId));
   isDenied(foreignReplay.error);
   const changed=await a.client.rpc(rpc,request(requestId,[randomUUID(),...targets.slice(1)]));
   isDenied(changed.error);
   console.log('PASS: authorized cast, unrelated caller denied, exact replay and changed-target rejection.');
   console.log('NOTE: Inspect disposable DB log/HP once for exactly one mutation; permission-revocation test remains separate.');
 }
} finally {
 await Promise.allSettled([a.client.auth.signOut(),b.client.auth.signOut()]);
}
