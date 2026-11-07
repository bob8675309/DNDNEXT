#!/usr/bin/env node
// C3.3: source-original Forge v2/v3 + candidate NPC privacy stages 1–3.
// Disposable PG17/PostgREST/GoTrue ONLY. Never use a production URL or JWT.
// Exact original RPC fingerprints are verified by the setup fixture. This is
// a genuine signed source-RPC test, NOT the complete 31-trigger Forge graph.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const env=process.env;
for(const [key,value] of Object.entries({
 GITHUB_ACTIONS:"true",CI:"true",
 DNDNEXT_C33_FORGE_PRIVACY_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_ONLY",
 PGHOST:"127.0.0.1",PGPORT:"54322",PGDATABASE:"postgres"
})) assert.equal(env[key],value,"Unsafe fixture: "+key);
assert.match(env.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(env.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_ANON_KEY);
const makeClient=()=>createClient(env.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_URL,
 env.DNDNEXT_C33_FORGE_PRIVACY_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const sql=(query)=>{
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",query],
   {env:{...env,PGUSER:"postgres"},encoding:"utf8",timeout:20000});
 assert.equal(r.status,0,"Disposable-only SQL error: "+r.stderr);
 return r.stdout.trim();
};
const sqlFile=(file)=>{
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-f",file],
   {env:{...env,PGUSER:"postgres"},encoding:"utf8",timeout:20000});
 assert.equal(r.status,0,"Disposable-only staged SQL error ("+file+"): "+r.stderr);
};
const pause=(ms)=>new Promise(done=>setTimeout(done,ms));
async function rpc(who,name,args) {
 for(let i=0;i<50;i++){
   const r=await who.rpc(name,args);
   if(r.error?.code==="PGRST202"){await pause(180);continue;}
   return r;
 }
 throw Error("Disposable PostgREST did not load RPC "+name);
}
function ok(v,label){assert.ifError(v.error);assert.ok(v.data,label+" missing data");return v.data}
function reject(v,label){assert.ok(v.error,label+" unexpectedly succeeded");return v.error}
const id=(n)=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
const password="C33-Original-"+randomUUID()+"!";
const names=["ADMIN","CREATOR","COEDITOR","INV_ONLY","CONV_ONLY","OUTSIDER"];
const people={};
for(const role of names){
 const who=makeClient();
 const email="c33-original-"+randomUUID()+"@example.invalid";
 const signed=await who.auth.signUp({email,password});
 assert.ifError(signed.error);
 const signin=await who.auth.signInWithPassword({email,password});
 assert.ifError(signin.error);
 const user=await who.auth.getUser();
 const claims=await who.auth.getClaims();
 assert.ifError(user.error);assert.ifError(claims.error);
 assert.equal(claims.data.claims.sub,user.data.user.id);
 assert.equal(claims.data.claims.role,"authenticated");
 people[role]={who,id:user.data.user.id};
}
sql("INSERT INTO private.test_admins(id) VALUES ('"+people.ADMIN.id+"')");
const gmPayload={
 name:"C33 preexisting legacy GM NPC",kind:"npc",creation_request_id:id(7401),
 creator_user_id:people.CREATOR.id,secret:"C33_GM_SECRET_NEVER_PUBLIC",
 background:"Legacy GM background",description:"Public NPC",
 sheet:{profileReveal:{background:true,secret:true},gmNotes:"C33_DEEP_GM_SHEET_ONLY"}
};
const oldNpc=ok(await rpc(people.ADMIN.who,"create_character_v1",{p_payload:gmPayload}),
 "pre-stage GM NPC");
sql("UPDATE public.characters SET is_hidden=false WHERE id='"+oldNpc+"'");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE id='"+oldNpc+"'"),"1");
// Original v2 accepts a browser-controlled GM-only secret at INSERT.
// Preserve a concrete BEFORE-stage negative baseline; no existing data is
// silently rewritten by the later security candidate.
const oldPlayerWithForgedGmSecret=ok(await rpc(people.CREATOR.who,
 "create_player_character_v2",{p_payload:{
  name:"C33 legacy player-supplied GM secret",creation_request_id:id(7399),
  secret:"C33_UNSAFE_PLAYER_GM_FIELD",
  sheet:{classKey:"fighter",level:1}
 },p_spell_choices:[]}),"pre-stage original player GM secret");
assert.equal(sql("SELECT secret FROM public.characters WHERE id='"+oldPlayerWithForgedGmSecret+"'"),
 "C33_UNSAFE_PLAYER_GM_FIELD");
console.log("PASS C3J01: exact original NPC/Forge creation and EXPECTED UNSAFE original player-supplied GM secret baseline");

for(const file of [
 "sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql",
 "sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql",
 "sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql"
]) sqlFile(file);
sql("NOTIFY pgrst,'reload schema'");
assert.equal(sql("SELECT count(*) FROM private.character_creator_attribution WHERE character_id='"+oldNpc+"'"),"0",
 "Historical NPCs must NOT receive invented creator provenance");
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.characters'::regclass AND tgname='characters_capture_creator_at_insert_v1' AND NOT tgisinternal"),"1");
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.characters'::regclass AND tgname='characters_guard_player_gm_secret_at_insert_v1' AND NOT tgisinternal"),"1");
assert.equal(sql("SELECT has_function_privilege('authenticated','private.record_character_creator_v1(uuid)','EXECUTE')"),"f");
assert.equal(sql("SELECT has_table_privilege('authenticated','private.character_creator_attribution','INSERT')"),"f");
const forgedGmPayload={name:"C33 client attempts GM secret",creation_request_id:id(7406),
 secret:"C33_FORGED_NEW_GM_SECRET",sheet:{classKey:"fighter",level:1}};
const forgedGm=await rpc(people.CREATOR.who,"create_player_character_v2",{
 p_payload:forgedGmPayload,p_spell_choices:[]
});
assert.equal(reject(forgedGm,"player-supplied GM secret at original v2").code,"42501");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE creation_request_id='"+id(7406)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM private.character_creator_attribution WHERE creator_user_id='"+people.CREATOR.id+"'"),"0");
assert.equal(sql("SELECT secret FROM public.characters WHERE id='"+oldPlayerWithForgedGmSecret+"'"),
 "C33_UNSAFE_PLAYER_GM_FIELD","No retroactive mutation of existing values");
console.log("PASS C3J02: stages 1-3 installed, original creator trigger plus GM-insert guard; new player GM secret injection rejected and old records not silently rewritten");

const wizard=id(901),missingSpell=id(9999999);
const v2Payload={name:"C33 original v2 Fighter",creation_request_id:id(7402),
 creator_user_id:people.OUTSIDER.id,
 background:"C33_PRIVATE_BACKGROUND",motivation:"C33_PRIVATE_MOTIVATION",
 sheet:{classKey:"fighter",level:1,marker:"C33_V2_SHEET",gmNotes:"C33_SHEET_NO_PUBLIC_PROFILE"}};
const v3Payload={name:"C33 original v3 Wizard",creation_request_id:id(7403),
 creator_user_id:people.OUTSIDER.id,
 background:"C33_WIZARD_PRIVATE",sheet:{classKey:"wizard",level:1,marker:"C33_V3_SHEET"}};
const call2=(p)=>rpc(people.CREATOR.who,"create_player_character_v2",
 {p_payload:p,p_spell_choices:[]});
const call3=(p,magic=[])=>rpc(people.CREATOR.who,"create_player_character_v3",
 {p_payload:p,p_spell_choices:[],p_magic_selections:magic});
const created2=ok(await call2(v2Payload),"original v2");
const created3=ok(await call3(v3Payload,[{
 spell_id:wizard,source_type:"class",access_type:"class-list"
}]),"original v3");
assert.notEqual(created2,created3);
for(const [char,marker] of [[created2,"C33_V2_SHEET"],[created3,"C33_V3_SHEET"]]){
 assert.equal(sql("SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id='"+char+"'"),people.CREATOR.id);
 assert.equal(sql("SELECT sheet->>'marker' FROM public.character_sheets WHERE character_id='"+char+"'"),marker);
 assert.equal(sql("SELECT count(*) FROM public.character_permissions WHERE character_id='"+char+"' AND user_id='"+people.CREATOR.id+"' AND can_edit"),"1");
 assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+char+"'"),"1");
}
assert.equal(sql("SELECT count(*) FROM public.character_spells WHERE character_id='"+created3+"'"),"1");
assert.equal(sql("SELECT count(*) FROM private.character_creator_attribution WHERE character_id IN ('"+created2+"','"+created3+"')"),"2");
console.log("PASS C3J03: original v2/v3 SQL, signed GoTrue origin, canonical sheets/permissions/progression/events/spell and immutable creator captured inside creation");

const v2Repeat=ok(await call2(v2Payload),"v2 same nonce");
assert.equal(v2Repeat,created2);
assert.equal(sql("SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id='"+created2+"'"),people.CREATOR.id);
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+created2+"'"),"1");
const forgedNpc=ok(await rpc(people.ADMIN.who,"create_character_v1",{
 p_payload:{name:"C33 GM-created NPC",kind:"npc",creation_request_id:id(7404),
  creator_user_id:people.OUTSIDER.id,secret:"C33_ADMIN_CREATED_GM_SECRET",sheet:{profileReveal:{background:false}}}
}),"original Admin NPC");
assert.equal(sql("SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id='"+forgedNpc+"'"),people.ADMIN.id);
assert.equal(sql("SELECT secret FROM public.characters WHERE id='"+forgedNpc+"'"),"C33_ADMIN_CREATED_GM_SECRET");
console.log("PASS C3J04: original same-nonce v2 replay stays creator-bound, Admin-created NPC is attributed to signed GM not forged payload");

const broken={...v3Payload,name:"C33 atomically rejected v3",creation_request_id:id(7405)};
const beforeAttrs=Number(sql("SELECT count(*) FROM private.character_creator_attribution"));
const beforePlayers=sql("SELECT md5(sheet::text) FROM public.players WHERE user_id='"+people.CREATOR.id+"'");
reject(await call3(broken,[{spell_id:missingSpell,source_type:"class",access_type:"class-list"}]),
 "Original v3 invalid post-v2 canonical spell");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE creation_request_id='"+id(7405)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM public.character_sheets WHERE character_id IN (SELECT id FROM public.characters WHERE name='C33 atomically rejected v3')"),"0");
assert.equal(Number(sql("SELECT count(*) FROM private.character_creator_attribution")),beforeAttrs);
assert.equal(sql("SELECT md5(sheet::text) FROM public.players WHERE user_id='"+people.CREATOR.id+"'"),beforePlayers);
console.log("PASS C3J05: original nested v3 failed after v2 insert; SQL transaction rolled back character, sheet, attribution and account snapshot");

for(const [role,grant] of [["COEDITOR",[true,true,false]],["INV_ONLY",[false,true,false]],["CONV_ONLY",[false,false,true]]]){
 sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) VALUES ('"+
 created2+"','"+people[role].id+"',"+grant.join(",")+")");
}
const editorSheet=await people.CREATOR.who.from("character_sheets").select("sheet").eq("character_id",created2).maybeSingle();
assert.ifError(editorSheet.error);
assert.equal(editorSheet.data.sheet.marker,"C33_V2_SHEET");
const coSheet=await people.COEDITOR.who.from("character_sheets").select("sheet").eq("character_id",created2).maybeSingle();
assert.ifError(coSheet.error);
assert.equal(coSheet.data.sheet.marker,"C33_V2_SHEET");
for(const role of ["INV_ONLY","CONV_ONLY","OUTSIDER"]){
 const read=await people[role].who.from("character_sheets").select("sheet").eq("character_id",created2);
 assert.ifError(read.error);
 assert.deepEqual(read.data,[],role+" cannot SELECT editor-only sheet");
}
const anonSheet=await makeClient().from("character_sheets").select("sheet").eq("character_id",created2);
assert.ok(anonSheet.error||!anonSheet.data?.length);
const forbiddenColumn=await people.CREATOR.who.from("characters").select("background").eq("id",created2);
assert.ok(forbiddenColumn.error,"Stage2 must block direct narrative SELECT for authenticated creator too");
console.log("PASS C3J06: stage1 full-sheet RLS, stage2 role-wide private column revoke; signed editor/co-editor allowed, inventory/convert/outsider/anon denied");

const creatorNarrative=ok(await rpc(people.CREATOR.who,"get_character_editor_narrative_v1",
 {p_character_id:created2}),"creator narrative");
assert.equal(creatorNarrative.background,"C33_PRIVATE_BACKGROUND");
assert.equal(creatorNarrative.motivation,"C33_PRIVATE_MOTIVATION");
assert.ok(!("secret" in creatorNarrative));
const coNarrative=ok(await rpc(people.COEDITOR.who,"get_character_editor_narrative_v1",
 {p_character_id:created2}),"co-editor narrative");
assert.equal(coNarrative.background,creatorNarrative.background);
for(const role of ["INV_ONLY","CONV_ONLY","OUTSIDER"]){
 const result=await rpc(people[role].who,"get_character_editor_narrative_v1",
 {p_character_id:created2});
 assert.ifError(result.error);
 assert.equal(result.data,null,role+" must not read editor narrative");
}
const pcAll=ok(await rpc(people.CREATOR.who,"get_my_player_characters_v2",{}),"creator PC serializer");
const result2=pcAll.find(row=>row.id===created2),result3=pcAll.find(row=>row.id===created3);
assert.equal(result2.character_sheet.marker,"C33_V2_SHEET");
assert.equal(result3.character_sheet.marker,"C33_V3_SHEET");
for(const row of pcAll)assert.ok(!("secret" in row),"Full PC reader leaked GM secret");
const inventoryList=ok(await rpc(people.INV_ONLY.who,"get_my_player_characters_v2",{}),"inventory-only PC serializer");
const invRow=inventoryList.find(row=>row.id===created2);
assert.ok(invRow);assert.deepEqual(invRow.character_sheet,{});assert.ok(!("background" in invRow));
console.log("PASS C3J07: separated editor narrative, sanitized full PC v2/v3 serializer and inventory-only roster retain permissions without GM private data");

const unauthorizedDossier=await rpc(people.COEDITOR.who,"get_npc_dossier_admin_v1",{p_character_id:created2});
assert.equal(reject(unauthorizedDossier,"co-editor GM dossier").code,"42501");
const gmDossier=ok(await rpc(people.ADMIN.who,"get_npc_dossier_admin_v1",
 {p_character_id:oldNpc}),"GM dossier");
assert.equal(gmDossier.secret,"C33_GM_SECRET_NEVER_PUBLIC");
const publicNpc=ok(await rpc(people.OUTSIDER.who,"get_npc_profile_visible_v1",
 {p_character_id:oldNpc}),"outsider safe NPC");
assert.equal(publicNpc.lore.background,"Legacy GM background");
assert.ok(!JSON.stringify(publicNpc).includes("C33_GM_SECRET_NEVER_PUBLIC"));
assert.ok(!JSON.stringify(publicNpc).includes("C33_DEEP_GM_SHEET_ONLY"));
const gmSecrets=await rpc(people.ADMIN.who,"get_character_secrets_v1",{p_character_ids:[oldNpc]});
assert.ifError(gmSecrets.error);
assert.equal(gmSecrets.data[0].secret,"C33_GM_SECRET_NEVER_PUBLIC");
const editorSecrets=await rpc(people.COEDITOR.who,"get_character_secrets_v1",{p_character_ids:[oldNpc]});
assert.ifError(editorSecrets.error);assert.deepEqual(editorSecrets.data,[]);
const creatorSecretEdit=await rpc(people.CREATOR.who,"set_character_secret_v1",
 {p_character_id:created2,p_secret:"FORBIDDEN"});
assert.equal(reject(creatorSecretEdit,"non-GM GM Secret writer").code,"42501");
console.log("PASS C3J08: GM-only dossier/legacy secret and independently allowlisted outsider profile, no sheet-derived GM secret");

for(const role of ["CREATOR","COEDITOR","INV_ONLY","CONV_ONLY"]){
 const r=await rpc(people[role].who,"can_edit_creator_backstory_v1",{p_character_id:created2});
 assert.ifError(r.error);
 assert.equal(r.data,role==="CREATOR",role+" creator-backstory capability");
}
const oldCreatorGate=await rpc(people.CREATOR.who,"can_edit_creator_backstory_v1",{p_character_id:oldNpc});
assert.ifError(oldCreatorGate.error);assert.equal(oldCreatorGate.data,false);
const creatorStory=await people.CREATOR.who.from("character_backstory_secrets").insert({
 character_id:created2,secret_text:"C33_ORIGINAL_CREATOR_PRIVATE_STORY"
}).select("secret_text").single();
assert.ifError(creatorStory.error);
for(const role of ["COEDITOR","INV_ONLY","CONV_ONLY","OUTSIDER"]){
 const read=await people[role].who.from("character_backstory_secrets").select("secret_text")
 .eq("character_id",created2);
 assert.ifError(read.error);assert.deepEqual(read.data,[],role+" sees private creator text");
}
const gmStory=await people.ADMIN.who.from("character_backstory_secrets").select("secret_text")
 .eq("character_id",created2).single();
assert.ifError(gmStory.error);
assert.equal(gmStory.data.secret_text,"C33_ORIGINAL_CREATOR_PRIVATE_STORY");
console.log("PASS C3J09: true v2 origin creator-only private story; co-editor cannot access it, GM can, legacy NPC remains unattributed");

const updated={...coSheet.data.sheet,marker:"C33_COEDITOR_SHEET_UPDATED"};
const write=await people.COEDITOR.who.from("character_sheets").update({sheet:updated})
 .eq("character_id",created2).select("sheet").single();
assert.ifError(write.error);
assert.equal(write.data.sheet.marker,"C33_COEDITOR_SHEET_UPDATED");
const forbiddenWrite=await people.INV_ONLY.who.from("character_sheets").update({sheet:{marker:"INVENTORY_FORGED"}})
 .eq("character_id",created2).select("sheet");
assert.ifError(forbiddenWrite.error);assert.deepEqual(forbiddenWrite.data,[]);
assert.equal(sql("SELECT sheet->>'marker' FROM public.character_sheets WHERE character_id='"+created2+"'"),"C33_COEDITOR_SHEET_UPDATED");
sql("UPDATE public.character_permissions SET can_edit=false,can_inventory=true WHERE character_id='"+created2+"' AND user_id='"+people.CREATOR.id+"'");
const revoked=await rpc(people.CREATOR.who,"can_edit_creator_backstory_v1",{p_character_id:created2});
assert.ifError(revoked.error);assert.equal(revoked.data,false);
const revokedStory=await people.CREATOR.who.from("character_backstory_secrets").select("secret_text").eq("character_id",created2);
assert.ifError(revokedStory.error);assert.deepEqual(revokedStory.data,[]);
const stillCoEdit=await rpc(people.COEDITOR.who,"get_character_editor_narrative_v1",{p_character_id:created2});
assert.ifError(stillCoEdit.error);assert.equal(stillCoEdit.data.background,"C33_PRIVATE_BACKGROUND");
assert.equal(sql("SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id='"+created2+"'"),people.CREATOR.id);
console.log("PASS C3J10: legitimate co-editor canonical sheet write, inventory-only write denied; revoked original creator loses private capability without changing immutable provenance");

const anon=await rpc(makeClient(),"get_npc_dossier_admin_v1",{p_character_id:oldNpc});
assert.ok(anon.error,"Anonymous must never execute GM dossier");
const anonCreate=await rpc(makeClient(),"create_player_character_v2",
 {p_payload:{name:"C33 anonymous",sheet:{classKey:"fighter",level:1}},p_spell_choices:[]});
assert.ok(anonCreate.error,"Anonymous cannot call original Forge v2");
console.log("PASS C3J11: anonymous GM/creation APIs remain blocked; original sources and staged privacy integrate with genuine JWTs");
console.log("C3.3 ORIGINAL FORGE + PRIVACY JOINT TEST PASS (C3J00–C3J11). Scope: true original create_character_v1, create_player_character_v2/v3, stage1–3 and signed Auth, but NOT the 31-trigger/market/full-NewNpcModalV3-browser release gate.");
