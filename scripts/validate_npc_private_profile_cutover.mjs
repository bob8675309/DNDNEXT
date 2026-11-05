#!/usr/bin/env node
// UI-only cutover source guard; requires P1.3 SQL stages 1–3 in the same
// deployment. No fallback to raw character lore or unsafe secret RPCs.
import fs from "node:fs";
import assert from "node:assert/strict";
const read=(p)=>fs.readFileSync(p,"utf8");
const npc=read("components/NpcPanel.js");
const admin=read("pages/npcs.js");
const author=read("components/CreatorBackstoryPanel.js");
const sql=read("sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql");
const expect=(source,label,terms)=>{
 for(const term of terms) assert.ok(source.includes(term),label+": missing "+term);
};
expect(npc,"shared Profile",[
 'isAdmin ? "get_npc_dossier_admin_v1" : "get_npc_profile_visible_v1"',
 '{ p_character_id: npcId }',
 'setFullNpc(data)',
 'if (!isAdmin && (!inventoryAccess.checked || !inventoryAccess.canEdit))',
 'publicLore[entry.key]',
 'key === "secret"',
 '<CreatorBackstoryPanel key={npcId} characterId={npcId} />',
 "Let me browse your wares.",
 'onBackToProfile={() => setPanelView("profile")}',
]);
assert.ok(!npc.includes('loadCharacterSecrets('),"Shared player Profile must not load GM secrets RPC");
assert.ok(!npc.includes('.from("characters")'),"Shared player Profile cannot fetch lore columns directly");
const profileLoad=npc.split('const run = async () => {')[1]?.split('}, [npcId, isAdmin]);')[0]||"";
assert.ok(!profileLoad.includes('from("character_sheets")'),"Initial Profile load must not fetch raw sheet");

expect(admin,"GM NPC manager",[
 'get_npc_dossier_admin_v1',
 'setSelectedGmDossier',
 'selectedGmDossier?.id === sel.id',
 'if (isAdmin) {',
 'saveCharacterSecret(supabase, selected.id, detailsDraft.secret)',
 'GM Secret (private to GM)',
 'secret: isAdmin ? safeStr(details?.secret || selected?.secret) : ""',
 'loadSelectedSheet',
 'setShowNewNpcModal(true)',
]);
assert.ok(!admin.includes("loadCharacterSecrets"),"Admin roster must not bulk-read GM secrets");
const npcRoster=admin.split("const loadNpcs = useCallback(async () => {")[1]?.split("const loadMerchants = useCallback")[0]||"";
const merchantRoster=admin.split("const loadMerchantProfiles = useCallback(async () => {")[1]?.split("/* ------------------- roster merge")[0]||"";
assert.ok(npcRoster && merchantRoster,"Admin roster query anchors missing");
for(const fragment of [npcRoster,merchantRoster]){
 for(const field of ['"background"','"motivation"','"quirk"','"mannerism"','"voice"']){
  assert.ok(!fragment.includes(field),"Roster must not select private lore column "+field);
 }
}
expect(author,"creator-only editor",[
 'can_edit_creator_backstory_v1',
 '.from("character_backstory_secrets")',
 '.upsert({',
 'onConflict: "character_id"',
 'if (!authorized) return null',
 'maxLength={16000}',
 'Only the original creator',
]);
for(const unsafe of ['loadCharacterSecrets','get_character_secrets_v1','set_character_secret_v1','.from("characters")',
 "creator_user_id", "created_by", "sheet.profileReveal.secret"]){
 assert.ok(!author.includes(unsafe),"Creator editor cannot access or claim GM secret/identity via "+unsafe);
}
expect(sql,"candidate API",[
 'CREATE OR REPLACE FUNCTION public.can_edit_creator_backstory_v1',
 'private.can_access_creator_backstory_v1(p_character_id)',
 'REVOKE ALL ON FUNCTION public.can_edit_creator_backstory_v1(uuid)',
 'GRANT EXECUTE ON FUNCTION public.can_edit_creator_backstory_v1(uuid)'
]);
const all=[npc,admin,author];
for(const s of all){
 assert.ok(!s.includes('ucggczovhmauhshvhusx'),"No production project ID hardcoded in reader surface");
}
console.log("P1.3 safe public NPC Profile / Admin dossier / creator-only backstory source guards PASS.");
