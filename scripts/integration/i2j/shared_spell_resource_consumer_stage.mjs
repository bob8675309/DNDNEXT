// Runs after the historical and repeatability stages in the same disposable DB.
pinned('scripts/integration/i2j/origin_feat_repeatability_candidate_stage.mjs','e110f9c4a875acd2dc4edd4fc0e62eb3e847de0e');
const resourceSource=pinned('sql/20260802_03_character_sheet_spell_resources.sql','f96a3788334fe306374dfd4b5fdf4e00992d3924');
const resourceRpc='update_character_spell_use_v1';
const profileRpc='character_sheet_resource_profile_v1';
const resourceFunctions=[
 'private.sync_character_spell_slots_v1',
 'private.character_sheet_resource_profile_json_v1',
 'public.'+profileRpc,
 'public.'+resourceRpc
];
const resourceSignatures=['uuid','uuid','uuid','uuid,uuid,text'];
const permissionFunction='private.can_manage_character_progression_v1(uuid)';
const scratchAdmin='private.current_user_is_admin()';
assert.equal(md5(permissionFunction),'ac70e4ec033d86c4e0a254d50d429a45');
const adminBefore=md5(scratchAdmin);

// Scratch class metadata missing from the reduced P1.3 fixture. All resource
// table and function definitions are extracted from the pinned public migration.
sql("ALTER TABLE public.class_catalog ADD COLUMN caster_progression text; UPDATE public.class_catalog SET caster_progression='pact' WHERE id="+q(cls));
sql(extract(resourceSource,'create table if not exists public.character_spell_slots (','create or replace function private.sync_character_spell_slots_v1(p_character_id uuid)'));
resourceFunctions.forEach((name,index)=>{
 const signature=name+'('+resourceSignatures[index]+')';
 sql(captured(resourceSource,name));
 for(const prefix of ['revoke all on function ','grant execute on function ']){
  const line=resourceSource.split('\n').find(entry=>entry.startsWith(prefix+signature+' '));
  assert.ok(line,signature+' '+prefix);
  sql(line);
 }
});
const resourceFingerprints=resourceFunctions.map((name,index)=>{
 const signature=name+'('+resourceSignatures[index]+')';
 return [signature,md5(signature)];
});
for(const [signature] of resourceFingerprints){
 const publicRpc=signature.startsWith('public.');
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+q(signature)+",'EXECUTE')"),publicRpc?'t':'f');
 assert.equal(sql("SELECT has_function_privilege('anon',"+q(signature)+",'EXECUTE')"),'f');
}
assert.equal(sql("SELECT has_table_privilege('authenticated','public.character_spells','UPDATE')"),'f');
sql("NOTIFY pgrst,'reload schema'");

async function callResource(actor,rpc,args){
 for(let attempt=0;attempt<35;attempt++){
  const result=await actor.client.rpc(rpc,args);
  if(result.error?.code!=='PGRST202')return result;
  await new Promise(resolve=>setTimeout(resolve,300));
 }
 assert.fail('PostgREST did not expose '+rpc+' after reload');
}

function readAssignments(target){
 return JSON.parse(sql("SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]') FROM public.character_spells s"+target.w));
}
function readResourceTables(target){
 return Object.fromEntries(['character_spell_slots','character_rest_log'].map(table=>[
  table,sql("SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') FROM public."+table+" t"+target.w)
 ]));
}
function resourceSnapshot(target){
 const {character_spells,...state}=extendedSnapshot(target);
 return {state,tables:readResourceTables(target),assignments:readAssignments(target)};
}

function assertProfilePools(profile,target,expected){
 assert.equal(profile.characterId,target.id);
 assert.equal(profile.canManage,true);
 const entries=profile.limitedSpellUses;
 assert.deepEqual(entries.map(entry=>entry.assignmentId).sort(),expected.map(row=>row.id).sort());
 for(const row of expected){
  const actual=entries.find(entry=>entry.assignmentId===row.id);
  assert.equal(actual.spellId,row.spell_id);
  assert.equal(actual.max,row.uses_max);
  assert.equal(actual.remaining,row.uses_remaining);
  assert.equal(actual.recharge,row.recharge);
  assert.equal(actual.sourceType,row.source_type);
  assert.equal(actual.sourceLabel,row.source_label);
 }
}

const profileResult=await callResource(editor,profileRpc,{p_character_id:sharedTarget.id});
assert.ifError(profileResult.error);
const originalResourceProfile=profileResult.data;
assert.deepEqual(originalResourceProfile.slots.map(slot=>[slot.poolKey,slot.slotLevel,slot.max,slot.remaining]),[['pact_magic',1,2,2]]);
assert.equal(originalResourceProfile.lastShortRest,null);
assert.equal(originalResourceProfile.lastLongRest,null);
const originalResources=resourceSnapshot(sharedTarget);
const [firstPool,secondPool]=originalResources.assignments.filter(row=>row.spell_id===sharedOne.value).sort((a,b)=>a.source_key.localeCompare(b.source_key));
assert.ok(firstPool&&secondPool);
assert.deepEqual([firstPool,secondPool].map(row=>[row.uses_remaining,row.uses_max,row.casting_stat]),[[1,1,'int'],[1,1,'wis']]);
assertProfilePools(originalResourceProfile,sharedTarget,[firstPool,secondPool]);
repeatEvidence('RESOURCE-01: pinned signed resource profile exposed both same-spell assignment IDs and two independent 1/1 pools.');

function consume(actor,target,assignmentId){
 return callResource(actor,resourceRpc,{p_character_id:target.id,p_assignment_id:assignmentId,p_operation:'use'});
}
async function expectResourceDenial(actor,target,assignmentId,code,message){
 const snapshots=[sharedTarget,legacyTarget].map(resourceSnapshot);
 const result=await consume(actor,target,assignmentId);
 assert.ok(result.error,'resource denial unexpectedly accepted');
 assert.equal(result.error.code,code,JSON.stringify(result.error));
 if(message)assert.match(result.error.message,message);
 assert.deepEqual([sharedTarget,legacyTarget].map(resourceSnapshot),snapshots);
}
async function spendAssignment(actor,pool){
 const before=resourceSnapshot(sharedTarget);
 const result=await consume(actor,sharedTarget,pool.id);
 assert.ifError(result.error);
 const after=resourceSnapshot(sharedTarget);
 assert.deepEqual(after.state,before.state);
 assert.deepEqual(after.tables,before.tables);
 const changed=after.assignments.find(row=>row.id===pool.id);
 const original=before.assignments.find(row=>row.id===pool.id);
 assert.equal(original.uses_remaining,1);
 assert.deepEqual(changed,{...original,uses_remaining:0,updated_at:changed.updated_at});
 assert.deepEqual(after.assignments.filter(row=>row.id!==pool.id),before.assignments.filter(row=>row.id!==pool.id));
 assertProfilePools(result.data,sharedTarget,after.assignments.filter(row=>row.uses_max>0));
 assert.deepEqual({...result.data,limitedSpellUses:[]},{...originalResourceProfile,limitedSpellUses:[]});
 return after.assignments;
}

const controls=[...candidateControls,detectorRed,duplicateTarget,policyControl,openTarget,legacyTarget];
const controlsBefore=controls.map(resourceSnapshot);
const afterFirst=await spendAssignment(editor,firstPool);
assert.deepEqual(afterFirst.find(row=>row.id===secondPool.id),secondPool);
repeatEvidence('RESOURCE-02: editor spent INT assignment to 0/1; WIS sibling remained byte-identical at 1/1.');

await expectResourceDenial(editor,sharedTarget,firstPool.id,'22023',/^No uses remain for this spell\.$/);
repeatEvidence('RESOURCE-03: exhausted assignment rejected with 22023 and no state change.');

await expectResourceDenial(editor,sharedTarget,'not-an-assignment-uuid','22P02');
await expectResourceDenial(editor,sharedTarget,randomUUID(),'P0002',/^No matching limited-use spell exists\.$/);
await expectResourceDenial(editor,sharedTarget,sharedOne.value,'P0002',/^No matching limited-use spell exists\.$/);
await expectResourceDenial(editor,legacyTarget,secondPool.id,'P0002',/^No matching limited-use spell exists\.$/);
repeatEvidence('RESOURCE-04: malformed and unknown IDs, spell-ID substitution, and wrong character binding rejected atomically (22P02/P0002).');

for(const actor of [viewer,outsider]){
 await expectResourceDenial(actor,sharedTarget,secondPool.id,'42501',/^You do not have permission to manage this character.s spell uses\.$/);
}
repeatEvidence('RESOURCE-05: viewer and outsider rejected with 42501 while the target assignment still had a use.');

const afterSecond=await spendAssignment(owner,secondPool);
assert.deepEqual(afterSecond.find(row=>row.id===firstPool.id),afterFirst.find(row=>row.id===firstPool.id));
assert.deepEqual(controls.map(resourceSnapshot),controlsBefore);
assert.deepEqual(account(),candidateAccounts);
assert.equal(lessonsSchema(),originalLessonsSchema);
assert.equal(triggerSnapshot(),triggers);
assert.equal(md5(permissionFunction),'ac70e4ec033d86c4e0a254d50d429a45');
assert.equal(md5(scratchAdmin),adminBefore);
for(const [name,hash] of [...resourceFingerprints,...unchangedFunctions]){
 assert.equal(md5(name),hash,name);
}
assert.equal(def(featName),materializerBefore);
repeatEvidence('RESOURCE-06: owner spent WIS assignment independently; INT remained exhausted. Unrelated state, accounts, Lessons policy and function fingerprints preserved.');
repeatEvidence('Resource MD5s: '+resourceFingerprints.map(([name,hash])=>name+' '+hash).join(', ')+'.');
