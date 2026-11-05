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
// J10: existing populated account-wide snapshot survives new alternate
// creations; this is the combined held PR #319 behavior.
const originalAccountMarker=sql("SELECT sheet->>'classKey' FROM public.players WHERE user_id='"+uid("PLAYER")+"'");
assert.equal(originalAccountMarker,"wizard",
 "Guarded alternate must not overwrite populated initial legacy account sheet");
const seededSnapshotName=sql("SELECT name FROM public.players WHERE user_id='"+uid("PLAYER")+"'");
assert.equal(seededSnapshotName,"JWT unsafe baseline",
 "Guarded creations must not change existing account legacy display name");
console.log("PASS J10 protected original populated players.sheet survives v2/v3 additional characters");

// J11: a new account creates its primary and alternate through guarded v2,
// preserving two separate canonical sheets and grants with a stable legacy
// snapshot, despite signed-in nonce retry.
const firstAlternatePayload=fighter("JWT second account primary",id(9108));
firstAlternatePayload.sheet.marker="primary-owned";
const altPayload=fighter("JWT second account alternate",id(9109));
altPayload.sheet.marker="alternate-owned";
const primary=pass(await call2(people.OUTSIDER.client,firstAlternatePayload),"second-account primary");
assert.equal(sql("SELECT sheet->>'marker' FROM public.players WHERE user_id='"+uid("OUTSIDER")+"'"),
 "primary-owned");
const alt=pass(await call2(people.OUTSIDER.client,altPayload),"second-account alternate");
assert.notEqual(primary,alt);
assert.equal(sql("SELECT sheet->>'marker' FROM public.players WHERE user_id='"+uid("OUTSIDER")+"'"),
 "primary-owned","Alternate overwrote account legacy snapshot");
assert.equal(Number(sql("SELECT count(*) FROM public.character_sheets WHERE character_id IN ('"+primary+"','"+alt+"') AND sheet->>'marker' IN ('primary-owned','alternate-owned')")),2);
assert.equal(Number(sql("SELECT count(*) FROM public.character_permissions WHERE character_id IN ('"+primary+"','"+alt+"') AND user_id='"+uid("OUTSIDER")+"' AND can_edit AND can_inventory")),2);
assert.equal(pass(await call2(people.OUTSIDER.client,altPayload),"alternate retry"),alt);
assert.equal(Number(sql("SELECT count(*) FROM public.character_level_events WHERE character_id IN ('"+primary+"','"+alt+"')")),2);
console.log("PASS J11 signed-in new account seeds primary snapshot once and retains distinct alternate canonical sheets/grants");
console.log("PASS LOCAL REAL GoTrue: J00-J11 plus composed PR319 legacy snapshot accepted in reduced local PG17.");

// Late attach: all original source-authenticated J00-J11 happened BEFORE
// enabling the source-exact deferred-equipment and sheet-sync triggers.
sqlFile("scripts/fixtures/forge_materializer_local_auth_extension_pg17.sql");
const equipPayload=fighter("JWT deferred fighter",id(9110));
equipPayload.sheet.startingEquipmentSelections={
 mode:"package",classOption:"A",ruleset:"vanilla"
};
const equipped=pass(await call2(people.PLAYER.client,equipPayload),"deferred equipment create");
const equipmentRows=()=>Number(sql(
 "SELECT count(*) FROM public.inventory_items WHERE owner_type='character' AND owner_id='"+equipped+"' AND card_payload->>'startingEquipment'='true'"));
const currencyRows=()=>Number(sql(
 "SELECT count(*) FROM public.character_currency WHERE character_id='"+equipped+"'"));
assert.equal(equipmentRows(),1,"Original deferred materializer did not insert item at COMMIT");
assert.equal(currencyRows(),1,"Original deferred materializer did not insert currency at COMMIT");
assert.equal(sql("SELECT sheet->'startingEquipmentSummary'->0->>'itemKey' FROM public.character_sheets WHERE character_id='"+equipped+"'"),
 "training-dagger","Original materializer did not update canonical sheet summary");
assert.equal(sql("SELECT created_by FROM public.character_progression WHERE character_id='"+equipped+"'"),uid("PLAYER"));
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+equipped+"'"),"1");
console.log("PASS J12 genuine JWT original v2 + sheet sync + deferred source materializer commits one item/currency and canonical summary");

const beforeItem=sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(i) ORDER BY id)::text,'[]')) FROM public.inventory_items i WHERE owner_id='"+equipped+"'");
const beforeSummary=sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id='"+equipped+"'");
assert.equal(pass(await call2(people.PLAYER.client,equipPayload),"equipped exact replay"),equipped);
assert.equal(equipmentRows(),1);
assert.equal(currencyRows(),1);
assert.equal(sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(i) ORDER BY id)::text,'[]')) FROM public.inventory_items i WHERE owner_id='"+equipped+"'"),beforeItem);
assert.equal(sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id='"+equipped+"'"),beforeSummary);
denied(await call2(people.PLAYER.client,{
 ...equipPayload,sheet:{...equipPayload.sheet,
  startingEquipmentSelections:{...equipPayload.sheet.startingEquipmentSelections,classOption:"B"}}
}),"22023","same nonce with different starting equipment selection");
assert.equal(equipmentRows(),1);
console.log("PASS J13 identical equipped nonce is inert; altered package rejected; no item/currency duplicated");

const invalidEquip=fighter("JWT invalid deferred package",id(9111));
invalidEquip.sheet.startingEquipmentSelections={
 mode:"package",classOption:"Z",ruleset:"vanilla"
};
const failedEquip=await call2(people.PLAYER.client,invalidEquip);
assert.ok(failedEquip.error,"Invalid source package unexpectedly accepted");
assert.match(failedEquip.error.message,/Choose a valid source-backed class starting equipment package/i);
assert.equal(sql("SELECT count(*) FROM public.characters WHERE name='JWT invalid deferred package'"),"0");
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9111)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE item_name='JWT invalid deferred package'"),"0");
console.log("PASS J14 source-original deferred package rejection rolls back character, attribution and nonce");

const equipRace=fighter("JWT concurrent equipped",id(9112));
equipRace.sheet.startingEquipmentSelections={mode:"package",classOption:"A",ruleset:"vanilla"};
const both=await Promise.all([
 call2(people.PLAYER.client,equipRace),
 call2(people.PLAYER.client,equipRace)
]);
const raceIds=both.map((result,i)=>pass(result,"equipped concurrent "+i));
assert.equal(raceIds[0],raceIds[1]);
const equipRaceId=raceIds[0];
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+equipRaceId+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+equipRaceId+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+equipRaceId+"'"),"1");
console.log("PASS J15 concurrent identical JWT equipped nonce serializes to one original deferred item/currency/event");

const alternateEquip=fighter("JWT alternate equipped",id(9113));
alternateEquip.sheet.startingEquipmentSelections={mode:"package",classOption:"A",ruleset:"vanilla"};
alternateEquip.sheet.marker="gear-alternate";
const snapshotBefore=sql("SELECT md5(sheet::text) FROM public.players WHERE user_id='"+uid("OUTSIDER")+"'");
const separateEquip=pass(await call2(people.OUTSIDER.client,alternateEquip),"equipped alternate");
assert.equal(sql("SELECT md5(sheet::text) FROM public.players WHERE user_id='"+uid("OUTSIDER")+"'"),snapshotBefore,
 "Combined deferred gear and PR319 fix overwrote primary account-wide snapshot");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+separateEquip+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+separateEquip+"'"),"1");
assert.equal(sql("SELECT sheet->>'marker' FROM public.character_sheets WHERE character_id='"+separateEquip+"'"),"gear-alternate");
console.log("PASS J16 equipped alternate preserves PR319 legacy account snapshot while retaining canonical sheet/equipment");
console.log("PASS LOCAL REAL GoTrue J00-J16: source exact deferred materializer+sync subset, PR319 snapshot, immutable replay; remaining 17+ progression triggers omitted.");
