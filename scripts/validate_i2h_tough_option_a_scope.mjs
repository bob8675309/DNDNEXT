#!/usr/bin/env node
// I2-H static exact original source, one-writer Option A and inheritance guard.
// Read-only Node filesystem. Database/Auth tests happen only in disposable CI.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=p=>readFileSync(p,"utf8"), json=p=>JSON.parse(file(p));
const previous=json("docs/I2_G_LEVELUP_V1_OPTION_A_WRITER_COVERAGE_2026-11-12.json");
const next=json("docs/I2_H_TOUGH_OPTION_A_WRITER_COVERAGE_2026-11-12.json");
assert.equal(previous.original_update_writer_total,34);
assert.equal(previous.original_update_writer_scratch_tested,10);
assert.equal(previous.original_update_writer_untested,24);
assert.equal(next.original_update_writer_total,34);
assert.ok([10,11].includes(next.original_update_writer_scratch_tested));
assert.equal(next.original_update_writer_scratch_tested+next.original_update_writer_untested,34);
assert.equal(next.original_update_writers.length,34);
assert.equal(next.i2h_writer_signature,"private.apply_tough_progression_bonus_v1(p_character_id uuid, p_to_level integer)");
assert.equal(next.i2h_source_md5,"2b8bca48b7067e2e67b66defcb7f2c10");
assert.equal(next.i2h_normalizer_md5,"dd8cdd5b47efe99b1cfff9c2bf7635dd");
const accepted=next.i2h_counted_writers===1;
assert.ok([0,1].includes(next.i2h_counted_writers));
assert.equal(next.original_update_writer_scratch_tested,10+next.i2h_counted_writers);
assert.equal(next.original_update_writer_untested,24-next.i2h_counted_writers);
for(let i=0;i<34;i++){
 const prior=previous.original_update_writers[i],current=next.original_update_writers[i];
 assert.equal(current.signature,prior.signature);
 assert.equal(current.source_md5,prior.source_md5);
 if(current.signature.startsWith("private.apply_tough_progression_bonus_v1(")){
   assert.equal(prior.status,"not_option_a_tested");
   assert.equal(current.status,accepted?"i2h_signed_v5_original_RED_then_scratch_GREEN_verified":"not_option_a_tested");
 }else assert.equal(current.status,prior.status,"I2H must not change prior writer coverage");
}
const original=file("scripts/fixtures/i2h_original_tough_shared_p13_pg17.sql");
const inherited=file("scripts/fixtures/i2h_inherited_levelup_no_mirror_isolation_pg17.sql");
const candidate=file("scripts/fixtures/i2h_option_a_tough_progression_scratch_pg17.sql");
const test=file("scripts/test_i2h_tough_option_a_signed_v5_local_auth.mjs");
const workflow=file(".github/workflows/validate-i2h-tough-option-a-local-auth.yml");
const report=file("docs/I2_H_TOUGH_OPTION_A_SIGNED_RESEARCH_2026-11-12.md");
assert.ok(original.includes("2b8bca48b7067e2e67b66defcb7f2c10"));
assert.ok(original.includes("dd8cdd5b47efe99b1cfff9c2bf7635dd"));
assert.ok(original.includes("CREATE OR REPLACE FUNCTION private.apply_tough_progression_bonus_v1"));
assert.ok(original.includes("update public.players p set sheet=v_sheet,updated_at=now()"));
assert.ok(original.includes("REVOKE ALL ON public.character_option_grant_instances"));
assert.ok(inherited.includes("e33639d549ef557976a3970ea51f5238"));
assert.ok(inherited.includes("5b1b275a268a57591a36cfcbdded3baa")===false,"No fabricated source hash");
assert.ok(inherited.includes("5b1b275a268a57591a2e35a05ce7480d"));
assert.ok(inherited.includes("md5(v_reversed)<>r.expected_md5"));
assert.ok(inherited.includes("I2H_INHERITED_BASE_V3_NO_LEGACY_MIRROR")===false,"Marker deliberately formed dynamically");
assert.ok(inherited.includes("v_noop:='NULL; /* I2H_INHERITED_'"));
assert.ok(candidate.includes("I2H_OPTION_A_NO_TOUGH_LEGACY_MIRROR"));
assert.ok(candidate.includes("md5(replace(v_after,v_noop,v_stmt))"));
assert.ok(candidate.includes("current_database()<>'postgres'"));
assert.ok(!candidate.includes("DROP TABLE")&&!candidate.includes("DROP POLICY"));
assert.ok(test.includes('who.client.rpc(') || test.includes('"complete_character_level_up_v5"'));
assert.ok(test.includes("original Tough")||test.includes("ORIGINAL TOUGH RED"));
assert.ok(test.includes("freeze(frozen,"));
for(let i=1;i<=10;i++)assert.ok(test.includes("I2H-"+String(i).padStart(2,"0")));
assert.ok(workflow.includes("needs: original-levelup-v1-signed-auth"));
assert.ok(workflow.includes("test_i2f_source_species_projection_option_a_local_auth.mjs"));
assert.ok(workflow.includes("test_i2g_signed_levelup_v1_option_a_local_auth.mjs"));
assert.ok(workflow.includes("test_i2h_tough_option_a_signed_v5_local_auth.mjs"));
assert.ok(workflow.includes("stop --no-backup"));
assert.ok(report.includes("NOT production"));
if(accepted){
 assert.equal(next.i2h_result.conclusion,"success");
 assert.ok(next.i2h_result.run_id>0);
 assert.ok(report.includes("I2H-01 through I2H-10"));
}
console.log("I2-H single-writer original Tough+inherited isolation+coverage guard PASS; signed RED/GREEN require exact-head CI.");
