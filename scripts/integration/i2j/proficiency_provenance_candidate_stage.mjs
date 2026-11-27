// Run after the entire unchanged original reversal stage, including its RED.
pinned('scripts/integration/i2j/source_owned_effect_reversal_stage.mjs','0479563ebd872d34f4d8045554cefa297d5dc762');
latestRemovalCheck='PROV-setup';
const baselineSqlPath='scripts/fixtures/i2j_proficiency_provenance_scratch_pg17.sql';
pinned(baselineSqlPath,'c32e26ca6c62aac9e74bd1367d4c9013adc62586');
const proficiencyTargets=Object.fromEntries(['first','later','partial','expertise','legacy','weapon'].map(name=>[name,seed()]));
for(const target of Object.values(proficiencyTargets))assert.ifError((await apply(editor,target,input())).error);
function proficiencyFixture(target,priorTools=[]){
 sql("UPDATE public.character_sheets SET sheet=sheet||"+json({tools:priorTools,proficiencies:{skills:{}}})+target.w);
}
function skillPick(name){
 return {kind:'skill',key:name,value:name,label:name};
}
const overlapSelection={'skills-or-tools':[...skillChoices,toolChoices[0]]};
for(const target of Object.values(proficiencyTargets))proficiencyFixture(target,[toolChoices[0].label]);
// Existing untracked effects intentionally predate the candidate ledger.
materializeFixture(proficiencyTargets.legacy,2,skilledId,slot,overlapSelection);
const preexistingEvidence=[introducingFirst,laterFirst,expertiseRemovalTarget,sharedTarget,...controls];
mark('proficiency-provenance-stage');
const outsideProvenanceBefore=preexistingEvidence.map(resourceSnapshot);
const provenanceAccounts=account();

psql(['-f',baselineSqlPath]);
const introducedPredicate="coalesce((v_effect->>'introduced')::boolean,false)";
const mechanicalPredicate="private.i2j_managed_effect_introduced(p_character_id,v_effect)";
assert.equal(originalRemove.split(introducedPredicate).length,4);
const provenanceCandidate=once(originalRemove.replaceAll(introducedPredicate,mechanicalPredicate),removeMirror,
 '  -- Disposable Option A: canonical sheet only.');
sql(provenanceCandidate);
const correctedRemovalHash=md5(removeSignature);
assert.notEqual(correctedRemovalHash,removeHash);

function effectLedger(target){
 return JSON.parse(sql("SELECT coalesce(jsonb_agg(to_jsonb(b)-'character_id' ORDER BY effect_type,effect_key),'[]') FROM private.i2j_effect_baseline b"+target.w));
}
function effectiveProficiencies(target){
 const sheet=readCanonicalSheet(target);
 return {
  skills:Object.fromEntries(Object.entries(sheet.proficiencies?.skills??{}).filter(([,state])=>state.proficient).map(([key,state])=>[key,state])),
  tools:[...(sheet.tools??[])].sort(),
  weapons:[...(sheet.weaponProficiencies??[])].sort()
 };
}
function assertProficiencies(target,{skills=[],tools=[toolChoices[0].label],weapons=[]}={}){
 const effective=effectiveProficiencies(target);
 assert.deepEqual(Object.keys(effective.skills).sort(),[...skills].sort());
 assert.deepEqual(effective.tools,[...tools].sort());
 assert.deepEqual(effective.weapons,[...weapons].sort());
}
function acquireSkilled(target,ownerKey,choices=overlapSelection){
 return materializeFixture(target,2,skilledId,ownerKey,choices);
}
function dropClaim(target,ownerKey){
 const before=account();
 const result=assertOwnedRemoval(target,ownerKey);
 assert.deepEqual(account(),before);
 return result;
}

try{
 for(const name of ['first','later']){
  const target=proficiencyTargets[name];
  acquireSkilled(target,slot);
  acquireSkilled(target,slot3);
  const baseline=effectLedger(target);
  assert.equal(baseline.filter(row=>row.preexisting===false).length,2);
  assert.equal(baseline.filter(row=>row.preexisting===true).length,1);
  const order=name==='first'?[slot,slot3]:[slot3,slot];
  dropClaim(target,order[0]);
  assertProficiencies(target,{skills:['arcana','perception']});
  assert.deepEqual(effectLedger(target),baseline);
  dropClaim(target,order[1]);
  assertProficiencies(target);
  assert.deepEqual(effectLedger(target),[]);
 }
 assert.deepEqual(effectiveProficiencies(proficiencyTargets.first),effectiveProficiencies(proficiencyTargets.later));
 for(const field of ['feats','featGrantInstances','proficiencies','tools','weaponProficiencies']){
  assert.deepEqual(readCanonicalSheet(proficiencyTargets.first)[field],readCanonicalSheet(proficiencyTargets.later)[field],field);
 }
 assertSkilledEffects(introducingFirst,true);
 removalEvidence('PROV-01 GREEN: both removal orders preserved active claims and produced equal final state; exclusively granted proficiencies cleared, prior tool retained. Original REMOVE-03 remains RED.');

 const partiallyShared=proficiencyTargets.partial;
 const secondSelections={'skills-or-tools':[skillPick('Arcana'),skillPick('Athletics'),toolChoices[1]]};
 const thirdSelections={'skills-or-tools':[skillPick('Arcana'),skillPick('Athletics'),toolChoices[2]]};
 const thirdOwner='i2j-provenance-third';
 acquireSkilled(partiallyShared,slot);
 acquireSkilled(partiallyShared,slot3,secondSelections);
 acquireSkilled(partiallyShared,thirdOwner,thirdSelections);
 assert.equal(readGrantInstances(partiallyShared).length,3);
 dropClaim(partiallyShared,slot);
 assertProficiencies(partiallyShared,{skills:['arcana','athletics'],tools:toolChoices.map(choice=>choice.label)});
 dropClaim(partiallyShared,slot3);
 assertProficiencies(partiallyShared,{skills:['arcana','athletics'],tools:[toolChoices[0].label,toolChoices[2].label]});
 dropClaim(partiallyShared,thirdOwner);
 assertProficiencies(partiallyShared);
 assert.deepEqual(effectLedger(partiallyShared),[]);
 acquireSkilled(partiallyShared,slot3,secondSelections);
 assertProficiencies(partiallyShared,{skills:['arcana','athletics'],tools:[toolChoices[0].label,toolChoices[1].label]});
 dropClaim(partiallyShared,slot3);
 assertProficiencies(partiallyShared);
 assert.deepEqual(effectLedger(partiallyShared),[]);
 removalEvidence('PROV-02 GREEN: three claims, partial overlap, exclusive tool removal and reacquisition preserved exactly the active effects.');

 const dependent=proficiencyTargets.expertise;
 acquireSkilled(dependent,slot);
 acquireSkilled(dependent,slot3);
 sql("UPDATE public.character_sheets SET sheet=jsonb_set(sheet,'{proficiencies,skills,perception,expertise}','true',true)"+dependent.w);
 dropClaim(dependent,slot);
 assertProficiencies(dependent,{skills:['arcana','perception']});
 assert.equal(effectiveProficiencies(dependent).skills.perception.expertise,true);
 const dependencyBaseline=effectLedger(dependent);
 rejectOwnedRemoval(dependent,sourceInstance(slot3),independentOwner,slot3,/P0001: Cannot remove Skilled because perception proficiency currently supports Expertise\./);
 assert.deepEqual(effectLedger(dependent),dependencyBaseline);
 assert.equal(effectiveProficiencies(dependent).skills.perception.expertise,true);
 removalEvidence('PROV-03 GREEN: another valid claim allowed removal with Expertise; last non-introducing claim was denied atomically, including baseline state.');

 const legacy=proficiencyTargets.legacy;
 acquireSkilled(legacy,slot3);
 assert.equal(effectLedger(legacy).length,3);
 assert.ok(effectLedger(legacy).every(row=>row.preexisting===null));
 dropClaim(legacy,slot);
 dropClaim(legacy,slot3);
 assertProficiencies(legacy,{skills:['arcana','perception']});
 assert.equal(readGrantInstances(legacy).length,0);
 assert.deepEqual(effectLedger(legacy),[]);
 removalEvidence('PROV-04: historical claims without complete provenance remained conservative. The candidate did not assign a source or retract ambiguous proficiencies.');

 const weaponTarget=proficiencyTargets.weapon;
 const tavernId=randomUUID();
 sql("INSERT INTO public.character_option_catalog(id,option_key,name,source,option_type,category,metadata) VALUES("+q(tavernId)+",'i2j-provenance-tavern|XPHB','Tavern Brawler','XPHB','feat','O','{}')");
 materializeFixture(weaponTarget,2,tavernId,slot,{});
 assertProficiencies(weaponTarget,{weapons:['Improvised Weapons']});
 assert.deepEqual(effectLedger(weaponTarget).map(row=>[row.effect_type,row.preexisting]),[['weapon-proficiency',false]]);
 dropClaim(weaponTarget,slot);
 assertProficiencies(weaponTarget);
 assert.deepEqual(effectLedger(weaponTarget),[]);
 removalEvidence('PROV-05 GREEN: the same baseline and reversal policy tracked and cleared a weapon proficiency using the original materializer.');

 assert.deepEqual(preexistingEvidence.map(resourceSnapshot),outsideProvenanceBefore);
 assert.deepEqual(account(),provenanceAccounts);
 assert.equal(lessonsSchema(),originalLessonsSchema);
 assert.equal(triggerSnapshot(),triggers);
 assert.equal(def(featName),materializerBefore);
 assert.equal(def(tailName),originalTail);
 assert.equal(md5(claimsSignature),claimsHash);
 for(const [name,hash] of [...unchangedFunctions,...guardFingerprints])assert.equal(md5(name),hash,name);
 for(const [name,signature,hash] of restExpected)assert.equal(md5(name+'('+signature+')'),hash,name);
 removalEvidence('PROV-06 GREEN: unrelated characters, resources, rest, all legacy account rows and existing source/guard fingerprints remained intact. Candidate removal MD5 '+correctedRemovalHash+'.');
}finally{sql(originalRemove)}
assert.equal(md5(removeSignature),removeHash);
