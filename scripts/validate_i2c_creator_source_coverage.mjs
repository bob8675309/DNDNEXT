#!/usr/bin/env node
// I2-C source/coverage regression only. Does not connect to a database.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ledger=JSON.parse(readFileSync("docs/I2_C_OPTION_A_CREATION_SOURCE_WRITER_COVERAGE_2026-11-11.json","utf8"));
const original=JSON.parse(readFileSync("docs/I1_N_LEGACY_SHEET_LIVE_SOURCE_CENSUS_2026-11-11.json","utf8"));
const originalBySig=new Map(original.writers.map(x=>[x.sig,x.fingerprint]));
const originalInserts=new Map(original.inserts.map(x=>[x.sig,x.fingerprint]));
assert.equal(ledger.schema_version,"i2c-option-a-source-writer-coverage-v1");
assert.equal(ledger.original_update_writer_total,34);
assert.equal(ledger.original_update_writer_scratch_tested,4);
assert.equal(ledger.original_update_writer_untested,30);
assert.equal(ledger.original_update_writers.length,34);
assert.equal(ledger.original_insert_upsert_total,3);
assert.equal(ledger.original_insert_upsert_scratch_tested,3);
assert.equal(ledger.original_insert_upsert_untested,0);
assert.equal(ledger.original_insert_upserts.length,3);
for(const x of ledger.original_update_writers){
 assert.equal(originalBySig.get(x.signature),x.source_md5,"Live source identity drift: "+x.signature);
}
for(const x of ledger.original_insert_upserts){
 assert.equal(originalInserts.get(x.signature),x.source_md5);
 assert.equal(x.status,"signed_i2c_source_and_candidate");
}
const covered=ledger.original_update_writers.filter(x=>x.status!=="not_option_a_tested");
assert.deepEqual(covered.map(x=>x.signature.split("(")[0]).sort(),
 ["private.complete_character_level_up_base_v3",
  "private.restore_character_rest_action_state_v1",
  "private.sync_player_forge_class_spell_summary_v1",
  "public.create_player_character_v1"].sort());
assert.ok(ledger.newly_discovered_or_existing_indirect_paths_not_counted_in_original_census
 .some(x=>x.signature.includes("private.create_player_character_v2_source_20261105")&&x.status==="unfrozen_untested"));
const files=[
 "scripts/fixtures/i2c_original_creation_signup_shared_forge_pg17.sql",
 "scripts/fixtures/i2c_option_a_creator_identity_only_scratch_pg17.sql",
 "scripts/fixtures/i2c_option_a_signup_profile_acl_scratch_pg17.sql",
 "scripts/test_i2c_option_a_signed_creation_profile.mjs",
 "docs/I2_C_OPTION_A_CREATOR_SIGNUP_SIGNED_RESEARCH_2026-11-11.md"
];
const [originalSql,candidateSql,aclSql,testJs,doc]=files.map(p=>readFileSync(p,"utf8"));
assert.match(originalSql,/e2db5802f1f51b93f5b9d374a835e4b9/);
assert.match(originalSql,/0351f0a00acae023278e1b8b065b00c9/);
assert.match(originalSql,/dd7113eec05655a661309838acce6030/);
assert.match(candidateSql,/md5\(replace\(v_after,v_new,x.original_block\)\)/);
assert.match(candidateSql,/on conflict \(user_id\) do nothing;/);
assert.match(aclSql,/REVOKE ALL ON TABLE public\.players/);
assert.match(aclSql,/GRANT INSERT\(user_id,name\)/);
assert.match(aclSql,/GRANT UPDATE\(user_id,name,updated_at\)/);
assert.match(testJs,/PASS I2C-02 EXPECTED ORIGINAL V1 RED/);
assert.match(testJs,/PASS I2C-03 EXPECTED ORIGINAL V2 RED/);
assert.match(testJs,/PASS I2C-10:/);
for(const k of ["Option A","private.create_player_character_v2_source_20261105","not a hosted migration","original v1","original v2","signup"]){
 assert.ok(doc.toLowerCase().includes(k.toLowerCase()),"Missing required scope: "+k);
}
console.log("PASS I2C-STATIC: 4/34 and 3/3 original source-path bounded signed coverage accounted; private v2/v3 untested blocker explicit");
console.log("I2C-STATIC LIMIT: source/coverage integrity only; signed behavior and release gates require separate disposable CI evidence");
