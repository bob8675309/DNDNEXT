// DNDNext independent CI research: deterministic SOURCE-ONLY path filter proof.
// No modification of the real signed workflow, no SQL, API, map, Vercel,
// paid agent or deployment. Branch protection/required check still 403.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const file=p=>fs.readFileSync(path.join(root,p),"utf8");
const gitBlob=b=>createHash("sha1").update(
 Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])
).digest("hex");
const workflow=".github/workflows/validate-c34-joint-local-auth.yml";
const originalBytes=fs.readFileSync(path.join(root,workflow));
assert.equal(gitBlob(originalBytes),
 "9d30f81f820dda5d799ada5836a612b9276fbb1b",
 "Original signed workflow changed: inspect before modifying path proposal");
const source=originalBytes.toString("utf8");
assert.ok(source.includes("name: C34 real signed PG17 GoTrue Story nonce and inventory integration"));
assert.ok(source.includes("  workflow_dispatch:\n"),"Manual signed run missing");
assert.ok(source.includes("signed-real-original-research:"),
 "Required job name changed");
const section=(start,end)=>{
 const begin=source.indexOf(start),finish=source.indexOf(end,begin+start.length);
 assert.ok(begin>=0&&finish>begin,"Cannot source-pin event section "+start);
 return source.slice(begin+start.length,finish);
};
const pr=section("  pull_request:\n","  push:\n");
const push=section("  push:\n","  workflow_dispatch:\n");
function paths(block,event){
 assert.match(block,/    paths:\n/,"Workflow "+event+" path gate moved");
 const arr=[...block.matchAll(/^      - '([^']+)'$/gm)].map(m=>m[1]);
 assert.ok(arr.length>0,event+" paths missing");
 return arr;
}
const baseline={
 pull_request:paths(pr,"pull_request"),
 push:paths(push,"push")
};
assert.ok(baseline.pull_request.includes("scripts/integration/c34/**"));
assert.ok(baseline.push.includes("scripts/integration/c34/**"));
assert.ok(baseline.pull_request.includes(workflow));
assert.ok(baseline.push.includes(workflow));
assert.ok(!baseline.pull_request.some(x=>x.startsWith("!")));
assert.ok(!baseline.push.some(x=>x.startsWith("!")));
const target="scripts/integration/c34/test_t46_p3_p4b_c2b13_merchant_writer_census.mjs";
assert.ok(fs.existsSync(path.join(root,target)),"Census script no longer exists");
const separate=file(".github/workflows/validate-c34-c2b13-merchant-writer-census.yml");
assert.ok(separate.includes("node "+target),"Standalone Node22 census check missing");
assert.ok(separate.includes("'"+target+"'"),"Census source-only trigger missing");

function matches(glob,p){
 if(glob===p)return true;
 let s="^";
 for(let i=0;i<glob.length;i++){
  const c=glob[i];
  if(c==="*"){
   if(glob[i+1]==="*"){s+=".*";i++}
   else s+="[^/]*";
  }else if(c==="?")s+="[^/]";
  else s+= "\\.[]{}()+-^$|".includes(c)?"\\"+c:c;
 }
 return new RegExp(s+"$").test(p);
}
function matchPaths(patterns,changes){
 // Ordered path positives and !negatives. This is a bounded *model*, not
 // live required checks, GitHub PR file-list caps or actual event delivery.
 return changes.some(p=>{
  let accepted=false;
  for(const pattern of patterns){
   const negative=pattern.startsWith("!");
   const glob=negative?pattern.slice(1):pattern;
   if(matches(glob,p))accepted=!negative;
  }
  return accepted;
 });
}
const proposed=Object.fromEntries(
 Object.entries(baseline).map(([event,p])=>[event,[...p,"!"+target]]));
const cases=[
 {name:"census source only",files:[target],present:true,candidate:false},
 {name:"census plus docs only",files:[target,"docs/ACTIVE_WORK.md"],present:true,candidate:false},
 {name:"real signed B14 runner",files:[
  "scripts/integration/c34/run_t46_p3_p4b_c2b14_inventory_roles_signed.mjs"
 ],present:true,candidate:true},
 {name:"original joint fixture",files:[
  "scripts/integration/c34/test_joint_pg17_local_auth.mjs"
 ],present:true,candidate:true},
 {name:"manager source",files:["components/c34/MerchantPanelT28P2Research.jsx"],
  present:true,candidate:true,event:"pull_request"},
 {name:"SQL RLS candidate",files:[
  "sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql"
 ],present:true,candidate:true,event:"pull_request"},
 {name:"mixed census and signed",files:[
  target,"scripts/integration/c34/run_t46_p3_p4b_c2b14_inventory_roles_signed.mjs"
 ],present:true,candidate:true},
 {name:"signed workflow modified",files:[workflow],present:true,candidate:true},
 {name:"docs only",files:["docs/HANDOFF_LOG.md"],present:false,candidate:false}
];
for(const ev of ["push","pull_request"]){
 for(const c of cases){
  if(c.event&&c.event!==ev)continue;
  const prior=matchPaths(baseline[ev],c.files);
  const newer=matchPaths(proposed[ev],c.files);
  assert.equal(prior,c.present,ev+" current "+c.name);
  assert.equal(newer,c.candidate,ev+" proposed "+c.name);
  assert.ok(!c.candidate||prior,ev+" new trigger "+c.name);
  console.log("PASS C34-CI-FILTER "+ev+" "+c.name+": current="+prior+" proposed="+newer);
 }
}
assert.ok(source.includes("  workflow_dispatch:\n")&&
 !proposed.push.includes("!"+workflow),"Manual run must remain possible");
console.log("PASS C34-CI-FILTER-MANUAL: workflow_dispatch remains available");
console.log("PASS C34-CI-FILTER-RED: original broad C34/** triggers standalone Node22 census");
console.log("PASS C34-CI-FILTER-GREEN: narrow exclusion proposal filters census-only and preserves signed/SQL/mixed");
console.log("C34-CI-FILTER-EVIDENCE "+JSON.stringify({
 workflowSha:"9d30f81f820dda5d799ada5836a612b9276fbb1b",
 current:{prPathCount:baseline.pull_request.length,pushPathCount:baseline.push.length},
 proposed:{prPathCount:proposed.pull_request.length,pushPathCount:proposed.push.length,
  singleExclusion:"!"+target},
 note:"PROPOSAL only; required check policy unverified 403, no signed workflow edited"
}));
