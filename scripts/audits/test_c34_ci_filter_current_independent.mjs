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

// Literal inventory is a lower bound, not a shell parser or transitive graph.
export function inventory(source) {
  const paths = [...new Set(source.match(/(?:scripts|sql|supabase|pages|components|lib|utils|docs|\.github)\/[A-Za-z0-9_./-]+\.(?:mjs|cjs|js|jsx|ts|tsx|sql|json|md|yml|yaml|sh|html|css|scss)\b/g) || [])].sort();
  const dynamicLines = source.split('\n').flatMap((line,i) =>
    /\$\{|\$\(|\b(?:eval|source|find|xargs|npm|npx|docker)\b/.test(line) ? [i+1] : []);
  return {paths, dynamicLines, closureProven:false, bypassAuthorized:false};
}
const inv = inventory(bytes.toString('utf8'));
for (const p of [
 'scripts/integration/c34/validate_source_contract.mjs',
 'scripts/integration/c34/validate_joint_fixture_blobs.mjs',
 'scripts/integration/c34/test_joint_pg17_local_auth.mjs',
 'scripts/browser/verify_c33_creator_backstory_dom.mjs'
]) assert.ok(inv.paths.includes(p), p);
assert.ok(inv.paths.some(p=>p.endsWith('.sql')), 'SQL references');
assert.ok(inv.dynamicLines.length>0, 'dynamic commands remain unresolved');
assert.equal(inv.closureProven,false);
assert.equal(inv.bypassAuthorized,false);
assert.equal(inventory('node $SCRIPT').bypassAuthorized,false);
assert.equal(inventory('').closureProven,false);
assert.deepEqual(inventory('node scripts/a.mjs\nnode scripts/a.mjs').paths,['scripts/a.mjs']);
console.log('11 literal inventory assertions passed; '+inv.paths.length+' literal paths; closure NOT PROVEN');

// Checkout provenance is a conservative literal inventory, not shell resolution.
export function checkoutInventory(source) {
  const historical = [];
  const currentOrUnresolved = [];
  const checkoutBlocks = [...source.matchAll(/^[ \t]*uses: actions\/checkout@[^\n]+/gm)];
  // Explicit historical path/ref pair is pinned by the exact-byte fixture.
  const pinned = /ref: ([0-9a-f]{40})\s*\n\s*path: held345\b/.exec(source);
  for (const line of source.split('\n')) {
    const paths = inventory(line).paths;
    for (const path of paths) {
      // Only explicit held345/ prefixes qualify; cwd, variables and copies remain unresolved.
      if (pinned && line.includes('held345/'+path))
        historical.push({path,ref:pinned[1]});
      else currentOrUnresolved.push(path);
    }
  }
  return {historical,currentOrUnresolved,checkoutCount:checkoutBlocks.length,
    historicalRef:pinned?.[1] ?? null,closureProven:false,bypassAuthorized:false};
}
const provenance = checkoutInventory(bytes.toString('utf8'));
assert.equal(provenance.historicalRef,'4f5f8ff7587aff1a68f21581ad68a4752789f54a');
assert.equal(provenance.checkoutCount,2);
assert.ok(provenance.currentOrUnresolved.includes('scripts/integration/c34/test_joint_pg17_local_auth.mjs'));
const synthetic = 'ref: '+provenance.historicalRef+'\n  path: held345\nnode held345/scripts/a.mjs\nnode scripts/b.mjs';
assert.deepEqual(checkoutInventory(synthetic).historical,[{path:'scripts/a.mjs',ref:provenance.historicalRef}]);
assert.deepEqual(checkoutInventory(synthetic).currentOrUnresolved,['scripts/b.mjs']);
assert.equal(checkoutInventory('node held345/scripts/a.mjs').historical.length,0);
assert.equal(checkoutInventory(synthetic).bypassAuthorized,false);
assert.equal(provenance.closureProven,false);
console.log('8 checkout provenance assertions passed; closure NOT PROVEN');

// Record cwd and variable evidence without pretending to resolve shell execution.
export function checkoutContextEvidence(source) {
  const historicalCwd = [], unresolved = [];
  for (const [i,line] of source.split('\n').entries()) {
    if (/\bcd\s+held345\s*&&/.test(line))
      historicalCwd.push({line:i+1,paths:inventory(line).paths});
    if (/\b(?:cd|source|eval)\b|\bworking-directory:|\$[A-Za-z_{(]/.test(line))
      unresolved.push(i+1);
  }
  return {historicalCwd,unresolved,closureProven:false,bypassAuthorized:false};
}
const cwdEvidence=checkoutContextEvidence(bytes.toString('utf8'));
assert.ok(cwdEvidence.historicalCwd.some(x=>x.paths.includes('scripts/browser/verify_c33_creator_backstory_dom.mjs')));
assert.ok(cwdEvidence.historicalCwd.some(x=>x.paths.includes('scripts/browser/verify_c33_next_town_route.mjs')));
assert.ok(cwdEvidence.unresolved.length>0);
const cwdSynthetic=checkoutContextEvidence('(cd held345 && node scripts/a.mjs)\nnode "$SCRIPT"\nworking-directory: held345\nnode scripts/b.mjs');
assert.deepEqual(cwdSynthetic.historicalCwd,[{line:1,paths:['scripts/a.mjs']}]);
assert.deepEqual(cwdSynthetic.unresolved,[1,2,3]);
assert.equal(cwdSynthetic.closureProven,false);
assert.equal(cwdSynthetic.bypassAuthorized,false);
assert.equal(checkoutContextEvidence('').bypassAuthorized,false);
console.log('8 checkout context evidence assertions passed; closure NOT PROVEN');
