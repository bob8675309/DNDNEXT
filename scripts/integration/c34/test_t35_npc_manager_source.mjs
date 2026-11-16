import assert from "node:assert/strict";
import {test} from "node:test";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {deriveT35FullManager,T35_TEMP_ROUTE} from "./derive_t35_full_npc_manager.mjs";
import {deriveT25CurrentManager,T25_BASE_BLOB} from "./derive_t25_current_npc_manager.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const source=fs.readFileSync(path.join(root,"pages/npcs.js"),"utf8");
const blob=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("T35-01 original NPC manager exact blob, temporary route absent, original T25 unchanged",()=>{
 assert.equal(blob(source),T25_BASE_BLOB);
 assert.ok(!fs.existsSync(path.join(root,T35_TEMP_ROUTE)));
 assert.doesNotMatch(source,/T35|readTownGameManagerCapabilitiesCandidate|t31GameManagerRoleProfileCandidate/);
 assert.match(read("scripts/integration/c34/test_t25_current_manager_source.mjs"),/deriveT25CurrentManager/);
});
test("T35-02 derive from original T25 full NPC manager preserving all functionality",()=>{
 const {output,edits,baseEdits}=deriveT35FullManager(source);
 assert.ok(edits.length>=4&&baseEdits.length>=12);
 const {output:old}=deriveT25CurrentManager(source);
 for(const feature of ["CharacterSheetPanel","CharacterSheetRollResult","PortraitPickerModal",
  "SpritePickerModal","NewNpcModal","KindPicker","MapIconPicker","loadSelectedNotes",
  "setCharacterLocation","toggleLocationListing","toggleMapVisibility",
  "applyPortraitPatchToSelected","handleDeleteNpc","handleNewNpcCreated",
  "loadMerchants","loadMerchantProfiles","selectedKeyRef","settleWithDeadline",
  "sheetRequestRef","notesRequestRef","equipmentRequestRef","storeHref",
  "onOpenStore","onOpenProfile","inventoryHref","focusRaw",
  "locationNameById","printProfile","printNotes","t25-sheet-restricted",
  "t25-refresh-permissions"]){
   assert.ok(old.includes(feature)&&output.includes(feature),"T35 lost original T25 vertical slice "+feature);
 }
 assert.equal((output.match(/\.select\(C34_T25_PUBLIC_ROSTER_FIELDS\)/g)||[]).length,3);
 assert.match(output,/selectedManagerDisplayRights\(charPerm, selected\?\.id, userId\)/);
 assert.match(output,/selectedPrivateResult\?\.capabilities\?\.canPrint/);
 assert.match(output,/data-testid="t25-selected-character"/);
 assert.doesNotMatch(output,/loadCharacterSecrets|\.select\("character_id,sheet"\)/);
});
test("T35-03 no legacy Admin(uid), role fallback or unrestricted Stage2 narrative",()=>{
 const {output}=deriveT35FullManager(source);
 assert.match(output,/readTownGameManagerCapabilitiesCandidate\(supabase/);
 assert.match(output,/fresh\.status === "ok" && fresh\.capabilities\.isGameManager === true/);
 assert.match(output,/readTownGameManagerNpcProfileCandidate\(supabase, id/);
 assert.match(output,/withDossier: !!isAdmin, withSheet: permitted/);
 assert.match(output,/withPrivateBackstory: false,\s+isCurrent: current/);
 assert.match(output,/rosterEpochRef\.current === roleEpoch/);
 assert.match(output,/window\.addEventListener\("focus",check\)/);
 assert.match(output,/document\.addEventListener\("visibilitychange",check\)/);
 assert.doesNotMatch(output,/\.rpc\("is_admin"|\bprofile\?\.role === "admin"/);
 const lists=output.slice(output.indexOf("  const loadNpcs = "),output.indexOf("  /* ------------------- roster merge ------------------- */"));
 assert.doesNotMatch(lists,/"(?:background|motivation|quirk|mannerism|voice)"/);
 assert.doesNotMatch(output,/get_character_secrets_v1|\.select\("character_id,sheet"\)/);
});
test("T35-04 fail closed if the current manager's original source changes",()=>{
 assert.throws(()=>deriveT35FullManager(source+"\n// unauthorized change"),/stale\/mismatched/);
});
test("T35-05 source-original GM/DM game role and site audit remain independent",()=>{
 const c=read("utils/c34/t31GameManagerRoleProfileCandidate.mjs");
 assert.match(c,/GAME_MANAGER_ROLES = Object\.freeze\(\["admin","gm","dm"\]\)/);
 const s=read("scripts/integration/c34/test_t34_game_manager_campaign_site_signed_pg17.mjs");
 assert.match(s,/private\.current_user_is_site_admin_v1/);
 assert.doesNotMatch(read("pages/npcs.js"),/T35/);
 assert.doesNotMatch(read("components/MapPageClient.js"),/T35/);
});
console.log("PASS T35-SOURCE: FULL original manager unchanged, exact T25 ancestry, Stage2-safe list/sheet and strict verified game masters");
