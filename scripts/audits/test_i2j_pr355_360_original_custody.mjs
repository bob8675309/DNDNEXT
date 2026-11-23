// I2J PR355–360 original source custody. T0 ONLY; no SQL/PR closure.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const data=JSON.parse(fs.readFileSync(path.join(root,'docs/research/I2J_PR355_360_ORIGINAL_CUSTODY_2026-11-23.json'),'utf8'));
const gitBlob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
test('I2J-K0 exact 6 originals, non-deployed held successor, closure prohibition',()=>{
 assert.equal(data.schema_version,'i2j-pr355-360-original-custody-v1');
 assert.equal(data.successor.head,'6db27e720d0c2788774cc37d2f85d14244e61b95');
 assert.equal(data.main_at_review,'bb3939eeb9a38cf416996a1dca3b196b156b2915');
 assert.equal(data.entries.length,38);
 assert.deepEqual(data.counts,{total:38,exact_copy:22,deferred_preserved:10,superseded_with_source_test:6});
 assert.equal(data.retirement_approved,false);
 assert.equal(data.production_release_allowed,false);
 assert.equal(new Set(data.entries.map(x=>x.pr+':'+x.path)).size,38);
 const refs={355:'71840f27c68f5e34937b91f95ed88d3859ba06c4',356:'f6fe276a305e292ed343b1bae122924983fedc2d',357:'57730a4ae1e8a577ff88f2ab0f108188fa170bed',358:'969dd5b00ed4b8dc4491fed412e37288e4d5fdbf',359:'d0f6aad93772cbadee5c5547b37cbaf18de3ddd2',360:'4763a00a6a9afc387090b2853754dd22a7544b80'};
 for(const [n,head] of Object.entries(refs)){
  assert.equal(data.original_prs[n].head,head);
  assert.equal(data.entries.filter(x=>x.pr===Number(n)).length,(n==='355'||n==='360')?7:6);
 }
});
for(const row of data.entries){
 test('I2J-K '+row.pr+' '+row.path,()=>{
  const bytes=fs.readFileSync(path.join(root,row.path));
  if(row.disposition==='exact_copy'){
   assert.equal(row.original_blob,row.successor_blob);
   assert.equal(gitBlob(bytes),row.original_blob);
  }else if(row.disposition==='deferred_preserved'){
   const p=row.proof;
   assert.ok(bytes.length>=p.length);
   const original=p.method==='whole_utf8_suffix'?bytes.subarray(-p.length):
    p.method==='whole_utf8_prefix'?bytes.subarray(0,p.length):null;
   assert.ok(original,'Historical handoff mode not recognized');
   assert.equal(gitBlob(original),row.original_blob);
   assert.equal(gitBlob(original),p.sha);
  }else if(row.disposition==='superseded_with_source_test'){
   assert.equal(row.path,'scripts/test_i1g_warlock_original_guards_joint_local_auth.mjs');
   assert.equal(gitBlob(bytes),row.successor_blob);
   const p=row.proof,src=bytes.toString('utf8');
   const i=src.indexOf(p.start);
   const result=src.indexOf('console.log("'+p.tag+' RESULT:',i);
   const end=src.indexOf('\n',result);
   assert.ok(i>=0&&result>i&&end>result,'Original signed test core absent');
   const original=Buffer.from(src.slice(i,end),'utf8');
   assert.equal(original.length,p.length);
   assert.equal(gitBlob(original),p.sha,'Original signed RED/negative core changed');
   assert.match(src,new RegExp('PASS '+p.tag+'-0[1-9]'));
  }else assert.fail('Original source entry left without a valid custody disposition');
 });
}
test('I2J-K39 source-only historical runs cannot count as release, and closure needs approval',()=>{
 assert.equal(data.source_preservation_only,true);
 assert.equal(data.retirement_approved,false);
 assert.equal(data.production_release_allowed,false);
 assert.equal(Object.keys(data.original_prs).length,6);
});
