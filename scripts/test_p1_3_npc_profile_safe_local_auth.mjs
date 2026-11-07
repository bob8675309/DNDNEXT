#!/usr/bin/env node
// DNDNext P1.3 player-safe NPC Profile genuine local GoTrue/PostgREST test.
// ONLY free disposable GitHub CI. Never contact DnDWeb live API or DB.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const e=process.env;
for(const [key,value] of Object.entries({
 GITHUB_ACTIONS:"true",CI:"true",
 DNDNEXT_NPC_PROFILE_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_ONLY",
 PGHOST:"127.0.0.1",PGPORT:"54322",PGDATABASE:"postgres"
})) assert.equal(e[key],value, "Unsafe JWT fixture environment: "+key);
assert.match(e.DNDNEXT_NPC_PROFILE_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_NPC_PROFILE_LOCAL_ANON_KEY);

const client=()=>createClient(e.DNDNEXT_NPC_PROFILE_LOCAL_URL,
 e.DNDNEXT_NPC_PROFILE_LOCAL_ANON_KEY, {
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 });
function sql(statement) {
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{
  env:{...e,PGUSER:"postgres"},encoding:"utf8",timeout:16000
 });
 if(r.status!==0) throw Error("Disposable psql failed: "+r.stderr);
 return r.stdout.trim();
}
function sqlFile(path) {
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-f",path],{
  env:{...e,PGUSER:"postgres"},encoding:"utf8",timeout:16000
 });
 if(r.status!==0) throw Error("Disposable SQL candidate failed: "+r.stderr);
 return r.stdout;
}
const nap=ms=>new Promise(done=>setTimeout(done,ms));
async function rpc(who,name,args) {
 for(let i=0;i<35;i++){
  const r=await who.rpc(name,args);
  if(r.error?.code==="PGRST202"){await nap(150);continue;}
  return r;
 }
 throw Error("Local PostgREST schema did not load candidate "+name);
}

const roles=["ADMIN","EDITOR","COEDITOR","INV_ONLY","CONVERT_ONLY","OUTSIDER"];
const pwd="SafeProfile-"+randomUUID()+"-X4!";
const people={};
for(const name of roles){
 const who=client();
 const email="dndnext-profile-test-"+randomUUID()+"@example.invalid";
 const signup=await who.auth.signUp({email,password:pwd});
 assert.ifError(signup.error);
 const signin=await who.auth.signInWithPassword({email,password:pwd});
 assert.ifError(signin.error);
 const user=await who.auth.getUser();
 const claims=await who.auth.getClaims();
 assert.ifError(user.error);assert.ifError(claims.error);
 assert.equal(user.data.user.id,claims.data.claims.sub);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.notEqual(claims.data.claims.is_anonymous,true);
 people[name]={who,id:user.data.user.id};
}
const id=(n)=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
const visible=id(611),hidden=id(612),pc=id(613);
const secrets={
 npc:"GM_ONLY_ABOLETH_AKTO_321",
 hidden:"HIDDEN_NPC_SECRET_SUN_456",
 sheet:"SHEET_PRIVATE_SPELLS_789",
 pc:"PRIVATE_PLAYER_CHARACTER_SHEET_999",
 background:"REVEALED_BACKGROUND_DO_NOT_RESTRICT"
};
sql("INSERT INTO private.npc_profile_test_admins(id) VALUES ('"+people.ADMIN.id+"')");
sql("INSERT INTO public.characters(id,name,kind,is_hidden,description,background,motivation,quirk,mannerism,voice,secret,tags) VALUES "+
 "('"+visible+"','Visible NPC','npc',false,'Public welcome','"+
 secrets.background+"','MOTIVATION_UNREVEALED','QUIRK_UNREVEALED','MANNERISM_UNREVEALED','VOICE_UNREVEALED','"+secrets.npc+"','{}'),"+
 "('"+hidden+"','Hidden NPC','npc',true,'Hidden profile','HIDDEN_BACKGROUND','HIDDEN_MOTIVATION',NULL,NULL,NULL,'"+secrets.hidden+"','{}'),"+
 "('"+pc+"','Limited-grant player character','npc',true,'Limited-only','PC_BACKGROUND',NULL,NULL,NULL,NULL,'PC_SECRET_DO_NOT_EXPOSE',ARRAY['player-character'])");
sql("INSERT INTO public.character_sheets(character_id,sheet) VALUES "+
 "('"+visible+"','{\"profileReveal\":{\"background\":true,\"secret\":false,\"traits\":false},\"traits\":\"TRAITS_UNREVEALED\",\"spellbook\":{\"secret\":\""+
 secrets.sheet+"\"},\"secret\":\"SHEET_SECRET_UNREVEALED\"}'::jsonb),"+
 "('"+hidden+"','{\"profileReveal\":{\"background\":false},\"secret\":\""+secrets.hidden+"\"}'::jsonb),"+
 "('"+pc+"','{\"gmNotes\":\""+secrets.pc+"\"}'::jsonb)");
sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) VALUES "+
 "('"+visible+"','"+people.EDITOR.id+"',true,false,false),"+
 "('"+visible+"','"+people.COEDITOR.id+"',true,true,false),"+
 "('"+hidden+"','"+people.EDITOR.id+"',true,false,false),"+
 "('"+visible+"','"+people.INV_ONLY.id+"',false,true,false),"+
 "('"+pc+"','"+people.INV_ONLY.id+"',false,true,false),"+
 "('"+pc+"','"+people.CONVERT_ONLY.id+"',false,false,true),"+
 "('"+pc+"','"+people.EDITOR.id+"',true,true,true)");

const readSheet=(who,char)=>who.from("character_sheets").select("sheet")
 .eq("character_id",char).maybeSingle();
const readCharacters=(who,char)=>who.from("characters")
 .select("id,name,background,motivation,quirk,mannerism,voice")
 .eq("id",char).maybeSingle();

// Negative baseline is deliberate: current policies leak complete visible sheet.
const unsafe=await readSheet(people.OUTSIDER.who,visible);
assert.ifError(unsafe.error);
assert.equal(unsafe.data.sheet.spellbook.secret,secrets.sheet);
const baselineLegacy=await rpc(people.INV_ONLY.who,
 "get_my_player_characters_v2",{});
assert.ifError(baselineLegacy.error);
assert.ok(baselineLegacy.data.some(x=>
 x.character_sheet?.gmNotes===secrets.pc && x.secret==="PC_SECRET_DO_NOT_EXPOSE"));
console.log("PASS V00 [EXPECTED UNSAFE BASELINE]: outsider can SELECT visible NPC sheet; "+
 "inventory-only user gets private player character sheet through original SECURITY DEFINER RPC");

sqlFile("sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql");
sql("NOTIFY pgrst,'reload schema'");

const noSheet=await readSheet(people.OUTSIDER.who,visible);
assert.ifError(noSheet.error);assert.equal(noSheet.data,null);
const inventorySheet=await readSheet(people.INV_ONLY.who,visible);
assert.ifError(inventorySheet.error);assert.equal(inventorySheet.data,null);
const converterSheet=await readSheet(people.CONVERT_ONLY.who,pc);
assert.ifError(converterSheet.error);assert.equal(converterSheet.data,null);
console.log("PASS V01: signed-in outsider, inventory-only and convert-only cannot fetch full sheets");

const adminSheet=await readSheet(people.ADMIN.who,visible);
assert.ifError(adminSheet.error);assert.equal(adminSheet.data.sheet.spellbook.secret,secrets.sheet);
const editorSheet=await readSheet(people.EDITOR.who,hidden);
assert.ifError(editorSheet.error);assert.equal(editorSheet.data.sheet.secret,secrets.hidden);
const inaccessibleHidden=await readSheet(people.OUTSIDER.who,hidden);
assert.ifError(inaccessibleHidden.error);assert.equal(inaccessibleHidden.data,null);
console.log("PASS V02: genuine Admin/edit grant can read full sheet, invisible NPC stays denied for outsider");

const safe=await rpc(people.OUTSIDER.who,"get_npc_profile_visible_v1",{p_character_id:visible});
assert.ifError(safe.error);
assert.equal(safe.data.name,"Visible NPC");
assert.equal(safe.data.description,"Public welcome");
assert.equal(safe.data.lore.background,secrets.background);
for(const needle of [
 secrets.npc,secrets.sheet,"SHEET_SECRET_UNREVEALED",
 "MOTIVATION_UNREVEALED","QUIRK_UNREVEALED","MANNERISM_UNREVEALED",
 "VOICE_UNREVEALED","TRAITS_UNREVEALED","profileReveal","spellbook"
]){
 assert.ok(!JSON.stringify(safe.data).includes(needle),
 "Safe NPC projection leaked a concealed value/key: "+needle);
}
const missing=await rpc(people.OUTSIDER.who,"get_npc_profile_visible_v1",{p_character_id:hidden});
assert.ifError(missing.error);assert.equal(missing.data,null);
const hiddenEditor=await rpc(people.EDITOR.who,"get_npc_profile_visible_v1",{p_character_id:hidden});
assert.ifError(hiddenEditor.error);assert.equal(hiddenEditor.data.name,"Hidden NPC");
const anon=await rpc(client(),"get_npc_profile_visible_v1",{p_character_id:visible});
assert.ok(anon.error);
console.log("PASS V03: safe reveal-only profile; hidden row and anonymous denied; authorized hidden editor can see identity");

const limited=await rpc(people.INV_ONLY.who,"get_my_player_characters_v2",{});
assert.ifError(limited.error);
const lim=limited.data.find(x=>x.id===pc);
assert.ok(lim);
assert.equal(lim.permission.can_inventory,true);
assert.deepEqual(lim.character_sheet,{});
assert.ok(!("secret" in lim) && !("background" in lim));
assert.ok(!JSON.stringify(lim).includes(secrets.pc));
const converted=await rpc(people.CONVERT_ONLY.who,"get_my_player_characters_v2",{});
assert.ifError(converted.error);
const convertRow=converted.data.find(x=>x.id===pc);
assert.ok(convertRow);
assert.deepEqual(convertRow.character_sheet,{});
assert.ok(!JSON.stringify(convertRow).includes("PC_SECRET_DO_NOT_EXPOSE"));
const fullEditor=await rpc(people.EDITOR.who,"get_my_player_characters_v2",{});
assert.ifError(fullEditor.error);
const fullRow=fullEditor.data.find(x=>x.id===pc);
assert.equal(fullRow.character_sheet.gmNotes,secrets.pc);
console.log("PASS V04: legacy restricted grants retain roster identity but not full sheet or secret; editor retains old full shape");

sql("UPDATE public.character_sheets SET sheet=jsonb_set(sheet,'{profileReveal,secret}','true'::jsonb) "+
 "WHERE character_id='"+visible+"'");
const disclosed=await rpc(people.OUTSIDER.who,"get_npc_profile_visible_v1",{p_character_id:visible});
assert.ifError(disclosed.error);
assert.equal(disclosed.data.lore.secret,secrets.npc);
assert.ok(!JSON.stringify(disclosed.data).includes(secrets.sheet));
console.log("PASS V05: explicit GM reveal of secret becomes visible; unrelated spellbook remains private");

const stillLeaky=await readCharacters(people.OUTSIDER.who,visible);
assert.ifError(stillLeaky.error);
assert.equal(stillLeaky.data.motivation,"MOTIVATION_UNREVEALED");
assert.equal(stillLeaky.data.background,secrets.background);
console.log("PASS V06 [RELEASE BLOCKER]: current characters column-level grants STILL expose unrevealed motivation/quirk. "+
 "Full production cutover MUST include column ACL and all Admin/Forge RPC consumers; this candidate is NOT shippable.");
// Stage two is deliberately NOT production-ready: it revokes columns used by
// unconverted GM/browser consumers. This is a disposable AUTH/ACL proof only.
sqlFile("sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql");
sql("NOTIFY pgrst,'reload schema'");
const blockedColumns=await readCharacters(people.OUTSIDER.who,visible);
assert.ok(blockedColumns.error,"Unrevealed character columns still directly accessible");
assert.equal(blockedColumns.error.code,"42501");
const adminDirectColumns=await readCharacters(people.ADMIN.who,visible);
assert.ok(adminDirectColumns.error,"Admin direct table SELECT should also lose revoked columns");
const safeAfterStage2=await rpc(people.OUTSIDER.who,
 "get_npc_profile_visible_v1",{p_character_id:visible});
assert.ifError(safeAfterStage2.error);
assert.equal(safeAfterStage2.data.lore.background,secrets.background);
assert.equal(safeAfterStage2.data.lore.secret,secrets.npc); // explicit GM reveal
const basicAfterStage2=await people.OUTSIDER.who.from("characters")
 .select("id,name,kind").eq("id",visible).maybeSingle();
assert.ifError(basicAfterStage2.error);
assert.equal(basicAfterStage2.data.name,"Visible NPC");
console.log("PASS V07: staged private-lore column ACL denies direct outsider/Admin table SELECT, "+
 "but public-safe RPC and basic roster identity still work; frontend consumers MUST be migrated");

const gmDossier=await rpc(people.ADMIN.who,"get_npc_dossier_admin_v1",
 {p_character_id:hidden});
assert.ifError(gmDossier.error);
assert.equal(gmDossier.data.secret,secrets.hidden);
assert.equal(gmDossier.data.character_sheet.secret,secrets.hidden);
const outsiderDossier=await rpc(people.OUTSIDER.who,"get_npc_dossier_admin_v1",
 {p_character_id:visible});
assert.ok(outsiderDossier.error);
assert.equal(outsiderDossier.error.code,"42501");
const editorDossier=await rpc(people.EDITOR.who,"get_npc_dossier_admin_v1",
 {p_character_id:hidden});
assert.ok(editorDossier.error);
assert.equal(editorDossier.error.code,"42501");
const anonDossier=await rpc(client(),"get_npc_dossier_admin_v1",
 {p_character_id:visible});
assert.ok(anonDossier.error);
const editorAfter=await readSheet(people.EDITOR.who,hidden);
assert.ifError(editorAfter.error);
assert.equal(editorAfter.data.sheet.secret,secrets.hidden);
console.log("PASS V08: GM-only dossier returns full hidden character and canonical sheet; "+
 "other signed-in editors and outsiders denied dossier, editor still can use authorized sheet");
// V08A: distinct current edit permissions do not grant GM dossier/secret.
const editorNarrative=await rpc(people.EDITOR.who,"get_character_editor_narrative_v1",{p_character_id:visible});
assert.ifError(editorNarrative.error);
assert.equal(editorNarrative.data.id,visible);
assert.equal(editorNarrative.data.background,secrets.background);
assert.equal(editorNarrative.data.motivation,"MOTIVATION_UNREVEALED");
for(const forbidden of [secrets.npc,secrets.sheet,"character_sheet","creator_user_id","profileReveal"])
 assert.ok(!JSON.stringify(editorNarrative.data).includes(forbidden),"Editor narrative leaked "+forbidden);
const coeditorNarrative=await rpc(people.COEDITOR.who,"get_character_editor_narrative_v1",{p_character_id:visible});
assert.ifError(coeditorNarrative.error);
assert.equal(coeditorNarrative.data.motivation,"MOTIVATION_UNREVEALED");
const hiddenEditorNarrative=await rpc(people.EDITOR.who,"get_character_editor_narrative_v1",{p_character_id:hidden});
assert.ifError(hiddenEditorNarrative.error);
assert.equal(hiddenEditorNarrative.data.background,"HIDDEN_BACKGROUND");
const gmNarrative=await rpc(people.ADMIN.who,"get_character_editor_narrative_v1",{p_character_id:hidden});
assert.ifError(gmNarrative.error);
assert.equal(gmNarrative.data.motivation,"HIDDEN_MOTIVATION");
for(const role of ["OUTSIDER","INV_ONLY","CONVERT_ONLY"]){
 const denied=await rpc(people[role].who,"get_character_editor_narrative_v1",{p_character_id:visible});
 assert.ifError(denied.error);
 assert.equal(denied.data,null,role+" must not obtain narrative");
}
const anonNarrative=await rpc(client(),"get_character_editor_narrative_v1",{p_character_id:visible});
assert.ok(anonNarrative.error);
console.log("PASS V08A: signed GM/editor/co-editor narrative; outsider/inventory/convert/anon denied, no GM secret");
// V09 reproduces the original broad editor->GM secret authority in scratch.
const legacySecretEditor=await rpc(people.EDITOR.who,"get_character_secrets_v1",
 {p_character_ids:[hidden]});
assert.ifError(legacySecretEditor.error);
assert.equal(legacySecretEditor.data.find(x=>x.character_id===hidden)?.secret,secrets.hidden);
const editorSet=await rpc(people.EDITOR.who,"set_character_secret_v1",{
 p_character_id:hidden,p_secret:"LEGACY_EDITOR_CHANGED_GM_SECRET_TEST_ONLY"
});
assert.ifError(editorSet.error);
const unsafeV1=await rpc(people.EDITOR.who,"get_my_player_character_v1",{});
assert.ifError(unsafeV1.error);
assert.equal(unsafeV1.data.secret,"PC_SECRET_DO_NOT_EXPOSE");
const unsafeV2=await rpc(people.EDITOR.who,"get_my_player_characters_v2",{});
assert.ifError(unsafeV2.error);
assert.equal(unsafeV2.data.find(x=>x.id===pc).secret,"PC_SECRET_DO_NOT_EXPOSE");
console.log("PASS V09 [EXPECTED UNSAFE BASELINE]: editor reads/changes GM secret, and editor "+
 "receives characters.secret through both tagged-PC full-read RPCs");

sqlFile("sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql");
sql("NOTIFY pgrst,'reload schema'");
// A local privileged fixture represents the trusted, transaction-owned
// Forge creation receipt. The authenticated collaborator did NOT create this
// character; the database never infers provenance from can_edit.
sql("BEGIN; SELECT set_config('request.jwt.claim.sub','"+people.EDITOR.id+"',true); "+
 "SELECT private.record_character_creator_v1('"+visible+"'::uuid); COMMIT;");
assert.equal(sql("SELECT creator_user_id::text FROM private.character_creator_attribution "+
 "WHERE character_id='"+visible+"'"),people.EDITOR.id);
assert.equal(sql("SELECT has_table_privilege('authenticated',"+
 "'private.character_creator_attribution','INSERT')"),"f");
assert.equal(sql("SELECT has_function_privilege('authenticated',"+
 "'private.record_character_creator_v1(uuid)','EXECUTE')"),"f");

// V10: GM-only legacy secret and exact RPC names (no data migration).
const deniedGet=await rpc(people.EDITOR.who,"get_character_secrets_v1",
 {p_character_ids:[hidden]});
assert.ifError(deniedGet.error);
assert.deepEqual(deniedGet.data,[]);
const deniedSet=await rpc(people.EDITOR.who,"set_character_secret_v1",{
 p_character_id:hidden,p_secret:"FORBIDDEN_EDITOR_GM_SECRET_MODIFICATION"
});
assert.ok(deniedSet.error);assert.equal(deniedSet.error.code,"42501");
const gmGet=await rpc(people.ADMIN.who,"get_character_secrets_v1",
 {p_character_ids:[hidden]});
assert.ifError(gmGet.error);
assert.equal(gmGet.data[0].secret,"LEGACY_EDITOR_CHANGED_GM_SECRET_TEST_ONLY");
const gmSet=await rpc(people.ADMIN.who,"set_character_secret_v1",{
 p_character_id:hidden,p_secret:secrets.hidden
});
assert.ifError(gmSet.error);
const gmVerified=await rpc(people.ADMIN.who,"get_character_secrets_v1",
 {p_character_ids:[hidden]});
assert.ifError(gmVerified.error);assert.equal(gmVerified.data[0].secret,secrets.hidden);
const anonSecret=await rpc(client(),"get_character_secrets_v1",{p_character_ids:[hidden]});
assert.ok(anonSecret.error);
console.log("PASS V10: signed-in GM retains legacy seven-value style read/write, "+
 "delegated can_edit cannot read/write GM Secret through old RPCs");

// V11: legacy single and multi-character tagged-PC API cannot serialize
// characters.secret for editors, without blanking any other canonical sheet.
const safeV1=await rpc(people.EDITOR.who,"get_my_player_character_v1",{});
assert.ifError(safeV1.error);assert.ok(safeV1.data);
assert.ok(!("secret" in safeV1.data));
assert.equal(safeV1.data.character_sheet.gmNotes,secrets.pc);
const safeV2=await rpc(people.EDITOR.who,"get_my_player_characters_v2",{});
assert.ifError(safeV2.error);
const safePlayer=safeV2.data.find(x=>x.id===pc);
assert.ok(safePlayer);assert.ok(!("secret" in safePlayer));
assert.equal(safePlayer.character_sheet.gmNotes,secrets.pc);
assert.equal(sql("SELECT count(*) FROM public.characters WHERE secret IS NOT NULL"),"3");
console.log("PASS V11: tagged-PC v1/v2 editor serialization strips legacy GM Secret, "+
 "but retains canonical sheet as before; old character data unchanged");

// V12: player backstory is stored independently from GM secret and
// all callers are current JWT + grant scoped. No raw GM content is copied.
const storyTable="character_backstory_secrets";
const coeditorFullSheet=await readSheet(people.COEDITOR.who,visible);
assert.ifError(coeditorFullSheet.error);
assert.equal(coeditorFullSheet.data.sheet.spellbook.secret,secrets.sheet);
const coeditorStoryBefore=await people.COEDITOR.who.from(storyTable)
 .select("secret_text").eq("character_id",visible);
assert.ifError(coeditorStoryBefore.error);
assert.deepEqual(coeditorStoryBefore.data,[]);
const storyPut=await people.EDITOR.who.from(storyTable).insert({
 character_id:visible,secret_text:"CHARACTER_AUTHORED_HIDDEN_PAST"
}).select("character_id,secret_text").single();
assert.ifError(storyPut.error);
assert.equal(storyPut.data.secret_text,"CHARACTER_AUTHORED_HIDDEN_PAST");
const storyEdit=await people.EDITOR.who.from(storyTable).update({
 secret_text:"PLAYER_REVISED_BACKSTORY"
}).eq("character_id",visible).select("secret_text").single();
assert.ifError(storyEdit.error);
assert.equal(storyEdit.data.secret_text,"PLAYER_REVISED_BACKSTORY");
const coeditorStory=await people.COEDITOR.who.from(storyTable)
 .select("secret_text").eq("character_id",visible);
assert.ifError(coeditorStory.error);assert.deepEqual(coeditorStory.data,[]);
const coeditorStoryEdit=await people.COEDITOR.who.from(storyTable)
 .update({secret_text:"COEDITOR_ATTEMPTED_REWRITE"}).eq("character_id",visible)
 .select("secret_text");
assert.ifError(coeditorStoryEdit.error);assert.deepEqual(coeditorStoryEdit.data,[]);
const gmStory=await people.ADMIN.who.from(storyTable).select("secret_text")
 .eq("character_id",visible).single();
assert.ifError(gmStory.error);assert.equal(gmStory.data.secret_text,"PLAYER_REVISED_BACKSTORY");
const invStory=await people.INV_ONLY.who.from(storyTable).select("secret_text")
 .eq("character_id",visible);
assert.ifError(invStory.error);assert.deepEqual(invStory.data,[]);
const outsiderStory=await people.OUTSIDER.who.from(storyTable).select("secret_text");
assert.ifError(outsiderStory.error);assert.deepEqual(outsiderStory.data,[]);
const unauthorizedUpsert=await people.INV_ONLY.who.from(storyTable).insert({
 character_id:hidden,secret_text:"FORBIDDEN"
});
assert.ok(unauthorizedUpsert.error);
const gmNotCopied=await rpc(people.ADMIN.who,"get_character_secrets_v1",
 {p_character_ids:[visible]});
assert.ifError(gmNotCopied.error);
assert.equal(gmNotCopied.data[0].secret,secrets.npc);
console.log("PASS V12: creator-attributed player backstory is private to creator + GM; "+
 "inventory-only and outsider cannot read/write; old GM secret unchanged");

// V13: sheet.profileReveal.secret=true is no longer permission to publish
// actual GM secret. Only an independently Admin-authored published clue works.
const beforePublic=await rpc(people.OUTSIDER.who,"get_npc_profile_visible_v1",
 {p_character_id:visible});
assert.ifError(beforePublic.error);
assert.ok(!JSON.stringify(beforePublic.data).includes(secrets.npc));
assert.ok(!JSON.stringify(beforePublic.data).includes("PLAYER_REVISED_BACKSTORY"));
const publishTable="character_public_secret_revelations";
const unpublished=await people.ADMIN.who.from(publishTable).insert({
 character_id:visible,public_text:"GM_APPROVED_REVEAL_CLUE",is_revealed:false
}).select("public_text,is_revealed").single();
assert.ifError(unpublished.error);assert.equal(unpublished.data.is_revealed,false);
const stillConcealed=await rpc(people.OUTSIDER.who,"get_npc_profile_visible_v1",
 {p_character_id:visible});
assert.ifError(stillConcealed.error);
assert.ok(!JSON.stringify(stillConcealed.data).includes("GM_APPROVED_REVEAL_CLUE"));
const editPublish=await people.EDITOR.who.from(publishTable).update({
 is_revealed:true
}).eq("character_id",visible).select("character_id");
assert.ifError(editPublish.error);assert.deepEqual(editPublish.data,[]);
const editorPublishRead=await people.EDITOR.who.from(publishTable).select("public_text");
assert.ifError(editorPublishRead.error);assert.deepEqual(editorPublishRead.data,[]);
const gmPublish=await people.ADMIN.who.from(publishTable).update({
 is_revealed:true
}).eq("character_id",visible).select("is_revealed").single();
assert.ifError(gmPublish.error);assert.equal(gmPublish.data.is_revealed,true);
const publicClue=await rpc(people.OUTSIDER.who,"get_npc_profile_visible_v1",
 {p_character_id:visible});
assert.ifError(publicClue.error);
assert.equal(publicClue.data.lore.secret,"GM_APPROVED_REVEAL_CLUE");
assert.ok(!JSON.stringify(publicClue.data).includes(secrets.npc));
const gmUnpublish=await people.ADMIN.who.from(publishTable).update({
 is_revealed:false
}).eq("character_id",visible).select("is_revealed").single();
assert.ifError(gmUnpublish.error);assert.equal(gmUnpublish.data.is_revealed,false);
const afterUnpublish=await rpc(people.OUTSIDER.who,"get_npc_profile_visible_v1",
 {p_character_id:visible});
assert.ifError(afterUnpublish.error);
assert.ok(!JSON.stringify(afterUnpublish.data).includes("GM_APPROVED_REVEAL_CLUE"));
console.log("PASS V13: old NPC sheet reveal flag cannot publish GM Secret; "+
 "only independent GM-authored clue can be published/retracted");

// V14: GM-only dossier retains legacy secret, but canonical sheet and
// signed-in editor access stay separate; test after staged RLS.
const gmHiddenAgain=await rpc(people.ADMIN.who,"get_npc_dossier_admin_v1",
 {p_character_id:hidden});
assert.ifError(gmHiddenAgain.error);assert.equal(gmHiddenAgain.data.secret,secrets.hidden);
const editorFullSheet=await readSheet(people.EDITOR.who,hidden);
assert.ifError(editorFullSheet.error);
assert.equal(editorFullSheet.data.sheet.secret,secrets.hidden); // Legacy sheet data is NOT a GM secret store.
console.log("PASS V14: GM dossier retains original protected character Secret; "+
 "canonical sheet remains separate and requires an independent future content audit");

// V15: live-style grant revocation immediately removes player backstory access.
sql("DELETE FROM public.character_permissions WHERE character_id='"+visible+
 "' AND user_id='"+people.EDITOR.id+"'");
const revokedStory=await people.EDITOR.who.from(storyTable).select("secret_text")
 .eq("character_id",visible);
assert.ifError(revokedStory.error);assert.deepEqual(revokedStory.data,[]);
const revokedStoryEdit=await people.EDITOR.who.from(storyTable).update({
 secret_text:"REVOKED_STILL_EDITING"
}).eq("character_id",visible).select("character_id");
assert.ifError(revokedStoryEdit.error);assert.deepEqual(revokedStoryEdit.data,[]);
const afterRevocationGM=await people.ADMIN.who.from(storyTable).select("secret_text")
 .eq("character_id",visible).single();
assert.ifError(afterRevocationGM.error);
assert.equal(afterRevocationGM.data.secret_text,"PLAYER_REVISED_BACKSTORY");
console.log("PASS V15: delegated editor grant revocation cuts backstory access; "+
 "GM data and character row preserved");
// V16: a fully authorized co-editor retains normal canonical sheet access,
// including any unrelated sheet features, but never this creator's backstory.
const coeditorAfterCreatorRevoke=await readSheet(people.COEDITOR.who,visible);
assert.ifError(coeditorAfterCreatorRevoke.error);
assert.equal(coeditorAfterCreatorRevoke.data.sheet.spellbook.secret,secrets.sheet);
const coeditorBackstoryAfterRevocation=await people.COEDITOR.who.from(storyTable)
 .select("secret_text").eq("character_id",visible);
assert.ifError(coeditorBackstoryAfterRevocation.error);
assert.deepEqual(coeditorBackstoryAfterRevocation.data,[]);
const coeditorInsertUnclaimed=await people.COEDITOR.who.from(storyTable).insert({
 character_id:hidden,secret_text:"CLAIMED_BY_OTHER_EDITOR"
});
assert.ok(coeditorInsertUnclaimed.error);
console.log("PASS V16: second player with can_edit (+ inventory) cannot read/edit/claim "+
 "creator-only backstory while still allowed to read the ordinary sheet");

// V17: origin is immutable; a non-creator cannot claim it even if a trusted
// creation helper is mistakenly invoked later with their JWT subject.
const attemptRebind="BEGIN; SELECT set_config('request.jwt.claim.sub','"+
 people.COEDITOR.id+"',true); SELECT private.record_character_creator_v1('"+
 visible+"'::uuid); COMMIT;";
assert.throws(()=>sql(attemptRebind),/immutable/i);
assert.equal(sql("SELECT creator_user_id::text FROM private.character_creator_attribution "+
 "WHERE character_id='"+visible+"'"),people.EDITOR.id);
const coeditorPublicClaim=await people.COEDITOR.who.rpc("record_character_creator_v1",{
 p_character_id:visible
});
assert.ok(coeditorPublicClaim.error,"Private creation receipt must not be a public RPC");
console.log("PASS V17: non-creator cannot rebind immutable creator identity; "+
 "trusted creation attribution is not callable through public Data API");

// V18: no reliable provenance on a historical NPC must fail closed to GM.
const gmLegacyStory=await people.ADMIN.who.from(storyTable).insert({
 character_id:hidden,secret_text:"GM_KEEPS_UNCLAIMED_NPC_STORY"
}).select("secret_text").single();
assert.ifError(gmLegacyStory.error);
assert.equal(gmLegacyStory.data.secret_text,"GM_KEEPS_UNCLAIMED_NPC_STORY");
const otherEditorLegacy=await people.EDITOR.who.from(storyTable)
 .select("secret_text").eq("character_id",hidden);
assert.ifError(otherEditorLegacy.error);
assert.deepEqual(otherEditorLegacy.data,[]);
const legacyEditorWrite=await people.EDITOR.who.from(storyTable).update({
 secret_text:"LEGACY_EDITOR_TAKEOVER"
}).eq("character_id",hidden).select("secret_text");
assert.ifError(legacyEditorWrite.error);assert.deepEqual(legacyEditorWrite.data,[]);
const gmLegacyConfirm=await people.ADMIN.who.from(storyTable)
 .select("secret_text").eq("character_id",hidden).single();
assert.ifError(gmLegacyConfirm.error);
assert.equal(gmLegacyConfirm.data.secret_text,"GM_KEEPS_UNCLAIMED_NPC_STORY");
console.log("PASS V18: un-attributed legacy NPC backstory defaults to GM only, "+
 "including against an unrelated current can_edit sheet editor");

// V19-V23: exercise the same trigger path used by every canonical character
// INSERT with a reduced authenticated creation wrapper. NOT full Forge parity.
sqlFile("scripts/fixtures/p1_3_npc_creator_replay_fixture_pg17.sql");
sql("NOTIFY pgrst,'reload schema'");
const createName="test_authoritative_character_create_v1";
const nonce=randomUUID();
const craftedPayload={name:"Creator-replay-synthetic",creation_request_id:nonce,
  creator_user_id:people.COEDITOR.id,created_by:people.COEDITOR.id};
const created=await rpc(people.EDITOR.who,createName,{p_payload:craftedPayload});
assert.ifError(created.error);const freshId=created.data;
assert.match(freshId,/^[0-9a-f-]{36}$/i);
const provenance=sql("SELECT creator_user_id::text FROM private.character_creator_attribution WHERE character_id='"+freshId+"'");
assert.equal(provenance,people.EDITOR.id);
const recorded=sql("SELECT count(*) FROM private.character_creator_attribution WHERE character_id='"+freshId+"'");
assert.equal(recorded,"1");
console.log("PASS V19: authenticated creator bound by AFTER INSERT in same creation transaction; client creator claim ignored");

const replay=await rpc(people.EDITOR.who,createName,{p_payload:{
 name:"Changed replay name",creation_request_id:nonce,creator_user_id:people.ADMIN.id
}});
assert.ifError(replay.error);assert.equal(replay.data,freshId);
assert.equal(sql("SELECT count(*) FROM public.characters WHERE creation_request_id='"+nonce+"'"),"1");
assert.equal(sql("SELECT creator_user_id::text FROM private.character_creator_attribution WHERE character_id='"+freshId+"'"),people.EDITOR.id);
const stolenReplay=await rpc(people.COEDITOR.who,createName,{p_payload:craftedPayload});
assert.ok(stolenReplay.error);
assert.equal(stolenReplay.error.code,"42501");
console.log("PASS V20: same-creator idempotent replay preserves immutable origin; another user cannot replay/claim request");

sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory) VALUES ('"+
 freshId+"','"+people.COEDITOR.id+"',true,true)");
const anotherEditorSheet=await readSheet(people.COEDITOR.who,freshId);
assert.ifError(anotherEditorSheet.error);
assert.equal(anotherEditorSheet.data.sheet.classKey,"fighter");
const newSecret=await people.EDITOR.who.from(storyTable).insert({
 character_id:freshId,secret_text:"CREATOR_ONLY_FROM_NEW_CHARACTER"
}).select("secret_text").single();
assert.ifError(newSecret.error);
const otherSecret=await people.COEDITOR.who.from(storyTable)
 .select("secret_text").eq("character_id",freshId);
assert.ifError(otherSecret.error);assert.deepEqual(otherSecret.data,[]);
const admSecret=await people.ADMIN.who.from(storyTable)
 .select("secret_text").eq("character_id",freshId).single();
assert.ifError(admSecret.error);
assert.equal(admSecret.data.secret_text,"CREATOR_ONLY_FROM_NEW_CHARACTER");
console.log("PASS V21: newly created NPC shared with second editor keeps ordinary sheet shared, authored backstory creator/GM-only");

const rolledBackId=randomUUID();
const rolledBackNonce=randomUUID();
sql("BEGIN; SELECT set_config('request.jwt.claim.sub','"+people.EDITOR.id+"',true);"+
 " INSERT INTO public.characters(id,name,kind,creation_request_id,is_hidden) VALUES ('"+
 rolledBackId+"','Rollback fixture NPC','npc','"+rolledBackNonce+"',true); ROLLBACK;");
assert.equal(sql("SELECT count(*) FROM public.characters WHERE id='"+rolledBackId+"'"),"0");
assert.equal(sql("SELECT count(*) FROM private.character_creator_attribution WHERE character_id='"+rolledBackId+"'"),"0");
console.log("PASS V22: rolled-back creation transaction also rolls back immutable creator attribution");

const noAuthId=randomUUID();
sql("INSERT INTO public.characters(id,name,kind,is_hidden) VALUES ('"+
 noAuthId+"','Unattributed service creation','npc',true)");
assert.equal(sql("SELECT count(*) FROM private.character_creator_attribution WHERE character_id='"+noAuthId+"'"),"0");
const gmOnly=await people.ADMIN.who.from(storyTable).insert({
 character_id:noAuthId,secret_text:"GM_UNATTRIBUTED_SERVICE_NPC"
}).select("secret_text").single();
assert.ifError(gmOnly.error);
const deniedOther=await people.COEDITOR.who.from(storyTable)
 .select("secret_text").eq("character_id",noAuthId);
assert.ifError(deniedOther.error);assert.deepEqual(deniedOther.data,[]);
const anonCreate=await rpc(client(),createName,{p_payload:{
 name:"No anonymous creator",creation_request_id:randomUUID()
}});
assert.ok(anonCreate.error);
console.log("PASS V23: no verified auth.uid creates no creator provenance, remains GM-only; anon creation denied");
// V24: the UI permission-check RPC only answers whether this JWT can edit
// the private backstory. It reveals neither creator identity nor secret text.
const accessOf=async(who,id)=>{
 const result=await rpc(who,"can_edit_creator_backstory_v1",{p_character_id:id});
 assert.ifError(result.error);return result.data;
};
assert.equal(await accessOf(people.EDITOR.who,freshId),true);
assert.equal(await accessOf(people.ADMIN.who,freshId),true);
assert.equal(await accessOf(people.COEDITOR.who,freshId),false);
assert.equal(await accessOf(people.INV_ONLY.who,freshId),false);
assert.equal(await accessOf(people.OUTSIDER.who,freshId),false);
assert.equal(await accessOf(people.EDITOR.who,visible),false); // revoked at V15
assert.equal(await accessOf(people.EDITOR.who,hidden),false); // no creator
assert.equal(await accessOf(people.ADMIN.who,hidden),true);
const anonymousGate=await rpc(client(),"can_edit_creator_backstory_v1",
 {p_character_id:freshId});
assert.ok(anonymousGate.error);
console.log("PASS V24: Profile gate returns true only to current verified creator and GM; "+
 "co-editor/inventory/outsider, revoked creator and anonymous denied");
console.log("P1.3 staged secrets V00–V24 genuine local GoTrue PASS. "+
 "Creation V19–V23 use reduced wrapper, not deployed Forge functions; production database untouched.");


