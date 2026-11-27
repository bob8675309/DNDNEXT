// Appended by the disposable CI runner after the unchanged historical stage.
// Uses its authenticated actors, source pins, scratch guards and snapshot helpers.
pinned('scripts/integration/i2j/test_origin_feat_pair_historical_signed.mjs','4a19d046ae375a0d16537e614891f0286604df7e');

const candidateProvider='optional-feature:i2j-repeatable-origin-provider|XPHB';
const candidateChild='child-i2j-repeatable-origin-provider';
const candidateId=randomUUID();
// A provider that permits repeated feats. It does not redefine Lessons.
sql(`INSERT INTO public.class_feature_option_catalog
 (id,option_key,option_type,name,source,class_key,repeatable,prerequisites,choice_schema)
 VALUES (${q(candidateId)},${q(candidateProvider)},'eldritch-invocation',
 'I2J Repeatable Origin Provider','XPHB','warlock',true,'{"minClassLevel":2}',
 '{"kind":"origin-feat","category":"O","distinctPerRepeat":false}')`);

let providerTail=once(originalTail,q(lessons),q(candidateProvider));
providerTail=once(providerTail,q(child),q(candidateChild));
providerTail=once(providerTail,q(luckyId),[luckyId,magicId,skilledId].map(q).join(','));
function providerRequest(optionId,name,first,second){
 const request=acquisitionPair(optionId,first,optionId,second);
 for(const ownerKey of [slot,slot3]){
  request.class_choice_selections[ownerKey]={invocation:[candidateProvider],[candidateChild]:[optionId]};
 }
 for(const instance of request.class_option_feat_instances){
  instance.name=name;
  instance.instanceId='level-2-'+instance.acquisitionOwnerKey+'-'+candidateChild;
 }
 return request;
}

const independentShared=providerRequest(magicId,magicName,
 {...wizard,'level-1-wizard':[sharedOne]}, {...druid,'level-1-druid':[sharedOne]});
const sameDiscriminator=providerRequest(magicId,magicName,wizard,wizardAlt);
const sharedTarget=seed(),detectorRed=seed(),duplicateTarget=seed(),policyControl=seed(),openTarget=seed(),legacyTarget=seed();
mark('origin-reusable-policy');
sql('ALTER TABLE public.character_spells ADD COLUMN i2j_instance_owned boolean NOT NULL DEFAULT false');
const candidateControls=[...magicControls,...Object.values(repeatTargets)];
const candidateControlBefore=candidateControls.map(extendedSnapshot);
const candidateAccounts=account();
const materializerBefore=def(featName);
const unchangedFunctions=[...pinnedCandidates.filter(([name])=>name!==featName),[spellHelper,spellHelperHash],
 ['public.complete_character_level_up_v5(uuid,jsonb)','02d74b973a763c53c595be20e35e512f']];

sql(providerTail);
try{
 const originalError=await rejectAcquisition(sharedTarget,independentShared,'23505',
  /^duplicate key value violates unique constraint "character_spells_unique_source_idx"$/);
 assert.ok(originalError.details.includes(sharedOne.value));
 repeatEvidence('CAND-01 RED: same canonical feat, Wizard/Druid, shared spell: '+originalError.code+' '+originalError.message+' Complete rollback.');

 const originalDuplicate=await apply(editor,detectorRed,sameDiscriminator);
 assert.ifError(originalDuplicate.error);
 final(detectorRed,[candidateProvider,candidateProvider],{1:magicId,2:magicId},6);
 repeatEvidence('CAND-02 RED: original materializer accepted the same Wizard discriminator twice through the permissive fixture provider.');
 const redBefore=extendedSnapshot(detectorRed);

 // Metadata is fixture-owned and never read from submitted policy JSON. The
 // historical validator still checks the actual choice domain before this guard.
 sql(`UPDATE public.character_option_catalog SET metadata=metadata ||
 '{"repeatChoiceField":"spell-list"}'::jsonb WHERE id=${q(magicId)};
 CREATE FUNCTION private.i2j_repeat_choice_key(p_choices jsonb,p_field text)
 RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $policy$
   SELECT CASE WHEN jsonb_typeof(p_choices->p_field)='array'
     THEN CASE WHEN jsonb_array_length(p_choices->p_field)=1
       THEN nullif(lower(btrim(coalesce(p_choices->p_field->0->>'value',p_choices->p_field->0->>'label'))),'')
     END END
 $policy$;
 CREATE FUNCTION private.i2j_validate_repeat_choice(p_character uuid,p_option uuid,p_choices jsonb,p_field text)
 RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public,private AS $policy$
 DECLARE proposed text;
 BEGIN
   IF p_field IS NULL THEN RETURN; END IF;
   proposed:=private.i2j_repeat_choice_key(p_choices,p_field);
   IF proposed IS NULL THEN
     RAISE EXCEPTION 'Repeatable acquisition requires one valid discriminator.';
   END IF;
   IF EXISTS (
     SELECT 1 FROM public.character_option_grant_instances grant_row
     WHERE grant_row.character_id=p_character AND grant_row.option_id=p_option
       AND private.i2j_repeat_choice_key(grant_row.choices,p_field) IS NULL
   ) THEN RAISE EXCEPTION 'Existing repeatable acquisition has no discriminator.'; END IF;
   IF EXISTS (
     SELECT 1 FROM public.character_option_grant_instances grant_row
     WHERE grant_row.character_id=p_character AND grant_row.option_id=p_option
       AND private.i2j_repeat_choice_key(grant_row.choices,p_field)=proposed
   ) THEN RAISE EXCEPTION 'Repeatable acquisition discriminator is already granted.'; END IF;
 END
 $policy$;
 REVOKE ALL ON FUNCTION private.i2j_repeat_choice_key(jsonb,text),
   private.i2j_validate_repeat_choice(uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;

 CREATE UNIQUE INDEX i2j_character_spells_legacy_label_idx
   ON public.character_spells(character_id,spell_id,source_type,coalesce(source_label,''))
   WHERE NOT i2j_instance_owned;
 DROP INDEX public.character_spells_unique_source_idx;`);

 const guardAnchor='  if exists(\n    select 1 from public.character_option_grant_instances gi\n    where gi.character_id=p_character_id and gi.instance_key=p_instance_key';
 let candidateMaterializer=once(materializerBefore,guardAnchor,
  "  perform private.i2j_validate_repeat_choice(p_character_id,p_option_id,v_choices,v_option.metadata->>'repeatChoiceField');\n"+guardAnchor);
 const insertColumns='source_label,known,prepared,always_available';
 const insertValues='p_instance_key,v_option.name,true,true,true';
 assert.equal(candidateMaterializer.split(insertColumns).length,3);
 assert.equal(candidateMaterializer.split(insertValues).length,3);
 candidateMaterializer=candidateMaterializer
  .replaceAll(insertColumns,'source_label,i2j_instance_owned,known,prepared,always_available')
  .replaceAll(insertValues,'p_instance_key,v_option.name,true,true,true,true');
 sql(candidateMaterializer);

 const duplicateError=await rejectAcquisition(duplicateTarget,sameDiscriminator,'P0001',
  /^Repeatable acquisition discriminator is already granted\.$/);
 repeatEvidence('CAND-03 GREEN: '+duplicateError.code+' '+duplicateError.message+' Whole transaction rolled back.');

 const nonrepeatError=await rejectAcquisition(policyControl,providerRequest(alertId,'Alert',{},{}),'P0001',
  /^Alert is not repeatable and is already granted to this character\.$/);
 repeatEvidence('CAND-04 GREEN: '+nonrepeatError.code+' '+nonrepeatError.message+' Original nonrepeatable policy preserved.');

 const openChoices={'skills-or-tools':toolChoices};
 const openRequest=providerRequest(skilledId,'Skilled',openChoices,openChoices);
 assert.ifError((await apply(editor,openTarget,openRequest)).error);
 final(openTarget,[candidateProvider,candidateProvider],{1:skilledId,2:skilledId});
 const openEffects=JSON.parse(sql("SELECT jsonb_agg(effects ORDER BY acquisition_owner_key) FROM public.character_option_grant_instances"+openTarget.w));
 assert.deepEqual(openEffects,[true,false].map(introduced=>toolChoices.map(tool=>({type:'tool-proficiency',tool:tool.label,introduced}))));
 assert.equal(sql("SELECT count(*) FROM public.character_option_grants"+openTarget.w),'1');
 repeatEvidence('CAND-05 GREEN: unrestricted Skilled repeat kept two owned grants and one legacy presence row.');

 assert.ifError((await apply(editor,sharedTarget,independentShared)).error);
 final(sharedTarget,[candidateProvider,candidateProvider],{1:magicId,2:magicId},6);
 for(const instance of independentShared.class_option_feat_instances){
  const list=instance.choices['spell-list'][0].value;
  const key='invocation-'+instance.acquisitionOwnerKey+'-origin-feat';
  assertAcquisition(sharedTarget,instance,{repeatable:true,effects:[{type:'feat-spell-source',sourceKey:key,spellList:list,introduced:true}]});
 }
 const pools=JSON.parse(sql("SELECT jsonb_agg(to_jsonb(s) ORDER BY source_key) FROM public.character_spells s"+sharedTarget.w+" AND spell_id="+q(sharedOne.value)));
 assert.equal(new Set(pools.map(pool=>pool.id)).size,2);
 assert.deepEqual(pools.map(pool=>[pool.source_type,pool.source_key,pool.source_label,pool.casting_stat,pool.uses_remaining,pool.uses_max,pool.recharge,pool.i2j_instance_owned]),[
  ['feat',instanceKey,magicName,'int',1,1,'long-rest',true],
  ['feat','invocation-'+slot3+'-origin-feat',magicName,'wis',1,1,'long-rest',true]
 ]);
 repeatEvidence('CAND-06 GREEN: corrected retry committed two row identities for one spell, separate INT/WIS and 1/1 long-rest pools.');

 const legacyBefore=extendedSnapshot(legacyTarget);
 // Check both constraints through real PostgreSQL diagnostics, without
 // manufacturing a signed app writer for legacy rows in this fixture.
 sql(`DO $test$
 DECLARE rejected_by text;
 BEGIN
  BEGIN
   INSERT INTO public.character_spells(character_id,spell_id,source_type,source_key,source_label)
   VALUES (${q(legacyTarget.id)},${q(eb)},'class','legacy-other','Warlock');
   RAISE EXCEPTION 'Legacy duplicate accepted';
  EXCEPTION WHEN unique_violation THEN
   GET STACKED DIAGNOSTICS rejected_by=CONSTRAINT_NAME;
   IF rejected_by <> 'i2j_character_spells_legacy_label_idx' THEN RAISE; END IF;
  END;
  BEGIN
   INSERT INTO public.character_spells(character_id,spell_id,source_type,source_key,source_label,i2j_instance_owned)
   VALUES (${q(sharedTarget.id)},${q(sharedOne.value)},'feat',${q(instanceKey)},'alternate label',true);
   RAISE EXCEPTION 'Duplicate source identity accepted';
  EXCEPTION WHEN unique_violation THEN
   GET STACKED DIAGNOSTICS rejected_by=CONSTRAINT_NAME;
   IF rejected_by <> 'character_spells_source_identity_uidx' THEN RAISE; END IF;
  END;
 END $test$;`);
 assert.deepEqual(extendedSnapshot(legacyTarget),legacyBefore);
 assert.deepEqual(extendedSnapshot(detectorRed),redBefore);
 assert.deepEqual(candidateControls.map(extendedSnapshot),candidateControlBefore);
 assert.deepEqual(account(),candidateAccounts);
 assert.equal(lessonsSchema(),originalLessonsSchema);
 assert.equal(triggerSnapshot(),triggers);
 assert.equal(sql("SELECT pg_get_indexdef('public.character_spells_source_identity_uidx'::regclass)"),spellIndexes.character_spells_source_identity_uidx);
 for(const [name,hash] of unchangedFunctions)assert.equal(md5(name),hash,name);
 repeatEvidence('CAND-07 GREEN: legacy label and canonical key duplicates remain blocked; unrelated snapshots, Lessons schema, trigger and function pins unchanged.');
}finally{
 sql(originalTail);
 sql(materializerBefore);
}
assert.equal(def(tailName),originalTail);
assert.equal(def(featName),materializerBefore);
