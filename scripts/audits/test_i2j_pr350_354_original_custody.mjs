// Source-only original custody; never invoke the inherited signed harnesses here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const d=JSON.parse(fs.readFileSync(path.join(root,'docs/research/I2J_PR350_354_ORIGINAL_CUSTODY_2026-11-24.json'),'utf8'));
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const expected={"350":{"head":"503e95a1cc1ee7151b5f16f8de60a45645bb818c","base":"4f5f8ff7587aff1a68f21581ad68a4752789f54a","run":42740782047,"job":129580999844},"351":{"head":"5561d0e5e941f44d6a2f2e4fea99166ba92fdcc7","base":"503e95a1cc1ee7151b5f16f8de60a45645bb818c","run":42754079207,"job":129624259496},"352":{"head":"79c9607d12c6bc186f8208d9a3e715242060d806","base":"5561d0e5e941f44d6a2f2e4fea99166ba92fdcc7","run":42756702918,"job":129632636942},"353":{"head":"2b10b86f1237de484974d686acbd16d47c29a1d6","base":"79c9607d12c6bc186f8208d9a3e715242060d806","run":42759971826,"job":129643101363},"354":{"head":"83aa403c725b3a05e6f32b1623801b8ffccf64b8","base":"2b10b86f1237de484974d686acbd16d47c29a1d6","run":42763237930,"job":129653616140}};
test('I2J-L00 exact original heads, scope, and owner-gated holds',()=>{
 assert.equal(d.schema_version,'i2j-pr350-354-original-custody-v1');
 assert.equal(d.successor.head,'6db27e720d0c2788774cc37d2f85d14244e61b95');
 assert.equal(d.main_at_review,'bb3939eeb9a38cf416996a1dca3b196b156b2915');
 assert.deepEqual(d.counts,{total:23,exact_copy:23});
 assert.equal(d.entries.length,23);
 assert.equal(new Set(d.entries.map(x=>x.pr+':'+x.path)).size,23);
 assert.equal(d.source_preservation_only,true);
 assert.equal(d.full_inherited_semantic_review_complete,false);
 assert.equal(d.retirement_approved,false);
 assert.equal(d.production_release_allowed,false);
 assert.deepEqual(Object.keys(d.original_prs),Object.keys(expected));
 for(const [n,e] of Object.entries(expected)){
  const p=d.original_prs[n];
  assert.equal(p.head,e.head);assert.equal(p.base,e.base);
  assert.equal(p.success_signed_ci_run,e.run);assert.equal(p.signed_job,e.job);
  assert.equal(p.ancestor_of_successor,true);
  assert.equal(d.entries.filter(x=>x.pr===+n).length,({350:3,351:4,352:6,353:5,354:5})[n]);
 }
});
for(const r of d.entries)test('I2J-L '+r.pr+' '+r.path,()=>{
 assert.equal(r.disposition,'exact_copy');
 assert.equal(r.original_blob,r.successor_blob);
 assert.equal(r.original_blob,r.independent_precommit_blob);
 const bytes=fs.readFileSync(path.join(root,r.path));
 assert.equal(blob(bytes),r.original_blob);
 const altered=Buffer.concat([bytes,Buffer.from('\n')]);
 assert.notEqual(blob(altered),r.original_blob,'modified bytes must fail source pin');
});
test('I2J-L24 original negative source markers retained (static only)',()=>{
 const source=p=>fs.readFileSync(path.join(root,p),'utf8');
 assert.match(source('scripts/test_i1b_forge_private_story_nonce_local_auth.mjs'),/KNOWN INTEGRATION GAP I1B-03/);
 assert.match(source('scripts/test_i1c_forge_private_story_nonce_local_auth.mjs'),/PASS I1C-03: changed-only Story rejects 22023/);
 assert.match(source('scripts/test_i1d_forge_story_inventory_joint_local_auth.mjs'),/PASS I1D-03: obsolete NOT VALID CHECK/);
 assert.match(source('scripts/test_i1e_wizard_original_finalizer_joint_local_auth.mjs'),/PASS I1E-05: missing level20 Signature choice/);
 assert.match(source('scripts/test_i1f_battle_master_original_joint_local_auth.mjs'),/PASS I1F-07: original deferred validator forbids/);
});
