#!/usr/bin/env node
// I2-F read-only static exact-source and scope ledger checks, no DB/API access.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const old=JSON.parse(readFileSync("docs/I2_E_OPTION_A_ACCOUNT_WRITER_COVERAGE_2026-11-11.json","utf8"));
const next=JSON.parse(readFileSync("docs/I2_F_ACCOUNT_WRITER_COVERAGE_2026-11-11.json","utf8"));
const live=JSON.parse(readFileSync("docs/I1_N_LEGACY_SHEET_LIVE_SOURCE_CENSUS_2026-11-11.json","utf8"));
const original=readFileSync("scripts/fixtures/i2f_original_source_species_projection_shared_forge_pg17.sql","utf8");
const candidate=readFileSync("scripts/fixtures/i2f_option_a_source_species_projection_scratch_pg17.sql","utf8");
const test=readFileSync("scripts/test_i2f_source_species_projection_option_a_local_auth.mjs","utf8");
const report=readFileSync("docs/I2_F_SOURCE_SPECIES_PROJECTION_OPTION_A_SIGNED_RESEARCH_2026-11-11.md","utf8");
const md5=new Map([
 ["private.ensure_character_source_choices_v1","69bedf66148d2ce3dab97baa5de606cc"],
 ["private.set_species_runtime_projection_v1","7f6e7d7d99ff79db1372462b4320c21b"]
]);
assert.equal(next.schema_version,"i2f-option-a-source-species-projection-writer-coverage-v1");
assert.equal(next.original_update_writer_total,34);
assert.equal(next.original_update_writer_scratch_tested,9);
assert.equal(next.original_update_writer_untested,25);
assert.equal(next.original_update_writers.length,34);
assert.deepEqual(next.original_insert_upserts,old.original_insert_upserts);
assert.deepEqual(next.additional_private_source_paths,old.additional_private_source_paths);
const ref=new Map(live.writers.map(x=>[x.sig,x.fingerprint]));
let newly=0,tested=0;
for(const entry of next.original_update_writers){
 assert.equal(ref.get(entry.signature),entry.source_md5,"Live source identity drift: "+entry.signature);
 const name=entry.signature.split("(")[0];
 if(entry.status!=="not_option_a_tested")tested++;
 if(md5.has(name)){
  newly++;
  assert.equal(entry.source_md5,md5.get(name));
  assert.equal(entry.status,"i2f_privileged_original_RED_then_scratch_GREEN_verified");
  assert.match(entry.note,/NOT signed public\/private helper RPC/);
 } else {
  const before=old.original_update_writers.find(x=>x.signature===entry.signature);
  assert.deepEqual(entry,before,"Older research coverage changed: "+entry.signature);
 }
}
assert.equal(newly,2);assert.equal(tested,9);
assert.equal(next.i2f_evidence.github_actions_run,43150417164);
assert.equal(next.i2f_evidence.job_id,130957990966);
assert.equal(next.i2f_evidence.conclusion,"success");
assert.equal(next.i2f_evidence.acceptance,"I2F-01 through I2F-11 PASS");
assert.deepEqual(Object.entries(next.i2f_source_md5).sort(),[...md5.entries()].sort());
assert.match(next.i2f_execution_boundary,/PRIVILEGED local PostgreSQL17 SQL/);
for(const [name,hash] of md5){
 assert.match(original,new RegExp("CREATE OR REPLACE FUNCTION "+name.replace(/\./g,"\\.")));
 assert.ok(original.includes(hash));
}
assert.match(original,/REVOKE ALL ON FUNCTION private\.ensure_character_source_choices_v1/);
assert.match(original,/REVOKE ALL ON FUNCTION private\.set_species_runtime_projection_v1/);
assert.match(candidate,/I2F_OPTION_A_NO_LEGACY_PROJECTION_WRITE/);
assert.match(candidate,/md5\(replace\(v_after,v_new,x.account_update\)\)/);
assert.match(candidate,/has_function_privilege\('authenticated'/);
for(let i=1;i<=11;i++){
 const key="PASS I2F-"+String(i).padStart(2,"0");
 assert.ok(test.includes(key),"Missing original RED/scratch acceptance "+key);
}
for(const word of ["Option A","signed local GoTrue","privileged","not signed user RPCs","sourceChoices","species runtime","25 original UPDATE","31-trigger","No production SQL","not yet GREEN"]){
 assert.ok(report.toLowerCase().includes(word.toLowerCase()),"Documentation scope missing "+word);
}
console.log("PASS I2F-STATIC: 2 exact live private projection source MD5s, reversible account-update-only test candidate and authenticated EXECUTE denial source guarded");
console.log("PASS I2F-COVERAGE: signed-created local private helper RED/scratch GREEN 11/11 verified in #43150417164, 9/34 original writers bounded, 25 untested; NOT signed helper RPCs or production acceptance");
