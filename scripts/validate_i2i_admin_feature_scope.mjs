#!/usr/bin/env node
// I2-I source-original signed Admin legacy account writer isolated scope and
// immutable ledger guard. Read-only local files, no production database calls.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const json=p=>JSON.parse(read(p));
const previous=json("docs/I2_H_TOUGH_OPTION_A_WRITER_COVERAGE_2026-11-12.json");
const next=json("docs/I2_I_ADMIN_FEATURE_OPTION_A_WRITER_COVERAGE_2026-11-12.json");
assert.equal(previous.original_update_writer_total,34);
assert.equal(previous.original_update_writer_scratch_tested,11);
assert.equal(previous.original_update_writer_untested,23);
assert.equal(next.original_update_writer_total,34);
assert.ok([11,12].includes(next.original_update_writer_scratch_tested));
assert.equal(next.original_update_writer_untested,34-next.original_update_writer_scratch_tested);
assert.ok([0,1].includes(next.i2i_counted_writers));
assert.equal(next.original_update_writer_scratch_tested,11+next.i2i_counted_writers);
assert.equal(next.original_update_writer_untested,23-next.i2i_counted_writers);
assert.equal(next.original_update_writers.length,34);
assert.equal(next.i2i_source_signature,"private.sync_admin_feature_array_v1(p_character_id uuid, p_option_type text, p_name text, p_add boolean)");
assert.equal(next.i2i_source_md5,"f2b6190ecc9400772e054892f63cdc47");
assert.equal(next.i2i_original_public_grant_md5,"aa0f6a0c6c6a6f2b9aacf57bd40e434c");
for(let i=0;i<34;i++){
 const old=previous.original_update_writers[i],cur=next.original_update_writers[i];
 assert.equal(cur.signature,old.signature);
 assert.equal(cur.source_md5,old.source_md5);
 if(cur.signature.startsWith("private.sync_admin_feature_array_v1(")){
  assert.equal(old.status,"not_option_a_tested");
  assert.equal(cur.status,next.i2i_counted_writers===0?"not_option_a_tested":"i2i_signed_original_admin_RED_then_scratch_GREEN_verified");
 }else assert.equal(cur.status,old.status,"Do not reclassify inherited source writer");
}
const original=read("scripts/fixtures/i2i_original_admin_feature_source_gate_pg17.sql");
const candidate=read("scripts/fixtures/i2i_option_a_admin_feature_scratch_pg17.sql");
const test=read("scripts/test_i2i_signed_admin_feature_option_a_local_auth.mjs");
const workflow=read(".github/workflows/validate-i2i-admin-feature-option-a-local-auth.yml");
const report=read("docs/I2_I_SIGNED_ADMIN_FEATURE_OPTION_A_RESEARCH_2026-11-12.md");
for(const c of [original,candidate]){
 assert.ok(c.includes("private.p13_levelup_case_guard"));
 assert.ok(c.includes("current_database()<>'postgres'"));
 assert.ok(c.includes("f2b6190ecc9400772e054892f63cdc47"));
 assert.ok(c.includes("aa0f6a0c6c6a6f2b9aacf57bd40e434c"));
}
assert.ok(original.includes("04596b0a3fdfb71c1b357056e8c6023b"));
assert.ok(candidate.includes("I2I_OPTION_A_NO_ADMIN_FEATURE_LEGACY_ACCOUNT_WRITE"));
assert.ok(candidate.includes("md5(replace(v_modified,v_noop,v_stmt))"));
assert.ok(!candidate.includes("DROP TABLE")&&!candidate.includes("DROP POLICY"));
assert.ok(test.includes('"grant_character_option_v1"'));
assert.ok(test.includes("PRIVATE")===false || test.includes("LOCAL SQL"));
for(let i=1;i<=11;i++)assert.ok(test.includes("I2I-"+String(i).padStart(2,"0")),"Missing signed case I2I-"+i);
assert.ok(test.includes("ORIGINAL RED: genuine signed Admin"));
assert.ok(test.includes("SCRATCH GREEN: real signed Admin"));
assert.ok(test.includes("GRANT USAGE ON SCHEMA private TO authenticated"));
assert.ok(test.includes("ROLLBACK;"));
assert.ok(test.includes("PUBLIC REST exposure NOT established"));
assert.ok(workflow.includes("needs: original-tough-v5-signed-auth"));
assert.ok(workflow.includes("test_i2h_tough_option_a_signed_v5_local_auth.mjs"));
assert.ok(workflow.includes("test_i2i_signed_admin_feature_option_a_local_auth.mjs"));
assert.ok(workflow.includes("stop --no-backup"));
assert.ok(report.includes("NOT production"));
assert.ok(report.includes("unproven")&&report.includes("REST"));
if(next.i2i_counted_writers===1){
 assert.equal(next.i2i_result.conclusion,"success");
 assert.ok(next.i2i_result.run_id>0);
 assert.ok(report.includes("I2I-01 through I2I-11"));
}
console.log("I2-I exact original Admin writer/ACL and one-writer provisional/accepted ledger scope PASS. Signed source RED/GREEN is a separate disposable CI requirement.");
