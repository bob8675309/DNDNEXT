#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditSources, STAGES, RELEASE_BLOCKERS } from "./validate_source_contract.mjs";
import { verifyOriginalJointDependencies, ORIGINAL_JOINT_DEPENDENCIES } from "./validate_joint_fixture_blobs.mjs";

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
  assert.equal(e.length,16);
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
