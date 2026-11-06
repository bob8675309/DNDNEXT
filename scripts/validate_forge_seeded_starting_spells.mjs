#!/usr/bin/env node
// Offline plan/schema only, not source-original or real authenticated acceptance.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compileScenario, loadManifest } from "./agents/forge_seeded_scenarios.mjs";

export const STARTING_SPELL_MANIFEST = "scripts/fixtures/forge_seeded_starting_spells_v1.json";
const modes = ["legal-empty-magic-v2","invalid-magic-array-v2","invalid-noncaster-spell-v2"];
export function compileStartingSpellPlans(source) {
  assert.deepEqual(Object.keys(source).sort(), ["scenarios","schemaVersion","suite"]);
  assert.equal(source.schemaVersion,1);
  assert.equal(source.suite,"forge-original-starting-spells-v1");
  assert.ok(Array.isArray(source.scenarios) && source.scenarios.length===modes.length);
  const old = loadManifest().scenarios[0];
  const ids = new Set();
  return source.scenarios.map((row,index)=>{
    assert.deepEqual(Object.keys(row).sort(),["mode","scenarioId","seed"]);
    assert.equal(row.mode,modes[index],"First-source slice only");
    assert.match(row.scenarioId,/^[a-z][a-z0-9-]{5,63}$/);
    assert.ok(Number.isSafeInteger(row.seed)&&row.seed>=60000&&row.seed<=70000);
    assert.ok(!ids.has(row.scenarioId),"Duplicate ID");
    ids.add(row.scenarioId);
    const compiled=compileScenario({...old,scenarioId:row.scenarioId,seed:row.seed});
    assert.equal(compiled.source.subclassSource,"XPHB");
    assert.equal(compiled.source.classKey,"fighter");
    assert.equal(compiled.rpc,"create_player_character_v2");
    return {...compiled,mode:row.mode};
  });
}
export function loadStartingSpellPlans() {
  return compileStartingSpellPlans(JSON.parse(readFileSync(STARTING_SPELL_MANIFEST,"utf8")));
}
if (process.argv[1] && process.argv[1].endsWith("validate_forge_seeded_starting_spells.mjs")) {
 const input=JSON.parse(readFileSync(STARTING_SPELL_MANIFEST,"utf8"));
 const first=compileStartingSpellPlans(input),second=compileStartingSpellPlans(input);
 assert.deepEqual(first,second);
 assert.equal(new Set(first.map(x=>x.requestId)).size,3);
 assert.equal(new Set(first.map(x=>x.invalidRequestId)).size,3);
 assert.notEqual(compileScenario({...loadManifest().scenarios[0],scenarioId:first[0].scenarioId,seed:first[0].seed+1}).requestId,first[0].requestId);
 const wrong=structuredClone(input);
 wrong.scenarios[1].mode="skip-auth";
 assert.throws(()=>compileStartingSpellPlans(wrong),/First-source slice only/);
 const sourceDrift=structuredClone(input);
 sourceDrift.scenarios[0].unexpectedCantrip="Fire Bolt";
 assert.throws(()=>compileStartingSpellPlans(sourceDrift),{name:"AssertionError"});
 console.log("PASS STATIC source-pinned J154+ seeded Fighter starting-spell scenario contract, 3 distinct seeds, no arbitrary rule/role variants");
 console.log("STATIC ONLY: genuine original deferred PostgreSQL handler plus signed GoTrue v2 RPC required");
}
