#!/usr/bin/env node
// C3.3 regression: the role-wide private-lore SELECT revoke must not break the
// existing player-character Profile fallback or reintroduce raw GM lore queries.
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const player = read("components/PlayerCharacterProfilePanelUnified.js");
const stage2 = read("sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql");
const stage3 = read("sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql");
const npc = read("components/NpcPanel.js");
const admin = read("pages/npcs.js");
const fallback = player.match(/function characterSelectColumns\(\)\s*\{[\s\S]*?\n\}/)?.[0];
assert(fallback, "Unified player Profile fallback selector missing");
assert(player.includes('supabase.rpc("get_my_player_characters_v2")'),
  "Primary player Profile must use server-authorized v2 reader");
for (const col of ["background", "motivation", "quirk", "mannerism", "voice"]) {
  assert(stage2.includes(col), "Expected private-lore SQL column revoke missing "+col);
  assert(!fallback.includes(`"${col}"`) && !fallback.includes(`'${col}'`),
    "Fallback directly requests revoked private lore column: "+col);
}
assert(!fallback.includes("*"), "No wildcard fallback projection allowed");
assert(stage3.includes("CASE WHEN cp.can_edit"), "Protected editor-only full serialization absent");
assert(stage3.includes("to_jsonb(c) - 'secret'"),
  "Sanitized editor read must remove legacy GM secret");
assert(npc.includes('get_npc_profile_visible_v1') && npc.includes('get_npc_dossier_admin_v1'),
  "NPC Profile server-safe reader split removed");
assert(admin.includes("get_npc_dossier_admin_v1"), "GM dossier reader removed from admin page");
assert(admin.includes("get_character_editor_narrative_v1"), "Non-GM editor reader missing");
assert(admin.includes("const selectedCharPerm = charPerm?.character_id"), "Character selection must scope can_edit");
assert(admin.includes("canEditCharacter && hasNarrative && detailsDraft"), "Narrative save can overwrite unread data");
assert(admin.includes("isAdmin={isAdmin}") && !admin.includes("isAdmin={isAdmin || canEditCharacter}"),
  "Edit rights must not be promoted to GM permissions");
// Explicit character-reader projections across NPC, town, inventory, encounter,
// visuals and map surfaces must stay compatible with stage2 role-wide SELECT
// revocation. This static check does NOT prove dynamic SQL or signed browser roles.
const protectedLore = new Set(["background","motivation","quirk","mannerism","voice","secret"]);
const readerPaths = [
  "pages/npcs.js",
  "pages/inventory.js",
  "pages/town/[id].js",
  "pages/admin.js",
  "pages/admin/character-visuals.js",
  "pages/encounters/live.js",
  "pages/encounters/smoke.js",
  "pages/encounters/multiplayer-smoke.js",
  "components/MapPageClient.js",
  "components/LocationSideBar.js",
  "components/CharacterVisualsPanel.js",
  "components/PortraitPickerModal.js",
  "components/NpcForgeEquipmentStep.js",
  "components/NpcForgeCoreSupport.js",
];
let checkedProjections = 0;
function assertSafeProjection(path, projection) {
  const fields = [...projection.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
  for (const item of fields) {
    const name = item.split(":").at(-1).split("(")[0].trim().toLowerCase();
    assert(!protectedLore.has(name) && name !== "*",
      path+": protected lore/wildcard added to public roster projection: "+item);
  }
  checkedProjections += 1;
}
for (const path of readerPaths) {
  const source = read(path);
  const rawText = /\.from\(\s*["']characters["']\s*\)\s*\.select\(\s*(["'])([^"']*)\1\s*\)/g;
  for (const match of source.matchAll(rawText)) {
    const columns = match[2].split(",").map((col) => JSON.stringify(col.trim())).join(",");
    assertSafeProjection(path, columns);
  }
  const inlineArrays = /\.from\(\s*["']characters["']\s*\)\s*\.select\(\s*\[([\s\S]*?)\]\s*\.join\(\s*["'],["']\s*\)\s*\)/g;
  for (const match of source.matchAll(inlineArrays)) assertSafeProjection(path, match[1]);
  if (path === "components/MapPageClient.js" || path === "pages/town/[id].js") {
    const namedArrays = /\b(?:const|let)\s+(?:selectWithMeta|selectNoMeta|merchantSelect)\s*=\s*\[([\s\S]*?)\]\s*\.join\(\s*["'],["']\s*\)/g;
    for (const match of source.matchAll(namedArrays)) assertSafeProjection(path, match[1]);
  }
}
assert(checkedProjections >= 17, "Character reader inventory lost projections; re-audit dynamic source selectors");
console.log("PASS C3.3 "+checkedProjections+" direct character roster projections do not request role-wide private lore");
console.log("PASS C3.3 unified player fallback honors role-wide private-lore ACL; editor RPC remains sanitized");

const forge = read("components/NewNpcModalV3.js");
const story = read("components/NpcForgeStepContent.js");
assert(forge.includes('supabase.rpc("create_player_character_with_private_backstory_v1"'),
  "Actual player Forge must use atomic creator-backstory wrapper, not original unguarded v3");
assert(forge.includes("return { ...payload, secret: null, kind:"),
  "Player Forge must not populate the GM-only characters.secret field");
assert(forge.includes('p_private_backstory: String(originalPayload?.secret || "")'),
  "Player Forge must retain the generated/personal Story text in its private input");
assert(story.includes("Private backstory (creator and GM only)"),
  "Player Story input must be labelled as creator-private, not GM Secret");
assert(stage3.includes("SECURITY INVOKER") && stage3.includes(
  "public.create_player_character_with_private_backstory_v1"),
  "Backstory creation must use the original Forge+private upsert in one invoker transaction");
console.log("PASS C3.3 player generated Story securely routes to atomic creator-private backstory rather than GM secret");
