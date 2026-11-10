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
const wLegacyNonce=randomUUID();
const legacyResult=denied(await create(creator,"I1G-INVALID-LEGACY",
 wPayload("I1G legacy-only Warlock",1,wLegacyNonce,
 {sourceChoices:{},classFeatureChoices:wLegacy})),
 "unmarked legacy invocation", "P0001");
assert.match(legacyResult.message,/source-owned Eldritch Invocation instances/i);
assert.equal(wNonce(wLegacyNonce),0);
assert.equal(recordCount("public.characters","creation_request_id="+wq(wLegacyNonce)),0);
console.log("PASS I1G-01: original legacy-only guard rejects signed new Warlock with full Story/nonce rollback");

const w1Nonce=randomUUID(),w1Payload=wPayload("I1G source-owned lvl1 Warlock",1,w1Nonce);
const w1=succeeded(await create(creator,"I1G-LV1-STORY",w1Payload),"signed lvl1 Warlock");
assert.equal(sql("SELECT class_id::text FROM public.character_progression WHERE character_id="+wq(w1)),wClass);
assert.equal(wCount(w1),0,"Original acquisition materializer intentionally omitted in signed subset");
wTxn([wInsert(w1,1,"Pact of the Blade",1),wTick(w1,"valid1")]);
assert.equal(wCount(w1),1);
assert.equal(wNonce(w1Nonce),1);
assert.equal(succeeded(await create(creator,"I1G-LV1-STORY",w1Payload),"identical Warlock nonce"),w1);
denied(await create(creator,"I1G-CHANGED-LV1-STORY",w1Payload),"changed Warlock private Story","22023");
console.log("PASS I1G-02: source-marked signed lvl1 identity, privileged Pact grant passes exact deferred validator, nonce replay inert");

const w2Nonce=randomUUID(),w2Payload=wPayload("I1G source-owned lvl2 Warlock",2,w2Nonce);
const w2=succeeded(await create(creator,"I1G-LV2-STORY",w2Payload),"signed Warlock lvl2");
wTxn([wInsert(w2,1,"Pact of the Blade",1),wInsert(w2,2,"Armor of Shadows",2),
 wInsert(w2,3,"Devil's Sight",2),wTick(w2,"valid2")]);
assert.equal(wCount(w2),3);
assert.equal(sql("SELECT count(DISTINCT option_catalog_id) FROM public.character_class_option_grant_instances WHERE character_id="+wq(w2)),"3");
const wBase=wHash(w2);
assert.equal(succeeded(await create(creator,"I1G-LV2-STORY",w2Payload),"unchanged lvl2 nonce"),w2);
console.log("PASS I1G-03: signed lvl2 + 3 canonical XPHB invocation grants pass original deferred normalized validator");

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
wReject(["UPDATE public.character_sheets SET sheet=jsonb_set(sheet,'{classFeatureChoices}',"+
 wq(JSON.stringify(wLegacy))+"::jsonb,true) WHERE character_id="+wq(w1),
 wTick(w1,"unmarkedLegacy")],
 "retroactive unmarked legacy choice",/source-owned Eldritch Invocation instances/i);
assert.equal(sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+wq(w1)),beforeLegacySheet);
wTxn(["INSERT INTO private.player_forge_source_choice_legacy_v1(character_id) VALUES ("+wq(w1)+")",
 "UPDATE public.character_sheets SET sheet=jsonb_set(sheet,'{classFeatureChoices}',"+
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
console.log("I1G RESULT: paired original Warlock guard+UPDATE validator signed-source subset only; acquisition, full source-priority/feat grants and 31-trigger integration remain OPEN.");

// A previous editor must NOT continue replaying after loss of current rights.
sql("UPDATE public.character_permissions SET can_edit=false WHERE "+whereId+
  " AND user_id='"+creator.id+"'");
denied(await create(creator,originalStory),"revoked creator nonce replay","42501");
assert.equal(recordCount("public.characters",whereNonce),1);
assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE "+whereId),editedStory);
console.log("PASS I1C-06: replay rechecks current editor permission; no new characters or Story writes");

console.log("I1C RESULT retained: complete Story nonce RED-TO-GREEN; I1D adds exact Stage4/source-original deferred equipment cases; full 31 triggers NOT claimed.");
