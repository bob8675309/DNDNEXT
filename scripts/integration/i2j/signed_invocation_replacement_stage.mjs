// The real signed v5 transaction drives replacement. Private helper calls
// below only prepare independent ownership specimens before the signed probes.
pinned('scripts/integration/i2j/proficiency_provenance_candidate_stage.mjs','4ba716b55d59e9b64b64d4f620cbb70916f3b098');
latestRemovalCheck='REPLACE-setup';
const replacement35=pinned('sql/20260808_35_eldritch_invocation_level_replacement.sql','b46f6627813d87b7976cba9cb42663e7d861c81f');
const replacement36=pinned('sql/20260808_36_fix_invocation_replacement_source_choices_parent.sql','e46894e68849347277980ffa41c710603c06e471');
const featureTableSource=pinned('sql/20260712_01_profile_sheet_class_refinements.sql','950fbc50289b603dcaaf0d6fbdfd1f7ca46a64fb');
const subclassSource=pinned('sql/20260720_01_subclass_compatibility_and_selection.sql','4e938bc3217f11b8a4ef589da83af00aaca51782');
const battleMasterSource=pinned('sql/20260808_39_battle_master_maneuver_progression.sql','8782874160f4fa098241292920aa826ed17ee2d1');
const wizardSavantSource=pinned('sql/20260808_41_wizard_savant_forge_chronology.sql','b0f3380b7ec22124ea19de3724867877060c6d92');
const optionSource=pinned('sql/20260808_18_metamagic_mystic_arcanum_progression.sql','ce7d4ec3f37eeb0a29b8a07cd64609ee9627642f');
const signedV5Name='public.complete_character_level_up_v5(uuid,jsonb)';
const replacementGroup='warlock-invocation-replacement';

const originalMirrorTarget=seed(900);
const siblingSkillTarget=seed(900);
const finalSkillTarget=seed(900);
const expertiseReplacementTarget=seed(900);
const independentReplacementKey='i2j-background-proficiency';
const realMagicRequest=magicInput();
realMagicRequest.class_choice_selections[slot3]={invocation:[lessons],[child]:[luckyId]};
realMagicRequest.class_option_feat_instances.push({
 ...realMagicRequest.class_option_feat_instances[0],instanceId:'level-2-'+slot3+'-'+child,
 optionId:luckyId,name:'Lucky',acquisitionOwnerKey:slot3,choices:{}
});
sql(magicTail);
try{assert.ifError((await apply(editor,originalMirrorTarget,realMagicRequest)).error);}
finally{sql(originalTail)}

sql(once(magicTail,q(magicId),[magicId,skilledId].map(q).join(',')));
sql(provenanceCandidate);
try{
 for(const target of [siblingSkillTarget,finalSkillTarget,expertiseReplacementTarget]){
  proficiencyFixture(target,[toolChoices[0].label]);
  if(target!==siblingSkillTarget)materializeFixture(target,1,skilledId,independentReplacementKey,overlapSelection);
  assert.ifError((await apply(editor,target,skilledInput(overlapSelection['skills-or-tools']))).error);
  if(target===siblingSkillTarget)materializeFixture(target,2,skilledId,independentReplacementKey,overlapSelection);
  else dropClaim(target,independentReplacementKey);
  assertProficiencies(target,{skills:['arcana','perception']});
 }
}finally{
 sql(originalTail);
 sql(originalRemove);
}
sql("UPDATE public.character_sheets SET sheet=jsonb_set(sheet,'{proficiencies,skills,perception,expertise}','true',true)"+expertiseReplacementTarget.w);

const classFeatureDdl=extract(featureTableSource,'create table if not exists public.class_feature_catalog (','create or replace function public.import_class_feature_batch_v1(p_payload jsonb)');
sql(classFeatureDdl);
sql(fn(subclassSource,'private.resolve_subclass_choice_v1'));
sql("REVOKE ALL ON FUNCTION private.resolve_subclass_choice_v1(text,text,text,text) FROM PUBLIC,anon,authenticated");
sql(`INSERT INTO public.class_feature_catalog(feature_key,feature_type,name,source,class_key,class_name,class_source,subclass_name,level,description)
 VALUES('i2j-warlock-invocation-gate','class','Eldritch Invocations','XPHB','warlock','Warlock','XPHB',NULL,1,
 'Whenever you gain a Warlock level, you can replace one of your invocations.'),
 ('i2j-warlock-fiend-lineage','subclass','Fiend Patron','XPHB','warlock','Warlock','XPHB','Fiend',3,'Disposable subclass lineage');
 INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,features,proficiency_bonus,cantrips_known,spells_known,spell_slots)
 VALUES(${q(cls)},3,900,'[]',2,2,4,'[0,2]');`);
const newClassSpell=catalogSpell('Synthetic Warlock Level Three',2,['Warlock']);

const scopeName='private.p13_only_plain_fighter(uuid,integer)';
const gapName='private.level_up_persistent_choice_gaps_v1(text,text,integer,integer)';
const scopeBefore=def(scopeName),gapBefore=def(gapName);
// Widen only the reduced *unrelated fixture* tails to the new level 2→3
// specimen. Their empty-payload checks and the real authored gates remain.
sql(once(once(scopeBefore,'p_to_level<>2','p_to_level NOT IN (2,3)'),'cp.class_level IN (1,2)','cp.class_level IN (1,2,3)'));
sql(once(gapBefore,'$3<>1 OR $4<>2','NOT (($3=1 AND $4=2) OR ($3=2 AND $4=3))'));

// The inherited level-two placeholders both reject any subclass. Use the
// pinned public functions, which take their original nonmatching-class exits.
const subclassTails=[
 [battleMasterSource,'private.apply_level_up_battle_master_maneuvers_v1'],
 [wizardSavantSource,'private.apply_level_up_wizard_savant_v1']
];
const scratchPlaceholders=[[tailName,originalTail]];
for(const [source,name] of subclassTails){
 const signature=name+'(uuid,integer,jsonb,text)';
 scratchPlaceholders.push([signature,def(signature)]);
 sql(fn(source,name));
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+q(signature)+",'EXECUTE')"),'f');
}

const replacementV1='private.apply_level_up_warlock_invocation_replacement_v1';
const replacementV2='private.apply_level_up_warlock_invocation_replacement_v2';
const ensureParent='private.ensure_character_source_choices_v1';
const replacementGroupName='private.level_up_warlock_invocation_replacement_group_v1';
const replacementArgs='(uuid,integer,jsonb,jsonb,jsonb)';
for(const name of [replacementGroupName,replacementV1,'public.get_character_level_class_choice_options_v2'])sql(fn(replacement35,name));
for(const name of [ensureParent,replacementV2])sql(fn(replacement36,name));
sql(captured(optionSource,'public.get_character_level_class_choice_options_v1'));
for(const source of [replacement35,replacement36]){
 for(const line of source.split('\n').filter(entry=>/^(revoke all|grant execute) on function (private\.(level_up_warlock_invocation_replacement_group_v1|apply_level_up_warlock_invocation_replacement_v[12]|ensure_character_source_choices_v1)|public\.get_character_level_class_choice_options_v2)\(/.test(entry)))sql(line);
}
sql("REVOKE ALL ON FUNCTION public.get_character_level_class_choice_options_v1(uuid) FROM PUBLIC,anon");
sql("GRANT EXECUTE ON FUNCTION public.get_character_level_class_choice_options_v1(uuid) TO authenticated");
for(const name of [replacementV1+replacementArgs,replacementV2+replacementArgs,ensureParent+'(uuid)',removeSignature]){
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+q(name)+",'EXECUTE') OR has_function_privilege('anon',"+q(name)+",'EXECUTE')"),'f',name);
}
assert.equal(md5(signedV5Name),'02d74b973a763c53c595be20e35e512f');
const actualV1=def(replacementV1+replacementArgs),actualEnsure=def(ensureParent+'(uuid)');
const actualV1Hash=md5(replacementV1+replacementArgs);
const exactChain=[replacementV2+replacementArgs,replacementGroupName+'(uuid,integer)','public.get_character_level_class_choice_options_v2(uuid)'].map(name=>[name,md5(name)]);
sql("NOTIFY pgrst,'reload schema'");

const replacementTargets=[originalMirrorTarget,siblingSkillTarget,finalSkillTarget,expertiseReplacementTarget,sharedTarget];
for(const target of replacementTargets){
 sql("UPDATE public.character_progression SET experience_points=900,pending_level_up=true"+target.w);
 sql("INSERT INTO public.character_level_up_sessions(character_id,from_level,to_level,status,metadata_ready,created_by) VALUES("+q(target.id)+",2,3,'open',true,"+q(owner.id)+")");
}
const untouchedReplacementTargets=[...controls,proficiencyTargets.expertise,proficiencyTargets.legacy];
function replacementSnapshot(target){
 return {character:resourceSnapshot(target),baseline:effectLedger(target)};
}
function signedReplacement(nextOption=armor,ownedSlot=slot){
 return {
  hp_method:'fixed',subclass_name:'Fiend',subclass_source:'XPHB',spell_choices:[{spell_id:newClassSpell.value,prepared:true}],
  class_option_feat_instances:[],replacement_selections:{},
  class_choice_selections:{[replacementGroup]:{replace:[ownedSlot],with:[nextOption]}}
 };
}
function classGrants(target){
 return JSON.parse(sql("SELECT jsonb_agg(to_jsonb(g) ORDER BY instance_key) FROM public.character_class_option_grant_instances g"+target.w));
}
async function rejectReplacement(actor,target,request,code,pattern){
 const before=replacementSnapshot(target);
 const result=await apply(actor,target,request);
 assert.ok(result.error);
 assert.equal(result.error.code,code,JSON.stringify(result.error));
 assert.match(result.error.message,pattern);
 assert.deepEqual(replacementSnapshot(target),before);
 return result.error;
}
async function assertReplacement(target,request,featId){
 const before=resourceSnapshot(target);
 const beforeClassRows=classGrants(target);
 const beforeFeatRows=readGrantInstances(target);
 const owned=beforeFeatRows.find(row=>row.acquisition_owner_key===slot);
 assert.equal(owned.option_id,featId);
 const result=await apply(editor,target,request);
 assert.ifError(result.error);
 const summary=result.data.replacements;
 assert.equal(summary.length,1);
 assert.equal(summary[0].groupId,slot);
 assert.equal(summary[0].level,3);
 assert.equal(summary[0].removedFeat.instanceKey,owned.instance_key);
 assert.equal(summary[0].removedFeat.optionId,featId);
 assert.equal(summary[0].with,'Armor of Shadows');
 assert.equal(summary[0].featInstance,null);

 assert.equal(sql("SELECT class_level FROM public.character_progression"+target.w),'3');
 const afterClassRows=classGrants(target);
 assert.deepEqual(afterClassRows.filter(row=>row.instance_key!==slot),beforeClassRows.filter(row=>row.instance_key!==slot));
 const originalRow=beforeClassRows.find(row=>row.instance_key===slot);
 const updatedRow=afterClassRows.find(row=>row.instance_key===slot);
 assert.equal(updatedRow.id,originalRow.id);
 assert.equal(updatedRow.acquired_level,originalRow.acquired_level);
 assert.equal(updatedRow.option_catalog_id,sql("SELECT id FROM public.class_feature_option_catalog WHERE option_key="+q(armor)));
 assert.deepEqual(updatedRow.choices,{});
 assert.equal(updatedRow.metadata.lastReplacementLevel,3);
 const surviving=beforeFeatRows.filter(row=>row.instance_key!==owned.instance_key);
 assert.deepEqual(readGrantInstances(target),surviving);
 assert.equal(sql("SELECT count(*) FROM public.character_option_grants"+target.w+" AND option_id="+q(featId)),surviving.some(row=>row.option_id===featId)?'1':'0');
 const sheet=readCanonicalSheet(target);
 assert.equal(sheet.level,3);
 assert.equal(sheet.subclassName,'Fiend');
 assert.equal(sheet.sourceChoices[slot].fields.invocation.selections[0].key,armor);
 assert.equal(Object.keys(sheet.sourceChoices[slot].fields).length,1);
 assert.ok(sheet.eldritchInvocations.includes('Armor of Shadows'));
 assert.deepEqual(sheet.featGrantInstances.map(row=>row.instanceId).sort(),surviving.map(row=>row.instance_key).sort());
 assert.deepEqual(JSON.parse(sql("SELECT level_choices#>'{3,replacements}' FROM public.character_progression"+target.w)),summary);
 assert.deepEqual(JSON.parse(sql("SELECT selections->'replacements' FROM public.character_level_up_sessions"+target.w+" AND to_level=3 AND status='completed'")),summary);
 assert.deepEqual(JSON.parse(sql("SELECT details->'replacements' FROM public.character_level_events"+target.w+" AND to_level=3 AND event_type='level_up_completed'")),summary);
 assert.deepEqual(readResourceTables(target),before.tables);
 const afterSpells=readAssignments(target);
 const newRows=afterSpells.filter(row=>!before.assignments.some(previous=>previous.id===row.id));
 assert.deepEqual(newRows.map(row=>[row.spell_id,row.source_type]),[[newClassSpell.value,'class']]);
 assert.deepEqual(afterSpells.filter(row=>row.id!==newRows[0].id),before.assignments.filter(row=>!(row.source_type==='feat'&&row.source_key===owned.instance_key)));
}

const untouchedBaselines=untouchedReplacementTargets.map(effectLedger);
const untouchedBefore=untouchedReplacementTargets.map(resourceSnapshot).map(({state,...rest})=>{
 const {accounts,...independent}=state;
 return {state:independent,...rest};
});
try{
 const options=await callResource(editor,'get_character_level_class_choice_options_v2',{p_character_id:originalMirrorTarget.id});
 assert.ifError(options.error);
 const replacementOptions=options.data.groups.find(group=>group.id===replacementGroup);
 assert.ok(replacementOptions);
 assert.equal(replacementOptions.level,3);
 assert.ok(replacementOptions.fields.find(field=>field.id==='replace').options.some(option=>option.key===slot));
 assert.ok(replacementOptions.fields.find(field=>field.id==='with').options.some(option=>option.key===armor));
 assert.equal(replacementOptions.fields.find(field=>field.id===child).metadata.distinctPerRepeat,true);
 const duplicateLessons=signedReplacement(lessons,'warlock-invocation-slot-1');
 duplicateLessons.class_choice_selections[replacementGroup][child]=[luckyId];
 await rejectReplacement(editor,originalMirrorTarget,duplicateLessons,'P0001',/^Repeated Lessons of the First Ones instances must use different dependent choices\.$/);
 const reviewDenied=await callResource(viewer,'get_character_level_class_choice_options_v2',{p_character_id:originalMirrorTarget.id});
 assert.equal(reviewDenied.error?.code,'42501');
 removalEvidence('REPLACE-01: signed source-backed group exposes eligible slot/new options; original Lessons discriminator and unauthorized review denial preserved.');

 mark('replacement-original-mirror');
 const originalAccounts=account();
 await assertReplacement(originalMirrorTarget,signedReplacement(),magicId);
 assert.deepEqual(account().map((hash,index)=>hash===originalAccounts[index]),[false,false,false,true]);
 assert.equal(readGrantInstances(originalMirrorTarget)[0].option_id,luckyId);
 removalEvidence('REPLACE-02: signed original replacement removed Magic Initiate, preserved the real Lessons sibling Lucky, committed normalized and canonical receipts, and wrote original legacy mirrors.');

 sql(provenanceCandidate);
 sql(once(actualV1,removeMirror,'  -- Disposable Option A: canonical sheet only.'));
 const parentMirror="    update public.players p set sheet=v_sheet,updated_at=now()\n    where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
 sql(once(actualEnsure,parentMirror,'    -- Disposable Option A: canonical sheet only.'));
 mark('replacement-provenance');
 const candidateAccountBefore=account();

 for(const actor of [viewer,outsider])await rejectReplacement(actor,siblingSkillTarget,signedReplacement(),'42501',/^You do not have permission to level this character\.$/);
 const wrongSlot=signedReplacement(armor,'missing-invocation');
 await rejectReplacement(editor,siblingSkillTarget,wrongSlot,'P0001',/^The selected Invocation cannot be replaced on this level-up\.$/);
 const lateFailure={...signedReplacement(),spell_choices:[]};
 // This exact error occurs in base v3 after v5's replacement tail removed
 // the source and rewrote the active Invocation. Assert every table rolled back.
 await rejectReplacement(editor,siblingSkillTarget,lateFailure,'P0001',/^Choose exactly 1 new leveled spell\(s\)\.$/);
 removalEvidence('REPLACE-03: unauthorized/invalid requests failed; downstream missing spell after replacement rolled back grants, ledger, resources, sheet, progression, receipts and mirrors.');

 await assertReplacement(siblingSkillTarget,signedReplacement(),skilledId);
 assertProficiencies(siblingSkillTarget,{skills:['arcana','perception']});
 assert.equal(readGrantInstances(siblingSkillTarget)[0].acquisition_owner_key,independentReplacementKey);
 assert.equal(effectLedger(siblingSkillTarget).length,3);
 await rejectReplacement(editor,siblingSkillTarget,signedReplacement(),'P0001',/^Choose a different Invocation to replace Armor of Shadows\.$/);
 removalEvidence('REPLACE-04: removing introducing Skilled kept its legitimate independent sibling and pre-existing tool. Repeated submission rejected without a second advancement.');

 await assertReplacement(finalSkillTarget,signedReplacement(),skilledId);
 assertProficiencies(finalSkillTarget);
 assert.deepEqual(effectLedger(finalSkillTarget),[]);
 await rejectReplacement(editor,expertiseReplacementTarget,signedReplacement(),'P0001',/^Cannot remove Skilled because perception proficiency currently supports Expertise\.$/);
 assert.equal(effectiveProficiencies(expertiseReplacementTarget).skills.perception.expertise,true);
 removalEvidence('REPLACE-05: last non-introducing claim cleared exclusively granted skills but retained the pre-existing tool. Final Expertise-supporting removal failed atomically.');

 const sharedSibling=readAssignments(sharedTarget).find(row=>row.id===secondPool.id);
 assert.equal(sharedSibling.uses_remaining,1);
 await assertReplacement(sharedTarget,signedReplacement(),magicId);
 assert.deepEqual(readAssignments(sharedTarget).find(row=>row.id===secondPool.id),sharedSibling);
 assert.deepEqual(account(),candidateAccountBefore);
 removalEvidence('REPLACE-06: synthetic permissive-provider replacement preserved the independent same-spell WIS assignment and its use counter. Scratch Option A left all account rows intact.');
}finally{
 sql(originalRemove);
 sql(actualV1);
 sql(actualEnsure);
 // PostgreSQL cannot replace named parameters with the unnamed arguments
 // of the inherited scratch stubs. Restore their exact definitions and ACL.
 for(const [name,definition] of scratchPlaceholders){
  sql('DROP FUNCTION '+name);
  sql(definition);
  sql('REVOKE ALL ON FUNCTION '+name+' FROM PUBLIC,anon,authenticated');
 }
 sql(scopeBefore);
 sql(gapBefore);
}
assert.equal(md5(replacementV1+replacementArgs),actualV1Hash);
for(const [name,definition] of scratchPlaceholders)assert.equal(def(name),definition);
assert.equal(md5(removeSignature),removeHash);
assert.equal(md5(signedV5Name),'02d74b973a763c53c595be20e35e512f');
assert.equal(lessonsSchema(),originalLessonsSchema);
assert.equal(triggerSnapshot(),triggers);
assert.deepEqual(untouchedReplacementTargets.map(resourceSnapshot).map(({state,...rest})=>{
 const {accounts,...independent}=state;
 return {state:independent,...rest};
}),untouchedBefore);
assert.deepEqual(untouchedReplacementTargets.map(effectLedger),untouchedBaselines);
for(const [name,hash] of [...unchangedFunctions,...guardFingerprints,...exactChain.filter(([name])=>name!==replacementV2+replacementArgs)])assert.equal(md5(name),hash,name);
removalEvidence('REPLACE-07: unrelated character/resource state, v5 and original guards preserved; pinned replacement v1 MD5 '+actualV1Hash+', source chain '+exactChain.map(([name,hash])=>name+' '+hash).join(', ')+'.');
console.log('::notice title=Signed Invocation replacement::REPLACE-01 through REPLACE-07 passed. Pinned replacement v1 MD5 '+actualV1Hash+'; '+exactChain.map(([name,hash])=>name+' MD5 '+hash).join('; ')+'.');
