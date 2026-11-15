#!/usr/bin/env node
// T25 source-locked negative tests: no hosted SQL, no screenshots, no deployment.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveT25CurrentManager, T25_BASE_BLOB, T25_TEMP_ROUTE } from "./derive_t25_current_npc_manager.mjs";
import { createHash } from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read=p=>readFileSync(path.join(root,p),"utf8");
const original=read("pages/npcs.js");
const blob=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
test("T25-01 exact current pages/npcs.js blob and scratch-only route",()=>{
 assert.equal(blob(original),T25_BASE_BLOB);
 assert.equal(existsSync(path.join(root,T25_TEMP_ROUTE)),false);
 assert.doesNotMatch(original,/derive_t25_current_npc_manager|__c34_t25_probe/);
});
test("T25-02 source drift is rejected, no optimistic fuzzy rebase",()=>{
 assert.throws(()=>deriveT25CurrentManager(original+"\n// drift"),/stale\/mismatched/);
});
test("T25-03 derived CURRENT manager preserves original application vertical slices",()=>{
 const {output,edits}=deriveT25CurrentManager(original);
 assert.ok(edits.length>=12);
 for(const c of ["CharacterSheetPanel","CharacterSheetRollResult",
  "PortraitPickerModal","SpritePickerModal","NewNpcModal",
  "KindPicker","MapIconPicker","loadSelectedNotes",
  "setCharacterLocation","toggleLocationListing",
  "toggleMapVisibility","applyPortraitPatchToSelected",
  "handleDeleteNpc","handleNewNpcCreated",
  "loadMerchants","loadMerchantProfiles","selectedKeyRef",
  "settleWithDeadline","sheetRequestRef","notesRequestRef",
  "equipmentRequestRef","storeHref","onOpenStore",
  "onOpenProfile","inventoryHref","focusRaw",
  "locationNameById","printProfile","printNotes"]) {
   assert.ok(output.includes(c),c+" was dropped from current manager");
 }
});
test("T25-04 no bulk secrets, narrative rosters or speculative page-wide sheet cache",()=>{
 const {output}=deriveT25CurrentManager(original);
 assert.doesNotMatch(output,/loadCharacterSecrets|get_character_secrets_v1/);
 assert.doesNotMatch(output,/\.select\("character_id,sheet"\)/);
 const block=output.slice(output.indexOf("  const loadNpcs = "),
  output.indexOf("  /* ------------------- roster merge ------------------- */"));
 assert.doesNotMatch(block,/["'](?:background|motivation|quirk|mannerism|voice)["']/);
 assert.match(block,/projectNonMapManagerRosterRow/);
 assert.equal((block.match(/\.select\(C34_T25_PUBLIC_ROSTER_FIELDS\)/g)||[]).length,3,
  "NPC, merchant roster and merchant profiles must all select the same narrow projection");
 assert.match(output,/const C34_T25_PUBLIC_ROSTER_FIELDS = "id,name,kind,role,description,location_id,storefront_enabled,is_hidden,portrait_url";/);
 assert.match(output,/selectedPrivate\?\.result\?\.profile/);
 assert.match(output,/profile\.kind\) !== String\(row\.type\)/);
 assert.match(output,/\.\.\.row, \.\.\.profile, id: row\.id, type: row\.type, kind: row\.kind/);
 assert.doesNotMatch(output,/\.\.\.selectedPrivate\?\.result\?\.dossier/);

 assert.doesNotMatch(block,/\.select\(\s*\[/,
  "A legacy multi-column SELECT must not survive T25");

});
test("T25-05 actor, character, permissions and PDF must fail closed",()=>{
 const {output}=deriveT25CurrentManager(original);
 assert.match(output,/selectedManagerDisplayRights\(charPerm, selected\?\.id, userId\)/);
 assert.match(output,/readNonMapNpcProfileCandidate\(supabase, id/);
 assert.match(output,/withPrivateBackstory: false/);
 assert.match(output,/actorRef\.current === actor/);
 assert.match(output,/onAuthStateChange/);
 assert.match(output,/Refresh permissions/);
 assert.match(output,/printNotes=\{\(notes \|\| \[\]\)\.filter\(canSeeNote\)\}/);
 assert.match(output,/secret: ""/);
 assert.match(output,/t25-sheet-restricted/);
 assert.match(output,/selectedPrivateResult\?\.capabilities\?\.canPrint/);
 assert.match(output,/selectedPrivateResult\?\.capabilities\?\.canEdit/);
 assert.doesNotMatch(output,/charPerm\?\.(can_edit|can_inventory|can_convert)/);
});
test("T25-06 all three rosters plus ancillary lists are actor-bound and stale-response safe",()=>{
 const {output}=deriveT25CurrentManager(original);
 const readerBlock=output.slice(output.indexOf("  const loadPlayers = "),
  output.indexOf("  /* ------------------- roster merge ------------------- */"));
 assert.equal((readerBlock.match(/const requestActor = actorRef\.current/g)||[]).length,6);
 assert.equal((readerBlock.match(/actorRef\.current !== requestActor/g)||[]).length,6);
 assert.equal((readerBlock.match(/rosterEpochRef\.current !== requestEpoch/g)||[]).length,6);
 assert.equal((readerBlock.match(/const requestEpoch = rosterEpochRef\.current/g)||[]).length,6);
 assert.match(output,/rosterEpochRef\.current \+= 1/);
 assert.match(output,/setIsAdmin\(false\);\s*void loadAuth\(\);/);

 assert.match(output,/setNpcs\(\[\]\); setMerchants\(\[\]\); setMerchantProfiles\(new Map\(\)\);/);
 assert.match(output,/if \(!userId\) return;\s*void Promise\.all/);
});
test("T25-07 original map and other production mounts do not import scratch transform",()=>{
 for(const p of ["pages/_app.js","components/MapPageClient.js",
  "pages/inventory.js","pages/town/[id].js","components/NpcPanel.js"]){
   const source=read(p);
   assert.doesNotMatch(source,/__c34_t25_probe|derive_t25_current_npc_manager/,p);
 }
});
