#!/usr/bin/env node
// Read-only source completeness gate for 45 pinned open PRs, older original
// source dossiers, all 25 newer research PRs and three recent scoped merges.
// A successful literal blob census does NOT certify semantic integration.
import assert from "node:assert/strict";
import fs from "node:fs";
const dir="docs/audits/";
const load=f=>JSON.parse(fs.readFileSync(dir+f,"utf8"));
const register=load("ALL_OPEN_PR_REGISTER_2026-11-12.json");
const batches=[
 "RECENT_PR_SCOPE_PARITY_349_356_2026-11-12.json",
 "RECENT_PR_SCOPE_PARITY_357_364_2026-11-12.json",
 "RECENT_PR_SCOPE_PARITY_365_373_2026-11-12.json",
 "RECENT_PR_SCOPE_PARITY_MERGED_AND_PRESERVED_2026-11-12.json",
].map(load);
const source=register.sourceMainSHA;
assert.equal(source,"00c5c4416b99ac256913b48ef96387f3eabfde44");
assert.equal(register.count,45);
assert.equal(register.ownerOriginal,20);
assert.equal(register.additionalRecent,25);
assert.equal(register.prs.length,45);
assert.equal(new Set(register.prs.map(x=>x.pr)).size,45);
const orig=[309,312,317,318,320,321,322,323,324,325,328,329,330,331,332,333,334,335,345,347];
const recent=[...Array(23)].map((_,i)=>349+i).concat([373,375]);
const ids=register.prs.map(x=>x.pr).sort((a,b)=>a-b);
assert.deepEqual(ids,[...orig,...recent].sort((a,b)=>a-b));
const originalSet=new Set(orig),newSet=new Set(recent);
let sourceRows=0;
for(const p of register.prs){
 assert.match(p.headSHA,/^[a-f0-9]{40}$/,"Missing original source HEAD "+p.pr);
 assert.match(p.baseSHA,/^[a-f0-9]{40}$/,"Missing original parent SHA "+p.pr);
 assert.ok(p.baseBranch,"Original PR "+p.pr+" base omitted");
 assert.equal(p.open,true);
 assert.equal(p.draft,true);
 if(originalSet.has(p.pr)){
  assert.equal(p.group,"original_owner_scope_20");
  const doc=fs.readFileSync("docs/pr-integration/PR-"+p.pr+".md","utf8");
  const m=doc.slice(0,2200).match(/[a-f0-9]{40}/);
  assert.ok(m,"No exact original head in dossier "+p.pr);
  assert.equal(m[0],p.headSHA,"Dossier PR source HEAD drift! #"+p.pr);
 }else{
  assert.equal(p.group,"recent_research_or_audit_25");
  assert.ok(newSet.has(p.pr),"Missing newer research group");
 }
}
const present=new Map();
for(const batch of batches){
 assert.equal(batch.mainSHA,source);
 for(const p of batch.prs){
  assert.ok(!present.has(p.pr),"Recent file inventory duplicate #"+p.pr);
  assert.equal(p.records.length,p.changedFiles,"Not all changed paths loaded for PR #"+p.pr);
  assert.equal(new Set(p.records.map(x=>x.path)).size,p.records.length);
  const counts={exact:0,different:0,absent:0};
  for(const f of p.records){
   assert.match(f.sourceBlob,/^[0-9a-f]{40}$/,"Missing changed-file blob SHA "+f.path);
   if(f.parity==="identical_blob_on_main"){counts.exact++;assert.equal(f.sourceBlob,f.mainBlob);}
   else if(f.parity==="different_blob_on_main"){counts.different++;assert.match(f.mainBlob,/^[0-9a-f]{40}$/);assert.notEqual(f.sourceBlob,f.mainBlob);}
   else if(f.parity==="absent_on_main"){counts.absent++;assert.equal(f.mainBlob,null);}
   else throw Error("Unexpected blob status "+f.parity);
  }
  assert.deepEqual(p.counts,counts);
  present.set(p.pr,p);sourceRows+=p.changedFiles;
 }
}
assert.equal(present.size,29);
for(const n of [...recent,347,348,372,374])assert.ok(present.has(n),"Missing recent+merged PR "+n);
for(const p of register.prs){
 const other=present.get(p.pr);
 if(!other)continue;
 assert.equal(other.head,p.headSHA,"PR "+p.pr+" head changed since snapshot; regenerate/reaudit");
 assert.equal(other.baseSHA,p.baseSHA,"PR "+p.pr+" base re-pointed; re-evaluate inherited work");
}
for(const n of [348,372,374]){
 const p=present.get(n);
 assert.equal(p.merged,true);
}
assert.equal(present.get(348).changedFiles,38);
assert.ok(present.get(348).records.every(x=>x.path==="AGENTS.md"||x.path.startsWith("docs/")),"#348 was not docs-only");
assert.equal(present.get(372).changedFiles,10);
assert.notEqual(present.get(372).baseBranch,"main","Research-only #372 must not be falsely counted as main");
assert.equal(present.get(374).changedFiles,8);
assert.ok(present.get(374).records.every(x=>x.parity==="identical_blob_on_main"),"P1 #374 main blob parity broken");
assert.equal(present.get(375).merged,false);
const proto=fs.readFileSync("docs/PR_FULL_SCOPE_REVIEW_PROTOCOL.md","utf8");
const report=fs.readFileSync(dir+"RECENT_PR_NO_LOST_WORK_REVIEW_2026-11-12.md","utf8");
const script=fs.readFileSync("scripts/audits/review_pr_full_scope.mjs","utf8");
const ci=fs.readFileSync(".github/workflows/audit-pr-full-inheritance.yml","utf8");
const template=fs.readFileSync(".github/PULL_REQUEST_TEMPLATE.md","utf8");
for(const key of [
 "Scope and inheritance","Original sources and preserved work",
 "Changes intentionally deferred","Testing and evidence","Release and rollback"
])assert.ok(template.includes("## "+key),"Future PR must include "+key);
for(const x of ["pull_request_target:","workflow_dispatch:","persist-credentials: false","github.event.repository.default_branch","source-ledger-self-test"]){
 assert.ok(ci.includes(x),"Full source CI workflow missing "+x);
}
for(const x of ["headOnlyFileCount","mainOnlyNotInHeadCount","inheritedNonImmediateCount","changed_files","original work"]){
 assert.ok(script.includes(x)||proto.includes(x),"Original future PR source/intent guard missing "+x);
}
assert.ok(proto.includes("45 open")&&proto.includes("20 original")&&proto.includes("25 additional"));
assert.ok(report.includes("PR #373")&&report.includes("11/34")&&report.includes("12/34"));
assert.ok(report.includes("17")&&report.includes("31")&&report.includes("negative"));
const stale=fs.readFileSync("docs/ACTIVE_WORK.md","utf8").slice(0,2600);
assert.ok(stale.includes("#375")&&stale.includes("45 open")&&stale.includes("2026-11-12"),"Current branch must supersede stale P1 handoff");
console.log("PASS full inherited PR scope/register: 45 open = 20 exact head-pinned original + 25 recent, "+present.size+" recent/merged live PR manifests with "+sourceRows+" file-level source SHA rows, #348 docs-only / #372 research-only / #374 P1-only, future PR trusted-base CI and owner handoff present.");
