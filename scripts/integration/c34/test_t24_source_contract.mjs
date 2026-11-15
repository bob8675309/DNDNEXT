#!/usr/bin/env node
// T24 source and release hold tests. No live DB, network or production page import.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=f=>fs.readFileSync(path.join(root,f),"utf8");
const hash=f=>{
 const out=spawnSync("git",["hash-object",f],{cwd:root,encoding:"utf8",timeout:8000});
 assert.equal(out.status,0,out.stderr);
 return out.stdout.trim();
};
test("T24-S01 current NPC manager, app and protected map retain original exact Git blobs",()=>{
 assert.equal(hash("pages/npcs.js"),"7fc00b9b3ace6233d1648a3d017f8a05e072d722");
 assert.equal(hash("pages/_app.js"),"e5f68c0abb293089d6ad09d4e3e4035612eac598");
 assert.equal(hash("components/MapPageClient.js"),"61f8738da2ca3d8635b5a413bfdc18c094228a0a");
});
test("T24-N01 no active UI imports research manager; original Profile and map remain untouched",()=>{
 for(const file of ["pages/npcs.js","pages/_app.js","pages/inventory.js",
   "pages/town/[id].js","components/NpcPanel.js",
   "components/MapPageClient.js","components/character/CharacterInteractionPanel.js"]){
  const source=read(file);
  assert.doesNotMatch(source,/NonMapNpcManagerResearchShell|nonMapNpcManagerCandidate/,file);
 }
 assert.equal(fs.existsSync(path.join(root,"pages/__c34_t24_probe.jsx")),false);
});
test("T24-S02 manager uses only safe roster projection + original signed profile reader and bound permissions",()=>{
 const source=read("components/c34/NonMapNpcManagerResearchShell.jsx");
 assert.match(source,/projectNonMapManagerRosterRow/);
 assert.match(source,/selectedManagerDisplayRights/);
 assert.match(source,/isCurrentManagerPrivateResponse/);
 assert.match(source,/projectSelectedEditorNarrative/);
 assert.match(source,/readNonMapNpcProfileCandidate/);
 assert.match(source,/onAuthStateChange/);
 assert.match(source,/Refresh permissions/);
 assert.match(source,/Print GM PDF/);
 assert.doesNotMatch(source,/loadCharacterSecrets|get_character_secrets_v1|service_role|tailwind/i);
 assert.doesNotMatch(source,/select\(["']\*|\.select\(["'].*background,.*motivation/);
});
test("T24-N02 scratch route and browser remain signed, localhost-only, with cleanup",()=>{
 const fixture=read("scripts/integration/c34/fixtures/t24_nonmap_manager_next_probe_page.jsx");
 const runner=read("scripts/integration/c34/test_t24_current_next_manager_browser.mjs");
 assert.match(fixture,/NonMapNpcManagerResearchShell/);
 assert.match(fixture,/buildPrintableCharacterSheetModel/);
 assert.match(fixture,/buildOfficialCharacterSheetPdf/);
 assert.match(runner,/C34_T24_BROWSER_CONFIRM/);
 assert.match(runner,/DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY/);
 assert.match(runner,/fs\.copyFileSync\(sourcePage,probe\)/);
 assert.match(runner,/fs\.unlinkSync\(probe\)/);
 assert.match(runner,/fs\.rmSync\(temp,\{recursive:true,force:true\}\)/);
 assert.match(runner,/get_npc_profile_visible_v1/);
 assert.match(runner,/UPDATE public\.character_permissions SET can_edit=false/);
 assert.match(runner,/pdftotext/);
 assert.match(runner,/pdf\.getPageCount\(\),3/);
 assert.match(runner,/offsite/);
 assert.doesNotMatch(runner,/SUPABASE_SERVICE_ROLE_KEY|https:\/\/[a-z0-9-]+\.supabase\.co/);
});
