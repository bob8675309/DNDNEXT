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

// J63–J69: source-original G feat + deferred I equipment already created
// by true signed-in Forge v2; now exercise competing real JWT source equipment
// CP→CS and ordinary editor CS→CP with test-only timed prelocks.
// This is NOT full live G-row write contention or all original 31 triggers.
sqlFile("scripts/fixtures/forge_gi_cp_cs_local_jwt_race_pg17.sql");
const giChar=otherOwner,giCreator=people.OUTSIDER,giEditor=people.PLAYER;
const giGranted=sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+giChar+"'");
const giAggregate=sql("SELECT count(*) FROM public.character_option_grants WHERE character_id='"+giChar+"'");
const giInventory=sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character' AND owner_id='"+giChar+"'");
const giCurrency=sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+giChar+"'");
assert.deepEqual([giGranted,giAggregate,giInventory,giCurrency],["1","1","1","1"],
 "Source original creation must have stored one feat G instance/aggregate and one inventory I/currency");
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grant_instances WHERE character_id='"+giChar+"'"),uid("OUTSIDER"));
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grants WHERE character_id='"+giChar+"'"),uid("OUTSIDER"));
assert.equal(sql("SELECT updated_by::text FROM public.character_currency WHERE character_id='"+giChar+"'"),uid("OUTSIDER"));
const rowFingerprint=(table,condition)=>sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM "+table+" t WHERE "+condition);
const giInstBefore=grantFingerprint(giChar),giAggBefore=aggFingerprint(giChar);
const giInvBefore=rowFingerprint("public.inventory_items","owner_id='"+giChar+"'");
const giCashBefore=sql("SELECT md5(to_jsonb(c)::text) FROM public.character_currency c WHERE character_id='"+giChar+"'");
console.log("PASS J63 same signed Forge character has canonical original G instance+aggregate, deferred I item+currency and verified original actor provenance");

const deniedGear=await rpc(people.ADMIN.client,"test_forge_gear_cp_prelock_v1",{p_character_id:giChar});
assert.ok(deniedGear.error,"Unrelated signed-in ADMIN without current can_edit must not run test-only gear wrapper");
assert.equal(deniedGear.error.code,"42501");
const deniedNote=await rpc(people.ADMIN.client,"test_forge_sheet_note_hold_v1",
 {p_character_id:giChar,p_note:"unrelated JWT should never write"});
assert.ok(deniedNote.error,"Unrelated signed-in JWT cannot run test-only sheet updater");
assert.equal(deniedNote.error.code,"42501");
assert.equal(giInstBefore,grantFingerprint(giChar));
assert.equal(giInvBefore,rowFingerprint("public.inventory_items","owner_id='"+giChar+"'"));
console.log("PASS J64 test-only G/I source and sheet adapters reject unrelated real JWT without modifying grants or inventory");

// Force a deterministic real PostgreSQL 40P01 with original deployed gear
// helper (CP then CS) and original deployed AFTER sheet UPDATE sync (CS then CP).
// The explicit CP prelock / advisory marker / sleeps are TEST-ONLY.
const gearInFlight=giCreator.client.rpc("test_forge_gear_cp_prelock_v1",
 {p_character_id:giChar}).then(x=>x);
await pause(65); // let the lazy PostgREST HTTP request actually start
let sawGearCP=false;
const deadlineGI=Date.now()+5200;
while(Date.now()<deadlineGI){
 if(sql("SELECT count(*) FROM pg_locks WHERE locktype='advisory'"+
 " AND classid='9360'::oid AND objid='1'::oid AND granted='t'")==="1"){
   sawGearCP=true;break;
 }
 await pause(90);
}
assert.ok(sawGearCP,"Authenticated source-gear transaction did not publish its test-only CP lock");
const noteInFlight=giEditor.client.rpc("test_forge_sheet_note_hold_v1",
 {p_character_id:giChar,p_note:"two-user tested G/I race"}).then(x=>x);
const giRace=await Promise.all([gearInFlight,noteInFlight]);
const giVictims=giRace.filter(r=>r.error);
assert.equal(giVictims.length,1,
 "Expected one 40P01 victim for actual original CP→CS equipment vs CS→CP sheet sync: "+JSON.stringify(giRace));
assert.equal(giVictims[0].error.code,"40P01",
 "Original G/I source race failure was not a PostgreSQL deadlock: "+JSON.stringify(giRace));
assert.equal(giRace.filter(r=>!r.error).length,1);
console.log("PASS J65 original deferred gear helper CP→CS versus real coeditor CS→CP: genuine signed-in 40P01 with synthetic prelock; exactly one victim");

assert.equal(grantFingerprint(giChar),giInstBefore);
assert.equal(aggFingerprint(giChar),giAggBefore);
assert.equal(rowFingerprint("public.inventory_items","owner_id='"+giChar+"'"),giInvBefore);
assert.equal(sql("SELECT md5(to_jsonb(c)::text) FROM public.character_currency c WHERE character_id='"+giChar+"'"),giCashBefore);
assert.deepEqual([
 sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+giChar+"'"),
 sql("SELECT count(*) FROM public.character_option_grants WHERE character_id='"+giChar+"'"),
 sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+giChar+"'"),
 sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+giChar+"'")
],["1","1","1","1"]);
console.log("PASS J66 original source G and I rows remain byte-identical after aborted concurrent transaction; no duplicate item, currency or canonical grant");

const recoveryNote=await rpc(giEditor.client,"test_forge_sheet_note_hold_v1",
 {p_character_id:giChar,p_note:"retry completed with one canonical G/I grant"});
assert.ifError(recoveryNote.error);
assert.equal(sql("SELECT sheet->>'note' FROM public.character_sheets WHERE character_id='"+giChar+"'"),
 "retry completed with one canonical G/I grant");
const recoveryGear=await rpc(giCreator.client,"test_forge_gear_cp_prelock_v1",
 {p_character_id:giChar});
assert.ifError(recoveryGear.error);
assert.equal(recoveryGear.data?.applied,false,
 "Original equipment helper must be inert after materialized currency marker");
assert.equal(grantFingerprint(giChar),giInstBefore);
assert.equal(aggFingerprint(giChar),giAggBefore);
assert.equal(rowFingerprint("public.inventory_items","owner_id='"+giChar+"'"),giInvBefore);
assert.equal(sql("SELECT md5(to_jsonb(c)::text) FROM public.character_currency c WHERE character_id='"+giChar+"'"),giCashBefore);
console.log("PASS J67 both signed-in operations retry successfully, original equipment guard prevents duplicate grants/items/currency");

sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id='"+giChar+"' AND user_id='"+uid("PLAYER")+"'");
const revokedNote=await rpc(giEditor.client,"test_forge_sheet_note_hold_v1",
 {p_character_id:giChar,p_note:"revoked test author"});
assert.ok(revokedNote.error,"Revoked signed-in coeditor note should be rejected");
assert.equal(revokedNote.error.code,"42501");
const revokedGear=await rpc(giEditor.client,"test_forge_gear_cp_prelock_v1",{p_character_id:giChar});
assert.ok(revokedGear.error,"Revoked signed-in coeditor cannot prelock original gear");
assert.equal(revokedGear.error.code,"42501");
assert.equal(grantFingerprint(giChar),giInstBefore);
assert.equal(rowFingerprint("public.inventory_items","owner_id='"+giChar+"'"),giInvBefore);
console.log("PASS J68 current coeditor revocation blocks new CP/CS operations without altering original G/I materialized state");

const giReplay=pass(await call2(giCreator.client,independentVerified),
 "original immutable player Forge creation nonce replay after G/I race and editor note");
assert.equal(giReplay,giChar);
assert.equal(grantFingerprint(giChar),giInstBefore);
assert.equal(aggFingerprint(giChar),giAggBefore);
assert.equal(rowFingerprint("public.inventory_items","owner_id='"+giChar+"'"),giInvBefore);
assert.equal(sql("SELECT md5(to_jsonb(c)::text) FROM public.character_currency c WHERE character_id='"+giChar+"'"),giCashBefore);
console.log("PASS J69 original creation nonce replay after authenticated G/I concurrency remains one immutable character/grant/item/currency");

// J70–J77: for the first time in this research suite, concurrent real
// signed-in requests ACTUALLY WRITE inventory I, merchant stock and wallets.
// This source-original shop RPC is distinct from level-up and Forge starting
// equipment; feat grant G rows remain stable controls, NOT concurrent G writes.
sqlFile("scripts/fixtures/forge_merchant_inventory_live_writer_local_auth_pg17.sql");
assert.equal(sql("SELECT md5(pg_get_functiondef("+
 "'public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))"),
 "1dbe8c24c4c718396d7256f6f7465354");
const shop=id(9361),singleStock=id(9362),pairStock=id(9363),failureStock=id(9364);
sql("INSERT INTO public.characters(id,name,kind,storefront_enabled) VALUES"+
 "('"+shop+"','Local source writer seller','merchant',true);"+
 "INSERT INTO public.character_stock(id,character_id,qty,display_name,card_payload,price_gp,item_id) VALUES"+
 "('"+singleStock+"','"+shop+"',1,'Scratch Dagger','{\"item_type\":\"weapon\",\"item_rarity\":\"mundane\"}'::jsonb,5,'p13-inventory-concurrency-dagger'),"+
 "('"+pairStock+"','"+shop+"',2,'Scratch Rope','{\"item_type\":\"gear\",\"item_rarity\":\"mundane\"}'::jsonb,5,'p13-inventory-concurrency-rope'),"+
 "('"+failureStock+"','"+shop+"',1,'Scratch Lantern','{\"item_type\":\"gear\",\"item_rarity\":\"mundane\"}'::jsonb,5,'p13-inventory-concurrency-lantern');"+
 "INSERT INTO public.player_wallets(user_id,gp) VALUES"+
 "('"+uid("PLAYER")+"',20),('"+uid("OUTSIDER")+"',20)");
const buy=(who,stockId,qty)=>who.client.rpc("buy_from_merchant",{
 p_merchant_id:shop,p_stock_uuid:stockId,p_qty:qty
}).then(x=>x);
const soldCount=(item)=>sql("SELECT count(*) FROM public.inventory_items"+
 " WHERE item_id='"+item+"' AND owner_type='player'");
const wallet=(who)=>sql("SELECT gp::text FROM public.player_wallets WHERE user_id='"+uid(who)+"'");
console.log("PASS J70 source-original buy_from_merchant compiled and hash-matched live PG17; three bounded stock rows and two authenticated buyer wallets provisioned");

const guest=makeClient();
const guestPurchase=await rpc(guest,"buy_from_merchant",{
 p_merchant_id:shop,p_stock_uuid:singleStock,p_qty:1
});
assert.ok(guestPurchase.error,"Anonymous merchant purchase should be denied");
assert.equal(guestPurchase.error.code,"42501");
assert.equal(sql("SELECT qty FROM public.character_stock WHERE id='"+singleStock+"'"),"1");
assert.equal(soldCount("p13-inventory-concurrency-dagger"),"0");
console.log("PASS J71 unauthenticated buy RPC denied with untouched original stock and inventory");

sql("UPDATE public.player_wallets SET gp=0 WHERE user_id='"+uid("OUTSIDER")+"'");
const insufficient=await buy(people.OUTSIDER,failureStock,1);
assert.ok(insufficient.error,"Insufficient wallet funds accepted by original merchant RPC");
assert.match(insufficient.error.message,/Insufficient funds/i);
assert.equal(sql("SELECT qty FROM public.character_stock WHERE id='"+failureStock+"'"),"1");
assert.equal(soldCount("p13-inventory-concurrency-lantern"),"0");
assert.equal(wallet("OUTSIDER"),"0");
sql("UPDATE public.player_wallets SET gp=20 WHERE user_id='"+uid("OUTSIDER")+"'");
console.log("PASS J72 real signed-in insufficient wallet raises error and rolls back original stock/I/wallet changes");

const oneRace=await Promise.all([
 buy(people.PLAYER,singleStock,1),buy(people.OUTSIDER,singleStock,1)
]);
const oneWinner=oneRace.filter(x=>!x.error),oneLoser=oneRace.filter(x=>x.error);
assert.equal(oneWinner.length,1,
 "Concurrent original stock qty=1 must have one sale: "+JSON.stringify(oneRace));
assert.equal(oneWinner[0].data,1);
assert.equal(oneLoser.length,1);
assert.match(oneLoser[0].error.message,/Stock not found|Not enough stock/i);
assert.equal(sql("SELECT count(*) FROM public.character_stock WHERE id='"+singleStock+"'"),"0");
assert.equal(soldCount("p13-inventory-concurrency-dagger"),"1");
assert.equal(Number(wallet("PLAYER"))+Number(wallet("OUTSIDER")),35);
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE item_id='p13-inventory-concurrency-dagger'"+
 " AND user_id in ('"+uid("PLAYER")+"','"+uid("OUTSIDER")+"')"),"1");
console.log("PASS J73 two truly concurrent signed-in original stock FOR UPDATE buyers produce exactly one wallet debit and one actual inventory I INSERT for last unit");

const lastReplay=await buy(people.PLAYER,singleStock,1);
assert.ok(lastReplay.error,"Depleted stock could be repurchased");
assert.match(lastReplay.error.message,/Stock not found/i);
assert.equal(soldCount("p13-inventory-concurrency-dagger"),"1");
assert.equal(Number(wallet("PLAYER"))+Number(wallet("OUTSIDER")),35);
console.log("PASS J74 repeated request for deleted original stock does not create an extra item or debit another wallet");

const twoRace=await Promise.all([
 buy(people.PLAYER,pairStock,1),buy(people.OUTSIDER,pairStock,1)
]);
for(const result of twoRace){assert.ifError(result.error);assert.equal(result.data,1);}
assert.equal(sql("SELECT count(*) FROM public.character_stock WHERE id='"+pairStock+"'"),"0");
assert.equal(soldCount("p13-inventory-concurrency-rope"),"2");
assert.equal(Number(wallet("PLAYER"))+Number(wallet("OUTSIDER")),25);
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE item_id='p13-inventory-concurrency-rope'"+
 " AND user_id='"+uid("PLAYER")+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE item_id='p13-inventory-concurrency-rope'"+
 " AND user_id='"+uid("OUTSIDER")+"'"),"1");
console.log("PASS J75 two concurrent signed-in original inventory writes for qty=2 sell one each, conserve stock and debit exactly two wallets");

const overBuy=await buy(people.PLAYER,failureStock,2);
assert.ok(overBuy.error,"Overstock request unexpectedly succeeded");
assert.match(overBuy.error.message,/Not enough stock/i);
assert.equal(sql("SELECT qty FROM public.character_stock WHERE id='"+failureStock+"'"),"1");
assert.equal(soldCount("p13-inventory-concurrency-lantern"),"0");
assert.equal(Number(wallet("PLAYER"))+Number(wallet("OUTSIDER")),25);
const afterBad=await buy(people.OUTSIDER,failureStock,1);
assert.ifError(afterBad.error);assert.equal(afterBad.data,1);
assert.equal(soldCount("p13-inventory-concurrency-lantern"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_stock WHERE id='"+failureStock+"'"),"0");
assert.equal(Number(wallet("PLAYER"))+Number(wallet("OUTSIDER")),20);
console.log("PASS J76 original stock quantity rejection rolls back safely and next valid signed buyer completes with conserved inventory and wallet");

assert.equal(grantFingerprint(giChar),giInstBefore);
assert.equal(aggFingerprint(giChar),giAggBefore);
assert.equal(rowFingerprint("public.inventory_items","owner_id='"+giChar+"'"),giInvBefore);
assert.equal(sql("SELECT md5(to_jsonb(c)::text) FROM public.character_currency c WHERE character_id='"+giChar+"'"),giCashBefore);
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='player'"+
 " AND item_id like 'p13-inventory-concurrency-%'"),"4");
assert.equal(sql("SELECT count(*) FROM public.character_stock WHERE character_id='"+shop+"'"),"0");
console.log("PASS J77 real JWT original merchant inventory I stock/wallet writes preserve separate canonical Forge G/I/currency snapshots; 4 items sold, zero leftover stock, exact total debit");

console.log("PASS LOCAL REAL GoTrue J00-J77: source-original Forge G/I under controlled CP-CS 40P01, plus actual original merchant stock FOR UPDATE and inventory INSERT in competing real JWT transactions. Direct G-row concurrency and global lock order still unproven.");










// J78–J84: source-authenticated original Forge CREATE + deferred COMMIT with
// *both* live inventory owner-type CHECKs and both original inventory triggers.
// This is an actual creation-RPC proof, not an isolated direct table insert.
// Removing the old check is done ONLY on the throwaway local PG17 database.
sqlFile("scripts/fixtures/forge_owner_constraint_deferred_creation_local_auth_pg17.sql");
assert.equal(sql("SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass"
  +" AND conname='inventory_items_owner_type_chk' AND NOT convalidated"),"1");
assert.ok(Number(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character'"))>=1,
 "Existing character-owned equipment J12-J77 was unexpectedly lost");
console.log("PASS J78 both original inventory crafting triggers and contradictory live owner-type constraints loaded after existing char-owned rows");

// A known-good original v2 Forge payload from J49/J54 creates BOTH source
// Lucky grant (G/GI) and character-owned equipment (I) + currency (C).
const blockedOwnerCreate=JSON.parse(JSON.stringify(verifiedGrantPayload));
blockedOwnerCreate.name="J79 blocked original Forge feat and gear";
blockedOwnerCreate.creation_request_id=id(9380);
const stateCounts=()=>sql("SELECT jsonb_build_object("
 +"'characters',(SELECT count(*) FROM public.characters),"
 +"'creator',(SELECT count(*) FROM private.character_creator_attribution),"
 +"'intents',(SELECT count(*) FROM private.player_creation_intent_reservations_v1),"
 +"'sheets',(SELECT count(*) FROM public.character_sheets),"
 +"'progression',(SELECT count(*) FROM public.character_progression),"
 +"'events',(SELECT count(*) FROM public.character_level_events),"
 +"'grant_instances',(SELECT count(*) FROM public.character_option_grant_instances),"
 +"'grants',(SELECT count(*) FROM public.character_option_grants),"
 +"'inventory',(SELECT count(*) FROM public.inventory_items),"
 +"'currency',(SELECT count(*) FROM public.character_currency))::text");
const blockedBefore=stateCounts();
const blockedOld=await call2(people.PLAYER.client,blockedOwnerCreate);
denied(blockedOld,"23514","Exact source-original deferred Forge character-owned I blocked at COMMIT");
assert.match(blockedOld.error.message||"",/inventory_items_owner_type_chk/,
 "Expected OLD NOT VALID CHECK, not a different deferred failure");
assert.equal(stateCounts(),blockedBefore,"Deferred 23514 did not fully roll back original creation, nonce, feat grants, item and currency");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE name='J79 blocked original Forge feat and gear'"),"0");
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9380)+"'"),"0");
console.log("PASS J79 real signed original v2 feat+gear CREATE fails 23514 at deferred materialization COMMIT with exact obsolete CHECK; all creator/nonce/CS/CP/G/GI/I/C rolled back");

// Scope control: original source Admin NPC creation is not Player Forge and
// never requests character-owned starting inventory. Earlier J57 proves this
// RPC already works with the full held creator/feat triggers. An unselected
// Forge package is INVALID, so DO NOT use it as a false positive control.
const gmNoGearPayload={
 name:"J80 valid non-Forge GM NPC with old CHECK",kind:"npc",
 creation_request_id:id(9381),
 sheet:{classKey:"fighter",level:1,note:"J80 NPC source control, no Forge marker"}
};
const gmNoGear=pass(await rpc(people.ADMIN.client,"create_character_v1",{
 p_payload:gmNoGearPayload
}),"Source-original GM NPC creation with contradictory old inventory CHECK");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+gmNoGear+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+gmNoGear+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+gmNoGear+"'"),"0");
assert.equal(sql("SELECT creator_user_id::text FROM private.character_creator_attribution WHERE character_id='"+gmNoGear+"'"),uid("ADMIN"));
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9381)+"'"),"0");
console.log("PASS J80 source-authenticated Admin non-Forge NPC creation still commits with contradictory old CHECK; no I/C or source player-grants involved");

// Explicit TEST-ONLY schema control: temporarily drop just the obsolete
// constraint on disposable PG17, rerun THE SAME genuine JWT failed nonce.
// The original creator, materializer, grant writers, handlers stay unchanged.
sql("ALTER TABLE public.inventory_items DROP CONSTRAINT inventory_items_owner_type_chk");
assert.equal(sql("SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass"
 +" AND conname='inventory_items_owner_type_chk'"),"0");
const recoveredOwner=pass(await call2(people.PLAYER.client,blockedOwnerCreate),
 "Exactly same originally failed nonce, now source-exact Forge commit");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character' AND owner_id='"+recoveredOwner+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+recoveredOwner+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+recoveredOwner+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_option_grants WHERE character_id='"+recoveredOwner+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+recoveredOwner+"'"),"1");
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grant_instances WHERE character_id='"+recoveredOwner+"'"),uid("PLAYER"));
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grants WHERE character_id='"+recoveredOwner+"'"),uid("PLAYER"));
assert.equal(sql("SELECT updated_by::text FROM public.character_currency WHERE character_id='"+recoveredOwner+"'"),uid("PLAYER"));
assert.equal(sql("SELECT user_id::text FROM public.inventory_items WHERE owner_type='character' AND owner_id='"+recoveredOwner+"'"),uid("PLAYER"));
assert.equal(sql("SELECT sheet->'startingEquipmentSummary'->0->>'itemKey' FROM public.character_sheets WHERE character_id='"+recoveredOwner+"'"),"training-dagger");
console.log("PASS J81 dropping ONLY old owner CHECK in disposable PG17 allows original authenticated Forge feat G/GI and deferred character-owned I/C COMMIT with actor provenance");

// Original immutable replay must remain inert after recovery; altered request
// must reject without new materialization or changed sheet/provenance.
const recoveredInvHash=rowFingerprint("public.inventory_items","owner_id='"+recoveredOwner+"'");
const recoveredGrantHash=grantFingerprint(recoveredOwner);
const recoveredAggHash=aggFingerprint(recoveredOwner);
const recoveredCurrencyHash=sql("SELECT md5(to_jsonb(c)::text) FROM public.character_currency c WHERE character_id='"+recoveredOwner+"'");
assert.equal(pass(await call2(people.PLAYER.client,blockedOwnerCreate),
 "Identical nonce after scratch-only original Forge recovery"),recoveredOwner);
denied(await call2(people.PLAYER.client,{
 ...blockedOwnerCreate,name:"J82 changed original nonce after recovered Forge create"
}),"22023","Changing original request intent after successful recovery");
assert.equal(rowFingerprint("public.inventory_items","owner_id='"+recoveredOwner+"'"),recoveredInvHash);
assert.equal(grantFingerprint(recoveredOwner),recoveredGrantHash);
assert.equal(aggFingerprint(recoveredOwner),recoveredAggHash);
assert.equal(sql("SELECT md5(to_jsonb(c)::text) FROM public.character_currency c WHERE character_id='"+recoveredOwner+"'"),recoveredCurrencyHash);
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+recoveredOwner+"'"),"1");
console.log("PASS J82 same original nonce inert and changed intent rejected after scratch-control fix, no duplicated grants/items/currency");

// Restore live-style overlapping NOT VALID constraint in scratch even though
// historical rows include character-owned items. NOT VALID is not DISABLED.
sql("ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_owner_type_chk"
 +" CHECK ((owner_type = ANY (ARRAY['player'::text,'npc'::text,'merchant'::text]))) NOT VALID");
assert.equal(sql("SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass"
 +" AND conname='inventory_items_owner_type_chk' AND NOT convalidated"),"1");
const blockedAgain=JSON.parse(JSON.stringify(blockedOwnerCreate));
blockedAgain.name="J83 restored obsolete CHECK rejects new Forge I";
blockedAgain.creation_request_id=id(9383);
const restoredBaseline=stateCounts();
const blockedAgainResult=await call2(people.OUTSIDER.client,blockedAgain);
denied(blockedAgainResult,"23514","Restored old CHECK blocks independent signed creator too");
assert.match(blockedAgainResult.error.message||"",/inventory_items_owner_type_chk/);
assert.equal(stateCounts(),restoredBaseline);
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9383)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE name='J83 restored obsolete CHECK rejects new Forge I'"),"0");
assert.equal(rowFingerprint("public.inventory_items","owner_id='"+recoveredOwner+"'"),recoveredInvHash);
assert.equal(grantFingerprint(recoveredOwner),recoveredGrantHash);
assert.equal(aggFingerprint(recoveredOwner),recoveredAggHash);
console.log("PASS J83 restored NOT VALID check rejects NEW signed original Forge equipment again, old character-owned rows persist; rollback all aggregates and nonce");

// Confirm exact parity is restored for the final disposable research snapshot.
assert.equal(sql("SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass"
 +" AND conname='inventory_items_owner_type_check' AND convalidated"),"1");
assert.equal(sql("SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass"
 +" AND conname='inventory_items_owner_type_chk' AND NOT convalidated"),"1");
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.inventory_items'::regclass"
 +" AND NOT tgisinternal AND tgname IN ('inventory_items_apply_structured_crafting_traits_v1','zz_inventory_items_apply_smithing_affinity_polish_v4')"),"2");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.materialize_player_forge_starting_equipment_v1(uuid)'::regprocedure))"),"653e1b9d7cc47dcff2cef33a674b97f4");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+recoveredOwner+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character' AND owner_id='"+recoveredOwner+"'"),"1");
console.log("PASS J84 original Forge J79 23514 is causally attributable to obsolete owner CHECK; scratch-only reversible schema control, original deferred/G+I source remains unchanged; production NEVER mutated");
console.log("PASS LOCAL REAL GoTrue J00-J84: original JWT Forge creation / real deferred COMMIT / immutable replay, source inventory handler parity, and legacy NOT VALID owner CHECK bug proven in disposable PG17 (limited trigger/RLS coverage; no production fix).");



// J85–J93 review-only inventory ownership release security gates.
// The SOURCE owner CHECK bug is established in J78–J84. Now replay the actual
// live inventory RLS role predicates with real GoTrue JWTs before/after a
// combined RLS+constraint candidate, still in DISPOSABLE PG17 only.
sqlFile("scripts/fixtures/forge_inventory_policy_source_local_auth_pg17.sql");
const invApi=(who)=>who.client.from("inventory_items");
const invFixture=(key, ownerType, ownerId, userId)=>({
 item_id:key,item_name:key,item_type:"gear",item_rarity:"mundane",
 card_payload:{},owner_type:ownerType,owner_id:ownerId,user_id:userId
});
const beforeDirect=sql("SELECT count(*) FROM public.inventory_items WHERE item_id LIKE 'p13-j8%-test-%'");
assert.equal(beforeDirect,"0");
console.log("PASS J85 four source-live inventory RLS policies and genuine authenticated direct-DML grants installed in isolated GoTrue PG17");

const forgedKey="p13-j86-test-forged-foreign-character";
const forgedPayload=invFixture(forgedKey,"character",otherOwner,uid("PLAYER"));
const originalBlocked=await invApi(people.PLAYER).insert(forgedPayload).select("id");
assert.ok(originalBlocked.error,"Old live CHECK must still block forged character owner before scratch removal");
assert.equal(originalBlocked.error.code,"23514");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE item_id='"+forgedKey+"'"),"0");
sql("ALTER TABLE public.inventory_items DROP CONSTRAINT inventory_items_owner_type_chk");
const newDirect=await invApi(people.PLAYER).insert(forgedPayload).select("id");
assert.ifError(newDirect.error);
assert.equal(newDirect.data?.length,1);
const illegalCharRow=newDirect.data[0].id;
assert.equal(sql("SELECT owner_id FROM public.inventory_items WHERE id='"+illegalCharRow+"'"),otherOwner);
assert.equal(sql("SELECT user_id::text FROM public.inventory_items WHERE id='"+illegalCharRow+"'"),uid("PLAYER"));
console.log("PASS J86 UNMODIFIED live-style direct INSERT RLS permits signed user to mint item owned by an unrelated character once obsolete CHECK removed; original source gap reproduced in disposable PG17");

// Verify BOTH INSERT and UPDATE routes need protection. This fresh item is
// player-owned and available to the signed-in owner before candidate change.
const playerTestKey="p13-j87-test-original-player-item";
const playerTest=await invApi(people.PLAYER).insert(
 invFixture(playerTestKey,"player",uid("PLAYER"),uid("PLAYER"))).select("id");
assert.ifError(playerTest.error);
assert.equal(playerTest.data?.length,1);
const playerItem=playerTest.data[0].id;
const uncheckedConvert=await invApi(people.PLAYER).update({
 owner_type:"character",owner_id:otherOwner
}).eq("id",playerItem).select("id");
assert.ifError(uncheckedConvert.error);
assert.equal(uncheckedConvert.data?.length,1);
assert.equal(sql("SELECT owner_type FROM public.inventory_items WHERE id='"+playerItem+"'"),"character");
console.log("PASS J87 pre-candidate source UPDATE policy also allows user-owned I -> unrelated character-owned I laundering, independent of direct INSERT");

// Remove only test-created unauthorized rows, then restore exact live checks
// before applying the review candidate. All production records are untouched.
sql("DELETE FROM public.inventory_items WHERE id IN ('"+illegalCharRow+"','"+playerItem+"')");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE item_id LIKE 'p13-j8%-test-%'"),"0");
sql("ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_owner_type_chk"
 +" CHECK ((owner_type = ANY (ARRAY['player'::text,'npc'::text,'merchant'::text]))) NOT VALID");
assert.equal(sql("SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass"
 +" AND conname='inventory_items_owner_type_chk' AND NOT convalidated"),"1");
sqlFile("sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql");
assert.equal(sql("SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass"
 +" AND conname='inventory_items_owner_type_chk'"),"0");
assert.equal(sql("SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass"
 +" AND conname='inventory_items_owner_type_check' AND convalidated"),"1");
assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),"4");
console.log("PASS J88 guarded single-transaction review-only candidate updates all four RLS policies and drops only old CHECK; newer validated CHECK remains intact");

// Direct client attempts can no longer create or launder a character item.
const directForbidden=await invApi(people.PLAYER).insert(forgedPayload).select("id");
assert.ok(directForbidden.error,"Hardened RLS allowed direct forged character item INSERT");
assert.equal(directForbidden.error.code,"42501");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE item_id='"+forgedKey+"'"),"0");
const legitimate=await invApi(people.PLAYER).insert(
 invFixture(playerTestKey,"player",uid("PLAYER"),uid("PLAYER"))).select("id");
assert.ifError(legitimate.error);
const playerItemAfter=legitimate.data[0].id;
const blockedConversion=await invApi(people.PLAYER).update({
 owner_type:"character",owner_id:otherOwner
}).eq("id",playerItemAfter).select("id");
assert.ok(blockedConversion.error,"Hardened RLS allowed player->character UPDATE");
assert.equal(blockedConversion.error.code,"42501");
assert.equal(sql("SELECT owner_type FROM public.inventory_items WHERE id='"+playerItemAfter+"'"),"player");
console.log("PASS J89 hardened four-policy candidate blocks real signed non-admin direct character-owned I INSERT and player->character UPDATE without altering legitimate player row");

// Unmodified original privileged creation + deferred equipment materializer
// must STILL work, proving hardening does not break authoritative Forge.
const secureForge=JSON.parse(JSON.stringify(verifiedGrantPayload));
secureForge.name="J90 source original Forge under DML RLS hardening";
secureForge.creation_request_id=id(9390);
const secureCharacter=pass(await call2(people.PLAYER.client,secureForge),
 "original authentic source Forge feat and deferred gear after inventory DML RLS hardening");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character' AND owner_id='"+secureCharacter+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+secureCharacter+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+secureCharacter+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_option_grants WHERE character_id='"+secureCharacter+"'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+secureCharacter+"'"),"1");
assert.equal(sql("SELECT granted_by::text FROM public.character_option_grants WHERE character_id='"+secureCharacter+"'"),uid("PLAYER"));
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE character_id='"+secureCharacter+"'"),"1");
assert.equal(pass(await call2(people.PLAYER.client,secureForge),
 "same source nonce under hardened inventory policy"),secureCharacter);
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+secureCharacter+"'"),"1");
console.log("PASS J90 unchanged privileged source Forge player feat+deferred I/C creation and nonce replay work with all four hardened direct-table RLS policies");

// Direct char-owned UPDATE/DELETE require source-authorized RPC or Admin:
// non-admin client cannot change its ownership to player or delete it.
const secureItemId=sql("SELECT id::text FROM public.inventory_items WHERE owner_type='character' AND owner_id='"+secureCharacter+"'");
const stolen=await invApi(people.PLAYER).update({
 owner_type:"player",owner_id:uid("PLAYER")
}).eq("id",secureItemId).select("id");
assert.ifError(stolen.error); // zero selected when UPDATE USING denies source row
assert.equal(stolen.data?.length,0);
const discarded=await invApi(people.PLAYER).delete().eq("id",secureItemId).select("id");
assert.ifError(discarded.error);
assert.equal(discarded.data?.length,0);
assert.equal(sql("SELECT owner_type FROM public.inventory_items WHERE id='"+secureItemId+"'"),"character");
const visibleBefore=await invApi(people.PLAYER).select("id").eq("id",secureItemId);
assert.ifError(visibleBefore.error);
assert.equal(visibleBefore.data?.length,1,"Original current owner must see char item before revoked");
sql("UPDATE public.character_permissions SET can_edit=false,can_inventory=false"
 +" WHERE character_id='"+secureCharacter+"' AND user_id='"+uid("PLAYER")+"'");
const revokedInventory=await invApi(people.PLAYER).select("id").eq("id",secureItemId);
assert.ifError(revokedInventory.error);
assert.equal(revokedInventory.data?.length,0,"Revoked original creator can still read private character inventory directly");
sql("UPDATE public.character_permissions SET can_inventory=true"
 +" WHERE character_id='"+secureCharacter+"' AND user_id='"+uid("PLAYER")+"'");
const visibleAgain=await invApi(people.PLAYER).select("id").eq("id",secureItemId);
assert.ifError(visibleAgain.error);
assert.equal(visibleAgain.data?.length,1);
console.log("PASS J91 signed user cannot launder/delete character I; original source current inventory permission revocation immediately hides char I and subsequent authorized access works");

// Existing ordinary player-owned direct CRUD remains functional after RLS
// patch and its ownership remains the signed-in user's own account.
const playerPatch=await invApi(people.PLAYER).update({
 item_name:"p13-j92-test-player-updated"
}).eq("id",playerItemAfter).select("id");
assert.ifError(playerPatch.error);assert.equal(playerPatch.data?.length,1);
const normalDelete=await invApi(people.PLAYER).delete()
 .eq("id",playerItemAfter).select("id");
assert.ifError(normalDelete.error);assert.equal(normalDelete.data?.length,1);
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE id='"+playerItemAfter+"'"),"0");
const anonymousAttempt=await invApi({client:makeClient()}).insert(
 invFixture("p13-j92-test-unsigned","player",uid("PLAYER"),uid("PLAYER"))).select("id");
assert.ok(anonymousAttempt.error,"Anonymous inventory insert bypassed role");
console.log("PASS J92 real signed owner can still direct create/modify/delete own player-owned item; anonymous write denied");

// GM/Admin direct CHARACTER assignment remains allowed by the *existing*
// Admin predicate, an explicit operator authority preserved by this candidate.
const adminAssigned=await invApi(people.ADMIN).insert(invFixture(
 "p13-j93-test-admin-character-assign","character",otherOwner,null)).select("id");
assert.ifError(adminAssigned.error);
assert.equal(adminAssigned.data?.length,1);
const gmDirectId=adminAssigned.data[0].id;
assert.equal(sql("SELECT owner_type FROM public.inventory_items WHERE id='"+gmDirectId+"'"),"character");
assert.equal(sql("SELECT user_id IS NULL FROM public.inventory_items WHERE id='"+gmDirectId+"'"),"t");
sql("DELETE FROM public.inventory_items WHERE id='"+gmDirectId+"'");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE item_id LIKE 'p13-j8%-test-%'"),"0");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.materialize_player_forge_starting_equipment_v1(uuid)'::regprocedure))"),"653e1b9d7cc47dcff2cef33a674b97f4");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.can_access_character_v1(uuid,text)'::regprocedure))"),"97b5e6b059e6467e24c4283fe420c83e");
assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),"4");
console.log("PASS J93 original Admin direct character assignment still allowed; exact original source functions intact, no additional privileges/policies/table writes retained");
console.log("PASS LOCAL REAL GoTrue J00-J93: owner CHECK 23514 causal fix plus signed-in original RLS security gap and four-policy review candidate in disposable PG17. Full UI / original 31 triggers / production release remain PENDING.");



// J94–J102: Source-qualified browser-compatible v3 Fighter starting-market
// selections through unchanged original v3->v2 and deferred source equipment.
// The live XPHB Fighter startingEquipment cash option C (15500 copper) and
// live helper functions are loaded AFTER the J85–J93 hardened RLS acceptance.
sqlFile("scripts/fixtures/forge_v3_market_source_local_auth_extension_pg17.sql");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.player_forge_cash_equipment_option_v1(jsonb)'::regprocedure))"),"78231b02e56477cedd90992e42826597");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.format_copper_currency_v1(bigint)'::regprocedure))"),"f7f8dce93e3d20a5c35fccee0bcf374b");
console.log("PASS J94 original XPHB Fighter 155-gp cash option, source currency formatter and valid v3 source market fixture installed");
const marketMerchant=id(9490),marketStock=id(9491),excessiveStock=id(9492),recipeStock=id(9493);
sql("INSERT INTO public.characters(id,name,kind,storefront_enabled) VALUES"
 + "('"+marketMerchant+"','J94 original market merchant','merchant',true);"
 + "INSERT INTO public.character_stock(id,character_id,qty,display_name,card_payload,price_gp,item_id) VALUES"
 + "('"+marketStock+"','"+marketMerchant+"',3,'J94 Source Market Rope','{\"item_type\":\"gear\",\"item_rarity\":\"mundane\"}'::jsonb,9,'p13-market-rope'),"
 + "('"+excessiveStock+"','"+marketMerchant+"',1,'J94 Source Market Armor','{\"item_type\":\"armor\",\"item_rarity\":\"mundane\"}'::jsonb,350,'p13-market-armor'),"
 + "('"+recipeStock+"','"+marketMerchant+"',1,'J94 Forbidden Recipe','{\"item_type\":\"recipe\",\"item_rarity\":\"mundane\"}'::jsonb,2,'p13-market-recipe');");
const marketDraft=(name,nonce,stockId,qty=1,ruleset="dndnext-homebrew")=>{
 const draft=fighter(name,nonce);
 // Source-original deferred validator requires the selected Background name,
 // source and ID, identical to the verified J17 XPHB Soldier specimen.
 draft.sheet.background="Soldier";
 draft.sheet.meta={backgroundSource:"XPHB"};
 draft.sheet.startingEquipmentSelections={
  mode:"market",ruleset,backgroundId:id(9150),marketMerchantId:marketMerchant,
  marketPurchases:[{
   merchantId:marketMerchant,stockId,qty,
   itemId:stockId===marketStock?"p13-market-rope":"p13-market-armor",
   priceGp:stockId===marketStock?9:350
  }],keepStartingGold:false
 };
 return draft;
};
const v3market=(payload,who=people.PLAYER)=>call3(who.client,payload,[]);
const getStock=n=>sql("SELECT coalesce((SELECT qty::text FROM public.character_stock WHERE id='"+n+"'),'0')");
const marketGood=marketDraft("J95 true source v3 earned market gear",id(9495),marketStock,2);
const marketGoodCharacter=pass(await v3market(marketGood),"signed v3 market purchase");
assert.equal(getStock(marketStock),"1","Source-original market materializer did not reserve exactly two stock units");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character' AND owner_id='"+marketGoodCharacter+"'"),"1");
assert.equal(sql("SELECT quantity FROM public.inventory_items WHERE owner_id='"+marketGoodCharacter+"'"),"2");
assert.equal(sql("SELECT card_payload->>'startingMarket' FROM public.inventory_items WHERE owner_id='"+marketGoodCharacter+"'"),"true");
assert.equal(sql("SELECT card_payload->>'stock_id' FROM public.inventory_items WHERE owner_id='"+marketGoodCharacter+"'"),marketStock);
assert.equal(sql("SELECT copper_value FROM public.character_currency WHERE character_id='"+marketGoodCharacter+"'"),"28200");
assert.equal(sql("SELECT source_breakdown->>'classMarketCopper' FROM public.character_currency WHERE character_id='"+marketGoodCharacter+"'"),"15500");
assert.equal(sql("SELECT source_breakdown->>'marketBudgetCopper' FROM public.character_currency WHERE character_id='"+marketGoodCharacter+"'"),"30000");
assert.equal(sql("SELECT source_breakdown->>'marketSpentCopper' FROM public.character_currency WHERE character_id='"+marketGoodCharacter+"'"),"1800");
assert.equal(sql("SELECT sheet->'startingEquipmentSummary'->0->>'scope' FROM public.character_sheets WHERE character_id='"+marketGoodCharacter+"'"),"market");
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE character_id='"+marketGoodCharacter+"'"),"1");
console.log("PASS J95 signed original v3 starting market commits 2 source items as ONE character-owned I quantity, stock 3->1, 300gp homebrew budget less 18gp, correct sheet/ledger/nonce");

const stockAfterMarket=getStock(marketStock);
const marketInvBefore=rowFingerprint("public.inventory_items","owner_id='"+marketGoodCharacter+"'");
const marketCurrencyBefore=sql("SELECT md5(to_jsonb(c)::text) FROM public.character_currency c WHERE character_id='"+marketGoodCharacter+"'");
assert.equal(pass(await v3market(marketGood),"v3 original market identical replay"),marketGoodCharacter);
assert.equal(getStock(marketStock),stockAfterMarket);
assert.equal(rowFingerprint("public.inventory_items","owner_id='"+marketGoodCharacter+"'"),marketInvBefore);
assert.equal(sql("SELECT md5(to_jsonb(c)::text) FROM public.character_currency c WHERE character_id='"+marketGoodCharacter+"'"),marketCurrencyBefore);
denied(await v3market({...marketGood,name:"J96 changed market nonce"}),"22023","Market changed intent with same nonce");
console.log("PASS J96 original v3 market identical nonce is inert on S/I/C, mutated original intent rejects 22023");

const failMarket=(name,nonce,purchase)=>marketDraft(name,id(nonce),purchase.stockId||marketStock,purchase.qty||1,purchase.ruleset||"dndnext-homebrew");
const untouchedCounts=()=>sql("SELECT jsonb_build_object('characters',(SELECT count(*) FROM public.characters),'nonce',(SELECT count(*) FROM private.player_creation_intent_reservations_v1),'inventory',(SELECT count(*) FROM public.inventory_items),'currency',(SELECT count(*) FROM public.character_currency),'stock',(SELECT coalesce(sum(qty),0) FROM public.character_stock))::text");
const badStock=failMarket("J97 invalid source-stock",9497,{stockId:marketStock,qty:1});
badStock.sheet.startingEquipmentSelections.marketPurchases[0].stockId=id(9497);
const beforeInvalid=untouchedCounts();
const invalidResult=await v3market(badStock);
assert.ok(invalidResult.error);assert.match(invalidResult.error.message||"",/no longer sold by that merchant/i);
assert.equal(untouchedCounts(),beforeInvalid);
assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id='"+id(9497)+"'"),"0");
console.log("PASS J97 v3 source invalid merchant/stock rejects at deferred COMMIT and atomically rolls back creator/nonce/I/C and market S");

const overMarket=marketDraft("J98 oversell source market",id(9498),marketStock,2);
const beforeOversell=untouchedCounts();
const oversell=await v3market(overMarket);
assert.ok(oversell.error);assert.match(oversell.error.message||"",/Not enough stock remains/i);
assert.equal(untouchedCounts(),beforeOversell);
assert.equal(getStock(marketStock),"1");
console.log("PASS J98 original v3 stock oversell rejects with zero new reservations, items or currency");

const expensiveMarket=marketDraft("J99 over-budget homebrew",id(9499),excessiveStock,1);
const beforeBudget=untouchedCounts();
const expensive=await v3market(expensiveMarket);
assert.ok(expensive.error);assert.match(expensive.error.message||"",/exceed.*starting budget/i);
assert.equal(untouchedCounts(),beforeBudget);
assert.equal(getStock(excessiveStock),"1");
console.log("PASS J99 original source 350gp homebrew shopping exceeds 300gp budget; stock/items/nonce rolled back");

const recipeMarket=marketDraft("J100 source recipe rejection",id(9500),recipeStock,1);
const beforeRecipe=untouchedCounts();
const recipe=await v3market(recipeMarket);
assert.ok(recipe.error);assert.match(recipe.error.message||"",/Recipes are not starting-equipment purchases/i);
assert.equal(untouchedCounts(),beforeRecipe);
console.log("PASS J100 original Forge market source refuses recipe stock and leaves all inventories/currency/nonce unchanged");

const vanillaExpensive=marketDraft("J101 XPHB vanilla cash budget",id(9501),excessiveStock,1,"vanilla");
const beforeVanilla=untouchedCounts();
const vanilla=await v3market(vanillaExpensive);
assert.ok(vanilla.error);assert.match(vanilla.error.message||"",/exceed.*starting budget/i);
assert.equal(untouchedCounts(),beforeVanilla);
console.log("PASS J101 source-qualified XPHB vanilla 155gp cash alternative rejects 350gp market purchase, unchanged all canonical writes");

// Merchant user-owned purchases still use original source writer after
// character ownership RLS changes and source-original v3 market consumption.
sql("INSERT INTO public.player_wallets(user_id,gp) VALUES('"+uid("PLAYER")+"',20)"
 +" ON CONFLICT(user_id) DO UPDATE SET gp=EXCLUDED.gp;");
const merchantBuy=await rpc(people.PLAYER.client,"buy_from_merchant",{
 p_merchant_id:marketMerchant,p_stock_uuid:marketStock,p_qty:1
});
assert.ifError(merchantBuy.error);
assert.equal(merchantBuy.data,1);
assert.equal(getStock(marketStock),"0");
assert.equal(sql("SELECT gp FROM public.player_wallets WHERE user_id='"+uid("PLAYER")+"'"),"11");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='player' AND item_id='p13-market-rope' AND user_id='"+uid("PLAYER")+"'"),"1");
assert.equal(rowFingerprint("public.inventory_items","owner_id='"+marketGoodCharacter+"'"),marketInvBefore);
console.log("PASS J102 signed original merchant purchase consumes remaining stock into user-owned inventory; source v3 market character-owned gear unchanged");
console.log("PASS LOCAL REAL GoTrue J00-J102: v3 source-equivalent starting market + actual S/I/C and negative controls under four-policy candidate; full original triggers/browser still NOT accepted.");
