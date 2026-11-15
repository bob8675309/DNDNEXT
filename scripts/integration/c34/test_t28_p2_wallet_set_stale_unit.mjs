#!/usr/bin/env node
// T28-P2 deterministic mounted-hook wallet_set return-data negative.
// Executes source-derived real hook body in Node vm with minimal React hook
// scheduler and injected Supabase RPC; NO browser, SQL or production imports.
// This does not replace the separate genuine signed PostgREST/browser suite.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {createT28P2CommerceGuardCandidate} from "../../../utils/c34/t28P2CommerceGuardCandidate.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const source=readFileSync(path.join(root,"utils/c34/useWalletT28P2Research.js"),"utf8");
assert.match(source,/const stillSameWallet = \(\) =>/);
assert.match(source,/if \(!stillSameWallet\(\)\) return staleResult\(\)/);
const stripped=source
 .replace(/^import [^\n]*\n/gm,"")
 .replace(/^export default function /m,"function ");
assert.doesNotMatch(stripped,/^\s*(import|export)\s/m);
const deferred=()=>{
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
 return {promise,resolve,reject};
};
let latestGp=79;
const pendingSets=[];
let authListener=null, signedActor=null;
const supabase={
 auth:{
  onAuthStateChange(fn){authListener=fn;return {data:{subscription:{unsubscribe(){authListener=null}}}}},
  async getSession(){return {data:{session:signedActor?{user:{id:signedActor}}:null}}}
 },
 rpc(name,args){
  if(name==="wallet_get")return Promise.resolve({
   data:args.p_user==="player-B"?0:latestGp,error:null
  });
  if(name==="wallet_set"){
   const hold=deferred();
   pendingSets.push({args,...hold});
   return hold.promise;
  }
  throw Error("unexpected RPC "+name);
 }
};
let state=[],refs=[],effects=[],sidx=0,ridx=0,eidx=0;
const useState=initial=>{
 const i=sidx++;
 if(!(i in state))state[i]=initial;
 return [state[i],value=>{state[i]=typeof value==="function"?value(state[i]):value}];
};
const useRef=initial=>{
 const i=ridx++;
 if(!refs[i])refs[i]={current:initial};
 return refs[i];
};
const useMemo=fn=>fn();
const depsSame=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const useEffect=(fn,deps)=>{
 const i=eidx++;
 const old=effects[i];
 if(!old||!depsSame(old.deps,deps)){
  if(old?.cleanup)old.cleanup();
  effects[i]={deps,fn,run:true,cleanup:null};
 }
};
const factory=vm.runInNewContext(
 stripped+"\nuseWalletT28P2Research;",
 {useState,useRef,useMemo,useEffect,supabase,createT28P2CommerceGuardCandidate,Error,Number,String,Boolean}
);
let hook=null;
function render(target=null){
 sidx=ridx=eidx=0;
 hook=factory(target);
 for(const eff of effects){
  if(eff?.run){eff.run=false;eff.cleanup=eff.fn()}
 }
 return hook;
}
const settle=async()=>{
 for(let i=0;i<6;i++)await Promise.resolve();
};
const signed=(event,id)=>{
 signedActor=id;
 assert.equal(typeof authListener,"function");
 authListener(event,id?{user:{id}}:null);
};
function acceptSet(gp){
 const next=pendingSets.shift();
 assert.ok(next,"expected a pending real hook wallet_set RPC");
 latestGp=gp;
 next.resolve({data:gp,error:null});
}
function expectStale(r,label){
 assert.equal(r.data,null,label+" must not return old account numeric");
 assert.ok(r.error,label+" must report indeterminate transaction context");
 assert.match(String(r.error.message),/context changed/i);
}
render(null);
signed("SIGNED_IN","gm");
await settle();
assert.equal(state[1],79);

// (1) Server may commit after logout. Wallet value and set() caller result
// must both be scrubbed, despite accepted server response bytes.
const logoutSet=hook.set(66);
signed("SIGNED_OUT",null);
acceptSet(66);
expectStale(await logoutSet,"late response after logout");
assert.equal(state[1],null,"logout leaked the old wallet into React state");
console.log("PASS T28-P2-SET-R01: accepted late wallet_set after logout returns no numeric data");

// (2) Same Admin changes selected target without actor change. The previous
// wallet_set result must not be passed to target-B's page callback.
signed("SIGNED_IN","gm");
await settle();
render("player-A");
await settle();
const targetASet=hook.set(999);
render("player-B");
await settle();
acceptSet(999);
expectStale(await targetASet,"late target-A wallet_set");
assert.equal(state[1],0,"target-B wallet state overwritten by target-A");
console.log("PASS T28-P2-SET-R02: same-actor Admin target switch suppresses old numeric return");

// (3) Current owner, current generation: existing API still returns {data,error}
// and reconciles state via the authoritative wallet_get RPC.
render(null);
await settle();
const current=hook.set(55);
acceptSet(55);
const currentResult=await current;
assert.equal(currentResult.error,null);
assert.equal(currentResult.data,55);
assert.equal(state[1],55);
console.log("PASS T28-P2-SET-R03: authorized current wallet_set returns data and re-reads committed balance");

for(const e of effects)if(typeof e?.cleanup==="function")e.cleanup();
assert.equal(authListener,null);
console.log("PASS T28-P2-SET-UNIT: isolated real hook source tested for logout, selected target and current wallet data");
