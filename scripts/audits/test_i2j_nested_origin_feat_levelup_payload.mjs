// Source-only test of current level-up component serialization; no browser, DB or RPC.
// Import only pinned existing pure utilities in an isolated temporary ESM directory.
// No original source is edited. The group fixture models the observed SQL result shape.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=new URL('../../',import.meta.url);
const pins=Object.freeze({
  "components/CharacterLevelUpChoices.js": "3fa76acd1811a77b0c3e93711906bfb5afb17584",
  "utils/playerForgeFeatChoices.js": "6752620d41a8aa29b4391dc44158c71c968613f9",
  "utils/featSourceChoiceNormalization.js": "11d685d92d339210f4f1cb04b4eb9120822e7e55",
  "utils/playerForgeSourceChoices.js": "90987911dd8743bf00a01b379998b552f9ae6da5",
  "utils/characterCreation.js": "cc34ebd68ec9cf446eb37bf1a61e0231cc3989bc",
  "utils/craftingProfessions.js": "0b69defb7683b84a5b8d15ecfeb5f215107a18a1",
  "utils/classFeatureChoiceConstants.js": "9494908c9e35163f19f6d50ac23f62c7a8d34cd2",
  "utils/playerFacingText.js": "f674e235bb9ba717730c75bbcbe466056a1b5378",
  "sql/20260808_26_earned_warlock_invocation_progression.sql": "e32062499f2e3b40ce2be38c22fa4f1cafa90f3c",
  "scripts/fixtures/i1g_warlock_invocation_joint_setup_pg17.sql": "fe3a95f0562ddf804b10ef1938af383d09e74ea1"
});
const sources={};
for(const [p,h] of Object.entries(pins)){
 const b=readFileSync(new URL(p,root));
 assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),h,p);
 sources[p]=b.toString('utf8');
}
const temp=mkdtempSync(join(tmpdir(),'i2j-origin-payload-'));
after(()=>rmSync(temp,{recursive:true,force:true}));
const modules=Object.keys(pins).filter(p=>p.startsWith('utils/'));
const allowed=new Set(modules.map(p=>basename(p,'.js')));
for(const p of modules){
 const content=sources[p].replace(/(from\s*["'])\.\/([A-Za-z0-9_]+)(["'])/g,(_,a,n,c)=>{
  assert.ok(allowed.has(n),'unknown utility dependency '+n);
  return a+'./'+n+'.mjs'+c;
 });
 writeFileSync(join(temp,basename(p,'.js')+'.mjs'),content,{flag:'wx'});
}
const component=sources['components/CharacterLevelUpChoices.js'];
function sliceOnce(source,start,end){
 const i=source.indexOf(start),j=source.indexOf(end,i+start.length);
 assert.ok(i>=0&&j>i,'missing component anchor');
 assert.equal(source.indexOf(start,i+start.length),-1,'ambiguous component anchor');
 return source.slice(i,j);
}
const helper=sliceOnce(component,'function classOptionFeatInstances(','function sourceChoiceSpellId(');
const request=sliceOnce(component,'    const selections = {\n      hp_method: hpMethod,','    let result = await supabase.rpc("complete_character_level_up_v5"');
writeFileSync(join(temp,'component-pure.mjs'),
 helper+'\nexport {classOptionFeatInstances};\n'+
 'export function buildRequest({hpMethod,subclassChoice,selectedSubclass,spellChoices,classChoiceSelections,classOptionFeatPayload,replacementSelections,advancementChoice,advancementModel}){\n'+
 request+'\nreturn selections;\n}\n',{flag:'wx'});
const load=n=>import(pathToFileURL(join(temp,n+'.mjs')).href);
const {classOptionFeatInstances,buildRequest}=await load('component-pure');
const {buildFeatSourceChoiceGroups,featInstanceSummaries}=await load('playerForgeFeatChoices');
const {normalizeFeatSourceChoiceGroups}=await load('featSourceChoiceNormalization');
const {normalizeSourceChoiceSelections,sourceChoiceGroupsComplete}=await load('playerForgeSourceChoices');

const lessons='optional-feature:lessons-of-the-first-ones|XPHB';
const armor='optional-feature:armor-of-shadows|XPHB';
const mind='optional-feature:eldritch-mind|XPHB';
const child='child-lessons-of-the-first-ones';
const alert='735de8f5-94b0-4052-a7b2-8ae15ac9a55c';
const lucky='5003a12b-94e2-45db-bcc2-3eeff78c0587';
const invocations=[
 [lessons,'Lessons of the First Ones','4b6c5d12-bed8-4300-af40-dbda401ab600'],
 [armor,'Armor of Shadows','3abe1beb-5669-46a8-9743-49a47b8de126'],
 [mind,'Eldritch Mind','c6f61c62-d36c-4a9b-b44a-cbafd4ff47d0']
].map(([key,label,id])=>({key,value:key,label,source:'XPHB',kind:'eldritch-invocation',metadata:{optionId:id}}));
const featOptions=[[alert,'Alert'],[lucky,'Lucky']].map(([id,label])=>({
 key:id,value:id,label,source:'XPHB',kind:'feat',
 // The historical seed verifies ids, labels and category only; optionKey is
 // deliberately null, not guessed catalogue metadata. No-choice metadata reduced.
 metadata:{optionId:id,optionKey:null,category:'O',featMetadata:{},rawPayload:{},distinctInvocationOptionKey:lessons}
}));
const group=n=>{
 const id='warlock-invocation-slot-'+n;
 return {id,ownerType:'class-option',ownerKey:'warlock-invocation-'+n,label:'Eldritch Invocation '+n,source:'XPHB',placement:'class',level:2,
  fields:[
   {id:'invocation',label:'Invocation '+n,kind:'eldritch-invocation',count:1,required:true,options:invocations},
   {id:child,label:'Lessons of the First Ones: Origin feat',kind:'feat',count:1,required:true,options:featOptions,
    activeWhen:{groupId:id,fieldId:'invocation',values:[lessons]}}
  ],metadata:{family:'eldritch-invocation',slot:n,acquisitionLevel:2}};
};
const groups=[group(2),group(3)];
const slot2=groups[0].id,slot3=groups[1].id;
const spellChoices=[{spell_id:'00000000-0000-4000-8000-000000000001',prepared:true}];
function selection(a=lessons,b=mind,c=alert,d){
 return {[slot2]:{invocation:[a],...(c?{[child]:[c]}:{})},[slot3]:{invocation:[b],...(d?{[child]:[d]}:{})}};
}
function compile(raw,featRaw={}){
 const normalized=normalizeSourceChoiceSelections(groups,raw);
 const rows=classOptionFeatInstances(groups,normalized,2);
 const nested=normalizeFeatSourceChoiceGroups(buildFeatSourceChoiceGroups({featInstances:rows,toolRows:[],spells:[],metamagicOptions:[],level:2}));
 const normalizedFeat=normalizeSourceChoiceSelections(nested,featRaw);
 const complete=sourceChoiceGroupsComplete(groups,normalized)&&sourceChoiceGroupsComplete(nested,normalizedFeat);
 const summaries=featInstanceSummaries(nested,normalizedFeat);
 // Model the component readiness gate; the actual JSX/render and RPC remain unexecuted.
 const payload=complete?buildRequest({hpMethod:'fixed',subclassChoice:false,selectedSubclass:null,spellChoices,classChoiceSelections:normalized,classOptionFeatPayload:summaries,replacementSelections:{},advancementChoice:false,advancementModel:null}):null;
 return {normalized,rows,nested,summaries,complete,payload};
}
test('I2J-OF-PAYLOAD-01 immutable sources and existing catalogue identities',()=>{
 const seed=sources['scripts/fixtures/i1g_warlock_invocation_joint_setup_pg17.sql'];
 for(const id of [alert,lucky,...invocations.map(o=>o.metadata.optionId)])assert.ok(seed.includes(id),'missing fixture identity '+id);
 const sql=sources['sql/20260808_26_earned_warlock_invocation_progression.sql'];
 for(const t of ["'acquisitionOwnerKey'=v_group_id","instance->>'optionId'=v_feat_id::text","'invocation-'||v_group_id||'-origin-feat'","'class_option_feat_instances'"])assert.ok(sql.includes(t),t);
 assert.ok(component.includes('() => featInstanceSummaries(classOptionFeatGroups, classOptionFeatSelections)'));
 assert.ok(component.includes('() => sourceChoiceGroupsComplete(classOptionFeatGroups, classOptionFeatSelections)'));
});
test('I2J-OF-PAYLOAD-02 no-choice Alert produces exact level-up parent and nested identity',()=>{
 const x=compile(selection());
 assert.equal(x.complete,true);
 assert.equal(x.rows.length,1);
 assert.equal(x.nested.length,1);
 assert.equal(x.nested[0].fields.length,0);
 const s=x.payload.class_option_feat_instances[0];
 assert.equal(s.optionId,alert);assert.equal(s.name,'Alert');assert.equal(s.source,'XPHB');assert.equal(s.category,'O');
 assert.equal(s.acquisitionOwnerType,'class-option');assert.equal(s.acquisitionOwnerKey,slot2);
 assert.equal(s.acquisitionLevel,2);
 assert.equal(s.instanceId,'level-2-warlock-invocation-slot-2-child-lessons-of-the-first-ones');
 assert.deepEqual(s.choices,{});assert.deepEqual(s.fixedEffects,[]);assert.deepEqual(s.fixedSpellTokens,[]);
 assert.deepEqual(x.payload.spell_choices,spellChoices);
 assert.deepEqual(x.payload.class_choice_selections[slot2][child],[alert]);
 assert.deepEqual(x.payload.replacement_selections,{});
 assert.equal(x.payload.hp_method,'fixed');
 assert.equal('advancement_instance' in x.payload,false);
});
test('I2J-OF-PAYLOAD-03 missing required dependent choice is incomplete',()=>{
 const x=compile(selection(lessons,mind,null));
 assert.equal(x.complete,false);assert.equal(x.payload,null);assert.equal(x.rows.length,0);
});
test('I2J-OF-PAYLOAD-04 unknown catalogue child is normalized out',()=>{
 const x=compile(selection(lessons,mind,'00000000-0000-4000-8000-000000000099'));
 assert.deepEqual(x.normalized[slot2][child],[]);assert.equal(x.complete,false);assert.equal(x.payload,null);
});
test('I2J-OF-PAYLOAD-05 changing parent discards inactive dependent feat',()=>{
 const x=compile(selection(armor,mind,alert));
 assert.equal(x.complete,true);assert.deepEqual(x.normalized[slot2][child],[]);
 assert.deepEqual(x.payload.class_option_feat_instances,[]);
});
test('I2J-OF-PAYLOAD-06 distinct slot ownership and deterministic payload',()=>{
 const x=compile(selection(lessons,lessons,alert,lucky));
 assert.equal(x.complete,true);const s=x.payload.class_option_feat_instances;
 assert.deepEqual(s.map(r=>r.optionId),[alert,lucky]);
 assert.deepEqual(s.map(r=>r.acquisitionOwnerKey),[slot2,slot3]);
 assert.equal(new Set(s.map(r=>r.instanceId)).size,2);
 assert.deepEqual(compile(selection(lessons,lessons,alert,lucky)).payload,x.payload);
});
test('I2J-OF-PAYLOAD-07 no signed or production claim',()=>{
 assert.deepEqual(compile(selection()).payload,compile(selection()).payload);
 console.log('I2J-OF-PAYLOAD source-only: actual component helper + pure utilities + RPC payload assembly; synthetic group/catalog shape, no React, signed Auth, SQL, or release acceptance');
});
