#!/usr/bin/env node
// Source contract for preserving legacy players.sheet across new characters.
// This candidate must NOT silently alter grants, spells, event identity or Forge UI.
import assert from "node:assert/strict";
import fs from "node:fs";
const orig=fs.readFileSync("scripts/fixtures/player_character_v2_live_source_pg17.sql","utf8");
const candidate=fs.readFileSync("sql/candidates/20261104_player_forge_preserve_legacy_sheet.sql","utf8");
const test=fs.readFileSync("scripts/fixtures/player_character_multi_legacy_sheet_pg17.sql","utf8");
const profile=fs.readFileSync("components/PlayerCharacterProfilePanelUnified.js","utf8");
const forge=fs.readFileSync("components/NewNpcModalV3.js","utf8");
const originalClause="insert into public.players(user_id, name, sheet, updated_at) values(v_user, v_name, v_sheet, now()) on conflict (user_id) do update set sheet = excluded.sheet, updated_at = now();";
const guardedClause="insert into public.players(user_id, name, sheet, updated_at) values(v_user, v_name, v_sheet, now()) on conflict (user_id) do update set sheet = excluded.sheet, updated_at = now() where public.players.sheet = '{}'::jsonb;";
assert.equal(orig.split(originalClause).length,2,"original exact source anchor changed");
assert.equal(candidate.split(guardedClause).length,2,"candidate changed expected legacy sheet guard");
const start=orig.indexOf("CREATE OR REPLACE FUNCTION public.create_player_character_v2(");
const source=orig.slice(start).trim();
const newStart=candidate.indexOf("CREATE OR REPLACE FUNCTION public.create_player_character_v2(");
const changed=candidate.slice(newStart).split("\n-- Existing CREATE OR REPLACE function retains")[0].trim();
assert.equal(changed,source.replace(originalClause,guardedClause),
  "Candidate must be source-exact except for one account-wide snapshot conflict WHERE clause");
assert.ok(candidate.includes("0351f0a00acae023278e1b8b065b00c9"),"missing original source fingerprint guard");
for(const token of [
 "insert into public.character_permissions",
 "insert into public.character_progression",
 "insert into public.character_level_events",
 "insert into public.character_sheets",
 "creation_request_id",
 "when unique_violation then",
 "v_user",
]) assert.ok(changed.includes(token),`Critical creation authority absent: ${token}`);
for(const token of ["Baseline Fighter One","Baseline Fighter Two",
 "baseline-alternate","Candidate Fighter One","Candidate Fighter Two",
 "legacy-original","auto-created","player_character_created",
 "can_edit","M01","M02"]) assert.ok(test.includes(token),`Missing parity fixture: ${token}`);
for(const token of [
 'supabase.rpc("get_my_player_characters_v2")',
 'preferredCharacterId',
 'setCharacters(normalized)',
 'onChange={(event) => {',
 'Create another character'
]) assert.ok(profile.includes(token),`Missing existing multi-character profile contract: ${token}`);
assert.ok(forge.includes('supabase.rpc("create_player_character_v3"'),
 "Must reuse original Forge v3 creation contract");
console.log("Player Forge legacy-snapshot candidate: exact-source one-clause change, canonical authorities and multi-character UI guards PASS.");
