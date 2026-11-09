// P1 compiler preflight: analyze structure, NEVER execute a recipe.
// This is not a trust/approval mechanism. No actor state, dice, or DB access.
import { createHash } from "node:crypto";
import { validateSpellRecipe } from "./validateSpellRecipe.mjs";

const END = "$end";
const MAX_LOOP_DEPTH = 3;
const MAX_POTENTIAL_OPS = 256;
const successors = node => node.op === "attack"
  ? [{kind:"onHit",to:node.onHit},{kind:"onMiss",to:node.onMiss}]
  : node.op === "save"
  ? [{kind:"onSuccess",to:node.onSuccess},{kind:"onFailure",to:node.onFailure}]
  : node.op === "repeat"
  ? [{kind:"body",to:node.body},{kind:"after",to:node.after}]
  : [{kind:"next",to:node.next}];
const maximum = q => q.kind === "fixed" ? q.value
  : q.kind === "slot-level" ? q.maximum
  : Math.max(...q.tiers.map(t => t.value));

// Canonical JSON: object keys sorted, arrays retain authored order.
// This is a content fingerprint, NOT a digital signature or proof of approval.
function canonicalJson(value) {
 if (Array.isArray(value)) return "["+value.map(canonicalJson).join(",")+"]";
 if (value !== null && typeof value === "object")
  return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonicalJson(value[k])).join(",")+"}";
 return JSON.stringify(value);
}
const errResult = errors => ({ok:false, errors});
const scopeName = stack => stack.length ? "loop:"+stack.join("/") : "root";
function deepFreeze(obj) {
 if (obj !== null && typeof obj === "object" && !Object.isFrozen(obj)) {
  for (const value of Object.values(obj)) deepFreeze(value);
  Object.freeze(obj);
 }
 return obj;
}
export function preflightSpellRecipe(recipe) {
 const base = validateSpellRecipe(recipe);
 if (!base.ok) return errResult(base.errors);
 const nodes = new Map(recipe.steps.map(node => [node.id,node]));
 const owners = new Map();
 const branches = new Map();
 const loops = [];
 const errors = [];
 let maxDepth = 0;
 // A repeated body is a lexical region. Its $end returns to the enclosing
 // repeat, never to the cast root. The repeat's 'after' belongs to the
 // *parent* region. Joins are fine only inside one lexical region.
 function visit(id,stack) {
  if (id === END) return;
  const region = scopeName(stack);
  if (owners.has(id)) {
   if (owners.get(id) !== region)
    errors.push("step "+id+": cross-scope entry ("+owners.get(id)+" vs "+region+")");
   return;
  }
  owners.set(id,region);
  const node = nodes.get(id);
  if (node.op === "repeat") {
   const newStack = [...stack,node.id];
   if (newStack.length > MAX_LOOP_DEPTH)
    errors.push("repeat "+node.id+": nesting exceeds "+MAX_LOOP_DEPTH);
   maxDepth = Math.max(maxDepth,newStack.length);
   if (node.body === END) errors.push("repeat "+node.id+": empty body not permitted");
   loops.push({id:node.id,scope:region,body:node.body,after:node.after,
     maxIterations:maximum(node.count),targetPolicy:node.targetPolicy});
   visit(node.body,newStack);
   visit(node.after,stack);
  } else {
   for (const edge of successors(node)) visit(edge.to,stack);
  }
  branches.set(id,successors(node));
 }
 visit(recipe.entry,[]);
 for (const node of recipe.steps)
  if (!owners.has(node.id)) errors.push("step "+node.id+": not reachable from recipe.entry");
 if (errors.length) return errResult([...new Set(errors)]);
 // A shared rollGroup is allowed across exclusive alternatives in the same
 // region (Fireball save-for-half) but not two steps on one execution path.
 const rollRefs = new Map();
 for (const node of recipe.steps) {
  if (node.op !== "damage" && node.op !== "heal") continue;
  const group = node.rollGroup;
  if (!rollRefs.has(group)) rollRefs.set(group,[]);
  rollRefs.get(group).push(node.id);
 }
 function canReach(from,to,seen=new Set()) {
  if (from === END || seen.has(from)) return false;
  if (from === to) return true;
  seen.add(from);
  const node = nodes.get(from);
  return successors(node).some(edge => canReach(edge.to,to,seen));
 }
 for (const [group,ids] of rollRefs.entries()) {
  const regions = new Set(ids.map(id=>owners.get(id)));
  if (regions.size > 1)
   errors.push("rollGroup "+group+": used in multiple repeat scopes");
  for (let i=0;i<ids.length;i++) for (let j=i+1;j<ids.length;j++)
   if (canReach(ids[i],ids[j])||canReach(ids[j],ids[i]))
    errors.push("rollGroup "+group+": reused on the same execution path");
 }
 // Conservative potential node-visit count: branches take their worst side;
 // repeat bodies run up to their validated maximum. No model, rolls, or side
 // effects are executed. Upper bounded before any future interpreter exists.
 const memo = new Map();
 function potential(id) {
  if (id===END) return 0;
  if (memo.has(id)) return memo.get(id);
  const n=nodes.get(id);
  let cost;
  if (n.op==="repeat") cost=1+maximum(n.count)*potential(n.body)+potential(n.after);
  else if (n.op==="attack"||n.op==="save")
   cost=1+Math.max(...successors(n).map(edge=>potential(edge.to)));
  else cost=1+potential(n.next);
  memo.set(id,cost);
  return cost;
 }
 const potentialOperations = potential(recipe.entry);
 if (potentialOperations>MAX_POTENTIAL_OPS)
  errors.push("recipe: worst-case operation count "+potentialOperations+" exceeds "+MAX_POTENTIAL_OPS);
 if (errors.length) return errResult([...new Set(errors)]);
 const canonical=canonicalJson(recipe);
 const fingerprint="sha256:"+createHash("sha256").update(canonical,"utf8").digest("hex");
 const manifest={
  schemaVersion:recipe.schemaVersion,
  recipeVersion:recipe.recipeVersion,
  sourceKey:recipe.spell.key,
  ruleset:recipe.spell.ruleset,
  fingerprint,
  entry:recipe.entry,
  stepCount:recipe.steps.length,
  loopDepth:maxDepth,
  worstCaseOperations:potentialOperations,
  loops,
  steps:recipe.steps.map(node=>({
   id:node.id,op:node.op,scope:owners.get(node.id),
   edges:branches.get(node.id).map(edge=>({...edge})),
   ...((node.op==="damage"||node.op==="heal")?{
    rollGroup:node.rollGroup,
    rollScope:node.dice.rollScope,
    cachePartition:node.dice.rollScope.replace("once-per-","")
   }:{})
  })),
  // Critical: graph analysis does not grant executable status to ANY recipe.
  executable:false,
  approved:false,
  requiresServerAuthorization:true
 };
 return {ok:true,errors:[],manifest:deepFreeze(manifest)};
}
