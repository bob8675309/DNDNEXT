// All removal calls are privileged fixture probes of the original private
// helper. Signed advancement creates specimens; no public removal RPC is added.
pinned('scripts/integration/i2j/shared_spell_rest_recharge_stage.mjs','277bbb38a40e74554c1a6c24464713e2d1872628');
pinned('sql/20260808_35_eldritch_invocation_level_replacement.sql','b46f6627813d87b7976cba9cb42663e7d861c81f');
const removeName='private.remove_source_owned_origin_feat_v1';
const claimsName='private.other_character_option_effect_claim_v1';
const removeSignature=removeName+'(uuid,text,text,text)';
const claimsSignature=claimsName+'(uuid,text,text,text)';
assert.equal(sql("SELECT to_regprocedure("+q(removeSignature)+") IS NULL"),'t');
for(const name of [removeName,claimsName]){
 sql(fn(materializerSource,name));
 for(const line of materializerSource.split('\n').filter(entry=>/^(revoke all|grant execute) on function /.test(entry)&&entry.includes('on function '+name+'(')))sql(line);
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+q(name+'(uuid,text,text,text)')+",'EXECUTE') OR has_function_privilege('anon',"+q(name+'(uuid,text,text,text)')+",'EXECUTE')"),'f');
}
const originalRemove=def(removeSignature), removeHash=md5(removeSignature), claimsHash=md5(claimsSignature);

function sourceInstance(ownerKey){
 return 'invocation-'+ownerKey+'-origin-feat';
}
function removalSql(target,key,ownerType,ownerKey){
 return 'SELECT '+removeName+'('+[target.id,key,ownerType,ownerKey].map(q).join(',')+')';
}
function readGrantInstances(target){
 return JSON.parse(sql("SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.instance_key),'[]') FROM public.character_option_grant_instances g"+target.w));
}
function readCanonicalSheet(target){
 return JSON.parse(sql('SELECT sheet FROM public.character_sheets'+target.w));
}
function assertOwnedRemoval(target,ownerKey){
 const key=sourceInstance(ownerKey);
 const before=resourceSnapshot(target);
 const beforeGrants=readGrantInstances(target);
 const removed=beforeGrants.find(row=>row.instance_key===key);
 assert.ok(removed,key);
 const result=JSON.parse(sql(removalSql(target,key,'class-option',ownerKey)));
 assert.equal(result.instanceKey,key);
 assert.equal(result.optionId,removed.option_id);
 assert.deepEqual(result.removedEffects,removed.effects);
 const surviving=beforeGrants.filter(row=>row.instance_key!==key);
 assert.deepEqual(readGrantInstances(target),surviving);
 const sameOption=surviving.some(row=>row.option_id===removed.option_id);
 assert.equal(sql('SELECT count(*) FROM public.character_option_grants'+target.w+' AND option_id='+q(removed.option_id)),sameOption?'1':'0');
 const sheet=readCanonicalSheet(target);
 assert.equal(sheet.feats.includes(removed.option_name),sameOption);
 assert.deepEqual(sheet.featGrantInstances.map(instance=>instance.instanceId).sort(),surviving.map(row=>row.instance_key).sort());
 const after=resourceSnapshot(target);
 assert.deepEqual(after.tables,before.tables);
 for(const [name,hash] of Object.entries(before.state)){
  if(!['character_sheets','character_option_grant_instances','character_option_grants','accounts'].includes(name))assert.deepEqual(after.state[name],hash,name);
 }
 const hasSpells=removed.effects.some(effect=>effect.type==='feat-spell-source');
 assert.deepEqual(after.assignments,before.assignments.filter(row=>!(hasSpells&&row.source_type==='feat'&&row.source_key===key)));
 return {sheet,removed};
}
function rejectOwnedRemoval(target,key,ownerType,ownerKey,pattern){
 const before=resourceSnapshot(target);
 assert.throws(()=>psql(['-v','VERBOSITY=verbose','-c',removalSql(target,key,ownerType,ownerKey)]),pattern);
 assert.deepEqual(resourceSnapshot(target),before);
}

const introducingFirst=seed(), laterFirst=seed(), expertiseRemovalTarget=seed(), toughRemovalTarget=seed();
const skilledOverlap={'skills-or-tools':[...skillChoices,toolChoices[0]]};
for(const target of [introducingFirst,laterFirst,expertiseRemovalTarget]){
 sql("UPDATE public.character_sheets SET sheet=jsonb_set(sheet,'{tools}',"+json([toolChoices[0].label])+",true)"+target.w);
}
sql(providerTail);
try{
 for(const target of [introducingFirst,laterFirst,expertiseRemovalTarget]){
  assert.ifError((await apply(editor,target,providerRequest(skilledId,'Skilled',skilledOverlap,skilledOverlap))).error);
  const owned=readGrantInstances(target);
  assert.deepEqual(owned.map(row=>row.effects.map(effect=>effect.introduced)),[[true,true,false],[false,false,false]]);
 }
}finally{sql(originalTail)}

const protectedRemovalTargets=[...controls.filter(target=>target!==detectorRed)];
mark('origin-reversal-original');
const protectedBefore=protectedRemovalTargets.map(resourceSnapshot).map(({state,...rest})=>{
 const {accounts,...independent}=state;
 return {...rest,state:independent};
});
const noInstance=/P0001: The source-owned Origin feat instance is missing\./;
rejectOwnedRemoval(sharedTarget,'missing','class-option',slot,noInstance);
rejectOwnedRemoval(sharedTarget,instanceKey,'species',slot,noInstance);
rejectOwnedRemoval(sharedTarget,instanceKey,'class-option',slot3,noInstance);
repeatEvidence('REMOVE-01: private original helper rejected missing and incorrectly bound instances (P0001) without any scoped mutation.');

const siblingsBefore=readAssignments(sharedTarget).filter(row=>row.source_type==='feat'&&row.source_key===sourceInstance(slot3));
const originalMirrorBefore=account();
const firstRemoved=assertOwnedRemoval(sharedTarget,slot);
assert.deepEqual(readAssignments(sharedTarget).filter(row=>row.source_type==='feat'),siblingsBefore);
assert.deepEqual(siblingsBefore.filter(row=>row.spell_id===sharedOne.value).map(row=>[row.id,row.casting_stat,row.uses_remaining]),[[secondPool.id,'wis',1]]);
assert.equal(sql("SELECT count(*) FROM public.players p JOIN public.character_permissions cp ON cp.user_id=p.user_id JOIN public.character_sheets cs ON cs.character_id=cp.character_id WHERE cp.character_id="+q(sharedTarget.id)+" AND p.sheet=cs.sheet"),'3');
assert.deepEqual(account().map((hash,index)=>hash===originalMirrorBefore[index]),[false,false,false,true]);
assert.ok(firstRemoved.sheet.sourceChoices[slot],'caller owns updating the invocation projection');
assertOwnedRemoval(sharedTarget,slot3);
assert.equal(readAssignments(sharedTarget).filter(row=>row.source_type==='feat').length,0);
repeatEvidence('REMOVE-02: original helper removed only selected Magic Initiate source rows, then removed final presence; sibling assignment ID, WIS/1 use, and pact slots survived first removal. Original mirror changed owner, editor and viewer.');

function assertSkilledEffects(target,skillsRemain){
 const sheet=readCanonicalSheet(target);
 for(const skill of ['arcana','perception'])assert.equal(sheet.proficiencies.skills[skill].proficient,skillsRemain);
 assert.deepEqual(sheet.tools,[toolChoices[0].label]);
}
assertOwnedRemoval(introducingFirst,slot);
assertSkilledEffects(introducingFirst,true);
assertOwnedRemoval(introducingFirst,slot3);
assertSkilledEffects(introducingFirst,true);
repeatEvidence('REMOVE-03 RED: introducing source removed first; final non-introducing removal left orphaned Arcana/Perception proficiency. Pre-existing tool survived.');

assertOwnedRemoval(laterFirst,slot3);
assertSkilledEffects(laterFirst,true);
assertOwnedRemoval(laterFirst,slot);
assertSkilledEffects(laterFirst,false);
repeatEvidence('REMOVE-04: reverse order cleared exclusively introduced proficiency on final removal. The pre-existing tool survived.');

assertOwnedRemoval(expertiseRemovalTarget,slot3);
sql("UPDATE public.character_sheets SET sheet=jsonb_set(sheet,'{proficiencies,skills,perception,expertise}','true',true)"+expertiseRemovalTarget.w);
rejectOwnedRemoval(expertiseRemovalTarget,instanceKey,'class-option',slot,/P0001: Cannot remove Skilled because perception proficiency currently supports Expertise\./);
assertSkilledEffects(expertiseRemovalTarget,true);
assert.equal(readCanonicalSheet(expertiseRemovalTarget).proficiencies.skills.perception.expertise,true);
repeatEvidence('REMOVE-05: Expertise dependency denied last introducing claim removal; earlier effect, canonical sheet, grant rows and account snapshots rolled back.');

// Isolate Option A by changing only the account mirror in the scratch helper.
// The original ownership-order RED remains executable and unchanged.
const removeMirror="  update public.players p set sheet=v_sheet,updated_at=now()\n  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
sql(once(originalRemove,removeMirror,'  -- Disposable Option A: canonical sheet only.'));
try{
 const accountsBeforeCandidateRemoval=account();
 assertOwnedRemoval(detectorRed,slot);
 assert.deepEqual(account(),accountsBeforeCandidateRemoval);
}finally{sql(originalRemove)}
repeatEvidence('REMOVE-06 GREEN: scratch mirror-only omission preserved every account row while removing the canonical grant. Original private helper restored.');

const toughId=randomUUID();
sql("INSERT INTO public.character_option_catalog(id,option_key,name,source,option_type,category,metadata) VALUES("+q(toughId)+",'i2j-reversal-tough|XPHB','Tough','XPHB','feat','O','{}')");
sql("UPDATE public.character_sheets SET sheet=sheet||'{\"featChoiceEffects\":{}}'::jsonb"+toughRemovalTarget.w);
sql("SELECT private.apply_source_owned_origin_feat_v1("+[q(toughRemovalTarget.id),1,q(toughId),json({choices:{}}),q(instanceKey),q('class-option'),q(slot)].join(',')+")");
assert.equal(readCanonicalSheet(toughRemovalTarget).featChoiceEffects.tough.acquiredLevel,1);
assert.ifError((await apply(editor,toughRemovalTarget,input())).error);
assert.equal(sql('SELECT class_level FROM public.character_progression'+toughRemovalTarget.w),'2');
const toughBefore=readCanonicalSheet(toughRemovalTarget);
// Explicitly model full current HP for the clamp without changing maximum HP.
sql("UPDATE public.character_sheets SET sheet=jsonb_set(sheet,'{hp}',sheet->'maxHp')"+toughRemovalTarget.w);
const {sheet:toughAfter}=assertOwnedRemoval(toughRemovalTarget,slot);
assert.equal(toughAfter.maxHp,toughBefore.maxHp-4);
assert.equal(toughAfter.hp,toughAfter.maxHp);
assert.equal(toughAfter.featChoiceEffects.tough,undefined);
repeatEvidence('REMOVE-07: Tough acquired at level 1, signed advancement reached level 2, and private removal subtracted four maximum HP and clamped full current HP.');

assert.deepEqual(protectedRemovalTargets.map(resourceSnapshot).map(({state,...rest})=>{
 const {accounts,...independent}=state;
 return {...rest,state:independent};
}),protectedBefore);
assert.equal(lessonsSchema(),originalLessonsSchema);
assert.equal(triggerSnapshot(),triggers);
assert.equal(md5(removeSignature),removeHash);
assert.equal(md5(claimsSignature),claimsHash);
assert.equal(def(tailName),originalTail);
assert.equal(def(featName),materializerBefore);
for(const [name,hash] of [...unchangedFunctions,...guardFingerprints])assert.equal(md5(name),hash,name);
repeatEvidence('REMOVE-08: untouched character state, original trigger/source/ACL boundaries preserved. Private removal and claims MD5s: '+removeHash+' / '+claimsHash);
