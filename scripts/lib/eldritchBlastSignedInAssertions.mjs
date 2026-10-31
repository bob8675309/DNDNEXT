// Pure assertions used by the real signed-in, staging-only acceptance test.
// No network, privileged role or fake identity is permitted here.
import assert from "node:assert/strict";

const asInt = (value,where) => {
  assert.ok(Number.isInteger(value), where + " must be an integer");
  return value;
};
const hpRecord = (row) => ({
  hp: asInt(row.current_hp,"HP"),
  tempHp: asInt(row.temp_hp ?? 0,"temporary HP"),
});
export function assertNoEldritchCombatMutation(before,after,label) {
  assert.equal(after.version,before.version,label+": encounter version changed");
  assert.equal(after.actionAvailable,before.actionAvailable,label+": Action availability changed");
  assert.deepEqual(after.targetState,before.targetState,label+": target HP/temp HP changed");
  assert.deepEqual(after.logs,before.logs,label+": spell log changed");
}

export function assertEldritchCommittedOnce(before,after,cast,orderedTargets,requestId) {
  assert.ok(Array.isArray(orderedTargets) && orderedTargets.length>=1 && orderedTargets.length<=4,
    "Ordered beam targets required");
  assert.equal(cast?.spellKey?.toLowerCase(),"eldritch-blast|xphb");
  assert.equal(cast.beamCount,orderedTargets.length,"Server beam count mismatch");
  assert.deepEqual(cast.targetIds,orderedTargets,"Server target array changed");
  assert.ok(Array.isArray(cast.beams));
  assert.equal(cast.beams.length,orderedTargets.length,"Missing independent beam outcomes");
  assert.equal(before.actionAvailable,true,"Fixture actor had no Action before casting");
  assert.equal(after.actionAvailable,false,"One Action must be consumed");
  assert.equal(asInt(after.version,"After version"),asInt(before.version,"Before version")+1,
    "Successful cast must bump encounter version once");
  assert.equal(before.logs.length,0,"Request UUID already in the log before cast");
  assert.equal(after.logs.length,1,"Exactly one combat-log event must be visible");
  assert.equal(after.logs[0].detail?.requestId,requestId,"Wrong request ID in log");
  assert.deepEqual(after.logs[0].detail,cast,"Combat log does not match authoritative RPC result");

  const expected=structuredClone(before.targetState);
  for(let i=0;i<cast.beams.length;i++){
    const beam=cast.beams[i];
    assert.equal(beam?.targetId,orderedTargets[i],"Independent beam target order mismatch");
    assert.equal(typeof beam.hit,"boolean","Every beam needs server hit/miss");
    if(!beam.hit)continue;
    assert.ok(beam.damage && typeof beam.damage==="object","Hit missing damage mitigation result");
    const target=orderedTargets[i];
    assert.ok(Object.hasOwn(expected,target),"Server targeted creature outside fixture");
    expected[target]={
      hp:asInt(beam.damage.targetHp,"Authoritative result HP"),
      tempHp:asInt(beam.damage.targetTempHp,"Authoritative result temp HP"),
    };
  }
  assert.deepEqual(after.targetState,expected,
    "Target HP/temp HP differs from the sequential authoritative beam results");
}

export async function readEldritchSignedInState(client,{encounterId,actorId,targets,requestId}) {
  const uniqueTargets=[...new Set(targets)];
  const [enc,actor,hp,logs]=await Promise.all([
    client.from("encounters").select("id,version,active_participant_id")
      .eq("id",encounterId).single(),
    client.from("encounter_participants").select("id,action_available")
      .eq("id",actorId).single(),
    client.from("encounter_participants").select("id,current_hp,temp_hp")
      .in("id",uniqueTargets),
    client.from("encounter_combat_log").select("id,detail,actor_participant_id,event_type")
      .eq("encounter_id",encounterId).contains("detail",{requestId}),
  ]);
  for(const [name,query] of [["encounters",enc],["actor",actor],["targets",hp],["log",logs]]){
    if(query.error)throw new Error("Signed-in RLS "+name+" read failed: "+query.error.message);
  }
  assert.ok(enc.data?.id===encounterId,"Encounter unavailable under signed-in RLS");
  assert.ok(actor.data?.id===actorId,"Caster unavailable under signed-in RLS");
  assert.ok(Array.isArray(hp.data) && hp.data.length===uniqueTargets.length,
    "All test targets must be visible to the same real signed-in account");
  assert.ok(Array.isArray(logs.data),"Combat log unavailable to the signed-in account");
  const targetState=Object.fromEntries(hp.data.map(p=>[String(p.id),hpRecord(p)]));
  const matchingLogs=logs.data.map(row=>({
    id:row.id,detail:row.detail,actor_participant_id:row.actor_participant_id,event_type:row.event_type,
  })).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  return {
    version:asInt(enc.data.version,"Encounter version"),
    actionAvailable:actor.data.action_available,
    targetState,logs:matchingLogs,
  };
}
