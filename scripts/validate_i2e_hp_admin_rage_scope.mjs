#!/usr/bin/env node
// I2-E bounded original source/write coverage guard. No DB/network access.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const old=JSON.parse(readFileSync("docs/I2_D_OPTION_A_CREATION_SOURCE_COVERAGE_2026-11-11.json","utf8"));
const ledger=JSON.parse(readFileSync("docs/I2_E_OPTION_A_ACCOUNT_WRITER_COVERAGE_2026-11-11.json","utf8"));
const live=JSON.parse(readFileSync("docs/I1_N_LEGACY_SHEET_LIVE_SOURCE_CENSUS_2026-11-11.json","utf8"));
const report=readFileSync("docs/I2_E_HP_ADMIN_RAGE_OPTION_A_SIGNED_RESEARCH_2026-11-11.md","utf8");
const original=readFileSync("scripts/fixtures/i2e_original_hp_admin_rage_shared_forge_pg17.sql","utf8");
const candidate=readFileSync("scripts/fixtures/i2e_option_a_hp_admin_rage_scratch_pg17.sql","utf8");
const runner=readFileSync("scripts/test_i2e_signed_hp_admin_rage_option_a_local_auth.mjs","utf8");
const target=new Map([
 ["public.adjust_character_hit_points_v1","f855be60d971aa63e32ade327d14c369"],
 ["public.set_character_progression_v2","c4ea1c7993912f6b4c6fe9ee7b25343f"],
 ["public.update_character_sheet_action_state_v1","313a533250724b2e2abc754899d0f8d4"]
]);
assert.equal(live.writers.length,34);
assert.equal(ledger.schema_version,"i2e-option-a-hp-admin-rage-writer-coverage-v1");
assert.equal(ledger.original_update_writer_total,34);
assert.equal(ledger.original_update_writer_scratch_tested,7);
assert.equal(ledger.original_update_writer_untested,27);
assert.equal(ledger.original_update_writers.length,34);
assert.equal(ledger.original_insert_upsert_total,old.original_insert_upsert_total);
assert.deepEqual(ledger.original_insert_upserts,old.original_insert_upserts);
assert.deepEqual(ledger.additional_private_source_paths,old.additional_private_source_paths);
const byOriginal=new Map(live.writers.map(x=>[x.sig,x.fingerprint]));
let tested=0, newly=0;
for(const w of ledger.original_update_writers){
 assert.equal(w.source_md5,byOriginal.get(w.signature),"Original live MD5 drift: "+w.signature);
 if(w.status!=="not_option_a_tested")tested++;
 const name=w.signature.split("(")[0];
 if(target.has(name)){
  assert.equal(w.source_md5,target.get(name));
  assert.match(w.status,/i2e_original_RED_and_scratch_no_write_pending_signed_CI/);
  newly++;
 }else{
  const previous=old.original_update_writers.find(x=>x.signature===w.signature);
  assert.deepEqual(w,previous,"Only 3 new I2-E coverage statuses may change");
 }
}
assert.equal(tested,7);
assert.equal(newly,3);
assert.deepEqual(Object.entries(ledger.i2e_source_fingerprints).sort(),
 [...target.entries()].sort());
assert.equal(ledger.i2e_admin_v1_no_legacy_writer_fingerprint,"eb467b7c7a8d548581a36cfcb0d8f77b");
assert.match(ledger.i2e_synthetic_specimen_caveat,/NOT a signed Barbarian Forge/i);
for(const [name,hash] of target){
 assert.ok(original.includes(hash),"Original source fixture absent hash "+name);
 assert.ok(original.toLowerCase().includes("create or replace function "+name));
}
assert.match(candidate,/I2E_OPTION_A_NO_LEGACY_SHEET_WRITE/);
assert.match(candidate,/md5\(replace\(v_after,v_new,x.original_account_update\)\)/);
assert.match(candidate,/row_count/);
assert.match(candidate,/public\.set_character_progression_v1/);
for(let id=1;id<=11;id++){
 const key="PASS I2E-"+String(id).padStart(2,"0");
 assert.ok(runner.includes(key),"Missing original RED or GREEN test: "+key);
}
for(const word of ["Owner-approved Option A","same-character","synthetic","Barbarian","27 untested","31-trigger","no hosted database","original source"]){
 assert.ok(report.toLowerCase().includes(word.toLowerCase()),"Missing documented scope/gate: "+word);
}
console.log("PASS I2E-STATIC: three exact HP/Admin/Rage original source hashes, source-reversible account UPDATE-only candidate, 7/34 covered and 27 original writers untested");
console.log("I2E-STATIC LIMIT: signed RED/GREEN behavior not asserted by this static check; no production approval, no full 31-trigger equivalence");
