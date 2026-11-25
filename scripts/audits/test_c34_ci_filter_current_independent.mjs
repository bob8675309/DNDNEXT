// Issue #389 review-only model. Exact-byte fixture pinned; dependency closure pending.
// Never use this model to authorize a live skip or infer signed acceptance.
import assert from 'node:assert/strict';
export const blob = '7343fcffdca0ee76c0785b6e9e341b48a7951d2e';
export const job = 'signed-real-original-research';
const pushRef = 'refs/heads/research/c34-clean-main-privacy-forge-joint-source-20261112';
const census = 'scripts/integration/c34/test_t46_p3_p4b_c2b13_merchant_writer_census.mjs';
export function classify(e = {}) {
  const full = {recommendation:'full', signedAcceptance:false, job};
  if (e.event === 'pull_request' && e.sameRepo !== true)
    return {...full, recommendation:'preserve-trust-restriction', eligible:false};
  if (e.event === 'push' && e.ref !== pushRef)
    return {...full, recommendation:'preserve-trigger-restriction', eligible:false};
  if (!['push','pull_request','workflow_dispatch'].includes(e.event))
    return {...full, eligible:false};
  const result = {...full, eligible:true};
  if (e.event === 'workflow_dispatch' || e.attempt !== 1 || e.cancelled !== false ||
      e.forcePush !== false || e.baseStable !== true || e.complete !== true ||
      e.workflowBlob !== blob || !Array.isArray(e.files) || !e.files.length ||
      e.files.length >= 300 || e.total !== e.files.length) return result;
  if (!e.files.every(f => f && f.status === 'modified' &&
      (f.path === census || /^docs\/[A-Za-z0-9_/-]+\.md$/.test(f.path)))) return result;
  // No dependency closure or required-check authorization established yet.
  return {...result, sourceOnlyCandidate:true};
}
const base = {event:'pull_request',sameRepo:true,attempt:1,cancelled:false,
 forcePush:false,baseStable:true,complete:true,workflowBlob:blob,total:1,
 files:[{path:census,status:'modified'}]};
const cases = [
 ['census',{},'full',true],['docs',{files:[{path:'docs/a.md',status:'modified'}]},'full',true],
 ['fork',{sameRepo:false},'preserve-trust-restriction'],['unknown trust',{sameRepo:undefined},'preserve-trust-restriction'],
 ['push',{event:'push',ref:pushRef},'full',true],['other push',{event:'push',ref:'refs/heads/main'},'preserve-trigger-restriction'],
 ['manual',{event:'workflow_dispatch'},'full'],['rerun',{attempt:2},'full'],
 ['cancelled',{cancelled:true},'full'],['missing',{files:undefined},'full'],
 ['truncated',{complete:false},'full'],['count mismatch',{total:2},'full'],
 ['oversized',{files:Array(300).fill(base.files[0]),total:300},'full'],
 ['base drift',{baseStable:false},'full'],['force push',{forcePush:true},'full'],
 ['blob drift',{workflowBlob:'old'},'full'],['unknown event',{event:'pull_request_target'},'full'],
 ['rename',{files:[{path:census,status:'renamed'}]},'full'],
 ['delete',{files:[{path:census,status:'removed'}]},'full'],
 ...['sql/a.sql','scripts/fixtures/a.sql','.github/workflows/validate-c34-joint-local-auth.yml','package-lock.json','scripts/integration/c34/test_joint_pg17_local_auth.mjs'].map(path=>[path,{files:[{path,status:'modified'}]},'full']),
 ['mixed',{files:[...base.files,{path:'sql/a.sql',status:'modified'}],total:2},'full'],
 ['same-name success',{checkName:job,conclusion:'success'},'full',true]
];
for (const [name,patch,want,candidate] of cases) {
 const got=classify({...base,...patch});
 assert.equal(got.recommendation,want,name);
 assert.equal(got.signedAcceptance,false,name);
 assert.equal(Boolean(got.sourceOnlyCandidate),Boolean(candidate),name);
 assert.equal(got.job,job,name);
}
console.log(cases.length+' review-only cases passed; signed acceptance NOT RUN');

import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
function gitBlob(bytes) {
  return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
const bytes=readFileSync(new URL('./fixtures/c34-current-signed-workflow.yml.txt',import.meta.url));
assert.equal(gitBlob(bytes),blob,'exact signed workflow fixture');
assert.notEqual(gitBlob(Buffer.concat([bytes,Buffer.from('\n')])),blob,'modified bytes must invalidate lock');
console.log('2 exact-byte source lock assertions passed; signed acceptance NOT RUN');
