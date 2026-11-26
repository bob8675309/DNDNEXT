// Research-only synthetic manifest verifier. No live bypass or signed acceptance.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sha = s => createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const oid = s => typeof s === 'string' && /^[0-9a-f]{40}$/.test(s);
const safe = p => typeof p === 'string' && /^[A-Za-z0-9_.@/-]+$/.test(p) && p.split('/').every(x=>x && x!=='.' && x!=='..');
const census = 'scripts/integration/c34/test_t46_p3_p4b_c2b13_merchant_writer_census.mjs';
const signedBlob = '7343fcffdca0ee76c0785b6e9e341b48a7951d2e';
// Inputs are synthetic attestations, not evidence of actual repository closure.
export function verifyManifest(m) {
  const fail = reason => ({candidate:false, reason, closureProven:false,bypassAuthorized:false,recommendation:'full'});
  if (!m || !oid(m.checkout) || m.completeCheckout!==true || m.completeDiff!==true || m.diffCheckout!==m.checkout || m.workflowBlob!==signedBlob || m.trusted!==true || m.statusPreserved!==true) return fail('unverified context');
  if (!Array.isArray(m.tree)||!Array.isArray(m.nodes)||!Array.isArray(m.roots)||!Array.isArray(m.diff)||!m.roots.length||!m.diff.length) return fail('missing inventory');
  const tree=new Map(), nodes=new Map();
  for(const t of m.tree) {
    if(!t||!safe(t.path)||!oid(t.blob)||t.mode!=='100644'||tree.has(t.path)) return fail('invalid tree');
    tree.set(t.path,t.blob);
  }
  for(const n of m.nodes) {
    if(!n||!safe(n.path)||nodes.has(n.path)||tree.get(n.path)!==n.blob||!oid(n.blob)||n.reviewed!==true||!Array.isArray(n.edges)||!Array.isArray(n.unresolved)||n.unresolved.length||n.dynamicUnknown!==false||n.generatedUnknown!==false) return fail('unresolved node');
    nodes.set(n.path,n);
  }
  const seen=new Set(), queue=[...m.roots];
  while(queue.length) {
    const p=queue.pop();
    if(seen.has(p)) continue;
    const n=nodes.get(p);
    if(!n) return fail('missing edge');
    seen.add(p);
    for(const e of n.edges) {
      if(!safe(e)||!nodes.has(e)) return fail('missing edge');
      queue.push(e);
    }
  }
  const changed=new Set();
  for(const d of m.diff) {
    if(!d||d.status!=='modified'||!safe(d.path)||changed.has(d.path)||d.path!==census||!tree.has(d.path)||seen.has(d.path)) return fail('sensitive or ambiguous diff');
    changed.add(d.path);
  }
  return {candidate:true,reason:'synthetic disjoint graph only',closureProven:false,bypassAuthorized:false,recommendation:'full'};
}
const root='scripts/signed.mjs', dep='data/generated.json';
const fixture={checkout:'a'.repeat(40),diffCheckout:'a'.repeat(40),completeCheckout:true,completeDiff:true,trusted:true,statusPreserved:true,workflowBlob:signedBlob,roots:[root],diff:[{path:census,status:'modified'}],tree:[root,dep,census].map(path=>({path,blob:sha(path),mode:'100644'})),nodes:[root,dep].map(path=>({path,blob:sha(path),reviewed:true,edges:path===root?[dep]:[],unresolved:[],dynamicUnknown:false,generatedUnknown:false}))};
assert.equal(verifyManifest(fixture).candidate,true);
const mutations=[
 m=>m.completeCheckout=false,m=>m.completeDiff=false,m=>m.diffCheckout='b'.repeat(40),m=>m.trusted=false,m=>m.statusPreserved=false,m=>m.workflowBlob='b'.repeat(40),
 m=>m.nodes.pop(),m=>m.nodes[0].edges.push('missing.js'),m=>m.nodes[0].unresolved.push('computed import'),m=>m.nodes[0].dynamicUnknown=true,m=>m.nodes[1].generatedUnknown=true,m=>m.nodes[0].blob='b'.repeat(40),m=>m.tree.push(m.tree[0]),m=>m.tree[0].mode='120000',m=>m.diff[0].status='renamed',m=>m.diff[0].status='removed',m=>m.diff.push({path:dep,status:'modified'}),m=>m.roots.push(census),m=>m.nodes[0].reviewed=false,m=>m.diff.push(m.diff[0])
];
for(const mutate of mutations){const m=structuredClone(fixture);mutate(m);assert.equal(verifyManifest(m).candidate,false);}
for(const m of [fixture,null,...mutations.map(fn=>{const m=structuredClone(fixture);fn(m);return m;})]) {const r=verifyManifest(m);assert.equal(r.bypassAuthorized,false);assert.equal(r.closureProven,false);assert.equal(r.recommendation,'full');}
console.log('Synthetic manifest cases passed:',1+mutations.length);
// Completion requires independently authenticated complete diff, complete candidate-scope
// dependency evidence (including generated/runtime inputs), unchanged workflow/trust,
// and authorized required-status semantics. Lexical scans and this prototype cannot prove these.

// Synthetic evidence envelope: bind the complete flat inventory to an independently
// supplied digest and required roots. This is NOT a Git tree hash or live attestation.
function inventoryDigest(tree) {
  return createHash('sha256').update(JSON.stringify(tree.map(t=>[t.path,t.mode,t.blob]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0))).digest('hex');
}
export function verifyManifestEnvelope(m, expected) {
  const fail=reason=>({candidate:false,reason,closureProven:false,bypassAuthorized:false,recommendation:'full'});
  if(!expected || !oid(expected.checkout) || !Array.isArray(expected.requiredRoots) || !expected.requiredRoots.length || !expected.requiredRoots.every(safe) || new Set(expected.requiredRoots).size!==expected.requiredRoots.length || !Number.isSafeInteger(expected.entryCount) || expected.entryCount<1 || typeof expected.inventoryDigest!=='string' || !/^[0-9a-f]{64}$/.test(expected.inventoryDigest)) return fail('invalid external expectation');
  const result=verifyManifest(m);
  if(!result.candidate) return result;
  if(m.checkout!==expected.checkout || m.tree.length!==expected.entryCount || inventoryDigest(m.tree)!==expected.inventoryDigest) return fail('inventory identity mismatch');
  if(new Set(m.roots).size!==m.roots.length || expected.requiredRoots.some(p=>!m.roots.includes(p))) return fail('required root omitted');
  const paths=new Set(m.tree.map(t=>t.path));
  for(const p of paths) {const parts=p.split('/'); for(let i=1;i<parts.length;i++) if(paths.has(parts.slice(0,i).join('/'))) return fail('file directory collision');}
  return result;
}
const envelope={checkout:fixture.checkout,requiredRoots:[root],entryCount:fixture.tree.length,inventoryDigest:inventoryDigest(fixture.tree)};
assert.equal(verifyManifestEnvelope(fixture,envelope).candidate,true);
const envelopeCases=[
 m=>m.tree.reverse(), // ordering is immaterial
 m=>m.tree.push({path:'extra.txt',mode:'100644',blob:sha('extra')}),
 m=>m.tree.find(t=>t.path===census).blob=sha('different'),
 m=>m.roots=[dep],
 m=>m.roots.push(root),
 m=>m.checkout=m.diffCheckout='b'.repeat(40),
 m=>m.tree.pop(),
 m=>m.tree[0]=null
];
for(const [i,mutate] of envelopeCases.entries()){const m=structuredClone(fixture);mutate(m);const r=verifyManifestEnvelope(m,envelope);assert.equal(r.candidate,i===0);assert.equal(r.bypassAuthorized,false);assert.equal(r.closureProven,false);assert.equal(r.recommendation,'full');}
for(const e of [null,{...envelope,requiredRoots:[]},{...envelope,entryCount:NaN},{...envelope,inventoryDigest:'bad'}]) assert.equal(verifyManifestEnvelope(fixture,e).candidate,false);
console.log('Synthetic envelope cases passed:',1+envelopeCases.length+4);
