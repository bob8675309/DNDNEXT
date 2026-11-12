#!/usr/bin/env node
// I2-D: original #324 private copied v2 -> v3 + private Story/nonce
// SOURCE RED, then source-reversible Option A no-legacy-write scratch GREEN.
// Entire original I1-B..O and I2-C-01..10 suites must pass first.
// DO NOT run against remotely hosted Supabase.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
const e=process.env;
for(const [key,value] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"55622",
 PGDATABASE:"postgres",PGUSER:"postgres",
 DNDNEXT_I1G_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 DNDNEXT_I2C_LOCAL_CONFIRM:"DISPOSABLE_I2C_OPTION_A_CREATION_ONLY",
 DNDNEXT_I2D_LOCAL_CONFIRM:"DISPOSABLE_I2D_PRIVATE_V3_STORY_ONLY"
}))assert.equal(e[key],value,"I2D unsafe execution environment: "+key);
assert.match(e.DNDNEXT_I1G_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:55621\/?$/);
assert.ok(e.DNDNEXT_I1G_LOCAL_ANON_KEY);
const make=()=>createClient(e.DNDNEXT_I1G_LOCAL_URL,e.DNDNEXT_I1G_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const psql=args=>{
 const z=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",...args],{
  env:e,encoding:"utf8",timeout:40000
 });
 assert.equal(z.status,0,"I2D disposable SQL: "+(z.stderr||"").slice(-2000));
 return z.stdout.trim();
};
const sql=q=>psql(["-qAt","-c",q]);
const fixture=p=>psql(["-q","-f",p]);
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const md5=sig=>sql("SELECT md5(pg_get_functiondef("+q(sig)+"::regprocedure))");
const sheet=w=>sql("SELECT sheet::text FROM public.players WHERE user_id="+q(w.id));
const stamp=w=>sql("SELECT updated_at::text FROM public.players WHERE user_id="+q(w.id));
const profile=w=>sql("SELECT name FROM public.players WHERE user_id="+q(w.id));
const charSheet=id=>sql("SELECT sheet::text FROM public.character_sheets WHERE character_id="+q(id));
const secret=id=>sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id="+q(id));
const count=(table,where)=>{
 assert.ok(["public.characters","public.character_sheets","public.character_level_events",
 "public.character_permissions","public.character_backstory_secrets",
 "private.player_creation_intent_reservations_v1","public.inventory_items"].includes(table));
 return Number(sql("SELECT count(*) FROM "+table+" WHERE "+where));
};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function rpc(w,method,args){
 for(let i=0;i<35;i++){
  const r=await w.client.rpc(method,args);
  if(r.error?.code==="PGRST202"){await wait(200);continue;}
  return r;
 }
 throw Error("PostgREST local schema cache did not expose "+method);
}
const ok=(r,why)=>{assert.ifError(r.error);assert.ok(r.data,why+" missing character");return r.data;};
const denied=(r,code,why)=>{
 assert.ok(r.error,why+" unexpectedly succeeded");
 assert.equal(r.error.code,code,why+" SQLSTATE");
};
async function actor(displayName){
 const client=make(),email="i2d-"+randomUUID()+"@example.invalid";
 const password="I2D-"+randomUUID()+"-X!";
 const signup=await client.auth.signUp({email,password,options:{data:{display_name:displayName}}});
 assert.ifError(signup.error);
 const login=await client.auth.signInWithPassword({email,password});assert.ifError(login.error);
 const claims=await client.auth.getClaims();assert.ifError(claims.error);
 assert.equal(claims.data.claims.sub,login.data.user.id);
 assert.equal(claims.data.claims.role,"authenticated");
 const w={id:login.data.user.id,client,name:displayName};
 assert.equal(sheet(w),"{}","signed original signup must create empty historical sheet");
 assert.equal(profile(w),displayName,"signup profile name");
 assert.equal(sql("SELECT role FROM public.user_profiles WHERE id="+q(w.id)),"player");
 return w;
}
const payload=(name,nonce)=>({
 name,creation_request_id:nonce,secret:null,
 sheet:{classKey:"fighter",level:1,marker:"I2D:"+name,
  startingEquipmentSelections:{mode:"package",classOption:"A",ruleset:"vanilla"}}
});
const storyCreate=(w,p,storyText)=>rpc(w,"create_player_character_with_private_backstory_v1",{
 p_payload:p,p_spell_choices:[],p_magic_selections:[],p_private_backstory:storyText
});
const plainCreate=(w,p)=>rpc(w,"create_player_character_v3",{
 p_payload:p,p_spell_choices:[],p_magic_selections:[]
});
const privateSig="private.create_player_character_v2_source_20261105(jsonb,jsonb)";
const outerSig="public.create_player_character_v3(jsonb,jsonb,jsonb)";
const privV3Sig="private.create_player_character_v3_source_20261105(jsonb,jsonb,jsonb)";
const storySig="public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)";
const intentSig="private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)";
const outerBefore=md5(outerSig),privV3Before=md5(privV3Sig),
 storyBefore=md5(storySig),intentBefore=md5(intentSig),
 privateBefore=md5(privateSig);
assert.equal(privateBefore,"1d06d00eb4b4aa4c125796d761f5e259","exact original private #324 signed source");
assert.equal(outerBefore,"ab48d46376075a79b3f5a5de21fdada6","exact public v3 wrapper");
assert.equal(privV3Before,"798090559c434fbb21c4b27cab21865b","exact private v3 source");
assert.equal(storyBefore,"6e39477f971c9d40c6726c9f4dbc456e","exact public private-Story RPC");
assert.equal(intentBefore,"5fac54802474043d8233cc17a75f4c0f","exact private Story/nonce intent wrapper");
const originalSource=sql("SELECT lower(pg_get_functiondef("+q(privateSig)+"::regprocedure))");
assert.ok(originalSource.includes("on conflict (user_id) do update set sheet = excluded.sheet, updated_at = now() where public.players.sheet = '{}'::jsonb;"),
 "The exact held #324 original private copied v2 must still be installed");
assert.ok(originalSource.includes("private.create_player_character_v2_source_20261105"));
assert.equal(md5("public.sync_user_profile()"),"dd7113eec05655a661309838acce6030");
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='i2c_auth_user_profile_after_insert'"),"1");
console.log("PASS I2D-01: original private v2 copied source guarded UPSERT, signed public v3, private v3, Story/nonce wrappers and original signup source fingerprinted");
console.log("I2D SOURCE ORIGINAL PRIVATE MD5="+privateBefore+", PUBLIC V3="+outerBefore+", PRIVATE V3="+privV3Before+", PUBLIC STORY="+storyBefore+", PRIVATE INTENT="+intentBefore);

// SOURCE RED: The original source guards NONEMPTY legacy rows only.
// A newly signed up user's '{}' legacy sheet is still silently overwritten.
const red=await actor("I2D Original Empty Account");
const redNonce=randomUUID();
const redPayload=payload("I2D original empty RED "+redNonce.slice(0,8),redNonce);
const redOriginalSheet=sheet(red),redOriginalStamp=stamp(red),redProfile=profile(red);
const redId=ok(await storyCreate(red,redPayload,"I2D original private Story remains isolated"),
 "original signed v3+private Story RED");
assert.equal(count("public.characters","id="+q(redId)),1);
assert.equal(JSON.parse(charSheet(redId)).meta.creationRequestId,redNonce);
assert.equal(secret(redId),"I2D original private Story remains isolated");
assert.equal(count("private.player_creation_intent_reservations_v1","request_id="+q(redNonce)),1);
assert.notEqual(sheet(red),redOriginalSheet,"original private v2 source must write empty legacy snapshot");
assert.equal(JSON.parse(sheet(red)).meta.creationRequestId,redNonce);
assert.equal(profile(red),redProfile);
assert.notEqual(stamp(red),redOriginalStamp);
console.log("PASS I2D-02 EXPECTED ORIGINAL PRIVATE-V3/Story RED: signed real v3 Forge with Story and nonce populates pre-existing EMPTY account-wide sheet, despite Option A freeze");

// Original source's WHERE clause protects a POPULATED historical sheet already
// but not the empty account; distinguish the behavior precisely.
const old=await actor("I2D Original Nonempty Account");
const historical={historical:"I2D synthetic archived character without creation marker",version:11};
sql("UPDATE public.players SET sheet="+q(JSON.stringify(historical))+"::jsonb WHERE user_id="+q(old.id));
const oldSheet=sheet(old),oldStamp=stamp(old),oldName=profile(old);
const oldNonce=randomUUID();
const oldId=ok(await storyCreate(old,payload("I2D original populated "+oldNonce.slice(0,8),oldNonce),
 "I2D original populated historical Story"),"original private v2 populated row");
assert.equal(count("public.characters","id="+q(oldId)),1);
assert.equal(sheet(old),oldSheet);
assert.equal(stamp(old),oldStamp);
assert.equal(profile(old),oldName);
assert.equal(secret(oldId),"I2D original populated historical Story");
console.log("PASS I2D-03 ORIGINAL SOURCE CONTROL: nonempty historical snapshots already resist the private v2 WHERE-empty guard, but empty ones do not");

// Only after preserved original negative source specimens stage the scratch
// Option A candidate. Keep v3 and Story wrappers exact and byte-identical.
fixture("scripts/fixtures/i2d_option_a_private_forge_source_scratch_pg17.sql");
const modified=sql("SELECT lower(pg_get_functiondef("+q(privateSig)+"::regprocedure))");
assert.ok(!modified.includes("insert into public.players(user_id, name, sheet"));
assert.ok(!modified.includes("update public.players"));
assert.ok(modified.includes("i2d_option_a_private_forge_legacy_freeze"));
assert.notEqual(md5(privateSig),privateBefore);
for(const [sig,hash] of [[outerSig,outerBefore],[privV3Sig,privV3Before],
 [storySig,storyBefore],[intentSig,intentBefore]]){
 assert.equal(md5(sig),hash,"Original public/private v3/Story/nonce wrapper source must not change: "+sig);
}
assert.equal(md5("public.sync_user_profile()"),"dd7113eec05655a661309838acce6030");
console.log("PASS I2D-04: private copied v2 only identity-row fallback installed in disposable scratch with reverse-source-MD5 proof; original v3/Story/nonce/signup source hashes unchanged");

const green=await actor("I2D Green Empty Profile");
const originalGreen=[sheet(green),stamp(green),profile(green)];
const greenNonce=randomUUID();
const greenPayload=payload("I2D green first "+greenNonce.slice(0,8),greenNonce);
const greenStory="I2D GREEN private Story original confidential";
const greenId=ok(await storyCreate(green,greenPayload,greenStory),"signed Story candidate v3");
assert.equal(count("public.characters","id="+q(greenId)),1);
assert.equal(count("public.character_sheets","character_id="+q(greenId)),1);
assert.equal(JSON.parse(charSheet(greenId)).meta.creationRequestId,greenNonce);
assert.equal(count("private.player_creation_intent_reservations_v1","request_id="+q(greenNonce)),1);
assert.equal(count("public.character_backstory_secrets","character_id="+q(greenId)),1);
assert.equal(secret(greenId),greenStory);
assert.ok(count("public.inventory_items",
 "owner_type='character' AND owner_id="+q(greenId)+" AND card_payload->>'startingEquipment'='true'")>=1,
 "original deferred starting equipment materializer must still run");
assert.equal(sheet(green),originalGreen[0]);
assert.equal(stamp(green),originalGreen[1]);
assert.equal(profile(green),originalGreen[2]);
console.log("PASS I2D-05: signed v3 + private Story, nonce reservation, canonical sheet, equipment all commit with EMPTY legacy sheet/name/timestamp untouched");

// Immutable nonce and private Story must still bind the same signed intent,
// and legitimate later owner edits of Story must survive identical retries.
const retry=ok(await storyCreate(green,greenPayload,greenStory),"identical private Story retry");
assert.equal(retry,greenId);
const editedStory="I2D explicit owner private Story edit after canonical creation";
const edit=await green.client.from("character_backstory_secrets")
 .update({secret_text:editedStory}).eq("character_id",greenId).select("secret_text").single();
assert.ifError(edit.error);
assert.equal(edit.data.secret_text,editedStory);
assert.equal(ok(await storyCreate(green,greenPayload,greenStory),"stale same nonce replay"),greenId);
assert.equal(secret(greenId),editedStory);
denied(await storyCreate(green,greenPayload,"I2D changed-only private Story tamper"),"22023",
 "changed Story under same immutable nonce");
denied(await storyCreate(old,greenPayload,greenStory),"42501",
 "other signer replay of immutable nonce");
assert.equal(count("public.characters","creation_request_id="+q(greenNonce)),1);
assert.equal(count("private.player_creation_intent_reservations_v1","request_id="+q(greenNonce)),1);
assert.equal(sheet(green),originalGreen[0]);assert.equal(stamp(green),originalGreen[1]);
console.log("PASS I2D-06: identical nonce retries remain idempotent, explicit Story edits preserved; changed Story and cross-owner reuse rejected without legacy writes");

// The same user can create two different canonical characters with distinct
// intent signatures, while the one old account-wide sheet never moves.
const secondNonce=randomUUID(),secondPayload=payload("I2D green second "+secondNonce.slice(0,8),secondNonce);
const secondId=ok(await storyCreate(green,secondPayload,"I2D second character private Story"),"second v3 creation");
assert.notEqual(greenId,secondId);
assert.equal(JSON.parse(charSheet(secondId)).meta.creationRequestId,secondNonce);
assert.equal(secret(secondId),"I2D second character private Story");
assert.equal(count("private.player_creation_intent_reservations_v1","request_id="+q(secondNonce)),1);
assert.equal(sheet(green),originalGreen[0]);assert.equal(stamp(green),originalGreen[1]);
assert.equal(profile(green),originalGreen[2]);
console.log("PASS I2D-07: two signed v3/Story canonical characters for one account, distinct Story+nonce and zero historical snapshot writes");

// A historically populated but unmarked snapshot is also immutable after
// scratch candidate; no implicit character association or backfill.
const historicGreen=await actor("I2D Green Historical No Marker");
sql("UPDATE public.players SET sheet="+q(JSON.stringify({archive:"I2D immutable unmarked sheet",level:8}))+"::jsonb WHERE user_id="+q(historicGreen.id));
const historicBase=[sheet(historicGreen),stamp(historicGreen),profile(historicGreen)];
const historicNonce=randomUUID();
const historicId=ok(await storyCreate(historicGreen,
 payload("I2D green historic "+historicNonce.slice(0,8),historicNonce),
 "I2D private historical signed Story"),"historical preserved candidate");
assert.equal(count("public.characters","id="+q(historicId)),1);
assert.equal(secret(historicId),"I2D private historical signed Story");
assert.equal(sheet(historicGreen),historicBase[0]);
assert.equal(stamp(historicGreen),historicBase[1]);
assert.equal(profile(historicGreen),historicBase[2]);
assert.equal(sql("SELECT sheet#>>'{meta,creationRequestId}' FROM public.players WHERE user_id="+q(historicGreen.id)),"");
console.log("PASS I2D-08: signed modern Story Forge leaves populated historical sheet without marker, account name and timestamp untouched");

// Distinguish private Story wrapper and public v3 (no Story) wrapper.
// The same private v2 source is used by both and must not mirror in either.
const plain=await actor("I2D Green Direct V3");
const plainBase=[sheet(plain),stamp(plain),profile(plain)];
const plainNonce=randomUUID();
const plainId=ok(await plainCreate(plain,
 payload("I2D plain direct v3 "+plainNonce.slice(0,8),plainNonce)),"public v3 no-Story");
assert.equal(count("public.characters","id="+q(plainId)),1);
assert.equal(JSON.parse(charSheet(plainId)).meta.creationRequestId,plainNonce);
assert.equal(count("public.character_backstory_secrets","character_id="+q(plainId)),0);
assert.equal(sheet(plain),plainBase[0]);assert.equal(stamp(plain),plainBase[1]);
assert.equal(profile(plain),plainBase[2]);
console.log("PASS I2D-09: genuine public v3 without Story shares private source candidate; canonical/nonce intact with empty legacy sheet frozen");

// Missing legacy profile row must be re-created identity-only with DEFAULT
// '{}' sheet, never copied from a new character or changed to character name.
const missing=await actor("I2D Signed Missing Account");
sql("DELETE FROM public.players WHERE user_id="+q(missing.id));
assert.equal(sql("SELECT count(*) FROM public.players WHERE user_id="+q(missing.id)),"0");
const missingNonce=randomUUID();
const missingId=ok(await storyCreate(missing,
 payload("I2D missing profile "+missingNonce.slice(0,8),missingNonce),
 "I2D missing account private Story"),"private v2 signed missing account fallback");
assert.equal(count("public.characters","id="+q(missingId)),1);
assert.equal(sheet(missing),"{}");assert.equal(profile(missing),missing.name);
assert.equal(sql("SELECT role FROM public.user_profiles WHERE id="+q(missing.id)),"player");
console.log("PASS I2D-10: signed modern v3/Story re-creates only missing account ID/name, not a legacy sheet; signup user profile role still intact");

// Original negative/rollback paths must hold after the scratch change.
const rollbackNonce=randomUUID(),rollbackPayload=payload("I2D invalid story "+rollbackNonce.slice(0,8),rollbackNonce);
denied(await storyCreate(green,rollbackPayload,"X".repeat(16001)),"23514",
 "Story CHECK must abort full Forge+nonce transaction");
assert.equal(count("public.characters","creation_request_id="+q(rollbackNonce)),0);
assert.equal(count("private.player_creation_intent_reservations_v1","request_id="+q(rollbackNonce)),0);
const outsiderRead=await plain.client.from("character_backstory_secrets")
 .select("secret_text").eq("character_id",greenId);
assert.ok(outsiderRead.error || (Array.isArray(outsiderRead.data)&&outsiderRead.data.length===0),
 "Another user must never see owner private Story");
const rogueSheet=await green.client.from("players")
 .update({sheet:{tamper:"I2D"}}).eq("user_id",green.id).select("user_id");
denied(rogueSheet,"42501","signed direct legacy sheet UPDATE after I2C ACL");
assert.equal(sheet(green),originalGreen[0]);assert.equal(stamp(green),originalGreen[1]);
assert.equal(secret(greenId),editedStory);
assert.equal(md5(outerSig),outerBefore);assert.equal(md5(privV3Sig),privV3Before);
assert.equal(md5(storySig),storyBefore);assert.equal(md5(intentSig),intentBefore);
console.log("PASS I2D-11: signed invalid Story rollback, private Story isolation, client sheet-write denial and all original v3/Story/intent source fingerprints unchanged");
console.log("I2D RESULT: signed original #324 private v2/copied v3 Story-empty-account overwrite RED then isolated Option A source-reversible private v2 identity-only GREEN; two-character, Story, nonce and equipment accepted locally. NO complete 31-trigger/34-writer/browser/production RLS/recovery certification. No hosted SQL, app code or deployment changed.");
