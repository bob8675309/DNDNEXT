#!/usr/bin/env node
// T46-P2 original-source guarantees: unit/source-level, NOT signed acceptance.
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const hash=p=>{
 const b=fs.readFileSync(path.join(root,p));
 return crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
};
const original={
 "scripts/integration/c34/fixtures/forge_creation_replay_local_auth_pr351_pg17.sql":"aa701c679712475cd4f04d4e0a01fedc4616bafa",
 "scripts/fixtures/c33_forge_privacy_original_policy_join_pg17.sql":"12612c4acbe861817037e1ab5a79ddb7c40a55e9",
 "scripts/integration/c34/sources/02_npc_profile_stage1.sql":"9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3",
 "scripts/integration/c34/sources/03_npc_dossier_stage2.sql":"afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac",
 "scripts/integration/c34/sources/04_private_story_stage3.sql":"01e48823ac3a46aa5880e98200e97c2595501ce7",
 "scripts/integration/c34/candidates/t46_progression_visibility_discovery_pg17.sql":"fe2f8ee1bd694601912e28a03ccf3e9a6df4adaa",
 "sql/20260710_02_character_progression_foundation.sql":"b1b9781e06e9210a30c520b7f531bce7cbdbd82a",
 "sql/20260710_04_character_xp_level_up_review.sql":"81bce9bec9c59b3b673aeaada913cd054e4b74c7",
 "components/CharacterClassPanel.js":"d39d2bceab944d3d4ec42cc2cfda92609ce51a2b",
 "components/c34/NonMapNpcProfileResearchShell.jsx":"8ddd3c451449cbd8aa256d237f1f17902e614b98",
 "utils/c34/readNonMapNpcProfileCandidate.mjs":"80501d106db9788c466ab39e63a2f6c062a9b0a7"
};
test("T46-P2-01: all inherited exact original #345 and current Level Up assets preserved",()=>{
 for(const [p,sha] of Object.entries(original))
  assert.equal(hash(p),sha,p+" source drift");
 const sourceStage=read("scripts/integration/c34/sources/04_private_story_stage3.sql");
 assert.match(sourceStage,/Changing editable sheet.profileReveal.secret does NOT publish GM secrets/);
 assert.match(sourceStage,/character_public_secret_revelations/);
 const old=read("sql/20260710_02_character_progression_foundation.sql");
 assert.match(old,/create or replace function public.get_character_progression_v1/);
 assert.doesNotMatch(old,/if not private.can_manage_character_progression_v1\(p_character_id\)/);
});
test("T46-P2-02: only research component; strict sanitized per-character data and race guards",()=>{
 const s=read("components/c34/DiscoveredProgressionIntel.jsx");
 for(const token of [
  "sanitizeDiscoveredProgression","const ID=","characterId","p_character_id:characterId",
  "get_progression_discoveries","c34_t46_get_progression_discoveries_v1",
  "sequence.current","auth.onAuthStateChange","SIGNED_OUT","TOKEN_REFRESHED",
  "client.auth.getUser()","last.data?.user?.id!==actor","setResult(response.error?null:",
  "No progression details discovered.","Discovered Intel"])
  assert.ok(s.includes(token),token);
 assert.doesNotMatch(s,/get_character_progression_v1|character_sheets|service_role|gmNotes|secret_text|(?:window|document)\./);
 assert.match(s,/if\(raw.class&&typeof raw.class==="object"/);
 assert.match(s,/if\(own\(raw,"level"\)&&Number.isSafeInteger/);
 assert.match(s,/if\(own\(raw,"xp"\)&&Number.isSafeInteger/);
});
test("T46-P2-03: signed runner uses original Stage1–3, Next parent, no UI bypass",()=>{
 const s=read("scripts/integration/c34/test_t46_p2_real_next_profile_signed.mjs");
 for(const token of [
 "DNDNEXT_T46_P2_LOCAL_CONFIRM","127.0.0.1:54321",
 "private.character_creator_attribution","get_npc_profile_visible_v1",
 "get_npc_dossier_admin_v1","character_public_secret_revelations",
 "get_character_progression_v1","c34_t46_get_progression_discoveries_v1",
 "c34_t46_set_progression_discovery_v1","from(\"character_sheets\")",
 "NonMapNpcProfileResearchShell","DiscoveredProgressionIntel",
 "CharacterClassPanel","signed","SIGNED_OUT","is_hidden","can_edit",
 "same-JWT","page.on(\"pageerror\"","test ! -e"])
  assert.ok(s.includes(token)||
     (token==="test ! -e"&&s.includes("assert.ok(!fs.existsSync(routePath)")),token);
 assert.doesNotMatch(s,/NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP|MapPageClient|pages\/map|NEXT_PUBLIC_SUPABASE_URL:.*supabase\.co/);
 assert.match(s,/SOURCE_ORIGINAL|#345|source-original/i);
});
test("T46-P2-04: candidate never mounted by app entrypoints",()=>{
 for(const p of [
  "pages/_app.js","components/MapPageClient.js","components/NpcPanel.js",
  "components/character/CharacterInteractionPanel.js",
  "components/c34/NonMapNpcProfileResearchShell.jsx"
 ])assert.ok(!read(p).includes("DiscoveredProgressionIntel"),p+" unexpectedly mounted");
 const component=read("components/c34/DiscoveredProgressionIntel.jsx");
 assert.ok(component.includes("research-only"));
});
