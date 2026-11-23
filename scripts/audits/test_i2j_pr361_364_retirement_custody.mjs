// Exact inherited original PR #361–364 research custody in descendant PR #371.
// Pure source-byte audit only, NEVER DB, deployment, GitHub API or PR close.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/research/I2J_PR361_364_RETIREMENT_CROSSWALK_2026-11-23.json'),'utf8'));
const sha=(b)=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
test('I2J-C0 source register pins complete 4-PR ancestry, not release',()=>{
 assert.equal(manifest.schema_version,'i2j-retirement-crosswalk-pr361-364-v1');
 assert.equal(manifest.successor.pr,371);
 assert.equal(manifest.successor.head,'6db27e720d0c2788774cc37d2f85d14244e61b95');
 assert.equal(manifest.main_at_audit,'bb3939eeb9a38cf416996a1dca3b196b156b2915');
 assert.equal(manifest.original_changed_file_occurrences,28);
 assert.equal(manifest.entries.length,28);
 assert.deepEqual(manifest.dispositions_expected,{exact_copy:19,deferred_preserved:8,superseded_with_source_test:1});
 assert.equal(manifest.release_authorized,false);
 assert.equal(manifest.pr_retirement_authorized,false);
 const heads={
  361:'99f8000994fd9194ebe21ab0801636ad24ad6760',
  362:'61f7e8f109f5327049cd1dc7f62322f13e891a2b',
  363:'0c413bc5b0d1378a55891f070f76e74394bd0044',
  364:'f969af0a15cc8a7e517808cb2eeeefea3119f6fd'
 };
 for(const [n,ref] of Object.entries(heads)){
  assert.equal(manifest.original_prs[n].sha,ref);
  assert.equal(manifest.entries.filter(x=>x.original_pr===Number(n)).length,7);
  assert.equal(manifest.original_prs[n].original_exact_head_actions_conclusion,'success');
 }
 assert.equal(new Set(manifest.entries.map(x=>x.original_pr+':'+x.path)).size,28);
});
for(const row of manifest.entries){
 test('I2J-C '+row.original_pr+' '+row.path,()=>{
  assert.ok(['exact_copy','deferred_preserved','superseded_with_source_test'].includes(row.disposition));
  const local=fs.readFileSync(path.join(root,row.path));
  if(row.disposition==='exact_copy'){
   assert.equal(row.original_blob,row.successor_blob);
   assert.equal(sha(local),row.original_blob,'Original Git blob changed: '+row.path);
  } else if(row.disposition==='deferred_preserved'){
   const spec=row.verification;
   assert.ok(Number.isInteger(spec.bytes)&&spec.bytes>0&&local.length>=spec.bytes);
   const historical=spec.slice==='prefix'?local.subarray(0,spec.bytes):
    spec.slice==='suffix'?local.subarray(local.length-spec.bytes):null;
   assert.ok(historical,'Unknown living handoff preservation mode');
   assert.equal(sha(historical),row.original_blob,'Entire original living doc not preserved: '+row.path);
  } else {
   assert.equal(row.original_pr,361);
   assert.equal(row.path,'scripts/test_i1g_warlock_original_guards_joint_local_auth.mjs');
   assert.equal(sha(local),row.verification.expected_successor_blob);
   const source=local.toString('utf8');
   const start=source.indexOf('          // I1-M is a separate signed research extension');
   const marker=source.indexOf('            console.log("I1M RESULT:',start);
   const end=source.indexOf('\n',marker);
   assert.ok(start>=0&&marker>start&&end>marker);
   const originalBlock=Buffer.from(source.slice(start,end),'utf8');
   assert.equal(originalBlock.length,8167);
   assert.equal(sha(originalBlock),row.verification.original_block_blob,'I1-M signed core changed');
   for(let i=1;i<=6;i++)assert.match(source,new RegExp('PASS I1M-0'+i));
   for(let i=1;i<=7;i++)assert.match(source,new RegExp('PASS I1O-0'+i));
  }
 });
}
test('I2J-C29 downstream research remains held; original signed fixtures not released',()=>{
 assert.equal(manifest.source_only,true);
 assert.equal(manifest.successor.held_research,true);
 assert.ok(manifest.closure_requirements.some(s=>s.includes('explicit approval')));
 assert.ok(manifest.closure_requirements.some(s=>s.includes('22/34')));
});
