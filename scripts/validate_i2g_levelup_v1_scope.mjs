#!/usr/bin/env node
// I2-G exact source and narrow scratch scope guard. Static-only; no DB/API calls.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const old=JSON.parse(read("docs/I2_F_ACCOUNT_WRITER_COVERAGE_2026-11-11.json"));
const fresh=JSON.parse(read("docs/I2_G_LEVELUP_V1_OPTION_A_WRITER_COVERAGE_2026-11-12.json"));
assert.equal(old.original_update_writer_total,34);
assert.equal(old.original_update_writer_scratch_tested,9);
assert.equal(old.original_update_writer_untested,25);
assert.equal(fresh.original_update_writer_total,34);
assert.equal(fresh.original_update_writer_scratch_tested,10,"I2G must add exactly one tested writer after signed RED/GREEN");
assert.equal(fresh.original_update_writer_untested,24);
assert.equal(fresh.i2g_pending_test_count,0);
assert.equal(fresh.pending_source_signature,"public.complete_character_level_up_v1(p_character_id uuid, p_selections jsonb)");
assert.equal(fresh.pending_source_md5,"1500703592c3cb8e1738126eac508e6a");
assert.equal(fresh.original_update_writers.length,old.original_update_writers.length);
for(let i=0;i<34;i++){
 assert.equal(fresh.original_update_writers[i].signature,old.original_update_writers[i].signature);
 assert.equal(fresh.original_update_writers[i].source_md5,old.original_update_writers[i].source_md5);
 if(old.original_update_writers[i].signature.startsWith("public.complete_character_level_up_v1(")){
   assert.equal(old.original_update_writers[i].status,"not_option_a_tested");
   assert.equal(fresh.original_update_writers[i].status,"i2g_genuine_signed_original_RED_then_scratch_GREEN_verified");
 }else{
   assert.equal(fresh.original_update_writers[i].status,old.original_update_writers[i].status,
     "Do not change any inherited writer's prior acceptance state");
 }
}
const src=read("scripts/fixtures/i2g_original_levelup_v1_shared_forge_pg17.sql");
const cand=read("scripts/fixtures/i2g_option_a_levelup_v1_scratch_pg17.sql");
const test=read("scripts/test_i2g_signed_levelup_v1_option_a_local_auth.mjs");
const flow=read(".github/workflows/validate-i2g-levelup-v1-option-a-local-auth.yml");
const doc=read("docs/I2_G_LEVELUP_V1_OPTION_A_SIGNED_RESEARCH_2026-11-12.md");
assert.ok(src.includes("SOURCE-ORIGINAL pg_get_functiondef"));
assert.ok(src.includes("1500703592c3cb8e1738126eac508e6a"));
assert.ok(src.includes("update public.players p set sheet=v_sheet,updated_at=now()"));
assert.ok(src.includes("private.p13_levelup_case_guard"));
assert.ok(src.includes("Only TEST")===false);
assert.ok(cand.includes("I2G_OPTION_A_NO_LEGACY_LEVELUP_V1_WRITE"));
assert.ok(cand.includes("md5(v_original)<>md5(v_source)"));
assert.ok(cand.includes("current_database()<>'postgres'"));
assert.ok(cand.includes("1500703592c3cb8e1738126eac508e6a"));
assert.ok(!cand.includes("DROP TABLE")&&!cand.includes("DROP POLICY"));
assert.ok(test.includes("source RED") || test.includes("SOURCE RED"));
for(let i=1;i<=9;i++)assert.ok(test.includes("I2G-"+String(i).padStart(2,"0")));
assert.ok(test.includes('client.rpc("complete_character_level_up_v1"'));
assert.ok(test.includes('DNDNEXT_I2G_LOCAL_CONFIRM'));
assert.ok(test.includes('legacy(owner),sheet(B)'));
assert.ok(test.includes('unchanged(frozen,"coeditor signed canonical success")'));
assert.ok(flow.includes("needs: inherited-i2f-source-species-signed"));
assert.ok(flow.includes("test_i2f_source_species_projection_option_a_local_auth.mjs"));
assert.ok(flow.includes("test_i2g_signed_levelup_v1_option_a_local_auth.mjs"));
assert.ok(flow.includes("stop --no-backup"));
assert.ok(doc.includes("NOT production") && doc.includes("I2G-01 through I2G-09 PASS") && doc.includes("10/34"));
assert.equal(fresh.i2g_result.run_id,43296779345);
assert.equal(fresh.i2g_result.job_id,131458834795);
assert.equal(fresh.i2g_result.conclusion,"success");
console.log("I2-G 10/34 static ledger/source-scope PASS; local signed original RED/GREEN must still pass exact-head CI.");
