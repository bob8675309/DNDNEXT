// P20C-P3 research-only offline artifact preflight acceptance and negatives.
// A synthetic plausible function may clear this preflight but must NEVER be
// represented as original source, signed SQL, authorized costs or release.
import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {inspectP20CP3OfflineRestoreArtifacts as inspect} from "./candidates/t46_p3_p4b_c2b14_p20c_p3_offline_recovery_gate.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=x=>fs.readFileSync(path.join(root,x),"utf8");
const hash=x=>createHash("sha256").update(x,"utf8").digest("hex");
const tableNames=["players","player_plants","plants","player_wallets","player_recipes","recipes","inventory_items","craft_plans","crafting_attempts"];
const schema=tableNames.map(n=>"CREATE TABLE public."+n+" (id uuid);").join("\n");
const syntheticBody="-- SYNTHETIC RESEARCH TEST, NOT ORIGINAL COMPLETION SQL\n"+
 "DECLARE v_plan record; v_attempt record;\nBEGIN\n"+
 "-- local unit tests confirm an inert artifact check and NEVER run SQL\n".repeat(16)+
 "RETURN jsonb_build_object('ok',false);\nEND;\n";
const func="CREATE OR REPLACE FUNCTION private.complete_craft_plan_v1_impl(p_plan_id uuid,p_attempt_id uuid)\n"+
 "RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private,auth AS $test$\n"+
 syntheticBody+"$test$;\n";
const manifest={
 source_type:"independent_offline_pg17_restore",
 backup_id:"test-fixture-20261122",
 postgres_major:17,
 function_sha256:hash(func),
 schema_sha256:hash(schema)
};
const run=(override={})=>inspect({functionSql:func,schemaSql:schema,manifest,...override});
test("P20C-P3 only inert candidate status even with deliberately synthetic complete-looking source",()=>{
 const result=run();
 assert.equal(result.status,"CANDIDATE_ONLY_NOT_AUTHORIZED");
 assert.equal(result.production_release_allowed,false);
 assert.equal(result.signed_pg17_test_run,false);
 assert.equal(result.backup_lineage_manually_verified,false);
 assert.equal(result.authoritative_craft_price_verified,false);
 assert.equal(result.found_tables.length,9);
 assert.equal(result.function_sha256,hash(func));
 assert.equal(result.schema_sha256,hash(schema));
 assert.ok(result.remaining_gates.some(s=>s.includes("recipe")));
 console.log("PASS P20C-P3-CANDIDATE-ONLY: plausible synthetic is NEVER original-body proof, signed authorization, or release");
});
test("P20C-P3 lack of original private completion must deny, including wrapper-only or patch text",()=>{
 const wrapper=read("sql/20260612_90_patch0_crafting_authorization_hardening.sql");
 const later=read("sql/20260613_99_crafting_workflow_v6.sql");
 for(const source of ["",wrapper,later, "CREATE FUNCTION public.complete_craft_plan_v1(p_plan_id uuid,p_attempt_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $x$ BEGIN RETURN '{}'::jsonb; END; $x$;"]){
  assert.throws(()=>run({functionSql:source,manifest:{...manifest,function_sha256:hash(source)}}),/ORIGINAL_IMPL_DEFINITION_COUNT|FUNCTION_ARTIFACT_REQUIRED/);
 }
 console.log("PASS P20C-P3-MISSING-ORIGINAL-RED: patch/wrapper/missing source cannot cross preflight");
});
test("P20C-P3 deliberately incomplete or unreviewed-definer source is denied",()=>{
 for(const wrong of [
  func.replace("SECURITY DEFINER","SECURITY INVOKER"),
  func.replace("LANGUAGE plpgsql","LANGUAGE sql"),
  func.replace("$test$;\n",""),
  func.replace("v_attempt record;","actor record;"),
  func.replace(syntheticBody,"BEGIN RETURN '{}'::jsonb; END;\n")
 ]){
  assert.throws(()=>run({functionSql:wrong,manifest:{...manifest,function_sha256:hash(wrong)}}));
 }
 console.log("PASS P20C-P3-TRUNCATED-BODY-RED: full procedural definition required, not synthetic wrapper");
});
test("P20C-P3 context-only schema export and missing current tables fail closed",()=>{
 const historic=read("scripts/integration/c34/preserved/legacy_schema_export_context_only_2026.txt");
 const h={...manifest,schema_sha256:hash(historic)};
 assert.throws(()=>run({schemaSql:historic,manifest:h}),/HISTORICAL_CONTEXT_EXPORT_NOT_RESTORE/);
 const cut=schema.replace("CREATE TABLE public.player_wallets (id uuid);","");
 assert.throws(()=>run({schemaSql:cut,manifest:{...manifest,schema_sha256:hash(cut)}}),/SCHEMA_TABLE_MISSING_PLAYER_WALLETS/);
 console.log("PASS P20C-P3-LEGACY-DENY: old schema context and missing wallet cannot masquerade as recovered live DDL");
});
test("P20C-P3 hash, backup ID, PG major, file omission and manifest are required",()=>{
 assert.throws(()=>run({manifest:{...manifest,schema_sha256:hash("unrelated")}}),/HASH_MISMATCH/);
 assert.throws(()=>run({manifest:{...manifest,postgres_major:16}}),/UNVERIFIED_OFFLINE_ORIGIN/);
 assert.throws(()=>run({manifest:{...manifest,source_type:"hosted_supabase_query"}}),/UNVERIFIED_OFFLINE_ORIGIN/);
 assert.throws(()=>run({manifest:{...manifest,backup_id:"https://prod.example.com"}}),/UNVERIFIED_OFFLINE_ORIGIN/);
 assert.throws(()=>run({manifest:null}),/MANIFEST_REQUIRED/);
 assert.throws(()=>run({schemaSql:""}),/SCHEMA_ARTIFACT_REQUIRED/);
 console.log("PASS P20C-P3-ORIGIN-RED: no missing/unbound source, fake environment, wrong version or mismatched SHA");
});
test("P20C-P3 source module is read-only offline, and cannot connect to or execute SQL",()=>{
 const path="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p20c_p3_offline_recovery_gate.mjs";
 const script=read(path);
 for(const no of [
  /\bexecSync\b|spawnSync|child_process|node:net|node:https|node:http/i,
  /createClient|supabase-js|pg-promise|new Client\s*\(/,
  /PGHOST|SUPABASE_SERVICE_ROLE|SUPABASE_URL|process\.env\./,
  /[\w.]+\s*\.\s*query\s*\(|\bfetch\s*\(/
 ])assert.doesNotMatch(script,no);
 assert.match(script,/readFileSync/);
 assert.match(script,/CANDIDATE_ONLY_NOT_AUTHORIZED/);
 assert.match(script,/production_release_allowed:false/);
 console.log("PASS P20C-P3-NO-NETWORK: local source reads only; no hosted DB, shell, credentials, statement execution");
});
test("P20C-P3 original P20B, P20A, actual role and resource blockers remain separate",()=>{
 const dossier=read("docs/research/C34_B14_P20C_ORIGINAL_TOWN_V6_PLAN_AND_RESOURCE_AUTHORITY_2026-11-22.md");
 const prior=read("scripts/integration/c34/test_t46_p3_p4b_c2b14_p20c_p1_original_completion_authority_source.mjs");
 assert.match(dossier,/P20C signed PG17 \*\*NOT RUN\*\*/);
 assert.match(prior,/[Ss]ource-only/);
 assert.match(read("utils/useWallet.js"),/Supports -1 \(infinite\) semantics/);
 console.log("PASS P20C-P3-NO-PROMOTION: source/PG17/role/economic release separation retained");
});
