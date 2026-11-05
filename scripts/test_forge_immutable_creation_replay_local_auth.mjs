#!/usr/bin/env node
// Source-original Player Forge immutable replay through REAL disposable GoTrue
// JWTs and PostgREST. No production DnDWeb tokens, host or test accounts.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
const e=process.env;
for(const [key,value] of Object.entries({
 GITHUB_ACTIONS:"true",CI:"true",
 DNDNEXT_FORGE_REPLAY_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_ONLY",
 PGHOST:"127.0.0.1",PGPORT:"54322",PGDATABASE:"postgres"
})) assert.equal(e[key],value,"Unsafe local JWT fixture environment "+key);
assert.match(e.DNDNEXT_FORGE_REPLAY_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_FORGE_REPLAY_LOCAL_ANON_KEY);
const makeClient=()=>createClient(e.DNDNEXT_FORGE_REPLAY_LOCAL_URL,
 e.DNDNEXT_FORGE_REPLAY_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const sql=(statement)=>{
 const p=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],
 {env:{...e,PGUSER:"postgres"},encoding:"utf8",timeout:20000});
 assert.equal(p.status,0,"Local-only SQL error: "+p.stderr);
 return p.stdout.trim();
};
const sqlFile=(path)=>{
 const p=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-f",path],
 {env:{...e,PGUSER:"postgres"},encoding:"utf8",timeout:20000});
 assert.equal(p.status,0,"Local-only source install failed: "+p.stderr);
};
const pause=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function rpc(client,name,args) {
 for(let i=0;i<50;i++){
   const result=await client.rpc(name,args);
   if(result.error?.code==="PGRST202"){await pause(180);continue;}
   return result;
 }
 throw Error("Local-only RPC schema cache did not load "+name);
}
const pwd="FCR-"+randomUUID()+"-Local!";
const people={};
for(const role of ["ADMIN","PLAYER","OUTSIDER"]){
 const client=makeClient(),email="forge-replay-"+randomUUID()+"@example.invalid";
 const signup=await client.auth.signUp({email,password:pwd});
 assert.ifError(signup.error);
 const signin=await client.auth.signInWithPassword({email,password:pwd});
 assert.ifError(signin.error);
 const user=await client.auth.getUser();
 const claims=await client.auth.getClaims();
 assert.ifError(user.error);
 assert.ifError(claims.error);
 assert.equal(user.data.user.id,claims.data.claims.sub);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.notEqual(claims.data.claims.is_anonymous,true);
 people[role]={client,id:user.data.user.id,email};
}
sql("INSERT INTO private.test_admins(id) VALUES ('"+people.ADMIN.id+"')");
const uid=(role)=>people[role].id;
const id=(n)=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
const fighter=(name,nonce)=>({creation_request_id:nonce,name,
 sheet:{classKey:"fighter",level:1,marker:"immutable-intent"}});
const wizard=(name,nonce)=>({creation_request_id:nonce,name,
 sheet:{classKey:"wizard",level:1}});
const spell=(spellId)=>[{spell_id:spellId,source_type:"class",access_type:"class-list"}];
const fire=id(901),frost=id(902);
const call2=(client,payload,spell_choices=[])=>rpc(client,
 "create_player_character_v2",{p_payload:payload,p_spell_choices:spell_choices});
const call3=(client,payload,magic,spell_choices=[])=>rpc(client,
 "create_player_character_v3",{p_payload:payload,p_spell_choices:spell_choices,
 p_magic_selections:magic});
function pass(result,label){
 assert.ifError(result.error);
 assert.match(result.data,/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i,label+" returned invalid UUID");
 return result.data;
}
function denied(result,code,label){
 assert.ok(result.error,label+" unexpectedly succeeded");
 if(code)assert.equal(result.error.code,code,label+": "+result.error.message);
}
const baselinePayload=wizard("JWT unsafe baseline",id(9100));
const baseline=pass(await call3(people.PLAYER.client,baselinePayload,spell(fire)),"baseline create");
const baselineAgain=pass(await call3(people.PLAYER.client,baselinePayload,spell(frost)),"baseline altered retry");
assert.equal(baselineAgain,baseline);
assert.equal(Number(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+baseline+"'")),2);
assert.equal(Number(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+baseline+"'")),1);
assert.equal(sql("SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id='"+baseline+"'"),uid("PLAYER"));
console.log("PASS J00 EXPECTED UNSAFE original v3: same nonce + changed valid magic modifies existing spell rows");

const gmPayload={name:"JWT source-original GM NPC",kind:"npc",
 creation_request_id:id(9101),creator_user_id:uid("OUTSIDER"),sheet:{note:"GM"}};
const gm=pass(await rpc(people.ADMIN.client,"create_character_v1",{p_payload:gmPayload}),"Admin create");
assert.equal(sql("SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id='"+gm+"'"),uid("ADMIN"));
denied(await rpc(people.OUTSIDER.client,"create_character_v1",
 {p_payload:{...gmPayload,name:"JWT untrusted GM attempt",creation_request_id:id(9102)}}),
 "42501","Non-admin create");
console.log("PASS J01 original Admin NPC create and current-identity creator trigger under real JWT");

sqlFile("sql/candidates/20261105_player_creation_immutable_intent_v1.sql");
sql("NOTIFY pgrst,'reload schema'");

const p2=fighter("JWT guarded fighter",id(9103));
const first2=pass(await call2(people.PLAYER.client,p2),"candidate v2");
const beforeDate=sql("SELECT updated_at::text FROM public.character_sheets WHERE character_id='"+first2+"'");
const second2=pass(await call2(people.PLAYER.client,p2),"v2 same intent retry");
assert.equal(second2,first2);
assert.equal(sql("SELECT updated_at::text FROM public.character_sheets WHERE character_id='"+first2+"'"),beforeDate);
denied(await call2(people.PLAYER.client,{...p2,name:"JWT changed fighter"}),"22023","v2 changed payload");
denied(await call2(people.PLAYER.client,p2,[{spell_id:fire}]),"22023","v2 changed choices");
assert.equal(Number(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+first2+"'")),1);
console.log("PASS J02 true-JWT v2 unchanged replay inert, changed name/spells rejected, single level event");

const p3=wizard("JWT guarded wizard",id(9104));
const first3=pass(await call3(people.PLAYER.client,p3,spell(fire)),"candidate v3");
const beforeSpells=sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(s) ORDER BY spell_id,source_key)::text,'[]')) FROM public.character_spells s WHERE character_id='"+first3+"'");
const second3=pass(await call3(people.PLAYER.client,p3,spell(fire)),"v3 same intent");
assert.equal(second3,first3);
assert.equal(sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(s) ORDER BY spell_id,source_key)::text,'[]')) FROM public.character_spells s WHERE character_id='"+first3+"'"),beforeSpells);
denied(await call3(people.PLAYER.client,p3,spell(frost)),"22023","v3 changed magic");
denied(await call3(people.PLAYER.client,{...p3,name:"JWT altered wizard"},spell(fire)),"22023","v3 changed character");
denied(await call2(people.PLAYER.client,p3),"22023","v3 nonce reused via v2");
assert.equal(Number(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+first3+"'")),1);
console.log("PASS J03 true-JWT v3 exact retry without spell mutation; changed spell/character/API rejected");

denied(await call3(people.OUTSIDER.client,p3,spell(fire)),"42501","cross-user replay");
denied(await call3(makeClient(),p3,spell(fire)),null,"anon replay");
denied(await call3(people.PLAYER.client,baselinePayload,spell(fire)),"55000","legacy unverifiable nonce");
assert.equal(sql("SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id='"+first3+"'"),uid("PLAYER"));
console.log("PASS J04 genuine separate JWT cannot steal nonce, anon denied, legacy missing-intent fails closed");

const broken=fighter("JWT invalid class",id(9105));
broken.sheet.classKey="missing-class";
denied(await call2(people.PLAYER.client,broken),"P0002","invalid new class");
assert.equal(Number(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9105)+"'")),0);
assert.equal(Number(sql("SELECT count(*) FROM public.characters WHERE name='JWT invalid class'")),0);
console.log("PASS J05 failed original creation atomically rolls back request reservation and character");

sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id='"+first3+"' AND user_id='"+uid("PLAYER")+"'");
denied(await call3(people.PLAYER.client,p3,spell(fire)),"42501","revoked creator replay");
console.log("PASS J06 revocation checked on current grant under unchanged valid JWT");

const racePayload=wizard("JWT parallel same nonce",id(9106));
const outcomes=await Promise.all([
 call3(people.PLAYER.client,racePayload,spell(fire)),
 call3(people.PLAYER.client,racePayload,spell(fire))
]);
const ids=outcomes.map((v,i)=>pass(v,"same nonce concurrent "+i));
assert.equal(ids[0],ids[1]);
assert.equal(Number(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+ids[0]+"'")),1);
assert.equal(Number(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+ids[0]+"'")),1);
console.log("PASS J07 concurrent identical JWT requests serialize to one source-created character/event/spell");

const raceId=id(9107),left=wizard("JWT race A",raceId),right=wizard("JWT race B",raceId);
const changedRace=await Promise.all([
 call3(people.PLAYER.client,left,spell(fire)),
 call3(people.PLAYER.client,right,spell(frost))
]);
assert.equal(changedRace.filter(v=>!v.error).length,1);
assert.equal(changedRace.filter(v=>v.error?.code==="22023").length,1);
const winner=changedRace.find(v=>!v.error).data;
assert.equal(Number(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+winner+"'")),1);
assert.equal(Number(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+winner+"'")),1);
console.log("PASS J08 concurrent changed-intent same nonce commits exactly one and rejects the other");

assert.equal(Number(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE octet_length(intent_sha256)<>32")),0);
console.log("PASS J09 request table stores only SHA-256 fingerprints, not raw private character selections");
console.log("PASS LOCAL REAL GoTrue: J00-J09 original source v2/v3/Admin, creator trigger, immutable request authorization, transaction rollback and contention.");
