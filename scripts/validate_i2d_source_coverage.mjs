#!/usr/bin/env node
// I2-D research-only static source-scope validation. No network/DB writes.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ledger=JSON.parse(readFileSync("docs/I2_D_OPTION_A_CREATION_SOURCE_COVERAGE_2026-11-11.json","utf8"));
const original=JSON.parse(readFileSync("docs/I1_N_LEGACY_SHEET_LIVE_SOURCE_CENSUS_2026-11-11.json","utf8"));
const prior=JSON.parse(readFileSync("docs/I2_C_OPTION_A_CREATION_SOURCE_WRITER_COVERAGE_2026-11-11.json","utf8"));
const source=readFileSync("sql/candidates/20261105_player_creation_immutable_intent_v1.sql","utf8");
const candidate=readFileSync("scripts/fixtures/i2d_option_a_private_forge_source_scratch_pg17.sql","utf8");
const signed=readFileSync("scripts/test_i2d_private_v3_story_option_a_local_auth.mjs","utf8");
const doc=readFileSync("docs/I2_D_PRIVATE_V3_STORY_OPTION_A_SIGNED_RESEARCH_2026-11-11.md","utf8");
assert.equal(ledger.schema_version,"i2d-option-a-private-forge-source-coverage-v1");
assert.equal(ledger.original_update_writer_total,34);
assert.equal(ledger.original_update_writer_scratch_tested,4);
assert.equal(ledger.original_update_writer_untested,30);
assert.equal(ledger.original_update_writers.length,34);
assert.equal(ledger.original_insert_upsert_total,3);
assert.equal(ledger.original_insert_upsert_scratch_tested,3);
assert.equal(ledger.original_insert_upserts.length,3);
assert.deepEqual(ledger.original_update_writers,prior.original_update_writers);
assert.deepEqual(ledger.original_insert_upserts,prior.original_insert_upserts);
assert.equal(original.writers.length,34);
assert.equal(original.inserts.length,3);
assert.equal(ledger.additional_private_source_paths.length,5);
const privateEntry=ledger.additional_private_source_paths.find(x=>x.signature==="private.create_player_character_v2_source_20261105(jsonb,jsonb)");
assert.ok(privateEntry);
assert.match(privateEntry.status,/i2d/);
const originalPrivateSourceStart=source.indexOf("CREATE OR REPLACE FUNCTION private.create_player_character_v2_source_20261105(");
const originalPrivateSourceEnd=source.indexOf("CREATE OR REPLACE FUNCTION private.create_player_character_v3_source_20261105(",originalPrivateSourceStart);
assert.ok(originalPrivateSourceStart>=0&&originalPrivateSourceEnd>originalPrivateSourceStart);
const privateSource=source.slice(originalPrivateSourceStart,originalPrivateSourceEnd).toLowerCase();
const originalUPSERT="insert into public.players(user_id, name, sheet, updated_at) values(v_user, v_name, v_sheet, now()) on conflict (user_id) do update set sheet = excluded.sheet, updated_at = now() where public.players.sheet = '{}'::jsonb;";
assert.equal(privateSource.split(originalUPSERT).length-1,1,"Original copied v2 UPSERT must remain a single source witness");
assert.equal(privateSource.split("update public.players").length-1,0);
assert.match(candidate,/I2D_OPTION_A_PRIVATE_FORGE_LEGACY_FREEZE/);
assert.match(candidate,/md5\(replace\(v_after,v_new,v_old\)\)<>v_original_md5/);
assert.match(candidate,/v_story_intent_md5/);
assert.match(candidate,/on conflict \(user_id\) do nothing/);
for(let id=1;id<=11;id++){
 assert.ok(signed.includes("PASS I2D-"+String(id).padStart(2,"0")+":" ) ||
 signed.includes("PASS I2D-"+String(id).padStart(2,"0")+" EXPECTED") ||
 signed.includes("PASS I2D-"+String(id).padStart(2,"0")+" ORIGINAL"),
 "Signed source/script test missing I2D-"+String(id).padStart(2,"0"));
}
for(const word of ["EMPTY","populated","private Story","30 original UPDATE","signed","no automatic","do not mark GREEN","31 original Forge triggers"]){
 assert.ok(doc.toLowerCase().includes(word.toLowerCase()),"Document missing critical caution: "+word);
}
console.log("PASS I2D-STATIC: #324 private copied v2 original UPSERT exact witness, one account-write statement, source-reversible private-only candidate and I2D-01..11 signed acceptance retained");
console.log("I2D-STATIC LIMIT: 4/34 original UPDATE family bounded and 30 untested; private v3/Story behavior requires separate successful disposable signed CI, no production approval");
