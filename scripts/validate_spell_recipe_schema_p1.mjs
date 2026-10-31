// P1 pure schema contract regression. Runs with Node only; no DB/network.
import assert from "node:assert/strict";
import fs from "node:fs";
import {validateSpellRecipe,SPELL_RECIPE_SCHEMA_VERSION}
 from "../utils/spellRecipes/validateSpellRecipe.mjs";
import {P1_SYNTHETIC_RECIPES}
 from "./fixtures/spell_recipe_p1_examples.mjs";

const valid=recipe=>validateSpellRecipe(recipe);
const clone=o=>structuredClone(o);
function reject(name,mutation,match){
 const r=clone(P1_SYNTHETIC_RECIPES[0]);mutation(r);
 const result=valid(r);
 assert.equal(result.ok,false,name+" unexpectedly accepted");
 assert.ok(result.errors.some(x=>x.includes(match)),name+": "+JSON.stringify(result.errors));
}
assert.equal(SPELL_RECIPE_SCHEMA_VERSION,1);
assert.equal(P1_SYNTHETIC_RECIPES.length,12);
const expected=[
 "fire-bolt|XPHB","sacred-flame|XPHB","eldritch-blast|XPHB",
 "scorching-ray|XPHB","magic-missile|XPHB","ice-knife|XPHB",
 "fireball|XPHB","word-of-radiance|XPHB","burning-hands|XPHB",
 "lightning-bolt|XPHB","acid-splash|XPHB","healing-word|XPHB"
];
assert.deepEqual(P1_SYNTHETIC_RECIPES.map(x=>x.spell.key),expected);
for(const r of P1_SYNTHETIC_RECIPES){
 const result=valid(r);
 assert.equal(result.ok,true,r.spell.key+" "+JSON.stringify(result.errors));
 assert.equal(result.summary.executable,false);
 assert.equal(result.summary.requiresServerAuthorization,true);
 assert.ok(result.summary.stepCount>0);
 assert.ok(!Object.keys(result.summary).some(k=>/rpc|damageResult|authorize/i.test(k)));
}
const fireball=P1_SYNTHETIC_RECIPES.find(x=>x.spell.key==="fireball|XPHB");
assert.equal(fireball.steps.find(x=>x.id==="full").dice.rollScope,"once-per-cast");
assert.equal(fireball.steps.find(x=>x.id==="full").rollGroup,fireball.steps.find(x=>x.id==="half").rollGroup);
assert.equal(fireball.steps.find(x=>x.id==="half").fraction,"half");
const eb=P1_SYNTHETIC_RECIPES.find(x=>x.spell.key==="eldritch-blast|XPHB");
assert.equal(eb.steps[0].count.kind,"character-level-tiers");
assert.equal(eb.steps[2].dice.rollScope,"once-per-attack");
const missile=P1_SYNTHETIC_RECIPES.find(x=>x.spell.key==="magic-missile|XPHB");
assert.equal(missile.steps[0].count.kind,"slot-level");
assert.equal(missile.steps[1].op,"auto-hit");
const ice=P1_SYNTHETIC_RECIPES.find(x=>x.spell.key==="ice-knife|XPHB");
assert.equal(ice.steps[0].onMiss,"explosion");
assert.equal(ice.steps[1].next,"explosion");
assert.equal(ice.steps[2].center,"impact-hex");

// Security: unsafe/malformed objects never become executable or authorized.
reject("wrong version",r=>r.schemaVersion=2,"schemaVersion");
reject("arbitrary top field",r=>r.exec="drop table","unknown field exec");
reject("arbitrary nested field",r=>r.steps[0].sql="select *","unknown field sql");
reject("unknown execution primitive",r=>r.steps[0].op="eval-js","unrecognized operation");
reject("script instruction in leaf",r=>r.steps[1].command="rm -rf","unknown field command");
reject("unqualified spell",r=>r.spell.key="fire-bolt","source-qualified");
reject("2014 source",r=>r.spell.key="fire-bolt|PHB","source-qualified");
reject("source impersonation",r=>r.spell.ruleset="2014","ruleset");
reject("unknown resource",r=>r.cost.resource.kind="free-spell-slots","unsupported");
reject("cantrip with slot",r=>r.cost.resource={kind:"spell-slot",minimumLevel:1},"cantrip");
reject("negative targets",r=>r.targeting.maxTargets=-2,"maxTargets");
reject("unsafe range",r=>r.targeting.rangeFeet=1000000,"rangeFeet");
reject("non-grid range",r=>r.targeting.rangeFeet=17,"rangeFeet");
reject("non-bool target repeat",r=>r.targeting.allowRepeatedTargets="yes","allowRepeatedTargets");
reject("invalid target geometry",r=>r.targeting.geometry={shape:"cone"},"lengthFeet");
reject("unknown area shape",r=>r.targeting.geometry={shape:"hexagon"},"unknown geometry");
reject("missing attack branch",r=>delete r.steps[0].onMiss,"unresolved step reference");
reject("dangling edge",r=>r.steps[0].onHit="phantom","unresolved step reference");
reject("non-forward self loop",r=>r.steps[0].onMiss="attack","non-forward edge");
reject("duplicate step ID",r=>r.steps[1].id="attack","duplicate ID");
reject("unreachable",r=>{r.steps[0].onHit="$end";},"unreachable node");
reject("forbidden roll group",r=>r.steps[1].rollGroup="; rm -rf","rollGroup");
reject("missing fraction",r=>delete r.steps[1].fraction,"fraction");
reject("unsupported die",r=>r.steps[1].dice.sides=100,"die size");
reject("unsupported roll scope",r=>r.steps[1].dice.rollScope="each-npc-secret","roll scope");
reject("unbounded dice",r=>r.steps[1].dice.quantity.tiers[0].value=10000,"invalid or unordered tier");
reject("invalid tier",r=>r.steps[1].dice.quantity.tiers[1].minLevel=1,"invalid or unordered tier");
reject("unknown quantity kind",r=>r.steps[1].dice.quantity.kind="prompt","unsupported quantity");
reject("forged JavaScript",r=>r.steps[1].dice.quantity.value=()=>1,"non-JSON");
reject("function field",r=>r.custom=()=>9,"non-JSON");
reject("prototype class",r=>r.spell=new Date(),"non-JSON");
reject("too many steps",r=>r.steps=Array.from({length:33},(_,i)=>({...r.steps[0],id:"a"+i})),"require 1-32");
reject("bad cost at high level",r=>{r.spell.level=3;r.cost.resource={kind:"spell-slot",minimumLevel:2};},"slot minimum");

// Validate conditional branches preserve the same cached roll identity.
const mismatch=clone(fireball);
mismatch.steps.find(x=>x.id==="half").dice.quantity.value=9;
const nonShared=valid(mismatch);
assert.equal(nonShared.ok,false);
assert.ok(nonShared.errors.some(x=>x.includes("rollGroup must keep identical")));
const loop=clone(eb);
loop.steps[0].count={kind:"fixed",value:100};
assert.equal(valid(loop).ok,false);
const unknownOperation=clone(ice);
unknownOperation.steps[2].op="summon";
assert.equal(valid(unknownOperation).ok,false);
const wrongArea=clone(fireball);
wrongArea.targeting.mode="creature";
wrongArea.targeting.cover="attack-ac";
wrongArea.targeting.geometry={shape:"nonsensical"};
assert.equal(valid(wrongArea).ok,false);
const cyclic=clone(fireball);cyclic.self=cyclic;
const cyclicResult=valid(cyclic);
assert.equal(cyclicResult.ok,false);
assert.ok(cyclicResult.errors.some(x=>x.includes("cyclic")));
const prototypePayload=Object.create({evil:true});
prototypePayload.schemaVersion=1;
assert.equal(valid(prototypePayload).ok,false);

// Must not add a runtime cast path, infer rules or grant data API permission.
const code=fs.readFileSync("utils/spellRecipes/validateSpellRecipe.mjs","utf8");
for(const forbidden of ["supabase.rpc(","from(\"encounter","fetch(","eval(","new Function(","execSync(","createClient(","service_role","security definer"]){
 assert.ok(!code.includes(forbidden),"Forbidden runtime executor found in pure schema validator: "+forbidden);
}
const fixtureText=fs.readFileSync("scripts/fixtures/spell_recipe_p1_examples.mjs","utf8");
assert.ok(fixtureText.includes("Synthetic Phase P1 schema examples ONLY"));
console.log("PASS P1 closed schema validation: "+P1_SYNTHETIC_RECIPES.length+" synthetic spell families, 34+ invalid inputs, no network/DB/cast authority");
