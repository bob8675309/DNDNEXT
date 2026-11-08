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
sqlFile("scripts/fixtures/c33_forge_original_sprite_guard_local_pg17.sql");
sqlFile("scripts/fixtures/c33_forge_original_levelup_cancel_local_pg17.sql");
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

const privateStoryPayload={
  name:"C33 signed original v3 with private story",creation_request_id:id(7419),
  secret:null, sheet:{classKey:"fighter",level:1,marker:"C33_ATOMIC_STORY"}
};
const createWithStory=(payload,secretText,who=people.CREATOR.who)=>rpc(
 who,"create_player_character_with_private_backstory_v1",{
  p_payload:payload,p_spell_choices:[],p_magic_selections:[],
  p_private_backstory:secretText
 });
const storyText="C33 my authored secret is NOT GM secret, retained as creator-private";
const storyCreated=ok(await createWithStory(privateStoryPayload,storyText),
  "signed original v3 with creator-private story");
assert.equal(sql("SELECT secret IS NULL FROM public.characters WHERE id='"+storyCreated+"'"),"t");
assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id='"+
 storyCreated+"'"),storyText);
assert.equal(sql("SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id='"+
 storyCreated+"'"),people.CREATOR.id);
assert.equal(sql("SELECT sheet->>'marker' FROM public.character_sheets WHERE character_id='"+
 storyCreated+"'"),"C33_ATOMIC_STORY");
assert.equal(ok(await createWithStory(privateStoryPayload,storyText),
 "same nonce private story replay"),storyCreated);
assert.equal(sql("SELECT count(*) FROM public.character_backstory_secrets WHERE character_id='"+
 storyCreated+"'"),"1");
console.log("PASS C3S01: real signed v3 wrapper creates source-original sheet and creator-private story atomically without GM Secret; same-nonce replay retains one row");

const unauthorizedReplay=await createWithStory(privateStoryPayload,"FORGED COEDITOR STORY",people.OUTSIDER.who);
assert.ok(unauthorizedReplay.error,"Unrelated actor must not overwrite another creator private story");
assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id='"+
 storyCreated+"'"),storyText);
const injectedPayload={...privateStoryPayload,creation_request_id:id(7425),secret:"GM-SECRET-BY-CREATOR"};
const injected=await createWithStory(injectedPayload,"CREATOR PRIVATE ONLY");
assert.equal(reject(injected,"wrapper GM-secret injection").code,"42501");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE creation_request_id='"+id(7425)+"'"),"0");
const invalidPrivatePayload={...privateStoryPayload,creation_request_id:id(7426),
 name:"C33 private story fails after original v3"};
const beforeStoryAttrs=sql("SELECT count(*) FROM private.character_creator_attribution");
const tooLongStory=await createWithStory(invalidPrivatePayload,"x".repeat(16001));
assert.equal(reject(tooLongStory,"private story check rollback").code,"23514");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE creation_request_id='"+id(7426)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM private.character_creator_attribution"),beforeStoryAttrs);
console.log("PASS C3S02: forged replay and GM-secret injection blocked; invalid private text rolls back original v3 character, sheet and provenance");

const explicitlyEditedStory="C33 creator subsequently revised their own private Story";
const savedStory=await people.CREATOR.who.from("character_backstory_secrets")
  .update({secret_text:explicitlyEditedStory}).eq("character_id",storyCreated)
  .select("secret_text").single();
assert.ifError(savedStory.error);
assert.equal(savedStory.data.secret_text,explicitlyEditedStory);
assert.equal(ok(await createWithStory(privateStoryPayload,storyText),
 "stale original nonce replay after creator Story edit"),storyCreated);
assert.equal(sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id='"+
 storyCreated+"'"),explicitlyEditedStory,"Creation retry must never overwrite subsequent edits");
assert.equal(sql("SELECT count(*) FROM public.character_backstory_secrets WHERE character_id='"+
 storyCreated+"'"),"1");
console.log("PASS C3S03: same-nonce original v3 retry cannot replace newer creator-authored private backstory");


// C3V: a genuinely missing original creation BEFORE INSERT visual/sprite guard,
// now installed alongside all three NPC privacy stages, not a frontend rewrite.
const validAsset=id(7421),invalidAsset=id(7422),portrait=id(7420);
const validVisualNpc=ok(await rpc(people.ADMIN.who,"create_character_v1",{
 p_payload:{name:"C33 GM source-authentic 8dir sprite",kind:"npc",
  creation_request_id:id(7423),visual_asset_id:validAsset,
  portrait_library_id:portrait,sprite_path:"forged-client-override.png"}
}),"Admin original NPC with valid 8dir visual asset");
assert.equal(sql("SELECT sprite_path FROM public.characters WHERE id='"+validVisualNpc+"'"),
 "c33/valid-8dir.png");
assert.equal(sql("SELECT sprite_scale::text FROM public.characters WHERE id='"+validVisualNpc+"'"),"0.42");
assert.equal(sql("SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id='"+
 validVisualNpc+"'"),people.ADMIN.id);
console.log("PASS C3V01: source-original visual BEFORE INSERT normalizes Admin sprite path/scale, independent of untrusted payload");

const beforeVisualAttrs=sql("SELECT count(*) FROM private.character_creator_attribution");
const badVisualNpc=await rpc(people.ADMIN.who,"create_character_v1",{p_payload:{
 name:"C33 bad sprite contract",kind:"npc",creation_request_id:id(7424),
 visual_asset_id:invalidAsset,portrait_library_id:portrait
}});
const badSprite=reject(badVisualNpc,"source-original invalid active 8-direction sprite");
assert.match(badSprite.message,/does not satisfy the DNDNext 8-direction runtime contract/);
assert.equal(sql("SELECT count(*) FROM public.characters WHERE creation_request_id='"+id(7424)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM private.character_creator_attribution"),beforeVisualAttrs);
console.log("PASS C3V02: source-original sprite trigger rejects invalid active asset contract atomically");

const wizard=id(901),missingSpell=id(9999999);
const v2Payload={name:"C33 original v2 Fighter",creation_request_id:id(7402),
 creator_user_id:people.OUTSIDER.id,visual_asset_id:validAsset,
 portrait_library_id:portrait,
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
assert.equal(sql("SELECT sprite_path FROM public.characters WHERE id='"+created2+"'"),"c33/valid-8dir.png");
assert.equal(sql("SELECT sprite_key FROM public.characters WHERE id='"+created2+"'"),validAsset);
assert.equal(sql("SELECT sprite_scale::text FROM public.characters WHERE id='"+created2+"'"),"0.42");
console.log("PASS C3V03: signed original player Forge v2 also enters unchanged sprite guard with canonically enforced 8dir asset");
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

// Source-original level-up session cancellation trigger (historical missing
// trigger #2 now staged in the C3.3 scratch suite). These privileged state
// transitions isolate the trigger branch, NOT a user-facing progression API.
sql("INSERT INTO public.character_level_up_sessions(id,character_id,status) VALUES('"+
 id(7440)+"','"+created3+"','open')");
sql("UPDATE public.character_progression SET pending_level_up=true "+
 "WHERE character_id='"+created3+"'");
assert.equal(sql("SELECT status FROM public.character_level_up_sessions WHERE id='"+id(7440)+"'"),
 "open","Pending session should not be cancelled by the same-level true state");
sql("UPDATE public.character_progression SET pending_level_up=false "+
 "WHERE character_id='"+created3+"'");
assert.equal(sql("SELECT status FROM public.character_level_up_sessions WHERE id='"+id(7440)+"'"),
 "cancelled");
console.log("PASS C3L01: source-original level-up cancel trigger preserves true pending, then cancels open session when pending is cleared");

sql("INSERT INTO public.character_level_up_sessions(id,character_id,status) VALUES('"+
 id(7441)+"','"+created3+"','open')");
sql("UPDATE public.character_progression SET pending_level_up=true,class_level=2 "+
 "WHERE character_id='"+created3+"'");
assert.equal(sql("SELECT status FROM public.character_level_up_sessions WHERE id='"+id(7441)+"'"),
 "cancelled","Changed class level must cancel an open session even when pending stays true");
sql("UPDATE public.character_progression SET class_level=1,pending_level_up=false "+
 "WHERE character_id='"+created3+"'");
console.log("PASS C3L02: class-level change also cancels open session; disposable progression state restored");

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
console.log("PASS C3J00–C3J11 joint original Forge + staged privacy pre-inventory phase accepted");
// C3I: Research the source-original deferred equipment CHECK bug + guarded
// four-policy candidate within THIS SAME genuine signed-in original Forge v2/v3
// + three-stage NPC privacy database. Standalone J78–J102 remains untouched.
sqlFile("scripts/fixtures/c33_forge_privacy_inventory_join_setup_pg17.sql");
const equip=(name,nonce)=>({
 name,creation_request_id:nonce,
 sheet:{classKey:"fighter",level:1,
  startingEquipmentSelections:{mode:"package",classOption:"A",ruleset:"vanilla"}}
});
const firstEquipment=ok(await call2(equip("C33 prior-check starter",id(7410))),
 "original v2 equipment before legacy CHECK");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character' AND owner_id='"+
 firstEquipment+"' AND card_payload->>'startingEquipment'='true'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+firstEquipment+"'"),"1");
assert.equal(sql("SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id='"+
 firstEquipment+"'"),people.CREATOR.id);
console.log("PASS C3I01: original deferred equipment commits with staged NPC privacy before obsolete owner CHECK is recreated");

sqlFile("scripts/fixtures/forge_owner_constraint_deferred_creation_local_auth_pg17.sql");
sqlFile("scripts/fixtures/forge_inventory_policy_source_local_auth_pg17.sql");
assert.equal(sql("SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass "+
 "AND conname IN ('inventory_items_owner_type_check','inventory_items_owner_type_chk')"),"2");
assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),"4");
console.log("PASS C3I02: both original inventory owner CHECKs, two original item triggers and four pre-hardening RLS policies");

const oldChecksPayload=equip("C33 legacy blocked v2",id(7411));
const attrsBeforeBlocked=sql("SELECT count(*) FROM private.character_creator_attribution");
const accountBeforeBlocked=sql("SELECT md5(sheet::text) FROM public.players WHERE user_id='"+
 people.CREATOR.id+"'");
const oldChecks=await call2(oldChecksPayload);
assert.equal(reject(oldChecks,"original signed v2 under old owner CHECK").code,"23514");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE creation_request_id='"+id(7411)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM private.character_creator_attribution"),attrsBeforeBlocked);
assert.equal(sql("SELECT md5(sheet::text) FROM public.players WHERE user_id='"+
 people.CREATOR.id+"'"),accountBeforeBlocked);
const oldChecksV3=await call3(equip("C33 legacy blocked v3",id(7412)),[]);
assert.equal(reject(oldChecksV3,"original signed v3 under old owner CHECK").code,"23514");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE creation_request_id='"+id(7412)+"'"),"0");
assert.equal(sql("SELECT count(*) FROM private.character_creator_attribution"),attrsBeforeBlocked);
console.log("PASS C3I03: signed original v2 and nested v3 fail 23514 at deferred COMMIT; character/creator/account rollback");

sqlFile("sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql");
sql("NOTIFY pgrst,'reload schema'");
assert.equal(sql("SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass "+
 "AND conname='inventory_items_owner_type_chk'"),"0");
assert.equal(sql("SELECT convalidated FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass "+
 "AND conname='inventory_items_owner_type_check'"),"t");
console.log("PASS C3I04: exact guarded combined inventory policy + CHECK candidate applied only to disposable NPC privacy database");

const afterHardening=ok(await call2(oldChecksPayload),"original v2 after combined fix");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character' "+
 "AND owner_id='"+afterHardening+"' AND card_payload->>'startingEquipment'='true'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+afterHardening+"'"),"1");
assert.equal(sql("SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id='"+
 afterHardening+"'"),people.CREATOR.id);
const afterHardeningV3=ok(await call3(equip("C33 fixed nested v3",id(7413)),[]),
 "original nested v3 after combined fix");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character' "+
 "AND owner_id='"+afterHardeningV3+"' AND card_payload->>'startingEquipment'='true'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_currency WHERE character_id='"+afterHardeningV3+"'"),"1");
assert.equal(sql("SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id='"+
 afterHardeningV3+"'"),people.CREATOR.id);
console.log("PASS C3I05: signed original v2/v3 now atomically create character-owned item/currency/immutable creator under privacy stages 1–3");

const itemId=sql("SELECT id FROM public.inventory_items WHERE owner_type='character' "+
 "AND owner_id='"+afterHardening+"' ORDER BY id LIMIT 1");
const creatorItem=await people.CREATOR.who.from("inventory_items")
 .select("id,owner_type,owner_id").eq("id",itemId).maybeSingle();
assert.ifError(creatorItem.error);
assert.equal(creatorItem.data.owner_type,"character");
const outsiderItem=await people.OUTSIDER.who.from("inventory_items")
 .select("id").eq("id",itemId);
assert.ifError(outsiderItem.error);assert.deepEqual(outsiderItem.data,[]);
const forgedDirect=await people.CREATOR.who.from("inventory_items").insert({
 user_id:people.CREATOR.id,owner_type:"character",owner_id:created2,
 card_payload:{startingEquipment:false},item_name:"C33 unauthorized character inventory"
});
assert.ok(forgedDirect.error,"Direct character-owned INSERT was unexpectedly authorized");
const forcedUpdate=await people.CREATOR.who.from("inventory_items")
 .update({owner_type:"player",owner_id:people.CREATOR.id}).eq("id",itemId).select("id");
assert.ifError(forcedUpdate.error);assert.deepEqual(forcedUpdate.data,[]);
const forcedDelete=await people.CREATOR.who.from("inventory_items")
 .delete().eq("id",itemId).select("id");
assert.ifError(forcedDelete.error);assert.deepEqual(forcedDelete.data,[]);
assert.equal(sql("SELECT owner_type FROM public.inventory_items WHERE id='"+itemId+"'"),"character");
console.log("PASS C3I06: creator reads its materialized character gear but cannot directly mint, launder or delete character-owned inventory");

const playerOwned=await people.CREATOR.who.from("inventory_items").insert({
 user_id:people.CREATOR.id,owner_type:"player",owner_id:people.CREATOR.id,
 card_payload:{},item_name:"C33 legitimate player-owned"
}).select("id,owner_type").single();
assert.ifError(playerOwned.error);assert.equal(playerOwned.data.owner_type,"player");
const editedPlayerOwned=await people.CREATOR.who.from("inventory_items")
 .update({item_name:"C33 legitimate renamed player-owned"})
 .eq("id",playerOwned.data.id).select("item_name").single();
assert.ifError(editedPlayerOwned.error);
assert.equal(editedPlayerOwned.data.item_name,"C33 legitimate renamed player-owned");
const adminDirect=await people.ADMIN.who.from("inventory_items").insert({
 user_id:people.ADMIN.id,owner_type:"character",owner_id:afterHardening,
 card_payload:{},item_name:"C33 GM-granted item"
}).select("id,owner_type").single();
assert.ifError(adminDirect.error);assert.equal(adminDirect.data.owner_type,"character");
console.log("PASS C3I07: regular player-owned DML and explicit Admin character-owned item path preserved");

sql("UPDATE public.character_permissions SET can_edit=false,can_inventory=false "+
 "WHERE user_id='"+people.CREATOR.id+"' AND character_id='"+afterHardening+"'");
const nowDeniedItem=await people.CREATOR.who.from("inventory_items")
 .select("id").eq("id",itemId);
assert.ifError(nowDeniedItem.error);assert.deepEqual(nowDeniedItem.data,[]);
const adminStillReads=await people.ADMIN.who.from("inventory_items")
 .select("id").eq("id",itemId).single();
assert.ifError(adminStillReads.error);assert.equal(adminStillReads.data.id,itemId);
const stillCreator=sql("SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id='"+
 afterHardening+"'");
assert.equal(stillCreator,people.CREATOR.id);
console.log("PASS C3I08: revoked character access hides source-owned gear; Admin retains read, immutable creator receipt unchanged");

console.log("C3.3 ORIGINAL FORGE + PRIVACY + COMBINED INVENTORY CHECK/RLS JOINT TEST PASS (C3J00–C3J11, C3I00–C3I08, C3V00–C3V03, C3L00–C3L02). Source-original materializer/handlers, additional 8dir sprite guard and level-up cancel trigger; reduced helper/catalogues, NOT full 31-trigger/browser parity.");

