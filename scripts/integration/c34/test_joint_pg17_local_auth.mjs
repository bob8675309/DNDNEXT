#!/usr/bin/env node
// C34: genuine signed GoTrue/PostgREST + PostgreSQL 17 in a DISPOSABLE CI DB.
// Runs AFTER unchanged #351 I1C original suite (full Story/nonce), then joins
// the original materializer and inventory CHECK/RLS research candidate.
// This is a bounded source-original trigger subset, NOT the full 31-trigger graph.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const env = process.env;
for (const [key,value] of Object.entries({
  CI:"true", GITHUB_ACTIONS:"true",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  PGHOST:"127.0.0.1", PGPORT:"54322", PGDATABASE:"postgres",
  PGUSER:"postgres",
})) assert.equal(env[key],value,"Unsafe environment for signed C34 test: "+key);
assert.match(env.DNDNEXT_C34_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
const makeClient=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
function psql(args) {
  const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",...args],{
    env,encoding:"utf8",timeout:35000
  });
  assert.equal(r.status,0,"C34 disposable SQL failed: "+(r.stderr||"").slice(-1900));
  return r.stdout.trim();
}
const sql=(q)=>psql(["-qAt","-c",q]);
const sqlFile=(p)=>psql(["-q","-f",p]);
const one=(table,where)=>Number(sql("SELECT count(*) FROM "+table+" WHERE "+where));
const quote=(id)=>{assert.match(id,/^[a-f0-9-]{36}$/i);return "'"+id+"'";};
async function signed(label) {
  const client=makeClient(),email="c34-"+label+"-"+randomUUID()+"@example.invalid";
  const password="C34-"+randomUUID()+"!";
  assert.ifError((await client.auth.signUp({email,password})).error);
  assert.ifError((await client.auth.signInWithPassword({email,password})).error);
  const user=await client.auth.getUser(),jwt=await client.auth.getClaims();
  assert.ifError(user.error);
  assert.ifError(jwt.error);
  assert.equal(jwt.data.claims.sub,user.data.user.id);
  assert.equal(jwt.data.claims.role,"authenticated");
  return {id:user.data.user.id,client};
}
async function read(actor,whereId) {
  const r=await actor.client.from("inventory_items").select("id,owner_type,owner_id,user_id")
    .eq("id",whereId);
  assert.ifError(r.error);
  return r.data;
}
function rejected(r,label,code) {
  assert.ok(r.error,label+" should have been blocked");
  if(code) assert.equal(r.error.code,code,label+" SQLSTATE mismatch");
  return r.error;
}
const fighter=(id,name)=>({
  creation_request_id:id,name,secret:null,
  sheet:{classKey:"fighter",level:1,marker:"C34_SOURCE_EQUIPMENT_AFTER_INVENTORY_RLS",
    startingEquipmentSelections:{mode:"package",ruleset:"vanilla",classOption:"A",choices:{}}}
});
const rpc=async(actor,name,args)=>actor.client.rpc(name,args);
const nonceCountBefore=Number(sql(
 "SELECT count(*) FROM private.player_creation_intent_reservations_v1"
));
assert.ok(nonceCountBefore>=1,"Original I1C signed Story/nonces must already have run");
assert.equal(sql("SELECT to_regclass('private.character_creator_attribution') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regclass('public.inventory_items') IS NULL"),"t");

sqlFile("scripts/integration/c34/c34_inventory_materializer_setup_pg17.sql");
const holder=await signed("inventory-holder");
const stale=await signed("stale-owner");
const outsider=await signed("outsider");
const admin=await signed("admin");
sql("INSERT INTO private.test_admins(id) VALUES("+quote(admin.id)+")");
const characterId=randomUUID(),staleItem=randomUUID(),holderItem=randomUUID(),stockId=randomUUID();
sql("INSERT INTO public.characters(id,name,kind,is_hidden,secret) VALUES("+
 quote(characterId)+",'C34 synthetic original inventory NPC','npc',false,'C34_GM_SECRET_STAYS_PRIVATE')");
sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert) VALUES("+
 quote(characterId)+","+quote(holder.id)+",true,false,false)");
sql("INSERT INTO public.character_stock(id,character_id,qty,display_name,card_payload,price_gp,item_id) VALUES("+
 quote(stockId)+","+quote(characterId)+",2,'C34 preserved original stock','{}'::jsonb,1,'training-dagger')");
const insertHistorical=(itemId,userId,label)=>sql(
 "INSERT INTO public.inventory_items(id,user_id,owner_type,owner_id,item_name,card_payload,quantity) VALUES("+
 quote(itemId)+","+quote(userId)+",'character',"+quote(characterId)+
 ",'"+label+"','{}'::jsonb,1)"
);
insertHistorical(staleItem,stale.id,"C34 legacy stale owner");
insertHistorical(holderItem,holder.id,"C34 valid inventory holder");
assert.equal(one("public.inventory_items","owner_type='character'"),2);

sqlFile("scripts/integration/c34/c34_inventory_original_policy_baseline_pg17.sql");
const legacy=await read(stale,staleItem);
assert.equal(legacy.length,1,"RED: historical owner policy improperly reveals character item to revoked/unrelated user");
assert.equal((await read(holder,holderItem)).length,1);
assert.equal((await read(outsider,staleItem)).length,0);
const insertOld=await stale.client.from("inventory_items").insert({
  user_id:stale.id,owner_type:"character",owner_id:characterId,
  item_name:"C34 blocked by legacy NOT VALID check",quantity:1,card_payload:{}
});
rejected(insertOld,"historical owner_type_chk rejects a NEW character item","23514");
assert.equal(one("public.inventory_items","owner_type='character'"),2);
console.log("PASS C34-RED01: real signed stale owner READ leaks prior character item; old NOT VALID CHECK blocks new character items");

const digestBefore=sql("SELECT md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'')) FROM public.character_stock x");
const originalForgeWrapper=sql("SELECT md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))");
sqlFile("sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql");
assert.equal(one("pg_constraint","conrelid='public.inventory_items'::regclass AND conname='inventory_items_owner_type_chk'"),0);
assert.equal(one("pg_constraint","conrelid='public.inventory_items'::regclass AND conname='inventory_items_owner_type_check' AND convalidated"),1);
assert.equal(one("pg_policy","polrelid='public.inventory_items'::regclass"),4);
assert.equal((await read(stale,staleItem)).length,0,
  "GREEN: stale row owner lacking character rights must not read item");
assert.equal((await read(holder,holderItem)).length,1,
  "GREEN: inventory-only assigned actor retains read access to own character item");
assert.equal((await read(outsider,holderItem)).length,0);
assert.equal((await read(admin,staleItem)).length,1,
  "GREEN: GM Admin still reads pre-existing inventory");
console.log("PASS C34-GREEN01: original inventory RLS denies stale owner and outsider; permits assigned inventory-only holder and Admin");

const forgedUpdate=await stale.client.from("inventory_items")
  .update({owner_type:"player",owner_id:stale.id})
  .eq("id",staleItem).select("id");
assert.ifError(forgedUpdate.error);
assert.equal(forgedUpdate.data.length,0,"stale owner cannot launder character item to player item");
const forbiddenUpdate=await holder.client.from("inventory_items")
  .update({item_name:"C34 forged character edit"}).eq("id",holderItem).select("id");
assert.ifError(forbiddenUpdate.error);
assert.equal(forbiddenUpdate.data.length,0,"inventory-only user cannot direct-edit character item");
const forbiddenDelete=await holder.client.from("inventory_items")
  .delete().eq("id",holderItem).select("id");
assert.ifError(forbiddenDelete.error);
assert.equal(forbiddenDelete.data.length,0,"inventory-only user cannot delete character item");
const forgedInsert=await holder.client.from("inventory_items").insert({
  user_id:holder.id,owner_type:"character",owner_id:characterId,
  item_name:"C34 direct forge item",quantity:1,card_payload:{}
});
rejected(forgedInsert,"non-Admin direct character item insert denied","42501");
assert.equal(one("public.inventory_items","id="+quote(holderItem)),1);
assert.equal(one("public.inventory_items","id="+quote(staleItem)),1);
console.log("PASS C34-GREEN02: no direct non-Admin character INSERT/UPDATE/DELETE or owner-type laundering");

const allowedPlayerItem=await holder.client.from("inventory_items").insert({
 user_id:holder.id,owner_type:"player",owner_id:holder.id,
 item_name:"C34 original personal item",quantity:1,card_payload:{}
}).select("id").single();
assert.ifError(allowedPlayerItem.error);
assert.ok(allowedPlayerItem.data.id,"original player-owned inventory writes must survive");
const allowedAdminItem=await admin.client.from("inventory_items").insert({
 user_id:stale.id,owner_type:"character",owner_id:characterId,
 item_name:"C34 Admin character item",quantity:1,card_payload:{}
}).select("id").single();
assert.ifError(allowedAdminItem.error);
assert.ok(allowedAdminItem.data.id,"original Admin character inventory writes must survive");
console.log("PASS C34-GREEN03: normal personal inventory and Admin character item insertion retained");

const safeProfile=await stale.client.rpc("get_npc_profile_visible_v1",{
  p_character_id:characterId
});
assert.ifError(safeProfile.error);
assert.equal(safeProfile.data?.name,"C34 synthetic original inventory NPC");
assert.ok(!JSON.stringify(safeProfile.data).includes("C34_GM_SECRET_STAYS_PRIVATE"),
  "visible player-safe Profile must never read original GM-only secret");
const deniedDossier=await stale.client.rpc("get_npc_dossier_admin_v1",{
  p_character_id:characterId
});
rejected(deniedDossier,"non-GM dossier access","42501");
const gmDossier=await admin.client.rpc("get_npc_dossier_admin_v1",{
  p_character_id:characterId
});
assert.ifError(gmDossier.error);
assert.equal(gmDossier.data.secret,"C34_GM_SECRET_STAYS_PRIVATE",
  "original GM-only dossier remains available to Admin");
const publishedClue="C34 only GM-published clue is visible";
const revealed=await admin.client.from("character_public_secret_revelations").insert({
  character_id:characterId,public_text:publishedClue,is_revealed:true
}).select("character_id").single();
assert.ifError(revealed.error);
assert.equal(revealed.data.character_id,characterId);
const publicProfile=await stale.client.rpc("get_npc_profile_visible_v1",{
  p_character_id:characterId
});
assert.ifError(publicProfile.error);
assert.equal(publicProfile.data?.lore?.secret,publishedClue);
assert.ok(!JSON.stringify(publicProfile.data).includes("C34_GM_SECRET_STAYS_PRIVATE"));
const forgedClue=await stale.client.from("character_public_secret_revelations")
  .update({public_text:"C34 forged outsider clue"})
  .eq("character_id",characterId).select("character_id");
assert.ok(forgedClue.error || forgedClue.data?.length===0,
 "non-GM authenticated user cannot publish or overwrite GM clues");
assert.equal(sql("SELECT public_text FROM public.character_public_secret_revelations WHERE character_id="+quote(characterId)),
 publishedClue);
const anonymous=makeClient();
const anonProfile=await anonymous.rpc("get_npc_profile_visible_v1",{
  p_character_id:characterId
});
assert.ok(anonProfile.error,"anonymous role cannot call protected NPC Profile");
const anonItems=await anonymous.from("inventory_items").select("id").eq("id",holderItem);
assert.ok(anonItems.error,"anonymous role has no inventory table SELECT");
console.log("PASS C34-GREEN05: safe NPC Profile, Admin-only dossier, GM-published clue, outsider/anon denial retain separation");
const selectedSourceTriggers=Number(sql(
  "SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ("+
  "'characters_capture_creator_at_insert_v1','characters_guard_player_gm_secret_at_insert_v1',"+
  "'character_progression_materialize_player_forge_starting_equipme',"+
  "'sync_character_progression_from_sheet_v1',"+
  "'inventory_items_apply_structured_crafting_traits_v1',"+
  "'zz_inventory_items_apply_smithing_affinity_polish_v4')"
));
assert.equal(selectedSourceTriggers,6,
 "C34 must prove four original production triggers plus two HELD NPC privacy triggers");
console.log("PASS C34-GREEN06: 4/31 original deployed Forge triggers + 2 proposed NPC privacy triggers co-reside; no 31/31 claim");


// Demonstrate the narrow preserved #319 nonempty historical account snapshot,
// while #324 Forge writes the real canonical per-character character_sheets.
const preservedAccount='{"c34_legacy_sheet_frozen":true,"source":"ORIGINAL_NONEMPTY"}';
sql("INSERT INTO public.players(user_id,name,sheet) VALUES("+
 quote(holder.id)+",'C34 test player','"+preservedAccount+"'::jsonb)");
const freshNonce=randomUUID(),payload=fighter(freshNonce,"C34 equipped fighter "+freshNonce.slice(0,8));
const created=await rpc(holder,"create_player_character_v3",{
 p_payload:payload,p_spell_choices:[],p_magic_selections:[]
});
assert.ifError(created.error);
assert.match(created.data,/^[0-9a-f-]{36}$/i);
assert.equal(one("public.characters","creation_request_id="+quote(freshNonce)),1);
assert.equal(one("public.character_sheets","character_id="+quote(created.data)),1);
const unrelatedSheet=await stale.client.from("character_sheets").select("sheet")
  .eq("character_id",created.data);
assert.ifError(unrelatedSheet.error);
assert.equal(unrelatedSheet.data.length,0,
 "unrelated signed user cannot read an original Forge canonical full sheet");
assert.equal(sql("SELECT sheet->>'source' FROM public.players WHERE user_id="+quote(holder.id)),
  "ORIGINAL_NONEMPTY","historical nonempty account sheet source must remain frozen");
assert.equal(sql("SELECT sheet->>'c34_legacy_sheet_frozen' FROM public.players WHERE user_id="+quote(holder.id)),
  "true","historical nonempty account sheet marker must remain frozen");
const createdItemCount=one("public.inventory_items",
  "owner_type='character' AND owner_id="+quote(created.data));
assert.ok(createdItemCount>=1,
 "original privileged deferred materializer must create starting item after old CHECK removal");
assert.equal(sql("SELECT md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))"),
  originalForgeWrapper,"inventory candidate cannot rewrite immutable Forge v3");
assert.equal(one("private.player_creation_intent_reservations_v1","request_id="+quote(freshNonce)),1);
assert.equal(sql("SELECT md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'')) FROM public.character_stock x"),
  digestBefore,"merchant stock preserved across inventory fix and Forge");
assert.equal(sql("SELECT secret FROM public.characters WHERE id="+quote(characterId)),
  "C34_GM_SECRET_STAYS_PRIVATE","GM Secret unchanged");
assert.ok(Number(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1"))>=nonceCountBefore+1);
console.log("PASS C34-GREEN04: signed original v3 + real nonce + deferred equipment materializer + nonempty legacy snapshot + GM secret/stock preservation");
console.log("C34 SIGNED JOIN PASS: genuine PG17/GoTrue source-original subset, NOT full 31-trigger or production acceptance");

 
// T2 begins only after the already-green full signed I1C + C34 inventory suite.
// Adds five original live triggers while preserving *all* earlier acceptance.
sqlFile("scripts/integration/c34/c34_five_original_sheet_character_triggers_pg17.sql");
const originalTriggerNames=[
  "character_progression_materialize_player_forge_starting_equipme",
  "sync_character_progression_from_sheet_v1",
  "inventory_items_apply_structured_crafting_traits_v1",
  "zz_inventory_items_apply_smithing_affinity_polish_v4",
  "character_sheets_validate_player_forge_starting_equipment_v1",
  "character_sheets_authority_fields_guard_v1",
  "character_sheets_sync_player_tags_v1",
  "characters_guard_player_tags_v1",
  "sync_character_portrait_library_id_v1"
];
const privacyTriggerNames=[
  "characters_capture_creator_at_insert_v1",
  "characters_guard_player_gm_secret_at_insert_v1"
];
for (const triggerName of [...originalTriggerNames,...privacyTriggerNames]) {
  assert.match(triggerName,/^[a-z_]+[a-z0-9_]*$/i);
  assert.equal(one("pg_trigger","tgname='"+triggerName+"' AND NOT tgisinternal AND tgenabled='O'"),1,
    "T2 requires one enabled source-original or explicitly held privacy trigger: "+triggerName);
}
assert.equal(originalTriggerNames.length,9);
assert.equal(Number(sql("SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid "+
 "WHERE NOT t.tgisinternal AND t.tgenabled='O' "+
 "AND c.relname IN ('character_progression','character_sheets','characters','inventory_items')")),11);
const deferredDdl=sql("SELECT pg_get_triggerdef(t.oid,true) FROM pg_trigger t "+
 "WHERE t.tgrelid='public.character_sheets'::regclass "+
 "AND t.tgname='character_sheets_validate_player_forge_starting_equipment_v1'");
assert.match(deferredDdl,/DEFERRABLE INITIALLY DEFERRED/);
console.log("PASS C34-T2-01: nine exact original deployed trigger names + two proposed NPC privacy triggers, with preserved deferral");

const portraitId=randomUUID(),portraitPath="c34/source-verified/library-"+randomUUID()+".png";
sql("INSERT INTO public.npc_portrait_library(id,is_active,storage_path,public_url,name,sort_order) VALUES("+
 quote(portraitId)+",true,'"+portraitPath+"','https://example.invalid/c34-portrait.png','C34 tested library',1)");

const signedNonce=randomUUID();
const validSheet={
  classKey:"fighter",level:1,background:"Soldier",
  meta:{backgroundSource:"XPHB"},
  startingEquipmentSelections:{
    mode:"package",ruleset:"vanilla",classOption:"A",
    backgroundId:"00000000-0000-0000-0000-000000009150",backgroundOption:"A",choices:{}
  }
};
const signedPayload={
  creation_request_id:signedNonce,
  name:"C34 T2 original sheet and portrait "+signedNonce.slice(0,8),
  portrait_source:"library",
  portrait_storage_path:portraitPath,
  portrait_url:"https://example.invalid/c34-portrait.png",
  sheet:validSheet
};
const successful=await rpc(holder,"create_player_character_v3",{
  p_payload:signedPayload,p_spell_choices:[],p_magic_selections:[]
});
assert.ifError(successful.error);
assert.match(successful.data,/^[0-9a-f-]{36}$/i);
const secondId=successful.data;
assert.equal(one("public.characters","creation_request_id="+quote(signedNonce)),1);
assert.equal(one("public.character_sheets","character_id="+quote(secondId)),1);
assert.equal(one("public.inventory_items","owner_type='character' AND owner_id="+quote(secondId)),1);
assert.equal(sql("SELECT portrait_library_id::text FROM public.characters WHERE id="+quote(secondId)),
  portraitId,"Original BEFORE-INSERT portrait sync must resolve the active source library");
const derivedTags=sql("SELECT array_to_string(tags,',') FROM public.characters WHERE id="+quote(secondId));
assert.ok(derivedTags.split(",").includes("player-character"),"Player tag remains");
assert.ok(derivedTags.split(",").includes("class:fighter"),"Original sheet-to-tags sync derives class");
assert.ok(derivedTags.split(",").includes("background:soldier"),"Original sheet-to-tags sync derives background");
console.log("PASS C34-T2-02: signed Forge+original deferred Background validator+original sheet tag sync+active portrait linkage+character gear");

const replay=await rpc(holder,"create_player_character_v3",{
  p_payload:signedPayload,p_spell_choices:[],p_magic_selections:[]
});
assert.ifError(replay.error);
assert.equal(replay.data,secondId);
assert.equal(one("public.inventory_items","owner_type='character' AND owner_id="+quote(secondId)),1);
assert.equal(one("private.player_creation_intent_reservations_v1","request_id="+quote(signedNonce)),1);
console.log("PASS C34-T2-03: same-nonce signed retry is inert across original five added triggers");

const directTags=await holder.client.from("characters")
 .update({tags:["player-character","forged:campaign-admin"]})
 .eq("id",secondId).select("id");
rejected(directTags,"direct signed player tags mutation under original BEFORE guard","42501");
assert.ok(!sql("SELECT array_to_string(tags,',') FROM public.characters WHERE id="+quote(secondId))
  .includes("forged:campaign-admin"),"no post-rejection tag overwrite");

const editorSheet=await holder.client.from("character_sheets").select("sheet")
  .eq("character_id",secondId).single();
assert.ifError(editorSheet.error);
const protectedSheet={...editorSheet.data.sheet,sourceChoices:{
  outsiderInjected:{ownerType:"feat",placement:"spells"}
}};
const forbidden=await holder.client.from("character_sheets")
  .update({sheet:protectedSheet}).eq("character_id",secondId).select("character_id");
rejected(forbidden,"authenticated direct authoritative source choices","42501");
assert.equal(sql("SELECT sheet ? 'sourceChoices' FROM public.character_sheets WHERE character_id="+quote(secondId)),
  String(Object.hasOwn(editorSheet.data.sheet,"sourceChoices") ? "t":"f"),
  "original sheet authoritative field must not be changed");
console.log("PASS C34-T2-04: original player tag/authoritative sheet BEFORE guards reject direct JWT mutation");

const notesSheet={...editorSheet.data.sheet,description:"C34 original harmless authorized note"};
const allowed=await holder.client.from("character_sheets")
 .update({sheet:notesSheet}).eq("character_id",secondId).select("character_id");
assert.ifError(allowed.error);
assert.equal(allowed.data?.length,1,"current sheet editor may still update harmless narrative");
assert.equal(sql("SELECT sheet->>'description' FROM public.character_sheets WHERE character_id="+quote(secondId)),
  "C34 original harmless authorized note");
console.log("PASS C34-T2-05: original source authority guard preserves legitimate signed narrative edits");

// An original deferred sheet-equipment validator must reject mismatched
// canonical background and rollback the entire Forge + nonce + equipment.
const invalidNonce=randomUUID();
const badPayload={
  ...signedPayload,creation_request_id:invalidNonce,
  name:"C34 T2 mismatched background "+invalidNonce.slice(0,8),
  sheet:{...validSheet,background:"Unmatched Commoner"}
};
const mismatch=await rpc(holder,"create_player_character_v3",{
  p_payload:badPayload,p_spell_choices:[],p_magic_selections:[]
});
assert.ok(mismatch.error,"original deferred background mismatch must reject");
assert.match(mismatch.error.message,/Starting equipment Background does not match/);
assert.equal(one("public.characters","creation_request_id="+quote(invalidNonce)),0);
assert.equal(one("private.player_creation_intent_reservations_v1","request_id="+quote(invalidNonce)),0);
assert.equal(sql("SELECT sheet->>'source' FROM public.players WHERE user_id="+quote(holder.id)),
  "ORIGINAL_NONEMPTY","legacy account snapshot stays preserved after deferred rollback");
assert.equal(sql("SELECT secret FROM public.characters WHERE id="+quote(characterId)),
  "C34_GM_SECRET_STAYS_PRIVATE","legacy GM secret unchanged after T2 rejection");
console.log("PASS C34-T2-06: original deferred canonical Background mismatch aborts Forge, nonce and gear atomically");
console.log("C34 T2 SIGNED SOURCE SUBSET PASS: 9/31 original triggers + 2 held privacy; NOT 31/31 production graph");

// T3: exact original #345 creation-adjacent sprite, Mog and progression
// handlers. All T1/T2 signed behavior above stays unchanged.
sqlFile("scripts/integration/c34/c34_three_original_sprite_mog_levelup_triggers_pg17.sql");
for(const name of [
  "guard_character_visual_asset_sprite_v1",
  "protect_mog_delete_v1",
  "cancel_invalid_level_up_session_v1"
]) {
  assert.equal(one("pg_trigger","tgname='"+name+"' AND NOT tgisinternal AND tgenabled='O'"),1,
    "C34 T3 must install one source-original trigger "+name);
}
assert.equal(Number(sql("SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid "+
  "WHERE NOT t.tgisinternal AND t.tgenabled='O' AND c.relname IN "+
  "('character_progression','character_sheets','characters','inventory_items')")),14);
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t",
  "Never import original world-map route departure helper into C34 research");
console.log("PASS C34-T3-01: 12/31 original + 2 held privacy, sprite/Mog/levelup sources co-reside without movement triggers");

const validSpriteNonce=randomUUID();
const activeSpriteId="00000000-0000-0000-0000-000000007421";
const badSpriteId="00000000-0000-0000-0000-000000007422";
const spritePortraitId="00000000-0000-0000-0000-000000007420";
const spritePayload={
  creation_request_id:validSpriteNonce,
  name:"C34 T3 signed original sprite "+validSpriteNonce.slice(0,8),
  portrait_library_id:spritePortraitId,visual_asset_id:activeSpriteId,
  sheet:validSheet
};
const spriteCreated=await rpc(holder,"create_player_character_v3",{
  p_payload:spritePayload,p_spell_choices:[],p_magic_selections:[]
});
assert.ifError(spriteCreated.error);
assert.match(spriteCreated.data,/^[0-9a-f-]{36}$/i);
assert.equal(sql("SELECT sprite_path FROM public.characters WHERE id="+quote(spriteCreated.data)),
 "c33/valid-8dir.png","original BEFORE guard must derive canonical sprite");
assert.equal(sql("SELECT sprite_key FROM public.characters WHERE id="+quote(spriteCreated.data)),
 activeSpriteId);
assert.equal(Number(sql("SELECT sprite_scale FROM public.characters WHERE id="+quote(spriteCreated.data))),
 0.42,"source-original overworld scale chosen");
assert.equal(one("public.inventory_items","owner_type='character' AND owner_id="+quote(spriteCreated.data)),1);
const spriteReplay=await rpc(holder,"create_player_character_v3",{
  p_payload:spritePayload,p_spell_choices:[],p_magic_selections:[]
});
assert.ifError(spriteReplay.error);
assert.equal(spriteReplay.data,spriteCreated.data);
console.log("PASS C34-T3-02: signed original 8-direction sprite guard sets source path, key and scale; nonce/equipment replay stays inert");

const badSpriteNonce=randomUUID();
const badSpritePayload={
  ...spritePayload,
  name:"C34 T3 invalid sprite "+badSpriteNonce.slice(0,8),
  creation_request_id:badSpriteNonce,
  visual_asset_id:badSpriteId
};
const invalidSprite=await rpc(holder,"create_player_character_v3",{
  p_payload:badSpritePayload,p_spell_choices:[],p_magic_selections:[]
});
assert.ok(invalidSprite.error,"original sprite runtime contract must reject invalid asset");
assert.match(invalidSprite.error.message,/does not satisfy the DNDNext 8-direction runtime contract/);
assert.equal(one("public.characters","creation_request_id="+quote(badSpriteNonce)),0);
assert.equal(one("private.player_creation_intent_reservations_v1","request_id="+quote(badSpriteNonce)),0);
assert.equal(one("public.inventory_items","owner_type='character' AND owner_id="+quote(spriteCreated.data)),1);
console.log("PASS C34-T3-03: invalid original sprite contract aborts signed Forge/nonce/gear atomically");

// Original level-up cancellation trigger branches exercised through disposable
// PostgreSQL SQL after authentic signed Forge creation; this is NOT a browser
// progression-RPC acceptance claim.
const levelSessionId=randomUUID();
sql("INSERT INTO public.character_level_up_sessions(id,character_id,status) VALUES("+
 quote(levelSessionId)+","+quote(secondId)+",'open')");
sql("UPDATE public.character_progression SET pending_level_up=true WHERE character_id="+quote(secondId));
assert.equal(sql("SELECT status FROM public.character_level_up_sessions WHERE id="+quote(levelSessionId)),"open");
sql("UPDATE public.character_progression SET pending_level_up=false WHERE character_id="+quote(secondId));
assert.equal(sql("SELECT status FROM public.character_level_up_sessions WHERE id="+quote(levelSessionId)),"cancelled");
console.log("PASS C34-T3-04: original level-up guard preserves open session when pending; cancels on reset (disposable SQL branch)");

// Mog's original deletion protection is not a Forge RPC permission policy.
// Exercise source handler directly on synthetic database rows. No real NPCs or
// world-map state touched.
const syntheticMog=randomUUID();
const normalNpc=randomUUID();
sql("INSERT INTO public.characters(id,name,kind) VALUES("+
 quote(syntheticMog)+",'Mog','npc'),("+quote(normalNpc)+",'C34 temporary NPC','npc')");
const protectedMog=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",
 "DELETE FROM public.characters WHERE id="+quote(syntheticMog)],{
 env,encoding:"utf8",timeout:30000
});
assert.notEqual(protectedMog.status,0,"original Mog deletion must be refused");
assert.match(protectedMog.stderr,/Mog is protected and cannot be deleted/);
assert.equal(one("public.characters","id="+quote(syntheticMog)),1);
sql("DELETE FROM public.characters WHERE id="+quote(normalNpc));
assert.equal(one("public.characters","id="+quote(normalNpc)),0,
 "ordinary synthetic NPC deletion still works with original Mog protection");
console.log("PASS C34-T3-05: protected Mog cannot be deleted; unrelated synthetic NPC deletion unchanged (disposable SQL branch)");
console.log("C34 T3 PASS: original 12/31 + 2 proposed privacy, original Story/inventory/Forge RED-GREEN retained; 19 originals not yet covered");




 
// T4: ONE remaining progression original: source-exact Fighter subclass
// BEFORE INSERT trigger, tested through genuine signed Forge v3 with real
// immutable nonce. This is a three-entry source-qualified reduced catalog,
// not a complete 2024 Fighter or Battle Master feature release.
sqlFile("scripts/integration/c34/c34_original_fighter_subclass_choice_pg17.sql");
assert.equal(one("pg_trigger",
  "tgname='character_progression_apply_forge_subclass_v1' AND NOT tgisinternal AND tgenabled='O'"),1);
assert.equal(Number(sql(
  "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid "+
  "WHERE NOT t.tgisinternal AND t.tgenabled='O' AND "+
  "c.relname IN ('character_progression','character_sheets','characters','inventory_items')")),15);
assert.equal(sql("SELECT md5(pg_get_functiondef('private.apply_character_forge_subclass_choice_v1()'::regprocedure))"),
  "273be29420a7274d997642e302604cb7","original live subclass handler fingerprint");
console.log("PASS C34-T4-01: original Fighter subclass source, BEFORE INSERT trigger and 13/31+2 privacy coexist");

const makeSubclass=(id,subclassName,source,level=3)=>({
  creation_request_id:id,
  name:"C34 T4 fighter "+id.slice(0,8),
  sheet:{
    ...validSheet,
    level,
    ...(subclassName===null?{}:{subclassName}),
    ...(source===null?{}:{subclassSource:source}),
    startingEquipmentSelections:{...validSheet.startingEquipmentSelections}
  }
});
const createSubclass=async(p)=>rpc(holder,"create_player_character_v3",{
  p_payload:p,p_spell_choices:[],p_magic_selections:[]
});
async function rejectSubclass(payload,message) {
 const beforeStock=sql("SELECT count(*) FROM public.character_stock");
 const result=await createSubclass(payload);
 assert.ok(result.error,"T4 original subclass negative should be rejected");
 assert.match(result.error.message,message,"Reject must originate from the original subclass handler");
 assert.equal(one("public.characters","creation_request_id="+quote(payload.creation_request_id)),0);
 assert.equal(one("private.player_creation_intent_reservations_v1","request_id="+quote(payload.creation_request_id)),0);
 assert.equal(sql("SELECT count(*) FROM public.character_stock"),beforeStock);
 return result.error;
}
const firstLevelOne=randomUUID();
const baseAccepted=await createSubclass(makeSubclass(firstLevelOne,null,null,1));
assert.ifError(baseAccepted.error);
assert.equal(sql("SELECT coalesce(subclass_name,'<NULL>') FROM public.character_progression WHERE character_id="+quote(baseAccepted.data)),
 "<NULL>","Fighter level 1 must not be assigned or required a subclass");
console.log("PASS C34-T4-02: genuine signed level-1 Fighter retains no premature subclass");

await rejectSubclass(makeSubclass(randomUUID(),null,null,3),
 /Choose a subclass for fighter level 3 before creating this character/i);
await rejectSubclass(makeSubclass(randomUUID(),"Champion","XPHB",2),
 /Champion becomes available at class level 3, but this character starts at level 2/i);
console.log("PASS C34-T4-03: original source rejects missing level-3 and premature level-2 subclass with nonce/character rollback");

const championNonce=randomUUID();
const championPayload=makeSubclass(championNonce,"Champion","XPHB");
const champion=await createSubclass(championPayload);
assert.ifError(champion.error);
assert.match(champion.data,/^[a-f0-9-]{36}$/i);
assert.equal(sql("SELECT subclass_name FROM public.character_progression WHERE character_id="+quote(champion.data)),"Champion");
assert.equal(sql("SELECT subclass_source FROM public.character_progression WHERE character_id="+quote(champion.data)),"XPHB");
assert.equal(sql("SELECT level_choices#>>'{startingSubclass,entryLevel}' FROM public.character_progression WHERE character_id="+quote(champion.data)),"3");
assert.equal(sql("SELECT level_choices#>>'{startingSubclass,creator}' FROM public.character_progression WHERE character_id="+quote(champion.data)),
 "shared_character_forge_player_v2");
assert.equal(one("public.inventory_items","owner_type='character' AND owner_id="+quote(champion.data)),1);
assert.equal(one("public.character_sheets","character_id="+quote(champion.data)),1);
console.log("PASS C34-T4-04: signed source-qualified XPHB Champion persists class level, original subclass and starting equipment");

const originalState={
 cp:sql("SELECT md5(to_jsonb(x)::text) FROM public.character_progression x WHERE character_id="+quote(champion.data)),
 sheet:sql("SELECT md5(to_jsonb(x)::text) FROM public.character_sheets x WHERE character_id="+quote(champion.data)),
 equipment:sql("SELECT md5(coalesce(string_agg(md5(to_jsonb(x)::text),'|' ORDER BY x.id::text),'')) FROM public.inventory_items x WHERE owner_type='character' AND owner_id="+quote(champion.data))
};
const championRetry=await createSubclass(championPayload);
assert.ifError(championRetry.error);
assert.equal(championRetry.data,champion.data);
const tamperedSource=JSON.parse(JSON.stringify(championPayload));
tamperedSource.sheet.subclassSource="PHB";
const changedNonce=await createSubclass(tamperedSource);
rejected(changedNonce,"same nonce changed to legacy PHB subclass","22023");
assert.deepEqual({
 cp:sql("SELECT md5(to_jsonb(x)::text) FROM public.character_progression x WHERE character_id="+quote(champion.data)),
 sheet:sql("SELECT md5(to_jsonb(x)::text) FROM public.character_sheets x WHERE character_id="+quote(champion.data)),
 equipment:sql("SELECT md5(coalesce(string_agg(md5(to_jsonb(x)::text),'|' ORDER BY x.id::text),'')) FROM public.inventory_items x WHERE owner_type='character' AND owner_id="+quote(champion.data))
},originalState,"unchanged nonce must not re-run original trigger or alter CP/CS/gear");
console.log("PASS C34-T4-05: signed immutable-nonce replay inert; changed subclass source rejected without CP/CS/gear drift");

await rejectSubclass(makeSubclass(randomUUID(),"Purple Dragon","XPHB"),
 /The selected subclass Purple Dragon is not available for the fighter class/i);
await rejectSubclass(makeSubclass(randomUUID(),"Champion","TCE"),
 /The selected subclass Champion is not available for the fighter class/i);
console.log("PASS C34-T4-06: original source rejects unknown/incorrect-source subclasses atomically");

const legacyChampion=await createSubclass(makeSubclass(randomUUID(),"Champion","PHB"));
assert.ifError(legacyChampion.error);
assert.equal(sql("SELECT subclass_source FROM public.character_progression WHERE character_id="+quote(legacyChampion.data)),"PHB");
const battleMaster=await createSubclass(makeSubclass(randomUUID(),"Battle Master","XPHB"));
assert.ifError(battleMaster.error);
assert.equal(sql("SELECT subclass_name FROM public.character_progression WHERE character_id="+quote(battleMaster.data)),
 "Battle Master");
assert.equal(sql("SELECT subclass_source FROM public.character_progression WHERE character_id="+quote(battleMaster.data)),
 "XPHB");
assert.equal(one("public.inventory_items","owner_type='character' AND owner_id="+quote(battleMaster.data)),1);
assert.equal(sql("SELECT sheet->>'source' FROM public.players WHERE user_id="+quote(holder.id)),
 "ORIGINAL_NONEMPTY","legacy account sheet must remain untouched by subclass source");
assert.equal(sql("SELECT secret FROM public.characters WHERE id="+quote(characterId)),
 "C34_GM_SECRET_STAYS_PRIVATE");
console.log("PASS C34-T4-07: explicit source-qualified PHB Champion and XPHB Battle Master recognized by original handler; maneuvers NOT included");
console.log("C34 T4 PASS: 13/31 original triggers plus 2 held privacy; 16 progression and 2 world-map originals unstaged, runtime/browser parity NOT claimed");


// T5 — source-exact original deferred Forge progression-authority validator,
// after all signed T1-T4 tests. Uses a small original-source-qualified feat
// catalog and view; not full feat acquisition/materialization or production ACL.
sqlFile("scripts/integration/c34/c34_original_deferred_progression_authority_pg17.sql");
assert.equal(one("pg_trigger",
  "tgname='character_progression_validate_player_forge_authority_v1' AND NOT tgisinternal AND tgenabled='O'"),1);
assert.equal(Number(sql(
 "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid "+
 "WHERE NOT t.tgisinternal AND t.tgenabled='O' "+
 "AND c.relname IN ('character_progression','character_sheets','characters','inventory_items')")),16);
const authorityTrigger=sql("SELECT pg_get_triggerdef(t.oid,true) FROM pg_trigger t "+
 "WHERE t.tgrelid='public.character_progression'::regclass "+
 "AND t.tgname='character_progression_validate_player_forge_authority_v1'");
assert.match(authorityTrigger,/AFTER INSERT OR UPDATE OF class_id, class_level/);
assert.match(authorityTrigger,/DEFERRABLE INITIALLY DEFERRED/);
assert.equal(sql("SELECT md5(pg_get_functiondef('private.validate_player_forge_authority_payload_v1()'::regprocedure))"),
 "48006f8db76e9b32c96fcd2b6a4b3080");
console.log("PASS C34-T5-01: 14 original/31 + 2 held NPC privacy, exact live deferred authority event and source fingerprints");

const sourceAuthority=(nonce)=>{
 const base=makeSubclass(nonce,null,null,1);
 return {
  ...base,name:"C34 T5 source authority "+nonce.slice(0,8),
  sheet:{
   ...base.sheet,meta:{backgroundSource:"XPHB",speciesKey:"Elf"},
   featGrantInstances:[{
    instanceId:"c34-t5-origin-lucky",optionId:"00000000-0000-0000-0000-000000009154",
    name:"Lucky",source:"XPHB",optionType:"feat",acquisitionLevel:1,
    choices:{},fixedEffects:[]
   }],
   feats:["Lucky"],
   classFeatureChoices:{
    fightingStyle:{
     kind:"fighting-style",count:1,level:1,label:"Fighting Style",
     selections:[{name:"Defense",key:"defense",source:"XPHB"}]
    }
   },
   classFeatureChoiceSummary:[{
    groupId:"fightingStyle",key:"defense",name:"Defense",source:"XPHB"
   }]
  }
 };
};
async function rejectAuthority(payload,origin) {
 const beforeInventory=Number(sql("SELECT count(*) FROM public.inventory_items"));
 const result=await createSubclass(payload);
 assert.ok(result.error,"Original deferred authority must reject: "+origin);
 assert.match(result.error.message,origin);
 assert.equal(one("public.characters","creation_request_id="+quote(payload.creation_request_id)),0);
 assert.equal(one("private.player_creation_intent_reservations_v1","request_id="+quote(payload.creation_request_id)),0);
 assert.equal(Number(sql("SELECT count(*) FROM public.inventory_items")),beforeInventory,
  "original deferred authority rejection cannot leave starting equipment behind");
 return result;
}
const authorityNonce=randomUUID(),goodAuthority=sourceAuthority(authorityNonce);
const authoritative=await createSubclass(goodAuthority);
assert.ifError(authoritative.error);
assert.match(authoritative.data,/^[a-f0-9-]{36}$/i);
assert.equal(sql("SELECT sheet->'feats'->>0 FROM public.character_sheets "+
 "WHERE character_id="+quote(authoritative.data)),"Lucky");
assert.equal(sql("SELECT sheet#>>'{classFeatureChoices,fightingStyle,selections,0,name}' "+
 "FROM public.character_sheets WHERE character_id="+quote(authoritative.data)),"Defense");
assert.equal(one("public.inventory_items","owner_type='character' AND owner_id="+quote(authoritative.data)),1);
assert.equal(one("private.player_creation_intent_reservations_v1","request_id="+quote(authorityNonce)),1);
console.log("PASS C34-T5-02: signed original v3 accepts canonical XPHB Lucky feat instance and Defense style under deferred authority");

const beforeReplay={
 cp:sql("SELECT md5(to_jsonb(x)::text) FROM public.character_progression x WHERE character_id="+quote(authoritative.data)),
 sheet:sql("SELECT md5(to_jsonb(x)::text) FROM public.character_sheets x WHERE character_id="+quote(authoritative.data)),
 items:sql("SELECT md5(coalesce(string_agg(to_jsonb(x)::text,'|' ORDER BY x.id::text),'')) FROM public.inventory_items x WHERE owner_type='character' AND owner_id="+quote(authoritative.data))
};
const retryAuthority=await createSubclass(goodAuthority);
assert.ifError(retryAuthority.error);
assert.equal(retryAuthority.data,authoritative.data);
const changedAuthority=JSON.parse(JSON.stringify(goodAuthority));
changedAuthority.sheet.feats=["Unapproved Feat"];
const changedResult=await createSubclass(changedAuthority);
rejected(changedResult,"tampered feat summary same immutable nonce","22023");
assert.deepEqual({
 cp:sql("SELECT md5(to_jsonb(x)::text) FROM public.character_progression x WHERE character_id="+quote(authoritative.data)),
 sheet:sql("SELECT md5(to_jsonb(x)::text) FROM public.character_sheets x WHERE character_id="+quote(authoritative.data)),
 items:sql("SELECT md5(coalesce(string_agg(to_jsonb(x)::text,'|' ORDER BY x.id::text),'')) FROM public.inventory_items x WHERE owner_type='character' AND owner_id="+quote(authoritative.data))
},beforeReplay,"canonical progression, sheet and gear cannot mutate on retry");
console.log("PASS C34-T5-03: original v3 nonce replay remains inert; changed feat source intent denied without CP/CS/gear drift");

const mismatchedFeat=sourceAuthority(randomUUID());
mismatchedFeat.sheet.featGrantInstances=[];
await rejectAuthority(mismatchedFeat,/feats must exactly match their validated source-owned feat grants/i);
const missingGrantId=sourceAuthority(randomUUID());
delete missingGrantId.sheet.featGrantInstances[0].instanceId;
await rejectAuthority(missingGrantId,/requires an instanceId/i);
console.log("PASS C34-T5-04: original deferred feat summary and source-original canonical instanceId checks roll back character/nonce/equipment");

const invalidStylePayload=sourceAuthority(randomUUID());
invalidStylePayload.sheet.classFeatureChoices.fightingStyle.selections[0].name="Impossible Style";
invalidStylePayload.sheet.classFeatureChoiceSummary[0].name="Impossible Style";
await rejectAuthority(invalidStylePayload,/not valid for this class, subclass, source, or level/i);
const incorrectSourceFeat=sourceAuthority(randomUUID());
incorrectSourceFeat.sheet.featGrantInstances[0].source="PHB";
await rejectAuthority(incorrectSourceFeat,/does not match its canonical option source/i);
console.log("PASS C34-T5-05: preferred XPHB feat style rejects nonexistent option; grant source mismatch rejects without nonce/gear");

const fakeSpellSummary=sourceAuthority(randomUUID());
fakeSpellSummary.sheet.featGrantInstances=[];
fakeSpellSummary.sheet.feats=[];
fakeSpellSummary.sheet.classFeatureChoices={};
fakeSpellSummary.sheet.classFeatureChoiceSummary=[];
fakeSpellSummary.sheet.spells=["Fire Bolt"];
await rejectAuthority(fakeSpellSummary,/sheet spell summary must exactly match its validated starting spell assignments/i);
console.log("PASS C34-T5-06: original deferred spell-summary authority rejects spoofed Fighter class spell without source grant");

const concurrentAuthority=sourceAuthority(randomUUID());
const pair=await Promise.all([createSubclass(concurrentAuthority),createSubclass(concurrentAuthority)]);
for(const response of pair)assert.ifError(response.error);
assert.equal(pair[0].data,pair[1].data);
assert.equal(one("public.characters","creation_request_id="+quote(concurrentAuthority.creation_request_id)),1);
assert.equal(one("private.player_creation_intent_reservations_v1","request_id="+quote(concurrentAuthority.creation_request_id)),1);
assert.equal(one("public.inventory_items","owner_type='character' AND owner_id="+quote(pair[0].data)),1);
console.log("PASS C34-T5-07: two real signed concurrent source-feat requests serialize to one nonce, character and equipment");

assert.equal(sql("SELECT sheet->>'source' FROM public.players WHERE user_id="+quote(holder.id)),
 "ORIGINAL_NONEMPTY","legacy nonempty account sheet remains immutable after deferred authority tests");
assert.equal(sql("SELECT secret FROM public.characters WHERE id="+quote(characterId)),
 "C34_GM_SECRET_STAYS_PRIVATE","original GM secret must remain unchanged by T5");
assert.equal(sql("SELECT count(*) FROM public.character_stock"),"1",
 "merchant stock unchanged after all T5 authority/rollback/retry checks");
console.log("PASS C34-T5-08: original historical sheet, GM Secret and merchant stock preserved; no world-map movement triggers installed");
console.log("C34 T5 SOURCE-FAITHFUL SIGNED SUBSET PASS: 14/31 originals + 2 proposed NPC privacy; remaining 15 progression and 2 world-map originals held");


// T6: unchanged #324 original immediate feat instance/grant persistence after
// the T5 original deferred canonical authority validator. Original specialized
// grant hooks co-reside, but only the Lucky source family is exercised here.
sqlFile("scripts/integration/c34/c34_original_feat_grant_materializer_pg17.sql");
assert.equal(one("pg_trigger","tgname='character_progression_materialize_player_forge_feat_instances_v' "+
 "AND NOT tgisinternal AND tgenabled='O'"),1);
assert.equal(Number(sql(
 "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid "+
 "WHERE NOT t.tgisinternal AND t.tgenabled='O' AND "+
 "c.relname IN ('character_progression','character_sheets','characters','inventory_items')")),17);
assert.equal(Number(sql("SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid "+
 "WHERE NOT tgisinternal AND tgenabled='O' "+
 "AND c.relname IN ('character_option_grant_instances','character_option_grants')")),5);
assert.equal(sql("SELECT md5(pg_get_functiondef('private.materialize_player_forge_feat_instances_v1()'::regprocedure))"),
 "c27c4181a51cfd018bbb8244e9931550");
console.log("PASS C34-T6-01: original 15/31 plus two HELD NPC privacy; all five exact source-original grant-table triggers co-resident");

const grantNonce=randomUUID(),grantPayload=sourceAuthority(grantNonce);
grantPayload.sheet.featGrantInstances[0].acquisitionOwnerType="background";
grantPayload.sheet.featGrantInstances[0].acquisitionOwnerKey="soldier-xphb";
grantPayload.sheet.featGrantInstances[0].acquisitionLabel="Soldier background";
const grantResult=await createSubclass(grantPayload);
assert.ifError(grantResult.error);
const grantCharacterId=grantResult.data;
assert.equal(one("public.character_option_grant_instances","character_id="+quote(grantCharacterId)),1);
assert.equal(one("public.character_option_grants","character_id="+quote(grantCharacterId)),1);
const grantRow=JSON.parse(sql("SELECT jsonb_build_object("+
 "'option_id',option_id,'option_name',option_name,'option_type',option_type,"+
 "'option_source',option_source,'instance_key',instance_key,"+
 "'owner_type',acquisition_owner_type,'owner_key',acquisition_owner_key,"+
 "'owner_label',acquisition_label,'acquisition_level',acquisition_level,"+
 "'repeatable',repeatable,'choices',choices,'effects',effects,"+
 "'fixed_spell_tokens',fixed_spell_tokens,'granted_by',granted_by) "+
 "FROM public.character_option_grant_instances WHERE character_id="+quote(grantCharacterId)));
assert.equal(grantRow.option_id,"00000000-0000-0000-0000-000000009154");
assert.equal(grantRow.option_name,"Lucky");
assert.equal(grantRow.option_source,"XPHB");
assert.equal(grantRow.option_type,"feat");
assert.equal(grantRow.instance_key,"c34-t5-origin-lucky");
assert.equal(grantRow.owner_type,"background");
assert.equal(grantRow.owner_key,"soldier-xphb");
assert.equal(grantRow.owner_label,"Soldier background");
assert.equal(grantRow.acquisition_level,1);
assert.equal(grantRow.repeatable,false);
assert.deepEqual(grantRow.choices,{});
assert.deepEqual(grantRow.effects,[]);
assert.deepEqual(grantRow.fixed_spell_tokens,[]);
assert.equal(sql("SELECT option_id::text FROM public.character_option_grants WHERE character_id="+quote(grantCharacterId)),
 "00000000-0000-0000-0000-000000009154");
assert.equal(sql("SELECT created_by::text FROM public.character_progression WHERE character_id="+quote(grantCharacterId)),
 holder.id,"original source-record owner should be signed creator on completed progression");
if(grantRow.granted_by===null){
 console.log("SOURCE GAP C34-T6-02: original AFTER INSERT materializer inserted grant_instance.granted_by=NULL while canonical progression.created_by is signed creator; must assess original #324 grant-provenance repair before release");
}else assert.equal(grantRow.granted_by,holder.id,
 "source recorded creator provenance must never be another actor");
const aggregateActor=sql("SELECT coalesce(granted_by::text,'') FROM public.character_option_grants "+
 "WHERE character_id="+quote(grantCharacterId));
assert.ok(aggregateActor===""||aggregateActor===holder.id,
 "aggregate grant provenance must be NULL or the verified creator, never another actor");
if(aggregateActor==="") console.log("SOURCE GAP C34-T6-02: original immediate aggregate grant has NULL granted_by despite signed creator");
assert.equal(one("public.inventory_items","owner_type='character' AND owner_id="+quote(grantCharacterId)),1);
console.log("PASS C34-T6-02: signed source-qualified Lucky persists one canonical instance AND aggregate feat grant, preserving actor-provenance gap as explicit HOLD");

const hashRows=(table,where)=>sql(
 "SELECT md5(coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)::text FROM "+
 table+" x WHERE "+where+"),'[]'))");
const grantWhere="character_id="+quote(grantCharacterId);
const grantBefore={
 instance:hashRows("public.character_option_grant_instances",grantWhere),
 aggregate:hashRows("public.character_option_grants",grantWhere),
 equipment:hashRows("public.inventory_items","owner_type='character' AND owner_id="+quote(grantCharacterId))
};
const idemGrant=await createSubclass(grantPayload);
assert.ifError(idemGrant.error);
assert.equal(idemGrant.data,grantCharacterId);
assert.deepEqual({
 instance:hashRows("public.character_option_grant_instances",grantWhere),
 aggregate:hashRows("public.character_option_grants",grantWhere),
 equipment:hashRows("public.inventory_items","owner_type='character' AND owner_id="+quote(grantCharacterId))
},grantBefore,"original source-owned grant, aggregate and gear immutable on identical nonce retry");
const changedOwner=JSON.parse(JSON.stringify(grantPayload));
changedOwner.sheet.featGrantInstances[0].acquisitionOwnerKey="forged-other-background";
rejected(await createSubclass(changedOwner),"same nonce changed feat ownership", "22023");
assert.equal(sql("SELECT acquisition_owner_key FROM public.character_option_grant_instances "+
 "WHERE character_id="+quote(grantCharacterId)),"soldier-xphb");
console.log("PASS C34-T6-03: grant instance, aggregate grant and gear immutable under identical/changed nonce replay");

const grantCounts=()=>({
 chars:Number(sql("SELECT count(*) FROM public.characters")),
 nonce:Number(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1")),
 instances:Number(sql("SELECT count(*) FROM public.character_option_grant_instances")),
 aggregate:Number(sql("SELECT count(*) FROM public.character_option_grants")),
 equipment:Number(sql("SELECT count(*) FROM public.inventory_items"))
});
async function rejectedGrant(payload,rx,code){
 const before=grantCounts(),result=await createSubclass(payload);
 assert.ok(result.error,"C34 T6 expected source denial");
 if(rx)assert.match(result.error.message,rx);
 if(code)assert.equal(result.error.code,code);
 assert.deepEqual(grantCounts(),before,"rejected signed original grant must rollback char/nonce/GI/grant/inventory");
 assert.equal(one("public.characters","creation_request_id="+quote(payload.creation_request_id)),0);
 assert.equal(one("private.player_creation_intent_reservations_v1","request_id="+quote(payload.creation_request_id)),0);
 return result.error;
}
const duplicateGrant=sourceAuthority(randomUUID());
duplicateGrant.sheet.featGrantInstances.push({...duplicateGrant.sheet.featGrantInstances[0]});
await rejectedGrant(duplicateGrant,/Duplicate feat or boon grant instance/i);
const nonRepeatable=sourceAuthority(randomUUID());
nonRepeatable.sheet.featGrantInstances.push({
 ...nonRepeatable.sheet.featGrantInstances[0],instanceId:"c34-t6-different-instance-key"
});
await rejectedGrant(nonRepeatable,/not repeatable/i);
console.log("PASS C34-T6-04: original grant duplicate instance and nonrepeatable Lucky violations roll back ALL resources");

const malformedTokens=sourceAuthority(randomUUID());
malformedTokens.sheet.featGrantInstances[0].fixedSpellTokens={forged:true};
await rejectedGrant(malformedTokens,/check constraint|character_option_grant_instances_fixed_spell_tokens_check/i,"23514");
console.log("PASS C34-T6-05: original grant-instance fixed_spell_tokens array CHECK rejects object and atomically rolls back");

const unauthorizedGrant=await holder.client.from("character_option_grant_instances")
 .insert({
  character_id:grantCharacterId,
  option_id:"00000000-0000-0000-0000-000000009154",
  option_name:"Lucky",instance_key:"c34-t6-manual-forgery"
 }).select("id");
assert.ok(unauthorizedGrant.error,"signed-in creator cannot manually mint source-owned feat instance");
const unauthorizedAggregate=await holder.client.from("character_option_grants")
 .insert({character_id:grantCharacterId,option_id:"00000000-0000-0000-0000-000000009154"})
 .select("id");
assert.ok(unauthorizedAggregate.error,"signed-in creator cannot manually mint aggregate feat grant");
const unauthorizedAnon=await makeClient().from("character_option_grant_instances")
 .select("id").eq("character_id",grantCharacterId);
assert.ok(unauthorizedAnon.error,"anonymous token cannot directly read private canonical grant table");
assert.equal(one("public.character_option_grant_instances","character_id="+quote(grantCharacterId)),1);
console.log("PASS C34-T6-06: source-original two grant tables deny authenticated direct writes and anonymous reads without weakening creation RPC");

const racingGrant=sourceAuthority(randomUUID());
const twins=await Promise.all([createSubclass(racingGrant),createSubclass(racingGrant)]);
for(const x of twins)assert.ifError(x.error);
assert.equal(twins[0].data,twins[1].data);
assert.equal(one("public.characters","creation_request_id="+quote(racingGrant.creation_request_id)),1);
assert.equal(one("public.character_option_grant_instances","character_id="+quote(twins[0].data)),1);
assert.equal(one("public.character_option_grants","character_id="+quote(twins[0].data)),1);
assert.equal(one("public.inventory_items","owner_type='character' AND owner_id="+quote(twins[0].data)),1);
console.log("PASS C34-T6-07: concurrent real signed identical nonce mints exactly one source instance, aggregate feat, character and equipment");

const otherGrantPayload=sourceAuthority(randomUUID());
const independentGrant=await createSubclass(otherGrantPayload);
assert.ifError(independentGrant.error);
assert.notEqual(independentGrant.data,grantCharacterId);
assert.equal(one("public.character_option_grant_instances","character_id="+quote(independentGrant.data)),1);
assert.equal(one("public.character_option_grants","character_id="+quote(independentGrant.data)),1);
assert.equal(one("public.character_option_grant_instances","character_id="+quote(grantCharacterId)),1);
const noFeatPayload=makeSubclass(randomUUID(),null,null,1);
const noFeat=await createSubclass(noFeatPayload);
assert.ifError(noFeat.error);
assert.equal(one("public.character_option_grant_instances","character_id="+quote(noFeat.data)),0);
assert.equal(one("public.character_option_grants","character_id="+quote(noFeat.data)),0);
console.log("PASS C34-T6-08: original grant materializer isolates characters and creates no ghost grants without source feat intent");

assert.equal(sql("SELECT sheet->>'source' FROM public.players WHERE user_id="+quote(holder.id)),
 "ORIGINAL_NONEMPTY","T6 cannot rewrite frozen historical account sheet");
assert.equal(sql("SELECT secret FROM public.characters WHERE id="+quote(characterId)),
 "C34_GM_SECRET_STAYS_PRIVATE","T6 must not reveal or overwrite GM Secret");
console.log("C34 T6 SIGNED SOURCE-ORIGINAL FEAT GRANTS PASS: 15/31 original Forge triggers + 2 HELD privacy + 5 downstream grant triggers; actor attribution potential SOURCE GAP explicitly held; 14 progression and 2 movement originals not installed");


// T7: source-original held #324 verified progression creator seed candidate.
// RED baseline is from the original T6 completed signed Forge and must be
// observed on BOTH canonical grant tables BEFORE the candidate is installed.
assert.equal(sql("SELECT granted_by IS NULL FROM public.character_option_grant_instances "+
 "WHERE character_id="+quote(grantCharacterId)),"t","T7 requires original grant instance NULL creator RED");
assert.equal(sql("SELECT granted_by IS NULL FROM public.character_option_grants "+
 "WHERE character_id="+quote(grantCharacterId)),"t","T7 requires original aggregate grant NULL creator RED");
assert.equal(sql("SELECT created_by::text FROM public.character_progression "+
 "WHERE character_id="+quote(grantCharacterId)),holder.id);
const redInstanceFingerprint=hashRows("public.character_option_grant_instances",grantWhere);
const redAggregateFingerprint=hashRows("public.character_option_grants",grantWhere);
const oldAttributionCount=one("private.character_creator_attribution",
 "character_id="+quote(grantCharacterId));
assert.equal(oldAttributionCount,1,"original creator attribution already exists for T6 historical test");
console.log("PASS C34-T7-RED01: both source-original prior grant tables really hold NULL granted_by, even though finished original progression identifies signed creator");

sqlFile("scripts/integration/c34/c34_original_verified_creator_seed_pg17.sql");
assert.equal(one("pg_trigger",
 "tgname='character_progression_seed_verified_forge_creator_v1' "+
 "AND NOT tgisinternal AND tgenabled='O'"),1);
assert.equal(Number(sql(
 "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid "+
 "WHERE NOT t.tgisinternal AND t.tgenabled='O' AND "+
 "c.relname IN ('character_progression','character_sheets','characters','inventory_items')")),18);
assert.equal(sql("SELECT has_function_privilege('authenticated',"+
 "'private.seed_verified_forge_progression_creator_v1()','EXECUTE')"),"f",
 "verified creator seed must not be a callable client RPC");
assert.equal(sql("SELECT has_function_privilege('anon',"+
 "'private.seed_verified_forge_progression_creator_v1()','EXECUTE')"),"f");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.materialize_player_forge_feat_instances_v1()'::regprocedure))"),
 "c27c4181a51cfd018bbb8244e9931550","original immediate grant materializer stays untouched");
assert.equal(sql("SELECT md5(pg_get_functiondef('private.sync_character_progression_from_sheet_v1()'::regprocedure))"),
 "bb1a3a2d1600ce33cd4fcadac5e0f3a9","original sheet sync stays untouched");
console.log("PASS C34-T7-GREEN01: exact held #324 local-only BEFORE INSERT creator seed installed after RED; original handlers and private ACL unchanged");

const freshAttributionPayload=JSON.parse(JSON.stringify(grantPayload));
freshAttributionPayload.creation_request_id=randomUUID();
freshAttributionPayload.name="C34 T7 attributed v3 "+freshAttributionPayload.creation_request_id.slice(0,8);
const actorGrant=await createSubclass(freshAttributionPayload);
assert.ifError(actorGrant.error);
const actorGrantId=actorGrant.data;
assert.equal(sql("SELECT created_by::text FROM public.character_progression WHERE character_id="+quote(actorGrantId)),holder.id);
assert.equal(sql("SELECT creator_user_id::text FROM private.character_creator_attribution WHERE character_id="+quote(actorGrantId)),holder.id);
for(const table of ["public.character_option_grant_instances","public.character_option_grants"]){
 assert.equal(sql("SELECT granted_by::text FROM "+table+" WHERE character_id="+quote(actorGrantId)),holder.id,
   "new original "+table+" grant must be attributed to signed actor before immediate AFTER INSERT");
 assert.equal(one(table,"character_id="+quote(actorGrantId)),1);
}
assert.equal(one("public.inventory_items","owner_type='character' AND owner_id="+quote(actorGrantId)),1);
console.log("PASS C34-T7-GREEN02: signed original v3 character receives one source-owned instance+aggregate feat with verified creator in BOTH grants");

assert.equal(hashRows("public.character_option_grant_instances",grantWhere),redInstanceFingerprint,
 "T7 MUST NOT backfill legacy instance grant or rewrite historical row hashes");
assert.equal(hashRows("public.character_option_grants",grantWhere),redAggregateFingerprint,
 "T7 MUST NOT backfill legacy aggregate grant or rewrite historical row hashes");
assert.equal(sql("SELECT granted_by IS NULL FROM public.character_option_grant_instances "+
 "WHERE character_id="+quote(grantCharacterId)),"t");
assert.equal(sql("SELECT granted_by IS NULL FROM public.character_option_grants "+
 "WHERE character_id="+quote(grantCharacterId)),"t");
console.log("PASS C34-T7-GREEN03: historical NULL grants and their complete row hashes unchanged after prospective-only seed");

const attributedWhere="character_id="+quote(actorGrantId);
const attributedBefore={
 instance:hashRows("public.character_option_grant_instances",attributedWhere),
 aggregate:hashRows("public.character_option_grants",attributedWhere),
 gear:hashRows("public.inventory_items","owner_type='character' AND owner_id="+quote(actorGrantId))
};
const sameActorGrant=await createSubclass(freshAttributionPayload);
assert.ifError(sameActorGrant.error);
assert.equal(sameActorGrant.data,actorGrantId);
const spoofedSameNonce=JSON.parse(JSON.stringify(freshAttributionPayload));
spoofedSameNonce.sheet.featGrantInstances[0].acquisitionOwnerKey="nonce-tamper";
rejected(await createSubclass(spoofedSameNonce),"attributed grant nonce ownership tamper","22023");
assert.deepEqual({
 instance:hashRows("public.character_option_grant_instances",attributedWhere),
 aggregate:hashRows("public.character_option_grants",attributedWhere),
 gear:hashRows("public.inventory_items","owner_type='character' AND owner_id="+quote(actorGrantId))
},attributedBefore);
console.log("PASS C34-T7-GREEN04: signed source-attributed grant and gear hashes identical on retry; changed owner nonce blocked");

const v2actor=await signed("v2-no-nonce");
const v2NoNonce=sourceAuthority(randomUUID());
v2NoNonce.name="C34 T7 v2 fresh no nonce "+randomUUID().slice(0,8);
delete v2NoNonce.creation_request_id;
const v2created=await rpc(v2actor,"create_player_character_v2",{
 p_payload:v2NoNonce,p_spell_choices:[]
});
assert.ifError(v2created.error);
assert.equal(sql("SELECT creation_request_id IS NULL FROM public.characters WHERE id="+quote(v2created.data)),"t");
assert.equal(sql("SELECT creator_user_id::text FROM private.character_creator_attribution WHERE character_id="+quote(v2created.data)),v2actor.id);
assert.equal(sql("SELECT created_by::text FROM public.character_progression WHERE character_id="+quote(v2created.data)),v2actor.id);
for(const table of ["public.character_option_grant_instances","public.character_option_grants"])
 assert.equal(sql("SELECT granted_by::text FROM "+table+" WHERE character_id="+quote(v2created.data)),v2actor.id);
console.log("PASS C34-T7-GREEN05: separate signed original direct-v2 no-nonce creation binds same-transaction creator to BOTH source grants");

const outsiderNonce=randomUUID();
const outsiderPayload=sourceAuthority(outsiderNonce);
outsiderPayload.name="C34 T7 other real actor "+outsiderNonce.slice(0,8);
outsiderPayload.created_by=holder.id;
outsiderPayload.sheet.meta.creator="forged_client_identity";
const otherActor=await rpc(outsider,"create_player_character_v3",{
 p_payload:outsiderPayload,p_spell_choices:[],p_magic_selections:[]
});
assert.ifError(otherActor.error);
assert.notEqual(otherActor.data,actorGrantId);
assert.equal(sql("SELECT created_by::text FROM public.character_progression WHERE character_id="+quote(otherActor.data)),outsider.id);
assert.equal(sql("SELECT creator_user_id::text FROM private.character_creator_attribution WHERE character_id="+quote(otherActor.data)),outsider.id);
for(const table of ["public.character_option_grant_instances","public.character_option_grants"])
 assert.equal(sql("SELECT granted_by::text FROM "+table+" WHERE character_id="+quote(otherActor.data)),outsider.id);
console.log("PASS C34-T7-GREEN06: independent signed identity overrides spoofed client metadata; no cross-actor grant attribution");

const attributedRace=JSON.parse(JSON.stringify(freshAttributionPayload));
attributedRace.creation_request_id=randomUUID();
attributedRace.name="C34 T7 same nonce race "+attributedRace.creation_request_id.slice(0,8);
const race=await Promise.all([createSubclass(attributedRace),createSubclass(attributedRace)]);
for(const resp of race)assert.ifError(resp.error);
assert.equal(race[0].data,race[1].data);
assert.equal(one("public.characters","creation_request_id="+quote(attributedRace.creation_request_id)),1);
assert.equal(one("private.player_creation_intent_reservations_v1","request_id="+quote(attributedRace.creation_request_id)),1);
for(const table of ["public.character_option_grant_instances","public.character_option_grants"]){
 assert.equal(one(table,"character_id="+quote(race[0].data)),1);
 assert.equal(sql("SELECT granted_by::text FROM "+table+" WHERE character_id="+quote(race[0].data)),holder.id);
}
assert.equal(one("public.inventory_items","owner_type='character' AND owner_id="+quote(race[0].data)),1);
console.log("PASS C34-T7-GREEN07: simultaneous JWT same nonce results in one correctly-attributed character, both grants and gear");

const malformedAfterSeed=sourceAuthority(randomUUID());
malformedAfterSeed.name="C34 T7 malformed after verified actor "+randomUUID().slice(0,8);
malformedAfterSeed.sheet.featGrantInstances[0].fixedSpellTokens={invalid:true};
const beforeFailed=grantCounts();
const beforeAttribution=Number(sql("SELECT count(*) FROM private.character_creator_attribution"));
const failedAfterSeed=await createSubclass(malformedAfterSeed);
rejected(failedAfterSeed,"malformed source grant after original creator seed","23514");
assert.deepEqual(grantCounts(),beforeFailed,"creator seed failure must rollback all original Forge data");
assert.equal(Number(sql("SELECT count(*) FROM private.character_creator_attribution")),beforeAttribution,
 "same-transaction creator record must rollback with rejected source grant");
assert.equal(one("public.characters","creation_request_id="+quote(malformedAfterSeed.creation_request_id)),0);
console.log("PASS C34-T7-GREEN08: invalid source after verified creator seed rolls back attribution/character/nonce/grants/equipment");

const gmNonce=randomUUID();
const gmOriginal=await rpc(admin,"create_character_v1",{
 p_payload:{
  name:"C34 T7 original GM NPC "+gmNonce.slice(0,8),kind:"npc",
  creation_request_id:gmNonce,
  sheet:{classKey:"fighter",level:1,notes:"admin npc, not player Forge",meta:{creator:"gm-admin"}}
 }
});
assert.ifError(gmOriginal.error);
assert.equal(one("public.characters","id="+quote(gmOriginal.data)),1);
assert.equal(one("public.character_option_grant_instances","character_id="+quote(gmOriginal.data)),0);
assert.equal(one("public.character_option_grants","character_id="+quote(gmOriginal.data)),0);
assert.equal(sql("SELECT creator_user_id::text FROM private.character_creator_attribution WHERE character_id="+quote(gmOriginal.data)),admin.id);
const gmProgression=sql("SELECT count(*) FROM public.character_progression WHERE character_id="+quote(gmOriginal.data));
if(gmProgression==="1")assert.equal(
 sql("SELECT coalesce(created_by::text,'<null>') FROM public.character_progression WHERE character_id="+quote(gmOriginal.data)),
 "<null>","Admin NPC direct sheet must not gain forged player Forge creator seed");
console.log("PASS C34-T7-GREEN09: original GM Admin NPC creation remains separate; no player feat-grant or false player-Forge provenance");

const forgedDirect=await holder.client.from("character_option_grant_instances")
 .insert({character_id:actorGrantId,option_name:"Lucky",instance_key:"t7-user-forged"})
 .select("id");
assert.ok(forgedDirect.error,"creator seed cannot open canonical grant INSERT to direct caller");
const forgedAggregate=await outsider.client.from("character_option_grants")
 .insert({character_id:actorGrantId,option_id:"00000000-0000-0000-0000-000000009154"})
 .select("id");
assert.ok(forgedAggregate.error,"other actor cannot grant option to someone else's character");
assert.equal(sql("SELECT secret FROM public.characters WHERE id="+quote(characterId)),
 "C34_GM_SECRET_STAYS_PRIVATE");
assert.equal(sql("SELECT sheet->>'source' FROM public.players WHERE user_id="+quote(holder.id)),
 "ORIGINAL_NONEMPTY","older nonempty holder account sheet not altered by T7");
console.log("PASS C34-T7-GREEN10: direct authenticated grants still denied, GM secrets and historical nonempty account sheet preserved");
console.log("C34 T7 SIGNED RED->GREEN PASS: original #324 verified creator BEFORE INSERT, original 15/31+2 held privacy+1 held attribution +5 downstream grant hooks; historical NULL grants untouched; NOT merge/production acceptance");
