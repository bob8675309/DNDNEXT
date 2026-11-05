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

const roles=["ADMIN","EDITOR","INV_ONLY","CONVERT_ONLY","OUTSIDER"];
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
console.log("P1.3 isolated genuine GoTrue player-safe profile V00–V06 PASS. NO production access-policy change.");
