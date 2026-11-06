#!/usr/bin/env node
// Zero-cost, no-network integration tests for the supervised research agent.
// These tests never use Supabase/OpenAI credentials, merges, or Vercel.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isAllowedTargetRef, isAllowedChange, redactOutput } from "./research_agent.mjs";
import { parseOriginalInventory, scanFixtureTriggers, compareCoverage } from "./forge_trigger_audit.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(ROOT, "scripts/agents/research_agent.mjs");
const run = (cwd, executable, args, env = {}) => spawnSync(executable, args, {
  cwd, encoding: "utf8", timeout: 15000, maxBuffer: 1000000, env: { ...process.env, ...env }
});
for (const valid of ["agent/research-review", "agent/a/b-123", "research/forge-immutable-creation-replay-20261105"])
  assert.equal(isAllowedTargetRef(valid), true, valid);
for (const invalid of ["main","production","agent","agent/../main","agent/.hidden","research//x",
 "research/x/../../main","agent/x;cat", "refs/heads/agent/x","feature/agent/foo"])
  assert.equal(isAllowedTargetRef(invalid), false, invalid);
for (const valid of ["docs/Forge_Case.md","scripts/fixtures/source.sql",
 "scripts/fixtures/nested/proof.json","scripts/validate_spells.mjs",
 "scripts/test_forge_immutable_creation_replay_local_auth.mjs",
 "sql/candidates/20261105_review.sql"])
  assert.equal(isAllowedChange(valid), true, valid);
for (const invalid of ["pages/map.js","pages/encounters/play.js","AGENTS.md",
 ".github/workflows/research.yml","vercel.json","sql/20261105_live.sql",
 "scripts/patch_runtime.mjs","src/unsafe.js","docs/../../pages/map.js",
 "../secrets.sql","scripts/fixtures/source.sh","docs/evil.md/../../x",
 "docs/Forge_Original_Creation_Trigger_Coverage_2026-11-05.md"])
  assert.equal(isAllowedChange(invalid), false, invalid);
assert.ok(redactOutput("Bearer abcdefghijklmnopqrstuvwxyz").includes("[REDACTED]"));
assert.ok(redactOutput("sk-proj-abcdefghijklmnopqrstuvwxyzABCDEFG").includes("[REDACTED_OPENAI_KEY]"));
assert.ok(!redactOutput("postgres://u:p@localhost:5432/db").includes("u:p"));

const temp = mkdtempSync(path.join(tmpdir(), "dndnext-research-agent-"));
try {
  assert.equal(run(temp, "git", ["init", "-q", "-b", "agent/fixture"]).status, 0);
  assert.equal(run(temp, "git", ["-c","user.name=Test Agent",
   "-c","user.email=ci@example.invalid","commit","-q","--allow-empty","-m","init"]).status, 0);
  mkdirSync(path.join(temp, "docs"), { recursive: true });
  const env = { AGENT_TARGET_DIR: temp, TARGET_REF: "agent/fixture" };
  let result = run(ROOT, process.execPath, [script, "preflight"], env);
  assert.equal(result.status, 0, result.stderr);
  writeFileSync(path.join(temp, "docs/Review_Only.md"), "# Safe research fixture\n");
  result = run(ROOT, process.execPath, [script, "scope"], env);
  assert.equal(result.status, 0, result.stderr);
  result = run(ROOT, process.execPath, [script, "pack"], env);
  assert.equal(result.status, 0, result.stderr);
  const patch = readFileSync(path.join(ROOT,"research-agent-artifact","research.patch"),"utf8");
  assert.ok(patch.includes("docs/Review_Only.md"), "Generated artifact contains allowlisted file");
  assert.ok(!patch.includes("pages/map.js"), "No protected map file");
  assert.ok(existsSync(path.join(ROOT,"research-agent-artifact","REVIEW.md")));
  mkdirSync(path.join(temp, "pages"), { recursive: true });
  writeFileSync(path.join(temp, "pages/map.js"), "console.log('protected map');\n");
  result = run(ROOT, process.execPath, [script, "scope"], env);
  assert.notEqual(result.status, 0, "Protected world-map file MUST be rejected");
  assert.match(result.stderr, /out-of-scope path: pages\/map\.js/);
  rmSync(path.join(temp, "pages/map.js"));
  result = run(ROOT, process.execPath, [script, "preflight"], { ...env, TARGET_REF: "main" });
  assert.notEqual(result.status, 0, "main ref MUST be rejected");
} finally {
  rmSync(temp, { recursive: true, force: true });
  rmSync(path.join(ROOT, "research-agent-artifact"), { recursive: true, force: true });
}

// Source-grounded original 31-trigger census must fail closed on incomplete lists.
const sections = [["character_progression",19],["character_sheets",4],["characters",6],["inventory_items",2]];
const rows = [];
for (const [table,n] of sections) for(let i=0;i<n;i++)
  rows.push("| `"+table+"` | `"+table+"_test_"+i+"` | `handler_"+i+"` | `"+("a".repeat(32))+"` | "+(i===0?"Deferred":"Immediate")+" | Not installed |");
const md = ["| Live table | Trigger | Handler | Handler source MD5 | Timing | Status |","|---|---|---|---|---|---|",...rows].join("\n");
const inventory = parseOriginalInventory(md);
assert.equal(inventory.length,31);
const good = scanFixtureTriggers("CREATE CONSTRAINT TRIGGER character_progression_test_0 AFTER INSERT ON public.character_progression DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.handler_0();","fixture.sql");
const coverage = compareCoverage(inventory,good);
assert.equal(coverage.stagedCount,1);
assert.equal(coverage.missingCount,30);
const bad = scanFixtureTriggers("CREATE TRIGGER character_progression_test_0 BEFORE INSERT ON public.characters FOR EACH ROW EXECUTE FUNCTION private.wrong();","bad.sql");
assert.equal(compareCoverage(inventory,bad).mismatchCount,1);
assert.throws(()=>parseOriginalInventory(md.replace(rows[0],"")) ,/incomplete/i);

// Workflow check is source-static, separate from executing a paid Codex job.
const workflow = readFileSync(path.join(ROOT,".github/workflows/dndnext-research-agent.yml"),"utf8");
for (const token of [
 "workflow_dispatch:", "contents: read", "actions: read",
 "persist-credentials: false", "openai/codex-action@bdf19a4a223ec2549a3e2274a0cf61556bc07675",
 "permission-profile: \":workspace\"", "scripts/agents/research_agent.mjs",
 "upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02", "source_run_id:", "target_ref:",
 "OPENAI_API_KEY",
 "AGENT_TARGET_DIR: target"
])assert.ok(workflow.includes(token), "Missing workflow safety/setup: " + token);
for (const disallowed of [
 "contents: write", "issues: write", "pull-requests: write",
 "schedule:", "pull_request_target:", "repository_dispatch:",
 "SUPABASE_SERVICE_ROLE_KEY", "VERCEL_TOKEN", "danger-full-access",
 "--yolo", "git push", "gh pr merge"
])assert.ok(!workflow.includes(disallowed), "Unexpected privileged or automatic action: " + disallowed);
assert.equal(workflow.split("uses: openai/codex-action@").length-1,1,"Exactly one paid model invocation allowed");
assert.ok(workflow.includes("RUN_AUDIT") && workflow.includes("forge-triggers"),"Missing free manual Forge trigger audit");
assert.ok(workflow.includes("if: inputs.confirmation == 'RUN_RESEARCH'"),"Paid model invocation must be manually gated");
assert.ok(workflow.includes("forge_trigger_audit.mjs target"),"Missing source-grounded trigger audit invocation");
assert.ok(workflow.includes("target/scripts/agents/forge_trigger_acceptance_ledger.mjs target"),"Missing Forge JWT receipt reconciliation");
assert.ok(!workflow.includes("max_passes:") && !workflow.includes("SECOND_PASS_OK"));
const freeWorkflow = readFileSync(path.join(ROOT,".github/workflows/validate-dndnext-research-agent.yml"),"utf8");
assert.ok(freeWorkflow.includes("pull_request:") && freeWorkflow.includes("contents: read"));
assert.ok(freeWorkflow.includes("target/scripts/agents/forge_trigger_acceptance_ledger.mjs target"),"Cross-PR no-cost evidence check missing");
assert.ok(!freeWorkflow.includes("checkout@11d5960a326750d5838078e36cf38b85af683"),"Nonresolving checkout pin");
assert.ok(!freeWorkflow.includes("openai/codex-action@v1"),"No paid model in automatic PR validation");
const prompt = readFileSync(path.join(ROOT,".github/codex/prompts/dndnext-research-agent.md"),"utf8");
assert.ok(prompt.includes(".agent-input/REQUEST.md"));
assert.ok(prompt.includes("No production database"));
assert.ok(prompt.includes("Never edit the world map"));
assert.ok(prompt.includes("research patch"));
console.log("PASS: research-agent path/ref allowlist, credential redaction, dry-run patch artifact, forbidden world-map edit, main guard and workflow privilege contract");
