#!/usr/bin/env node
// C34 T36: local-only, default-OFF Pages Router /npcs research cutover.
// No hosted DB, main, runtime world-map edits, or deploy. Not a release switch.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {deriveT35FullManager} from "./derive_t35_full_npc_manager.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const original=path.join(root,"pages/npcs.js");
export const T36_LOCAL_ROUTE="pages/__c34_t36_npcs.jsx";
export const T36_FLAG="NEXT_PUBLIC_C34_T36_NPCS_RESEARCH";
export const T36_RESEARCH_CONFIRM="SIGNED_LOCAL_PG17_T36_ONLY";
export const T36_MARKER='data-c34-t36="source-derived-stage2"';
export const T36_REWRITE=Object.freeze({source:"/npcs",destination:"/__c34_t36_npcs"});

export function t36ResearchEnabled(env=process.env){
  if(env[T36_FLAG]!=="1")return false; // normal /npcs is byte-identical original.
  for(const [key,expected] of Object.entries({
    CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
    PGPORT:"54322",PGDATABASE:"postgres",
    DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
    C34_T36_LOCAL_CONFIRM:T36_RESEARCH_CONFIRM,
  }))assert.equal(env[key],expected,"T36 refuses hosted/unsigned route "+key);
  assert.notEqual(env.VERCEL,"1","T36 research cannot be enabled in Vercel");
  return true;
}
export function makeT36Source(){
  const {output,edits,baseEdits}=deriveT35FullManager(fs.readFileSync(original,"utf8"));
  assert.ok(edits.length>=4&&baseEdits.length>=12);
  const tag='<div className="npcs-page-root">';
  assert.equal(output.split(tag).length-1,1,"Original/T35 root drift; do not mount partial UI");
  const code=output.replace(tag,'<div className="npcs-page-root" '+T36_MARKER+'>');
  assert.match(code,/readTownGameManagerNpcProfileCandidate\(supabase, id/);
  assert.doesNotMatch(code,/\.rpc\("is_admin",\s*\{\s*uid:/);
  return "// T36 EXACT SOURCE generated from ORIGINAL current NPC manager / T25 / T35.\n"+
    "// LOCALHOST-only, unsigned production build MUST NOT contain this page.\n"+code;
}
export function reconcileT36Route(env=process.env){
  const enabled=t36ResearchEnabled(env);
  const pathname=path.join(root,T36_LOCAL_ROUTE);
  if(!enabled && !fs.existsSync(pathname))return false;
  const expected=makeT36Source();
  if(!enabled){
    // Never leave a generated public alias available after switching flag off.
    // Never delete an unknown file or a tracked source artifact.
    assert.equal(fs.readFileSync(pathname,"utf8"),expected,
      "T36 refuses to delete an unknown/corrupted candidate route");
    fs.unlinkSync(pathname);
    return false;
  }
  if(fs.existsSync(pathname)){
    assert.equal(fs.readFileSync(pathname,"utf8"),expected,
      "T36 refuses stale/mismatched cached manager source");
  }else{
    fs.writeFileSync(pathname,expected,{flag:"wx",mode:0o600});
  }
  assert.equal(fs.readFileSync(pathname,"utf8"),expected);
  return true;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const flag=process.argv[2];
 assert.ok(flag==="--verify"||flag==="--prepare"||flag==="--cleanup",
    "T36 only --verify/--prepare/--cleanup local route");
 if(flag==="--verify"){
   const output=makeT36Source();
   assert.match(output,/data-c34-t36="source-derived-stage2"/);
   assert.equal(t36ResearchEnabled({...process.env,[T36_FLAG]:"0"}),false);
   console.log("PASS T36-PREPARE-SOURCE: original NPC manager exact derivation, default OFF and source provenance");
 }else if(flag==="--cleanup"){
   assert.equal(t36ResearchEnabled({...process.env,[T36_FLAG]:"0"}),false);
   reconcileT36Route({...process.env,[T36_FLAG]:"0"});
   console.log("PASS T36-ROUTE-CLEANUP: generated page absent; original /npcs still exists");
 }else {
   assert.ok(reconcileT36Route(),"T36 --prepare requires explicit signed local gate");
   console.log("PASS T36-ROUTE-GENERATED: source-derived original full manager only for local research");
 }
}
