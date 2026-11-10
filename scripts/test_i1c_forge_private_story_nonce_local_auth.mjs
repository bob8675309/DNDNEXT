#!/usr/bin/env node
// I1-B: REAL disposable GoTrue/PostgREST/PG17 combined original Forge + Story.
// Source inputs: #324 immutable intent candidate and #345 privacy Stage 1-3.
// RED-TO-GREEN: changed Story MUST reject; original #324/#345 contract unchanged elsewhere.
// Never contact a production or remote Supabase endpoint or print private Story.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const env = process.env;
for (const [key,value] of Object.entries({
  CI:"true", GITHUB_ACTIONS:"true",
  DNDNEXT_I1C_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  PGHOST:"127.0.0.1", PGPORT:"54322", PGDATABASE:"postgres"
})) assert.equal(env[key],value,"Unsafe I1-B environment: "+key);
assert.equal(env.PGUSER,"postgres");
assert.match(env.DNDNEXT_I1C_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(env.DNDNEXT_I1C_LOCAL_ANON_KEY,"Missing disposable anon key");
const makeClient=()=>createClient(env.DNDNEXT_I1C_LOCAL_URL,
  env.DNDNEXT_I1C_LOCAL_ANON_KEY,
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
const v3WrapperOriginal=sql("SELECT md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))");
const v2WrapperOriginal=sql("SELECT md5(pg_get_functiondef('public.create_player_character_v2(jsonb,jsonb)'::regprocedure))");
const originalInnerV3=sql("SELECT md5(pg_get_functiondef('private.create_player_character_v3_source_20261105(jsonb,jsonb,jsonb)'::regprocedure))");
sqlFile("sql/candidates/20261109_player_story_complete_intent_i1c_research.sql");
assert.equal(sql("SELECT md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))"),v3WrapperOriginal,"Original #324 public v3 must not be edited");
assert.equal(sql("SELECT md5(pg_get_functiondef('public.create_player_character_v2(jsonb,jsonb)'::regprocedure))"),v2WrapperOriginal,"Original #324 public v2 must not be edited");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.create_player_character_v3_source_20261105(jsonb,jsonb,jsonb)'::regprocedure))"),originalInnerV3,"Original Forge v3 source must remain unchanged");
assert.equal(sql("SELECT has_function_privilege('anon','private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)','EXECUTE')"),"f","No anon definer bridge");
assert.equal(sql("SELECT has_function_privilege('authenticated','private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)','EXECUTE')"),"t");
assert.equal(sql("SELECT NOT prosecdef FROM pg_proc WHERE oid='public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)'::regprocedure"),"t","Story INSERT must remain security invoker / RLS");
assert.equal(sql("SELECT to_regclass('private.player_creation_intent_reservations_v1') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regclass('public.character_backstory_secrets') IS NOT NULL"),"t");
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.characters'::regclass AND tgname IN ('characters_capture_creator_at_insert_v1','characters_guard_player_gm_secret_at_insert_v1') AND NOT tgisinternal"),"2");
assert.notEqual(sql("SELECT md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))"),originalV3);
sql("NOTIFY pgrst,'reload schema'");

const password="I1C-"+randomUUID()+"!";
async function signedActor(){
  const client=makeClient(),email="i1c-"+randomUUID()+"@example.invalid";
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
  creation_request_id:requestId,name:"I1C original Forge NPC source test",
  secret:null,sheet:{classKey:"fighter",level:1,marker:"I1C_GOTRUE_ORIGINAL"}
};
const create=(actor,story,p=payload)=>rpc(actor.client,
  "create_player_character_with_private_backstory_v1",{
    p_payload:p,p_spell_choices:[],p_magic_selections:[],
    p_private_backstory:story
  });
const originalStory="I1C-CREATOR-STORY-ORIGINAL";
const changedStory="I1C-CREATOR-STORY-ALTERED";
const editedStory="I1C-POST-CREATE-EXPLICIT-EDIT";
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
assert.equal(sql("SELECT sheet->>'marker' FROM public.character_sheets WHERE "+whereId),"I1C_GOTRUE_ORIGINAL");
console.log("PASS I1C-01: real signed first create, source original Forge, reservation, one private Story and trusted creator attribution");

// Inner #324 does reject changes to the original v3 payload under same nonce.
denied(await create(creator,originalStory,{...payload,name:"I1C CHANGED ORIGINAL INTENT"}),
  "modified original v3 payload", "22023");
denied(await create(outsider,originalStory),"cross-actor same nonce","42501");
assert.equal(recordCount("public.characters",whereNonce),1);
console.log("PASS I1C-02: changed original payload and forged nonce owner rejected via source-locked immutable reservation");

// The previously confirmed I1B-03 changed-only Story path must now reject
// BEFORE returning a cached character; never overwrite actual creator Story.
denied(await create(creator,changedStory),
  "changed-only private Story with identical nonce", "22023");
assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE "+whereId),
  originalStory,"A rejected changed Story must never mutate the original");
assert.equal(recordCount("public.characters",whereNonce),1);
assert.equal(recordCount("public.character_backstory_secrets",whereId),1);
const opaqueIntent=sql("SELECT encode(intent_sha256,'hex') FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+requestId+"'");
assert.match(opaqueIntent,/^[0-9a-f]{64}$/,"Only final digest must be stored, not Story text");
assert.equal(sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='private' AND table_name='player_creation_intent_reservations_v1' AND column_name ILIKE '%story%'"),"0");
console.log("PASS I1C-03: changed-only Story rejects 22023, source Story unchanged, opaque nonce digest only");


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
console.log("PASS I1C-04: signed identical same-nonce retries preserve later authorized Story edits");

// A failed private Story CHECK must undo BOTH the original Forge character
// and the #324 nonce reservation in the same PostgREST transaction.
const invalidNonce=randomUUID();
const invalid=await create(creator,"X".repeat(16001),
  {...payload,creation_request_id:invalidNonce,name:"I1C all-or-nothing invalid Story"});
denied(invalid,"private Story too long and atomic original Forge rollback","23514");
assert.equal(recordCount("public.characters","creation_request_id='"+invalidNonce+"'"),0);
assert.equal(recordCount("private.player_creation_intent_reservations_v1",
  "request_id='"+invalidNonce+"'"),0);
console.log("PASS I1C-05: Story CHECK failure rolls back character and reserved nonce atomically");


// Direct original v3 and new private-Story wrapper MUST reject same-nonce
// cross-API replays in BOTH directions (prevents bypassing Story fingerprint).
const originalDirectReplay=await rpc(creator.client,"create_player_character_v3",{
  p_payload:payload,p_spell_choices:[],p_magic_selections:[]
});
denied(originalDirectReplay,"direct v3 replay of Story-wrapped nonce","22023");
const directNonce=randomUUID(),directPayload={
  ...payload,creation_request_id:directNonce,name:"I1C original direct v3 path"
};
const directId=succeeded(await rpc(creator.client,"create_player_character_v3",{
  p_payload:directPayload,p_spell_choices:[],p_magic_selections:[]
}),"original direct v3 unaffected");
assert.equal(recordCount("public.characters","creation_request_id='"+directNonce+"'"),1);
denied(await create(creator,"Story not in original nonce",directPayload),
  "Story wrapper cannot adopt old direct v3 nonce","22023");
assert.equal(recordCount("public.character_backstory_secrets",
  "character_id='"+directId+"'"),0);
console.log("PASS I1C-07: original public v3 unchanged; incompatible mixed-API replay fails closed");

// Reject an attempt to inject the server-only ephemeral nonce-digest marker.
const spoofNonce=randomUUID();
denied(await create(creator,originalStory,{
  ...payload,creation_request_id:spoofNonce,
  __dndnext_private_story_intent_sha256_i1c:"client-fake"
}),"forged internal nonce marker","22023");
assert.equal(recordCount("private.player_creation_intent_reservations_v1",
  "request_id='"+spoofNonce+"'"),0);
console.log("PASS I1C-08: client cannot supply private Story nonce digest");

// A new pair of concurrent signed calls using SAME nonce but DISTINCT Story
// must serialize on the ORIGINAL #324 reservation row, exactly one wins.
const racedNonce=randomUUID(),racePayload={
  ...payload,creation_request_id:racedNonce,name:"I1C concurrent conflicting Story"
};
const results=await Promise.all([
  create(creator,"I1C-RACE-A",racePayload),
  create(creator,"I1C-RACE-B",racePayload)
]);
const winners=results.filter(x=>!x.error);
const losers=results.filter(x=>x.error);
assert.equal(winners.length,1,"Exactly one conflicting signed creation should win");
assert.equal(losers.length,1);
denied(losers[0],"conflicting concurrently submitted Story nonce","22023");
assert.equal(recordCount("public.characters",
  "creation_request_id='"+racedNonce+"'"),1);
assert.equal(recordCount("private.player_creation_intent_reservations_v1",
  "request_id='"+racedNonce+"'"),1);
assert.equal(recordCount("public.character_backstory_secrets",
  "character_id='"+winners[0].data+"'"),1);
console.log("PASS I1C-09: concurrent conflicting Story intent serializes, one creates, one rejects");

// Same-intent concurrent calls both return the one original without duplicate
// equipment/Story creation. This checks the basic reservation serialization.
const matchNonce=randomUUID(),matchPayload={
  ...payload,creation_request_id:matchNonce,name:"I1C concurrent identical Story"
};
const equals=await Promise.all([
  create(creator,"I1C-SAME-INTENT",matchPayload),
  create(creator,"I1C-SAME-INTENT",matchPayload)
]);
const canonical=succeeded(equals[0],"first same-intent concurrent creation");
assert.equal(succeeded(equals[1],"second same-intent concurrent creation"),canonical);
assert.equal(recordCount("public.characters","creation_request_id='"+matchNonce+"'"),1);
assert.equal(recordCount("public.character_backstory_secrets","character_id='"+canonical+"'"),1);
console.log("PASS I1C-10: concurrent identical Story intent returns one canonical creation");

// No Story and blank Story are both absent Story in the source wrapper.
const emptyNonce=randomUUID(),emptyPayload={
  ...payload,creation_request_id:emptyNonce,name:"I1C blank Story normalization"
};
const blankId=succeeded(await create(creator,null,emptyPayload),"NULL private Story");
assert.equal(succeeded(await create(creator,"   ",emptyPayload),
  "blank Story equivalent replay"),blankId);
assert.equal(recordCount("public.character_backstory_secrets","character_id='"+blankId+"'"),0);
console.log("PASS I1C-11: null/blank Story normalization is deterministic");

// A previous editor must NOT continue replaying after loss of current rights.
sql("UPDATE public.character_permissions SET can_edit=false WHERE "+whereId+
  " AND user_id='"+creator.id+"'");
denied(await create(creator,originalStory),"revoked creator nonce replay","42501");
assert.equal(recordCount("public.characters",whereNonce),1);
assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE "+whereId),editedStory);
console.log("PASS I1C-06: replay rechecks current editor permission; no new characters or Story writes");

console.log("I1C RESULT: COMPLETE-STORY NONCE RED-TO-GREEN; signed original-source subset, NOT 31/31 trigger acceptance");
