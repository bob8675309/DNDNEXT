import assert from "node:assert/strict";
import {assertNoEldritchCombatMutation,assertEldritchCommittedOnce}
 from "./lib/eldritchBlastSignedInAssertions.mjs";
const id=(i)=>"00000000-0000-0000-0000-"+String(i).padStart(12,"0");
const a=id(1),b=id(2),requestId=id(4);
const before={version:4,actionAvailable:true,
 targetState:{[a]:{hp:30,tempHp:5},[b]:{hp:20,tempHp:0}},logs:[]};
const cast={spellKey:"eldritch-blast|XPHB",beamCount:3,targetIds:[a,a,b],
 beams:[
   {targetId:a,hit:true,damage:{targetHp:30,targetTempHp:2}},
   {targetId:a,hit:true,damage:{targetHp:24,targetTempHp:0}},
   {targetId:b,hit:false,damage:null}
 ]};
const after={version:5,actionAvailable:false,
 targetState:{[a]:{hp:24,tempHp:0},[b]:{hp:20,tempHp:0}},
 logs:[{id:id(7),detail:cast,actor_participant_id:id(9),event_type:"spell_cast"}]};
cast.requestId=requestId;
assertEldritchCommittedOnce(before,after,cast,[a,a,b],requestId);
assertNoEldritchCombatMutation(after,structuredClone(after),"Identical replay");
for(const [name,transform] of [
 ["double version bump",x=>x.version+=1],
 ["spent Action twice",x=>x.actionAvailable=true],
 ["duplicate combat log",x=>x.logs.push(x.logs[0])],
 ["mutated target",x=>x.targetState[a].hp=20],
 ]) {
  const broken=structuredClone(after);
  transform(broken);
  assert.throws(()=>assertNoEldritchCombatMutation(after,broken,name),{name:"AssertionError"});
}
for(const [name,transform] of [
 ["incorrect HP",x=>x.targetState[a].hp=23],
 ["unspent Action",x=>x.actionAvailable=true],
 ["incorrect event count",x=>x.logs.push(x.logs[0])],
 ["wrong ordered target",x=>x.logs[0].detail.targetIds=[b,a,b]],
 ]) {
 const broken=structuredClone(after);
 transform(broken);
 assert.throws(()=>assertEldritchCommittedOnce(before,broken,cast,[a,a,b],requestId),{name:"AssertionError"});
}
const wrongBeam=structuredClone(cast);wrongBeam.beams[1].targetId=b;
assert.throws(()=>assertEldritchCommittedOnce(before,after,wrongBeam,[a,a,b],requestId),{name:"AssertionError"});
console.log("Signed-in staging acceptance invariants: sequential repeated-target HP/temp HP, Action/version/log once, replay/no-mutation PASS");
