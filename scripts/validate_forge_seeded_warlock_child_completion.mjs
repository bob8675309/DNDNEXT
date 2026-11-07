#!/usr/bin/env node
// Deterministic public fixture contract ONLY; original GoTrue/JWT + PostgreSQL
// decides actual Warlock invocation eligibility and nested group enforcement.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compileSeededIdentity } from "./agents/forge_seeded_scenarios.mjs";

const FILE="scripts/fixtures/forge_seeded_warlock_child_completion_v1.json";
const SQL="scripts/fixtures/forge_warlock_child_completion_local_auth_pg17.sql";
const PINNED_SPELLS=[
 ["4dc8d2b8-40ad-4d7c-8a39-ec42f6eb513c","Chill Touch",0],
 ["47d3fd14-695b-4d54-a3fb-9c210ed59952","Eldritch Blast",0],
 ["afa6d1fa-c238-4519-bc8e-3b80a5d55f75","Armor of Agathys",1],
 ["1e4007d8-c780-4e97-af58-f273ee1c73b4","Hex",1],
 ["fabffecc-cacd-4595-85ec-dfa8b27ec9a4","Witch Bolt",1]
];
const PINNED_INVOCATIONS=[
 ["3abe1beb-5669-46a8-9743-49a47b8de126","Armor of Shadows","optional-feature:armor-of-shadows|XPHB",1,1],
 ["a0968ca9-deab-4bef-a8b0-05e11d4b3e0a","Agonizing Blast","optional-feature:agonizing-blast|XPHB",2,2],
 ["c6f61c62-d36c-4a9b-b44a-cbafd4ff47d0","Eldritch Mind","optional-feature:eldritch-mind|XPHB",3,2]
];
const exact=(x,keys,label)=>{
 assert.ok(x&&typeof x==="object"&&!Array.isArray(x),label+" must be an object");
 assert.deepEqual(Object.keys(x).sort(),[...keys].sort(),label+" source schema drift");
};
const plain=x=>JSON.parse(JSON.stringify(x));
export function readWarlockManifest(){return JSON.parse(readFileSync(FILE,"utf8"));}
export function compileWarlockChildPlans(data){
 exact(data,["schemaVersion","suite","live","cases"],"manifest");
 assert.equal(data.schemaVersion,1);
 assert.equal(data.suite,"forge-warlock-dependent-invocation-v1");
 const l=data.live;
 exact(l,["classId","classKey","classSource","level","slots","cantrips","spellsKnown","spellSlots","feature","invocations","spells"],"live source");
 assert.equal(l.classId,"6792abd0-1fd9-44fb-ae4c-56c307ab791a");
 assert.equal(l.classKey,"warlock");assert.equal(l.classSource,"XPHB");assert.equal(l.level,2);
 assert.equal(l.slots,3);assert.equal(l.cantrips,2);assert.equal(l.spellsKnown,3);
 assert.deepEqual(l.spellSlots,[2,0,0,0,0,0,0,0,0]);
 exact(l.feature,["key","name"],"feature");
 assert.equal(l.feature.key,"class:warlock:xphb::eldritch-invocation-options:xphb:1");
 assert.equal(l.feature.name,"Eldritch Invocation Options");
 assert.equal(l.invocations.length,3);
 for(let i=0;i<PINNED_INVOCATIONS.length;i++){
  const g=l.invocations[i],want=PINNED_INVOCATIONS[i];
  exact(g,i===1?["id","name","key","slot","acquisitionLevel","choiceSchema","prerequisites"]:
   ["id","name","key","slot","acquisitionLevel"],"Invocation "+i);
  assert.deepEqual([g.id,g.name,g.key,g.slot,g.acquisitionLevel],want);
  if(i===1){assert.deepEqual(g.choiceSchema,{kind:"warlock-damage-cantrip",distinctPerRepeat:true});
   assert.deepEqual(g.prerequisites,{minClassLevel:2});}
 }
 assert.equal(l.spells.length,5);
 for(let i=0;i<PINNED_SPELLS.length;i++){
  const s=l.spells[i],w=PINNED_SPELLS[i];
  exact(s,["id","name","level","source","classes","damage_types","damage_dice","ritual","range_unit","range_distance","attack_type"],"source spell");
  assert.deepEqual([s.id,s.name,s.level],w);
  assert.equal(s.source,"XPHB");
  assert.ok(s.classes.includes("Warlock"));
 }
 const blast=l.spells.find(s=>s.name==="Eldritch Blast");
 assert.equal(blast.level,0);
 assert.deepEqual(blast.classes,["Warlock"]);
 assert.deepEqual(blast.damage_types,["force"]);
 assert.equal(blast.range_unit,"feet");assert.equal(Number(blast.range_distance),120);
 assert.equal(l.spells.filter(s=>s.level===0).length,2);
 assert.equal(l.spells.filter(s=>s.level===1).length,3);
 // Inspect actual Forge source serialization; not a rendered browser acceptance.
 const forge=readFileSync("components/NewNpcModalV3.js","utf8");
 const guide=readFileSync("components/NpcForgeClassGuideModel.js","utf8");
 const registrar=readFileSync("components/NpcForgeFeatChoiceRegistrar.js","utf8");
 const invocation=readFileSync("utils/warlockInvocationChoices.js","utf8");
 const nested=readFileSync("scripts/fixtures/forge_nested_choices_original_pg17.sql","utf8");
 for(const token of [
   "const classFeatureChoices = serializeClassChoiceState(classChoiceState);",
   "const sourceChoices = serializeSourceChoiceState(sourceChoiceState);",
   "payloadWithSourceChoices(subclassPayload, choiceStateRef.current, classChoiceStateRef.current, sourceChoiceStateRef.current)",
   'supabase.rpc("create_player_character_v3"'
 ]) assert.ok(forge.includes(token),"Forge browser-to-RPC source drift: "+token);
 assert.ok(guide.includes('.filter((group) => !(invocationSourceActive && group.kind === "eldritch-invocation"))'),
  "Original client suppression of historic Invocation parent has changed");
 assert.ok(registrar.includes("buildWarlockInvocationSourceGroups") && registrar.includes('"class-options"'),
  "Warlock source-only choice registration changed");
 assert.ok(invocation.includes("child-") && invocation.includes('fieldId: "invocation", values: [invocation.key]'),
  "Warlock source-owned Invocation dependent child changed");
 assert.ok(nested.includes("v_sheet -> 'classFeatureChoices'") &&
  nested.includes("Class choice % requires its dependent selection group to be complete."),
  "Original historic nested choice validator contract changed");
 const sourceSql=readFileSync(SQL,"utf8");
 for(const s of l.spells)assert.ok(sourceSql.includes(s.id)&&sourceSql.includes(s.name),
  "missing actual source row in local SQL fixture: "+s.name);
 assert.ok(sourceSql.includes(l.invocations[1].id) && sourceSql.includes(l.feature.key));
 assert.ok(sourceSql.includes("md5(pg_get_functiondef('private.validate_player_forge_nested_choice_payload_v1()'::regprocedure)) <> 'df2861cc76b0b74bb7cd57fbe61c9a05'"));
 assert.ok(sourceSql.includes("private.xphb_warlock_invocation_count_v1(2)<>3"));
 assert.equal(data.cases.length,3);
 const modes=["complete-both-representations","missing-legacy-child-group","source-owned-browser-shape"];
 const ids=new Set();
 const cases=data.cases.map((x,i)=>{
  exact(x,["scenarioId","seed","mode"],"case");
  assert.equal(x.mode,modes[i],"Unexpected case mode");
  assert.ok(Number.isSafeInteger(x.seed)&&x.seed>=66000&&x.seed<=67000);
  assert.ok(!ids.has(x.scenarioId));ids.add(x.scenarioId);
  return {...compileSeededIdentity(x.scenarioId,x.seed),mode:x.mode};
 });
 assert.equal(new Set(cases.map(x=>x.requestId)).size,3,"All scenario identities must be distinct");
 return {schemaVersion:1,suite:data.suite,source:plain(l),cases};
}
export function loadWarlockChildPlans(){return compileWarlockChildPlans(readWarlockManifest());}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 if(process.argv.length===3&&process.argv[2]==="--emit"){
  process.stdout.write(JSON.stringify(loadWarlockChildPlans())+"\n");
 }else{
  assert.equal(process.argv.length,2);
  const exe=fileURLToPath(import.meta.url);
  const go=()=>JSON.parse(execFileSync(process.execPath,[exe,"--emit"],{encoding:"utf8",timeout:10000}));
  assert.deepEqual(go(),go(),"fresh-process seeded results differ");
  assert.deepEqual(go(),loadWarlockChildPlans());
  const current=loadWarlockChildPlans();
  assert.notEqual(current.cases[0].requestId,
   compileSeededIdentity(current.cases[0].scenarioId,current.cases[0].seed+1).requestId);
  const tampered=plain(readWarlockManifest());tampered.live.invocations[1].prerequisites.minClassLevel=1;
  assert.throws(()=>compileWarlockChildPlans(tampered),{name:"AssertionError"});
  const noChild=plain(readWarlockManifest());noChild.cases[1].skipOriginal=true;
  assert.throws(()=>compileWarlockChildPlans(noChild),{name:"AssertionError"});
  const illegal=plain(readWarlockManifest());illegal.live.spells[1].classes=["Fighter"];
  assert.throws(()=>compileWarlockChildPlans(illegal),{name:"AssertionError"});
  console.log("PASS STATIC Warlock level2 live source-verified invocation slots, Agonizing Blast prerequisite/cantrip/seed/SQL fixture and fail-closed modes");
  console.log("STATIC CONTRACT ONLY; genuine original signed v3 and both deferred validator paths required");
 }
}
