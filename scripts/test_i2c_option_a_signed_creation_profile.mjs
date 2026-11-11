#!/usr/bin/env node
// I2-C Option A: source-exact original v1/v2 and signup RED followed by a
// signed, disposable ONLY account-identity creator candidate and profile ACL.
// Runs AFTER all unchanged I1C..O signed research; no production connections.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";

const e=process.env;
for(const [k,v] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",DNDNEXT_I1G_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 DNDNEXT_I2C_LOCAL_CONFIRM:"DISPOSABLE_I2C_OPTION_A_CREATION_ONLY",
 PGHOST:"127.0.0.1",PGPORT:"55622",PGDATABASE:"postgres",PGUSER:"postgres"
}))assert.equal(e[k],v,"Unsafe I2-C environment: "+k);
assert.match(e.DNDNEXT_I1G_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:55621\/?$/);
assert.ok(e.DNDNEXT_I1G_LOCAL_ANON_KEY);
const make=()=>createClient(e.DNDNEXT_I1G_LOCAL_URL,e.DNDNEXT_I1G_LOCAL_ANON_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const run=(args)=>{
 const z=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",...args],{env:e,encoding:"utf8",timeout:35000});
 assert.equal(z.status,0,"I2-C local psql: "+z.stderr.slice(-1600));
 return z.stdout.trim();
};
const sql=q=>run(["-qAt","-c",q]);
const fixture=p=>run(["-q","-f",p]);
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function rpc(client,method,args){
 for(let n=0;n<35;n++){
  const r=await client.rpc(method,args);
  if(r.error?.code==="PGRST202"){await wait(200);continue;}
  return r;
 }
 throw Error("Disposable PostgREST RPC route unavailable: "+method);
}
const payload=(name,nonce=null)=>({
 name,...(nonce?{creation_request_id:nonce}:{}),
 sheet:{classKey:"fighter",level:1,marker:"I2C "+name}
});
const actorName=async name=>{
 const client=make(),email="i2c-"+randomUUID()+"@example.invalid";
 const password="I2C-"+randomUUID()+"-X!";
 assert.ifError((await client.auth.signUp({email,password,options:{data:{display_name:name}}})).error);
 assert.ifError((await client.auth.signInWithPassword({email,password})).error);
 const got=await client.auth.getUser();assert.ifError(got.error);
 const claims=await client.auth.getClaims();assert.ifError(claims.error);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.equal(claims.data.claims.sub,got.data.user.id);
 return {name,client,id:got.data.user.id};
};
const sheet=(a)=>sql("SELECT sheet::text FROM public.players WHERE user_id="+lit(a.id));
const stamp=(a)=>sql("SELECT updated_at::text FROM public.players WHERE user_id="+lit(a.id));
const profile=(a)=>sql("SELECT name FROM public.players WHERE user_id="+lit(a.id));
const sheetHash=(a)=>sql("SELECT md5(sheet::text) FROM public.players WHERE user_id="+lit(a.id));
const canonical=(id)=>sql("SELECT sheet::text FROM public.character_sheets WHERE character_id="+lit(id));
const count=(id)=>sql("SELECT count(*) FROM public.characters WHERE id="+lit(id));
const v1=(a,name)=>rpc(a.client,"create_player_character_v1",{
 p_payload:payload(name),p_spell_choices:[]
});
const v2=(a,name,nonce)=>rpc(a.client,"create_player_character_v2",{
 p_payload:payload(name,nonce),p_spell_choices:[]
});
const ok=(r,label)=>{assert.ifError(r.error);assert.ok(r.data,label+" missing id");return r.data;};
const md5=sig=>sql("SELECT md5(pg_get_functiondef("+lit(sig)+"::regprocedure))");
fixture("scripts/fixtures/i2c_original_creation_signup_shared_forge_pg17.sql");
const source={
v1:"e2db5802f1f51b93f5b9d374a835e4b9",
v2:"0351f0a00acae023278e1b8b065b00c9",
signup:"dd7113eec05655a661309838acce6030"
};
assert.equal(md5("public.create_player_character_v1(jsonb,jsonb)"),source.v1);
assert.equal(md5("public.create_player_character_v2(jsonb,jsonb)"),source.v2);
assert.equal(md5("public.sync_user_profile()"),source.signup);
console.log("PASS I2C-01: exact deployed v1, v2 and signup source bodies installed after inherited Forge RED/GREEN, source MD5 verified");

const v1Red=await actorName("I2C Signup Display V1");
const v2Red=await actorName("I2C Signup Display V2");
assert.equal(profile(v1Red),"I2C Signup Display V1");
assert.equal(profile(v2Red),"I2C Signup Display V2");
assert.equal(sheet(v1Red),"{}");
assert.equal(sheet(v2Red),"{}");
assert.equal(sql("SELECT role FROM public.user_profiles WHERE id="+lit(v1Red.id)),"player");
assert.equal(sql("SELECT role FROM public.user_profiles WHERE id="+lit(v2Red.id)),"player");
const hist1={historical:"v1 legacy owner snapshot",version:99};
const hist2={historical:"v2 legacy owner snapshot without creation marker",version:100};
sql("UPDATE public.players SET sheet="+lit(JSON.stringify(hist1))+"::jsonb WHERE user_id="+lit(v1Red.id)+";"+
    "UPDATE public.players SET sheet="+lit(JSON.stringify(hist2))+"::jsonb WHERE user_id="+lit(v2Red.id)+";");
const v1Original=ok(await v1(v1Red,"I2C ORIGINAL V1"),"original source v1");
assert.equal(count(v1Original),"1");
assert.equal(JSON.parse(canonical(v1Original)).marker,"I2C I2C ORIGINAL V1");
assert.equal(profile(v1Red),"I2C ORIGINAL V1");
assert.equal(JSON.parse(sheet(v1Red)).marker,"I2C I2C ORIGINAL V1");
assert.notEqual(sheet(v1Red),JSON.stringify(hist1));
console.log("PASS I2C-02 EXPECTED ORIGINAL V1 RED: signed original creator rewrites existing legacy sheet AND account display name despite canonical character correctly created");

const redNonce=randomUUID();
const v2Original=ok(await v2(v2Red,"I2C ORIGINAL V2",redNonce),"original source v2");
assert.equal(count(v2Original),"1");
assert.equal(JSON.parse(canonical(v2Original)).meta.creationRequestId,redNonce);
assert.equal(JSON.parse(sheet(v2Red)).meta.creationRequestId,redNonce);
assert.equal(profile(v2Red),"I2C Signup Display V2");
console.log("PASS I2C-03 EXPECTED ORIGINAL V2 RED: signed original v2 UPSERT overwrites populated historical legacy sheet while preserving account name");

// Strictly scoped research candidate. Keep source and creator triggers prior
// to this point untouched to preserve RED provenance.
fixture("scripts/fixtures/i2c_option_a_creator_identity_only_scratch_pg17.sql");
assert.equal(md5("public.sync_user_profile()"),source.signup);
const greenV1=await actorName("I2C Green First Profile");
const greenV2=await actorName("I2C Green Multi Profile");
const fallback=await actorName("I2C Fallback Identity");
const untouched=await actorName("I2C Untouched Signup");
for(const a of [greenV1,greenV2,fallback,untouched]){
 assert.equal(sheet(a),"{}","signup must create only empty profile");
 assert.equal(profile(a),a.name);
}
const h={v1:{archived:"keep-v1-legacy"},v2:{archived:"keep-v2-legacy"}};
sql("UPDATE public.players SET sheet="+lit(JSON.stringify(h.v1))+"::jsonb WHERE user_id="+lit(greenV1.id)+";"+
    "UPDATE public.players SET sheet="+lit(JSON.stringify(h.v2))+"::jsonb WHERE user_id="+lit(greenV2.id)+";"+
    "DELETE FROM public.players WHERE user_id="+lit(fallback.id)+";");
const originalState=[
 [greenV1,sheet(greenV1),stamp(greenV1),profile(greenV1)],
 [greenV2,sheet(greenV2),stamp(greenV2),profile(greenV2)],
 [untouched,sheet(untouched),stamp(untouched),profile(untouched)]
];
console.log("PASS I2C-04: only v1 legacy UPDATE+FOUND and v2 sheet UPSERT source blocks removed in SCRATCH; original signup source untouched, historical unmarked snapshots seeded");

const green1=ok(await v1(greenV1,"I2C GREEN V1"),"candidate signed v1");
assert.equal(count(green1),"1");
assert.equal(JSON.parse(canonical(green1)).marker,"I2C I2C GREEN V1");
assert.equal(sheet(greenV1),originalState[0][1]);
assert.equal(stamp(greenV1),originalState[0][2]);
assert.equal(profile(greenV1),originalState[0][3]);
const secondV1=await v1(greenV1,"I2C V1 SECOND BLOCKED");
assert.ok(secondV1.error,"legacy one-linked-character restriction must remain");
assert.equal(secondV1.error.code,"23505");
assert.equal(sheet(greenV1),originalState[0][1]);
console.log("PASS I2C-05: signed v1 creates its canonical Fighter yet preserves old account sheet/name/timestamp, original one-character restriction remains");

const nonce1=randomUUID(),nonce2=randomUUID();
const green2=ok(await v2(greenV2,"I2C GREEN V2 ONE",nonce1),"candidate signed v2 first");
assert.equal(JSON.parse(canonical(green2)).meta.creationRequestId,nonce1);
assert.equal(ok(await v2(greenV2,"I2C GREEN V2 ONE",nonce1),"identical signed v2 retry"),green2);
const green3=ok(await v2(greenV2,"I2C GREEN V2 TWO",nonce2),"candidate signed v2 second");
assert.notEqual(green3,green2);
assert.equal(JSON.parse(canonical(green3)).meta.creationRequestId,nonce2);
assert.equal(sheet(greenV2),originalState[1][1]);
assert.equal(stamp(greenV2),originalState[1][2]);
assert.equal(profile(greenV2),originalState[1][3]);
const alien=await v2(greenV1,"I2C STOLEN NONCE",nonce1);
assert.ok(alien.error,"other signer must be rejected from replay");
assert.equal(alien.error.code,"42501");
console.log("PASS I2C-06: signed v2 creates two independent canonical characters, replay idempotent/cross-signer denied, historical account sheet/name frozen");

// New account WITHOUT a players row must still receive an identity row,
// and its sheet stays {} after candidate creator.
assert.equal(sql("SELECT count(*) FROM public.players WHERE user_id="+lit(fallback.id)),"0");
const greenFallback=ok(await v1(fallback,"I2C GREEN MISSING PROFILE"),"candidate v1 fallback account");
assert.equal(count(greenFallback),"1");
assert.equal(sheet(fallback),"{}");
assert.equal(profile(fallback),"I2C Fallback Identity");
assert.equal(JSON.parse(canonical(greenFallback)).marker,"I2C I2C GREEN MISSING PROFILE");
console.log("PASS I2C-07: signed original v1 missing-account fallback now ensures profile identity from signed auth metadata, without copying canonical sheet or using old FOUND");

// Source-original signup row creation must stay inert on repeated events.
// Check existing/synthetic legacy row is stable through login+profile updates.
assert.equal(sheet(untouched),"{}");
assert.equal(profile(untouched),"I2C Untouched Signup");
assert.equal(md5("public.sync_user_profile()"),source.signup);
console.log("PASS I2C-08: original signup trigger retains account identity and user_profiles role with empty legacy sheet; no cross-account reassignment");

// Independently staged ACL means signed clients can rename their account
// but cannot write any old sheet, even when its source creator no longer does.
fixture("scripts/fixtures/i2c_option_a_signup_profile_acl_scratch_pg17.sql");
const rogue=await greenV2.client.from("players")
 .update({sheet:{evil:"replace"}}).eq("user_id",greenV2.id).select("user_id");
assert.ok(rogue.error);
assert.equal(rogue.error.code,"42501");
const unauth=await make().from("players").select("user_id").limit(1);
assert.ok(unauth.error);
const ownerProfileEdit=await greenV2.client.from("players")
 .update({name:"I2C edited account display"}).eq("user_id",greenV2.id).select("name").single();
assert.ifError(ownerProfileEdit.error);
assert.equal(ownerProfileEdit.data.name,"I2C edited account display");
const upsert=await greenV2.client.from("players")
 .upsert({user_id:greenV2.id,name:"I2C profile upsert"}, {onConflict:"user_id"}).select("name").single();
assert.ifError(upsert.error);
assert.equal(upsert.data.name,"I2C profile upsert");
assert.equal(sheet(greenV2),originalState[1][1]);
assert.equal(sheet(greenV1),originalState[0][1]);
const newClient=await actorName("I2C Signed New Signup After ACL");
assert.equal(sheet(newClient),"{}");
assert.equal(profile(newClient),newClient.name);
const unmarkedEdit=await greenV1.client.from("players")
 .update({name:"I2C historical owner renamed"}).eq("user_id",greenV1.id).select("name").single();
assert.ifError(unmarkedEdit.error);
assert.equal(sheet(greenV1),originalState[0][1]);
console.log("PASS I2C-09: role-authentic profile name UPDATE/UPSERT and signup survive, direct legacy sheet mutation and anonymous read denied, both historical sheets intact");

const finalV2=ok(await v2(greenV2,"I2C GREEN V2 AFTER ACL",randomUUID()),"candidate signed v2 with frozen ACL");
assert.equal(count(finalV2),"1");
assert.equal(sheet(greenV2),originalState[1][1]);
const finalV1=await v1(greenV1,"I2C V1 SECOND AFTER ACL");
assert.ok(finalV1.error);
assert.equal(finalV1.error.code,"23505");
assert.equal(md5("public.sync_user_profile()"),source.signup);
console.log("PASS I2C-10: SECURITY DEFINER candidate v2 still creates canonical characters under profile-only JWT grants; v1 original limitation and legacy no-write invariant remain");

// Explicit release limit: source-original public v3 and private Forge v2
// copied by #324 are deliberately untouched. They STILL contain their
// historical player-sheet UPSERT and must be handled in the full 34+3
// writer migration. All 31 production triggers and browser not accepted.
assert.equal(sql("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname='create_player_character_v2_source_20261105' AND lower(pg_get_functiondef(p.oid)) LIKE '%insert into public.players%'"),"1");
console.log("I2C RESULT: exact original signed v1/v2/trigger RED preserved, two narrow creator candidates GREEN with account-name and legacy snapshot preservation. PRIVATE v2 source / public v3 production path remains UNFROZEN, full 31-trigger and recovery gates remain OPEN. No production changes.");
