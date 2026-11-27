// Run only after the unchanged disposable signed consumption stage.
pinned('scripts/integration/i2j/shared_spell_resource_consumer_stage.mjs','e4d2894372e6f93c9fcf220fb9b409cbe3513dc2');
const restMigration=pinned('sql/20260810_90_rest_class_feature_restoration.sql','2bd48d73398a3e9095b61ee288c0377d464edfc6');
const sourceCapture=pinned('scripts/fixtures/i1p_original_rest_shared_p13_pg17.sql','039868c4ac5cdd62e0efc1e46f584df2bdc34a9c');
const guardSource=pinned('sql/20260802_06_character_resource_active_encounter_lock.sql','be7844fe16b14b73f4fb03f68069f9eb0af3dbf8');
const signatureSource=pinned('sql/20260808_43_wizard_signature_resource_labels.sql','e05efb5a320f0e0981103c9d41b4f1402e5336f4');
const restRpc='complete_character_rest_v1';
const featureRestore='private.restore_character_rest_action_state_v1';
const restName='public.'+restRpc;
const latestProfile='private.character_sheet_resource_profile_json_v1';
const restExpected=[
 ['private.sync_character_spell_slots_v1','uuid','6c276ab2135fb90894fd8684e39ce1c3'],
 [latestProfile,'uuid','2c798f8351282d80e63ab8e9e9019272'],
 [featureRestore,'uuid,text','d75edf2ac583e3790882155c702e2165'],
 [restName,'uuid,text','fffbf0705d640a7d2bfb08aa78ad521a']
];

// Validate the publicly captured bodies against the corresponding public
// migrations. Install captured definitions without the older fixture's DDL.
for(const [name,signature,hash] of restExpected){
 const start=sourceCapture.indexOf('CREATE OR REPLACE FUNCTION '+name+'(');
 const end=sourceCapture.indexOf('\n$function$\n;',start);
 assert.ok(start>=0&&end>start,name);
 const capturedDefinition=sourceCapture.slice(start,end)+'\n$function$;';
 const historicalSource=name===latestProfile?signatureSource:([featureRestore,restName].includes(name)?restMigration:resourceSource);
 const originalDefinition=historicalSource===resourceSource?captured(historicalSource,name):fn(historicalSource,name);
 const body=definition=>definition.match(/\bas \$(?:function)?\$([\s\S]*?)\$(?:function)?\$\s*;/i)?.[1];
 assert.ok(body(originalDefinition),name);
 assert.equal(body(capturedDefinition),body(originalDefinition),name+' public migration body');
 sql(capturedDefinition);
 assert.equal(md5(name+'('+signature+')'),hash,name);
}
const restSignature=restName+'(uuid,text)';
for(const prefix of ['revoke all on function ','grant execute on function ']){
 const line=resourceSource.split('\n').find(entry=>entry.startsWith(prefix+restSignature+' '));
 assert.ok(line);
 sql(line);
}
for(const line of restMigration.split('\n').filter(entry=>/^(revoke all|grant execute) on function private\.restore_character_rest_action_state_v1/.test(entry)))sql(line);
assert.equal(sql("SELECT has_function_privilege('anon',"+q(restSignature)+",'EXECUTE')"),'f');
assert.equal(sql("SELECT has_function_privilege('authenticated',"+q(restSignature)+",'EXECUTE')"),'t');
assert.equal(sql("SELECT has_function_privilege('authenticated',"+q(featureRestore+'(uuid,text)')+",'EXECUTE')"),'f');

// Structural scratch encounter subset only. All veto behavior is original
// migration 06, with no tactical casting, mirroring or map code installed.
assert.equal(sql("SELECT to_regclass('public.encounters') IS NULL AND to_regclass('public.encounter_participants') IS NULL"),'t');
sql(`CREATE TABLE public.encounters(id uuid PRIMARY KEY,name text NOT NULL,status text NOT NULL,version bigint NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE public.encounter_participants(id uuid PRIMARY KEY,encounter_id uuid NOT NULL REFERENCES public.encounters(id),character_id uuid REFERENCES public.characters(id));
 REVOKE ALL ON public.encounters,public.encounter_participants FROM PUBLIC,anon,authenticated;`);
sql(extract(guardSource,'create or replace function private.character_active_encounter_v1(p_character_id uuid)','-- Update the core mirror so its persistent decrement is explicitly recognized as battle-board authority.'));
sql(captured(guardSource,'public.character_sheet_resource_profile_v2'));
for(const line of guardSource.split('\n').filter(entry=>/^(revoke all|grant execute) on function public\.character_sheet_resource_profile_v2/.test(entry)))sql(line);
const guardFingerprints=[
 'private.character_active_encounter_v1(uuid)','private.assert_character_resource_not_active_v1(uuid)',
 'private.guard_character_spell_slot_update_v1()','private.guard_character_spell_use_update_v1()',
 'private.guard_character_rest_insert_v1()','public.character_sheet_resource_profile_v2(uuid)'
].map(name=>[name,md5(name)]);

const slotRpc='update_character_spell_slot_v1';
sql(captured(resourceSource,'public.'+slotRpc));
for(const line of resourceSource.split('\n').filter(entry=>/^(revoke all|grant execute) on function public\.update_character_spell_slot_v1/.test(entry)))sql(line);
sql("NOTIFY pgrst,'reload schema'");

const shortSpell=catalogSpell('Synthetic Short Rest Recharge',1,['Warlock']);
const shortId=randomUUID();
sql(`INSERT INTO public.character_spells(id,character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,uses_remaining,uses_max,recharge)
 VALUES (${q(shortId)},${q(sharedTarget.id)},${q(shortSpell.value)},'class','i2j-recharge-fixture','Synthetic short-rest grant',true,true,true,'cha',0,2,'short-rest');`);

function assertCadence(assignments,expected){
 for(const [pool,remaining,maximum,cadence] of expected){
  const assignment=assignments.find(row=>row.id===pool);
  assert.ok(assignment,pool);
  assert.deepEqual([assignment.uses_remaining,assignment.uses_max,assignment.recharge],[remaining,maximum,cadence]);
 }
}
function assertAssignmentDelta(before,after,changedUses){
 assert.deepEqual(after.map(row=>row.id),before.map(row=>row.id));
 for(const original of before){
  const actual=after.find(row=>row.id===original.id);
  const expected=changedUses.get(original.id);
  assert.deepEqual(actual,expected===undefined?original:{...original,uses_remaining:expected,updated_at:actual.updated_at});
 }
}
function callRest(actor,type){
 return callResource(actor,restRpc,{p_character_id:sharedTarget.id,p_rest_type:type});
}
async function denyRest(actor,type,code,pattern){
 const before=resourceSnapshot(sharedTarget);
 const result=await callRest(actor,type);
 assert.ok(result.error);
 assert.equal(result.error.code,code,JSON.stringify(result.error));
 assert.match(result.error.message,pattern);
 assert.deepEqual(resourceSnapshot(sharedTarget),before);
}
async function completeRest(actor,type,{slots,uses,assignments}){
 const before=resourceSnapshot(sharedTarget);
 const result=await callRest(actor,type);
 assert.ifError(result.error);
 const after=resourceSnapshot(sharedTarget);
 assert.deepEqual(after.state,before.state);
 assertAssignmentDelta(before.assignments,after.assignments,new Map(assignments));
 assertProfilePools(result.data,sharedTarget,after.assignments.filter(row=>row.uses_max>0));
 assert.deepEqual(result.data.slots.map(row=>[row.poolKey,row.slotLevel,row.remaining,row.max,row.rechargeKey]),[['pact_magic',1,2,2,'short_rest']]);
 assert.deepEqual(result.data.restResult,{restType:type,restoredSpellSlots:slots,restoredSpellUses:uses,restoredClassFeatureUses:0,classFeatures:[]});
 const logsBefore=JSON.parse(before.tables.character_rest_log);
 const logsAfter=JSON.parse(after.tables.character_rest_log);
 assert.deepEqual(logsAfter.filter(row=>logsBefore.some(previous=>previous.id===row.id)),logsBefore);
 const additions=logsAfter.filter(row=>!logsBefore.some(previous=>previous.id===row.id));
 assert.equal(additions.length,1);
 const [entry]=additions;
 assert.deepEqual([entry.completed_by,entry.rest_type,entry.restored_spell_slots,entry.restored_spell_uses,entry.details.encounterStateChanged],[actor.id,type,slots,uses,false]);
 assert.equal(new Date(result.data[type==='short_rest'?'lastShortRest':'lastLongRest']).getTime(),new Date(entry.completed_at).getTime());
 return after.assignments;
}
async function usePactSlot(){
 const result=await callResource(editor,slotRpc,{p_character_id:sharedTarget.id,p_pool_key:'pact_magic',p_slot_level:1,p_operation:'use'});
 assert.ifError(result.error);
 assert.equal(result.data.slots[0].remaining,1);
}

const restControlsBefore=controls.map(resourceSnapshot);
assertCadence(readAssignments(sharedTarget),[[firstPool.id,0,1,'long-rest'],[secondPool.id,0,1,'long-rest'],[shortId,0,2,'short-rest']]);
await usePactSlot();
repeatEvidence('REST-01: both independently owned long-rest assignments and the short-rest fixture begin exhausted; signed pact-slot consumption left 1/2.');

const shortAfter=await completeRest(editor,'short_rest',{slots:1,uses:2,assignments:[[shortId,2]]});
assertCadence(shortAfter,[[firstPool.id,0,1,'long-rest'],[secondPool.id,0,1,'long-rest'],[shortId,2,2,'short-rest']]);
repeatEvidence('REST-02: short rest restored the short-cadence assignment and pact slot; both Magic Initiate assignments remained exhausted.');

await denyRest(editor,'invalid_rest','22023',/^Rest type must be short_rest or long_rest\.$/);
for(const actor of [viewer,outsider])await denyRest(actor,'long_rest','42501',/^You do not have permission to complete rests for this character\.$/);
repeatEvidence('REST-03: invalid operation and both unauthorized actors produced 22023/42501 with unchanged state.');

assert.ifError((await consume(editor,sharedTarget,shortId)).error);
await usePactSlot();
const longAfter=await completeRest(owner,'long_rest',{slots:1,uses:3,assignments:[[firstPool.id,1],[secondPool.id,1],[shortId,2]]});
assertCadence(longAfter,[[firstPool.id,1,1,'long-rest'],[secondPool.id,1,1,'long-rest'],[shortId,2,2,'short-rest']]);
repeatEvidence('REST-04: long rest restored both independent Magic Initiate assignments, one short-cadence use, and one pact slot, without changing grant identity.');

await completeRest(editor,'long_rest',{slots:0,uses:0,assignments:[]});
repeatEvidence('REST-05: a rest at maximum restored zero uses and slots, added one rest receipt, and did not duplicate or rewrite any spell grants.');

const activeEncounter=randomUUID();
sql(`INSERT INTO public.encounters(id,name,status) VALUES(${q(activeEncounter)},'Synthetic active guard','active');
 INSERT INTO public.encounter_participants VALUES(${q(randomUUID())},${q(activeEncounter)},${q(sharedTarget.id)});`);
const activeResult=await callResource(editor,'character_sheet_resource_profile_v2',{p_character_id:sharedTarget.id});
assert.ifError(activeResult.error);
assert.equal(activeResult.data.encounterLocked,true);
assert.equal(activeResult.data.activeEncounter.encounterId,activeEncounter);
await denyRest(editor,'long_rest','55000',/^Spell resources are controlled by the active battle board encounter:/);
sql("UPDATE public.encounters SET status='archived' WHERE id="+q(activeEncounter));
repeatEvidence('REST-06: original active-encounter rest-log veto returned 55000 and rolled back at full pools.');

const postRest=resourceSnapshot(sharedTarget);
const spendAfterRest=await consume(editor,sharedTarget,firstPool.id);
assert.ifError(spendAfterRest.error);
const finalRest=resourceSnapshot(sharedTarget);
assertAssignmentDelta(postRest.assignments,finalRest.assignments,new Map([[firstPool.id,0]]));
assertProfilePools(spendAfterRest.data,sharedTarget,finalRest.assignments.filter(row=>row.uses_max>0));
assert.deepEqual(finalRest.state,postRest.state);
assert.deepEqual(finalRest.tables,postRest.tables);
assert.deepEqual(controls.map(resourceSnapshot),restControlsBefore);
assert.deepEqual(account(),candidateAccounts);
assert.equal(lessonsSchema(),originalLessonsSchema);
assert.equal(triggerSnapshot(),triggers);
assert.equal(def(featName),materializerBefore);
assert.equal(md5(permissionFunction),'ac70e4ec033d86c4e0a254d50d429a45');
for(const [name,hash] of [...guardFingerprints,...unchangedFunctions,...resourceFingerprints.filter(([name])=>!name.startsWith(latestProfile+'('))]){
 assert.equal(md5(name),hash,name);
}
for(const [name,signature,hash] of restExpected)assert.equal(md5(name+'('+signature+')'),hash,name);
repeatEvidence('REST-07: post-rest spend changed only the selected assignment. Other characters, effects, sheets, accounts and source fingerprints were preserved.');
