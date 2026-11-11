#!/usr/bin/env node
// I2-B source-only evidence: 3 tested / 31 explicitly untested; no DB access.
import fs from "node:fs";
import assert from "node:assert/strict";
const ledger=JSON.parse(fs.readFileSync("docs/I2_B_OPTION_A_SOURCE_WRITER_COVERAGE_2026-11-11.json","utf8"));
const prior=JSON.parse(fs.readFileSync("docs/I1_N_LEGACY_SHEET_LIVE_SOURCE_CENSUS_2026-11-11.json","utf8"));
assert.equal(ledger.schema_version,"i2b-option-a-legacy-write-test-coverage-v1");
assert.equal(ledger.updaters.length,34);
assert.equal(ledger.insert_upserts.length,3);
assert.equal(ledger.updater_scratch_tested,3);
assert.equal(ledger.updater_not_yet_tested,31);
assert.equal(ledger.insert_path_scratch_tested,0);
assert.equal(ledger.insert_path_not_yet_tested,3);
const original=new Map(prior.writers.map(x=>[x.sig,x.fingerprint]));
for(const w of ledger.updaters){
 assert.equal(original.get(w.signature),w.source_md5,"Source fingerprint changed: "+w.signature);
 assert.ok(["first_signed_no_write_slice","not_option_a_tested"].includes(w.status));
}
const actual=ledger.updaters.filter(x=>x.status==="first_signed_no_write_slice");
assert.deepEqual(actual.map(x=>x.signature.split("(")[0]).sort(),[
 "private.complete_character_level_up_base_v3",
 "private.restore_character_rest_action_state_v1",
 "private.sync_player_forge_class_spell_summary_v1"
].sort());
const ins=new Map(prior.inserts.map(x=>[x.sig,x.fingerprint]));
for(const x of ledger.insert_upserts){
 assert.equal(ins.get(x.signature),x.source_md5);
 assert.equal(x.status,"not_option_a_tested");
}
const doc=fs.readFileSync("docs/I2_B_OPTION_A_FIRST_SIGNED_FREEZE_SLICE_2026-11-11.md","utf8");
for(const word of ["Option A","same-character","different-character","31 UPDATE","3 INSERT/UPSERT","not Option-A-tested","not frozen a single production writer","v1 character creator","IF NOT FOUND","source-original","account","RLS"]){
 assert.ok(doc.toLowerCase().includes(word.toLowerCase()),"Missing scope note: "+word);
}
const fixt=fs.readFileSync("scripts/fixtures/i2b_option_a_first_three_writers_scratch_pg17.sql","utf8");
const acl=fs.readFileSync("scripts/fixtures/i2b_option_a_scratch_player_profile_acl_pg17.sql","utf8");
assert.match(fixt,/I2B_OPTION_A_FROZEN_LEGACY_MIRROR/);
assert.match(fixt,/md5\(replace\(v_after,v_sentinel,x\.original_update\)\)/);
assert.match(acl,/REVOKE ALL ON TABLE public\.players/);
assert.match(acl,/GRANT UPDATE \(user_id,name,updated_at\)/);
assert.doesNotMatch(acl,/GRANT UPDATE \(sheet/);
console.log("PASS I2B-SOURCE: 3 original writer MD5 identities source-linked and declared first-slice-only; 31 update + all 3 insert/upsert paths explicitly untested");
console.log("I2B-SOURCE LIMIT: static ledger and source checks, actual signed no-write and ACL acceptance must come from disposable CI logs.");
