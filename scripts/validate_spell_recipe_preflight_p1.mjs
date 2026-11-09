import assert from "node:assert/strict";
import fs from "node:fs";
import { preflightSpellRecipe } from "../utils/spellRecipes/preflightSpellRecipe.mjs";
import { validateSpellRecipe } from "../utils/spellRecipes/validateSpellRecipe.mjs";
import { P1_SYNTHETIC_RECIPES } from "./fixtures/spell_recipe_p1_examples.mjs";

const copy=structuredClone;
const byKey=key=>copy(P1_SYNTHETIC_RECIPES.find(r=>r.spell.key===key+"|XPHB"));
const expectError=(title,recipe,needle)=>{
 const base=validateSpellRecipe(recipe);
 assert.equal(base.ok,true,title+": must reach preflight rather than fail the schema: "+JSON.stringify(base.errors));
 const result=preflightSpellRecipe(recipe);
 assert.equal(result.ok,false,title+": unexpected preflight acceptance");
 assert.ok(result.errors.some(e=>e.includes(needle)),title+": "+JSON.stringify(result.errors));
};
for (const sample of P1_SYNTHETIC_RECIPES) {
 const result=preflightSpellRecipe(copy(sample));
 assert.equal(result.ok,true,sample.spell.key+": "+JSON.stringify(result.errors));
 assert.equal(result.manifest.approved,false);
 assert.equal(result.manifest.executable,false);
 assert.equal(result.manifest.requiresServerAuthorization,true);
 assert.equal(result.manifest.sourceKey,sample.spell.key);
 assert.ok(/^sha256:[a-f0-9]{64}$/.test(result.manifest.fingerprint));
 assert.ok(result.manifest.worstCaseOperations<256);
 assert.equal(result.manifest.stepCount,sample.steps.length);
 assert.equal(result.manifest.steps.length,sample.steps.length);
}
const ice=preflightSpellRecipe(byKey("ice-knife"));
assert.equal(ice.ok,true);
assert.equal(ice.manifest.steps.find(x=>x.id==="explosion").scope,"root");
const eb=preflightSpellRecipe(byKey("eldritch-blast"));
assert.deepEqual(eb.manifest.loops.map(x=>x.id),["beam-loop"]);
assert.equal(eb.manifest.steps.find(x=>x.id==="damage").scope,"loop:beam-loop");
assert.equal(eb.manifest.loops[0].maxIterations,4);
assert.equal(eb.manifest.worstCaseOperations,9);
assert.equal(eb.manifest.steps.find(x=>x.id==="damage").cachePartition,"attack");
const missile=preflightSpellRecipe(byKey("magic-missile"));
assert.equal(missile.manifest.steps.find(x=>x.id==="damage").cachePartition,"projectile");
assert.equal(missile.manifest.loops[0].maxIterations,11);
const fireball=preflightSpellRecipe(byKey("fireball"));
assert.equal(fireball.ok,true);
assert.equal(Object.isFrozen(fireball.manifest),true);
assert.equal(Object.isFrozen(fireball.manifest.steps),true);
assert.equal(Object.isFrozen(fireball.manifest.steps[0].edges),true);
assert.throws(()=>{fireball.manifest.steps[0].scope="tampered";},TypeError);
assert.deepEqual(fireball.manifest.steps.filter(x=>x.rollGroup==="fireball-shared-dice").map(x=>x.id),["full","half"]);
assert.equal(fireball.manifest.steps.find(x=>x.id==="half").cachePartition,"cast");

// Canonical source identity and stable hash ignore JavaScript object key order,
// not ordered execution steps. Hashes are not cryptographic signatures.
function backwardsKeys(v){
 if(Array.isArray(v))return v.map(backwardsKeys);
 if(v && typeof v==="object")return Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,backwardsKeys(x)]));
 return v;
}
const original=byKey("fire-bolt");
const shuffled=backwardsKeys(original);
assert.equal(preflightSpellRecipe(shuffled).manifest.fingerprint,preflightSpellRecipe(original).manifest.fingerprint);
const changedVersion=copy(original);
changedVersion.recipeVersion=2;
assert.notEqual(preflightSpellRecipe(changedVersion).manifest.fingerprint,preflightSpellRecipe(original).manifest.fingerprint);
const changedDice=copy(original);
changedDice.steps[1].flatBonus=1;
assert.notEqual(preflightSpellRecipe(changedDice).manifest.fingerprint,preflightSpellRecipe(original).manifest.fingerprint);
assert.equal(preflightSpellRecipe({...original,arbitrarySQL:"DROP TABLE"}).ok,false);

// Basic same-scope join is allowed, but a repeated body's nodes must not
// be reachable from its parent's after step.
const afterIntrusion=byKey("eldritch-blast");
afterIntrusion.steps[0].after="damage";
expectError("loop after reenters body",afterIntrusion,"cross-scope entry");
const mixedEntry=byKey("eldritch-blast");
mixedEntry.steps[0].after="outside";
mixedEntry.steps[2].next="outside";
mixedEntry.steps.push({
 ...copy(mixedEntry.steps[2]),id:"outside",rollGroup:"other-force",next:"$end"
});
expectError("body flows into parent's after",mixedEntry,"cross-scope entry");
const sameRollDifferentScope=byKey("eldritch-blast");
sameRollDifferentScope.steps[0].after="outside";
sameRollDifferentScope.steps.push({
 ...copy(sameRollDifferentScope.steps[2]),id:"outside",next:"$end"
});
expectError("repetition leaks shared roll group",sameRollDifferentScope,"multiple repeat scopes");

// Same rollGroup along one possible sequential path would use a cached die
// twice; only exclusive alternative branches may share a group in P1.
const duplicateSequential=byKey("fire-bolt");
duplicateSequential.steps[1].next="again";
duplicateSequential.steps.push({...copy(duplicateSequential.steps[1]),id:"again",next:"$end"});
expectError("reuse same cached damage on path",duplicateSequential,"same execution path");

// Two nested repeats are structurally bounded; a fourth is rejected.
const nested=byKey("eldritch-blast");
nested.steps.splice(1,0,{
 id:"inner",op:"repeat",count:{kind:"fixed",value:2},
 targetPolicy:"may-repeat",body:"attack",after:"$end"
});
nested.steps[0].body="inner";
const goodNested=preflightSpellRecipe(nested);
assert.equal(goodNested.ok,true,JSON.stringify(goodNested.errors));
assert.equal(goodNested.manifest.loopDepth,2);
assert.equal(goodNested.manifest.steps.find(x=>x.id==="attack").scope,"loop:beam-loop/inner");

const tooDeep=copy(nested);
for(let i=1;i<=2;i++){
 const outerName=i===1?"inner":"inner-two";
 const nextName=i===1?"inner-two":"inner-three";
 const index=tooDeep.steps.findIndex(s=>s.id===outerName);
 tooDeep.steps[index].body=nextName;
 tooDeep.steps.splice(index+1,0,{
  id:nextName,op:"repeat",count:{kind:"fixed",value:2},
  targetPolicy:"may-repeat",body:i===1?"attack":"attack",after:"$end"
 });
}
expectError("unbounded nesting across four loops",tooDeep,"nesting exceeds");
const explosive=byKey("eldritch-blast");
explosive.steps.splice(1,0,{
 id:"inner",op:"repeat",count:{kind:"fixed",value:16},
 targetPolicy:"may-repeat",body:"attack",after:"$end"
});
explosive.steps[0].body="inner";
explosive.steps[0].count={kind:"fixed",value:16};
expectError("worst-case node budget",explosive,"worst-case operation count");

const source=fs.readFileSync("utils/spellRecipes/preflightSpellRecipe.mjs","utf8");
for(const forbidden of ["supabase.rpc(","createClient(","eval(","new Function(","fetch(","execSync(","security definer","service_role"]){
 assert.equal(source.includes(forbidden),false,"preflight unexpectedly has authority: "+forbidden);
}
console.log("PASS P1 compiler preflight: 12 shape examples, scoped loops and branch joins, same-path rollGroup protections, bounded operations, stable SHA-256 fingerprints, no executor");
