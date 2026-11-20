#!/usr/bin/env node
// C34 T46-P3-P0: exact active-consumer source custody / negative integration
// preflight. T0 STATIC ONLY. No hosted or disposable SQL, no app mount, no
// assertion of production safety. Later signed original panels are required.
import {test} from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=filename=>fs.readFileSync(path.join(root,filename),"utf8");
const blob=filename=>{
  const bytes=fs.readFileSync(path.join(root,filename));
  return crypto.createHash("sha1")
    .update(Buffer.concat([Buffer.from("blob "+bytes.length+"\0"),bytes]))
    .digest("hex");
};

const ORIGINAL=Object.freeze({
  "components/NpcPanel.js":"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db",
  "components/character/CharacterInteractionPanel.js":"28a2dde5696376ee39c01a498b76a146f30aaffa",
  "pages/npcs.js":"7fc00b9b3ace6233d1648a3d017f8a05e072d722",
  "pages/town/[id].js":"c66508b798645e189bb900e63bc17b85b8662e10",
  "pages/inventory.js":"02d52821d0f22aa82ad92263c5014712906ee385",
  "components/CharacterSheetPanel.js":"cb3511bf25a97be3a07c6e5d93ee62bb16570327",
  "utils/officialCharacterSheetPdf.js":"a11c3432b40aa938c572d543ecb2e9316878cce2",
  "hooks/useNpcSheetActionData.js":"61e3acb114c032cd275eb77d4d4c6f245da5ad20",
  "components/CharacterClassPanel.js":"d39d2bceab944d3d4ec42cc2cfda92609ce51a2b",
  "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a",
  "components/c34/DiscoveredProgressionIntel.jsx":"9dcb19a057680dc5b987449373185d4570d29bf6",
  "components/c34/NonMapNpcProfileResearchShell.jsx":"8ddd3c451449cbd8aa256d237f1f17902e614b98",
  "scripts/integration/c34/sources/02_npc_profile_stage1.sql":"9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3",
  "scripts/integration/c34/sources/03_npc_dossier_stage2.sql":"afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac",
  "scripts/integration/c34/sources/04_private_story_stage3.sql":"01e48823ac3a46aa5880e98200e97c2595501ce7",
  "scripts/integration/c34/candidates/t46_progression_visibility_discovery_pg17.sql":"fe2f8ee1bd694601912e28a03ccf3e9a6df4adaa"
});

test("T46-P3-P0-01: current actual consumers, protected map, and original staged privacy blobs are unchanged",()=>{
  for(const [filename,sha] of Object.entries(ORIGINAL))
    assert.equal(blob(filename),sha,filename+" changed without renewed source review");
});

test("T46-P3-P0-02: source-original active NPC Profile/manager still use raw data paths (known unsafe integration boundary)",()=>{
  const npc=read("components/NpcPanel.js");
  const manager=read("pages/npcs.js");
  assert.match(npc,/loadCharacterSecrets\(supabase/);
  assert.match(npc,/\.from\("characters"\)/);
  assert.match(npc,/\.from\("character_sheets"\)\.select\("sheet"\)/);
  assert.match(npc,/supabase\.rpc\("get_character_progression_v1"/);
  assert.match(manager,/\.from\("character_sheets"\)/);
  assert.match(manager,/sheetCacheRef\.current\.set\(/);
  assert.match(manager,/loadCharacterSecrets\(supabase/);
  assert.doesNotMatch(manager,/onAuthStateChange\(/);
  // These intentionally positive source-characterization asserts MUST be
  // replaced with signed RED -> actual consumer GREEN before live cutover.
});

test("T46-P3-P0-03: shared Interaction, Class and action hook need authenticated per-actor invalidation",()=>{
  const ui=read("components/character/CharacterInteractionPanel.js");
  const cls=read("components/CharacterClassPanel.js");
  const hook=read("hooks/useNpcSheetActionData.js");
  assert.match(ui,/requestedIsAdmin \|\| resolvedAdmin/);
  assert.match(ui,/rpc\("is_admin"\)/);
  assert.match(ui,/rpc\("can_manage_character_progression_v1"/);
  assert.doesNotMatch(ui,/onAuthStateChange\(/);
  assert.match(cls,/rpc\("get_character_progression_v1"/);
  assert.match(hook,/rpc\("get_character_progression_v1"/);
  assert.match(hook,/\.from\("character_sheets"\)/);
});

test("T46-P3-P0-04: actual printable Sheet consumes parent-provided private data; print must be invalidated on role change",()=>{
  const manager=read("pages/npcs.js");
  const panel=read("components/CharacterSheetPanel.js");
  const pdf=read("utils/officialCharacterSheetPdf.js");
  assert.match(manager,/printProfile=\{printableProfile\}/);
  assert.match(manager,/printNotes=\{notes\}/);
  assert.match(panel,/async function openOfficialPrintableSheet\(/);
  assert.match(panel,/buildPrintableCharacterSheetModel\(/);
  assert.match(panel,/buildOfficialCharacterSheetPdf\(/);
  assert.match(panel,/window\.open\("", "_blank"\)/);
  assert.match(panel,/URL\.createObjectURL\(blob\)/);
  assert.match(pdf,/export const OFFICIAL_CHARACTER_SHEET_TEMPLATE_URL/);
  // Original printing is NOT a server authorization barrier; role and
  // character-switch invalidation belong upstream before any private model.
});

test("T46-P3-P0-05: verified Stage3-only published clue and server-authorized GM adjudication stay separate",()=>{
  const stage3=read("scripts/integration/c34/sources/04_private_story_stage3.sql");
  const candidate=read("scripts/integration/c34/candidates/t46_progression_visibility_discovery_pg17.sql");
  const intel=read("components/c34/DiscoveredProgressionIntel.jsx");
  assert.match(stage3,/character_public_secret_revelations/);
  assert.match(candidate,/up\.role IN \('admin', 'gm', 'dm'\)/);
  assert.match(candidate,/CREATE OR REPLACE FUNCTION public\.c34_t46_set_progression_discovery_v1/);
  assert.match(candidate,/p_source NOT IN \('gm_direct','dialogue','ability_check'\)/);
  assert.match(candidate,/NOT private\.current_user_is_admin\(\)/);
  assert.match(intel,/c34_t46_get_progression_discoveries_v1/);
  assert.match(intel,/get_npc_profile_visible_v1/);
  assert.doesNotMatch(intel,/c34_t46_set_progression_discovery_v1/);
  assert.doesNotMatch(intel,/get_character_progression_v1|client\.from\(/);
});

test("T46-P3-P0-06: no T46 client mounted in active routes and protected world map unchanged",()=>{
  for(const p of [
    "pages/_app.js","components/MapPageClient.js","components/NpcPanel.js",
    "components/character/CharacterInteractionPanel.js",
    "pages/npcs.js","pages/inventory.js","pages/town/[id].js"
  ])assert.ok(!read(p).includes("DiscoveredProgressionIntel"),p+" unexpectedly imports unapproved T46 discovery UI");
  const town=read("pages/town/[id].js");
  assert.match(town,/T28_P2_TOWN_SHOP_ENABLED = process\.env\.NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP === "1"/);
  assert.match(town,/T33_TOWN_SAFE_ENABLED = T28_P2_TOWN_SHOP_ENABLED && /);
  assert.match(read("components/c34/DiscoveredProgressionIntel.jsx"),/UNMOUNTED research-only/);
});
