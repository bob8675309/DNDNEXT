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
console.log("PASS C3.3 unified player fallback honors role-wide private-lore ACL; editor RPC remains sanitized");
