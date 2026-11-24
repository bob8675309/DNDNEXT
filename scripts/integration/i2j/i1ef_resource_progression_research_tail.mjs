
// Additional bounded I2J tests. Original I1C-D-E-F source ran above, unmodified.
const i2jFs=await import('node:fs');
const i2jCrypto=await import('node:crypto');
function i2jReadPinned(p,sha){
 const b=i2jFs.readFileSync(p);
 assert.equal(i2jCrypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),sha,p+' drift');
 return b.toString('utf8');
}
function i2jExtract(src,signature){
 const anchor='create or replace function '+signature;
 const start=src.toLowerCase().indexOf(anchor);
 assert.ok(start>=0&&src.toLowerCase().indexOf(anchor,start+anchor.length)<0,'ambiguous original function '+signature);
 const end=src.indexOf('\n$$;',start);
 assert.ok(end>start,'original function terminator absent');
 return src.slice(start,end+4);
}
const i2jQ=v=>"'"+String(v).replaceAll("'","''")+"'";
const i2jJson=v=>i2jQ(JSON.stringify(v))+'::jsonb';
const i2jFoundation=i2jReadPinned('sql/20260710_02_character_progression_foundation.sql','b1b9781e06e9210a30c520b7f531bce7cbdbd82a');
const i2jRest=i2jReadPinned('sql/20260802_03_character_sheet_spell_resources.sql','f96a3788334fe306374dfd4b5fdf4e00992d3924');
const i2jLabels=i2jReadPinned('sql/20260808_43_wizard_signature_resource_labels.sql','e05efb5a320f0e0981103c9d41b4f1402e5336f4');
const i2jBattle=i2jReadPinned('sql/20260808_39_battle_master_maneuver_progression.sql','8782874160f4fa098241292920aa826ed17ee2d1');
// Historical permission predicate; current_user_is_admin is existing reduced fixture dependency, not live user_profiles.
sql(i2jExtract(i2jFoundation,'private.can_manage_character_progression_v1('));
sql('REVOKE ALL ON FUNCTION private.can_manage_character_progression_v1(uuid) FROM PUBLIC,anon,authenticated');
sql("ALTER TABLE public.class_catalog ADD COLUMN IF NOT EXISTS caster_progression text; UPDATE public.class_catalog SET caster_progression='full' WHERE class_key='wizard' AND source='XPHB'");
const i2jCut=i2jRest.indexOf('-- Ensure every existing sheet has a stable character identity');
assert.ok(i2jCut>0&&i2jRest.startsWith('begin;'));
const i2jRestPrefix=i2jRest.slice(0,i2jCut);
assert.ok(!/update public\.players/i.test(i2jRestPrefix),'Unexpected historical mirror inside runtime-only prefix');
// Exact runtime DDL + original grants; intentionally EXCLUDE historical account-sheet backfill.
sql(i2jRestPrefix+'\ncommit;');
sql(i2jLabels);
sql("NOTIFY pgrst,'reload schema'");
const i2jSigNonce=randomUUID(),i2jSigPayload=wizardIntent('I2J labeled Signature lifecycle',20,i2jSigNonce,wizardGroups(20));
const i2jSig=succeeded(await create(creator,'I2J-SIG-STORY',i2jSigPayload),'fresh signed Signature creation under overlay guard');
const i2jProfile=actor=>rpc(actor.client,'character_sheet_resource_profile_v1',{p_character_id:i2jSig});
const i2jUse=(actor,id)=>rpc(actor.client,'update_character_spell_use_v1',{p_character_id:i2jSig,p_assignment_id:id,p_operation:'use'});
const i2jSlot=actor=>rpc(actor.client,'update_character_spell_slot_v1',{p_character_id:i2jSig,p_pool_key:'spellcasting',p_slot_level:3,p_operation:'use'});
const i2jDoRest=(actor,kind)=>rpc(actor.client,'complete_character_rest_v1',{p_character_id:i2jSig,p_rest_type:kind});
const i2jSignatureRows=p=>p.limitedSpellUses.filter(x=>x.resourceFeature==='Signature Spells');
const i2jProfile0=succeeded(await i2jProfile(creator),'signed canonical resource profile');
assert.equal(i2jProfile0.characterId,i2jSig);assert.equal(i2jProfile0.classLevel,20);
const i2jSignatures=i2jSignatureRows(i2jProfile0);
assert.equal(i2jSignatures.length,2);
for(const x of i2jSignatures){assert.equal(x.resourceLabel,'Signature Spell');assert.equal(x.recharge,'short_rest');assert.equal(x.max,1);assert.equal(x.remaining,1);assert.equal(x.sourceType,'class-feature')}
assert.equal(sql("SELECT count(*) FROM public.character_spells WHERE character_id="+i2jQ(i2jSig)+" AND raw_payload->>'signatureSpellRecharge'='short_rest_or_long_rest'"),'2');
console.log('PASS I2J-E01 fresh signed Signature spellbook overlay labels and canonical resource projection');
// Local fixture setup: independent long-rest resource plus existing canonical Signature assignment.
const i2jNonSig=sql("SELECT id FROM public.character_spells WHERE character_id="+i2jQ(i2jSig)+" AND spell_id="+i2jQ(wizardSpell(11)));
assert.match(i2jNonSig,/^[0-9a-f-]{36}$/);
sql("UPDATE public.character_spells SET uses_max=2,uses_remaining=1,recharge='long_rest',raw_payload=raw_payload||'{\"resourceLabel\":\"I2J unrelated resource\",\"resourceFeature\":\"I2J unrelated feature\"}'::jsonb WHERE id="+i2jQ(i2jNonSig));
const i2jSpellHash=()=>sql("SELECT md5(coalesce(string_agg(md5(to_jsonb(cs)::text),'' ORDER BY cs.id),'')) FROM public.character_spells cs WHERE character_id="+i2jQ(i2jSig));
const i2jBeforeOverlay=i2jSpellHash();
rejectedTransaction("UPDATE public.character_spells SET raw_payload=raw_payload||'{\"signatureSpell\":true}'::jsonb,uses_max=1,uses_remaining=1,recharge='short_rest' WHERE id="+i2jQ(i2jNonSig)+";","unrelated resource overlay",/Signature Spells cannot overwrite another limited-use resource/i);
assert.equal(i2jSpellHash(),i2jBeforeOverlay);
console.log('PASS I2J-E02 exact original overlay trigger rejects unrelated limited-use replacement and rolls back');
// Both requests share a real JWT; row lock prevents the same free use being consumed twice.
const i2jFree=i2jSignatures[0].assignmentId;
const i2jRace=await Promise.all([i2jUse(creator,i2jFree),i2jUse(creator,i2jFree)]);
assert.equal(i2jRace.filter(x=>!x.error).length,1);
denied(i2jRace.find(x=>x.error),'exhausted concurrent signature use','22023');
const i2jSpent=i2jSpellHash();
assert.equal(succeeded(await create(creator,'I2J-SIG-STORY',i2jSigPayload),'inert creation replay after spent Signature use'),i2jSig);
assert.equal(i2jSpellHash(),i2jSpent);
const i2jUsedSlot=succeeded(await i2jSlot(creator),'ordinary spell slot use');
const i2jSlot3=p=>p.slots.find(x=>x.poolKey==='spellcasting'&&x.slotLevel===3);
assert.equal(i2jSlot3(i2jUsedSlot).remaining,i2jSlot3(i2jUsedSlot).max-1);
console.log('PASS I2J-E03 concurrent signed consumption, exhaustion and nonce replay preserve counters');
const i2jShort=succeeded(await i2jDoRest(creator,'short_rest'),'signed short rest');
assert.equal(i2jShort.restResult.restoredSpellUses,1);
assert.equal(i2jShort.restResult.restoredSpellSlots,0);
assert.equal(i2jSignatureRows(i2jShort).find(x=>x.assignmentId===i2jFree).remaining,1);
assert.equal(i2jShort.limitedSpellUses.find(x=>x.assignmentId===i2jNonSig).remaining,1);
assert.equal(i2jSlot3(i2jShort).remaining,i2jSlot3(i2jShort).max-1);
assert.ok(i2jShort.lastShortRest);
succeeded(await i2jUse(creator,i2jFree),'spend restored Signature use');
const i2jLong=succeeded(await i2jDoRest(creator,'long_rest'),'signed long rest');
assert.equal(i2jLong.restResult.restoredSpellUses,2);
assert.equal(i2jLong.restResult.restoredSpellSlots,1);
assert.equal(i2jSignatureRows(i2jLong).find(x=>x.assignmentId===i2jFree).remaining,1);
assert.equal(i2jLong.limitedSpellUses.find(x=>x.assignmentId===i2jNonSig).remaining,2);
assert.equal(i2jSlot3(i2jLong).remaining,i2jSlot3(i2jLong).max);
assert.ok(i2jLong.lastLongRest);
assert.equal(sql("SELECT count(*) FROM public.character_rest_log WHERE character_id="+i2jQ(i2jSig)+" AND completed_by="+i2jQ(creator.id)),'2');
console.log('PASS I2J-E04 short/long recharge, unrelated long-rest resource, ordinary slot and rest-log isolation');
const i2jStable=i2jSpellHash();
denied(await i2jProfile(outsider),'outsider resource read','42501');
denied(await i2jUse(outsider,i2jFree),'outsider Signature use','42501');
denied(await i2jDoRest(outsider,'long_rest'),'outsider rest','42501');
denied(await i2jUse(creator,i2jSignatures[0].spellId),'spell id is not assignment id','P0002');
sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+i2jQ(i2jSig)+" AND user_id="+i2jQ(creator.id));
denied(await i2jProfile(creator),'revoked same JWT profile','42501');
denied(await i2jUse(creator,i2jFree),'revoked same JWT use','42501');
denied(await i2jDoRest(creator,'short_rest'),'revoked same JWT rest','42501');
assert.equal(i2jSpellHash(),i2jStable);
assert.equal(sql("SELECT count(*) FROM public.character_rest_log WHERE character_id="+i2jQ(i2jSig)),'2');
console.log('PASS I2J-E05 outsider/revoked JWT denial and no state/log mutation');
// Exact historical earned-choice helper extraction, NOT a full v5 completion or a live body claim.
const i2jGroup=i2jExtract(i2jBattle,'private.level_up_battle_master_maneuver_group_v1(');
const i2jApply=i2jExtract(i2jBattle,'private.apply_level_up_battle_master_maneuvers_v1(');
sql(i2jGroup);sql(i2jApply);
for(const sig of ['private.level_up_battle_master_maneuver_group_v1(uuid,integer)','private.apply_level_up_battle_master_maneuvers_v1(uuid,integer,jsonb,text)']){
 sql('REVOKE ALL ON FUNCTION '+sig+' FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION '+sig+' TO service_role');
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+i2jQ(sig)+",'EXECUTE')"),'f');
}
const i2jBM=bm3id;
const i2jSetLevel=level=>"UPDATE public.character_progression SET class_level="+level+" WHERE character_id="+i2jQ(i2jBM)+";";
const i2jBMCall=(level,group)=>"SELECT private.apply_level_up_battle_master_maneuvers_v1("+i2jQ(i2jBM)+","+level+","+i2jJson(group)+",'Battle Master');";
const i2jAvailable=level=>{
 const groups=JSON.parse(sql("SELECT private.level_up_battle_master_maneuver_group_v1("+i2jQ(i2jBM)+","+level+")"));
 assert.equal(groups.length,1);assert.equal(groups[0].metadata.delta,2);
 const fields=groups[0].fields;const options=fields.find(x=>x.id==='maneuvers').options.map(x=>x.key);
 assert.ok(options.length>=3);return {maneuvers:options.slice(0,2),replace:[fields.find(x=>x.id==='replace').options[0].key],with:[options[2]]};
};
sql(i2jSetLevel(6));
const i2jChoices7=i2jAvailable(7);
const i2jAccountSentinel={i2jLegacyFreeze:'must-not-change'};
sql("INSERT INTO public.players(user_id,name,sheet) VALUES("+i2jQ(creator.id)+",'I2J local account sentinel',"+i2jJson(i2jAccountSentinel)+") ON CONFLICT(user_id) DO UPDATE SET sheet=excluded.sheet");
const i2jAccountHash=()=>sql("SELECT md5(to_jsonb(p)::text) FROM public.players p WHERE user_id="+i2jQ(creator.id));
const i2jAccountBefore=i2jAccountHash(),i2jBMBefore=battleHash(i2jBM);
// Demonstrate historical mirror writer RED inside explicitly rolled-back local transaction.
const i2jRed=sql("BEGIN; "+i2jBMCall(7,i2jChoices7)+i2jSetLevel(7)+" SET CONSTRAINTS ALL IMMEDIATE; SELECT 'I2J_F_MIRROR_RED='||(sheet<>"+i2jJson(i2jAccountSentinel)+")::text FROM public.players WHERE user_id="+i2jQ(creator.id)+"; ROLLBACK;");
assert.match(i2jRed,/I2J_F_MIRROR_RED=true/);
assert.equal(i2jAccountHash(),i2jAccountBefore);assert.equal(battleHash(i2jBM),i2jBMBefore);
console.log('I2J-F01 HISTORICAL RED: earned maneuver helper mirrors canonical sheet to legacy account; rolled back');
// Owner Option A: one exact statement removed only in disposable function, retain original file.
const i2jMirror='  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);';
assert.equal(i2jApply.split(i2jMirror).length,2);
sql(i2jApply.replace(i2jMirror,'  -- I2J scratch Option A: do not write legacy account sheet.'));
const i2jBad={...i2jChoices7,with:[i2jChoices7.maneuvers[0]]};
rejectedTransaction(i2jBMCall(7,i2jBad)+i2jSetLevel(7),'replacement conflicts with acquisition',/replacement maneuver must be different/i);
assert.equal(battleHash(i2jBM),i2jBMBefore);assert.equal(i2jAccountHash(),i2jAccountBefore);
for(const [prev,next,count] of [[6,7,5],[9,10,7],[14,15,9]]){
 if(prev!==6)sql(i2jSetLevel(prev));
 const choices=i2jAvailable(next);
 sql('BEGIN; '+i2jBMCall(next,choices)+i2jSetLevel(next)+' COMMIT;');
 assert.equal(battleGrants(i2jBM),count);
 assert.equal(sql("SELECT count(DISTINCT option_catalog_id) FROM public.character_class_option_grant_instances WHERE character_id="+i2jQ(i2jBM)),String(count));
 assert.equal(sql("SELECT count(*) FROM public.character_class_option_grant_instances WHERE character_id="+i2jQ(i2jBM)+" AND acquired_level="+next),'2');
 assert.equal(sql("SELECT count(*) FROM public.character_class_option_grant_instances WHERE character_id="+i2jQ(i2jBM)+" AND metadata->>'lastReplacementLevel'="+i2jQ(next)),'1');
 assert.equal(i2jAccountHash(),i2jAccountBefore);
 console.log('PASS I2J-F02 level '+next+' exact helper acquisition/replacement and scratch Option A freeze, reduced catalog');
}
assert.equal(sql("SELECT count(*) FROM public.class_feature_option_catalog WHERE option_type='battle-master-maneuver' AND source='XPHB'"),'12');
console.log('I2J I1EF RESULT: signed historical resource RPCs and privileged historical helper RED/scratch Option A GREEN; full v5, remaining 8 source identities, live predicates, mounted browser and production release HOLD');
