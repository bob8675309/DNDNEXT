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

