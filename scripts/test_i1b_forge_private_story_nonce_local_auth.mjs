#!/usr/bin/env node
// I1-B: REAL disposable GoTrue/PostgREST/PG17 combined original Forge + Story.
// Source inputs: #324 immutable intent candidate and #345 privacy Stage 1-3.
// EXPECTED-GAP characterization is research, NOT a production release gate.
// Never contact a production or remote Supabase endpoint or print private Story.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const env = process.env;
for (const [key,value] of Object.entries({
  CI:"true", GITHUB_ACTIONS:"true",
  DNDNEXT_I1B_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  PGHOST:"127.0.0.1", PGPORT:"54322", PGDATABASE:"postgres"
})) assert.equal(env[key],value,"Unsafe I1-B environment: "+key);
assert.equal(env.PGUSER,"postgres");
assert.match(env.DNDNEXT_I1B_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(env.DNDNEXT_I1B_LOCAL_ANON_KEY,"Missing disposable anon key");
const makeClient=()=>createClient(env.DNDNEXT_I1B_LOCAL_URL,
  env.DNDNEXT_I1B_LOCAL_ANON_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const psql=(args)=>{
  const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",...args],
    {env,encoding:"utf8",timeout:30000});
  assert.equal(r.status,0,"I1-B local-only psql failure: "+(r.stderr||"").slice(-1700));
  return r.stdout.trim();
};
const sql=(q)=>psql(["-qAt","-c",q]);
const sqlFile=(p)=>psql(["-q","-f",p]);
const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function rpc(client,name,args){
  for(let i=0;i<50;i++){
    const r=await client.rpc(name,args);
    if(r.error?.code==="PGRST202"){await wait(180);continue}
    return r;
  }
  throw Error("Local PostgREST did not refresh RPC schema: "+name);
}
function succeeded(r,label){assert.ifError(r.error);assert.ok(r.data,label+" missing result");return r.data}
function denied(r,label,code){
  assert.ok(r.error,label+" unexpectedly succeeded");
  assert.equal(r.error.code,code,label+" wrong rejection SQLSTATE");
  return r.error;
}
function recordCount(table,where){
  assert.ok([
    "public.characters","public.character_sheets",
    "public.character_backstory_secrets",
    "private.player_creation_intent_reservations_v1"
  ].includes(table));
  return Number(sql("SELECT count(*) FROM "+table+" WHERE "+where));
}
const originalV3="6ba73e6f12fcf826cc0a739cce45ff40";
const originalV2="0351f0a00acae023278e1b8b065b00c9";
assert.equal(sql("SELECT md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))"),originalV3);
assert.equal(sql("SELECT md5(pg_get_functiondef('public.create_player_character_v2(jsonb,jsonb)'::regprocedure))"),originalV2);
assert.equal(sql("SELECT to_regclass('private.player_creation_intent_reservations_v1') IS NULL"),"t");

// Apply original UNMODIFIED held Stage 1-3 and nonce candidate on disposable DB.
// We do not run Stage4/inventory or a simulated auth.uid() in this test.
for (const file of [
  "sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql",
  "sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql",
  "sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql",
  "sql/candidates/20261105_player_creation_immutable_intent_v1.sql"
]) sqlFile(file);
assert.equal(sql("SELECT to_regclass('private.player_creation_intent_reservations_v1') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regclass('public.character_backstory_secrets') IS NOT NULL"),"t");
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.characters'::regclass AND tgname IN ('characters_capture_creator_at_insert_v1','characters_guard_player_gm_secret_at_insert_v1') AND NOT tgisinternal"),"2");
assert.notEqual(sql("SELECT md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))"),originalV3);
sql("NOTIFY pgrst,'reload schema'");

const password="I1B-"+randomUUID()+"!";
async function signedActor(){
  const client=makeClient(),email="i1b-"+randomUUID()+"@example.invalid";
  assert.ifError((await client.auth.signUp({email,password})).error);
  assert.ifError((await client.auth.signInWithPassword({email,password})).error);
  const who=await client.auth.getUser(),claims=await client.auth.getClaims();
  assert.ifError(who.error);assert.ifError(claims.error);
  assert.equal(claims.data.claims.sub,who.data.user.id);
  assert.equal(claims.data.claims.role,"authenticated");
  return {client,id:who.data.user.id};
}
const creator=await signedActor(),outsider=await signedActor();
const requestId=randomUUID();
const payload={
  creation_request_id:requestId,name:"I1B original Forge NPC source test",
  secret:null,sheet:{classKey:"fighter",level:1,marker:"I1B_GOTRUE_ORIGINAL"}
};
const create=(actor,story,p=payload)=>rpc(actor.client,
  "create_player_character_with_private_backstory_v1",{
    p_payload:p,p_spell_choices:[],p_magic_selections:[],
    p_private_backstory:story
  });
const originalStory="I1B-CREATOR-STORY-ORIGINAL";
const changedStory="I1B-CREATOR-STORY-ALTERED";
const editedStory="I1B-POST-CREATE-EXPLICIT-EDIT";
const whereNonce="creation_request_id='"+requestId+"'";
const characterId=succeeded(await create(creator,originalStory),"combined first creation");
const whereId="character_id='"+characterId+"'";
assert.equal(recordCount("public.characters",whereNonce),1);
assert.equal(recordCount("public.character_sheets",whereId),1);
assert.equal(recordCount("public.character_backstory_secrets",whereId),1);
assert.equal(recordCount("private.player_creation_intent_reservations_v1","request_id='"+requestId+"'"),1);
assert.equal(sql("SELECT secret IS NULL FROM public.characters WHERE id='"+characterId+"'"),"t");
assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE "+whereId),originalStory);
assert.equal(sql("SELECT creator_user_id FROM private.character_creator_attribution WHERE "+whereId),creator.id);
assert.equal(sql("SELECT sheet->>'marker' FROM public.character_sheets WHERE "+whereId),"I1B_GOTRUE_ORIGINAL");
console.log("PASS I1B-01: real signed first create, source original Forge, reservation, one private Story and trusted creator attribution");

// Inner #324 does reject changes to the original v3 payload under same nonce.
denied(await create(creator,originalStory,{...payload,name:"I1B CHANGED ORIGINAL INTENT"}),
  "modified original v3 payload", "22023");
denied(await create(outsider,originalStory),"cross-actor same nonce","42501");
assert.equal(recordCount("public.characters",whereNonce),1);
console.log("PASS I1B-02: changed original payload and forged nonce owner rejected via source-locked immutable reservation");

// Source-authentic GAP detector: changed private Story is NOT part of #324 digest.
// Accepting changed Story returns the original character, silently ignoring the
// conflicting Story via #345 ON CONFLICT DO NOTHING. This is NOT accepted behavior.
const changedOnly=await create(creator,changedStory);
let gapObserved=false;
if (!changedOnly.error) {
  assert.equal(changedOnly.data,characterId,"Unexpected second character for changed Story");
  assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE "+whereId),
    originalStory,"Changed Story replay must not overwrite initial Story");
  gapObserved=true;
  console.log("KNOWN INTEGRATION GAP I1B-03: same nonce + CHANGED-ONLY private Story was ACCEPTED as old character; complete-intent rejection is NOT implemented");
} else {
  assert.equal(changedOnly.error.code,"22023","Unexpected failure type in changed-only Story test");
  console.log("PASS I1B-03: changed-only private Story correctly rejected by complete-intent contract");
}
assert.equal(recordCount("public.characters",whereNonce),1);
assert.equal(recordCount("public.character_backstory_secrets",whereId),1);

// Legitimate identical retry must stay inert, including after the creator edits
// Story using its independent authoring permission.
assert.equal(succeeded(await create(creator,originalStory),"identical replay"),characterId);
const edit=await creator.client.from("character_backstory_secrets")
  .update({secret_text:editedStory}).eq("character_id",characterId)
  .select("secret_text").single();
assert.ifError(edit.error);
assert.equal(edit.data.secret_text,editedStory);
assert.equal(succeeded(await create(creator,originalStory),"stale identical retry"),characterId);
assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE "+whereId),editedStory);
console.log("PASS I1B-04: signed identical same-nonce retries preserve later authorized Story edits");

// A failed private Story CHECK must undo BOTH the original Forge character
// and the #324 nonce reservation in the same PostgREST transaction.
const invalidNonce=randomUUID();
const invalid=await create(creator,"X".repeat(16001),
  {...payload,creation_request_id:invalidNonce,name:"I1B all-or-nothing invalid Story"});
denied(invalid,"private Story too long and atomic original Forge rollback","23514");
assert.equal(recordCount("public.characters","creation_request_id='"+invalidNonce+"'"),0);
assert.equal(recordCount("private.player_creation_intent_reservations_v1",
  "request_id='"+invalidNonce+"'"),0);
console.log("PASS I1B-05: Story CHECK failure rolls back character and reserved nonce atomically");

// A previous editor must NOT continue replaying after loss of current rights.
sql("UPDATE public.character_permissions SET can_edit=false WHERE "+whereId+
  " AND user_id='"+creator.id+"'");
denied(await create(creator,originalStory),"revoked creator nonce replay","42501");
assert.equal(recordCount("public.characters",whereNonce),1);
assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE "+whereId),editedStory);
console.log("PASS I1B-06: replay rechecks current editor permission; no new characters or Story writes");

console.log("I1B RESULT: "+(gapObserved?"KNOWN GAP CONFIRMED; NOT RELEASE READY":
  "complete Story nonce contract rejected changed intent")+
  "; original-source combined GoTrue/PG17 subset only, NOT 31/31 trigger acceptance");
if(gapObserved && env.DNDNEXT_I1B_REQUIRE_FIXED==="1"){
  console.error("I1B release gate RED: changed-only-Story was silently accepted");
  process.exitCode=1;
}
