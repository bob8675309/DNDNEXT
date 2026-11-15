#!/usr/bin/env node
// Static contract for the Admin-only existing/legacy permission editor.
import assert from "node:assert/strict";
import fs from "node:fs";
const page=fs.readFileSync("pages/npcs.js","utf8");
const panel=fs.readFileSync("components/character/AdminCharacterPermissionsPanel.js","utf8");
const fixture=fs.readFileSync("scripts/test_admin_character_creation_notice_local_auth.mjs","utf8");
const sql=fs.readFileSync("scripts/fixtures/admin_character_creation_notice_local_auth_pg17.sql","utf8");
for(const required of [
  'import AdminCharacterPermissionsPanel from "../components/character/AdminCharacterPermissionsPanel"',
  "isAdmin && selected?.id",
  "<AdminCharacterPermissionsPanel",
  "key={String(selected.id)}",
  "characterId={selected.id}",
  "players={players}"
]) assert.ok(page.includes(required),`NPC page must scope Admin controls to selection: ${required}`);
for(const required of [
  "if (!isAdmin || !characterId) return null",
  '.from("character_permissions")',
  '.from("user_profiles").select("id,role")',
  '.eq("character_id", characterId)',
  '.eq("user_id", userId)',
  '.eq("can_edit", Boolean(existing.can_edit))',
  '.eq("can_inventory", Boolean(existing.can_inventory))',
  '.eq("can_convert", Boolean(existing.can_convert))',
  '.insert({ character_id: characterId, user_id: userId, ...flags })',
  '.select("character_id,user_id,can_edit,can_inventory,can_convert,created_at")',
  "Disable every legacy permission",
  "no new combat-control",
  "Refresh permissions",
]) assert.ok(panel.includes(required),`Existing-grant scope/compatibility missing: ${required}`);
for(const unsafe of [
  '.delete(',
  '.from("characters").update(',
  'service_role',
  'can_control:',
  'secret:',
  'auth.admin.'
]) assert.ok(!panel.includes(unsafe),`Unsafe/undeployed permission or data operation: ${unsafe}`);
for(const marker of [
  "character_permissions_admin_write",
  "character_permissions_select_self",
  "PRIMARY KEY(character_id,user_id)"
]) assert.ok(sql.includes(marker),`Local real-JWT policy fixture missing ${marker}`);
for(const marker of ["PASS N05:", "PASS N06:", "PASS N07:"]) 
 assert.ok(fixture.includes(marker),`Local signed-in permission regression missing ${marker}`);
console.log("Existing-flag NPC Admin editor: scoped save, optimistic stale rejection, no deletion/secret/combat grants, real-JWT tests wired PASS.");
