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

// The original deferred sheet validator is installed only now, after J16.
sqlFile("scripts/fixtures/forge_equipment_validator_local_auth_extension_pg17.sql");
const validBg=fighter("JWT validated equipped soldier",id(9115));
validBg.sheet.background="Soldier";
validBg.sheet.meta={backgroundSource:"XPHB"};
validBg.sheet.startingEquipmentSelections={
 mode:"package",ruleset:"vanilla",classOption:"A",backgroundId:id(9150)
};
const soldier=pass(await call2(people.PLAYER.client,validBg),"source-validated equipment");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+soldier+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+soldier+"'"),"1");
assert.equal(sql("SELECT sheet->'startingEquipmentSummary'->0->>'itemKey' FROM public.character_sheets WHERE character_id='"+soldier+"'"),"training-dagger");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+soldier+"'"),"1");
const soldierSheet=sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id='"+soldier+"'");
assert.equal(pass(await call2(people.PLAYER.client,validBg),"source-validated identical retry"),soldier);
assert.equal(sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id='"+soldier+"'"),soldierSheet);
console.log("PASS J17 original deferred sheet validator + materializer accept source-matched Background and inert retry");

const invalidBg=JSON.parse(JSON.stringify(validBg));
invalidBg.name="JWT missing required Background id";
invalidBg.creation_request_id=id(9116);
delete invalidBg.sheet.startingEquipmentSelections.backgroundId;
const inventoryCountBefore=sql("SELECT count(*) FROM public.inventory_items");
const currencyCountBefore=sql("SELECT count(*) FROM public.character_currency");
const missingBg=await call2(people.PLAYER.client,invalidBg);
assert.ok(missingBg.error,"Missing background ID was accepted");
assert.match(missingBg.error.message,/Starting equipment must reference the selected Background/i);
assert.equal(sql("SELECT count(*) FROM public.characters WHERE name='JWT missing required Background id'"),"0");
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9116)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.inventory_items"),inventoryCountBefore,
 "Deferred sheet validator failure leaked item before rollback");
assert.equal(sql("SELECT count(*) FROM public.character_currency"),currencyCountBefore,
 "Deferred sheet validator failure leaked copper before rollback");
console.log("PASS J18 original deferred Background-id validation rolls back prior materializer writes and nonce");

const mismatchedBg=JSON.parse(JSON.stringify(validBg));
mismatchedBg.name="JWT mismatched Background";
mismatchedBg.creation_request_id=id(9117);
mismatchedBg.sheet.background="Noble";
const mismatch=await call2(people.PLAYER.client,mismatchedBg);
assert.ok(mismatch.error,"Mismatch Background name was accepted");
assert.match(mismatch.error.message,/Starting equipment Background does not match/i);
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9117)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE name='JWT mismatched Background'"),"0");
console.log("PASS J19 source-exact deferred Background-name mismatch fails closed without character/nonce");

const validatedRace=JSON.parse(JSON.stringify(validBg));
validatedRace.name="JWT concurrent source-validated soldier";
validatedRace.creation_request_id=id(9118);
const concurrentValidated=await Promise.all([
 call2(people.PLAYER.client,validatedRace),
 call2(people.PLAYER.client,validatedRace)
]);
const validatedIds=concurrentValidated.map((v,i)=>pass(v,"source-validated same-nonce concurrent "+i));
assert.equal(validatedIds[0],validatedIds[1]);
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+validatedIds[0]+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+validatedIds[0]+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+validatedIds[0]+"'"),"1");
console.log("PASS J20 real JWT concurrent validated-Background creation yields one character/item/currency/event");

const changedBg=JSON.parse(JSON.stringify(validBg));
changedBg.sheet.startingEquipmentSelections.backgroundId=id(9151);
denied(await call2(people.PLAYER.client,changedBg),"22023",
 "same nonce changed selected Background must reject before validator");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+soldier+"'"),"1");
console.log("PASS J21 changed original Background selection under existing nonce denied with no gear mutation");
console.log("PASS LOCAL REAL GoTrue J00-J21: composed immutable nonce, legacy snapshot, original equipment materializer, sheet sync, deferred Background validator subset.");

// Third source expansion: original SECURITY INVOKER authority guard and
// SECURITY DEFINER sheet-to-character tag sync. Local RLS below is intentionally
// reduced to editor-only, NOT production's can_access_character_v1 function.
sqlFile("scripts/fixtures/forge_sheet_authority_tags_local_auth_extension_pg17.sql");
const sheetWrite=(client,characterId,sheet)=>client
 .from("character_sheets").update({sheet}).eq("character_id",characterId)
 .select("character_id,sheet");

const tagged=fighter("JWT immediate sheet trigger fighter",id(9120));
tagged.sheet.background="Soldier";
tagged.sheet.meta={backgroundSource:"XPHB",speciesKey:"Elf"};
tagged.sheet.startingEquipmentSelections={
 mode:"package",ruleset:"vanilla",classOption:"A",backgroundId:id(9150)
};
const taggedId=pass(await call2(people.PLAYER.client,tagged),"new original-tagged Forge");
assert.equal(sql("SELECT tags @> ARRAY['player-character','species:elf','class:fighter','background:soldier']::text[] FROM public.characters WHERE id='"+taggedId+"'"),"t",
 "Original tag sync did not derive player class/species/background");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+taggedId+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+taggedId+"'"),"1");
assert.equal(pass(await call2(people.PLAYER.client,tagged),"new tagged same-nonce retry"),taggedId);
console.log("PASS J22 signed-in original Forge creation runs both immediate sheet triggers and derives tags without duplicating equipment");

// Live-original tag derivation preserves campaign tags on UPDATE. Direct
// editor-only JWT UPDATE of non-authoritative note/professions remains allowed.
sql("UPDATE public.characters SET tags=array_append(tags,'campaign:keepers') WHERE id='"+taggedId+"'");
const priorSheet=JSON.parse(sql("SELECT sheet::text FROM public.character_sheets WHERE character_id='"+taggedId+"'"));
const noteSheet={...priorSheet,marker:"authorized journal edit",
 professions:{"Cartographer":{rank:1}}};
const noteEdit=await sheetWrite(people.PLAYER.client,taggedId,noteSheet);
assert.ifError(noteEdit.error);
assert.equal(noteEdit.data?.length,1,"Editor could not write permitted sheet note");
assert.equal(sql("SELECT tags @> ARRAY['campaign:keepers','profession:cartographer','class:fighter','background:soldier']::text[] FROM public.characters WHERE id='"+taggedId+"'"),"t");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+taggedId+"'"),"1");
console.log("PASS J23 authenticated editor updates harmless sheet content; tag sync preserves campaign tag and derives profession");

// Original invoker guard must reject direct authoritative mutations, without
// rewriting any sheet/tags or item. Test BOTH top-level and protected meta.
const protectedSpell={...noteSheet,spells:[{id:fire,name:"Fire Bolt"}]};
const blockSpell=await sheetWrite(people.PLAYER.client,taggedId,protectedSpell);
denied(blockSpell,"42501","Direct player spell authority write");
const protectedMeta={...noteSheet,meta:{...noteSheet.meta,featGrantInstances:[{grantId:"unapproved"}]}};
const blockMeta=await sheetWrite(people.PLAYER.client,taggedId,protectedMeta);
denied(blockMeta,"42501","Direct player feat grant metadata write");
assert.equal(sql("SELECT sheet->>'marker' FROM public.character_sheets WHERE character_id='"+taggedId+"'"),"authorized journal edit");
assert.equal(sql("SELECT coalesce(jsonb_array_length(sheet->'spells'),0) FROM public.character_sheets WHERE character_id='"+taggedId+"'"),"0");
console.log("PASS J24 original SECURITY INVOKER guard rejects editor direct spells and meta feat grants, 42501, with no sheet mutation");

// Separate GoTrue JWT with no current editor grant should see zero rows, even
// if submitted protected sheet data. This RLS predicate is a REDUCED local
// surrogate for production private.can_access_character_v1, not full parity.
const outsiderWrite=await sheetWrite(people.OUTSIDER.client,taggedId,
 {...noteSheet,marker:"intruding author"});
assert.ifError(outsiderWrite.error);
assert.equal(outsiderWrite.data?.length,0,"Noneditor unexpectedly updated a canonical character sheet");
const anonymousWrite=await sheetWrite(makeClient(),taggedId,{...noteSheet,marker:"anonymous intrusion"});
assert.ok(anonymousWrite.error,"Anon unexpectedly allowed direct sheet UPDATE");
assert.equal(sql("SELECT sheet->>'marker' FROM public.character_sheets WHERE character_id='"+taggedId+"'"),"authorized journal edit");
console.log("PASS J25 separate signed-in noneditor cannot update sheet; anon has no table access (reduced local editor RLS)");

// Current Admin signs with the same normal authenticated JWT role, but source
// original private.current_user_is_admin permits authoritative edits. Local
// sheet RLS needs an explicit editor grant for this GM NPC (not production ACL).
sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert) VALUES('"+gm+"','"+uid("ADMIN")+"',true,true,false)");
const gmOriginal=JSON.parse(sql("SELECT sheet::text FROM public.character_sheets WHERE character_id='"+gm+"'"));
const gmProtected={...gmOriginal,spells:[{id:fire,source:"GM-only override"}]};
const gmWrite=await sheetWrite(people.ADMIN.client,gm,gmProtected);
assert.ifError(gmWrite.error);
assert.equal(gmWrite.data?.length,1,"GM source guard should permit original privileged sheet edit");
assert.equal(sql("SELECT jsonb_array_length(sheet->'spells') FROM public.character_sheets WHERE character_id='"+gm+"'"),"1");
assert.notEqual(sql("SELECT tags::text FROM public.characters WHERE id='"+gm+"'").includes("player-character"),true);
console.log("PASS J26 genuine GM authenticated identity bypasses original protected-field guard on editor-granted NPC, no player tag pollution");

// Merely granting can_edit on the same GM NPC must NOT grant its full
// authoritative field-write privilege to a non-Admin ordinary editor.
sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert) VALUES('"+gm+"','"+uid("PLAYER")+"',false,true,false)");
const playerNpcSheet=JSON.parse(sql("SELECT sheet::text FROM public.character_sheets WHERE character_id='"+gm+"'"));
denied(await sheetWrite(people.PLAYER.client,gm,
 {...playerNpcSheet,meta:{classChoiceFeats:[{id:"forged"}]}}),"42501",
 "NonAdmin editor tried to write GM NPC feat choice metadata");
const playerNpcNote=await sheetWrite(people.PLAYER.client,gm,
 {...playerNpcSheet,note:"editor ordinary NPC note"});
assert.ifError(playerNpcNote.error);
assert.equal(playerNpcNote.data?.length,1,"NonAdmin editor should be able to edit ordinary NPC note");
assert.equal(sql("SELECT sheet->>'note' FROM public.character_sheets WHERE character_id='"+gm+"'"),"editor ordinary NPC note");
console.log("PASS J27 ordinary editor on GM NPC can edit note but cannot impersonate Admin's source-authority write");

// Direct sheet INSERT is subject to the original BEFORE trigger and the
// deliberately reduced editor-only local RLS insert policy.
const bareId=id(9190);
sql("INSERT INTO public.characters(id,name,tags,kind) VALUES('"+bareId+"','JWT scratch character insert',ARRAY['player-character'],'npc')");
sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert) VALUES('"+bareId+"','"+uid("OUTSIDER")+"',true,true,false)");
const rejectedInsert=await people.OUTSIDER.client.from("character_sheets")
 .insert({character_id:bareId,sheet:{classKey:"fighter",feats:[{name:"Injected Feat"}]}})
 .select("character_id");
denied(rejectedInsert,"42501","Editor direct unauthorized feat INSERT");
assert.equal(sql("SELECT count(*) FROM public.character_sheets WHERE character_id='"+bareId+"'"),"0");
const allowedInsert=await people.OUTSIDER.client.from("character_sheets")
 .insert({character_id:bareId,sheet:{classKey:"fighter",meta:{creator:"manual-local-fixture"},note:"safe editor init"}})
 .select("character_id");
assert.ifError(allowedInsert.error);
assert.equal(allowedInsert.data?.length,1);
assert.equal(sql("SELECT tags @> ARRAY['player-character','class:fighter']::text[] FROM public.characters WHERE id='"+bareId+"'"),"t");
console.log("PASS J28 original guard blocks direct authoritative sheet INSERT but ordinary authorized sheet insert derives tags");

// Editor revocation is checked by RLS on subsequent direct updates. The
// original source authority guard is not a substitute for RLS or grants.
sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id='"+taggedId+"' AND user_id='"+uid("PLAYER")+"'");
const revokedWrite=await sheetWrite(people.PLAYER.client,taggedId,
 {...noteSheet,marker:"revoked editor journal"});
assert.ifError(revokedWrite.error);
assert.equal(revokedWrite.data?.length,0);
assert.equal(sql("SELECT sheet->>'marker' FROM public.character_sheets WHERE character_id='"+taggedId+"'"),"authorized journal edit");
console.log("PASS J29 revoking current edit grant blocks future direct sheet updates in local editor-only RLS");

// Original v3 source-qualified spells must still be writable through server
// creation RPC after immediate sheet authority guard is attached.
const wizardPostGuard=wizard("JWT wizard after sheet guard",id(9121));
wizardPostGuard.sheet.species="Gnome";
const wizardId=pass(await call3(people.OUTSIDER.client,wizardPostGuard,spell(fire)),
 "original v3 under both immediate sheet triggers");
assert.equal(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+wizardId+"'"),"1");
assert.equal(sql("SELECT tags @> ARRAY['player-character','class:wizard','species:gnome']::text[] FROM public.characters WHERE id='"+wizardId+"'"),"t");
assert.equal(pass(await call3(people.OUTSIDER.client,wizardPostGuard,spell(fire)),
 "v3 tagged retry"),wizardId);
console.log("PASS J30 original player v3 RPC and spells succeed through immediate guard/tag sync; nonce retry remains inert");
console.log("PASS LOCAL REAL GoTrue J00-J30: original-sheet authority/tag handlers, nonce/PR319, deferred equipment with reduced ACL/catalogue.");

// J31+: source-exact progression authority validator with original helpers and
// source-preferred catalog view. The local catalog specimens are limited; no
// other missing production progression/source grants are bypassed in the handler.
sqlFile("scripts/fixtures/forge_progression_authority_local_auth_extension_pg17.sql");
const validAuthority=fighter("JWT Forge exact authority and feat",id(9131));
validAuthority.sheet.background="Soldier";
validAuthority.sheet.meta={backgroundSource:"XPHB",speciesKey:"Elf"};
validAuthority.sheet.startingEquipmentSelections={
 mode:"package",ruleset:"vanilla",classOption:"A",backgroundId:id(9150)
};
validAuthority.sheet.featGrantInstances=[{
 instanceId:"origin-lucky-1",optionId:id(9154),name:"Lucky",source:"XPHB",
 optionType:"feat",acquisitionLevel:1,choices:{},fixedEffects:[]
}];
validAuthority.sheet.feats=["Lucky"];
validAuthority.sheet.classFeatureChoices={
 fightingStyle:{kind:"fighting-style",count:1,level:1,label:"Fighting Style",
 selections:[{name:"Defense",key:"defense",source:"XPHB"}]}
};
validAuthority.sheet.classFeatureChoiceSummary=[
 {groupId:"fightingStyle",key:"defense",name:"Defense",source:"XPHB"}
];
const verifiedAuthority=pass(await call2(people.PLAYER.client,validAuthority),
 "original Forge source-validated feat and fighting-style");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+verifiedAuthority+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+verifiedAuthority+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+verifiedAuthority+"'"),"1");
const selectedFeats=sql("SELECT sheet->'feats'->>0 FROM public.character_sheets WHERE character_id='"+verifiedAuthority+"'");
assert.equal(selectedFeats,"Lucky");
const verifiedSheetHash=sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id='"+verifiedAuthority+"'");
assert.equal(pass(await call2(people.PLAYER.client,validAuthority),"same source-qualified feat nonce"),verifiedAuthority);
assert.equal(sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id='"+verifiedAuthority+"'"),verifiedSheetHash);
console.log("PASS J31 original deferred progression validator accepts canonical Lucky feat instance plus Defense fighting-style option and inert retry");

const unsupportedFeat=JSON.parse(JSON.stringify(validAuthority));
unsupportedFeat.name="JWT unsupported standalone feat summary";
unsupportedFeat.creation_request_id=id(9132);
unsupportedFeat.sheet.featGrantInstances=[];
unsupportedFeat.sheet.feats=["Unsupported Feat"];
const beforeFeatGear=sql("SELECT count(*) FROM public.inventory_items");
const invalidFeat=await call2(people.PLAYER.client,unsupportedFeat);
assert.ok(invalidFeat.error,"Unsupported source feat summary was accepted");
assert.match(invalidFeat.error.message,/feats must exactly match their validated source-owned feat grants/i);
assert.equal(sql("SELECT count(*) FROM public.characters WHERE name='JWT unsupported standalone feat summary'"),"0");
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9132)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.inventory_items"),beforeFeatGear);
console.log("PASS J32 mismatched source-owned feat summary fails original deferred validator and atomically rolls back equipment and nonce");

const badGrant=JSON.parse(JSON.stringify(validAuthority));
badGrant.name="JWT missing canonical feat instance ID";
badGrant.creation_request_id=id(9133);
badGrant.sheet.featGrantInstances=[{name:"Lucky",optionId:id(9154),source:"XPHB"}];
const invalidGrant=await call2(people.PLAYER.client,badGrant);
assert.ok(invalidGrant.error,"Original feat grant instance validator unexpectedly accepted absent instanceId");
assert.match(invalidGrant.error.message,/requires an instanceId/i);
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9133)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE name='JWT missing canonical feat instance ID'"),"0");
console.log("PASS J33 original feat-instance helper rejects missing canonical instanceId without partial character/nonce");

const invalidStyle=JSON.parse(JSON.stringify(validAuthority));
invalidStyle.name="JWT invalid fighting style";
invalidStyle.creation_request_id=id(9134);
invalidStyle.sheet.classFeatureChoices.fightingStyle.selections[0].name="Impossible Style";
invalidStyle.sheet.classFeatureChoiceSummary[0].name="Impossible Style";
const rejectedStyle=await call2(people.PLAYER.client,invalidStyle);
assert.ok(rejectedStyle.error,"Original preferred-option fighting-style validator accepted nonexistent option");
assert.match(rejectedStyle.error.message,/not valid for this class, subclass, source, or level/i);
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9134)+"'"),"0");
console.log("PASS J34 source-original preferred-option view and validator reject nonexistent fighting style, rollback nonce");

const fakeSpellSheet=JSON.parse(JSON.stringify(validAuthority));
fakeSpellSheet.name="JWT false canonical spell summary";
fakeSpellSheet.creation_request_id=id(9135);
fakeSpellSheet.sheet.featGrantInstances=[];
fakeSpellSheet.sheet.feats=[];
fakeSpellSheet.sheet.classFeatureChoices={};
fakeSpellSheet.sheet.classFeatureChoiceSummary=[];
fakeSpellSheet.sheet.spells=["Fire Bolt"];
const rejectedSpellSheet=await call2(people.PLAYER.client,fakeSpellSheet);
assert.ok(rejectedSpellSheet.error,"Original deferred authority validator accepted spell summary without canonical class spell");
assert.match(rejectedSpellSheet.error.message,/spell summary must exactly match its validated starting spell assignments/i);
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9135)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE name='JWT false canonical spell summary'"),"0");
console.log("PASS J35 fake sheet spell summary without source-qualified class spell is rejected and transaction fully rolled back");

const correctMagic=wizard("JWT v3 canonical spell summary",id(9136));
correctMagic.sheet.spells=["Fire Bolt"];
const magicId=pass(await call3(people.OUTSIDER.client,correctMagic,spell(fire)),
 "original v3 with matching spell sheet summary");
assert.equal(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+magicId+"' AND source_type='class'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+magicId+"'"),"1");
assert.equal(pass(await call3(people.OUTSIDER.client,correctMagic,spell(fire)),"matching v3 nonce"),magicId);
assert.equal(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+magicId+"'"),"1");
console.log("PASS J36 source-original v3 and deferred spell-summary authority validator agree on actual Fire Bolt class spell; nonce inert");

const alteredMagicSummary=wizard("JWT v3 incorrect spell summary",id(9137));
alteredMagicSummary.sheet.spells=["Ray of Frost"];
const rejectedMagicSummary=await call3(people.OUTSIDER.client,alteredMagicSummary,spell(fire));
assert.ok(rejectedMagicSummary.error,"Original deferred authority validator accepted mismatched v3 spell summary");
assert.match(rejectedMagicSummary.error.message,/spell summary must exactly match its validated starting spell assignments/i);
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9137)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE name='JWT v3 incorrect spell summary'"),"0");
console.log("PASS J37 mismatched v3 class spell sheet summary vs canonical granted spell rejects with full source rollback");

const competingAuthority=JSON.parse(JSON.stringify(validAuthority));
competingAuthority.name="JWT concurrent source authority";
competingAuthority.creation_request_id=id(9138);
const bothAuthority=await Promise.all([
 call2(people.PLAYER.client,competingAuthority),
 call2(people.PLAYER.client,competingAuthority)
]);
const authorityRaceIds=bothAuthority.map((x,i)=>pass(x,"source-authority racing identical nonce "+i));
assert.equal(authorityRaceIds[0],authorityRaceIds[1]);
const one=authorityRaceIds[0];
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+one+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+one+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+one+"'"),"1");
const differentAuthority=JSON.parse(JSON.stringify(competingAuthority));
differentAuthority.sheet.feats=["Changed Feat"];
denied(await call2(people.PLAYER.client,differentAuthority),"22023",
 "Changed source feat summary on claimed nonce");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+one+"'"),"1");
console.log("PASS J38 two real concurrent canonical feat/gear JWT requests serialize to one event/item/currency; changed feat nonce rejected");
console.log("PASS LOCAL REAL GoTrue J00-J38: original progression authority validator, feat-instance/source-choice helpers and preferred views source-pinned, reduced catalog and RLS.");

// J39+: materializer/authority hooks now run in their original order after
// source-validated J31–J38. The new local tables reproduce the exact deployed
// columns, constraints and FK behavior, and have no browser grants or RLS
// policies. The Lucky specimen does not enter specialized downstream branches.
sqlFile("scripts/fixtures/forge_feat_materializer_local_auth_extension_pg17.sql");
const mintedPayload=JSON.parse(JSON.stringify(validAuthority));
mintedPayload.name="JWT original persistent Lucky";
mintedPayload.creation_request_id=id(9139);
mintedPayload.sheet.featGrantInstances[0].acquisitionOwnerType="background";
mintedPayload.sheet.featGrantInstances[0].acquisitionOwnerKey="soldier-xphb";
mintedPayload.sheet.featGrantInstances[0].acquisitionLabel="Soldier background";
const minted=pass(await call2(people.PLAYER.client,mintedPayload),
 "original materializer must persist source-owned Lucky grant instance");
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+minted+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_option_grants WHERE character_id='"+minted+"'"),"1");
const expectedSource=JSON.stringify({
 option_id:id(9154),name:"Lucky",type:"feat",source:"XPHB",instance:"origin-lucky-1",
 owner_type:"background",owner_key:"soldier-xphb",owner_label:"Soldier background",level:1,
 repeatable:false
});
const mintedInstance=sql("SELECT jsonb_build_object("+
 "'option_id',option_id,'name',option_name,'type',option_type,'source',option_source,"+
 "'instance',instance_key,'owner_type',acquisition_owner_type,'owner_key',acquisition_owner_key,"+
 "'owner_label',acquisition_label,'level',acquisition_level,'repeatable',repeatable,"+
 "'granted_by',granted_by)::text FROM public.character_option_grant_instances WHERE character_id='"+minted+"'");
const actualMinted=JSON.parse(mintedInstance);
const originalInstanceGrantActor=actualMinted.granted_by;
delete actualMinted.granted_by;
assert.deepEqual(actualMinted,JSON.parse(expectedSource),
 "Original grant materializer must persist canonical source/owner fields");
assert.equal(sql("SELECT created_by::text FROM public.character_progression WHERE character_id='"+minted+"'"),uid("PLAYER"),
 "Creation has a verified canonical progression owner at transaction end");
if(originalInstanceGrantActor!==null)
 assert.equal(originalInstanceGrantActor,uid("PLAYER"),"Non-null materializer provenance must belong to creator");
else
 console.log("SOURCE GAP J39: original AFTER INSERT materializer persisted grant instance with granted_by NULL although progression.created_by ultimately belongs to signed-in owner");
assert.equal(sql("SELECT option_id::text FROM public.character_option_grants WHERE character_id='"+minted+"'"),id(9154));
const originalAggregateGrantActor=sql("SELECT coalesce(granted_by::text,'') FROM public.character_option_grants WHERE character_id='"+minted+"'");
if(originalAggregateGrantActor!=="")
 assert.equal(originalAggregateGrantActor,uid("PLAYER"),"Non-null aggregate provenance must be creator");
else
 console.log("SOURCE GAP J39: original aggregate feat grant also has granted_by NULL");

assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+minted+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+minted+"'"),"1");
console.log("PASS J39 canonical feat instance + aggregate grant persisted and original actor-provenance gap observed separately");

const snapshotGrantInstance=sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(g) ORDER BY id)::text,'[]')) FROM public.character_option_grant_instances g WHERE character_id='"+minted+"'");
const snapshotGrant=sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(g) ORDER BY id)::text,'[]')) FROM public.character_option_grants g WHERE character_id='"+minted+"'");
const snapshotGear=sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(i) ORDER BY id)::text,'[]')) FROM public.inventory_items i WHERE owner_id='"+minted+"'");
assert.equal(pass(await call2(people.PLAYER.client,mintedPayload),"canonical feat immutable retry"),minted);
assert.equal(sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(g) ORDER BY id)::text,'[]')) FROM public.character_option_grant_instances g WHERE character_id='"+minted+"'"),snapshotGrantInstance);
assert.equal(sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(g) ORDER BY id)::text,'[]')) FROM public.character_option_grants g WHERE character_id='"+minted+"'"),snapshotGrant);
assert.equal(sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(i) ORDER BY id)::text,'[]')) FROM public.inventory_items i WHERE owner_id='"+minted+"'"),snapshotGear);
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+minted+"'"),"1");
console.log("PASS J40 identical nonce returns original canonical feat grants and gear with unchanged full row hashes");

const changedGrant=JSON.parse(JSON.stringify(mintedPayload));
changedGrant.sheet.featGrantInstances[0].acquisitionOwnerKey="other-background";
denied(await call2(people.PLAYER.client,changedGrant),"22023",
 "Source ownership changed on existing creation nonce");
assert.equal(sql("SELECT acquisition_owner_key FROM public.character_option_grant_instances WHERE character_id='"+minted+"'"),"soldier-xphb");
console.log("PASS J41 changed feat source owner under reused nonce rejects without grant mutation");

const duplicateInstance=JSON.parse(JSON.stringify(mintedPayload));
duplicateInstance.name="JWT duplicated instance key";
duplicateInstance.creation_request_id=id(9142);
duplicateInstance.sheet.featGrantInstances.push(JSON.parse(JSON.stringify(duplicateInstance.sheet.featGrantInstances[0])));
const baselineTotalGrants=sql("SELECT count(*) FROM public.character_option_grant_instances");
const duplicateResult=await call2(people.PLAYER.client,duplicateInstance);
assert.ok(duplicateResult.error,"Duplicate feat instanceId unexpectedly accepted");
assert.match(duplicateResult.error.message,/Duplicate feat or boon grant instance/i);
assert.equal(sql("SELECT count(*) FROM public.characters WHERE name='JWT duplicated instance key'"),"0");
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9142)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances"),baselineTotalGrants);
console.log("PASS J42 duplicate original feat instance key fails and rolls back character/nonce/canonical grant");

const malformedTokens=JSON.parse(JSON.stringify(mintedPayload));
malformedTokens.name="JWT invalid fixed spell tokens";
malformedTokens.creation_request_id=id(9143);
malformedTokens.sheet.featGrantInstances[0].fixedSpellTokens={invalid:true};
const beforeTokens=sql("SELECT count(*) FROM public.character_option_grants");
const badTokenResult=await call2(people.PLAYER.client,malformedTokens);
assert.ok(badTokenResult.error,"Original fixed_spell_tokens CHECK accepted object");
assert.equal(badTokenResult.error.code,"23514",
 "Original grant-instance table constraint should enforce fixed_spell_tokens array");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE name='JWT invalid fixed spell tokens'"),"0");
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9143)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.character_option_grants"),beforeTokens);
console.log("PASS J43 source-original materializer plus real grant table CHECK rejects malformed fixedSpellTokens with atomic rollback");

const repeatForbidden=JSON.parse(JSON.stringify(mintedPayload));
repeatForbidden.name="JWT duplicate nonrepeatable Lucky";
repeatForbidden.creation_request_id=id(9144);
repeatForbidden.sheet.featGrantInstances.push({
 ...repeatForbidden.sheet.featGrantInstances[0],instanceId:"origin-lucky-2"
});
const nonrepeatable=await call2(people.PLAYER.client,repeatForbidden);
assert.ok(nonrepeatable.error,"Same nonrepeatable feat with distinct instanceId was accepted");
assert.match(nonrepeatable.error.message,/not repeatable/i);
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9144)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE name='JWT duplicate nonrepeatable Lucky'"),"0");
console.log("PASS J44 canonical nonrepeatable option cannot be minted twice even with unique instance keys");

const concurrentGrantPayload=JSON.parse(JSON.stringify(mintedPayload));
concurrentGrantPayload.name="JWT simultaneous source feat grant";
concurrentGrantPayload.creation_request_id=id(9145);
const concurrentGrant=await Promise.all([
 call2(people.PLAYER.client,concurrentGrantPayload),
 call2(people.PLAYER.client,concurrentGrantPayload)
]);
const grantIds=concurrentGrant.map((x,i)=>pass(x,"two signed-in source grant creations "+i));
assert.equal(grantIds[0],grantIds[1]);
const grantRace=grantIds[0];
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+grantRace+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_option_grants WHERE character_id='"+grantRace+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+grantRace+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+grantRace+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+grantRace+"'"),"1");
console.log("PASS J45 concurrent signed-in identical nonce materializes one source-instance/grant/event/item/currency");

const independent=JSON.parse(JSON.stringify(mintedPayload));
independent.name="JWT independent Lucky owner";
independent.creation_request_id=id(9146);
const otherId=pass(await call2(people.OUTSIDER.client,independent),"other account same source feat");
assert.notEqual(otherId,minted);
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id IN ('"+minted+"','"+otherId+"')"),"2");
assert.equal(sql("SELECT count(*) FROM public.character_option_grants WHERE character_id IN ('"+minted+"','"+otherId+"')"),"2");
assert.equal(sql("SELECT created_by::text FROM public.character_progression WHERE character_id='"+otherId+"'"),uid("OUTSIDER"),"Second creator provenance must be preserved on progression");
const otherGrantActor=sql("SELECT coalesce(granted_by::text,'') FROM public.character_option_grant_instances WHERE character_id='"+otherId+"'");
if(otherGrantActor!=="") assert.equal(otherGrantActor,uid("OUTSIDER"),"Non-null second grant provenance mismatched owner");
assert.equal(sql("SELECT count(*) FROM public.character_permissions WHERE character_id='"+otherId+"' AND user_id='"+uid("OUTSIDER")+"' AND can_edit"),"1");
console.log("PASS J46 independent signed-in account owns distinct feat instance and aggregate grant without cross-character collision");

// The published Data API must not expose private canonical grant mutations
// just because the original privileged internal creation RPC can write them.
const deniedInstance=await people.PLAYER.client.from("character_option_grant_instances")
 .insert({character_id:minted,option_id:id(9154),option_name:"Lucky",instance_key:"intruder"})
 .select("id");
assert.ok(deniedInstance.error,"Authenticated direct canonical instance insert should be denied");
const deniedAggregate=await people.PLAYER.client.from("character_option_grants")
 .insert({character_id:minted,option_id:id(9154)})
 .select("id");
assert.ok(deniedAggregate.error,"Authenticated direct aggregate grant insert should be denied");
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+minted+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_option_grants WHERE character_id='"+minted+"'"),"1");
console.log("PASS J47 authenticated browser token cannot directly insert source grant tables in restricted local ACL/RLS");

// No feat instances means original materializer creates no synthetic grants,
// even when a normal class spell is assigned through original source v3.
const zeroFeatWizard=wizard("JWT no feat materialization",id(9148));
zeroFeatWizard.sheet.spells=["Fire Bolt"];
const zeroFeatId=pass(await call3(people.OUTSIDER.client,zeroFeatWizard,spell(fire)),
 "v3 source spell with no feat grant request");
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+zeroFeatId+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.character_option_grants WHERE character_id='"+zeroFeatId+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+zeroFeatId+"'"),"1");
console.log("PASS J48 exact original feat materializer adds no grant for no-feat source v3 Wizard");
console.log("PASS LOCAL REAL GoTrue J00-J48: source-original feat instance persistence and grant-table authority hooks; specialized feat families and full production trigger graph still untested.");

// J49+: separate UNAPPLIED grant-attribution repair candidate. Prior J39 source
// baseline MUST remain with its observed NULL granted_by; no historical repair.
// Identity comes only from the same-transaction immutable creator INSERT #321.
sqlFile("sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql");

const verifiedGrantPayload=JSON.parse(JSON.stringify(mintedPayload));
verifiedGrantPayload.name="JWT verified initial actor feat";
verifiedGrantPayload.creation_request_id=id(9149);
const verifiedGrantId=pass(await call2(people.PLAYER.client,verifiedGrantPayload),
 "authenticated source original v2 with BEFORE INSERT verified creator seed");
assert.equal(sql("SELECT created_by::text FROM public.character_progression WHERE character_id='"+verifiedGrantId+"'"),uid("PLAYER"));
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grant_instances WHERE character_id='"+verifiedGrantId+"'"),uid("PLAYER"));
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grants WHERE character_id='"+verifiedGrantId+"'"),uid("PLAYER"));
assert.equal(sql("SELECT creator_user_id::text FROM private.character_creator_attribution WHERE character_id='"+verifiedGrantId+"'"),uid("PLAYER"));
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+verifiedGrantId+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_option_grants WHERE character_id='"+verifiedGrantId+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+verifiedGrantId+"'"),"1");
console.log("PASS J49 verified original creator bound before progression INSERT; original immediate feat materializer now persists actor in BOTH canonical grant tables");

const grantFingerprint=(characterId)=>sql(
 "SELECT md5(coalesce(jsonb_agg(to_jsonb(g) ORDER BY id)::text,'[]')) FROM public.character_option_grant_instances g WHERE character_id='"+characterId+"'");
const aggFingerprint=(characterId)=>sql(
 "SELECT md5(coalesce(jsonb_agg(to_jsonb(g) ORDER BY id)::text,'[]')) FROM public.character_option_grants g WHERE character_id='"+characterId+"'");
const verifiedInstanceHash=grantFingerprint(verifiedGrantId);
const verifiedAggHash=aggFingerprint(verifiedGrantId);
assert.equal(pass(await call2(people.PLAYER.client,verifiedGrantPayload),"same signed creation request"),verifiedGrantId);
assert.equal(grantFingerprint(verifiedGrantId),verifiedInstanceHash);
assert.equal(aggFingerprint(verifiedGrantId),verifiedAggHash);
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+verifiedGrantId+"'"),"1");
console.log("PASS J50 signed-in identical nonce replay preserves attributed original source grants without edits");

const forgedOwnerIntent=JSON.parse(JSON.stringify(verifiedGrantPayload));
forgedOwnerIntent.sheet.featGrantInstances[0].acquisitionOwnerKey="forged-other-owner";
denied(await call2(people.PLAYER.client,forgedOwnerIntent),"22023","changed attributed feat creation intent");
assert.equal(grantFingerprint(verifiedGrantId),verifiedInstanceHash);
assert.equal(aggFingerprint(verifiedGrantId),verifiedAggHash);
console.log("PASS J51 reusing attributed nonce with changed grant source owner rejects; original actor/grants unchanged");

// Fresh player creation may omit a creation_request_id, as the held wrapper
// explicitly supports null nonce. The attribution guard must not rely on a
// reservation row to bind this source-authenticated new character.
const noNonceFeat=JSON.parse(JSON.stringify(mintedPayload));
noNonceFeat.name="JWT verified original actor no nonce";
delete noNonceFeat.creation_request_id;
const noNonceId=pass(await call2(people.PLAYER.client,noNonceFeat),
 "signed in new v2 character without a request nonce");
assert.equal(sql("SELECT creation_request_id IS NULL FROM public.characters WHERE id='"+noNonceId+"'"),"t");
assert.equal(sql("SELECT creator_user_id::text FROM private.character_creator_attribution WHERE character_id='"+noNonceId+"'"),uid("PLAYER"));
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grant_instances WHERE character_id='"+noNonceId+"'"),uid("PLAYER"));
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grants WHERE character_id='"+noNonceId+"'"),uid("PLAYER"));
console.log("PASS J52 original v2 new character with no nonce still binds source feat actor from same-transaction immutable creator record");

// Source v3 invokes the private original v2; verified feat actor should
// propagate without modifying any spell-selection/creation source function.
const sourcedWizardFeat=JSON.parse(JSON.stringify(correctMagic));
sourcedWizardFeat.name="JWT v3 Wizard source verified Lucky";
sourcedWizardFeat.creation_request_id=id(9163);
sourcedWizardFeat.sheet.featGrantInstances=JSON.parse(JSON.stringify(mintedPayload.sheet.featGrantInstances));
sourcedWizardFeat.sheet.feats=["Lucky"];
const wizardWithFeat=pass(await call3(people.OUTSIDER.client,sourcedWizardFeat,spell(fire)),
 "signed v3 Wizard source spell and feat grant with actor seed");
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grant_instances WHERE character_id='"+wizardWithFeat+"'"),uid("OUTSIDER"));
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grants WHERE character_id='"+wizardWithFeat+"'"),uid("OUTSIDER"));
assert.equal(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+wizardWithFeat+"' AND source_type='class'"),"1");
assert.equal(pass(await call3(people.OUTSIDER.client,sourcedWizardFeat,spell(fire)),
 "signed v3 feat replay"),wizardWithFeat);
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+wizardWithFeat+"'"),"1");
console.log("PASS J53 original source v3 magic + canonical feat both retain signed creator and inert immutable retry");

const raceVerified=JSON.parse(JSON.stringify(mintedPayload));
raceVerified.name="JWT racing verified feat creator";
raceVerified.creation_request_id=id(9164);
const sameTime=await Promise.all([
 call2(people.PLAYER.client,raceVerified),
 call2(people.PLAYER.client,raceVerified)
]);
const sameTimeIds=sameTime.map((v,i)=>pass(v,"verified creator same-nonce race "+i));
assert.equal(sameTimeIds[0],sameTimeIds[1]);
const winnerId=sameTimeIds[0];
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grant_instances WHERE character_id='"+winnerId+"'"),uid("PLAYER"));
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grants WHERE character_id='"+winnerId+"'"),uid("PLAYER"));
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+winnerId+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_option_grants WHERE character_id='"+winnerId+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+winnerId+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+winnerId+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+winnerId+"'"),"1");
console.log("PASS J54 true JWT concurrent same nonce mints one correctly attributed feat grant/event/item/currency");

const failedCreatorPayload=JSON.parse(JSON.stringify(mintedPayload));
failedCreatorPayload.name="JWT malformed after creator seed";
failedCreatorPayload.creation_request_id=id(9165);
failedCreatorPayload.sheet.featGrantInstances[0].fixedSpellTokens={invalid:true};
const badCreator=await call2(people.PLAYER.client,failedCreatorPayload);
assert.ok(badCreator.error,"Invalid feat grant table shape accepted after actor seed");
assert.equal(badCreator.error.code,"23514","Grant JSONB constraint must still reject malformed shape");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE name='JWT malformed after creator seed'"),"0");
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9165)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM private.character_creator_attribution ca JOIN public.characters c ON c.id=ca.character_id WHERE c.name='JWT malformed after creator seed'"),"0");
console.log("PASS J55 invalid feat grant after binding actor rolls back original character, creator attribution, nonce and canonical grant");

const independentVerified=JSON.parse(JSON.stringify(mintedPayload));
independentVerified.name="JWT independent verified source owner";
independentVerified.creation_request_id=id(9166);
const otherOwner=pass(await call2(people.OUTSIDER.client,independentVerified),
 "another real JWT creates distinct feat and actor binding");
assert.notEqual(otherOwner,verifiedGrantId);
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grant_instances WHERE character_id='"+otherOwner+"'"),uid("OUTSIDER"));
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grants WHERE character_id='"+otherOwner+"'"),uid("OUTSIDER"));
assert.equal(sql("SELECT creator_user_id::text FROM private.character_creator_attribution WHERE character_id='"+otherOwner+"'"),uid("OUTSIDER"));
console.log("PASS J56 distinct real JWT identity produces separate correctly attributed original feat grant");

const gmAfterSeedPayload={
 name:"JWT GM NPC creator seed unaffected",kind:"npc",creation_request_id:id(9167),
 sheet:{classKey:"fighter",level:1,note:"Admin NPC sheet no Forge marker"}
};
const gmAfterSeed=pass(await rpc(people.ADMIN.client,"create_character_v1",
 {p_payload:gmAfterSeedPayload}),"Admin NPC original RPC after Forge-only creator binding");
assert.equal(sql("SELECT creator_user_id::text FROM private.character_creator_attribution WHERE character_id='"+gmAfterSeed+"'"),uid("ADMIN"));
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+gmAfterSeed+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.character_option_grants WHERE character_id='"+gmAfterSeed+"'"),"0");
console.log("PASS J57 original Admin NPC creation remains separate from player-Forge-only attribution and grant rules");

// Old NULL grant rows must NEVER be backfilled by the new BEFORE INSERT trigger
// or by later creation, even when the original progression row has an actor.
assert.equal(sql("SELECT coalesce(granted_by::text,'') FROM public.character_option_grant_instances WHERE character_id='"+minted+"'"),"");
assert.equal(sql("SELECT coalesce(granted_by::text,'') FROM public.character_option_grants WHERE character_id='"+minted+"'"),"");
assert.equal(sql("SELECT created_by::text FROM public.character_progression WHERE character_id='"+minted+"'"),uid("PLAYER"));
console.log("PASS J58 existing original-source NULL grant provenance remains untouched, no historical data backfill");

sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id='"+verifiedGrantId+"' AND user_id='"+uid("PLAYER")+"'");
denied(await call2(people.PLAYER.client,verifiedGrantPayload),"42501",
 "Existing cached nonce cannot be reread by creator with revoked editor grant");
assert.equal(grantFingerprint(verifiedGrantId),verifiedInstanceHash);
assert.equal(aggFingerprint(verifiedGrantId),verifiedAggHash);
console.log("PASS J59 revoking current edit grant does not rewrite provenance and blocks same-nonce replay");

// A current coeditor can safely edit an ordinary note, but can neither alter
// protected feat instance fields nor impersonate the original actor.
sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert) VALUES('"+otherOwner+"','"+uid("PLAYER")+"',true,true,false)");
const otherOriginalSheet=JSON.parse(sql("SELECT sheet::text FROM public.character_sheets WHERE character_id='"+otherOwner+"'"));
const coeditorNote=await sheetWrite(people.PLAYER.client,otherOwner,
 {...otherOriginalSheet,note:"Coeditor ordinary journal, not source grants"});
assert.ifError(coeditorNote.error);
assert.equal(coeditorNote.data?.length,1);
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grant_instances WHERE character_id='"+otherOwner+"'"),uid("OUTSIDER"));
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grants WHERE character_id='"+otherOwner+"'"),uid("OUTSIDER"));
const forgedCoedit={...otherOriginalSheet,featGrantInstances:[
 {...otherOriginalSheet.featGrantInstances[0],instanceId:"coeditor-false-instance"}]};
denied(await sheetWrite(people.PLAYER.client,otherOwner,forgedCoedit),"42501",
 "Coeditor cannot rewrite original feat authority after verified creator binding");
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+otherOwner+"'"),"1");
console.log("PASS J60 signed-in coeditor note cannot overwrite verified creator grant attribution or protected source choices");

// A privileged service-side SQL transaction has no verified auth.uid().
// Even a Forge-like marker MUST NOT invent a creator attribution. This is an
// explicitly local SUPERUSER service simulation, NOT a true JWT actor call.
const noAuthServiceCharacter=id(9171);
const forgedServiceSql="BEGIN; INSERT INTO public.characters(id,name,tags,kind) VALUES('"+noAuthServiceCharacter+"','JWT local service Forge marker with no auth uid',ARRAY['player-character']::text[],'npc'); "+
 "INSERT INTO public.character_sheets(character_id,sheet) VALUES('"+noAuthServiceCharacter+"',"+
 "'{\"classKey\":\"fighter\",\"level\":1,\"meta\":{\"creator\":\"shared_character_forge_player_v2\"}}'::jsonb); COMMIT;";
const rejectedService=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",forgedServiceSql],
 {env:{...e,PGUSER:"postgres"},encoding:"utf8",timeout:20000});
assert.notEqual(rejectedService.status,0,
 "Original source should reject Forge-marked service character with no owner");
assert.match(rejectedService.stderr,/Starting equipment could not resolve the owning user/i,
 "Unexpected original source failure for unauthenticated Forge materializer");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE id='"+noAuthServiceCharacter+"'"),"0");
assert.equal(sql("SELECT count(*) FROM private.character_creator_attribution WHERE character_id='"+noAuthServiceCharacter+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.character_progression WHERE character_id='"+noAuthServiceCharacter+"'"),"0");

// A genuine service-like NPC has no Forge marker, and should remain separate
// and unattributed. The fixture runs as localhost superuser, NOT a forged JWT.
const plainServiceNPC=id(9173);
sql("BEGIN; INSERT INTO public.characters(id,name,tags,kind) VALUES('"+plainServiceNPC+"','JWT local service plain NPC',ARRAY[]::text[],'npc'); "+
 "INSERT INTO public.character_sheets(character_id,sheet) VALUES('"+plainServiceNPC+"',"+
 "'{\"classKey\":\"fighter\",\"level\":1,\"note\":\"service NPC not Forge\"}'::jsonb); COMMIT;");
assert.equal(sql("SELECT count(*) FROM private.character_creator_attribution WHERE character_id='"+plainServiceNPC+"'"),"0");
assert.equal(sql("SELECT coalesce(created_by::text,'') FROM public.character_progression WHERE character_id='"+plainServiceNPC+"'"),"");
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+plainServiceNPC+"'"),"0");
console.log("PASS J61 original unauthenticated Forge-like service creation rejects atomically; genuine service NPC remains unattributed");

// User-controlled creator_user_id is ignored by the original player v2 RPC,
// while the new progression seed reads only immutable private provenance.
const spoofedCreator=JSON.parse(JSON.stringify(mintedPayload));
spoofedCreator.name="JWT forged top-level creator ignored";
spoofedCreator.creation_request_id=id(9172);
spoofedCreator.creator_user_id=uid("OUTSIDER");
const spoofedCharacter=pass(await call2(people.PLAYER.client,spoofedCreator),
 "forged caller-supplied creator_user_id ignored by original source v2");
assert.equal(sql("SELECT creator_user_id::text FROM private.character_creator_attribution WHERE character_id='"+spoofedCharacter+"'"),uid("PLAYER"));
assert.equal(sql("SELECT created_by::text FROM public.character_progression WHERE character_id='"+spoofedCharacter+"'"),uid("PLAYER"));
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grant_instances WHERE character_id='"+spoofedCharacter+"'"),uid("PLAYER"));
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grants WHERE character_id='"+spoofedCharacter+"'"),uid("PLAYER"));
console.log("PASS J62 signed-in player forged creator_user_id cannot impersonate another actor in immutable or grant provenance");

console.log("PASS LOCAL REAL GoTrue J00-J62: original source gap then isolated verified creator BEFORE INSERT candidate; local service and payload-forgery denials; full production lock and RLS acceptance still open.");





