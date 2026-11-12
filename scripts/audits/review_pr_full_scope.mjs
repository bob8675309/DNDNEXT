#!/usr/bin/env node
/**
 * DNDNext PR completeness/inheritance inventory.
 * TRUSTED-BASE script for pull_request_target or manually supplied PR number.
 * No PR HEAD code checkout/execution, no SQL, no Supabase credentials, no writes
 * to GitHub. Source-blob equality is NOT behavioral equivalence or release approval.
 */
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,appendFileSync} from "node:fs";

const KEYS=[
 "Scope and inheritance",
 "Original sources and preserved work",
 "Changes intentionally deferred",
 "Testing and evidence",
 "Release and rollback",
];
const EFFECTIVE="2026-11-13T00:00:00Z";
const sha=/^[0-9a-f]{40}$/;
const onlyRuntime=p=>/^(pages|components|styles|sql\/|supabase\/migrations\/|middleware\.|next\.config\.|vercel\.json)/.test(p);
const riskTags=p=>{
 const r=[];
 if(/^(pages|components|styles)\//.test(p)||/^(middleware\.|next\.config\.)/.test(p))r.push("ui-runtime");
 if(p.startsWith("sql/")||p.startsWith("supabase/migrations/"))r.push("db-candidate");
 if(p.startsWith("utils/")||p.startsWith("lib/"))r.push("shared-utility");
 if(p.startsWith(".github/workflows/"))r.push("ci");
 if(p.startsWith("scripts/fixtures/")&&p.endsWith(".sql"))r.push("sql-fixture");
 if(p.startsWith("docs/")||p==="AGENTS.md")r.push("documentation");
 return r;
};
function treeIndex(j,label){
 if(j?.truncated||!Array.isArray(j?.tree))throw Error(label+" Git tree truncated/invalid; cannot claim all files audited");
 return new Map(j.tree.filter(x=>x.type==="blob").map(x=>[x.path,x.sha]));
}
function compareTrees(head,main,immediate){
 const inherited=[];let exact=0,headOnly=0,different=0;
 for(const [p,hash] of head){
  const prev=main.get(p);
  if(prev===hash){exact++;continue;}
  if(!prev)headOnly++;else different++;
  if(!immediate.has(p))inherited.push({path:p,headBlob:hash,mainBlob:prev??null,
   relation:prev?"different_blob_inherited":"head_only_inherited"});
 }
 const removedFromHead=[...main.keys()].filter(p=>!head.has(p));
 return {headTreeSize:head.size,mainTreeSize:main.size,identicalFileCount:exact,
  headOnlyFileCount:headOnly,changedExistingFileCount:different,
  inheritedNonImmediateCount:inherited.length,
  inheritedNonImmediate:inherited,
  mainOnlyNotInHeadCount:removedFromHead.length,
  mainOnlyNotInHeadPaths:removedFromHead};
}
function sectionHasContent(body,key){
 const begin=new RegExp("^## "+key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\s*$","im");
 const m=begin.exec(body);if(!m)return false;
 const remainder=body.slice(m.index+m[0].length);
 const text=remainder.split(/^## /m)[0].replace(/<!--[^]*?-->/g,"").replace(/\[[^\]]*(describe|explain|insert|todo)[^\]]*\]/gi,"").trim();
 return text.length>=18 && !/^(-\s*\[\s*\].*)+$/s.test(text);
}
function reviewBody(p){
 const missing=KEYS.filter(k=>!sectionHasContent(p.body||"",k));
 const future=Date.parse(p.created_at)>=Date.parse(EFFECTIVE);
 return {enforcementApplies:future,requiredSectionNames:KEYS,missingSections:missing,
  result:!future?"historical_pr_warn_only":missing.length?"future_pr_missing_written_scope":"written_scope_present_not_semantically_validated"};
}
function inventory({p,files,head,base,main}){
 assert.ok(sha.test(p.head.sha)&&sha.test(p.base.sha),"Missing source/base commit identity");
 assert.equal(files.length,p.changed_files,"GitHub PR changed_files does NOT equal fully paginated files API");
 const seen=new Set();const entries=files.map(x=>{
  assert.ok(!seen.has(x.filename),"Duplicate changed-file path "+x.filename);seen.add(x.filename);
  const ref=head.get(x.filename),baseBlob=base.get(x.filename),mainBlob=main.get(x.filename);
  if(x.status==="removed")assert.equal(ref,undefined,"Removed file still present at head: "+x.filename);
  else{assert.ok(sha.test(ref||""),"Missing HEAD blob for PR changed path "+x.filename);
    if(x.sha)assert.equal(ref,x.sha,"Files API SHA not equal Git HEAD SHA for "+x.filename);
  }
  return {path:x.filename,gitStatus:x.status,previousPath:x.previous_filename||null,
   headBlob:ref??null,baseBlob:baseBlob??null,mainBlob:mainBlob??null,
   mainParity:ref===undefined?"removed_at_head":mainBlob===undefined?"not_on_main":ref===mainBlob?"exact_on_main":"different_on_main",
   risks:riskTags(x.filename)};
 });
 const full=compareTrees(head,main,seen);
 const body=reviewBody(p);
 // Only an OWN scope claim is binding. Other PRs may be referenced as
 // "docs-only #348" or "source-only #374" without describing this PR.
 const scopeClaim=(kind)=>new RegExp("^(?:\\[\\s*"+kind+"[- ]only\\s*\\]|"+kind+"[- ]only(?:\\b|\\s*[:—-]))","i").test((p.title||"").trim()) ||
  new RegExp("^\\s*(?:>\\s*)?(?:\\*\\*)?(?:scope|this\\s+(?:pr|pull request))(?:\\*\\*)?\\s*:\\s*(?:\\*\\*)?"+kind+"[- ]only\\b","im").test(p.body||"");
 const claimedDocsOnly=scopeClaim("docs");
 const claimedSourceOnly=scopeClaim("source");
 const docsOnlyConflict=claimedDocsOnly&&entries.some(x=>!x.path.startsWith("docs/")&&x.path!=="AGENTS.md");
 const sourceOnlyConflict=claimedSourceOnly&&entries.some(x=>onlyRuntime(x.path));
 return {
  generatedUTC:new Date().toISOString(),
  purpose:"SOURCE INVENTORY ONLY; never independently approves feature completeness, migration, user-facing behavior or merge",
  repository:p.base.repo?.full_name||process.env.GITHUB_REPOSITORY,pr:p.number,
  title:p.title,base:{branch:p.base.ref,sha:p.base.sha},
  head:{branch:p.head.ref,sha:p.head.sha},defaultMain:p.base.repo.default_branch||"main",
  reviewBody:body,merged:p.merged,draft:p.draft,
  exactPRChangedFileCount:files.length,
  fileEntries:entries,
  fullHeadVsMain:full,
  riskSummary:{
   runtimeTouched:entries.some(x=>onlyRuntime(x.path)),
   possibleSQLChanged:entries.some(x=>x.risks.includes("db-candidate")||x.risks.includes("sql-fixture")),
   docsOnlyClaimConflict:docsOnlyConflict,sourceOnlyClaimConflict:sourceOnlyConflict,
   sourceOnlyClaimIsNotFeatureCompleteness:true,
   mustReviewParentAncestry:p.base.ref!=="main",
   reviewRequired:docsOnlyConflict||sourceOnlyConflict||entries.some(x=>onlyRuntime(x.path))
  },
  caveat:"This report proves literal file/parent/main-blob scope, not that feature intentions, hidden side effects, original failures, users/roles, tests or restore gates are complete."
 };
}
async function api(url,token){
 const res=await fetch(url,{headers:{
  Accept:"application/vnd.github+json",Authorization:"Bearer "+token,
  "X-GitHub-Api-Version":"2022-11-28"
 }});
 if(!res.ok)throw Error("GitHub inventory fetch failed HTTP "+res.status+" at "+url.split("?")[0]);
 return res.json();
}
function markdown(info){
 const r=info.riskSummary,md=[
  "## DNDNext PR full-source inheritance inventory — NOT release approval",
  "",
  "| Field | Verified |","|---|---|",
  "| PR | #"+info.pr+" |",
  "| Exact HEAD | \`"+info.head.sha+"\` |",
  "| Base | \`"+info.base.branch+"\` @ \`"+info.base.sha+"\` |",
  "| PR files fully enumerated | "+info.exactPRChangedFileCount+" |",
  "| Entire HEAD tree vs current main | "+info.fullHeadVsMain.headOnlyFileCount+" head-only; "+info.fullHeadVsMain.changedExistingFileCount+" different; "+info.fullHeadVsMain.mainOnlyNotInHeadCount+" main-only |",
  "| Inherited / not in immediate PR diff | **"+info.fullHeadVsMain.inheritedNonImmediateCount+" paths** |",
  "| Runtime touched | "+r.runtimeTouched+" |",
  "| SQL/candidate/fixture touched | "+r.possibleSQLChanged+" |",
  "| Docs-only claim inconsistent with diff | "+r.docsOnlyClaimConflict+" |",
  "| Source-only claim includes runtime/DB paths | "+r.sourceOnlyClaimConflict+" |",
  "| Written scope sections missing | "+(info.reviewBody.missingSections.join(", ")||"none")+" |",
  "",
  "**Do not treat a green check as complete feature review.** Review all inherited head-only and changed paths, negative CI evidence, hidden permissions/ACL, runtime consumers, and deployment destination. This script makes omissions visible; it cannot prove semantic equivalence.",
 ];
 if(info.fullHeadVsMain.inheritedNonImmediate.length)md.push("","### First inherited changed paths (full list in JSON)",...info.fullHeadVsMain.inheritedNonImmediate.slice(0,25).map(x=>"- \`"+x.path+"\` ("+x.relation+")"));
 return md.join("\n")+"\n";
}
function selfTest(){
 const a=new Map([["docs/a.md","a".repeat(40)],["pages/a.js","b".repeat(40)],["src/fromparent.js","c".repeat(40)]]);
 const m=new Map([["docs/a.md","a".repeat(40)],["pages/a.js","d".repeat(40)],["src/onmain.js","e".repeat(40)]]);
 const c=compareTrees(a,m,new Set(["pages/a.js"]));
 assert.equal(c.inheritedNonImmediateCount,1);
 assert.equal(c.inheritedNonImmediate[0].path,"src/fromparent.js");
 assert.equal(c.mainOnlyNotInHeadCount,1);
 assert.ok(riskTags("sql/candidates/test.sql").includes("db-candidate"));
 assert.ok(!onlyRuntime("scripts/fixtures/safe_research.sql"));
 assert.ok(sectionHasContent("## Scope and inheritance\nAn exact, complete source versus base explanation\n\n## Testing and evidence\nSigned local fixture with source hash 12345","Scope and inheritance"));
 assert.ok(!sectionHasContent("## Scope and inheritance\n[Describe source]","Scope and inheritance"));
 const future=reviewBody({created_at:"2026-11-14T00:00:00Z",body:""});
 assert.ok(future.enforcementApplies&&future.missingSections.length===5);
 const old=reviewBody({created_at:"2026-11-12T10:00:00Z",body:""});
 assert.ok(!old.enforcementApplies);
 const p={number:123,title:"Source-only extraction",head:{sha:"0".repeat(40),ref:"research/abc"},base:{sha:"1".repeat(40),ref:"main",repo:{full_name:"o/r",default_branch:"main"}},created_at:"2026-11-14T00:00:00Z",changed_files:1,body:""};
 const entry=inventory({p,files:[{filename:"pages/a.js",status:"modified",sha:"b".repeat(40)}],head:a,base:m,main:m});
 assert.equal(entry.riskSummary.sourceOnlyClaimConflict,true);
 const mentionsOther={...p,title:"Forge source audit",body:"The preserved docs-only PR #348 covers a different source scope."};
 const inherited=inventory({p:mentionsOther,files:[{filename:"pages/a.js",status:"modified",sha:"b".repeat(40)}],head:a,base:m,main:m});
 assert.equal(inherited.riskSummary.docsOnlyClaimConflict,false,"Other PR docs-only mention is not our scope claim");
 const titleMention={...p,title:"Fix misleading docs-only reference",body:"Independent inherited research notes."};
 const titleResult=inventory({p:titleMention,files:[{filename:"pages/a.js",status:"modified",sha:"b".repeat(40)}],head:a,base:m,main:m});
 assert.equal(titleResult.riskSummary.docsOnlyClaimConflict,false,"Mention in issue title is not own scope");

 const ownScope={...p,title:"Docs-only current source audit",body:"This PR deliberately edits only documentation"};
 const incorrect=inventory({p:ownScope,files:[{filename:"pages/a.js",status:"modified",sha:"b".repeat(40)}],head:a,base:m,main:m});
 assert.equal(incorrect.riskSummary.docsOnlyClaimConflict,true,"Real docs-only claim with runtime file must fail closed");
 assert.equal(entry.fileEntries.length,1);
 console.log("PASS PR scope guard: complete file pagination, exact HEAD/blob, inherited full-tree, source-only contradiction, future evidence and legacy warning");
}
if(process.argv.includes("--self-test"))selfTest();
else{
 const token=process.env.GITHUB_TOKEN;const repo=process.env.GITHUB_REPOSITORY;
 if(!token||!repo||!/^[-\w.]+\/[-\w.]+$/.test(repo))throw Error("GitHub read-only token/repository required");
 let prNumber=Number(process.env.AUDIT_PR_NUMBER||"");
 if(!prNumber&&process.env.GITHUB_EVENT_PATH){
  const e=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
  prNumber=Number(e.pull_request?.number||e.inputs?.pr_number||"");
 }
 if(!Number.isSafeInteger(prNumber)||prNumber<1)throw Error("PR number missing");
 const u="https://api.github.com/repos/"+repo;
 const p=await api(u+"/pulls/"+prNumber,token);
 const files=[];
 for(let page=1;page<=30;page++){
  const next=await api(u+"/pulls/"+prNumber+"/files?per_page=100&page="+page,token);
  if(!Array.isArray(next))throw Error("GitHub PR file pagination failed");
  files.push(...next);
  if(next.length<100)break;
  if(page===30)throw Error("More than 3000 changed paths; explicit manual inventory required");
 }
 const ref=p.base.repo?.default_branch||"main";
 const defaultBranch=await api(u+"/branches/"+encodeURIComponent(ref),token);
 const [headTree,baseTree,mainTree]=await Promise.all([
  api(u+"/git/trees/"+p.head.sha+"?recursive=1",token),
  api(u+"/git/trees/"+p.base.sha+"?recursive=1",token),
  api(u+"/git/trees/"+defaultBranch.commit.sha+"?recursive=1",token)
 ]);
 const result=inventory({p,files,head:treeIndex(headTree,"HEAD"),base:treeIndex(baseTree,"BASE"),main:treeIndex(mainTree,ref)});
 const summary=markdown(result);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
 if(process.env.AUDIT_REPORT_FILE)writeFileSync(process.env.AUDIT_REPORT_FILE,JSON.stringify(result,null,2)+"\n");
 console.log("PR #"+p.number+" source-inventory files="+files.length+" inherited="+result.fullHeadVsMain.inheritedNonImmediateCount+" risk="+JSON.stringify(result.riskSummary)+" evidence="+result.reviewBody.result);
 if(result.riskSummary.docsOnlyClaimConflict||result.riskSummary.sourceOnlyClaimConflict)
  throw Error("PR scope title contradicted by actual diff; revise scope/review feature before merge");
 if(result.reviewBody.enforcementApplies&&result.reviewBody.missingSections.length)
  throw Error("Future PR missing mandatory written scope/evidence sections: "+result.reviewBody.missingSections.join(", "));
}
