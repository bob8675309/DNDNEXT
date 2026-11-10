#!/usr/bin/env node
// I1-B: REAL disposable GoTrue/PostgREST/PG17 combined original Forge + Story.
// Source inputs: #324 immutable intent candidate and #345 privacy Stage 1-3.
// RED-TO-GREEN: changed Story MUST reject; original #324/#345 contract unchanged elsewhere.
// Never contact a production or remote Supabase endpoint or print private Story.
import assert from "node:assert/strict";
import { randomUUID,createHash } from "node:crypto";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const env = process.env;
for (const [key,value] of Object.entries({
  CI:"true", GITHUB_ACTIONS:"true",
  DNDNEXT_I1G_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  PGHOST:"127.0.0.1", PGPORT:"55622", PGDATABASE:"postgres"
})) assert.equal(env[key],value,"Unsafe I1-F environment: "+key);
assert.equal(env.PGUSER,"postgres");
assert.match(env.DNDNEXT_I1G_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:55621\/?$/);
assert.ok(env.DNDNEXT_I1G_LOCAL_ANON_KEY,"Missing disposable anon key");
const makeClient=()=>createClient(env.DNDNEXT_I1G_LOCAL_URL,
  env.DNDNEXT_I1G_LOCAL_ANON_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const psql=(args)=>{
  const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",...args],
    {env,encoding:"utf8",timeout:30000});
  assert.equal(r.status,0,"I1-F local-only psql failure: "+(r.stderr||"").slice(-1700));
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


// I1-D signed combined equipment/Story/nonce and Stage4 RLS/CHECK gates.
// Existing #324 reservation is the REAL schema; two guard-only options/wallet
// tables in setup are NOT tested Forge grants, and 14 original triggers remain
// intentionally absent. Never describe this as 31-trigger acceptance.
sqlFile("scripts/fixtures/i1d_forge_story_inventory_setup_pg17.sql");
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass AND tgname='character_progression_materialize_player_forge_starting_equipme' AND tgdeferrable AND tginitdeferred"),"1");
const gearPayload=(name,nonce)=>({
  name,creation_request_id:nonce,secret:null,
  sheet:{classKey:"fighter",level:1,
    startingEquipmentSelections:{mode:"package",classOption:"A",ruleset:"vanilla"}}
});
const gearStory="I1D-SIGNED-CREATOR-PRIVATE-GEAR-STORY";
const gearNonce=randomUUID(), gearIntent=gearPayload("I1D source-original gear before old check",gearNonce);
const gearId=succeeded(await create(creator,gearStory,gearIntent),
  "Original Forge + Story + deferred gear before legacy CHECK");
const equipmentFor=id=>Number(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character' AND owner_id='"+id+"' AND card_payload->>'startingEquipment'='true'"));
assert.equal(equipmentFor(gearId),1);
assert.equal(recordCount("public.character_backstory_secrets","character_id='"+gearId+"'"),1);
assert.equal(Number(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+gearId+"'")),1);
assert.equal(recordCount("private.player_creation_intent_reservations_v1","request_id='"+gearNonce+"'"),1);
console.log("PASS I1D-01: I1-C Story-aware nonce + true #324 reservation + original deferred equipment and currency commit");

const levelupId=randomUUID();
sql("INSERT INTO public.character_level_up_sessions(id,character_id,status) VALUES ('"+
  levelupId+"','"+gearId+"','open')");
sql("UPDATE public.character_progression SET pending_level_up=false WHERE character_id='"+gearId+"'");
assert.equal(sql("SELECT status FROM public.character_level_up_sessions WHERE id='"+levelupId+"'"),"cancelled",
  "Source-original progression cancellation trigger must run");
const badSpriteId=randomUUID();
const invalidSprite=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-c",
  "INSERT INTO public.characters(id,name,kind,visual_asset_id) VALUES ('"+
  badSpriteId+"','I1D bad synthetic sprite','npc','00000000-0000-0000-0000-000000007422')"],
  {env,encoding:"utf8",timeout:20000});
assert.notEqual(invalidSprite.status,0,"Original sprite guard must block invalid 32px directional source");
assert.equal(recordCount("public.characters","id='"+badSpriteId+"'"),0);
const mogId=randomUUID();
sql("INSERT INTO public.characters(id,name,kind) VALUES ('"+mogId+"',' MoG ','npc')");
const mogDelete=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-c",
  "DELETE FROM public.characters WHERE id='"+mogId+"'"],
  {env,encoding:"utf8",timeout:20000});
assert.notEqual(mogDelete.status,0,"Original protected Mog cannot be deleted");
assert.match(mogDelete.stderr,/Mog is protected and cannot be deleted/i);
assert.equal(recordCount("public.characters","id='"+mogId+"'"),1);
console.log("PASS I1D-11: three formerly unstaged source-exact original triggers verified (level-up cancel, invalid sprite guard, Mog protection); two world-map triggers untouched");


const merchantId=randomUUID(),stockId=randomUUID();
sql("INSERT INTO public.characters(id,name,kind) VALUES ('"+merchantId+"','I1D synthetic existing merchant','merchant')");
sql("INSERT INTO public.character_stock(id,character_id,qty,display_name,card_payload,price_gp,item_id) VALUES ('"+
  stockId+"','"+merchantId+"',2,'I1D test stock','{}'::jsonb,1,'training-dagger')");

sqlFile("scripts/fixtures/forge_owner_constraint_deferred_creation_local_auth_pg17.sql");
sqlFile("scripts/fixtures/forge_inventory_policy_source_local_auth_pg17.sql");
assert.equal(sql("SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass AND conname IN ('inventory_items_owner_type_check','inventory_items_owner_type_chk')"),"2");
assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),"4");
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.inventory_items'::regclass AND NOT tgisinternal AND tgname IN ('inventory_items_apply_structured_crafting_traits_v1','zz_inventory_items_apply_smithing_affinity_polish_v4')"),"2");
console.log("PASS I1D-02: original two inventory item triggers, both old/new owner CHECK definitions and four source-shaped RLS policies");

const digest=(table)=>{
  assert.ok(["items_catalog","spells_catalog","inventory_items","character_stock"].includes(table));
  return sql("SELECT md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'')) FROM public."+table+" x");
};
const preserved={
  item:digest("items_catalog"),spell:digest("spells_catalog"),
  inv:digest("inventory_items"),stock:digest("character_stock"),
  nonce:sql("SELECT encode(intent_sha256,'hex') FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+gearNonce+"'"),
  story:sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id='"+gearId+"'")
};
const blockedNonce=randomUUID(),blockedPayload=gearPayload("I1D legacy CHECK blocks Story-wrapped Forge",blockedNonce);
denied(await create(creator,"I1D-ROLLBACK-STORY",blockedPayload),
  "deferred original Forge rejects new character equipment under obsolete NOT VALID CHECK","23514");
assert.equal(recordCount("public.characters","creation_request_id='"+blockedNonce+"'"),0);
assert.equal(recordCount("private.player_creation_intent_reservations_v1","request_id='"+blockedNonce+"'"),0);
assert.equal(digest("inventory_items"),preserved.inv);
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+gearId+"'"),"1");
console.log("PASS I1D-03: obsolete NOT VALID CHECK reproduces signed deferred Forge/Story failure and entire nonce rollback");

// Preserve exact Stage4 owner CHECK+four-policy atomicity. This is a preview
// of the unchanged candidate's body; intentionally abort before commit.
const stage4=fs.readFileSync("sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql","utf8");
const stage4blob=createHash("sha1").update("blob "+Buffer.byteLength(stage4)+"\0").update(stage4).digest("hex");
assert.equal(stage4blob,"4532ddb8db642d0d0ab14646a3e87c034d4134c6","Original Stage4 SQL source drift");
assert.equal((stage4.match(/^BEGIN;$/gm)||[]).length,1);
assert.equal((stage4.match(/^COMMIT;$/gm)||[]).length,1);
const stage4body=stage4.replace(/^BEGIN;$/m,"").replace(/^COMMIT;$/m,"");
const definitionDigest="SELECT md5(coalesce((SELECT string_agg(conname||'|'||convalidated::text||'|'||pg_get_constraintdef(oid,true),';' ORDER BY conname) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass AND conname IN ('inventory_items_owner_type_chk','inventory_items_owner_type_check')),'') || '|' || coalesce((SELECT string_agg(polname||'|'||coalesce(pg_get_expr(polqual,polrelid),'')||'|'||coalesce(pg_get_expr(polwithcheck,polrelid),''),';' ORDER BY polname) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass),''))";
const beforeDefinition=sql(definitionDigest);
for(const [suffix,fail] of [["ROLLBACK;",false],["SELECT 1 / 0;\nCOMMIT;",true]]) {
  const p=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt"],{
    input:"BEGIN;\n"+stage4body+"\n"+suffix+"\n",
    env,encoding:"utf8",timeout:30000});
  if(fail) {assert.notEqual(p.status,0,"Late error must abort unchanged Stage4 DDL");assert.match(p.stderr,/division by zero/i)}
  else assert.equal(p.status,0,"Stage4 ROLLBACK preview failed "+p.stderr);
  assert.equal(sql(definitionDigest),beforeDefinition,"Stage4 rollback must restore all four policies and both CHECKs exactly");
}
console.log("PASS I1D-04: unchanged Stage4 CHECK and four-policy DDL abort/rollback preserve exact preflight definitions");

sqlFile("sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql");
sql("NOTIFY pgrst,'reload schema'");
assert.equal(sql("SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass AND conname='inventory_items_owner_type_chk'"),"0");
assert.equal(sql("SELECT convalidated FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass AND conname='inventory_items_owner_type_check'"),"t");
assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),"4");
for(const [tab,key] of [["items_catalog","item"],["spells_catalog","spell"],["inventory_items","inv"],["character_stock","stock"]]) {
  assert.equal(digest(tab),preserved[key],"Stage4 changed unrelated "+tab+" data");
}
assert.equal(sql("SELECT encode(intent_sha256,'hex') FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+gearNonce+"'"),preserved.nonce);
assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id='"+gearId+"'"),preserved.story);
console.log("PASS I1D-05: full unchanged Stage4 candidate installs atomically in disposable PG17; catalog/stock/item/Story/nonce hashes preserved");

const recovered=succeeded(await create(creator,"I1D-ROLLBACK-STORY",blockedPayload),
  "same previously failed complete nonce/Story/equipment now succeeds");
assert.equal(equipmentFor(recovered),1);
assert.equal(Number(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+recovered+"'")),1);
assert.equal(recordCount("private.player_creation_intent_reservations_v1","request_id='"+blockedNonce+"'"),1);
assert.equal(recordCount("public.character_backstory_secrets","character_id='"+recovered+"'"),1);
const same=succeeded(await create(creator,"I1D-ROLLBACK-STORY",blockedPayload),"identical post-Stage4 replay");
assert.equal(same,recovered);
assert.equal(equipmentFor(recovered),1,"Identical replay must not materialize duplicate equipment");
assert.equal(Number(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+recovered+"'")),1);
denied(await create(creator,"I1D-CHANGED-STORY-REPLAY",blockedPayload),
  "complete Story intent remains enforced after Stage4 hardening","22023");
console.log("PASS I1D-06: same nonce after negative COMMIT rollback creates exactly one character/Story/item/currency and rejects changed Story");

// Plain public v2 must still be executable with its OWN original complete nonce.
const v2Nonce=randomUUID(),v2Intent=gearPayload("I1D unaffected original v2 equipment",v2Nonce);
const v2=succeeded(await rpc(creator.client,"create_player_character_v2",{
  p_payload:v2Intent,p_spell_choices:[]
}),"source-original direct v2 after Stage4");
assert.equal(equipmentFor(v2),1);
assert.equal(Number(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+v2+"'")),1);
assert.equal(succeeded(await rpc(creator.client,"create_player_character_v2",{
  p_payload:v2Intent,p_spell_choices:[]
}),"original v2 repeated"),v2);
assert.equal(equipmentFor(v2),1);
console.log("PASS I1D-07: unchanged public v2 source and original deferred equipment remain idempotent after Stage4");

const originalGear=await creator.client.from("inventory_items")
 .select("id,owner_type,owner_id").eq("owner_id",recovered).eq("owner_type","character").single();
assert.ifError(originalGear.error);
const gearItemId=originalGear.data.id;
const other=await outsider.client.from("inventory_items").select("id").eq("id",gearItemId);
assert.ifError(other.error);assert.deepEqual(other.data,[],"Outsider must not see private character gear");
const forged=await creator.client.from("inventory_items").insert({
  user_id:creator.id,owner_type:"character",owner_id:recovered,
  item_name:"I1D forged character-owned item",card_payload:{}});
assert.ok(forged.error,"Signed creator must not directly insert character-owned inventory");
const launder=await creator.client.from("inventory_items")
 .update({owner_type:"player",owner_id:creator.id}).eq("id",gearItemId).select("id");
assert.ifError(launder.error);assert.deepEqual(launder.data,[]);
const stolenDelete=await creator.client.from("inventory_items").delete().eq("id",gearItemId).select("id");
assert.ifError(stolenDelete.error);assert.deepEqual(stolenDelete.data,[]);
assert.equal(equipmentFor(recovered),1);
console.log("PASS I1D-08: signed creator can read original gear, cannot mint/launder/delete character-owned items; outsider cannot see");

const ownItem=await creator.client.from("inventory_items").insert({
  user_id:creator.id,owner_type:"player",owner_id:creator.id,
  card_payload:{},item_name:"I1D legitimate personal item"}).select("id").single();
assert.ifError(ownItem.error);
const admin=await signedActor();
sql("INSERT INTO private.test_admins(id) VALUES ('"+admin.id+"')");
const adminItem=await admin.client.from("inventory_items").insert({
  user_id:admin.id,owner_type:"character",owner_id:recovered,
  card_payload:{},item_name:"I1D explicit Admin grant"}).select("id").single();
assert.ifError(adminItem.error);
assert.ok(adminItem.data.id);
console.log("PASS I1D-09: authenticated player-owned and authorized Admin character-owned DML preserved");

sql("UPDATE public.character_permissions SET can_edit=false,can_inventory=false WHERE character_id='"+recovered+"' AND user_id='"+creator.id+"'");
const afterRevocation=await creator.client.from("inventory_items").select("id").eq("id",gearItemId);
assert.ifError(afterRevocation.error);assert.deepEqual(afterRevocation.data,[]);
const adminReads=await admin.client.from("inventory_items").select("id").eq("id",gearItemId).single();
assert.ifError(adminReads.error);assert.equal(adminReads.data.id,gearItemId);
denied(await create(creator,"I1D-ROLLBACK-STORY",blockedPayload),
  "revoked editor cannot replay complete nonce after Stage4","42501");
console.log("PASS I1D-10: current revocation hides character-owned gear and blocks nonce replay; Admin retains access");

console.log("I1D RESULT: Stage4 + Story nonce + source-original deferred equipment signed SUBSET accepted. 14 of 31 historical original triggers still unstaged; no full-production parity or release.");



// I1-E original Wizard finalizer and full Savant + Signature source-original
// positive/negative transaction cases. The underlying catalog/view is
// deliberately reduced and only has unique synthetic XPHB Wizard rows.
sqlFile("scripts/fixtures/i1e_wizard_joint_setup_pg17.sql");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.materialize_player_forge_wizard_final_v1()'::regprocedure))"),"3c71ad65cde45d74bef4ea63f25847ac");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.materialize_player_forge_wizard_savant_for_character_v1(uuid)'::regprocedure))"),"49594930f540d308b43ce00461462829");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.materialize_player_forge_wizard_signature_for_character_v1(uuid)'::regprocedure))"),"02395e9d544ef6d5d1e6e5436d080294");
const wizardSpell=id=> "00000000-0000-0000-0000-0000000088"+String(id).padStart(2,"0");
const wizardSchools={
  3:[wizardSpell(11),wizardSpell(12)],
  5:[wizardSpell(13)],
  7:[wizardSpell(14)],
  9:[wizardSpell(15)],
  11:[wizardSpell(16)],
  13:[wizardSpell(17)],
  15:[wizardSpell(18)],
  17:[wizardSpell(19)]
};
const wizardSavant=(level, spellIds)=>({
  sourceFeature:"Evocation Savant",subclassName:"Evoker",level,
  count:spellIds.length,selections:spellIds.map(id=>({spell:{id}}))
});
const wizardGroups=(level)=>{
  const choices={};
  for (const [key,ids] of Object.entries(wizardSchools)) {
    const n=Number(key);
    if (n<=level)choices["wizard-savant-"+key]=wizardSavant(n,ids);
  }
  if(level===20)choices["wizard-signature-spells"]={
    sourceFeature:"Signature Spells",level:20,count:2,placement:"spells",
    selections:[{spell:{id:wizardSpell(13)}},{spell:{id:wizardSpell(14)}}]
  };
  return choices;
};
const wizardIntent=(name,level,nonce,choices)=>({
 name,creation_request_id:nonce,secret:null,
 sheet:{classKey:"wizard",level,subclassName:"Evoker",subclassSource:"XPHB",
   classFeatureChoices:choices}
});
const wizardCount=id=>Number(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+id+"' AND source_type='class-feature' AND coalesce((raw_payload->>'forgeSavant')::boolean,false)"));
const wizardNonceExists=nonce=>Number(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+nonce+"'"));
const wizardProvenance=id=>sql("SELECT subclass_name||'|'||coalesce(subclass_source,'') FROM public.character_progression WHERE character_id='"+id+"'");
const wizardErr=(r,label)=>{
  const e=denied(r,label,"P0001");
  assert.ok(e.message,label+" lacks original source rejection message");
  return e;
};

// Actual signed Forge v3 + private Story + original BEFORE INSERT subclass +
// deferred original Wizard Savant materializer, all under Stage4 inventory RLS.
const savantNonce=randomUUID(),sav3=wizardIntent(
 "I1E legal signed level3 Evocation Savant",3,savantNonce,wizardGroups(3));
const sav3Id=succeeded(await create(creator,"I1E-LV3-CREATOR-STORY",sav3),
  "signed original Wizard level3 Savant creation");
assert.equal(wizardProvenance(sav3Id),"Evoker|XPHB");
assert.equal(wizardCount(sav3Id),2);
assert.equal(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+sav3Id+"' AND coalesce((raw_payload->>'wizardSpellbook')::boolean,false) AND NOT prepared"),"2");
assert.equal(wizardNonceExists(savantNonce),1);
assert.equal(recordCount("public.character_backstory_secrets","character_id='"+sav3Id+"'"),1);
assert.equal(succeeded(await create(creator,"I1E-LV3-CREATOR-STORY",sav3),
  "identical source-valid Wizard Savant replay"),sav3Id);
assert.equal(wizardCount(sav3Id),2);
denied(await create(creator,"I1E-ALTERED-LV3-STORY",sav3),
  "Wizard Savant same-nonce changed Story","22023");
console.log("PASS I1E-01: signed source-valid Evoker level3 materializes TWO legal Savant spellbook records and Story/nonce; retries inert");

// Missing required Savant choice group must cause the ORIGINAL deferred
// trigger to reject and roll back the character/nonce/Story.
const missingNonce=randomUUID(),missingWizard=wizardIntent(
 "I1E missing required Savant",3,missingNonce,{});
wizardErr(await create(creator,"I1E-MISSING-SAVANT",missingWizard),
  "missing original Wizard Savant acquisition choice");
assert.equal(recordCount("public.characters","creation_request_id='"+missingNonce+"'"),0);
assert.equal(wizardNonceExists(missingNonce),0);
console.log("PASS I1E-02: missing Evocation Savant group rejected during deferred COMMIT with character/Story/nonce rollback");

// Selecting the same canonical spell twice, from original source-owned
// choices, must not mint two duplicate bonus spellbook memberships.
const duplicateNonce=randomUUID(),duplicateWizard=wizardIntent(
 "I1E duplicate Savant picks",3,duplicateNonce,{
 "wizard-savant-3":wizardSavant(3,[wizardSpell(11),wizardSpell(11)])});
wizardErr(await create(creator,"I1E-DUPLICATE-SAVANT",duplicateWizard),
  "duplicate Savant spell under same original choice group");
assert.equal(recordCount("public.characters","creation_request_id='"+duplicateNonce+"'"),0);
assert.equal(wizardNonceExists(duplicateNonce),0);
console.log("PASS I1E-03: duplicate source-original Savant spellbook selections rollback complete creation");

// The valid level20 acquisition history has all eight Savant choice groups,
// then the original Signature writer must mark two eligible level3 spellbook
// spells prepared/always-available with one short-rest free use each.
const sigNonce=randomUUID(),sig20=wizardIntent(
 "I1E legal signed level20 Wizard Signature",20,sigNonce,wizardGroups(20));
const sigId=succeeded(await create(creator,"I1E-LV20-CREATOR-STORY",sig20),
 "signed source-original Wizard Signature level20 creation");
assert.equal(wizardProvenance(sigId),"Evoker|XPHB");
assert.equal(wizardCount(sigId),9,"Eight Savant groups must yield nine distinct school spells");
assert.equal(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+sigId+"' AND coalesce((raw_payload->>'signatureSpell')::boolean,false) AND prepared AND always_available AND uses_max=1 AND uses_remaining=1 AND recharge='short_rest'"),"2");
assert.equal(sql("SELECT jsonb_array_length(sheet->'signatureSpells') FROM public.character_sheets WHERE character_id='"+sigId+"'"),"2");
assert.equal(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+sigId+"' AND spell_id IN ('"+wizardSpell(13)+"','"+wizardSpell(14)+"') AND coalesce((raw_payload->>'signatureSpell')::boolean,false)"),"2");
assert.equal(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+sigId+"' AND coalesce((raw_payload->>'wizardSpellbook')::boolean,false)"),"9");
assert.equal(recordCount("public.character_backstory_secrets","character_id='"+sigId+"'"),1);
console.log("PASS I1E-04: real signed level20 original Savant chronology + Signature Spells alter TWO canonical level3 spellbook assignments");

// Level20 without the Signature group: Savant writes nine rows first, but the
// later original Signature function rejects the entire one-transaction create.
const sigMissingNonce=randomUUID(),sigMissingGroups=wizardGroups(20);
delete sigMissingGroups["wizard-signature-spells"];
const sigMissing=wizardIntent(
 "I1E missing Signature at twenty",20,sigMissingNonce,sigMissingGroups);
wizardErr(await create(creator,"I1E-NO-SIGNATURE",sigMissing),
  "missing Signature Spells choice must rollback previously materialized Savant");
assert.equal(recordCount("public.characters","creation_request_id='"+sigMissingNonce+"'"),0);
assert.equal(wizardNonceExists(sigMissingNonce),0);
console.log("PASS I1E-05: missing level20 Signature choice rolls back original Savant writes, character, Story and immutable nonce");

// The same full intent retries inertly even after explicit creator Story edits
// and must not reset the two signature per-rest counters.
const sigBefore=sql("SELECT md5(coalesce(string_agg(md5(to_jsonb(cs)::text),'' ORDER BY cs.id),'')) FROM public.character_spells cs WHERE character_id='"+sigId+"'");
const sigStoryEdit=await creator.client.from("character_backstory_secrets")
 .update({secret_text:"I1E-POSTCREATION-EXPLICIT-EDIT"}).eq("character_id",sigId)
 .select("secret_text").single();
assert.ifError(sigStoryEdit.error);
assert.equal(succeeded(await create(creator,"I1E-LV20-CREATOR-STORY",sig20),
  "stale identical Signature nonce retry"),sigId);
assert.equal(sql("SELECT md5(coalesce(string_agg(md5(to_jsonb(cs)::text),'' ORDER BY cs.id),'')) FROM public.character_spells cs WHERE character_id='"+sigId+"'"),sigBefore);
assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id='"+sigId+"'"),"I1E-POSTCREATION-EXPLICIT-EDIT");
denied(await create(creator,"I1E-CHANGED-LV20-STORY",sig20),
  "changed Story cannot silently replay signed Signature intent","22023");
console.log("PASS I1E-06: signed level20 replay preserves exact spell state and later authorized Story edit; changed intent rejected");

console.log("I1E RESULT: actual source-original Wizard finalizer plus Savant/Signature original functions passed authenticated bounded subset; reduced source catalog/view and other original triggers still release blockers.");


// I1-F exact original Battle Master materializer and paired validator, plus
// source-grounded XPHB option catalog and local normalized instances.
sqlFile("scripts/fixtures/i1f_battle_master_joint_setup_pg17.sql");
const battleNames=[
 "Ambush","Bait and Switch","Commander's Strike","Commanding Presence",
 "Disarming Attack","Distracting Strike","Evasive Footwork",
 "Feinting Attack","Goading Attack","Lunging Attack",
 "Maneuvering Attack","Menacing Attack"
];
const battleChoices=names=>({
 "battle-master-choices":{
   kind:"battle-master-maneuver",subclassName:"Battle Master",
   selections:names.map(name=>({name}))
 }
});
const battleIntent=(name,level,nonce,choices)=>({
  name,creation_request_id:nonce,secret:null,
  sheet:{classKey:"fighter",level,subclassName:"Battle Master",
    subclassSource:"XPHB",classFeatureChoices:choices,
    startingEquipmentSelections:{mode:"package",classOption:"A",ruleset:"vanilla",wealthRoll:5}}
});
const battleGrants=(id)=>Number(sql("SELECT count(*) FROM public.character_class_option_grant_instances WHERE character_id='"+id+"' AND option_type='battle-master-maneuver'"));
const battleNonce=(nonce)=>Number(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+nonce+"'"));
const battleHash=id=>sql("SELECT md5(coalesce(string_agg(md5(to_jsonb(g)::text),'' ORDER BY g.instance_key),'')) FROM public.character_class_option_grant_instances g WHERE character_id='"+id+"'");
const rejectedTransaction=(statement,label,expected)=>{
 const out=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt"],
  {env,input:"BEGIN;\n"+statement+"\nCOMMIT;\n",encoding:"utf8",timeout:30000});
 assert.notEqual(out.status,0,label+" incorrectly committed");
 assert.match(out.stderr,expected,label+" did not raise source-original deferred validation");
 return out.stderr;
};
const bm3nonce=randomUUID();
const bm3payload=battleIntent("I1F signed Battle Master level3",3,bm3nonce,battleChoices(battleNames.slice(0,3)));
const bm3id=succeeded(await create(creator,"I1F-LV3-PRIVATE-STORY",bm3payload),"signed original Battle Master level3");
assert.equal(sql("SELECT subclass_name||'|'||subclass_source FROM public.character_progression WHERE character_id='"+bm3id+"'"),"Battle Master|XPHB");
assert.equal(battleGrants(bm3id),3);
assert.equal(sql("SELECT string_agg(acquired_level::text,',' ORDER BY instance_key) FROM public.character_class_option_grant_instances WHERE character_id='"+bm3id+"'"),"3,3,3");
assert.equal(sql("SELECT count(*) FROM public.character_class_option_grant_instances g JOIN public.class_feature_option_catalog o ON o.id=g.option_catalog_id WHERE g.character_id='"+bm3id+"' AND o.source='XPHB' AND o.option_type='battle-master-maneuver'"),"3");
assert.equal(battleNonce(bm3nonce),1);
assert.equal(recordCount("public.character_backstory_secrets","character_id='"+bm3id+"'"),1);
const bm3hash=battleHash(bm3id);
assert.equal(succeeded(await create(creator,"I1F-LV3-PRIVATE-STORY",bm3payload),"same Battle Master nonce replay"),bm3id);
assert.equal(battleHash(bm3id),bm3hash);
denied(await create(creator,"I1F-LV3-CHANGED-STORY",bm3payload),"Battle Master changed-only Story","22023");
console.log("PASS I1F-01: signed original Fighter/Battle Master level3 creates three distinct canonical XPHB grants, one Story/nonce; identical retry inert");

const missingBMnonce=randomUUID();
const missingBM=battleIntent("I1F insufficient maneuvers",3,missingBMnonce,battleChoices(battleNames.slice(0,2)));
const miss=denied(await create(creator,"I1F-MISSING-GRANT",missingBM),"missing third source Battle Master choice","P0001");
assert.match(miss.message,/requires exactly 3 maneuver choice/i);
assert.equal(recordCount("public.characters","creation_request_id='"+missingBMnonce+"'"),0);
assert.equal(battleNonce(missingBMnonce),0);
console.log("PASS I1F-02: source-original level3 count gate rejects two choices and rolls back character/Story/nonce at deferred COMMIT");

const dupNonce=randomUUID();
const dupPayload=battleIntent("I1F duplicate maneuver",3,dupNonce,battleChoices(["Ambush","Ambush","Disarming Attack"]));
const dup=denied(await create(creator,"I1F-DUPLICATE-GRANT",dupPayload),"duplicate canonical XPHB maneuver","P0001");
assert.match(dup.message,/must be distinct/i);
assert.equal(battleNonce(dupNonce),0);
assert.equal(recordCount("public.characters","creation_request_id='"+dupNonce+"'"),0);
console.log("PASS I1F-03: duplicate original canonical maneuver choice fails and atomically rolls back");

const unknownNonce=randomUUID();
const unknownPayload=battleIntent("I1F unknown maneuver",3,unknownNonce,battleChoices(["Ambush","Disarming Attack","Not an XPHB maneuver"]));
const unknown=denied(await create(creator,"I1F-UNKNOWN-MANEUVER",unknownPayload),"unknown maneuver option","P0001");
assert.match(unknown.message,/unknown maneuver choice/i);
assert.equal(battleNonce(unknownNonce),0);
console.log("PASS I1F-04: unknown/non-catalog Battle Master option is rejected with nonce rollback");

const bm10nonce=randomUUID();
const bm10payload=battleIntent("I1F signed Battle Master level10",10,bm10nonce,battleChoices(battleNames.slice(0,7)));
const bm10id=succeeded(await create(creator,"I1F-LV10-PRIVATE-STORY",bm10payload),"signed original Battle Master level10");
assert.equal(battleGrants(bm10id),7);
assert.equal(sql("SELECT string_agg(acquired_level::text,',' ORDER BY instance_key) FROM public.character_class_option_grant_instances WHERE character_id='"+bm10id+"'"),"3,3,3,7,7,10,10");
assert.equal(sql("SELECT count(DISTINCT option_catalog_id) FROM public.character_class_option_grant_instances WHERE character_id='"+bm10id+"'"),"7");
const bm10hash=battleHash(bm10id);
assert.equal(succeeded(await create(creator,"I1F-LV10-PRIVATE-STORY",bm10payload),"level10 same-intent nonce"),bm10id);
assert.equal(battleHash(bm10id),bm10hash);
console.log("PASS I1F-05: source-original level10 signed progression creates seven distinct grants with exact 3/7/10 acquired-level slots and inert nonce");

// The paired original deferred UPDATE validator must allow a consistent
// progression update and REJECT tampered/removed grant instances, also
// rejecting attempts to change existing Battle Master to another subclass.
sql("BEGIN; UPDATE public.character_progression SET level_choices=level_choices||'{\"i1fVerified\":true}'::jsonb WHERE character_id='"+bm10id+"'; COMMIT;");
assert.equal(sql("SELECT level_choices->>'i1fVerified' FROM public.character_progression WHERE character_id='"+bm10id+"'"),"true");
const beforeValidatorHash=battleHash(bm10id);
rejectedTransaction(
 "DELETE FROM public.character_class_option_grant_instances WHERE character_id='"+bm10id+"' AND instance_key='battle-master-maneuver-slot-7';\n"+
 "UPDATE public.character_progression SET level_choices=level_choices||'{\"i1fTamper\":true}'::jsonb WHERE character_id='"+bm10id+"';",
 "missing maneuver grant in same transaction",/requires 7 normalized maneuver instance/i);
assert.equal(battleGrants(bm10id),7,"missing-grant COMMIT must roll back deletion");
assert.equal(battleHash(bm10id),beforeValidatorHash);
assert.equal(sql("SELECT level_choices ? 'i1fTamper' FROM public.character_progression WHERE character_id='"+bm10id+"'"),"f");
console.log("PASS I1F-06: source-original deferred UPDATE validator accepts consistent progress and rolls back tampered grants at COMMIT");

rejectedTransaction(
 "UPDATE public.character_progression SET subclass_name='Champion',level_choices=level_choices||'{\"i1fSubclassTamper\":true}'::jsonb WHERE character_id='"+bm10id+"';",
 "existing normalized maneuvers under non-Battle-Master subclass",/non-Battle-Master progression cannot retain/i);
assert.equal(sql("SELECT subclass_name FROM public.character_progression WHERE character_id='"+bm10id+"'"),"Battle Master");
assert.equal(battleHash(bm10id),beforeValidatorHash);
console.log("PASS I1F-07: original deferred validator forbids retaining Battle Master grants after subclass change; old source untouched");

// Increasing level requires additional canonical maneuver slots. A test
// progression update without newly acquired grants must fail atomically.
rejectedTransaction(
 "UPDATE public.character_progression SET class_level=15 WHERE character_id='"+bm3id+"';",
 "level15 without nine canonical maneuvers",/requires 9 normalized maneuver instance/i);
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id='"+bm3id+"'"),"3");
assert.equal(battleGrants(bm3id),3);
console.log("PASS I1F-08: original level-gating validator prevents unsupported level-up from retaining too few maneuvers");

const cross=denied(await create(outsider,"I1F-LV3-PRIVATE-STORY",bm3payload),
 "other signed account attempting Battle Master nonce replay","42501");
assert.equal(battleHash(bm3id),bm3hash);
assert.equal(sql("SELECT count(*) FROM public.character_class_option_grant_instances WHERE character_id='"+bm3id+"' AND metadata->>'family'='battle-master-maneuver'"),"3");
assert.equal(sql("SELECT has_table_privilege('authenticated','public.character_class_option_grant_instances','INSERT')"),"f");
console.log("PASS I1F-09: outsider immutable nonce rejected; authenticated cannot directly forge original normalized maneuver grant rows");

// Check that prior Wizard/Signature, Story nonce and Stage4 actor/inventory
// systems remain unchanged after adding Battle Master materializer/validator.
assert.equal(wizardCount(sigId),9);
assert.equal(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+sigId+"' AND coalesce((raw_payload->>'signatureSpell')::boolean,false)"),"2");
assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),"4");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.materialize_player_forge_wizard_final_v1()'::regprocedure))"),"3c71ad65cde45d74bef4ea63f25847ac");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.materialize_player_forge_battle_master_maneuvers_v1()'::regprocedure))"),"daf3fc12e7c30165dca50ca650f9d308");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.validate_existing_battle_master_maneuvers_v1()'::regprocedure))"),"8bc8a467e95b07e93df833bcfc585e80");
console.log("PASS I1F-10: canonical Wizard signature and Stage4 privacy remain intact; both original deferred Battle Master handlers source-hash exact");

console.log("I1F RESULT: signed original Battle Master grant+validator positive/negative/rollback PASS in reduced catalogs, preserving Wizard/Stage4/nonce. NOT full 31/31, no production SQL or main merge.");


// I1-G: original Warlock legacy-shape and normalized UPDATE validator,
// genuine signed Forge creation + privileged *scratch* normalized grant setup.
// Acquisition materializer and full catalog are intentionally OUT OF SCOPE.
sqlFile("scripts/fixtures/i1g_warlock_invocation_joint_setup_pg17.sql");
const wClass="6792abd0-1fd9-44fb-ae4c-56c307ab791a";
const wBlast="47d3fd14-695b-4d54-a3fb-9c210ed59952";
const wPoison="27d42a4f-4fbc-44c2-8f8c-e8d68978ef98";
const wAlert="735de8f5-94b0-4052-a7b2-8ae15ac9a55c";
const wq=x=>"'"+String(x).replaceAll("'","''")+"'";
const wPayload=(name,level,nonce,opts={})=>({
 name,creation_request_id:nonce,secret:null,
 sheet:{classKey:"warlock",level,startingEquipmentSelections:{
 mode:"package",classOption:"A",ruleset:"vanilla"},
 sourceChoices:opts.sourceChoices??{"source-choice":{
 ownerType:"class-option",metadata:{family:"eldritch-invocation"}}},
 ...(opts.classFeatureChoices?{classFeatureChoices:opts.classFeatureChoices}:{})}
});
const wLegacy={"legacy-invocation":{kind:"eldritch-invocation",
  level:1,count:1,selections:[{name:"Pact of the Blade"}]}};
const wCount=id=>Number(sql("SELECT count(*) FROM public.character_class_option_grant_instances WHERE character_id="+wq(id)+" AND option_type='eldritch-invocation'"));
const wHash=id=>sql("SELECT md5(coalesce(string_agg(md5(to_jsonb(g)::text),'' ORDER BY g.instance_key),'')) FROM public.character_class_option_grant_instances g WHERE character_id="+wq(id)+" AND option_type='eldritch-invocation'");
const wNonce=n=>Number(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id="+wq(n)));
const wInsert=(id,slot,name,level,child)=>"INSERT INTO public.character_class_option_grant_instances(character_id,instance_key,option_catalog_id,option_type,acquired_level,choices,metadata) SELECT "+
 [wq(id),wq("eldritch-invocation-slot-"+slot),"o.id",wq("eldritch-invocation"),level,
 wq(JSON.stringify(child?{child:{value:child}}:{}))+"::jsonb",
 wq(JSON.stringify({source:"I1G privileged scratch acquisition specimen"}))+"::jsonb"].join(",")+
 " FROM public.class_feature_option_catalog o WHERE o.name="+wq(name)+" AND o.option_type='eldritch-invocation' AND o.source='XPHB' AND o.class_key='warlock'";
const wChange=(id,slot,name,child)=>"UPDATE public.character_class_option_grant_instances SET option_catalog_id=(SELECT id FROM public.class_feature_option_catalog WHERE name="+wq(name)+" AND option_type='eldritch-invocation' AND source='XPHB' AND class_key='warlock' LIMIT 1),choices="+wq(JSON.stringify(child?{child:{value:child}}:{}))+"::jsonb WHERE character_id="+wq(id)+" AND instance_key="+wq("eldritch-invocation-slot-"+slot);
const wTick=(id,label)=>"UPDATE public.character_progression SET level_choices=level_choices||"+wq(JSON.stringify({i1g:label}))+"::jsonb WHERE character_id="+wq(id);
const wTxn=stmts=>sql("BEGIN;\n"+stmts.join(";\n")+";\nCOMMIT;");
const wReject=(stmts,label,re)=>rejectedTransaction(stmts.join(";\n")+";",label,re);
// The source-original acquisition trigger is not in this subset. Capture
// genuine signed Warlock baselines BEFORE installing the two source-original
// safeguards, then validate grants under the genuine deferred UPDATE trigger.
// Never infer that a new production Warlock can currently be completed.
const w1Nonce=randomUUID(),w1Payload=wPayload("I1G source-owned lvl1 Warlock",1,w1Nonce);
const w1=succeeded(await create(creator,"I1G-LV1-STORY",w1Payload),
 "pre-safeguard signed lvl1 baseline");
const w2Nonce=randomUUID(),w2Payload=wPayload("I1G source-owned lvl2 Warlock",2,w2Nonce);
const w2=succeeded(await create(creator,"I1G-LV2-STORY",w2Payload),
 "pre-safeguard signed lvl2 baseline");
assert.equal(wCount(w1),0);
assert.equal(wCount(w2),0);
sqlFile("scripts/fixtures/i1g_warlock_original_trigger_install_pg17.sql");
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass AND NOT tgisinternal AND tgenabled='O' AND tgname IN ('character_progression_reject_unmarked_legacy_warlock_invocation','character_progression_validate_player_forge_class_options_v2')"),"2");
console.log("PASS I1G-BASELINE: two genuine signed pre-acquisition Warlock baselines; both original deferred safeguards then installed and ENABLED (not a live creation success)");

const wLegacyNonce=randomUUID();
const legacyResult=denied(await create(creator,"I1G-INVALID-LEGACY",
 wPayload("I1G legacy-only Warlock",1,wLegacyNonce,
 {sourceChoices:{},classFeatureChoices:wLegacy})),
 "unmarked legacy invocation", "P0001");
assert.match(legacyResult.message,/source-owned Eldritch Invocation instances/i);
assert.equal(wNonce(wLegacyNonce),0);
assert.equal(recordCount("public.characters","creation_request_id="+wq(wLegacyNonce)),0);
console.log("PASS I1G-01: original legacy-only guard rejects signed new Warlock with full Story/nonce rollback");

assert.equal(sql("SELECT class_id::text FROM public.character_progression WHERE character_id="+wq(w1)),wClass);
assert.equal(wCount(w1),0,"Original acquisition materializer intentionally omitted in signed subset");
wTxn([wInsert(w1,1,"Pact of the Blade",1),wTick(w1,"valid1")]);
assert.equal(wCount(w1),1);
assert.equal(wNonce(w1Nonce),1);
assert.equal(succeeded(await create(creator,"I1G-LV1-STORY",w1Payload),"identical Warlock nonce"),w1);
denied(await create(creator,"I1G-CHANGED-LV1-STORY",w1Payload),"changed Warlock private Story","22023");
console.log("PASS I1G-02: signed pre-safeguard lvl1 baseline + privileged Pact grant pass ORIGINAL installed deferred validator; nonce inert");

wTxn([wInsert(w2,1,"Pact of the Blade",1),wInsert(w2,2,"Armor of Shadows",2),
 wInsert(w2,3,"Devil's Sight",2),wTick(w2,"valid2")]);
assert.equal(wCount(w2),3);
assert.equal(sql("SELECT count(DISTINCT option_catalog_id) FROM public.character_class_option_grant_instances WHERE character_id="+wq(w2)),"3");
const wBase=wHash(w2);
assert.equal(succeeded(await create(creator,"I1G-LV2-STORY",w2Payload),"unchanged lvl2 nonce"),w2);
console.log("PASS I1G-03: signed pre-safeguard lvl2 + 3 canonical XPHB grant specimens pass installed ORIGINAL deferred validator");

wReject(["DELETE FROM public.character_class_option_grant_instances WHERE character_id="+wq(w2)+" AND instance_key='eldritch-invocation-slot-3'",wTick(w2,"missing")],
 "one missing invocation",/requires exactly 3 normalized Invocation instance/i);
assert.equal(wCount(w2),3);assert.equal(wHash(w2),wBase);
console.log("PASS I1G-04: missing source-owned normalized instance causes deferred COMMIT rollback");

wReject([wChange(w2,3,"Armor of Shadows"),wTick(w2,"duplicate")],
 "duplicate nonrepeatable Invocation",/not repeatable/i);
assert.equal(wHash(w2),wBase);
console.log("PASS I1G-05: duplicate nonrepeatable Invocation rejected atomically");

wReject([wChange(w2,3,"Thirsting Blade"),wTick(w2,"level2-illegal")],
 "level5 Invocation at level2",/not legal at Warlock level 2/i);
assert.equal(wHash(w2),wBase);
console.log("PASS I1G-06: original minClassLevel prerequisite enforced by paired validator");

wReject([
 "DELETE FROM public.character_class_option_grant_instances WHERE character_id="+wq(w2),
 wInsert(w2,1,"Armor of Shadows",1),wInsert(w2,2,"Devil's Sight",2),
 wInsert(w2,3,"Eldritch Mind",2),wInsert(w2,4,"Fiendish Vigor",5),
 wInsert(w2,5,"Eldritch Smite",5),
 "UPDATE public.character_progression SET class_level=5,level_choices=level_choices||'{\"i1g\":\"missing-pact\"}'::jsonb WHERE character_id="+wq(w2)],
 "level5 missing Pact of the Blade prerequisite",/requires Pact of the Blade/i);
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id="+wq(w2)),"2");
assert.equal(wHash(w2),wBase);
console.log("PASS I1G-07: original requiresOptions gate aborts 5-grant attempted level-up lacking Pact");

wTxn([wChange(w2,3,"Agonizing Blast",wBlast),wTick(w2,"damageCantrip")]);
const wWithSpell=wHash(w2);
wReject([wChange(w2,3,"Agonizing Blast","not-a-uuid"),wTick(w2,"badUuid")],
 "malformed affected cantrip",/invalid affected cantrip/i);
wReject([wChange(w2,3,"Agonizing Blast","00000000-0000-0000-0000-000000000901"),wTick(w2,"wrongClass")],
 "Wizard-only affected cantrip",/preferred Warlock damage cantrip/i);
assert.equal(wHash(w2),wWithSpell);
console.log("PASS I1G-08: valid source-grounded XPHB damage cantrip passes; malformed and non-Warlock children rollback");

wReject([wChange(w2,2,"Agonizing Blast",wBlast),wTick(w2,"sameChild")],
 "repeated invocation same cantrip",/must use different dependent choices/i);
wTxn([wChange(w2,2,"Agonizing Blast",wPoison),wTick(w2,"differentChild")]);
assert.equal(sql("SELECT count(*) FROM public.character_class_option_grant_instances g JOIN public.class_feature_option_catalog o ON o.id=g.option_catalog_id WHERE g.character_id="+wq(w2)+" AND o.name='Agonizing Blast'"),"2");
const wRepeated=wHash(w2);
console.log("PASS I1G-09: two repeatable invocations require different original Warlock damage-cantrip IDs");

wReject([wChange(w2,1,"Lessons of the First Ones",wAlert),wTick(w2,"unownedOriginFeat")],
 "missing owned Origin feat",/missing its owned Origin feat instance/i);
assert.equal(wHash(w2),wRepeated);
wTxn(["INSERT INTO public.character_option_grant_instances(character_id,acquisition_owner_type,acquisition_owner_key,option_id) VALUES ("+
 wq(w2)+",'class-option','eldritch-invocation-slot-1',"+wq(wAlert)+")",
 wChange(w2,1,"Lessons of the First Ones",wAlert),wTick(w2,"ownedOriginFeat")]);
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id="+wq(w2)+" AND option_id="+wq(wAlert)),"1");
console.log("PASS I1G-10: original Origin feat child requires matching class-option owner and source feat ID");

const beforeLegacySheet=sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+wq(w1));
wReject(["UPDATE public.character_sheets SET sheet=jsonb_set(jsonb_set(sheet,'{sourceChoices}','{}'::jsonb,true),'{classFeatureChoices}',"+
 wq(JSON.stringify(wLegacy))+"::jsonb,true) WHERE character_id="+wq(w1),
 wTick(w1,"unmarkedLegacy")],
 "retroactive unmarked legacy choice",/source-owned Eldritch Invocation instances/i);
assert.equal(sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+wq(w1)),beforeLegacySheet);
wTxn(["INSERT INTO private.player_forge_source_choice_legacy_v1(character_id) VALUES ("+wq(w1)+")",
 "UPDATE public.character_sheets SET sheet=jsonb_set(jsonb_set(sheet,'{sourceChoices}','{}'::jsonb,true),'{classFeatureChoices}',"+
 wq(JSON.stringify(wLegacy))+"::jsonb,true) WHERE character_id="+wq(w1),
 wTick(w1,"serverMarkedLegacy")]);
assert.equal(sql("SELECT count(*) FROM private.player_forge_source_choice_legacy_v1 WHERE character_id="+wq(w1)),"1");
console.log("PASS I1G-11: legacy exception only accepts server-marked preexisting source-owned character");

const w1Hash=wHash(w1);
wReject(["UPDATE public.character_progression SET class_id='00000000-0000-0000-0000-000000000001',level_choices=level_choices||'{\"i1g\":\"fighter\"}'::jsonb WHERE character_id="+wq(w1)],
 "class switch retains Invocation grants",/non-Warlock progression cannot retain/i);
assert.equal(sql("SELECT class_id::text FROM public.character_progression WHERE character_id="+wq(w1)),wClass);
assert.equal(wHash(w1),w1Hash);
console.log("PASS I1G-12: original validator rejects laundering Warlock grants through class switch");

denied(await create(outsider,"I1G-LV2-STORY",w2Payload),
 "outsider Warlock nonce replay","42501");
assert.equal(sql("SELECT has_table_privilege('authenticated','public.character_class_option_grant_instances','INSERT')"),"f");
assert.equal(sql("SELECT has_table_privilege('authenticated','private.player_forge_source_choice_legacy_v1','INSERT')"),"f");
assert.equal(wizardCount(sigId),9);assert.equal(battleGrants(bm10id),7);
assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),"4");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.reject_unmarked_legacy_warlock_invocations_v1()'::regprocedure))"),"631fbb585f47e71a619ca8ac8e212407");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.validate_existing_normalized_warlock_invocations_v2()'::regprocedure))"),"4f1752db655b6ba490113f604c7583ef");
console.log("PASS I1G-13: cross-user/forged grant privileges denied; Wizard/Battle Master/Stage4 and original hashes remain intact");
// Required negative release gate: after both original safeguards are installed,
// signed NEW Warlock creation cannot pass without source-owned acquisition.
// The original sheet-sync fires the UPDATE validator before COMMIT. Do NOT
// weaken the original source function or pretend this is production accepted.
const freshNonce=randomUUID(),freshPayload=wPayload(
 "I1G missing acquisition materializer after safeguards",1,freshNonce);
const freshDenied=denied(await create(creator,"I1G-ACQUISITION-MISSING",freshPayload),
 "new signed Warlock without original invocation acquisition","P0001");
assert.match(freshDenied.message,/requires exactly 1 normalized Invocation instance/i);
assert.equal(wNonce(freshNonce),0);
assert.equal(recordCount("public.characters","creation_request_id="+wq(freshNonce)),0);
console.log("PASS I1G-14 RED GATE: source-owning acquisition trigger ABSENT; new signed Warlock after original guards fails closed and rolls back whole Forge/Story/nonce");
console.log("I1G RESULT: original Warlock guard+UPDATE validator negative/positive signed-source tests; NEW Warlock complete acquisition intentionally FAILS. Full original materializer and 31-trigger combined release remain OPEN.");

// I1-H is an additional, isolated follow-on, never enabled for old I1-G CI.
// All original handler bodies and the preceding I1C-I1G acceptance stay intact.
if(env.DNDNEXT_I1H_LOCAL_CONFIRM==="DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"){
  sqlFile("scripts/fixtures/i1h_warlock_acquisition_with_guards_pg17.sql");
  const i1hSourceGroup=(slot,name,childId=null)=>{
    const option=({
      "Pact of the Blade":"optional-feature:pact-of-the-blade|XPHB",
      "Armor of Shadows":"optional-feature:armor-of-shadows|XPHB",
      "Eldritch Mind":"optional-feature:eldritch-mind|XPHB",
      "Agonizing Blast":"optional-feature:agonizing-blast|XPHB",
      "Devil's Sight":"optional-feature:devils-sight|XPHB",
      "Thirsting Blade":"optional-feature:thirsting-blade|XPHB"
    })[name];
    assert.ok(option,"No fabricated source catalog option for "+name);
    const level=slot===1?1:2;
    const group={
      placement:"class",ownerType:"class-option",ownerKey:"warlock",
      label:"Eldritch Invocation",level,
      metadata:{family:"eldritch-invocation",slot,acquisitionLevel:level},
      fields:{invocation:{kind:"option",selections:[{key:option,name,source:"XPHB"}]}}
    };
    if(childId!==null){
      group.fields["child-agonizing-blast"]={
        kind:"spell",count:1,required:true,
        activeWhen:{groupId:"warlock-invocation-slot-"+slot,fieldId:"invocation",values:[option]},
        selections:[{key:childId,value:childId,name:"Eldritch Blast",source:"XPHB"}]
      };
    }
    return group;
  };
  const i1hChoices=(entries)=>Object.fromEntries(entries.map(([slot,name,child])=>
    ["warlock-invocation-slot-"+slot,i1hSourceGroup(slot,name,child??null)]));
  const i1hPayload=(name,level,nonce,entries)=>wPayload(name,level,nonce,{sourceChoices:i1hChoices(entries)});
  const i1hSnap=()=>sql("SELECT jsonb_build_object("+
    "'characters',(SELECT count(*) FROM public.characters),"+
    "'sheets',(SELECT count(*) FROM public.character_sheets),"+
    "'progression',(SELECT count(*) FROM public.character_progression),"+
    "'grants',(SELECT count(*) FROM public.character_class_option_grant_instances),"+
    "'stories',(SELECT count(*) FROM public.character_backstory_secrets),"+
    "'nonces',(SELECT count(*) FROM private.player_creation_intent_reservations_v1),"+
    "'inventory',(SELECT count(*) FROM public.inventory_items),"+
    "'currency',(SELECT count(*) FROM public.character_currency))::text");
  const i1hCheck=(id,expected,story)=>{
    assert.equal(wCount(id),expected,"Original trigger must write ALL normalized grants at first COMMIT");
    assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id="+wq(id)),story);
    assert.equal(sql("SELECT count(*) FROM public.character_progression WHERE character_id="+wq(id)), "1");
    assert.equal(sql("SELECT count(*) FROM public.character_sheets WHERE character_id="+wq(id)), "1");
  };
  const i1hOneNonce=randomUUID(),i1hOneStory="I1H-LEVEL1-PRIVATE-STORY";
  const i1hOnePayload=i1hPayload("I1H signed Warlock one-slot",1,i1hOneNonce,[[1,"Pact of the Blade"]]);
  const i1hOne=succeeded(await create(creator,i1hOneStory,i1hOnePayload),
    "original source-first level1 signed Warlock creation");
  i1hCheck(i1hOne,1,i1hOneStory);
  assert.equal(sql("SELECT acquired_level FROM public.character_class_option_grant_instances WHERE character_id="+wq(i1hOne)), "1");
  assert.equal(sql("SELECT option_catalog_id::text FROM public.character_class_option_grant_instances WHERE character_id="+wq(i1hOne)), "7776f12d-eef4-47c6-a996-c1ddf45c5071");
  assert.equal(wNonce(i1hOneNonce),1);
  const i1hOneHash=wHash(i1hOne),i1hSameSnap=i1hSnap();
  assert.equal(succeeded(await create(creator,i1hOneStory,i1hOnePayload),"level1 same nonce replay"),i1hOne);
  assert.equal(wHash(i1hOne),i1hOneHash);
  assert.equal(i1hSnap(),i1hSameSnap);
  denied(await create(creator,"I1H-CHANGED-PRIVATE-STORY",i1hOnePayload),"changed level1 Story same nonce","22023");
  denied(await create(outsider,i1hOneStory,i1hOnePayload),"cross-account Warlock replay","42501");
  console.log("PASS I1H-01: genuine signed level1 creates one normalized Invocation/character/Story/nonce; unchanged replay inert and changed Story/actor denied");

  const i1hTwoNonce=randomUUID(),i1hTwoStory="I1H-LEVEL2-PRIVATE-STORY";
  const i1hTwoEntries=[[1,"Pact of the Blade"],[2,"Agonizing Blast",wBlast],[3,"Eldritch Mind"]];
  const i1hTwoPayload=i1hPayload("I1H signed Warlock level2 Agonizing",2,i1hTwoNonce,i1hTwoEntries);
  const i1hTwo=succeeded(await create(creator,i1hTwoStory,i1hTwoPayload),
    "original source-first level2 signed Warlock with dependent cantrip");
  i1hCheck(i1hTwo,3,i1hTwoStory);
  assert.equal(sql("SELECT count(*) FROM public.character_class_option_grant_instances WHERE character_id="+wq(i1hTwo)+" AND acquired_level=2"),"2");
  assert.equal(sql("SELECT choices#>>'{child,value}' FROM public.character_class_option_grant_instances WHERE character_id="+wq(i1hTwo)+" AND instance_key='warlock-invocation-slot-2'"),wBlast);
  assert.equal(wNonce(i1hTwoNonce),1);
  const i1hTwoHash=wHash(i1hTwo),i1hTwoSnap=i1hSnap();
  assert.equal(succeeded(await create(creator,i1hTwoStory,i1hTwoPayload),"level2 same nonce"),i1hTwo);
  assert.equal(wHash(i1hTwo),i1hTwoHash); assert.equal(i1hSnap(),i1hTwoSnap);
  console.log("PASS I1H-02: genuine signed Warlock2 first-COMMIT original 3 Invocation grants, Agonizing Blast source cantrip, Story/nonce, inert replay");

  const i1hReject=async(label,entries,level=2)=>{
    const n=randomUUID(),before=i1hSnap();
    const attempted=i1hPayload("I1H rejected "+label,level,n,entries);
    const response=await create(creator,"I1H-REJECT-STORY-"+label,attempted);
    assert.ok(response.error,"Invalid "+label+" unexpectedly committed");
    assert.equal(wNonce(n),0,"Failed "+label+" retained immutable nonce");
    assert.equal(recordCount("public.characters","creation_request_id="+wq(n)),0,"Failed "+label+" left a character");
    assert.equal(i1hSnap(),before,"Failed "+label+" mutated canonical global tables");
    return response.error.message;
  };
  const missingChild=await i1hReject("missing-Agonizing-child",[[1,"Pact of the Blade"],[2,"Agonizing Blast"],[3,"Eldritch Mind"]]);
  assert.match(missingChild,/dependent source choice|dependent selection group/i);
  console.log("PASS I1H-03: required child absence fails with total Story/nonce/grant/stock rollback");

  const invalidLevel=await i1hReject("wrong-acquisition-level",[[1,"Thirsting Blade"]],1);
  assert.match(invalidLevel,/not available at the acquisition level|not legal at Warlock level/i);
  console.log("PASS I1H-04: illegal class-level Invocation rolls back the entire original creation");

  const repeat=await i1hReject("duplicate-nonrepeatable",[[1,"Pact of the Blade"],[2,"Pact of the Blade"],[3,"Eldritch Mind"]]);
  assert.match(repeat,/not repeatable/i);
  console.log("PASS I1H-05: duplicate nonrepeatable Invocation rolls back source grants and nonce");

  const illegalChild=await i1hReject("wrong-cantrip",[[1,"Pact of the Blade"],[2,"Agonizing Blast","00000000-0000-0000-0000-000000000901"],[3,"Eldritch Mind"]]);
  assert.match(illegalChild,/preferred Warlock damage cantrip|valid cantrip id/i);
  console.log("PASS I1H-06: unqualified dependent cantrip rejected without character/Story/grant residue");

  const badShapeNonce=randomUUID(),badShapeSnap=i1hSnap();
  const badLegacy=wPayload("I1H disallowed legacy new creation",1,badShapeNonce,
    {sourceChoices:{},classFeatureChoices:wLegacy});
  const legacyDenied=denied(await create(creator,"I1H-DENIED-LEGACY",badLegacy),
    "fresh unmarked legacy after acquisition installed","P0001");
  assert.match(legacyDenied.message,/source-owned Eldritch Invocation instances/i);
  assert.equal(wNonce(badShapeNonce),0);assert.equal(i1hSnap(),badShapeSnap);
  console.log("PASS I1H-07: original legacy guard still denies unmarked new Warlock before any write persists");

  assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass AND NOT tgisinternal AND tgenabled='O' AND tgname IN ('character_progression_validate_player_forge_class_options_v1','character_progression_reject_unmarked_legacy_warlock_invocation','character_progression_validate_player_forge_class_options_v2')"),"3");
  assert.equal(sql("SELECT md5(pg_get_functiondef('private.validate_and_materialize_player_forge_class_options_v1()'::regprocedure))"),"6df5aee6f0519c9c77758d6e887ed8e4");
  assert.equal(wizardCount(sigId),9);assert.equal(battleGrants(bm10id),7);
  assert.equal(wHash(i1hOne),i1hOneHash);assert.equal(wHash(i1hTwo),i1hTwoHash);
  assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),"4");
  console.log("PASS I1H-08: all three source-original Warlock triggers enabled; prior I1C-I1G Wizard/Battle Master/Story/Stage4 authority persists");
  console.log("I1H RESULT: signed original FIRST-creation Invocation acquisition plus two original deferred safeguards in reduced local PG17 catalogs; NOT full 31-trigger or production acceptance.");

  // I1-I: add one genuinely missing original NON-WORLD-MAP trigger to the
  // already verified I1-C..H joint real JWT/PostgREST/PG17 research suite.
  // The five private Eladrin functions are exact live pg_get_functiondef
  // captures; no source alteration, hosted migration or production writes.
  if(env.DNDNEXT_I1I_LOCAL_CONFIRM==="DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"){
    sqlFile("scripts/fixtures/i1i_eladrin_original_materializer_pg17.sql");
    const seasonGroup=(keys)=>({
      placement:"species",ownerType:"species-runtime",ownerKey:"eladrin-season",
      label:"Seasonal Fey Step",source:"MPMM",level:1,
      metadata:{family:"eladrin-season",cadence:"long-rest",runtimeInitial:true},
      fields:{season:{kind:"season",count:1,required:true,
        selections:keys.map(key=>({key,value:key,name:key,source:"MPMM"}))}}
    });
    const seasonPayload=(name,nonce,choices,opts={})=>{
      const payload=gearPayload(name,nonce);
      payload.sheet.species=opts.species??"Eladrin";
      payload.sheet.meta={speciesSource:opts.speciesSource??"MPMM"};
      payload.sheet.sourceChoices=choices===null?{}:
        {"species-runtime-eladrin-season":seasonGroup(choices)};
      if(opts.warlock){
        payload.sheet.classKey="warlock";
        payload.sheet.sourceChoices["warlock-invocation-slot-1"]=
          i1hSourceGroup(1,"Pact of the Blade");
      }
      return payload;
    };
    const seasonFor=id=>sql("SELECT state->'season'->>'key' FROM public.character_runtime_feature_choices WHERE character_id="+wq(id)+" AND feature_key='eladrin-season'");
    const seasonCount=id=>Number(sql("SELECT count(*) FROM public.character_runtime_feature_choices WHERE character_id="+wq(id)+" AND feature_key='eladrin-season'"));
    const seasonProjection=id=>sql("SELECT sheet#>>'{runtimeFeatures,eladrinSeason,season,key}' FROM public.character_sheets WHERE character_id="+wq(id));
    const runtimeTotal=()=>Number(sql("SELECT count(*) FROM public.character_runtime_feature_choices"));
    const i1iSnapshot=()=>i1hSnap()+"|runtime="+runtimeTotal();
    const seasonGuard=id=>{
      assert.equal(seasonCount(id),1);
      assert.equal(sql("SELECT source FROM public.character_runtime_feature_choices WHERE character_id="+wq(id)+" AND feature_key='eladrin-season'"),"MPMM");
      assert.equal(sql("SELECT cadence FROM public.character_runtime_feature_choices WHERE character_id="+wq(id)+" AND feature_key='eladrin-season'"),"long_rest");
      assert.equal(sql("SELECT state->>'configured' FROM public.character_runtime_feature_choices WHERE character_id="+wq(id)+" AND feature_key='eladrin-season'"),"true");
      assert.equal(sql("SELECT state->>'initial' FROM public.character_runtime_feature_choices WHERE character_id="+wq(id)+" AND feature_key='eladrin-season'"),"true");
    };
    const winterNonce=randomUUID(),winterStory="I1I-ELADRIN-WINTER-PRIVATE-STORY";
    const winterPayload=seasonPayload("I1I signed Eladrin winter Fighter",winterNonce,["winter"]);
    const winterId=succeeded(await create(creator,winterStory,winterPayload),
      "signed original Eladrin winter season first-creation commit");
    seasonGuard(winterId);
    assert.equal(seasonFor(winterId),"winter");
    assert.equal(seasonProjection(winterId),"winter","Original projection helper must write sheet runtimeFeatures");
    assert.equal(wNonce(winterNonce),1);
    assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id="+wq(winterId)),winterStory);
    assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id="+wq(winterId)),"1");
    console.log("PASS I1I-01: genuine signed MPMM Eladrin winter materializes original runtime row+sheet projection with Forge, private Story, inventory/currency and nonce");

    const winterState=sql("SELECT md5(to_jsonb(r)::text) FROM public.character_runtime_feature_choices r WHERE character_id="+wq(winterId));
    const winterGlobal=i1iSnapshot();
    assert.equal(succeeded(await create(creator,winterStory,winterPayload),"unchanged Eladrin nonce"),winterId);
    assert.equal(sql("SELECT md5(to_jsonb(r)::text) FROM public.character_runtime_feature_choices r WHERE character_id="+wq(winterId)),winterState);
    assert.equal(i1iSnapshot(),winterGlobal);
    denied(await create(creator,"I1I-WINTER-CHANGED-STORY",winterPayload),"changed private Eladrin Story same nonce","22023");
    denied(await create(outsider,winterStory,winterPayload),"outsider Eladrin nonce replay","42501");
    console.log("PASS I1I-02: identical nonce preserves original Eladrin season state/clock, changed private Story and cross-account replay denied");

    const autumnNonce=randomUUID(),autumnStory="I1I-ELADRIN-AUTUMN-WARLOCK-STORY";
    const autumnPayload=seasonPayload("I1I signed Eladrin autumn Warlock",autumnNonce,["autumn"],{warlock:true});
    const autumnId=succeeded(await create(creator,autumnStory,autumnPayload),
      "same signed creation must run BOTH original Eladrin and Warlock materializers");
    seasonGuard(autumnId);
    assert.equal(seasonFor(autumnId),"autumn");
    assert.equal(seasonProjection(autumnId),"autumn");
    assert.equal(wCount(autumnId),1,"Original Warlock Invocation must coexist with Eladrin runtime projection");
    assert.equal(wNonce(autumnNonce),1);
    assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id="+wq(autumnId)),autumnStory);
    assert.equal(succeeded(await create(creator,autumnStory,autumnPayload),"Eladrin Warlock exact replay"),autumnId);
    console.log("PASS I1I-03: one signed Eladrin Warlock COMMIT composes original seasonal and Invocation materializers with Story/nonce, both projections intact");

    const i1iReject=async(label,seasonSelections)=>{
      const nonce=randomUUID(),before=i1iSnapshot();
      const attempt=seasonPayload("I1I rejected "+label,nonce,seasonSelections);
      const response=await create(creator,"I1I-REJECT-STORY-"+label,attempt);
      assert.ok(response.error,label+" unexpectedly committed");
      assert.equal(wNonce(nonce),0);
      assert.equal(recordCount("public.characters","creation_request_id="+wq(nonce)),0);
      assert.equal(i1iSnapshot(),before,label+" left canonical character/Story/inventory/nonce/runtime residue");
      assert.equal(seasonFor(winterId),"winter");
      return response.error.message;
    };
    const missing=await i1iReject("missing-season",null);
    // Exact unmodified original semantics: SQL NULL fails the IF inequality
    // test (three-valued logic), then the original resolver rejects empty key.
    // This is still a full rollback, but has a different source error than [].
    assert.match(missing,/Eladrin Player Forge references an invalid season/i);
    console.log("PASS I1I-04: signed MPMM Eladrin missing season fails at original resolver (NULL path) with atomic rollback");

    const empty=await i1iReject("empty-selection",[]);
    assert.match(empty,/Eladrin requires exactly one current season during Player Forge creation/i);
    console.log("PASS I1I-05: empty Eladrin season group denied by original source");

    const two=await i1iReject("two-seasons",["winter","autumn"]);
    assert.match(two,/Eladrin requires exactly one current season during Player Forge creation/i);
    console.log("PASS I1I-06: two simultaneous starting seasons rejected atomically");

    const invented=await i1iReject("unknown-season",["monsoon"]);
    assert.match(invented,/Eladrin Player Forge references an invalid season/i);
    console.log("PASS I1I-07: invented seasonal key rejected by exact source option resolver, no state leakage");

    const ordinaryNonce=randomUUID();
    const ordinary=seasonPayload("I1I non-Eladrin skip",ordinaryNonce,null,
      {species:"Human",speciesSource:"XPHB"});
    const ordinaryId=succeeded(await create(creator,"I1I-NON-ELADRIN-STORY",ordinary),
      "other species should not receive a fake Eladrin runtime feature");
    assert.equal(seasonCount(ordinaryId),0);
    assert.equal(wNonce(ordinaryNonce),1);
    assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass AND NOT tgisinternal AND tgenabled='O' AND tgname IN ('character_progression_validate_player_forge_class_options_v1','character_progression_reject_unmarked_legacy_warlock_invocation','character_progression_validate_player_forge_class_options_v2','character_progression_materialize_eladrin_season_v1')"),"4");
    assert.equal(sql("SELECT has_table_privilege('authenticated','public.character_runtime_feature_choices','INSERT')"),"f");
    assert.equal(sql("SELECT md5(pg_get_functiondef('private.materialize_player_forge_eladrin_season_v1()'::regprocedure))"),"b866a8dff88bbfe6fb2c4f6d4c102fee");
    assert.equal(wizardCount(sigId),9);
    assert.equal(battleGrants(bm10id),7);
    assert.equal(wCount(i1hOne),1);assert.equal(wCount(i1hTwo),3);
    assert.equal(seasonFor(winterId),"winter");assert.equal(seasonFor(autumnId),"autumn");
    assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),"4");
    console.log("PASS I1I-08: other species never materialize Eladrin season; source trigger hashes, original Warlock/Wizard/Battle Master and Stage4 authorization preserved");
    console.log("I1I RESULT: source-identical Eladrin materializer + four helpers PASS with real signed creation, source-owned Warlock coexistence and four atomic negative cases; reduced local catalogs/RLS, NOT 31/31 production acceptance.");

    // I1-J: one additional, genuinely missing original non-world-map
    // character_progression deferred source materializer and ALL its original
    // function dependencies, exercising preferred skill + mundane tool catalogs.
    if(env.DNDNEXT_I1J_LOCAL_CONFIRM==="DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"){
      sqlFile("scripts/fixtures/i1j_khoravar_original_skill_versatility_pg17.sql");
      const khSkill="skill:acrobatics",khTool="tool:bd914b52-04de-4cf3-a0ca-0200c9930e06";
      const khOptions=JSON.parse(sql("SELECT private.khoravar_skill_versatility_options_v1()::text"));
      assert.deepEqual(khOptions.map(x=>x.key).sort(),
        ["skill:acrobatics","skill:arcana","tool:bd914b52-04de-4cf3-a0ca-0200c9930e06","tool:dbbec469-010d-4915-907e-f5cd220a9f26"].sort(),
        "Original Khoravar resolver must expose actual XPHB-sourced skill and tool keys, no synthetic choice stub");
      assert.equal(khOptions.find(x=>x.key===khSkill)?.metadata?.skillKey,"acrobatics");
      assert.equal(khOptions.find(x=>x.key===khTool)?.metadata?.itemId,"bd914b52-04de-4cf3-a0ca-0200c9930e06");
      assert.equal(sql("SELECT md5(pg_get_functiondef('private.materialize_player_forge_khoravar_skill_versatility_v1()'::regprocedure))"),
        "9d5fec42e2aefdd39d8a34adf1548460");
      console.log("PASS I1J-01: original Khoravar source resolver reconstructs real source-qualified XPHB skill+tool catalog and exact seven private source functions");

      // Local only: a signed actor's existing players mirror, used by the
      // unchanged original projection helper. Not a mutation to hosted users.
      sql("INSERT INTO public.players(id,user_id,name,sheet) VALUES ("+
        wq(randomUUID())+","+wq(creator.id)+",'I1J disposable projection witness','{}'::jsonb) "+
        "ON CONFLICT(user_id) DO NOTHING");
      const khGroup=(keys)=>({
        placement:"training",ownerType:"species-runtime",ownerKey:"khoravar-skill-versatility",
        label:"Skill Versatility",source:"EFA",level:1,
        metadata:{family:"khoravar-skill-versatility",cadence:"long-rest",runtimeInitial:true},
        fields:{proficiency:{kind:"proficiency",count:1,required:true,
          selections:keys.map(key=>{
            const x=khOptions.find(o=>o.key===key);
            return {key,value:key,name:x?.name??key,source:x?.source??"EFA"};
          })}}
      });
      const khPayload=(name,nonce,choices,opts={})=>{
        const payload=gearPayload(name,nonce);
        payload.sheet.species=opts.species??"Khoravar";
        payload.sheet.meta={speciesSource:opts.speciesSource??"EFA"};
        payload.sheet.sourceChoices=choices===null?{}:
          {"species-runtime-khoravar-skill-versatility":khGroup(choices)};
        if(opts.warlock){
          payload.sheet.classKey="warlock";
          payload.sheet.sourceChoices["warlock-invocation-slot-1"]=i1hSourceGroup(1,"Pact of the Blade");
        }
        return payload;
      };
      const khRowCount=id=>Number(sql("SELECT count(*) FROM public.character_runtime_feature_choices WHERE character_id="+wq(id)+" AND feature_key='khoravar-skill-versatility'"));
      const khRuntimeKey=id=>sql("SELECT state->'proficiency'->>'key' FROM public.character_runtime_feature_choices WHERE character_id="+wq(id)+" AND feature_key='khoravar-skill-versatility'");
      const khSheetKey=id=>sql("SELECT sheet#>>'{runtimeProficiencies,khoravarSkillVersatility,proficiency,key}' FROM public.character_sheets WHERE character_id="+wq(id));
      const khPlayersKey=()=>sql("SELECT sheet#>>'{runtimeProficiencies,khoravarSkillVersatility,proficiency,key}' FROM public.players WHERE user_id="+wq(creator.id));
      const khGlobal=()=>i1iSnapshot()+"|player="+sql("SELECT md5(sheet::text) FROM public.players WHERE user_id="+wq(creator.id));
      const khCheck=(id,key)=>{
        assert.equal(khRowCount(id),1,"Original Khoravar deferred trigger must materialize exactly one runtime row");
        assert.equal(khRuntimeKey(id),key);
        assert.equal(khSheetKey(id),key,"Original species runtime projection missing canonical sheet");
        assert.equal(khPlayersKey(),key,"Original species projection must mirror to real players row");
        assert.equal(sql("SELECT source FROM public.character_runtime_feature_choices WHERE character_id="+wq(id)+" AND feature_key='khoravar-skill-versatility'"),"EFA");
        assert.equal(sql("SELECT cadence FROM public.character_runtime_feature_choices WHERE character_id="+wq(id)+" AND feature_key='khoravar-skill-versatility'"),"long_rest");
      };
      const khSkillNonce=randomUUID(),khSkillStory="I1J-SKILL-PRIVATE-STORY";
      const khSkillPayload=khPayload("I1J Khoravar Acrobatics signed",khSkillNonce,[khSkill]);
      const khSkillId=succeeded(await create(creator,khSkillStory,khSkillPayload),
        "original Khoravar skill choice from signed creation");
      khCheck(khSkillId,khSkill);
      assert.equal(wNonce(khSkillNonce),1);
      assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id="+wq(khSkillId)),khSkillStory);
      const khSkillFingerprint=sql("SELECT md5(to_jsonb(r)::text) FROM public.character_runtime_feature_choices r WHERE character_id="+wq(khSkillId));
      const khReplayBefore=khGlobal();
      assert.equal(succeeded(await create(creator,khSkillStory,khSkillPayload),"same Khoravar skill nonce"),khSkillId);
      assert.equal(khGlobal(),khReplayBefore);
      assert.equal(sql("SELECT md5(to_jsonb(r)::text) FROM public.character_runtime_feature_choices r WHERE character_id="+wq(khSkillId)),khSkillFingerprint);
      denied(await create(creator,"I1J-MODIFIED-STORY",khSkillPayload),"Khoravar changed Story same nonce","22023");
      denied(await create(outsider,khSkillStory,khSkillPayload),"Khoravar cross-account replay","42501");
      console.log("PASS I1J-02: genuine signed EFA Khoravar Acrobatics first-COMMIT state+sheet+players projection with private Story/nonce, inert replay and actor/Story denial");

      const khToolNonce=randomUUID(),khToolStory="I1J-TOOL-PRIVATE-STORY";
      const khToolPayload=khPayload("I1J Khoravar source tool signed",khToolNonce,[khTool]);
      const khToolId=succeeded(await create(creator,khToolStory,khToolPayload),
        "original source-owned Khoravar mundane tool first creation");
      khCheck(khToolId,khTool);
      assert.equal(wNonce(khToolNonce),1);
      assert.equal(sql("SELECT state#>>'{proficiency,metadata,itemKey}' FROM public.character_runtime_feature_choices WHERE character_id="+wq(khToolId)),"Alchemist's Supplies|XPHB");
      assert.equal(khRuntimeKey(khSkillId),khSkill,"Later owner's tool choice must not mutate earlier Khoravar character");
      console.log("PASS I1J-03: real XPHB Alchemist's Supplies tool selection resolves source item ID and materializes independently");

      const khWarlockNonce=randomUUID(),khWarlockStory="I1J-WARLOCK-PRIVATE-STORY";
      const khWarlockPayload=khPayload("I1J Khoravar Warlock Pact tool",khWarlockNonce,[khTool],{warlock:true});
      const khWarlockId=succeeded(await create(creator,khWarlockStory,khWarlockPayload),
        "original Khoravar proficiency and Warlock Invocation on single signed commit");
      khCheck(khWarlockId,khTool);
      assert.equal(wCount(khWarlockId),1);
      assert.equal(wNonce(khWarlockNonce),1);
      assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id="+wq(khWarlockId)),khWarlockStory);
      assert.equal(succeeded(await create(creator,khWarlockStory,khWarlockPayload),
        "unchanged signed Khoravar+Warlock nonce"),khWarlockId);
      console.log("PASS I1J-04: same signed Khoravar Warlock first-COMMIT combines two original source materializers, Story+nonce and exact replay");

      const khReject=async(label,choices)=>{
        const nonce=randomUUID(),before=khGlobal();
        const response=await create(creator,"I1J-NEGATIVE-STORY-"+label,
          khPayload("I1J rejected "+label,nonce,choices));
        assert.ok(response.error,"Illegal Khoravar "+label+" unexpectedly committed");
        assert.equal(wNonce(nonce),0,"Invalid Khoravar consumed nonce");
        assert.equal(recordCount("public.characters","creation_request_id="+wq(nonce)),0);
        assert.equal(khGlobal(),before,"Khoravar "+label+" leaked canonical grants, currency, Story, items, runtime row or players projection");
        assert.equal(khRuntimeKey(khSkillId),khSkill);
        assert.equal(khRuntimeKey(khToolId),khTool);
        return response.error.message;
      };
      const missing=await khReject("missing-proficiency",null);
      assert.match(missing,/Khoravar Skill Versatility references an invalid skill or tool\./i);
      console.log("PASS I1J-05: source-original NULL missing-selection route rejects with invalid skill/tool and completely rolls back");

      const empty=await khReject("empty-array",[]);
      assert.match(empty,/Khoravar Skill Versatility requires exactly one skill or tool proficiency\./i);
      console.log("PASS I1J-06: empty Khoravar proficiency selection fails original cardinality guard with complete rollback");

      const double=await khReject("two-proficiencies",[khSkill,khTool]);
      assert.match(double,/Khoravar Skill Versatility requires exactly one skill or tool proficiency\./i);
      console.log("PASS I1J-07: two simultaneous source proficiencies fail original cardinality guard with complete rollback");

      const unknown=await khReject("invented-skill",["skill:astrology"]);
      assert.match(unknown,/Khoravar Skill Versatility references an invalid skill or tool\./i);
      const forgedTool=await khReject("forged-item-id",["tool:00000000-0000-0000-0000-000000000999"]);
      assert.match(forgedTool,/Khoravar Skill Versatility references an invalid skill or tool\./i);
      console.log("PASS I1J-08: invented source skill and forged tool ID rejected by unchanged original catalog resolver without residue");

      const mismatchNonce=randomUUID();
      const mismatch=khPayload("I1J other species no Khoravar",mismatchNonce,null,
        {species:"Human",speciesSource:"XPHB"});
      const mismatchId=succeeded(await create(creator,"I1J-NONKHORAVAR-STORY",mismatch),
        "original Khoravar must not materialize for other species");
      assert.equal(khRowCount(mismatchId),0);
      assert.equal(wNonce(mismatchNonce),1);
      assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass AND NOT tgisinternal AND tgenabled='O' AND tgname IN ('character_progression_validate_player_forge_class_options_v1','character_progression_reject_unmarked_legacy_warlock_invocation','character_progression_validate_player_forge_class_options_v2','character_progression_materialize_eladrin_season_v1','character_progression_materialize_player_forge_khoravar_skill_v')"),"5");
      assert.equal(sql("SELECT has_table_privilege('authenticated','public.character_runtime_feature_choices','INSERT')"),"f");
      assert.equal(wizardCount(sigId),9);assert.equal(battleGrants(bm10id),7);
      assert.equal(wCount(i1hOne),1);assert.equal(wCount(i1hTwo),3);
      assert.equal(seasonFor(winterId),"winter");assert.equal(seasonFor(autumnId),"autumn");
      assert.equal(khRuntimeKey(khSkillId),khSkill);assert.equal(khRuntimeKey(khToolId),khTool);
      assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),"4");
      console.log("PASS I1J-09: non-Khoravar skip, original I1I Eladrin and I1H Warlock+Wizard/Battle Master grants and Stage4 security unchanged");
      console.log("I1J RESULT: source-original Khoravar Skill Versatility and seven private dependency functions pass signed XPHB skill+tool, Warlock coexistence and five negative rollback branches in disposable PG17, NOT 31/31 production acceptance.");

      // I1-K: source-original species replaceable CANTRIP trigger added only
      // AFTER I1-J original standalone proficiency tests. Earlier historical
      // test conditions stay preserved; new creations now require Fey Gift's
      // permanent ability as well as Khoravar Skill Versatility.
      if(env.DNDNEXT_I1K_LOCAL_CONFIRM==="DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"){
        sqlFile("scripts/fixtures/i1k_species_cantrip_original_materializer_pg17.sql");
        const i1kFriends="c667b8ab-a44e-4c23-a8ea-b03f8953fc18";
        const i1kPrest="5f62b543-f6ac-405f-baa8-1f196190ff35";
        const elfGroup=(ability,kind="High Elf")=>({
          ownerType:"species",ownerKey:"elf-elven-lineage",source:"XPHB",
          label:"Elven Lineage",placement:"species",fields:{
            lineage:{kind:"option",selections:[{key:"high-elf",value:kind,label:kind}]},
            "spellcasting-ability":{kind:"ability",
              selections:ability===null?[]:[{key:ability,value:ability,label:ability}]}
          }
        });
        const khFeyGroup=(ability)=>({
          ownerType:"species",ownerKey:"khoravar-fey-gift",source:"EFA",
          label:"Fey Gift",placement:"species",fields:{
            "feature-ability":{kind:"ability",
              selections:ability===null?[]:[{key:ability,value:ability,label:ability}]}
          }
        });
        const elfPayload=(name,nonce,ability,opts={})=>{
          const p=gearPayload(name,nonce);
          p.sheet.species="Elf";p.sheet.meta={speciesSource:"XPHB"};
          p.sheet.sourceChoices={"i1k-source-owned-elven-lineage":elfGroup(ability,opts.lineage??"High Elf")};
          return p;
        };
        const khCantripPayload=(name,nonce,ability,opts={})=>{
          const p=khPayload(name,nonce,[khSkill],{warlock:opts.warlock??false});
          p.sheet.sourceChoices["i1k-source-owned-khoravar-fey-gift"]=khFeyGroup(ability);
          return p;
        };
        const spellCount=(id,key)=>Number(sql("SELECT count(*) FROM public.character_spells WHERE character_id="+wq(id)+
          " AND source_type='species' AND source_key="+wq(key).replace(/'/g,"'")));
        const spellIdFor=(id,key)=>sql("SELECT spell_id::text FROM public.character_spells WHERE character_id="+wq(id)+
          " AND source_type='species' AND source_key="+wq(key).replace(/'/g,"'"));
        const castFor=(id,key)=>sql("SELECT casting_stat FROM public.character_spells WHERE character_id="+wq(id)+
          " AND source_type='species' AND source_key="+wq(key).replace(/'/g,"'"));
        const runtimeSpell=(id,key)=>sql("SELECT state->>'spellId' FROM public.character_runtime_feature_choices WHERE character_id="+wq(id)+
          " AND feature_key="+wq(key).replace(/'/g,"'"));
        const projectedSpell=id=>sql("SELECT sheet#>>'{runtimeFeatures,speciesReplaceableCantrip,spellId}' FROM public.character_sheets WHERE character_id="+wq(id));
        const i1kSnapshot=()=>khGlobal()+"|spells="+sql("SELECT count(*) FROM public.character_spells");
        const i1kVerify=(id,key,spellId,castStat)=>{
          assert.equal(spellCount(id,key),1,"Original deferred source materializer must create exactly one spell assignment");
          assert.equal(spellIdFor(id,key),spellId);
          assert.equal(castFor(id,key),castStat,"Permanent casting ability must survive normalized species grant");
          assert.equal(runtimeSpell(id,key),spellId);
          assert.equal(projectedSpell(id),spellId);
          assert.equal(sql("SELECT source FROM public.character_runtime_feature_choices WHERE character_id="+wq(id)+
            " AND feature_key="+wq(key)),""+(key==="high-elf-lineage-cantrip"?"XPHB":"EFA"));
          assert.equal(sql("SELECT cadence FROM public.character_runtime_feature_choices WHERE character_id="+wq(id)+
            " AND feature_key="+wq(key)),"long_rest");
          assert.equal(sql("SELECT known::text||','||prepared::text||','||always_available::text FROM public.character_spells WHERE character_id="+wq(id)+
            " AND source_type='species' AND source_key="+wq(key)),"true,true,true");
        };
        assert.equal(sql("SELECT count(*) FROM public.spells_catalog_preferred WHERE name IN ('Friends','Prestidigitation') AND level=0 AND source='XPHB'"),"2");
        assert.equal(sql("SELECT md5(pg_get_functiondef('private.materialize_player_forge_species_replaceable_cantrip_v1()'::regprocedure))"),"a09198d8e12df12371647fccd8479489");
        assert.equal(sql("SELECT count(*) FROM jsonb_array_elements(private.species_replaceable_cantrip_options_v1('high-elf-lineage-cantrip')) WHERE value->>'spellId'="+wq(i1kPrest)),"1");
        assert.equal(sql("SELECT count(*) FROM jsonb_array_elements(private.species_replaceable_cantrip_options_v1('khoravar-fey-gift-cantrip')) WHERE value->>'spellId'="+wq(i1kFriends)),"1");
        console.log("PASS I1K-01: all four original source-hashed species cantrip functions, source-fixed XPHB Friends/Prestidigitation and full reduced preferred rowtype installed");

        const elfNonce=randomUUID(),elfStory="I1K-HIGH-ELF-STORY",elfChoice=elfPayload("I1K original High Elf signed",elfNonce,"int");
        const elfId=succeeded(await create(creator,elfStory,elfChoice),"signed High Elf initial Prestidigitation");
        i1kVerify(elfId,"high-elf-lineage-cantrip",i1kPrest,"int");
        assert.equal(wNonce(elfNonce),1);
        assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id="+wq(elfId)),elfStory);
        assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id="+wq(elfId)),"1");
        assert.equal(sql("SELECT count(*) FROM public.character_spells WHERE character_id="+wq(elfId)+
          " AND raw_payload->>'speciesReplaceableCantrip'='true'"),"1");
        console.log("PASS I1K-02: genuine signed XPHB High Elf first-COMMIT receives source-fixed Prestidigitation spell, runtime state, sheet projection and permanent INT casting with Story/nonce");

        const elfRowHash=sql("SELECT md5(to_jsonb(r)::text) FROM public.character_runtime_feature_choices r WHERE character_id="+wq(elfId)+" AND feature_key='high-elf-lineage-cantrip'");
        const elfSpellHash=sql("SELECT md5(to_jsonb(s)::text) FROM public.character_spells s WHERE character_id="+wq(elfId)+" AND source_key='high-elf-lineage-cantrip'");
        const elfBefore=i1kSnapshot();
        assert.equal(succeeded(await create(creator,elfStory,elfChoice),"High Elf same nonce replay"),elfId);
        assert.equal(i1kSnapshot(),elfBefore);
        assert.equal(sql("SELECT md5(to_jsonb(r)::text) FROM public.character_runtime_feature_choices r WHERE character_id="+wq(elfId)+" AND feature_key='high-elf-lineage-cantrip'"),elfRowHash);
        assert.equal(sql("SELECT md5(to_jsonb(s)::text) FROM public.character_spells s WHERE character_id="+wq(elfId)+" AND source_key='high-elf-lineage-cantrip'"),elfSpellHash);
        denied(await create(creator,"I1K-CHANGED-ELF-STORY",elfChoice),"High Elf changed private Story nonce","22023");
        denied(await create(outsider,elfStory,elfChoice),"High Elf outsider nonce","42501");
        console.log("PASS I1K-03: identical High Elf nonce is truly inert for runtime, spell and Story; modified Story and foreign actor denied");

        const khFriendsNonce=randomUUID(),khFriendsStory="I1K-KHORAVAR-FRIENDS-STORY";
        const khFriendsPayload=khCantripPayload("I1K original Khoravar Friends+skill",khFriendsNonce,"cha");
        const khFriendsId=succeeded(await create(creator,khFriendsStory,khFriendsPayload),
          "signed Khoravar source-owned skill and Fey Gift cantrip");
        i1kVerify(khFriendsId,"khoravar-fey-gift-cantrip",i1kFriends,"cha");
        khCheck(khFriendsId,khSkill);
        assert.equal(wNonce(khFriendsNonce),1);
        assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id="+wq(khFriendsId)),khFriendsStory);
        assert.equal(succeeded(await create(creator,khFriendsStory,khFriendsPayload),"Khoravar Friends same nonce"),khFriendsId);
        console.log("PASS I1K-04: signed EFA Khoravar first-COMMIT composes original Friends cantrip with original Skill Versatility + players mirror, Story/nonce");

        const tripleNonce=randomUUID(),tripleStory="I1K-KHORAVAR-WARLOCK-TRIPLE-STORY";
        const triplePayload=khCantripPayload("I1K Khoravar Warlock original triple",tripleNonce,"wis",{warlock:true});
        const tripleId=succeeded(await create(creator,tripleStory,triplePayload),
          "signed original Khoravar species cantrip+skill and Warlock Invocation combined");
        i1kVerify(tripleId,"khoravar-fey-gift-cantrip",i1kFriends,"wis");
        khCheck(tripleId,khSkill);
        assert.equal(wCount(tripleId),1);
        assert.equal(wNonce(tripleNonce),1);
        assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id="+wq(tripleId)),tripleStory);
        assert.equal(succeeded(await create(creator,tripleStory,triplePayload),"Khoravar original triple unchanged nonce"),tripleId);
        console.log("PASS I1K-05: genuine signed Khoravar Warlock single COMMIT runs 3 original cantrip/skill/Invocation materializers with private Story/nonce, unchanged replay");

        const i1kReject=async(label,payload)=>{
          const nonce=payload.creation_request_id,before=i1kSnapshot();
          const result=await create(creator,"I1K-NEGATIVE-STORY-"+label,payload);
          assert.ok(result.error,"Illegal "+label+" unexpectedly committed");
          assert.equal(wNonce(nonce),0,"Failed "+label+" consumed original nonce");
          assert.equal(recordCount("public.characters","creation_request_id="+wq(nonce)),0);
          assert.equal(i1kSnapshot(),before,"Failed "+label+" left character/Story/nonce/grants/gear/spells/runtime/player residue");
          assert.equal(spellCount(elfId,"high-elf-lineage-cantrip"),1);
          assert.equal(spellCount(khFriendsId,"khoravar-fey-gift-cantrip"),1);
          return result.error.message;
        };
        const missingAbility=await i1kReject("missing-high-elf-casting",elfPayload("I1K invalid Elf no stat",randomUUID(),null));
        assert.match(missingAbility,/requires a permanent Intelligence, Wisdom, or Charisma spellcasting-ability choice/i);
        console.log("PASS I1K-06: missing permanent High Elf spellcasting ability rejected by unchanged source trigger, all writes rolled back");

        const badAbility=await i1kReject("wrong-khoravar-ability",khCantripPayload("I1K invalid Fey Gift STR",randomUUID(),"str"));
        assert.match(badAbility,/requires a permanent Intelligence, Wisdom, or Charisma spellcasting-ability choice/i);
        console.log("PASS I1K-07: STR as permanent Fey Gift casting stat rejected, without character/grant/Story/nonce/spell leakage");

        // Negative test the actual source-fixed spell availability, not a
        // fabricated "choose starting spell" field (the original has none).
        const withheldNonce=randomUUID(),withheldPayload=elfPayload("I1K missing source-fixed Prestidigitation",withheldNonce,"cha");
        const savedName=sql("SELECT name FROM public.spells_catalog WHERE id="+wq(i1kPrest));
        assert.equal(savedName,"Prestidigitation");
        let missingSpellError=null;
        sql("UPDATE public.spells_catalog SET name='I1K withheld original cantrip' WHERE id="+wq(i1kPrest));
        try {missingSpellError=await i1kReject("missing-source-fixed-spell",withheldPayload);}
        finally {sql("UPDATE public.spells_catalog SET name='Prestidigitation' WHERE id="+wq(i1kPrest));}
        assert.match(missingSpellError,/Could not resolve the source-fixed initial cantrip Prestidigitation for Elven Lineage/i);
        assert.equal(spellIdFor(elfId,"high-elf-lineage-cantrip"),i1kPrest);
        console.log("PASS I1K-08: source-fixed preferred Prestidigitation unavailable fails closed and rolls back, original catalog row then restored in scratch");

        const woodNonce=randomUUID(),wood=elfPayload("I1K Wood Elf should skip",woodNonce,null,{lineage:"Wood Elf"});
        const woodId=succeeded(await create(creator,"I1K-WOOD-ELF-SKIP",wood),
          "non-High Elf lineage must not receive source fixed spell");
        assert.equal(spellCount(woodId,"high-elf-lineage-cantrip"),0);
        assert.equal(sql("SELECT count(*) FROM public.character_runtime_feature_choices WHERE character_id="+wq(woodId)+" AND feature_key='high-elf-lineage-cantrip'"),"0");
        assert.equal(wNonce(woodNonce),1);
        assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass AND NOT tgisinternal AND tgenabled='O' AND tgname IN ('character_progression_validate_player_forge_class_options_v1','character_progression_reject_unmarked_legacy_warlock_invocation','character_progression_validate_player_forge_class_options_v2','character_progression_materialize_eladrin_season_v1','character_progression_materialize_player_forge_khoravar_skill_v','character_progression_materialize_species_cantrip_v1')"),"6");
        assert.equal(sql("SELECT has_table_privilege('authenticated','public.spells_catalog_preferred','SELECT')"),"f");
        assert.equal(sql("SELECT has_table_privilege('authenticated','public.character_runtime_feature_choices','INSERT')"),"f");
        assert.equal(wizardCount(sigId),9);assert.equal(battleGrants(bm10id),7);
        assert.equal(wCount(i1hOne),1);assert.equal(wCount(i1hTwo),3);
        assert.equal(seasonFor(winterId),"winter");assert.equal(seasonFor(autumnId),"autumn");
        assert.equal(khRuntimeKey(khSkillId),khSkill);assert.equal(khRuntimeKey(khToolId),khTool);
        assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),"4");
        console.log("PASS I1K-09: Wood Elf source-gate skip, 6 original deferred triggers, I1G/H/I/J and Wizard/Battle Master/Stage4 regression parity preserved");
        console.log("I1K RESULT: source-original High Elf/Khoravar replaceable cantrip first-COMMIT and triple original Khoravar Warlock materialization with signed Story/nonce, source-fixed failures and reduced catalog caveat. NOT full 31/31 source trigger, browser or release acceptance.");

        // I1-L: exact-source original Artificer plan materializer and its five
        // source-owned helper dependencies; install only AFTER every I1C-K
        // positive/negative and historical original-source control has passed.
        if(env.DNDNEXT_I1L_LOCAL_CONFIRM==="DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"){
          sqlFile("scripts/fixtures/i1l_artificer_original_plan_materializer_pg17.sql");
          const aClass="46ea4181-2a9c-4f4e-b886-e246b462ed44";
          const plans=[
            {id:"bee85784-f6cd-416d-9c0d-cb9f6fbdadaf",key:"artificer-plan:1-shield|EFA",name:"+1 Shield"},
            {id:"c3e113c1-8f41-4028-9ca5-2f123c321818",key:"artificer-plan:1-wand-of-the-war-mage|EFA",name:"+1 Wand of the War Mage"},
            {id:"f38fac21-028d-4314-a170-f1b171a9ed75",key:"artificer-plan:1-weapon|EFA",name:"+1 Weapon"},
            {id:"cdd0e441-d773-4d01-90a4-c3e3e3e13b76",key:"artificer-plan:1-wraps-of-unarmed-power|EFA",name:"+1 Wraps of Unarmed Power"}
          ];
          const wildcard={id:"f8897bf9-5bb5-4e4f-8280-ad2a2e941112",
            key:"artificer-plan:common-magic-item-that-isn-t-a-potion-a-scroll-or-cursed|EFA",
            name:"Common magic item that isn't a Potion, a Scroll, or cursed"};
          const upperArmor={id:"eda4194f-7d01-44e4-a78c-79f29b7a83e2",key:"artificer-plan:1-armor|EFA",name:"+1 Armor"};
          const prosthetic="8adeb0df-1434-41f3-8702-1e1e3e0b5da7";
          const potion="d0f8d472-b20f-402b-8405-b65a4330d348";
          const artGroup=(slot,opt,item)=>{
            const group={ownerType:"class-option",ownerKey:"artificer",placement:"class",
              source:"EFA",label:"Magic Item Plan",level:2,
              metadata:{family:"artificer-plan",slot},
              fields:{plan:{kind:"option",count:1,required:true,
                selections:[{key:opt.key,value:opt.key,name:opt.name,source:"EFA"}]}}};
            if(item!==undefined){
              group.fields["magic-item-child"]={
                kind:"item",count:1,required:true,metadata:{planOptionKey:opt.key},
                selections:item===null?[]:[{key:item,value:item,name:"source-qualified magic item",source:"XDMG"}]
              };
            }
            return group;
          };
          const artChoices=(arr)=>Object.fromEntries(arr.map(([opt,item],i)=>
            ["artificer-plan-slot-"+(i+1),artGroup(i+1,opt,item)]));
          const artPayload=(name,nonce,slots,level=2,override={})=>{
            const p=gearPayload(name,nonce);
            p.sheet.classKey=override.classKey??"artificer";
            p.sheet.level=level;
            p.sheet.sourceChoices=artChoices(slots);
            return p;
          };
          const artGrants=id=>Number(sql("SELECT count(*) FROM public.character_class_option_grant_instances WHERE character_id="+wq(id)+" AND option_type='artificer-plan'"));
          const artProjection=id=>{
            const raw=sql("SELECT sheet#>'{classFeatureChoices,artificer-magic-item-plans}' FROM public.character_sheets WHERE character_id="+wq(id));
            const meta=sql("SELECT jsonb_build_object("+
              "'sheetExists',count(*)=1,"+
              "'projectionPresent',bool_or(sheet#>'{classFeatureChoices,artificer-magic-item-plans}' IS NOT NULL),"+
              "'classFeatureType',max(jsonb_typeof(sheet->'classFeatureChoices')),"+
              "'planGrantCount',(SELECT count(*) FROM public.character_class_option_grant_instances WHERE character_id="+wq(id)+" AND option_type='artificer-plan'))::text "+
              "FROM public.character_sheets WHERE character_id="+wq(id));
            assert.ok(raw,"I1-L source-original Artificer classFeatureChoices projection not present after first signed COMMIT: "+meta);
            return JSON.parse(raw);
          };
          const artHash=id=>sql("SELECT md5(coalesce(string_agg(md5(to_jsonb(g)::text),'' ORDER BY g.instance_key),'')) FROM public.character_class_option_grant_instances g WHERE character_id="+wq(id)+" AND option_type='artificer-plan'");
          const artGlobal=()=>i1kSnapshot()+"|art-grants="+sql("SELECT count(*) FROM public.character_class_option_grant_instances WHERE option_type='artificer-plan'");
          const artCheck=(id,expected)=>{
            assert.equal(artGrants(id),expected);
            assert.equal(sql("SELECT class_id::text FROM public.character_progression WHERE character_id="+wq(id)),aClass);
            const proj=artProjection(id);
            assert.equal(proj.count,expected);
            assert.equal(proj.normalizedAuthority,true);
            assert.equal(proj.selections.length,expected);
            assert.equal(sql("SELECT count(*) FROM public.character_class_option_grant_instances WHERE character_id="+wq(id)+
              " AND option_type='artificer-plan' AND metadata->>'materializesInventory'='false'"),String(expected));
            assert.equal(sql("SELECT count(*) FROM public.character_class_option_grant_instances WHERE character_id="+wq(id)+
              " AND option_type='artificer-plan' AND acquired_level=2"),String(expected));
          };
          assert.equal(sql("SELECT private.artificer_plan_count_v1(1)"),"0");
          assert.equal(sql("SELECT private.artificer_plan_count_v1(2)"),"4");
          assert.equal(sql("SELECT private.artificer_plan_slot_level_v1(4)"),"2");
          assert.equal(sql("SELECT private.artificer_plan_slot_level_v1(5)"),"6");
          assert.equal(sql("SELECT private.artificer_plan_item_is_eligible_v1("+wq(wildcard.id)+","+wq(prosthetic)+")"),"t");
          assert.equal(sql("SELECT private.artificer_plan_item_is_eligible_v1("+wq(wildcard.id)+","+wq(potion)+")"),"f");
          assert.equal(sql("SELECT md5(pg_get_functiondef('private.materialize_player_forge_artificer_plans_v1()'::regprocedure))"),"67766989a466b82f170b5e00f9154e24");
          console.log("PASS I1L-01: exact original Artificer EFA six-function graph, 4 level2 slots, source fixed/wildcard options and eligible XDMG/noneligible potion");

          // Original-source RED reproduction: grants materialize but the
          // unmodified live projection helper fails to create absent parent.
          // Do NOT call the candidate or privilege-write projection until the
          // actual signed creation + missing projection are both established.
          const redNonce=randomUUID(),redStory="I1L-ORIGINAL-SOURCE-RED-PROJECTION";
          const redPayload=artPayload("I1L original projection defect specimen",redNonce,plans.map(x=>[x]));
          const redId=succeeded(await create(creator,redStory,redPayload),
            "original source must commit four Artificer grants and expose missing projection");
          assert.equal(artGrants(redId),4);
          assert.equal(wNonce(redNonce),1);
          assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id="+wq(redId)),redStory);
          assert.equal(sql("SELECT sheet#>'{classFeatureChoices,artificer-magic-item-plans}' FROM public.character_sheets WHERE character_id="+wq(redId)),"",
            "RED control: original null-unsafe projector must reproduce missing classFeatureChoices in this fresh source fixture");
          assert.equal(sql("SELECT sheet->'classFeatureChoices' IS NULL FROM public.character_sheets WHERE character_id="+wq(redId)),"t");
          assert.equal(sql("SELECT md5(pg_get_functiondef('private.sync_character_artificer_plan_projection_v1(uuid)'::regprocedure))"),"5ebf572db01143e9b523c7dba0d43ad5");
          console.log("PASS I1L-02 SOURCE RED: genuine signed original Artificer writes 4 normalized grants, private Story+nonce but FAILS to project absent classFeatureChoices (unchanged live source null-parent bug)");

          // Research-only GREEN candidate: preserve source-original function
          // verbatim in I1L fixture and change exactly ONE SQL NULL guard in
          // an additional scratch-only candidate file. Never alter hosted DB.
          sqlFile("scripts/fixtures/i1l_artificer_projection_null_parent_candidate_pg17.sql");
          assert.notEqual(sql("SELECT md5(pg_get_functiondef('private.sync_character_artificer_plan_projection_v1(uuid)'::regprocedure))"),"5ebf572db01143e9b523c7dba0d43ad5");
          assert.equal(sql("SELECT md5(pg_get_functiondef('private.materialize_player_forge_artificer_plans_v1()'::regprocedure))"),"67766989a466b82f170b5e00f9154e24");
          assert.equal(sql("SELECT sheet#>'{classFeatureChoices,artificer-magic-item-plans}' FROM public.character_sheets WHERE character_id="+wq(redId)),"",
            "Candidate must not retroactively mutate earlier original-source RED specimen");

          const fixedNonce=randomUUID(),fixedStory="I1L-ARTIFICER-FOUR-FIXED-STORY";
          const fixedPayload=artPayload("I1L source fixed plan Artificer",fixedNonce,plans.map(x=>[x]));
          const fixedId=succeeded(await create(creator,fixedStory,fixedPayload),"Artificer 2 four original fixed EFA plans");
          artCheck(fixedId,4);
          assert.equal(wNonce(fixedNonce),1);
          assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id="+wq(fixedId)),fixedStory);
          assert.equal(sql("SELECT string_agg(o.option_key,',' ORDER BY g.instance_key) FROM public.character_class_option_grant_instances g JOIN public.class_feature_option_catalog o ON o.id=g.option_catalog_id WHERE g.character_id="+wq(fixedId)+" AND g.option_type='artificer-plan'"),
            plans.map(x=>x.key).join(","));
          console.log("PASS I1L-03: genuine signed original EFA Artificer level2 first-COMMIT four canonical fixed plans + normalized sheet/player projection, private Story and nonce");

          const fixedHash=artHash(fixedId),fixedGlobal=artGlobal();
          assert.equal(succeeded(await create(creator,fixedStory,fixedPayload),"same source Artificer 4-plan nonce"),fixedId);
          assert.equal(artHash(fixedId),fixedHash);assert.equal(artGlobal(),fixedGlobal);
          denied(await create(creator,"I1L-ALTERED-STORY",fixedPayload),"Artificer plan same nonce changed Story","22023");
          denied(await create(outsider,fixedStory,fixedPayload),"Artificer plan cross-account replay","42501");
          console.log("PASS I1L-04: original Artificer plans, private Story/nonce, runtime and inventory unchanged on identical replay; altered Story and outsider denied");

          const wildNonce=randomUUID(),wildStory="I1L-ARTIFICER-SOURCE-WILDCARD-STORY";
          const wildSlots=[[plans[0]],[wildcard,prosthetic],[plans[2]],[plans[3]]];
          const wildPayload=artPayload("I1L Artificer source actual XDMG wildcard",wildNonce,wildSlots);
          const wildId=succeeded(await create(creator,wildStory,wildPayload),"Artificer 2 source-qualified Prosthetic Limb wildcard");
          artCheck(wildId,4);
          assert.equal(sql("SELECT choices#>>'{child,key}' FROM public.character_class_option_grant_instances WHERE character_id="+wq(wildId)+" AND instance_key='artificer-plan-2'"),prosthetic);
          assert.equal(sql("SELECT choices#>>'{child,metadata,itemKey}' FROM public.character_class_option_grant_instances WHERE character_id="+wq(wildId)+" AND instance_key='artificer-plan-2'"),"Prosthetic Limb|XDMG");
          assert.equal(artProjection(wildId).selections[1].item.key,prosthetic);
          assert.equal(wNonce(wildNonce),1);
          assert.equal(succeeded(await create(creator,wildStory,wildPayload),"source wildcard nonce unchanged"),wildId);
          console.log("PASS I1L-05: signed EFA wildcard Plan with authentic eligible XDMG Prosthetic Limb canonical child, four grants, normalized projection and inert replay");

          const artReject=async(label,slots,level=2)=>{
            const nonce=randomUUID(),before=artGlobal(),p=artPayload("I1L invalid "+label,nonce,slots,level);
            const response=await create(creator,"I1L-NEGATIVE-STORY-"+label,p);
            assert.ok(response.error,"Invalid original Artificer "+label+" unexpectedly committed");
            assert.equal(wNonce(nonce),0);
            assert.equal(recordCount("public.characters","creation_request_id="+wq(nonce)),0);
            assert.equal(artGlobal(),before,label+" left partial character/Story/nonce/grant/gear/spell/runtime/player writes");
            assert.equal(artHash(fixedId),fixedHash);
            return response.error.message;
          };
          const absent=await artReject("missing-fourth-slot",plans.slice(0,3).map(x=>[x]));
          assert.match(absent,/Player Forge is missing Magic Item Plan slot 4/i);
          console.log("PASS I1L-06: missing required fourth Magic Item Plan slot fails original deferred trigger and rolls back all first-create writes");

          const dupe=await artReject("duplicate-nonrepeatable",[[plans[0]],[plans[0]],[plans[2]],[plans[3]]]);
          assert.match(dupe,/already a learned Magic Item Plan/i);
          console.log("PASS I1L-07: duplicate original nonrepeatable Plan denied atomically, no grants or nonce consumed");

          const tooHigh=await artReject("future-level6-plan",[[upperArmor],[plans[1]],[plans[2]],[plans[3]]]);
          assert.match(tooHigh,/requires Artificer level 6/i);
          console.log("PASS I1L-08: original level6 prerequisite rejects early level2 Forge plan without residue");

          const missingChild=await artReject("wildcard-no-item",[[plans[0]],[wildcard,null],[plans[2]],[plans[3]]]);
          assert.match(missingChild,/requires one concrete magic item/i);
          console.log("PASS I1L-09: wildcard plan without its mandatory concrete magic-item child is denied at original source validator");

          const wrongItem=await artReject("illegal-XDMG-potion",[[plans[0]],[wildcard,potion],[plans[2]],[plans[3]]]);
          assert.match(wrongItem,/selected item is not legal/i);
          console.log("PASS I1L-10: real canonical XDMG potion cannot satisfy non-potion wildcard Magic Item Plan; complete transaction rollback");

          const impostor=await artReject("unknown-source-plan",[[plans[0]],[{key:"artificer-plan:unpublished|EFA",name:"Unpublished Plan"}],[plans[2]],[plans[3]]]);
          assert.match(impostor,/references an unknown plan/i);
          console.log("PASS I1L-11: forged Magic Item Plan key fails source-catalog lookup before grants and nonce survive");

          const unrelatedNonce=randomUUID(),unrelatedPayload=gearPayload("I1L unrelated Fighter no Artificer source",unrelatedNonce);
          const unrelatedId=succeeded(await create(creator,"I1L-UNRELATED-FIGHTER-STORY",unrelatedPayload),
            "original Artificer trigger skips unrelated Fighter");
          assert.equal(artGrants(unrelatedId),0);
          assert.equal(wNonce(unrelatedNonce),1);
          assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass AND NOT tgisinternal AND tgenabled='O' AND tgname IN ('character_progression_validate_player_forge_class_options_v1','character_progression_reject_unmarked_legacy_warlock_invocation','character_progression_validate_player_forge_class_options_v2','character_progression_materialize_eladrin_season_v1','character_progression_materialize_player_forge_khoravar_skill_v','character_progression_materialize_species_cantrip_v1','character_progression_materialize_player_forge_artificer_plans_')"),"7");
          assert.equal(sql("SELECT has_table_privilege('authenticated','public.character_class_option_grant_instances','INSERT')"),"f");
          assert.equal(wizardCount(sigId),9);assert.equal(battleGrants(bm10id),7);
          assert.equal(wCount(i1hOne),1);assert.equal(wCount(i1hTwo),3);
          assert.equal(seasonFor(winterId),"winter");assert.equal(seasonFor(autumnId),"autumn");
          assert.equal(khRuntimeKey(khSkillId),khSkill);assert.equal(khRuntimeKey(khToolId),khTool);
          assert.equal(spellIdFor(elfId,"high-elf-lineage-cantrip"),i1kPrest);
          assert.equal(spellIdFor(khFriendsId,"khoravar-fey-gift-cantrip"),i1kFriends);
          assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),"4");
          console.log("PASS I1L-12: non-Artificer skip, seven original deferred CP triggers, original I1C-K Wizard/Battle Master/Warlock/Eladrin/Khoravar source grants+Stage4 RLS still intact");
          console.log("I1L RESULT: original source first-COMMIT RED (4 Artificer grants, MISSING projection) reproduced under genuine signed GoTrue/PostgREST; isolated one-condition NULL-safe projection candidate GREEN (new fixed/wildcard signed grants and projection, immutable replay and negative rollback) with other five original source function hashes unchanged. Live original remains RED; NOT production-ready or full 31/31.");
        }
      }
    }
  }

}


// A previous editor must NOT continue replaying after loss of current rights.
sql("UPDATE public.character_permissions SET can_edit=false WHERE "+whereId+
  " AND user_id='"+creator.id+"'");
denied(await create(creator,originalStory),"revoked creator nonce replay","42501");
assert.equal(recordCount("public.characters",whereNonce),1);
assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE "+whereId),editedStory);
console.log("PASS I1C-06: replay rechecks current editor permission; no new characters or Story writes");

console.log("I1C RESULT retained: complete Story nonce RED-TO-GREEN; I1D adds exact Stage4/source-original deferred equipment cases; full 31 triggers NOT claimed.");
