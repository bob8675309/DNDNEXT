#!/usr/bin/env node
// Minimal, sanitized metadata-only Forge CI diagnostics; no complete log artifacts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
export function diagnose(raw){
 const log=String(raw).replace(/\u001b\[[0-9;]*m/g,"");
 const passes=[...log.matchAll(/(?:^|\n)PASS J(\d+)\b/g)].map(x=>Number(x[1]));
 const last=passes.length?Math.max(...passes):null;
 const complete=/PASS LOCAL REAL GoTrue J00-J141\b/.test(log);
 const category=complete?"test-terminal-marker-seen":
   /(?:source|hash|md5) (?:drift|mismatch)|source-fingerprint mismatch/i.test(log)?"source-fingerprint":
   /AssertionError|ERR_ASSERTION/i.test(log)?"assertion":
   /deadlock detected|40P01/i.test(log)?"concurrency-deadlock":
   /permission denied|42501|row-level security/i.test(log)?"auth-or-rls":
   /foreign key|23503|unique constraint|23505/i.test(log)?"constraint":
   /ECONNREFUSED|connection refused|timed out/i.test(log)?"local-service":
   /ERROR:|Error:|exception/i.test(log)?"other-error":"none-seen";
 return {lastPassJ:last,passedMarkers:new Set(passes).size,category,terminalJ141Seen:complete,
   warning:complete?"J141 completion marker found; check actual GitHub job conclusion.":
       "Missing terminal J141 marker; inspect exact GitHub Actions log. Never claim a PASS from these heuristics."};
}
export function markdown(r){
 return "# Forge CI source-safe diagnostic\n\n"+
 "This artifact deliberately contains no raw SQL, JWT, source log, credentials or environment values.\n\n"+
 "| Field | Value |\n|---|---|\n"+
 "| Last J PASS marker | "+(r.lastPassJ??"None")+" |\n"+
 "| Distinct J PASS markers | "+r.passedMarkers+" |\n"+
 "| Possible failure category (heuristic) | "+r.category+" |\n"+
 "| Final J141 marker | "+(r.terminalJ141Seen?"present":"missing")+" |\n\n"+
 r.warning+"\n\nFull exact-head test job conclusion is authoritative; this is not release acceptance.\n";
}
if(process.argv[1] && fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 try{
  const file=path.resolve(process.argv[2]||"");
  const out=path.resolve(process.argv[3]||"research-agent-artifact");
  const result=diagnose(existsSync(file)?readFileSync(file,"utf8"):"");
  mkdirSync(out,{recursive:true});
  writeFileSync(path.join(out,"FORGE_JWT_DIAGNOSTICS.md"),markdown(result));
  writeFileSync(path.join(out,"FORGE_JWT_DIAGNOSTICS.json"),JSON.stringify(result,null,2)+"\n");
  console.log("Safe Forge diagnostic "+result.category+" lastPass="+result.lastPassJ);
 }catch(e){console.error("Diagnostic output failed: "+e.message);process.exitCode=1}
}
