#!/usr/bin/env node
import assert from "node:assert/strict";
import {parseSnapshot,summarizeHealth,renderHealth} from "./project_health.mjs";
const sha=x=>x.repeat(40);
const entry=(n,s)=>({pr:{number:n,title:"PR <untrusted>|title",head:{sha:s,ref:"research/test-"+n},base:{ref:"main"},draft:true,state:"open"},
 commit:{files:[{filename:"scripts/test.mjs"}]},
 runs:{workflow_runs:[{id:n*100,name:"checks",workflow_id:n,head_sha:s,status:"completed",conclusion:"success",updated_at:"2026-11-06T17:00:00Z"}]}});
const data={repository:"bob8675309/DNDNEXT",mainSha:sha("a"),sourceSha:sha("b"),sourceBranch:"agent/test",
generatedAt:"2026-11-06T17:00:00Z",entries:[entry(317,sha("c")),entry(321,sha("d")),entry(324,sha("e")),entry(325,sha("f"))],
snapshots:{forge:"| Exact source commit represented by this archive snapshot | \x60"+sha("e")+"\x60 |\n| 31 | 15 | 16 | 0 | 3 |",
agent:"| Exact source commit represented by this archive snapshot | \x60"+sha("f")+"\x60 |"}};
const h=summarizeHealth(data),out=renderHealth(h);
assert.equal(h.pulls.length,4);
assert.equal(h.pulls[0].status,"RECORDED RUNS GREEN");
assert.equal(h.forge.current,true);
assert.equal(h.forge.metrics.receipts,3);
assert.match(out,/15\/31 staged DDL/);
assert.match(out,/on demand for difficult investigations/);
assert.ok(!out.includes("<untrusted>"));
const bad=structuredClone(data);bad.entries[0].runs.workflow_runs[0].conclusion="action_required";
assert.equal(summarizeHealth(bad).pulls[0].status,"REQUIRES REVIEW");
const pending=structuredClone(data);pending.entries[1].runs.workflow_runs[0].status="in_progress";pending.entries[1].runs.workflow_runs[0].conclusion=null;
assert.equal(summarizeHealth(pending).pulls[1].status,"CHECKS RUNNING");
const stale=structuredClone(data);stale.entries[2].runs.workflow_runs[0].head_sha=sha("1");stale.snapshots.forge=stale.snapshots.forge.replace(sha("e"),sha("c"));
const s=summarizeHealth(stale);
assert.equal(s.pulls[2].status,"NO EXACT-HEAD WORKFLOWS");
assert.equal(s.forge.current,false);
assert.match(renderHealth(s),/Forge counts withheld/);
const wrong=structuredClone(data);wrong.entries[1].pr.head.sha="bad";
assert.throws(()=>summarizeHealth(wrong));
assert.equal(parseSnapshot("not an archive").sha,null);
console.log("PASS no-cost project-health original SHA, stale docs, pending/failure and no paid-Work gates");
