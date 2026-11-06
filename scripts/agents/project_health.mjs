#!/usr/bin/env node
// GitHub-source-only DNDNext health snapshot. No AI, live SQL, Vercel API or side effects.
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const IDS=[317,321,324,325];
const SHA=/^[a-f0-9]{40}$/;
const URL="https://github.com/bob8675309/DNDNEXT";
const safe=(s)=>String(s??"").replace(/[\u0000-\u001f|<>\x60\[\]\\]/g," ").slice(0,130);
const exactSha=(s)=>assert.match(String(s),SHA,"expected exact SHA");
export function parseSnapshot(s){
 const hash=String(s||"").match(/\| Exact source commit represented by this archive snapshot \| \x60([a-f0-9]{40})\x60/);
 const totals=String(s||"").match(/\|\s*31\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/);
 return {sha:hash?.[1]||null,metrics:totals?{staged:+totals[1],missing:+totals[2],mismatches:+totals[3],receipts:+totals[4]}:null};
}
export function summarizeHealth(data){
 assert.equal(data.repository,"bob8675309/DNDNEXT");
 exactSha(data.mainSha);exactSha(data.sourceSha);
 assert.match(data.sourceBranch,/^(agent|research)\/[a-zA-Z0-9._/-]+$/);
 assert.match(data.generatedAt,/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/);
 assert.equal(data.entries.length,4);
 const pulls=data.entries.map((e,i)=>{
  assert.equal(e.pr.number,IDS[i]);
  exactSha(e.pr.head.sha);
  assert.ok(Array.isArray(e.runs.workflow_runs));
  const seen=new Map();
  for(const r of e.runs.workflow_runs){
   if(r.head_sha!==e.pr.head.sha || !Number.isSafeInteger(r.id) || r.id<=0)continue;
   const key=String(r.workflow_id??r.name??r.id);
   const before=seen.get(key);
   if(!before||Date.parse(r.updated_at||r.created_at||"")>=Date.parse(before.updated_at||before.created_at||""))seen.set(key,r);
  }
  const workflows=[...seen.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name))).slice(0,16);
  const failures=workflows.filter(r=>["failure","action_required","timed_out","startup_failure"].includes(r.conclusion));
  const pending=workflows.filter(r=>r.status!=="completed"||!r.conclusion);
  const uncertain=workflows.filter(r=>["skipped","cancelled","neutral","stale"].includes(r.conclusion));
  const status=failures.length?"REQUIRES REVIEW":pending.length?"CHECKS RUNNING":
    !workflows.length?"NO EXACT-HEAD WORKFLOWS":uncertain.length?"REVIEW SKIPPED/CANCELLED":"RECORDED RUNS GREEN";
  const files=(e.commit.files||[]).map(x=>x.filename).filter(x=>typeof x==="string");
  const changedCode=files.some(x=>!x.startsWith("docs/"));
  const changedDocs=files.some(x=>x.startsWith("docs/")&&x!=="docs/RESEARCH_BRANCH_STATUS.generated.md");
  const docStatus=!files.length?"no latest-commit file details":changedCode&&!changedDocs?"review living docs":
    changedDocs?"authored docs present":"docs-only latest commit";
  return {number:e.pr.number,title:safe(e.pr.title),head:e.pr.head.sha,branch:e.pr.head.ref,
   base:e.pr.base.ref,draft:e.pr.draft,state:e.pr.state,workflows,status,
   failures:failures.length,pending:pending.length,docStatus};
 });
 const forge=parseSnapshot(data.snapshots?.forge);
 const agent=parseSnapshot(data.snapshots?.agent);
 return {generatedAt:data.generatedAt,sourceBranch:data.sourceBranch,sourceSha:data.sourceSha,mainSha:data.mainSha,pulls,
  forge:{...forge,current:forge.sha===pulls[2].head},
  agent:{...agent,current:agent.sha===pulls[3].head}};
}
export function renderHealth(h){
 const lines=["# DNDNext — automatically reconciled project health","",
 "**Prototype development only.** Free GitHub metadata snapshot; not production acceptance, an autonomous AI worker, or a Vercel deployment. No Work, Codex or paid API invocation.",
 "",
 "| Captured UTC | Trigger source | GitHub main (NOT verified production) |",
 "|---|---|---|",
 "| "+h.generatedAt+" | "+safe(h.sourceBranch)+" ("+h.sourceSha+") | "+h.mainSha+" |",
 "",
 "## Exact PR heads and latest captured GitHub Actions","",
 "| PR | Branch/base | Exact head SHA | Workflow status | Documentation signal |",
 "|---|---|---|---|---|"];
 for(const p of h.pulls){
  lines.push("| [#"+p.number+"]("+URL+"/pull/"+p.number+") "+(p.draft?"draft":"not draft")+
   " | "+safe(p.branch)+" → "+safe(p.base)+" | "+p.head+" | "+p.status+
   " ("+p.workflows.length+" workflows) | "+p.docStatus+" |");
 }
 for(const p of h.pulls){
  lines.push("","### PR #"+p.number+" — "+p.title,"");
  if(!p.workflows.length)lines.push("- No exact-source-SHA workflow runs returned; PR merge-ref checks and outside CI are not implied.");
  for(const run of p.workflows)
   lines.push("- "+safe(run.name)+": **"+safe(run.conclusion||run.status||"unknown")+"** ([run "+run.id+"]("+URL+"/actions/runs/"+run.id+"))");
  if(p.failures)lines.push("- **Investigate:** exact-head failure/action-required checks.");
  if(p.pending)lines.push("- **Pending:** some checks were in progress when this snapshot was captured.");
 }
 lines.push("","## Source-linked archive status","",
 "- [Forge status]("+URL+"/blob/docs/agent-status/docs/research-status/research-forge-immutable-creation-replay-20261105.generated.md): "+
 (h.forge.current?"CURRENT":"STALE/UNVERIFIED")+" vs PR #324 head"+(h.forge.sha?" (archive SHA "+h.forge.sha+")":" (no valid source SHA)"),
 "- [Research agent status]("+URL+"/blob/docs/agent-status/docs/research-status/agent-research-orchestrator-20261105.generated.md): "+
 (h.agent.current?"CURRENT":"STALE/UNVERIFIED")+" vs PR #325 head"+(h.agent.sha?" (archive SHA "+h.agent.sha+")":" (no valid source SHA)"));
 if(h.forge.current&&h.forge.metrics){
  const m=h.forge.metrics;
  lines.push("","### Original Forge trigger evidence (source-aligned)","",
  "- "+m.staged+"/31 staged DDL; "+m.missing+" unstaged; "+m.mismatches+" DDL mismatches; "+
  m.receipts+" specifically receipted authenticated suites.",
  "- DDL presence and bounded signed-in fixtures do NOT establish full production RLS, concurrency, catalog or browser parity.");
 }else lines.push("","**Forge counts withheld:** archive source SHA does not match current PR #324 head. Rerun original audit before using old numbers.");
 const needs=h.pulls.filter(p=>p.failures||p.pending||!p.workflows.length);
 lines.push("","## Review queue and limits","",
 needs.length?"- CI needs review for "+needs.map(p=>"#"+p.number+" ("+p.status+")").join(", ")+".":"- No failed or pending exact-head workflows were observed AT CAPTURE TIME. No merge/readiness claim.",
 "- Held #317 cross-table G/CP/CS/GI lock research, #321 privacy, #324 Forge and #325 agent remain separate release gates.",
 "- 2014 PHB optional-content toggle is DESIGNED ONLY; 2024 XPHB default. Do not rewrite source rules.",
 "- The site is a **prototype**; game content is test data, but never reset shared production-like records without a separately reviewed boundary.",
 "- ChatGPT Work stays **on demand for difficult investigations**. No Work schedule, paid Codex execution, API credits or automatic purchases.",
 "- These statuses are a **time-stamped snapshot**. When CI finishes afterward, view the live PR and GitHub Actions; no continuous polling is claimed.",
 "- No production SQL, deployment, automatic merge, protected map edits or paid model calls are authorized.",
 "",
 "## Safe next research task","",
 "If a CI check fails, diagnose its exact source SHA first; otherwise select ONE unverified original Forge trigger for isolated, source-exact signed-JWT fixtures, update the authored handoff and retain separate lock-order gates.","");
 return lines.join("\n");
}
export function loadHealth(dir,meta){
 const entries=IDS.map(n=>({
  pr:JSON.parse(readFileSync(path.join(dir,"pr-"+n+".json"),"utf8")),
  runs:JSON.parse(readFileSync(path.join(dir,"runs-"+n+".json"),"utf8")),
  commit:JSON.parse(readFileSync(path.join(dir,"commit-"+n+".json"),"utf8"))
 }));
 const snapshot=n=>existsSync(path.join(dir,n+".md"))?readFileSync(path.join(dir,n+".md"),"utf8"):"";
 return summarizeHealth({...meta,repository:"bob8675309/DNDNEXT",entries,snapshots:{forge:snapshot("forge"),agent:snapshot("agent")}});
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 try{
  const directory=path.resolve(process.argv[2]||"");
  const target=path.resolve(process.argv[3]||"");
  assert.ok(target.endsWith("/PROJECT_HEALTH.generated.md"));
  const meta=JSON.parse(readFileSync(path.join(directory,"meta.json"),"utf8"));
  const h=loadHealth(directory,meta);
  writeFileSync(target,renderHealth(h)+"\n","utf8");
  console.log("PASS free health snapshot: "+h.pulls.length+" PRs, Forge source "+(h.forge.current?"aligned":"stale"));
 }catch(e){console.error("FAIL project health (closed): "+e.message);process.exitCode=1}
}
