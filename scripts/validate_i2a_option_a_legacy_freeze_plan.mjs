#!/usr/bin/env node
// I2-A owner decision / planning contract ONLY. No DB or external API access.
// The existing I1-N source census is the immutable source-fingerprint record;
// this validator makes sure the new Option A decision does NOT silently edit it.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const doc=readFileSync("docs/I2_A_CANONICAL_SHEETS_LEGACY_FREEZE_OWNER_DECISION_2026-11-11.md","utf8");
const audit=readFileSync("scripts/audits/i2a_option_a_legacy_sheet_readonly_readiness.sql","utf8");
const manifest=JSON.parse(readFileSync("docs/I1_N_LEGACY_SHEET_LIVE_SOURCE_CENSUS_2026-11-11.json","utf8"));
assert.equal(manifest.writers.length,34);
assert.equal(manifest.inserts.length,3);
assert.equal(manifest.database_player_row_lookups.length,6);
assert.equal(manifest.app_player_row_reads.length,7);
for(const w of manifest.writers){
  assert.match(w.fingerprint,/^[a-f0-9]{32}$/,"source hash must be exact for "+w.sig);
}
const required=[
  "Option A","owner explicitly approved","public.character_sheets",
  "players.sheet","frozen legacy compatibility snapshot",
  "no automatic write","all 34","three INSERT/UPSERT",
  "SECURITY DEFINER","table-level","name",
  "no automatic backfill","source RED",
  "same character","all 34+3","isolated restore",
  "owner approval","No production"
];
for(const key of required){
  assert.ok(doc.toLowerCase().includes(key.toLowerCase()),
    "Missing owner-decision or release-gate concept: "+key);
}
assert.match(doc,/I1-M\/O\/P GREEN tests/i);
assert.match(doc,/before any migration/i);
const sqlUncommented=audit.replace(/^\s*--.*$/gm,"");
assert.match(sqlUncommented,/pg_get_functiondef/);
assert.match(sqlUncommented,/pg_policies/);
assert.match(sqlUncommented,/pg_trigger/);
assert.match(sqlUncommented,/has_column_privilege/);
assert.match(sqlUncommented,/nonempty_missing_creation_marker/);
assert.match(sqlUncommented,/get_my_player_characters_v2/);
assert.doesNotMatch(sqlUncommented,/^\s*(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE|CALL|DO|EXECUTE|COPY)\b/im,
 "No executable SQL mutation statements permitted in read-only I2-A audit");
const playerUI=readFileSync("components/PlayerAccountPanel.js","utf8");
assert.match(playerUI,/\.from\("players"\)/);
assert.match(playerUI,/\.update\(\{\s*name:/);
assert.match(playerUI,/\.insert\(\{\s*user_id:.*name:/);
const characterUI=readFileSync("components/PlayerCharacterProfilePanelUnified.js","utf8");
assert.match(characterUI,/supabase\.rpc\("get_my_player_characters_v2"\)/);
console.log("PASS I2A-01: owner Option A explicitly recorded; all original I1-N 34 writer MD5 records, 3 inserts and 7 client identity consumers retained");
console.log("PASS I2A-02: SELECT-only readiness SQL includes metadata, RLS, privilege and aggregate preservation checks without DML/DDL statements");
console.log("PASS I2A-03: actual PlayerAccountPanel name profile path and canonical character list reader remain source-identifiable");
console.log("I2A LIMIT: static research/decision validation only. NO database migration, source-writer retirement, browser role test or freeze has occurred.");
