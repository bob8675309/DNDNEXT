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
  let code=output.replace(tag,'<div className="npcs-page-root" '+T36_MARKER+'>');
  // Stage2 revokes SELECT on five narrative columns for *all* authenticated
  // callers. Original PostgREST UPDATE(patch) then fails 42501 even for GM;
  // never restore the revoked column/table grants to make UI Save appear green.
  // Keep full original onSave (and its separate GM-secret + sheet writes), but
  // substitute ONLY the exactly anchored narrative UPDATE with the signed,
  // server-whitelisted, character-scoped T36 scratch writer.
  const beginMarker='// Save narrative fields';
  const endMarker='// Save sheet overlay';
  assert.equal(code.split(beginMarker).length-1,1,
    "T36 original full manager narrative section moved");
  assert.equal(code.split(endMarker).length-1,1,
    "T36 original full manager sheet section moved");
  const start=code.indexOf(beginMarker);
  const end=code.indexOf(endMarker,start);
  assert.ok(start>0&&end>start,"T36 refuse reordered original narrative onSave");
  const originalWrite='const upd = await supabase.from("characters").update(patch).eq("id", selected.id);';
  const narrative=code.slice(start,end);
  assert.equal(narrative.split(originalWrite).length-1,1,
    "T36 refuse changed original narrative UPDATE; inspect authenticated source");
  const securedWrite=[
    'const narrativePatch = { ...patch };',
    '                           delete narrativePatch.updated_at;',
    '                           const upd = await supabase.rpc("c34_npc_narrative_save_research_v1", {',
    '                             p_character_id: selected.id, p_patch: narrativePatch',
    '                           });'
  ].join("\n");
  code=code.slice(0,start)+narrative.replace(originalWrite,securedWrite)+code.slice(end);
  // T38-P1: T25 intentionally strips GM secrets from the PUBLIC roster.
  // The unchanged original view-only Secret field still referenced
  // selected.secret, which is now always absent after reload. Read only the
  // actor/character-bound original Stage2 GM dossier, already fetched by the
  // T31 signed capability-validated selected reader. Never restore bulk roster
  // secret reads or broaden an authenticated role's grants.
  const oldSecretDisplay="{selected.secret || <span className=\"npc-muted\">—</span>}";
  const sourceBoundSecretDisplay="{(isAdmin && selectedPrivateResult?.dossier ? selectedPrivateResult.dossier.secret : null) || <span className=\"npc-muted\">—</span>}";
  assert.equal(code.split(oldSecretDisplay).length-1,1,
    "T38 source-original public-roster secret display changed; STOP");
  code=code.replace(oldSecretDisplay,sourceBoundSecretDisplay);
  assert.ok(code.includes(sourceBoundSecretDisplay));
  assert.equal(code.split(oldSecretDisplay).length-1,0,
    "T38 must not keep a GM secret fallback from the public roster");
  assert.match(code,/readTownGameManagerNpcProfileCandidate\(supabase, id/);
  assert.match(code,/c34_npc_narrative_save_research_v1/);
  assert.doesNotMatch(code,/\.rpc\("is_admin",\s*\{\s*uid:/);
  return "// T36 EXACT SOURCE generated from ORIGINAL current NPC manager / T25 / T35.\n"+
    "// LOCALHOST-only, unsigned production build MUST NOT contain this page.\n"+code;
}
export function reconcileT36Route(env=process.env,{prepare=false,cleanup=false}={}){
  const enabled=t36ResearchEnabled(env);
  const pathname=path.join(root,T36_LOCAL_ROUTE);
  // Next config invokes this with neither option: validate only, NEVER write.
  // A background Next watcher must not re-create the route after teardown.
  if(!enabled){
    if(!fs.existsSync(pathname))return false;
    assert.ok(cleanup,
      "T36 refuses default-OFF startup with leftover generated NPC route");
    assert.equal(fs.readFileSync(pathname,"utf8"),makeT36Source(),
      "T36 refuses deletion of unknown/corrupted candidate route");
    fs.unlinkSync(pathname);
    return false;
  }
  const expected=makeT36Source();
  if(fs.existsSync(pathname)){
    assert.equal(fs.readFileSync(pathname,"utf8"),expected,
      "T36 refuses stale/mismatched cached manager source");
  }else{
    assert.ok(prepare,"T36 ON requires explicit --prepare before read-only Next config");
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
   reconcileT36Route({...process.env,[T36_FLAG]:"0"},{cleanup:true});
   console.log("PASS T36-ROUTE-CLEANUP: generated page absent; original /npcs still exists");
 }else {
   assert.ok(reconcileT36Route(process.env,{prepare:true}),"T36 --prepare requires explicit signed local gate");
   console.log("PASS T36-ROUTE-GENERATED: source-derived original full manager only for local research");
 }
}
