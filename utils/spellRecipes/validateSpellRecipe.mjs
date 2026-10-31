// Phase P1: bounded, data-only tactical spell recipe contract.
// This module DOES NOT authorize a spell, execute dice, infer 5e rules, grant
// source features, or write game state. Treat recipes as reviewed metadata.
export const SPELL_RECIPE_SCHEMA_VERSION = 1;
const MAX_STEPS = 32;
const MAX_NESTING = 12;
const MAX_REPETITIONS = 16;
const END = "$end";
const abilities = ["str","dex","con","int","wis","cha"];
const damageTypes = ["acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder"];
const diceSides = [4,6,8,10,12,20];
const shapes = ["single","sphere","cone","line","emanation","cube"];
const operations = ["attack","save","damage","heal","area","repeat","auto-hit"];
const ALLOWED = Object.freeze({
 root:["schemaVersion","recipeVersion","spell","cost","targeting","entry","steps"],
 spell:["key","ruleset","level"],
 cost:["action","resource"],
 resource:["kind","minimumLevel"],
 targeting:["mode","origin","rangeFeet","lineOfSight","cover","geometry","maxTargets","allowRepeatedTargets"],
 geometry:["shape","radiusFeet","lengthFeet","widthFeet"],
 step:["id","op"],
 attack:["id","op","attackType","target","onHit","onMiss"],
 save:["id","op","ability","target","onSuccess","onFailure"],
 damage:["id","op","damageType","dice","flatBonus","fraction","rollGroup","next"],
 heal:["id","op","dice","flatBonus","rollGroup","next"],
 area:["id","op","center","geometry","next"],
 repeat:["id","op","count","targetPolicy","body","after"],
 "auto-hit":["id","op","target","next"],
 dice:["quantity","sides","rollScope"],
 quantity:["kind","value","tiers","base","atSlotLevel","perSlotLevel","maximum"],
 tier:["minLevel","value"]
});
const oneOf = (value,options)=>options.includes(value);
const intBetween = (v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const isRecord = v=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const isPlainPrimitive = v=>v===null || ["boolean","string","number"].includes(typeof v);
function inspectData(value,where,errors,seen=new WeakSet(),depth=0){
 if(depth>MAX_NESTING){errors.push(where+": nesting exceeds "+MAX_NESTING);return;}
 if(isPlainPrimitive(value)){if(typeof value==="number"&&!Number.isFinite(value))errors.push(where+": numeric value must be finite");return;}
 if(typeof value!=="object"||value===null||(!Array.isArray(value)&&!isRecord(value))){errors.push(where+": non-JSON or non-plain object");return;}
 if(seen.has(value)){errors.push(where+": cyclic or shared object references are forbidden");return;}
 seen.add(value);
 const entries=Array.isArray(value)?value:Object.values(value);
 if(entries.length>64){errors.push(where+": too many entries");return;}
 for(const [i,item] of entries.entries())inspectData(item,where+"."+i,errors,seen,depth+1);
}
function keys(value,allow,where,errors){
 if(!isRecord(value)){errors.push(where+": expected object");return false;}
 for(const key of Object.keys(value))if(!ALLOWED[allow].includes(key))errors.push(where+": unknown field "+key);
 return true;
}
function positiveFeet(value,where,errors,max=1200){
 if(!intBetween(value,0,max)||value%5!==0)errors.push(where+": expected 5-ft increment from 0 to "+max);
}
function geometry(g,where,errors){
 if(!keys(g,"geometry",where,errors))return;
 if(!oneOf(g.shape,shapes)){errors.push(where+": unknown geometry shape");return;}
 const shape=g.shape,validDims=new Set(shape==="single"?[]:shape==="sphere"||shape==="emanation"?["radiusFeet"]:shape==="line"?["lengthFeet","widthFeet"]:["lengthFeet"]);
 for(const field of ["radiusFeet","lengthFeet","widthFeet"]){
  if(validDims.has(field)){positiveFeet(g[field],where+"."+field,errors);if(g[field]===0)errors.push(where+"."+field+": must be positive");}
  else if(Object.hasOwn(g,field))errors.push(where+": "+field+" forbidden for "+shape);
 }
}
function quantity(q,where,errors,{max=40,slotAllowed=true}={}){
 if(!keys(q,"quantity",where,errors))return;
 const kind=q.kind;
 if(!oneOf(kind,["fixed","character-level-tiers",...(slotAllowed?["slot-level"]:[])])){errors.push(where+": unsupported quantity kind");return;}
 const expected=kind==="fixed"?["kind","value"]:kind==="character-level-tiers"?["kind","tiers"]:["kind","base","atSlotLevel","perSlotLevel","maximum"];
 for(const k of Object.keys(q))if(!expected.includes(k))errors.push(where+": "+k+" not valid for "+kind);
 if(kind==="fixed"&&!intBetween(q.value,1,max))errors.push(where+".value: out of range");
 if(kind==="slot-level"){
  if(!intBetween(q.base,1,max)||!intBetween(q.atSlotLevel,1,9)||
    !intBetween(q.perSlotLevel,0,max)||!intBetween(q.maximum,1,max)||
    q.maximum<q.base || q.base+(9-q.atSlotLevel)*q.perSlotLevel>q.maximum){
   errors.push(where+": slot scaling must be bounded for every slot through 9");
  }
 }
 if(kind==="character-level-tiers"){
  if(!Array.isArray(q.tiers)||q.tiers.length<1||q.tiers.length>5){errors.push(where+": 1-5 progression tiers required");return;}
  let previous=0;
  for(const [i,tier] of q.tiers.entries()){
   const t=where+".tiers["+i+"]";
   if(!keys(tier,"tier",t,errors))continue;
   if(!intBetween(tier.minLevel,1,20)||tier.minLevel<=previous||!intBetween(tier.value,1,max))errors.push(t+": invalid or unordered tier");
   if(i===0&&tier.minLevel!==1)errors.push(where+": first tier must start at level 1");
   previous=tier.minLevel;
  }
 }
}
function dice(d,where,errors,kind){
 if(!keys(d,"dice",where,errors))return;
 quantity(d.quantity,where+".quantity",errors,{max:40});
 if(!oneOf(d.sides,diceSides))errors.push(where+": unsupported die size");
 if(!oneOf(d.rollScope,["once-per-cast","once-per-target","once-per-attack","once-per-projectile"]))errors.push(where+": unknown roll scope");
 if(kind==="heal"&&d.rollScope==="once-per-attack")errors.push(where+": healing cannot use attack roll scope in P1");
}
export function validateSpellRecipe(recipe){
 const errors=[];
 inspectData(recipe,"recipe",errors);
 if(errors.length)return {ok:false,errors};
 if(!keys(recipe,"root","recipe",errors))return {ok:false,errors};
 if(recipe.schemaVersion!==SPELL_RECIPE_SCHEMA_VERSION)errors.push("schemaVersion: expected 1");
 if(!intBetween(recipe.recipeVersion,1,99999))errors.push("recipeVersion: invalid");
 const s=recipe.spell;
 if(keys(s,"spell","spell",errors)){
  if(typeof s.key!=="string"||! /^[a-z][a-z0-9-]{1,80}\|XPHB$/.test(s.key))
   errors.push("spell.key: P1 requires a source-qualified 2024 XPHB identifier");
  if(s.ruleset!=="2024")errors.push("spell.ruleset: P1 requires 2024");
  if(!intBetween(s.level,0,9))errors.push("spell.level: 0-9 required");
 }
 const cost=recipe.cost;
 if(keys(cost,"cost","cost",errors)){
  if(!oneOf(cost.action,["action","bonus-action","reaction"]))errors.push("cost.action: unsupported");
  if(keys(cost.resource,"resource","cost.resource",errors)){
   const r=cost.resource;
   if(!oneOf(r.kind,["none","spell-slot"]))errors.push("cost.resource.kind: unsupported");
   if(r.kind==="none"&&Object.hasOwn(r,"minimumLevel"))errors.push("cost.resource: minimumLevel forbidden without slot");
   if(r.kind==="spell-slot"&&!intBetween(r.minimumLevel,1,9))errors.push("cost.resource.minimumLevel: invalid");
   if(s?.level===0&&r.kind!=="none")errors.push("cost: cantrip must not consume spell slot");
   if(s?.level>0&&(r.kind!=="spell-slot"||r.minimumLevel!==s.level))errors.push("cost: leveled spell slot minimum must match level");
  }
 }
 const t=recipe.targeting;
 if(keys(t,"targeting","targeting",errors)){
  if(!oneOf(t.mode,["creature","point","self","object"]))errors.push("targeting.mode: unsupported");
  if(!oneOf(t.origin,["caster","selected"]))errors.push("targeting.origin: unsupported");
  positiveFeet(t.rangeFeet,"targeting.rangeFeet",errors);
  if(!oneOf(t.lineOfSight,["required","not-required"]))errors.push("targeting.lineOfSight: unsupported");
  if(!oneOf(t.cover,["attack-ac","dex-save","none"]))errors.push("targeting.cover: unsupported");
  if(!intBetween(t.maxTargets,1,20))errors.push("targeting.maxTargets: 1-20 required");
  if(typeof t.allowRepeatedTargets!=="boolean")errors.push("targeting.allowRepeatedTargets: boolean required");
  geometry(t.geometry,"targeting.geometry",errors);
  if(t.mode==="self"&&(t.origin!=="caster"||t.rangeFeet!==0))errors.push("targeting: self must originate at caster with range 0");
  if(t.mode==="point"&&t.origin!=="selected")errors.push("targeting: point must have selected origin");
  if(t.cover==="attack-ac"&&t.mode==="point")errors.push("targeting: no attack AC for a point area");
 }
 if(!Array.isArray(recipe.steps)||recipe.steps.length<1||recipe.steps.length>MAX_STEPS){
  errors.push("steps: require 1-"+MAX_STEPS+" nodes");return {ok:false,errors};
 }
 const indexes=new Map(),refs=new Map(),rollGroups=new Map();
 for(const [i,step] of recipe.steps.entries()){
  const where="steps["+i+"]";
  if(!isRecord(step)){errors.push(where+": invalid step");continue;}
  if(typeof step.id!=="string"||! /^[a-z][a-z0-9-]{0,35}$/.test(step.id)||step.id===END||indexes.has(step.id))
   errors.push(where+": invalid or duplicate ID");
  else indexes.set(step.id,i);
  if(!oneOf(step.op,operations)){errors.push(where+": unrecognized operation");continue;}
  keys(step,step.op,where,errors);
  let edges=[];
  const ref=(field)=>{edges.push({field,to:step[field]});};
  if(step.op==="attack"){
   if(!oneOf(step.attackType,["ranged-spell","melee-spell"]))errors.push(where+": bad attack type");
   if(!oneOf(step.target,["selected","each-affected"]))errors.push(where+": bad attack target");
   ref("onHit");ref("onMiss");
  }
  if(step.op==="save"){
   if(!oneOf(step.ability,abilities))errors.push(where+": bad saving throw ability");
   if(!oneOf(step.target,["selected","each-affected"]))errors.push(where+": bad save target");
   ref("onSuccess");ref("onFailure");
  }
  if(step.op==="damage"||step.op==="heal"){
   if(step.op==="damage"&&!oneOf(step.damageType,damageTypes))errors.push(where+": unrecognized damage type");
   dice(step.dice,where+".dice",errors,step.op);
   if(step.flatBonus!==undefined&&!intBetween(step.flatBonus,0,30))errors.push(where+": flatBonus must be 0-30 or omitted");
   if(step.op==="damage"&&!oneOf(step.fraction,["full","half"]))errors.push(where+": damage fraction must be full or half");
   if(typeof step.rollGroup!=="string"||! /^[a-z][a-z0-9-]{0,35}$/.test(step.rollGroup))errors.push(where+": rollGroup must be a bounded identifier");
   else {
    const signature=JSON.stringify({dice:step.dice,kind:step.op,damageType:step.damageType,flatBonus:step.flatBonus??0});
    if(rollGroups.has(step.rollGroup)&&rollGroups.get(step.rollGroup)!==signature)
     errors.push(where+": rollGroup must keep identical dice/type/bonus across branches");
    else rollGroups.set(step.rollGroup,signature);
   }
   ref("next");
  }
  if(step.op==="area"){
   if(!oneOf(step.center,["caster","selected-point","impact-hex"]))errors.push(where+": bad area center");
   geometry(step.geometry,where+".geometry",errors);
   if(step.geometry?.shape==="single")errors.push(where+": area requires multi-hex shape");
   ref("next");
  }
  if(step.op==="repeat"){
   quantity(step.count,where+".count",errors,{max:MAX_REPETITIONS});
   if(!oneOf(step.targetPolicy,["may-repeat","distinct"]))errors.push(where+": bad repeat target policy");
   ref("body");ref("after");
  }
  if(step.op==="auto-hit"){
   if(!oneOf(step.target,["selected","each-affected"]))errors.push(where+": bad auto-hit target");
   ref("next");
  }
  refs.set(step.id,edges);
 }
 if(typeof recipe.entry!=="string"||!indexes.has(recipe.entry))errors.push("entry: unknown starting step");
 for(const [id,edges] of refs){
  const from=indexes.get(id);
  for(const {field,to} of edges){
   if(to===END)continue;
   if(typeof to!=="string"||!indexes.has(to))errors.push(id+"."+field+": unresolved step reference");
   else if(indexes.get(to)<=from)errors.push(id+"."+field+": non-forward edge/cycle");
  }
 }
 if(errors.length)return {ok:false,errors};
 const reachable=new Set();
 const visit=id=>{
  if(id===END||reachable.has(id))return;
  reachable.add(id);
  for(const {to} of refs.get(id)||[])visit(to);
 };
 visit(recipe.entry);
 for(const id of indexes.keys())if(!reachable.has(id))errors.push("steps: unreachable node "+id);
 // Node-order graph is acyclic by construction. Repeat is an explicit,
 // bounded orchestration node; this validator does not execute its body.
 return errors.length?{ok:false,errors}:{ok:true,errors:[],summary:{
  schemaVersion:1,spellKey:s.key,recipeVersion:recipe.recipeVersion,
  stepCount:recipe.steps.length,operations:[...new Set(recipe.steps.map(x=>x.op))],
  executable:false,requiresServerAuthorization:true
 }};
}
