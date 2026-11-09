#!/usr/bin/env node
// Offline original Forge evidence ledger. No database access, paid model or credentials.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectForgeCheckout, renderReport } from "./forge_trigger_audit.mjs";

export function buildLedger(coverage, receipts) {
  assert.equal(coverage.originalCount, 31, "historical trigger census must remain 31");
  assert.equal(receipts.schemaVersion, 1);
  const evidence=new Map();
  for(const r of receipts.receipts) {
    if(evidence.has(r.trigger)) throw Error("Duplicate receipt "+r.trigger);
    if(!/^[a-f0-9]{32}$/.test(r.sourceMd5) || !/^[a-f0-9]{40}$/.test(r.testedHead)
      || !Number.isSafeInteger(r.actionsRunId) || r.actionsRunId <= 0 || !/^J\d+-J\d+$/.test(r.tests))
      throw Error("Invalid evidence receipt "+r.trigger);
    evidence.set(r.trigger,r);
  }
  const rows=coverage.rows.map(r=>{
    const e=evidence.get(r.name);
    if(e && e.sourceMd5!==r.md5) throw Error("Source fingerprint drift "+r.name);
    if(e && r.status!=="staged-ddl") throw Error("Receipted trigger no longer staged "+r.name);
    return {...r, sourceDeclarationTextSeen:!!r.sourceDeclarationSeen,
      md5TextSeen:!!r.md5MentionedInFixture, evidence:e||null};
  });
  for(const n of evidence.keys()) if(!rows.some(x=>x.name===n)) throw Error("Unknown trigger receipt "+n);
  return {original:31,staged:coverage.stagedCount,missing:coverage.missingCount,
    mismatches:coverage.mismatchCount,individualJWTReceipts:rows.filter(x=>x.evidence).length,rows};
}
export function renderLedger(l){
  const lines=["# Forge original trigger acceptance ledger","",
    "Read-only comparison with dated original 31-trigger census and held Forge SQL fixtures. NOT a live production audit.",
    "",
    "| Original | Staged DDL | Not staged | DDL mismatch | Targeted JWT receipts |",
    "|---:|---:|---:|---:|---:|",
    "| "+l.original+" | "+l.staged+" | "+l.missing+" | "+l.mismatches+" | "+l.individualJWTReceipts+" |","",
    "**Evidence is not interchangeable:** staged SQL text, source declaration, referenced MD5, executed exact source hash, real JWT, COMMIT/rollback, concurrency and browser acceptance are distinct gates.",
    "",
    "| Table | Original trigger | Fixture DDL | Handler declaration text | MD5 text | Specific real-JWT receipt |",
    "|---|---|---|---|---|---|"];
  for(const r of l.rows){
    const e=r.evidence;
    const ev=e?"["+e.tests+" at "+e.testedHead.slice(0,9)+"](https://github.com/bob8675309/DNDNEXT/actions/runs/"+e.actionsRunId+")":"No individual receipt";
    lines.push("| "+r.table+" | "+r.name+" | "+r.status+" | "+(r.sourceDeclarationTextSeen?"seen":"absent")+
    " | "+(r.md5TextSeen?"seen":"absent")+" | "+ev+" |");
  }
  lines.push("","## Specific targeted acceptance evidence","");
  for(const r of l.rows.filter(x=>x.evidence)){
    lines.push("- "+r.name+" ("+r.evidence.tests+"): "+r.evidence.scope+
    " [Exact-head CI](https://github.com/bob8675309/DNDNEXT/actions/runs/"+r.evidence.actionsRunId+")");
  }
  lines.push("","## Outstanding original trigger backlog","");
  for(const r of l.rows.filter(x=>x.status!=="staged-ddl"))lines.push("- "+r.table+"."+r.name+" — "+r.status);
  lines.push("","## Mandatory unproven release gates","","Full source/executable MD5 and dependency parity, original full RLS, all original branches, authenticated actor matrices, cross-table CP/CS/G/GI/I/C concurrency/deadlock, original deferred COMMIT/rollback and browser/staging must be separately proved.","",
  "No original SQL execution, production writes, model/API charges, auto PR or auto merge.","");
  return lines.join("\n");
}
export function run(root,dir){
  const c=inspectForgeCheckout(root);
  const r=JSON.parse(readFileSync(path.join(root,"scripts/agents/forge_trigger_acceptance_receipts.json"),"utf8"));
  const l=buildLedger(c,r);
  mkdirSync(dir,{recursive:true});
  writeFileSync(path.join(dir,"FORGE_TRIGGER_ACCEPTANCE_LEDGER.md"),renderLedger(l));
  writeFileSync(path.join(dir,"FORGE_TRIGGER_ACCEPTANCE_LEDGER.json"),JSON.stringify(l,null,2)+"\n");
  writeFileSync(path.join(dir,"FORGE_TRIGGER_COVERAGE.md"),renderReport(c));
  writeFileSync(path.join(dir,"FORGE_TRIGGER_COVERAGE.json"),JSON.stringify(c,null,2)+"\n");
  console.log("Forge accepted evidence: "+l.staged+"/31 DDL, "+l.missing+" missing, "+l.mismatches+" mismatch, "+l.individualJWTReceipts+" targeted JWT receipts");
  if(l.mismatches)process.exitCode=1;
  return l;
}
if(process.argv[1] && fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
  try{run(path.resolve(process.argv[2]||"."),path.resolve(process.argv[3]||"research-agent-artifact"))}
  catch(e){console.error("Fail-closed original trigger ledger: "+e.message);process.exitCode=1}
}
