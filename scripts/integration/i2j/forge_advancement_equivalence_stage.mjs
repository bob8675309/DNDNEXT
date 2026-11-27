// This stage depends on the unchanged signed replacement stage running first.
const {verifyEquivalenceSources,readWarlockEquivalence,writeEquivalenceReceipt}
 = await import('./scripts/integration/i2j/forge_advancement_equivalence.mjs');
const equivalenceSource=verifyEquivalenceSources();
const equivalenceWarlock=seed();
const equivalenceInput=()=>input(agon,mind,eb);
latestRemovalCheck='EQUIV-setup';
await deny(editor,equivalenceWarlock,input(agon,mind),/requires exactly one dependent choice/i,'P0001');
await deny(editor,equivalenceWarlock,input(agon,mind,ordinaryIds[0]),/requires a preferred Warlock damage cantrip/i,'P0001');
await deny(editor,equivalenceWarlock,input(mind,mind),/not repeatable and is already known/i,'P0001');
assert.ifError((await apply(editor,equivalenceWarlock,equivalenceInput())).error);
final(equivalenceWarlock,[agon,mind],{1:eb});
const afterEquivalence=replacementSnapshot(equivalenceWarlock);
assert.ok((await apply(editor,equivalenceWarlock,equivalenceInput())).error);
assert.deepEqual(replacementSnapshot(equivalenceWarlock),afterEquivalence);
assert.equal(md5(signedV5Name),'02d74b973a763c53c595be20e35e512f');
assert.equal(triggerSnapshot(),triggers);
writeEquivalenceReceipt(env.RUNNER_TEMP+'/i2j-advancement-equivalence.json','advancement',{
 earned:readWarlockEquivalence(sql,equivalenceWarlock.id,equivalenceSource),
 rejections:['omitted-child','invalid-child','duplicate-invocation','repeated-submission'],
 replacementStages:['REPLACE-01','REPLACE-02','REPLACE-03','REPLACE-04','REPLACE-05','REPLACE-06','REPLACE-07']
});
