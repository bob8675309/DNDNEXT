#!/usr/bin/env node
// Pure manifest compiler/seed validation. Not a substitute for original PG17.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compileSeededIdentity } from "./agents/forge_seeded_scenarios.mjs";

export const NESTED_MANIFEST="scripts/fixtures/forge_seeded_nested_choices_v1.json";
const SOURCE={
 classKey:"fighter",classSource:"XPHB",level:1,
 groupId:"fightingStyle",groupKind:"fighting-style",
 selectionName:"Defense",selectionKey:"defense",selectionSource:"XPHB",
 liveDefenseOptionId:"91495e0f-0dcc-49ea-89ee-075cb182c64e",
 missingParentOptionName:"Agonizing Blast",
 missingParentOptionClass:"warlock",missingParentOptionSource:"XPHB"
};
const keys=(item,fields,label)=>{
 assert.ok(item&&typeof item==="object"&&!Array.isArray(item),label+" must be a plain object");
 assert.deepEqual(Object.keys(item).sort(),[...fields].sort(),label+" unknown/missing fields");
};
const plain=x=>JSON.parse(JSON.stringify(x));
export function compileNestedPlans(input) {
 keys(input,["schemaVersion","suite","originalHandlerMd5","originalNormalizationMd5","source","cases"],"manifest");
 assert.equal(input.schemaVersion,1);
 assert.equal(input.suite,"forge-original-nested-choice-dependency-v1");
 assert.equal(input.originalHandlerMd5,"df2861cc76b0b74bb7cd57fbe61c9a05");
 assert.equal(input.originalNormalizationMd5,"dd8cdd5b47efe99b1cfff9c2bf7635dd");
 keys(input.source,Object.keys(SOURCE),"source");
 assert.deepEqual(input.source,SOURCE,"No synthetic Fighter class permission/parent option");
 assert.ok(Array.isArray(input.cases)&&input.cases.length===2);
 const modes=["valid-base-fighting-style","missing-parent-active-when"],seen=new Set();
 const cases=input.cases.map((item,i)=>{
  keys(item,["scenarioId","seed","mode"],"scenario");
  assert.equal(item.mode,modes[i],"Unreviewed behavioral mode");
  assert.ok(Number.isSafeInteger(item.seed)&&item.seed>=65000&&item.seed<=66000);
  assert.ok(!seen.has(item.scenarioId),"Duplicate fixture identity");
  seen.add(item.scenarioId);
  return {...compileSeededIdentity(item.scenarioId,item.seed),mode:item.mode};
 });
 assert.notEqual(cases[0].requestId,cases[1].requestId);
 return {schemaVersion:1,suite:input.suite,source:plain(input.source),cases};
}
export function loadNestedPlans(){
 return compileNestedPlans(JSON.parse(readFileSync(NESTED_MANIFEST,"utf8")));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 if(process.argv.length===3&&process.argv[2]==="--emit"){
  process.stdout.write(JSON.stringify(loadNestedPlans())+"\n");
 }else{
  assert.equal(process.argv.length,2,"Only --emit or no arguments");
  const exe=fileURLToPath(import.meta.url);
  const go=()=>JSON.parse(execFileSync(process.execPath,[exe,"--emit"],{encoding:"utf8",timeout:10000}));
  assert.deepEqual(go(),go(),"Fresh processes disagree on deterministic request seeds");
  const plans=loadNestedPlans();
  assert.deepEqual(go(),plans);
  assert.notEqual(plans.cases[0].requestId,
   compileSeededIdentity(plans.cases[0].scenarioId,plans.cases[0].seed+1).requestId);
  const bad=plain(JSON.parse(readFileSync(NESTED_MANIFEST,"utf8")));
  bad.source.missingParentOptionName="Defense";
  assert.throws(()=>compileNestedPlans(bad),{name:"AssertionError"});
  const bypass=plain(JSON.parse(readFileSync(NESTED_MANIFEST,"utf8")));
  bypass.cases[1].bypassOriginal=true;
  assert.throws(()=>compileNestedPlans(bypass),{name:"AssertionError"});
  const drift=plain(JSON.parse(readFileSync(NESTED_MANIFEST,"utf8")));
  drift.originalHandlerMd5="00000000000000000000000000000000";
  assert.throws(()=>compileNestedPlans(drift),{name:"AssertionError"});
  console.log("PASS STATIC source-pinned nested-choice 2-case deterministic seed manifest, fresh-process equality and fail-closed modes");
  console.log("STATIC ONLY: signed original v2 + deferred source original PG17 validation still required");
 }
}
