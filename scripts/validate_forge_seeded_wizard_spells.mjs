#!/usr/bin/env node
// FREE STATIC seed/schema guard only. Genuine legality is decided by the
// original source-original SQL + real local signed-in GoTrue/PostgREST tests.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compileSeededIdentity } from "./agents/forge_seeded_scenarios.mjs";

export const WIZARD_MANIFEST_PATH = "scripts/fixtures/forge_seeded_wizard_spells_v1.json";
const WIZARD_LOCAL_SQL_PATH = "scripts/fixtures/forge_wizard_starting_spells_local_auth_pg17.sql";
const SOURCE_XPHB_WIZARD_ID = "2995248c-c199-4f44-a400-06ae30d4ec8b";
const EXPECTED_COUNTS = {cantrips:3,leveled:6,prepared:4,spellSlots:[2,0,0,0,0,0,0,0,0]};
// Individually source-verified (read-only live public.spells_catalog 2026-11-06).
// Only fixture IDs/names/levels are pinned here; the manifest carries the
// class membership arrays exactly as selected live and the SQL fixture checks them.
const SPELLS = [
 ["fe27551a-bebb-4140-8dc0-2ab904f99955","Fire Bolt",0],
 ["4b84d266-3847-45f9-b154-77fd26695b55","Mage Hand",0],
 ["38ccd26c-f6dc-4bcc-a86d-dc83fb61f177","Ray of Frost",0],
 ["d05171bc-855f-4e03-a074-c3f8f6fc09bf","Detect Magic",1],
 ["6c7a0380-a32a-4df5-871c-abf42400b045","Feather Fall",1],
 ["c9803497-bd5c-4800-aa79-01dbb80922fe","Mage Armor",1],
 ["b975c0a7-8b4d-439b-85ff-3e0094656e2f","Magic Missile",1],
 ["4d757f8f-88fd-4b6a-9bf2-b6d20788f928","Shield",1],
 ["0fec723c-1a3a-42d9-bdfb-1d338c745676","Sleep",1]
];
const EXPLICIT_PREPARED = ["Detect Magic","Mage Armor","Magic Missile","Shield"];
const known = (row,keys,label) => {
 assert.ok(row && typeof row==="object" && !Array.isArray(row),label+" must be object");
 assert.deepEqual(Object.keys(row).sort(),keys.slice().sort(),label+" changed");
};
const json = (x)=>JSON.parse(JSON.stringify(x));
export function readWizardManifest() {
 return JSON.parse(readFileSync(WIZARD_MANIFEST_PATH,"utf8"));
}
export function compileWizardPlans(input) {
 known(input,["schemaVersion","suite","wizard","spells","preparedSpellNames","scenarios"],"wizard manifest");
 assert.equal(input.schemaVersion,1);
 assert.equal(input.suite,"forge-xphb-wizard-starting-spells-v1");
 const source=input.wizard;
 known(source,["liveClassId","classKey","classSource","classLevel","spellcastingAbility","expected"],"wizard source");
 assert.equal(source.liveClassId,SOURCE_XPHB_WIZARD_ID);
 assert.equal(source.classKey,"wizard");assert.equal(source.classSource,"XPHB");
 assert.equal(source.classLevel,1);assert.equal(source.spellcastingAbility,"int");
 known(source.expected,["cantrips","leveled","prepared","spellSlots"],"counts");
 assert.deepEqual(source.expected,EXPECTED_COUNTS);
 assert.ok(Array.isArray(input.spells)&&input.spells.length===SPELLS.length);
 assert.deepEqual(input.preparedSpellNames,EXPLICIT_PREPARED);
 assert.equal(new Set(input.spells.map(s=>s.id)).size,9);
 assert.equal(new Set(input.spells.map(s=>s.name)).size,9);
 const localSQL=readFileSync(WIZARD_LOCAL_SQL_PATH,"utf8");
 for (let i=0;i<SPELLS.length;i++) {
  const spell=input.spells[i], pinned=SPELLS[i];
  known(spell,["id","name","level","source","classes"],"source spell "+i);
  assert.deepEqual([spell.id,spell.name,spell.level],pinned,"live spell identity/level drift");
  assert.equal(spell.source,"XPHB");
  assert.ok(Array.isArray(spell.classes)&&spell.classes.includes("Wizard"),
   "live source class membership missing for "+spell.name);
  assert.equal(new Set(spell.classes).size,spell.classes.length);
  const sqlRow="('"+spell.id+"','"+spell.name+"',"+spell.level+",ARRAY["+
    spell.classes.map(x=>"'"+x+"'").join(",")+"]::text[],'"+spell.source+"')";
  assert.ok(localSQL.includes(sqlRow),"local SQL source catalog drift for "+spell.name);
 }
 assert.equal(input.spells.filter(x=>x.level===0).length,source.expected.cantrips);
 assert.equal(input.spells.filter(x=>x.level===1).length,source.expected.leveled);
 assert.deepEqual(input.preparedSpellNames.filter(x=>input.spells.some(s=>s.name===x && s.level===1)),
  EXPLICIT_PREPARED,"prepared spell choices must be legal level-1 Wizard rows");
 assert.ok(Array.isArray(input.scenarios)&&input.scenarios.length===2);
 const modes=["complete","underprepared"];
 const ids=new Set(),nonces=new Set();
 const scenarios=input.scenarios.map((row,index)=>{
  known(row,["scenarioId","seed","mode"],"wizard scenario");
  assert.equal(row.mode,modes[index]);
  assert.ok(Number.isSafeInteger(row.seed)&&row.seed>=63000&&row.seed<=68000);
  assert.ok(!ids.has(row.scenarioId),"duplicate scenario");
  ids.add(row.scenarioId);
  const compiled=compileSeededIdentity(row.scenarioId,row.seed);
  assert.ok(!nonces.has(compiled.requestId),"duplicate nonce");
  nonces.add(compiled.requestId);
  return {...compiled,mode:row.mode};
 });
 return {
  schemaVersion:input.schemaVersion,suite:input.suite,
  source:json(source),spells:json(input.spells),
  preparedSpellNames:json(input.preparedSpellNames),
  cases:scenarios
 };
}
export function loadWizardPlans() {
 return compileWizardPlans(readWizardManifest());
}
if(process.argv[1] && fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) {
 if(process.argv.length===3 && process.argv[2]==="--emit") {
  process.stdout.write(JSON.stringify(loadWizardPlans())+"\n");
 }else{
  assert.equal(process.argv.length,2,"Use --emit or no arguments");
  const exe=fileURLToPath(import.meta.url);
  const run=()=>JSON.parse(execFileSync(process.execPath,[exe,"--emit"],{
   encoding:"utf8",maxBuffer:500000,timeout:10000
  }));
  const once=run(),twice=run();
  assert.deepEqual(once,twice,"two fresh processes changed source identities/seeds");
  assert.deepEqual(once,loadWizardPlans(),"CLI/module mismatch");
  assert.notEqual(once.cases[0].requestId,once.cases[1].requestId);
  assert.notEqual(once.cases[0].requestId,
    compileSeededIdentity(once.cases[0].scenarioId,once.cases[0].seed+1).requestId);
  const incorrect=json(readWizardManifest());
  incorrect.wizard.expected.prepared=3;
  assert.throws(()=>compileWizardPlans(incorrect),{name:"AssertionError"});
  const altered=json(readWizardManifest());
  altered.spells[0].id="00000000-0000-0000-0000-000000000000";
  assert.throws(()=>compileWizardPlans(altered),{name:"AssertionError"});
  const bypass=json(readWizardManifest());
  bypass.scenarios[1].skipSourceValidator=true;
  assert.throws(()=>compileWizardPlans(bypass),{name:"AssertionError"});
  const unknown=json(readWizardManifest());
  unknown.spells[0].classes=["Fighter"];
  assert.throws(()=>compileWizardPlans(unknown),{name:"AssertionError"});
  console.log("PASS STATIC Wizard 2024 XPHB source-count/canonical spell seeds, two-process repeatability, fail-closed catalog/role/options and SQL fixture alignment");
  console.log("OFFLINE CONTRACT ONLY; signed-in original PostgreSQL validator and transaction rollback are separately required");
 }
}
