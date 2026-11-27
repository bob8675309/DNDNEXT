// All removal calls are privileged fixture probes of the original private
// helper. Signed advancement creates specimens; no public removal RPC is added.
let latestRemovalCheck='REMOVE-setup';
function removalEvidence(message){
 latestRemovalCheck=message.split(':',1)[0];
 repeatEvidence(message);
}
process.on('uncaughtExceptionMonitor',error=>{
 const location=error.stack?.match(/\[eval1\]:\d+:\d+/)?.[0]||'unknown location';
 const message=String(error.message).slice(0,1400).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
 console.log('::error title=Reversal after '+latestRemovalCheck+' at '+location+'::'+message);
});
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
const independentOwner='background';
function progressionWithoutTimestamp(target){
 return sql("SELECT (to_jsonb(p)-'updated_at')::text FROM public.character_progression p"+target.w);
}
function assertOwnedRemoval(target,ownerKey){
 const key=sourceInstance(ownerKey);
 const before=resourceSnapshot(target);
 const progressionBefore=progressionWithoutTimestamp(target);
 const beforeGrants=readGrantInstances(target);
 const removed=beforeGrants.find(row=>row.instance_key===key);
 assert.ok(removed,key);
 const result=JSON.parse(sql(removalSql(target,key,independentOwner,ownerKey)));
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
 assert.equal(progressionWithoutTimestamp(target),progressionBefore);
 for(const [name,hash] of Object.entries(before.state)){
  if(!['character_progression','character_sheets','character_option_grant_instances','character_option_grants','accounts'].includes(name))assert.deepEqual(after.state[name],hash,name);
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

// Use ordinary signed characters to keep the active Invocation graph valid
// when probing the private helper. Detached specimens keep grant/effect bytes
// and spell state, with an independent owner and fixture-specific row IDs.
const introducingFirst=seed(), laterFirst=seed(), expertiseRemovalTarget=seed(), toughRemovalTarget=seed();
const detachedMagic=seed(),mirrorCandidate=seed();
for(const target of [introducingFirst,laterFirst,expertiseRemovalTarget,detachedMagic,mirrorCandidate]){
 assert.ifError((await apply(editor,target,input())).error);
}
function materializeFixture(target,level,optionId,ownerKey,choices){
 const args=[q(target.id),level,q(optionId),json({choices}),q(sourceInstance(ownerKey)),q(independentOwner),q(ownerKey)];
 return JSON.parse(sql('SELECT private.apply_source_owned_origin_feat_v1('+args.join(',')+')'));
}
function detachFeatSpecimen(source,target){
 const original=readCanonicalSheet(source);
 const projection={
  feats:original.feats,
  featGrantInstances:original.featGrantInstances.map(instance=>({...instance,acquisitionOwnerType:independentOwner}))
 };
 const targetId=q(target.id),sourceId=q(source.id);
 sql(`BEGIN;
 INSERT INTO public.character_option_grant_instances
 SELECT (jsonb_populate_record(NULL::public.character_option_grant_instances,to_jsonb(g) ||
  jsonb_build_object('id',gen_random_uuid(),'character_id',${targetId}::uuid,'acquisition_owner_type',${q(independentOwner)}))).*
 FROM public.character_option_grant_instances g WHERE g.character_id=${sourceId};
 INSERT INTO public.character_option_grants
 SELECT (jsonb_populate_record(NULL::public.character_option_grants,to_jsonb(g) ||
  jsonb_build_object('id',gen_random_uuid(),'character_id',${targetId}::uuid))).*
 FROM public.character_option_grants g WHERE g.character_id=${sourceId};
 INSERT INTO public.character_spells
 SELECT (jsonb_populate_record(NULL::public.character_spells,to_jsonb(s) ||
  jsonb_build_object('id',gen_random_uuid(),'character_id',${targetId}::uuid))).*
 FROM public.character_spells s WHERE s.character_id=${sourceId} AND s.source_type='feat';
 UPDATE public.character_sheets SET sheet=sheet||${json(projection)} WHERE character_id=${targetId};
 COMMIT;`);
}
detachFeatSpecimen(sharedTarget,detachedMagic);
detachFeatSpecimen(detectorRed,mirrorCandidate);
const detachedProfile=await callResource(editor,profileRpc,{p_character_id:detachedMagic.id});
assert.ifError(detachedProfile.error);
assert.deepEqual(detachedProfile.data.slots.map(row=>[row.poolKey,row.remaining,row.max]),[['pact_magic',2,2]]);
const skilledOverlap={'skills-or-tools':[...skillChoices,toolChoices[0]]};
for(const target of [introducingFirst,laterFirst,expertiseRemovalTarget]){
 sql("UPDATE public.character_sheets SET sheet=sheet||"+json({tools:[toolChoices[0].label],proficiencies:{skills:{}}})+target.w);
 for(const ownerKey of [slot,slot3])materializeFixture(target,2,skilledId,ownerKey,skilledOverlap);
 const owned=readGrantInstances(target);
 assert.deepEqual(owned.map(row=>row.effects.map(effect=>effect.introduced)),[[true,true,false],[false,false,false]]);
}
const protectedRemovalTargets=[...controls,sharedTarget];
mark('origin-reversal-original');
const protectedBefore=protectedRemovalTargets.map(resourceSnapshot).map(({state,...rest})=>{
 const {accounts,...independent}=state;
 return {...rest,state:independent};
});
const noInstance=/P0001: The source-owned Origin feat instance is missing\./;
rejectOwnedRemoval(detachedMagic,'missing',independentOwner,slot,noInstance);
rejectOwnedRemoval(detachedMagic,instanceKey,'species',slot,noInstance);
rejectOwnedRemoval(detachedMagic,instanceKey,independentOwner,slot3,noInstance);
rejectOwnedRemoval(sharedTarget,instanceKey,'class-option',slot,/P0001: .* is missing its owned Origin feat instance\./);
removalEvidence('REMOVE-01: private original helper rejected missing and incorrectly bound instances and the deferred guard rejected an active Invocation orphan (P0001) with full rollback.');

const siblingsBefore=readAssignments(detachedMagic).filter(row=>row.source_type==='feat'&&row.source_key===sourceInstance(slot3));
const detachedSibling=siblingsBefore.find(row=>row.spell_id===sharedOne.value);
assert.ok(detachedSibling);
const originalMirrorBefore=account();
const firstRemoved=assertOwnedRemoval(detachedMagic,slot);
assert.deepEqual(readAssignments(detachedMagic).filter(row=>row.source_type==='feat'),siblingsBefore);
assert.deepEqual(siblingsBefore.filter(row=>row.spell_id===sharedOne.value).map(row=>[row.id,row.casting_stat,row.uses_remaining]),[[detachedSibling.id,'wis',1]]);
assert.equal(sql("SELECT count(*) FROM public.players p JOIN public.character_permissions cp ON cp.user_id=p.user_id JOIN public.character_sheets cs ON cs.character_id=cp.character_id WHERE cp.character_id="+q(detachedMagic.id)+" AND p.sheet=cs.sheet"),'3');
assert.deepEqual(account().map((hash,index)=>hash===originalMirrorBefore[index]),[false,false,false,true]);
assert.ok(firstRemoved.sheet.sourceChoices[slot],'unrelated source-choice projection must survive');
assertOwnedRemoval(detachedMagic,slot3);
assert.equal(readAssignments(detachedMagic).filter(row=>row.source_type==='feat').length,0);
removalEvidence('REMOVE-02: original helper removed only selected Magic Initiate source rows, then removed final presence; sibling assignment ID, WIS/1 use, and pact slots survived first removal. Original mirror changed owner, editor and viewer.');

function assertSkilledEffects(target,skillsRemain){
 const sheet=readCanonicalSheet(target);
 for(const skill of ['arcana','perception'])assert.equal(sheet.proficiencies.skills[skill].proficient,skillsRemain);
 assert.deepEqual(sheet.tools,[toolChoices[0].label]);
}
assertOwnedRemoval(introducingFirst,slot);
assertSkilledEffects(introducingFirst,true);
assertOwnedRemoval(introducingFirst,slot3);
assertSkilledEffects(introducingFirst,true);
removalEvidence('REMOVE-03 RED: introducing source removed first; final non-introducing removal left orphaned Arcana/Perception proficiency. Pre-existing tool survived.');

assertOwnedRemoval(laterFirst,slot3);
assertSkilledEffects(laterFirst,true);
assertOwnedRemoval(laterFirst,slot);
assertSkilledEffects(laterFirst,false);
removalEvidence('REMOVE-04: reverse order cleared exclusively introduced proficiency on final removal. The pre-existing tool survived.');

assertOwnedRemoval(expertiseRemovalTarget,slot3);
sql("UPDATE public.character_sheets SET sheet=jsonb_set(sheet,'{proficiencies,skills,perception,expertise}','true',true)"+expertiseRemovalTarget.w);
rejectOwnedRemoval(expertiseRemovalTarget,instanceKey,independentOwner,slot,/P0001: Cannot remove Skilled because perception proficiency currently supports Expertise\./);
assertSkilledEffects(expertiseRemovalTarget,true);
assert.equal(readCanonicalSheet(expertiseRemovalTarget).proficiencies.skills.perception.expertise,true);
removalEvidence('REMOVE-05: Expertise dependency denied last introducing claim removal; earlier effect, canonical sheet, grant rows and account snapshots rolled back.');

// Isolate Option A by changing only the account mirror in the scratch helper.
// The original ownership-order RED remains executable and unchanged.
const removeMirror="  update public.players p set sheet=v_sheet,updated_at=now()\n  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
sql(once(originalRemove,removeMirror,'  -- Disposable Option A: canonical sheet only.'));
try{
 const accountsBeforeCandidateRemoval=account();
 assertOwnedRemoval(mirrorCandidate,slot);
 assert.deepEqual(account(),accountsBeforeCandidateRemoval);
}finally{sql(originalRemove)}
removalEvidence('REMOVE-06 GREEN: scratch mirror-only omission preserved every account row while removing the canonical grant. Original private helper restored.');

const toughId=randomUUID();
sql("INSERT INTO public.character_option_catalog(id,option_key,name,source,option_type,category,metadata) VALUES("+q(toughId)+",'i2j-reversal-tough|XPHB','Tough','XPHB','feat','O','{}')");
sql("UPDATE public.character_sheets SET sheet=sheet||'{\"featChoiceEffects\":{}}'::jsonb"+toughRemovalTarget.w);
materializeFixture(toughRemovalTarget,1,toughId,slot,{});
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
removalEvidence('REMOVE-07: Tough acquired at level 1, signed advancement reached level 2, and private removal subtracted four maximum HP and clamped full current HP.');

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
removalEvidence('REMOVE-08: untouched character state, original trigger/source/ACL boundaries preserved. Private removal and claims MD5s: '+removeHash+' / '+claimsHash);
