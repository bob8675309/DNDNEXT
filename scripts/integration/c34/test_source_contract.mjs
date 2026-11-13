#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditSources, STAGES, RELEASE_BLOCKERS } from "./validate_source_contract.mjs";
import { verifyOriginalJointDependencies, ORIGINAL_JOINT_DEPENDENCIES } from "./validate_joint_fixture_blobs.mjs";
import { auditTriggerCoverage } from "./verify_original_trigger_coverage.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const load = (file) => fs.readFileSync(path.join(dir, "sources", file));

test("C34-S01 all six original Git blobs retain exact bytes, transaction metadata and contracts", () => {
  const report = auditSources(load);
  assert.equal(report.sourceIntegrity, "PASS");
  assert.equal(report.stageCount, 6);
  assert.equal(report.releaseBlocked, true);
  assert.equal(report.executableJointSqlEmitted, false);
  assert.equal(report.originalAppFilesChanged, false);
  assert.deepEqual(report.stages.map((s) => s.sourcePr), [324, 345, 345, 345, 324, 351]);
});

test("C34-N01 mutation of each original source is rejected, never silently accepted", () => {
  for (const stage of STAGES) {
    assert.throws(() => auditSources((file) => {
      const raw = load(file);
      return file === stage.file ? Buffer.concat([raw, Buffer.from("\n-- unauthorized drift\n")]) : raw;
    }), /original Git blob drift/, stage.id);
  }
});

test("C34-N02 missing source is rejected", () => {
  assert.throws(() => auditSources((file) => {
    if (file === "04_private_story_stage3.sql") throw new Error("missing original Story stage");
    return load(file);
  }), /missing original Story stage/);
});

test("C34-N03 release gating fails closed despite a successful static audit", () => {
  const result = spawnSync(process.execPath,
    [path.join(dir, "validate_source_contract.mjs"), "--release"],
    { encoding: "utf8", timeout: 15000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /RELEASE BLOCKED/);
  assert.match(result.stdout, /"sourceIntegrity": "PASS"/);
});

test("C34-N04 static gate must not misrepresent incomplete Option A or browser coverage", () => {
  const report = auditSources(load);
  assert.ok(RELEASE_BLOCKERS.some((item) => /22 untested/.test(item)));
  assert.ok(RELEASE_BLOCKERS.some((item) => /app-browser/.test(item)));
  assert.ok(RELEASE_BLOCKERS.some((item) => /31-trigger/.test(item)));
  assert.equal(report.releaseBlocked, true);
});

test("C34-N05 no production connection, schema writes or SQL execution in validator", () => {
  const code = fs.readFileSync(path.join(dir, "validate_source_contract.mjs"), "utf8");
  assert.doesNotMatch(code, /from ["'](?:pg|postgres|@supabase\/supabase-js|child_process)["']/);
  assert.doesNotMatch(code, /https?:\/\//);
  assert.doesNotMatch(code, /process\.env\.(?:DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY)/);
  assert.deepEqual(STAGES.map((s) => s.file), [
    "01_forge_immutable_intent.sql",
    "02_npc_profile_stage1.sql",
    "03_npc_dossier_stage2.sql",
    "04_private_story_stage3.sql",
    "05_inventory_constraint_rls.sql",
    "06_story_complete_nonce_i1c.sql",
  ]);
});

test("C34-S02 all operational original joint fixtures and candidate paths are byte-identical", () => {
  const e=verifyOriginalJointDependencies();
  assert.equal(e.length,27);
  assert.ok(e.some((x)=>x.file.includes("original_i1c_forge_private_story_nonce_local_auth")));
  assert.ok(e.some((x)=>x.file.endsWith("20261105_inventory_character_owner_constraint_and_dml_review_v1.sql")));
});

test("C34-N06 a tampered signed original fixture fails the same raw Git blob test", () => {
  const first=ORIGINAL_JOINT_DEPENDENCIES[0][0];
  const root=path.resolve(dir,"../../..");
  assert.throws(() => verifyOriginalJointDependencies((file)=>{
    const original=fs.readFileSync(path.join(root,file));
    return file===first ? Buffer.concat([original,Buffer.from("-- changed\n")]) : original;
  }), /signed fixture\/source drift/);
});

test("C34-T8-S01 original census counts 16/31 plus held 2 privacy and 1 creator seed", () => {
 const r=auditTriggerCoverage();
 assert.equal(r.originalTotal,31);
 assert.deepEqual(r.originalByTable,{
   character_progression:19,character_sheets:4,characters:6,inventory_items:2
 });
 assert.equal(r.stagedOriginalCount,16);
 assert.equal(r.originalMissingCount,15);
 assert.equal(r.proposedPrivacyCount,2);
 assert.equal(r.totalStaged,19);
 assert.equal(r.proposedCreatorSeedCount,1);
 assert.equal(r.downstreamGrantTriggerCount,5);
 assert.ok(!r.originalStaged.includes("characters_capture_creator_at_insert_v1"));
});

test("C34-T2-N01 mutated original census source is rejected", () => {
 const root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
   const raw=fs.readFileSync(path.join(root,file));
   return file.includes("C34_ORIGINAL_31_TRIGGER_CENSUS_CAPTURE")
     ? Buffer.concat([raw,Buffer.from("\\n-- tampered\\n")]) : raw;
 }),/original 31-trigger census blob drift/);
});

test("C34-T2-N02 removing an original trigger from staged DDL reduces accepted coverage", () => {
 const root=path.resolve(dir,"../../..");
 const original=auditTriggerCoverage();
 const truncated=auditTriggerCoverage(file=>{
   const raw=fs.readFileSync(path.join(root,file));
   if(file!=="scripts/integration/c34/c34_five_original_sheet_character_triggers_pg17.sql") return raw;
   const source=raw.toString("utf8");
   const start=source.indexOf("CREATE TRIGGER characters_guard_player_tags_v1\n");
   const tail="EXECUTE FUNCTION private.guard_player_character_tag_update_v1();";
   const stop=source.indexOf(tail,start);
   assert.ok(start>0 && stop>start,"expected live-original trigger DDL in C34 fixture");
   const changed=source.slice(0,start)+"-- OMITTED ORIGINAL TRIGGER NEGATIVE\n"+source.slice(stop+tail.length);
   assert.notEqual(changed,raw.toString("utf8"));
   return Buffer.from(changed,"utf8");
 });
 assert.equal(original.stagedOriginalCount,16);
 assert.equal(truncated.stagedOriginalCount,15);
 assert.equal(truncated.originalMissingCount,16);
});

test("C34-T4-N03 changing original Fighter subclass BEFORE INSERT into AFTER INSERT fails closed", () => {
 const root=path.resolve(dir,"../../..");
 const fixture="scripts/integration/c34/c34_original_fighter_subclass_choice_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(file=>{
   const original=fs.readFileSync(path.join(root,file));
   if(file!==fixture)return original;
   const source=original.toString("utf8");
   const before="BEFORE INSERT ON public.character_progression";
   assert.ok(source.includes(before),"original subtype trigger SQL is present");
   return Buffer.from(source.replace(before,"AFTER INSERT ON public.character_progression"),"utf8");
 }),/exact original Fighter subclass BEFORE INSERT event/);
});

test("C34-T5-N04 changing original deferred authority trigger to immediate fails closed", () => {
 const root=path.resolve(dir,"../../..");
 const adapter="scripts/integration/c34/c34_original_deferred_progression_authority_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(file=>{
  const buf=fs.readFileSync(path.join(root,file));
  if(file!==adapter)return buf;
  const source=buf.toString("utf8");
  const from="DEFERRABLE INITIALLY DEFERRED FOR EACH ROW";
  assert.ok(source.includes(from));
  return Buffer.from(source.replace(from,"NOT DEFERRABLE FOR EACH ROW"),"utf8");
 }),/Timing\/deferral mismatch|exact original deferred progression authority event/);
});

test("C34-T5-N05 source-original preferred view rewrite fails closed", () => {
 const root=path.resolve(dir,"../../..");
 const adapter="scripts/integration/c34/c34_original_deferred_progression_authority_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(file=>{
  const raw=fs.readFileSync(path.join(root,file));
  if(file!==adapter)return raw;
  const source=raw.toString("utf8");
  const from="WHEN o.option_type = 'species'::text";
  assert.ok(source.includes(from));
  return Buffer.from(source.replace(from,"WHEN o.option_type = 'unverified'::text"),"utf8");
 }),/preferred VIEW definitions drifted from held/);
});

test("C34-T6-N06 tampering with an original downstream grant hook is rejected", () => {
 const root=path.resolve(dir,"../../..");
 const p="scripts/fixtures/forge_feat_materializer_local_auth_extension_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(file=>{
  const raw=fs.readFileSync(path.join(root,file));
  if(file!==p)return raw;
  const source=raw.toString("utf8");
  const trigger="CREATE TRIGGER character_option_grant_instance_cartomancer_v1";
  assert.ok(source.includes(trigger));
  return Buffer.from(source.replace(trigger,
    "CREATE TRIGGER character_option_grant_instance_malicious_replacement_v1"),"utf8");
 }),/Unexpected original grant-table trigger|missing original grant-table triggers/);
});

test("C34-T6-N07 wrong grant-table authorization guard cannot masquerade as original", () => {
 const root=path.resolve(dir,"../../..");
 const p="scripts/fixtures/forge_feat_materializer_local_auth_extension_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(file=>{
  const raw=fs.readFileSync(path.join(root,file));
  if(file!==p)return raw;
  const source=raw.toString("utf8");
  const from="EXECUTE FUNCTION private.guard_direct_character_authority_mutation_v1();";
  assert.ok(source.includes(from));
  return Buffer.from(source.replace(from,
   "EXECUTE FUNCTION private.materialize_cartomancer_instance_v1();"),"utf8");
 }),/exact grant-table handler\/table mismatch/);
});

test("C34-T7-N08 provenance seed cannot be re-timed from BEFORE to AFTER INSERT", () => {
 const root=path.resolve(dir,"../../..");
 const p="sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql";
 assert.throws(()=>auditTriggerCoverage(file=>{
  const b=fs.readFileSync(path.join(root,file));
  if(file!==p)return b;
  const source=b.toString("utf8");
  const before="BEFORE INSERT ON public.character_progression";
  assert.ok(source.includes(before));
  return Buffer.from(source.replace(before,"AFTER INSERT ON public.character_progression"),"utf8");
 }),/verified creator candidate BEFORE INSERT event\/handler/);
});

test("C34-T7-N09 creator seed cannot trust attribution from another transaction", () => {
 const root=path.resolve(dir,"../../..");
 const p="sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql";
 assert.throws(()=>auditTriggerCoverage(file=>{
  const b=fs.readFileSync(path.join(root,file));
  if(file!==p)return b;
  const source=b.toString("utf8");
  const from="AND ca.recorded_at=transaction_timestamp()";
  assert.ok(source.includes(from));
  return Buffer.from(source.replace(from,"AND ca.recorded_at IS NOT NULL"),"utf8");
 }),/bind the trusted creator to the same transaction/);
});

test("C34-T7-N10 trusted creator seed is not a new uncounted original", () => {
 const r=auditTriggerCoverage();
 assert.equal(r.stagedOriginalCount,16);
 assert.equal(r.originalMissingCount,15);
 assert.equal(r.proposedPrivacyCount,2);
 assert.equal(r.proposedCreatorSeedCount,1);
 assert.equal(r.totalStaged,19);
 assert.equal(r.downstreamGrantTriggerCount,5);
});

test("C34-T8-N11 wrong trigger event fails closed", () => {
 const root=path.resolve(dir,"../../.."),file="scripts/integration/c34/c34_original_starting_magic_exactness_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==file)return b;
  const text=b.toString("utf8");
  const target="AFTER INSERT OR UPDATE ON public.character_progression";
  assert.ok(text.includes(target));
  return Buffer.from(text.replace(target,"AFTER INSERT ON public.character_progression"));
 }),/T8 exact source deferred starting-magic trigger event drift/);
});
test("C34-T8-N12 mutated original handler fails closed", () => {
 const root=path.resolve(dir,"../../.."),file="scripts/integration/c34/c34_original_starting_magic_exactness_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==file)return b;
  const text=b.toString("utf8"),target="Starting magic summary does not match authoritative starting spell rows.";
  assert.ok(text.includes(target));
  return Buffer.from(text.replace(target,"T8 bypassed original summary"));
 }),/T8 source-original starting-magic function body drift/);
});
test("C34-T8-N13 timing/deferral mutation fails closed", () => {
 const root=path.resolve(dir,"../../.."),file="scripts/integration/c34/c34_original_starting_magic_exactness_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==file)return b;
  const text=b.toString("utf8"),target="DEFERRABLE INITIALLY DEFERRED FOR EACH ROW";
  assert.ok(text.includes(target));
  return Buffer.from(text.replace(target,"NOT DEFERRABLE FOR EACH ROW"));
 }),/Timing\/deferral mismatch|T8 exact source deferred starting-magic trigger event drift/);
});
