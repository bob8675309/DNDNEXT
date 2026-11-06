#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validResearchRef, renderBranchStatus, GENERATED_PATH } from "./research_docs_maintainer.mjs";
for(const x of ["research/foo","research/forge-2026","agent/safe/deep","agent/agent_1"])assert.equal(validResearchRef(x),true,x);
for(const x of ["main","docs/test","research/../../main","research//bad","agent/.x","research/x;rm","refs/heads/research/x"])assert.equal(validResearchRef(x),false,x);
assert.equal(GENERATED_PATH,"docs/RESEARCH_BRANCH_STATUS.generated.md");
const sha="a".repeat(40),baseSha="b".repeat(40);
const core={branch:"research/forge-next",sha,baseSha,title:"test source commit",
 branchPaths:["scripts/fixtures/original.sql","docs/Forge_Case.md"],
 lastPaths:["scripts/fixtures/original.sql"],
 forge:{original:31,staged:15,missing:16,mismatches:0,receipts:[
  {trigger:"character_progression_apply_forge_subclass_v1",sourceMd5:"273be29420a7274d997642e302604cb7",
   testedHead:"c".repeat(40),actionsRunId:42223567299,tests:"J142-J153",scope:"Reduced source-original JWT"}
 ]}};
const output=renderBranchStatus(core);
assert.match(output,/15 \| 16 \| 0 \| 1 \|/);
assert.match(output,/Manual living-doc reconciliation may be needed/);
assert.match(output,/does not start a second CI run/);
assert.match(output,/GITHUB_TOKEN/);
assert.match(output,/42223567299/);
assert.ok(!output.includes("production passed"));
const after=renderBranchStatus({...core,lastPaths:["scripts/x.sql","docs/HANDOFF_LOG.md"]});
assert.match(after,/includes authored documentation/);
assert.throws(()=>renderBranchStatus({...core,branch:"main"}),/Only research/);
console.log("PASS no-cost docs snapshot branch safety, actual-source evidence, freshness signal, and no false CI status");

const wf=readFileSync(".github/workflows/research-docs-maintenance.yml","utf8");
for(const token of [
 "on:\n  push:", "'research/**'","'agent/**'","github.actor == 'bob8675309'",
 "contents: write", "persist-credentials: false", "expectedHeadOid:",
 "docs/research-status/", "docs/agent-status", "branchName:$branch",
 "createCommitOnBranch", "node scripts/agents/validate_research_docs_maintainer.mjs"
])assert.ok(wf.includes(token),"Missing docs-only automation guard: "+token);
for(const forbidden of ["pull_request_target:","schedule:","openai/codex-action",
 "SUPABASE_SERVICE_ROLE_KEY","VERCEL_TOKEN","gh pr merge","git push origin main"])
 assert.ok(!wf.includes(forbidden),"Forbidden docs workflow authority: "+forbidden);
assert.equal((wf.match(/contents: write/g)||[]).length,1,"Only docs publisher may write");
console.log("PASS research docs job exact-source automation, owner-only branch scope and single-path atomic publication");
