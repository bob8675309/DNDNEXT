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

// Native SHA-1 Git tree reconstruction for the restricted synthetic regular-file
// inventory. Unsupported modes/names fail closed; no claim of real checkout custody.
function nativeTreeOid(entries) {
  if(!Array.isArray(entries)||!entries.length) return null;
  const top=new Map();
  for(const e of entries) {
    if(!e||typeof e.path!=='string'||/[\x00-\x1f\x7f]/.test(e.path)||!e.path.split('/').every(x=>x&&x!=='.'&&x!=='..')||!oid(e.blob)||e.mode!=='100644') return null;
    const parts=e.path.split('/');
    let dir=top;
    for(const name of parts.slice(0,-1)) {
      if(!dir.has(name)) dir.set(name,new Map());
      dir=dir.get(name);
      if(!(dir instanceof Map)) return null;
    }
    const name=parts.at(-1);
    if(dir.has(name)) return null;
    dir.set(name,e.blob);
  }
  function hash(dir) {
    const rows=[...dir].map(([name,value])=>({name,value,key:name+(value instanceof Map?'/':'')}));
    rows.sort((a,b)=>Buffer.compare(Buffer.from(a.key),Buffer.from(b.key)));
    const bytes=Buffer.concat(rows.map(({name,value})=>Buffer.concat([
      Buffer.from((value instanceof Map?'40000':'100644')+' '+name+'\0'),
      Buffer.from(value instanceof Map?hash(value):value,'hex')
    ])));
    return createHash('sha1').update('tree '+bytes.length+'\0').update(bytes).digest('hex');
  }
  return hash(top);
}
export function verifyNativeTreeEnvelope(m, expected) {
  const fail={candidate:false,reason:'native tree identity unavailable or mismatched',closureProven:false,bypassAuthorized:false,recommendation:'full'};
  if(!expected||!oid(expected.treeOid)||expected.truncated!==false||!m||nativeTreeOid(m.tree)!==expected.treeOid) return fail;
  return verifyManifestEnvelope(m,expected);
}
// Independently assembled one-file tree object, plus nested inventory cases.
const singleBytes=Buffer.concat([Buffer.from('100644 a\0'),Buffer.from(sha('a'),'hex')]);
const singleOid=createHash('sha1').update('tree '+singleBytes.length+'\0').update(singleBytes).digest('hex');
assert.equal(nativeTreeOid([{path:'a',mode:'100644',blob:sha('a')}]),singleOid);
const nativeExpected={...envelope,treeOid:nativeTreeOid(fixture.tree),truncated:false};
assert.equal(verifyNativeTreeEnvelope(fixture,nativeExpected).candidate,true);
const nativeCases=[
 m=>m.tree.reverse(),
 m=>m.tree.pop(),
 m=>m.tree[0].blob=sha('changed'),
 m=>m.tree.push({...m.tree[0]}),
 m=>m.tree.push({path:'scripts',mode:'100644',blob:sha('collision')}),
 m=>m.tree[0].mode='160000',
 m=>m.roots=[dep]
];
for(const [i,mutate] of nativeCases.entries()){
  const m=structuredClone(fixture);mutate(m);
  const r=verifyNativeTreeEnvelope(m,nativeExpected);
  assert.equal(r.candidate,i===0);
  assert.equal(r.bypassAuthorized,false);
  assert.equal(r.closureProven,false);
  assert.equal(r.recommendation,'full');
}
for(const e of [{...nativeExpected,truncated:true},{...nativeExpected,truncated:undefined},{...nativeExpected,treeOid:'0'.repeat(40)},null])
  assert.equal(verifyNativeTreeEnvelope(fixture,e).candidate,false);
console.log('Synthetic native tree cases passed:',2+nativeCases.length+4);

// Derive a complete path delta from two independently pinned restricted trees.
// Add/delete pairs are deliberately not inferred to be renames; both fail closed.
export function deriveTreeDelta(base, head, expected) {
  if (!expected || expected.baseTruncated!==false || expected.headTruncated!==false ||
      !oid(expected.baseTreeOid) || !oid(expected.headTreeOid) ||
      nativeTreeOid(base)!==expected.baseTreeOid || nativeTreeOid(head)!==expected.headTreeOid) return null;
  const a=new Map(base.map(e=>[e.path,e.blob])), b=new Map(head.map(e=>[e.path,e.blob]));
  return [...new Set([...a.keys(),...b.keys()])].sort().flatMap(path=>
    a.get(path)===b.get(path)?[]:[{path,status:!a.has(path)?'added':!b.has(path)?'removed':'modified'}]);
}
export function verifyDerivedDelta(m, base, expected) {
  const fail={candidate:false,reason:'unverified or inconsistent tree delta',closureProven:false,bypassAuthorized:false,recommendation:'full'};
  if(!m || !expected || expected.headTreeOid!==expected.treeOid) return fail;
  const diff=deriveTreeDelta(base,m.tree,expected);
  if(!diff || !Array.isArray(m.diff) || m.diff.length!==diff.length ||
     diff.some(d=>!m.diff.some(x=>x && x.path===d.path && x.status===d.status))) return fail;
  return verifyNativeTreeEnvelope({...m,diff},expected);
}
const deltaBase=fixture.tree.map(e=>e.path===census?{...e,blob:sha('old census')}:e);
const deltaExpected={...nativeExpected,baseTreeOid:nativeTreeOid(deltaBase),headTreeOid:nativeExpected.treeOid,baseTruncated:false,headTruncated:false};
assert.deepEqual(deriveTreeDelta(deltaBase,fixture.tree,deltaExpected),fixture.diff);
assert.equal(verifyDerivedDelta(fixture,deltaBase,deltaExpected).candidate,true);
assert.equal(verifyDerivedDelta({...fixture,diff:[]},deltaBase,deltaExpected).candidate,false);
assert.equal(verifyDerivedDelta(fixture,deltaBase.slice(1),deltaExpected).candidate,false);
assert.equal(verifyDerivedDelta(fixture,deltaBase,{...deltaExpected,baseTruncated:true}).candidate,false);
assert.equal(verifyDerivedDelta(fixture,deltaBase,{...deltaExpected,headTruncated:true}).candidate,false);
const mixedBase=deltaBase.map(e=>e.path===dep?{...e,blob:sha('old dependency')}:e);
const mixedExpected={...deltaExpected,baseTreeOid:nativeTreeOid(mixedBase)};
const mixedDiff=deriveTreeDelta(mixedBase,fixture.tree,mixedExpected);
assert.equal(mixedDiff.length,2);
assert.equal(verifyDerivedDelta(fixture,mixedBase,mixedExpected).candidate,false);
assert.equal(verifyDerivedDelta({...fixture,diff:mixedDiff},mixedBase,mixedExpected).candidate,false);
const removedBase=[...deltaBase,{path:'removed.js',mode:'100644',blob:sha('removed')}];
const removedExpected={...deltaExpected,baseTreeOid:nativeTreeOid(removedBase)};
const removedDiff=deriveTreeDelta(removedBase,fixture.tree,removedExpected);
assert.ok(removedDiff.some(d=>d.status==='removed'));
assert.equal(verifyDerivedDelta({...fixture,diff:removedDiff},removedBase,removedExpected).candidate,false);
console.log('Synthetic derived delta assertions passed');

 // Synthetic commit object binding. External event identities still require trusted custody.
function commitOid(raw) {
  return createHash('sha1').update('commit '+Buffer.byteLength(raw)+'\0').update(raw).digest('hex');
}
function boundCommitTree(raw, expectedOid) {
  if(typeof raw!=='string'||!oid(expectedOid)||commitOid(raw)!==expectedOid) return null;
  const split=raw.indexOf('\n\n');
  if(split<0) return null;
  const headers=raw.slice(0,split).split('\n');
  const trees=headers.filter(x=>x.startsWith('tree '));
  if(trees.length!==1||headers[0]!==trees[0]||!oid(trees[0].slice(5))) return null;
  return trees[0].slice(5);
}
export function verifyCommitBoundDelta(m,base,expected,event,objects) {
  const fail={candidate:false,reason:'unverified synthetic event commit binding',closureProven:false,bypassAuthorized:false,recommendation:'full'};
  if(!m||!expected||!event||!objects||event.kind!=='push'||event.forced!==false||
     !oid(event.before)||!oid(event.after)||event.before===event.after||
     event.after!==m.checkout||event.after!==expected.checkout||
     boundCommitTree(objects.base,event.before)!==expected.baseTreeOid||
     boundCommitTree(objects.head,event.after)!==expected.headTreeOid) return fail;
  // Restricted direct-parent push only; other event shapes remain unresolved.
  const parents=objects.head.slice(0,objects.head.indexOf('\n\n')).split('\n').filter(x=>x.startsWith('parent '));
  if(parents.length!==1||parents[0]!=='parent '+event.before) return fail;
  return verifyDerivedDelta(m,base,expected);
}
const syntheticCommit=(tree,parent)=>'tree '+tree+'\n'+(parent?'parent '+parent+'\n':'')+'author Test <test@example.invalid> 0 +0000\ncommitter Test <test@example.invalid> 0 +0000\n\nfixture\n';
const commitBase=syntheticCommit(deltaExpected.baseTreeOid);
const commitHead=syntheticCommit(deltaExpected.headTreeOid,commitOid(commitBase));
const commitEvent={kind:'push',forced:false,before:commitOid(commitBase),after:commitOid(commitHead)};
const commitObjects={base:commitBase,head:commitHead};
const commitManifest={...fixture,checkout:commitEvent.after,diffCheckout:commitEvent.after};
const commitExpected={...deltaExpected,checkout:commitEvent.after};
assert.equal(verifyCommitBoundDelta(commitManifest,deltaBase,commitExpected,commitEvent,commitObjects).candidate,true);
for(const [event,objects,expected] of [
 [{...commitEvent,before:'0'.repeat(40)},commitObjects,commitExpected],
 [{...commitEvent,after:'0'.repeat(40)},commitObjects,commitExpected],
 [{...commitEvent,forced:true},commitObjects,commitExpected],
 [{...commitEvent,kind:'pull_request'},commitObjects,commitExpected],
 [commitEvent,{...commitObjects,head:commitHead+'tampered'},commitExpected],
 [commitEvent,commitObjects,{...commitExpected,baseTreeOid:deltaExpected.headTreeOid}],
 [commitEvent,commitObjects,{...commitExpected,checkout:'0'.repeat(40)}],
 [commitEvent,{...commitObjects,base:null},commitExpected]
]) {
 const result=verifyCommitBoundDelta(commitManifest,deltaBase,expected,event,objects);
 assert.equal(result.candidate,false);
 assert.equal(result.bypassAuthorized,false);
 assert.equal(result.recommendation,'full');
}
console.log('Synthetic commit binding assertions passed');

 // Independent native Git oracle: ephemeral synthetic object database, no network.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const oracleDir=mkdtempSync(join(tmpdir(),'c34-git-oracle-'));
try {
  const env={...process.env};
  for(const key of Object.keys(env)) if(key.startsWith('GIT_')) delete env[key];
  Object.assign(env,{GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_AUTHOR_NAME:'Fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'Fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid',GIT_AUTHOR_DATE:'2001-01-01T00:00:00Z',GIT_COMMITTER_DATE:'2001-01-01T00:00:00Z'});
  const git=(args,input)=>execFileSync('git',args,{cwd:oracleDir,env,input,encoding:'utf8',stdio:['pipe','pipe','pipe']});
  git(['init','--quiet','--object-format=sha1']);
  const entries=['a.txt','a/x','a/z','a0','z'].map(path=>{
    const blob=git(['hash-object','-w','--stdin'],path).trim();
    assert.equal(blob,sha(path));
    return {path,blob,mode:'100644'};
  });
  git(['update-index','--index-info'],entries.map(e=>e.mode+' '+e.blob+'\t'+e.path+'\n').join(''));
  const tree=git(['write-tree']).trim();
  assert.equal(nativeTreeOid(entries),tree);
  assert.equal(nativeTreeOid([...entries].reverse()),tree);
  assert.notEqual(nativeTreeOid(entries.slice(1)),tree);
  const base=git(['commit-tree',tree], 'base fixture\n').trim();
  const head=git(['commit-tree',tree,'-p',base], 'head fixture\n').trim();
  for(const id of [base,head]){
    const raw=git(['cat-file','commit',id]);
    assert.equal(commitOid(raw),id);
    assert.equal(boundCommitTree(raw,id),tree);
    assert.equal(boundCommitTree(raw+'tampered',id),null);
  }
  console.log('Native Git oracle assertions passed');
} finally { rmSync(oracleDir,{recursive:true,force:true}); }

 // Real repository custody oracle: use Git's local object database, not source copies.
 // The pinned historical commit must be present; shallow CI may explicitly skip
 // this optional comparison, which never establishes dependency closure.
const custodyCommit='f3be2e3c71d2642ba054361c6a6461a90cbf156f';
const custodyTree='c850a1b7b63bcdcfc7143a5a88829e9419a4647a';
const custodyFileCount=2392;
const custodyGit=(args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024});
function verifyPinnedRepositoryTree() {
  let actual;
  try { actual=custodyGit(['rev-parse','--verify',custodyCommit+'^{tree}']).trim(); }
  catch { console.log('Pinned repository tree comparison unavailable: historical object not present'); return false; }
  assert.equal(actual,custodyTree);
  const rows=custodyGit(['ls-tree','-r','-z',custodyCommit]).split('\0').filter(Boolean);
  const entries=rows.map(row=>{
    const tab=row.indexOf('\t');
    assert.ok(tab>0);
    const [mode,type,blob]=row.slice(0,tab).split(' ');
    assert.equal(type,'blob');
    return {mode,blob,path:row.slice(tab+1)};
  });
  assert.equal(entries.length,custodyFileCount);
  assert.equal(nativeTreeOid(entries),custodyTree);
  assert.notEqual(nativeTreeOid(entries.slice(1)),custodyTree);
  console.log('Pinned repository tree comparison passed:',entries.length,'files');
  return true;
}
verifyPinnedRepositoryTree();

 // Real historical delta oracle: pinned own-branch commits, no event authorization.
{
 const baseId='05580aa8e6efcb075e56489000d6375a0d9932e9';
 const headId='c19f7bd63dd8b05abbca2d0cedb156c6210bb719';
 const expected={baseTreeOid:'749d079dc7bd1a5ec87e960b0da3f901c8b8a859',headTreeOid:'2dab87d376f2536cfb79fdeb666d42cc9e2f642c',baseTruncated:false,headTruncated:false};
 const readInventory=id=>custodyGit(['ls-tree','-r','-z',id]).split('\0').filter(Boolean).map(row=>{
   const tab=row.indexOf('\t');
   assert.ok(tab>0);
   const [mode,type,blob]=row.slice(0,tab).split(' ');
   assert.equal(type,'blob');
   return {mode,blob,path:row.slice(tab+1)};
 });
 const a=readInventory(baseId), b=readInventory(headId);
 assert.equal(boundCommitTree(custodyGit(['cat-file','commit',baseId]),baseId),expected.baseTreeOid);
 assert.equal(boundCommitTree(custodyGit(['cat-file','commit',headId]),headId),expected.headTreeOid);
 const delta=deriveTreeDelta(a,b,expected);
 const expectedDelta=[{path:'.github/workflows/validate-c34-ci-efficiency-independent.yml',status:'modified'}];
 assert.deepEqual(delta,expectedDelta);
 assert.equal(custodyGit(['diff','--no-renames','--name-status',baseId,headId]).trim(),'M\t'+expectedDelta[0].path);
 assert.equal(deriveTreeDelta(a.slice(1),b,expected),null);
 assert.equal(deriveTreeDelta(a,b.slice(1),expected),null);
 console.log('Pinned historical delta oracle passed: one independent workflow modification');
}

 // Historical census delta: pinned metadata, not proof of dependency closure.
{
 const baseId='dbb453a9d1eb3e04c113caa9d95414e2f7035428', headId='881b9fb08e7cad2ef49dde32014346882dcdaa86';
 const expected={baseTreeOid:'bb3de7df4e7f46e210751690b5bbb807c86247a2',headTreeOid:'45f62013cb9cd49dbba9381f29c7320b446baa34',baseTruncated:false,headTruncated:false};
 const read=id=>custodyGit(['ls-tree','-r','-z',id]).split('\0').filter(Boolean).map(row=>{
   const tab=row.indexOf('\t');
   assert.ok(tab>0);
   const [mode,type,blob]=row.slice(0,tab).split(' ');
   assert.equal(type,'blob');
   return {mode,blob,path:row.slice(tab+1)};
 });
 const a=read(baseId), b=read(headId);
 assert.equal(boundCommitTree(custodyGit(['cat-file','commit',baseId]),baseId),expected.baseTreeOid);
 assert.equal(boundCommitTree(custodyGit(['cat-file','commit',headId]),headId),expected.headTreeOid);
 const diff=deriveTreeDelta(a,b,expected);
 assert.deepEqual(diff,[{path:census,status:'modified'}]);
 assert.equal(custodyGit(['diff','--no-renames','--name-status',baseId,headId]).trim(),'M\t'+census);
 assert.equal(deriveTreeDelta(a.slice(1),b,expected),null);
 assert.equal(deriveTreeDelta(a,b.slice(1),expected),null);
 const changed=b.map(e=>e.path==='package.json'?{...e,blob:sha('synthetic changed dependency')}:e);
 assert.notEqual(nativeTreeOid(changed),expected.headTreeOid);
 assert.equal(deriveTreeDelta(a,changed,expected),null);
 // A verified delta is insufficient: no reviewed runtime graph is available.
 const unresolved={...fixture,checkout:headId,diffCheckout:headId,diff,tree:b,nodes:[],roots:['.github/workflows/validate-c34-joint-local-auth.yml']};
 const result=verifyManifest(unresolved);
 assert.equal(result.candidate,false);
 assert.equal(result.closureProven,false);
 assert.equal(result.bypassAuthorized,false);
 assert.equal(result.recommendation,'full');
 console.log('Pinned historical census delta verified; dependency closure unresolved');
}

 // Signed trigger scope is not runtime dependency closure. Pin the observed
 // broad trigger pattern without copying workflow source or claiming disjointness.
function assessCensusTriggerEvidence(e) {
  const full = reason => ({reason,closureProven:false,bypassAuthorized:false,recommendation:'full'});
  if (!e || e.workflowBlob !== signedBlob || e.path !== census ||
      e.pushPattern !== 'scripts/integration/c34/**' ||
      e.prPattern !== 'scripts/integration/c34/**') return full('trigger evidence missing or drifted');
  return full('census covered by signed trigger; runtime dependency closure unresolved');
}
{
 const evidence={workflowBlob:signedBlob,path:census,pushPattern:'scripts/integration/c34/**',prPattern:'scripts/integration/c34/**'};
 assert.equal(assessCensusTriggerEvidence(evidence).reason,'census covered by signed trigger; runtime dependency closure unresolved');
 for(const e of [evidence,null,{...evidence,workflowBlob:'0'.repeat(40)},{...evidence,pushPattern:null},{...evidence,prPattern:null},{...evidence,path:'docs/example.md'}]){
   const result=assessCensusTriggerEvidence(e);
   assert.equal(result.closureProven,false);
   assert.equal(result.bypassAuthorized,false);
   assert.equal(result.recommendation,'full');
   if(e!==evidence) assert.equal(result.reason,'trigger evidence missing or drifted');
 }
 console.log('Pinned census trigger scope model passed; runtime closure unresolved');
}

 // Bounded observed source entry-point inventory. Not a complete signed graph.
const observedSourceRoots = Object.freeze([
 ['validate_source_contract.mjs','18702c6948ad90772fd680585331fdaff9d2a7a9','sources directory: parameterized readSource'],
 ['validate_joint_fixture_blobs.mjs','4371229b5e3f01410dc903ec6fc9d35b1395a832','repository-relative parameterized read'],
 ['verify_original_trigger_coverage.mjs','f1958be9701c7d261b016232a73976ba84369b0c','repository-relative parameterized read']
].map(([name,blob,input])=>Object.freeze({path:'scripts/integration/c34/'+name,blob,input})));
function observedBoundaryNodes(rows) {
 return observedSourceRoots.map(expected=>{
   const matches=rows.filter(row=>row.path===expected.path);
   const match=matches.length===1 && matches[0].blob===expected.blob;
   return {path:expected.path,blob:expected.blob,reviewed:false,edges:[],
     unresolved:[match?expected.input:'missing or drifted source identity',
       'complete runtime input inventory not established'],
     dynamicUnknown:true,generatedUnknown:true};
 });
}
{
 const rows=observedSourceRoots.map(({path,blob})=>({path,blob,mode:'100644'}));
 const nodes=observedBoundaryNodes(rows);
 assert.equal(nodes.length,3);
 for(const n of nodes) assert.ok(n.unresolved.includes('complete runtime input inventory not established'));
 for(const inventory of [rows,rows.slice(1),rows.map((r,i)=>i===0?{...r,blob:sha('drift')}:r),[...rows,rows[0]]]){
   const m={...fixture,tree:[...inventory,fixture.tree.find(t=>t.path===census)],
     roots:observedSourceRoots.map(r=>r.path),nodes:observedBoundaryNodes(inventory)};
   const result=verifyManifest(m);
   assert.equal(result.candidate,false);
   assert.equal(result.closureProven,false);
   assert.equal(result.bypassAuthorized,false);
   assert.equal(result.recommendation,'full');
 }
 assert.equal(observedBoundaryNodes(rows.slice(1))[0].unresolved[0],'missing or drifted source identity');
 assert.equal(observedBoundaryNodes([...rows,rows[0]])[0].unresolved[0],'missing or drifted source identity');
 console.log('Bounded signed source-root inventory: three unresolved entry points; full validation retained');
}


 // Explicit joint-fixture declarations, extracted from pinned validator metadata.
 // This checks inventory identity only, not runtime closure or signed acceptance.
const jointDeclaredPins = [
  {
    "path": "sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql",
    "blob": "9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3"
  },
  {
    "path": "sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql",
    "blob": "afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac"
  },
  {
    "path": "sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql",
    "blob": "01e48823ac3a46aa5880e98200e97c2595501ce7"
  },
  {
    "path": "sql/candidates/20261105_player_creation_immutable_intent_v1.sql",
    "blob": "99bceee24c1718570237e70a65fe3172f4c9fbc9"
  },
  {
    "path": "sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql",
    "blob": "4532ddb8db642d0d0ab14646a3e87c034d4134c6"
  },
  {
    "path": "sql/candidates/20261109_player_story_complete_intent_i1c_research.sql",
    "blob": "91f5fb918bf205f2d4462e2ff0089f656601328e"
  },
  {
    "path": "scripts/fixtures/forge_creation_original_functions_pg17.sql",
    "blob": "6c64683e14ee148daf5c874a7e6e3c7ff606138c"
  },
  {
    "path": "scripts/fixtures/c33_forge_privacy_original_policy_join_pg17.sql",
    "blob": "12612c4acbe861817037e1ab5a79ddb7c40a55e9"
  },
  {
    "path": "scripts/fixtures/p1_3_npc_visible_sheet_original_functions_pg17.sql",
    "blob": "9c479d3f044268f73da3a5515d229096ce03f94a"
  },
  {
    "path": "scripts/fixtures/forge_materializer_local_auth_extension_pg17.sql",
    "blob": "dad4f97a1a9ba8a2ed99b8ba8b6ac6cdd534103e"
  },
  {
    "path": "scripts/fixtures/forge_materializer_original_functions_pg17.sql",
    "blob": "d6f5ac4f0cfd571edaa926b4168847eb85e18640"
  },
  {
    "path": "scripts/fixtures/forge_owner_constraint_original_inventory_handlers_pg17.sql",
    "blob": "aafbfea03d565dfaa1599875ab49c3c485611c51"
  },
  {
    "path": "scripts/fixtures/forge_inventory_policy_source_local_auth_pg17.sql",
    "blob": "e077a2b103fbbf1c1e5b5e437c8e877e6f619990"
  },
  {
    "path": "scripts/fixtures/forge_inventory_access_original_pg17.sql",
    "blob": "930036668d4e889b85f1c5ad0abeed79793a5c09"
  },
  {
    "path": "scripts/integration/c34/fixtures/forge_creation_replay_local_auth_pr351_pg17.sql",
    "blob": "aa701c679712475cd4f04d4e0a01fedc4616bafa"
  },
  {
    "path": "scripts/integration/c34/fixtures/original_i1c_forge_private_story_nonce_local_auth.mjs",
    "blob": "90fb3058bc1c93ef72a331bad0747920c3c1202e"
  },
  {
    "path": "scripts/fixtures/c33_forge_original_sprite_guard_local_pg17.sql",
    "blob": "d2f925129d198a443f1cea29d73ea56bff8b7a76"
  },
  {
    "path": "scripts/fixtures/c33_forge_original_mog_guard_local_pg17.sql",
    "blob": "53bd80d36e94d3ac0f97d02d16a85881bdcf6b15"
  },
  {
    "path": "scripts/fixtures/c33_forge_original_levelup_cancel_local_pg17.sql",
    "blob": "354ad33e1d86881244c48d090317e1906e3ed671"
  },
  {
    "path": "scripts/fixtures/forge_subclass_choice_original_pg17.sql",
    "blob": "2b7da3a5e4f7c926c09312efb98f61a1244b0bc6"
  },
  {
    "path": "scripts/fixtures/forge_progression_authority_original_pg17.sql",
    "blob": "3a0b6caeb6712f67af7895433df15f1439b19581"
  },
  {
    "path": "scripts/fixtures/forge_progression_authority_local_auth_extension_pg17.sql",
    "blob": "413a82dc3c1913cb5f71c28531d31e19da89e02d"
  },
  {
    "path": "scripts/fixtures/forge_feat_materializer_local_auth_extension_pg17.sql",
    "blob": "e6d574baa68dea6ad93f997941b3f062a234ff98"
  },
  {
    "path": "scripts/fixtures/forge_feat_materializer_original_pg17.sql",
    "blob": "aa60a2699796fea20213dca55c5191e2beaa24ac"
  },
  {
    "path": "scripts/fixtures/forge_feat_materializer_discriminators_original_pg17.sql",
    "blob": "b73e418b1f3b7fdbab528a9d52efe375af72e1e8"
  },
  {
    "path": "sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql",
    "blob": "ecddcd514917a4d379d14b02477dfb41dbf44f29"
  },
  {
    "path": "scripts/fixtures/forge_high_risk_original_progression_triggers_pg17.sql",
    "blob": "9da41b637b077ce5ab3f80e6308e0ca9b91fd002"
  },
  {
    "path": "scripts/fixtures/forge_nested_choices_original_pg17.sql",
    "blob": "6eb50c0d0bd63da6ffd5d20c0e2fa09b8dcbf17a"
  },
  {
    "path": "sql/20260809_67_species_replaceable_cantrip_runtime.sql",
    "blob": "3116cb96d9d812d4540ff8210c24e0a0af0cbd30"
  },
  {
    "path": "sql/20260808_44_runtime_feature_choices_spell_mastery.sql",
    "blob": "0d9ec7d003eca7589cce2f77f09f71432f7d8961"
  },
  {
    "path": "scripts/fixtures/forge_starting_spells_original_pg17.sql",
    "blob": "d56ed5ea44289bbb20720c1323f9b22f362b31c5"
  },
  {
    "path": "scripts/fixtures/forge_starting_spells_local_auth_pg17.sql",
    "blob": "4b6eeecdbfba49cca5a74c26e2f88b6d83123897"
  },
  {
    "path": "scripts/fixtures/forge_wizard_starting_spells_local_auth_pg17.sql",
    "blob": "bbf8cece98f46b1008d8e2ff79650647f89a5e20"
  }
];
function verifyJointDeclaredInventory(rows) {
 if (!Array.isArray(rows) || rows.length !== jointDeclaredPins.length) return false;
 const actual = new Map(rows.map(row => [row?.path,row?.blob]));
 return actual.size === jointDeclaredPins.length &&
   jointDeclaredPins.every(pin => actual.get(pin.path) === pin.blob);
}
{
 assert.equal(verifyJointDeclaredInventory(jointDeclaredPins),true);
 assert.equal(verifyJointDeclaredInventory([...jointDeclaredPins].reverse()),true);
 assert.equal(verifyJointDeclaredInventory(jointDeclaredPins.slice(1)),false);
 assert.equal(verifyJointDeclaredInventory([...jointDeclaredPins,jointDeclaredPins[0]]),false);
 assert.equal(verifyJointDeclaredInventory(jointDeclaredPins.map((p,i)=>i===0?{...p,blob:sha('drift')}:p)),false);
 assert.equal(verifyJointDeclaredInventory(jointDeclaredPins.map((p,i)=>i===0?{...p,path:census}:p)),false);
 const nodes=observedBoundaryNodes(observedSourceRoots);
 const result=verifyManifest({...fixture,nodes,roots:observedSourceRoots.map(r=>r.path)});
 assert.equal(result.closureProven,false);
 assert.equal(result.bypassAuthorized,false);
 assert.equal(result.recommendation,'full');
 console.log('Joint declared inventory model passed: '+jointDeclaredPins.length+' pins; runtime closure unresolved');
}

 // Source custody only: bind declared pins to a complete historical signed tree.
function verifyJointTree(rows, expectedTree) {
 if (!Array.isArray(rows) || rows.some(r=>!r || r.type!=='blob')) return false;
 try {
   if (nativeTreeOid(rows)!==expectedTree) return false;
   const byPath=new Map(rows.map(r=>[r.path,r]));
   return byPath.size===rows.length && jointDeclaredPins.every(p=>{
     const r=byPath.get(p.path);
     return r?.mode==='100644' && r.blob===p.blob;
   });
 } catch { return false; }
}
{
 const commit='6e3195708340505aaa85a6b09b6e08e3c88249f0';
 const tree='01e744bb948add770161babc1c3bd40ca52dfffb';
 assert.equal(boundCommitTree(custodyGit(['cat-file','commit',commit]),commit),tree);
 const rows=custodyGit(['ls-tree','-r','-z',commit]).split('\0').filter(Boolean).map(row=>{
   const tab=row.indexOf('\t');
   assert.ok(tab>0);
   const [mode,type,blob]=row.slice(0,tab).split(' ');
   return {mode,type,blob,path:row.slice(tab+1)};
 });
 assert.equal(verifyJointTree(rows,tree),true);
 const target=jointDeclaredPins[0].path;
 assert.equal(verifyJointTree(rows.filter(r=>r.path!==target),tree),false);
 assert.equal(verifyJointTree(rows.slice(1),tree),false);
 assert.equal(verifyJointTree(rows.map(r=>r.path===target?{...r,blob:sha('drift')}:r),tree),false);
 assert.equal(verifyJointTree(rows.map(r=>r.path===target?{...r,type:'tree'}:r),tree),false);
 assert.equal(verifyJointTree(rows.map(r=>r.path===target?{...r,mode:'120000'}:r),tree),false);
 assert.equal(verifyJointTree([...rows,rows[0]],tree),false);
 console.log('Pinned signed tree inventory verified; runtime closure and bypass remain unproven');
}

 // Finite research disposition: synthetic evidence flags are not authorization.
function assessResearchCompletion(evidence) {
 const required = ['authenticatedCompleteDiff','candidateDependencyClosure',
   'unchangedWorkflowTrust','requiredStatusSemantics','ownerIntegrationApproval'];
 const missing = required.filter(key => !Object.hasOwn(evidence ?? {},key) || evidence[key] !== true);
 return {missing, readyForOwnerReview:missing.length===0,
   bypassAuthorized:false, recommendation:'full', signedAccepted:false};
}
{
 const complete = {authenticatedCompleteDiff:true,candidateDependencyClosure:true,
   unchangedWorkflowTrust:true,requiredStatusSemantics:true,ownerIntegrationApproval:true};
 assert.deepEqual(assessResearchCompletion(complete),
   {missing:[],readyForOwnerReview:true,bypassAuthorized:false,recommendation:'full',signedAccepted:false});
 for (const key of Object.keys(complete)) {
   for (const value of [false,undefined,null,'true',1]) {
     const result=assessResearchCompletion({...complete,[key]:value});
     assert.deepEqual(result.missing,[key]);
     assert.equal(result.readyForOwnerReview,false);
     assert.equal(result.bypassAuthorized,false);
     assert.equal(result.recommendation,'full');
     assert.equal(result.signedAccepted,false);
   }
   const omitted={...complete}; delete omitted[key];
   assert.deepEqual(assessResearchCompletion(omitted).missing,[key]);
 }
 assert.equal(assessResearchCompletion(null).missing.length,5);
 assert.equal(assessResearchCompletion(Object.create(complete)).missing.length,5);
 console.log('Finite research disposition model passed; no live bypass authorized');
}

 // Synthetic receipt identity binding; matching identities do not authenticate evidence.
function bindResearchReceipt(receipt, expected) {
 const keys=['base','head','workflowBlob'];
 const valid=x=>typeof x==='string' && /^[0-9a-f]{40}$/.test(x) && !/^0+$/.test(x);
 const matches=keys.every(k=>Object.hasOwn(receipt??{},k) &&
   Object.hasOwn(expected??{},k) && valid(expected[k]) && receipt[k]===expected[k]);
 return {identityMatches:matches, authenticated:false, bypassAuthorized:false,
   recommendation:'full', signedAccepted:false};
}
{
 const expected={base:'1'.repeat(40),head:'2'.repeat(40),workflowBlob:'7343fcffdca0ee76c0785b6e9e341b48a7951d2e'};
 assert.deepEqual(bindResearchReceipt({...expected},expected),{identityMatches:true,
   authenticated:false,bypassAuthorized:false,recommendation:'full',signedAccepted:false});
 for(const key of Object.keys(expected)){
   const missing={...expected}; delete missing[key];
   for(const receipt of [missing,{...expected,[key]:'3'.repeat(40)},Object.create(expected)]){
     assert.equal(bindResearchReceipt(receipt,expected).identityMatches,false);
   }
   for(const invalid of [null,'','0'.repeat(40),'A'.repeat(40)]){
     const bad={...expected,[key]:invalid};
     assert.equal(bindResearchReceipt(bad,bad).identityMatches,false);
   }
 }
 assert.equal(bindResearchReceipt(null,expected).identityMatches,false);
 assert.equal(bindResearchReceipt(expected,null).identityMatches,false);
 console.log('Synthetic receipt identity binding passed; authentication and authorization remain unproven');
}

 // Bounded default-reader dependency enumeration, reviewed against source blob
 // 18702c6948ad90772fd680585331fdaff9d2a7a9. Injected readers remain unresolved.
const defaultReaderPins = [
 ['01_forge_immutable_intent.sql','99bceee24c1718570237e70a65fe3172f4c9fbc9'],
 ['02_npc_profile_stage1.sql','9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3'],
 ['03_npc_dossier_stage2.sql','afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac'],
 ['04_private_story_stage3.sql','01e48823ac3a46aa5880e98200e97c2595501ce7'],
 ['05_inventory_constraint_rls.sql','4532ddb8db642d0d0ab14646a3e87c034d4134c6'],
 ['06_story_complete_nonce_i1c.sql','91f5fb918bf205f2d4462e2ff0089f656601328e']
].map(([file,blob])=>({path:'scripts/integration/c34/sources/'+file,blob}));
function resolveDefaultReaderInventory(sourceBlob,readerKind,rows){
 const fail=()=>({edges:[],defaultReaderResolved:false,closureProven:false,bypassAuthorized:false,recommendation:'full'});
 if(sourceBlob!==observedSourceRoots[0].blob||readerKind!=='default'||!Array.isArray(rows))return fail();
 for(const pin of defaultReaderPins){
   const matches=rows.filter(r=>r?.path===pin.path);
   if(matches.length!==1||matches[0].blob!==pin.blob||matches[0].mode!=='100644')return fail();
 }
 return {...fail(),edges:defaultReaderPins.map(p=>p.path),defaultReaderResolved:true};
}
{
 const rows=defaultReaderPins.map(p=>({...p,mode:'100644'}));
 const blob=observedSourceRoots[0].blob;
 const good=resolveDefaultReaderInventory(blob,'default',rows);
 assert.equal(good.defaultReaderResolved,true);
 assert.equal(good.edges.length,6);
 for(const result of [good,resolveDefaultReaderInventory(blob,'injected',rows),
 resolveDefaultReaderInventory('0'.repeat(40),'default',rows),
 resolveDefaultReaderInventory(blob,'default',rows.slice(1)),
 resolveDefaultReaderInventory(blob,'default',[...rows,rows[0]]),
 resolveDefaultReaderInventory(blob,'default',rows.map((r,i)=>i? r:{...r,mode:'120000'})),
 resolveDefaultReaderInventory(blob,'default',rows.map((r,i)=>i? r:{...r,blob:'0'.repeat(40)}))]){
   assert.equal(result.closureProven,false);
   assert.equal(result.bypassAuthorized,false);
   assert.equal(result.recommendation,'full');
   if(result!==good){assert.equal(result.defaultReaderResolved,false);assert.deepEqual(result.edges,[]);}
 }
 console.log('Default reader six-stage inventory model passed; injected readers and runtime closure unresolved');
}

 // Bind the six-stage default reader to the historical signed Git tree.
 // This proves tracked identities, not injected-reader or runtime closure.
{
 const commit='6e3195708340505aaa85a6b09b6e08e3c88249f0';
 const tree='01e744bb948add770161babc1c3bd40ca52dfffb';
 assert.equal(boundCommitTree(custodyGit(['cat-file','commit',commit]),commit),tree);
 const rows=custodyGit(['ls-tree','-r','-z',commit]).split('\0').filter(Boolean).map(row=>{
   const tab=row.indexOf('\t');
   assert.ok(tab>0);
   const [mode,type,blob]=row.slice(0,tab).split(' ');
   return {mode,type,blob,path:row.slice(tab+1)};
 });
 const verify=inventory=>{
   if(!verifyJointTree(inventory,tree)) return false;
   const validator=inventory.filter(r=>r.path===observedSourceRoots[0].path);
   return validator.length===1 && validator[0].mode==='100644' &&
     resolveDefaultReaderInventory(validator[0].blob,'default',inventory).defaultReaderResolved;
 };
 assert.equal(verify(rows),true);
 for(const pin of [...defaultReaderPins,observedSourceRoots[0]]){
   assert.equal(verify(rows.filter(r=>r.path!==pin.path)),false);
   assert.equal(verify(rows.map(r=>r.path===pin.path?{...r,blob:sha('drift')}:r)),false);
   assert.equal(verify(rows.map(r=>r.path===pin.path?{...r,mode:'120000'}:r)),false);
 }
 assert.equal(verify([...rows,rows[0]]),false);
 console.log('Historical signed tree binds six default-reader sources and validator; runtime closure unresolved');
}

 // Exercise the actual pinned joint validator in an isolated temporary checkout.
 // No SQL execution: the validator reads raw bytes and hashes them only.
{
 const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join,dirname}=await import('node:path');
 const {spawnSync}=await import('node:child_process');
 const commit='6e3195708340505aaa85a6b09b6e08e3c88249f0';
 const validator=observedSourceRoots[1];
 const dir=mkdtempSync(join(tmpdir(),'c34-joint-reader-'));
 try {
   for(const pin of [validator,...jointDeclaredPins]){
     const result=spawnSync('git',['show',commit+':'+pin.path],{maxBuffer:32*1024*1024});
     assert.equal(result.status,0);
     const bytes=result.stdout;
     const hash=spawnSync('git',['hash-object','--stdin'],{input:bytes});
     assert.equal(hash.status,0);
     assert.equal(hash.stdout.toString().trim(),pin.blob);
     const target=join(dir,pin.path);
     mkdirSync(dirname(target),{recursive:true});
     writeFileSync(target,bytes);
   }
   const run=(args=[])=>spawnSync(process.execPath,[join(dir,validator.path),...args],{cwd:tmpdir(),encoding:'utf8'});
   const positive=run();
   assert.equal(positive.status,0,positive.stderr);
   assert.ok(positive.stdout.includes('PASS C34-S02: '+jointDeclaredPins.length+' '));
   assert.notEqual(run(['unexpected']).status,0);
   const target=join(dir,jointDeclaredPins[0].path);
   writeFileSync(target,'synthetic drift');
   assert.notEqual(run().status,0);
   rmSync(target);
   assert.notEqual(run().status,0);
   console.log('Pinned joint validator CLI: raw-byte positive, unexpected argument, drift and missing-file regressions; no runtime closure claim');
 } finally {rmSync(dir,{recursive:true,force:true});}
}

 // Pinned trigger audit: observe actual callback reads, not SQL execution.
 // The literal candidate inventory is a bounded allowlist, not a closure proof.
{
 const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join,dirname}=await import('node:path');
 const {pathToFileURL}=await import('node:url');
 const {spawnSync}=await import('node:child_process');
 const commit='6e3195708340505aaa85a6b09b6e08e3c88249f0';
 const validator=observedSourceRoots[2];
 const pins=[{"path":"docs/research/C34_ORIGINAL_31_TRIGGER_CENSUS_CAPTURE_2026-11-05.md","blob":"296e178fc951e261f48b6b9d63e48ee3012ee232"},{"path":"scripts/fixtures/c33_forge_original_levelup_cancel_local_pg17.sql","blob":"354ad33e1d86881244c48d090317e1906e3ed671"},{"path":"scripts/fixtures/c33_forge_original_mog_guard_local_pg17.sql","blob":"53bd80d36e94d3ac0f97d02d16a85881bdcf6b15"},{"path":"scripts/fixtures/c33_forge_original_sprite_guard_local_pg17.sql","blob":"d2f925129d198a443f1cea29d73ea56bff8b7a76"},{"path":"scripts/fixtures/forge_feat_materializer_local_auth_extension_pg17.sql","blob":"e6d574baa68dea6ad93f997941b3f062a234ff98"},{"path":"scripts/fixtures/forge_high_risk_original_progression_triggers_pg17.sql","blob":"9da41b637b077ce5ab3f80e6308e0ca9b91fd002"},{"path":"scripts/fixtures/forge_materializer_local_auth_extension_pg17.sql","blob":"dad4f97a1a9ba8a2ed99b8ba8b6ac6cdd534103e"},{"path":"scripts/fixtures/forge_nested_choices_original_pg17.sql","blob":"6eb50c0d0bd63da6ffd5d20c0e2fa09b8dcbf17a"},{"path":"scripts/fixtures/forge_progression_authority_local_auth_extension_pg17.sql","blob":"413a82dc3c1913cb5f71c28531d31e19da89e02d"},{"path":"scripts/fixtures/forge_starting_spells_local_auth_pg17.sql","blob":"4b6eeecdbfba49cca5a74c26e2f88b6d83123897"},{"path":"scripts/fixtures/forge_starting_spells_original_pg17.sql","blob":"d56ed5ea44289bbb20720c1323f9b22f362b31c5"},{"path":"scripts/fixtures/forge_wizard_starting_spells_local_auth_pg17.sql","blob":"bbf8cece98f46b1008d8e2ff79650647f89a5e20"},{"path":"scripts/integration/c34/c34_artificer_option_a_character_scoped_projection_candidate_pg17.sql","blob":"43eb13a2fd7e1d08b9003926f54eec44e9b7c60d"},{"path":"scripts/integration/c34/c34_artificer_source_plan_catalog_specimen_pg17.sql","blob":"2698f9634db2e6a34cbb9837c3ae4cbf231c3340"},{"path":"scripts/integration/c34/c34_five_original_sheet_character_triggers_pg17.sql","blob":"e58e81c096757a20343233638c4482d9e07ec97c"},{"path":"scripts/integration/c34/c34_inventory_original_policy_baseline_pg17.sql","blob":"ce1d51134c2dfaf8c071759d3f2da3b8feecd3a0"},{"path":"scripts/integration/c34/c34_khoravar_option_a_character_scoped_projection_candidate_pg17.sql","blob":"d4a9873aff53af79f16aaa54e75e158575480301"},{"path":"scripts/integration/c34/c34_khoravar_source_skill_tool_specimen_pg17.sql","blob":"f995e0f142bd71572001b7b7c2ed5d85aa0c6134"},{"path":"scripts/integration/c34/c34_original_artificer_plans_with_legacy_mirror_pg17.sql","blob":"eb6ae204f6c115ced594e63dbae3d939e5d6cd1a"},{"path":"scripts/integration/c34/c34_original_battle_master_pair_pg17.sql","blob":"c89b318d1c385e74ef7f74b1c23f50a746af52fc"},{"path":"scripts/integration/c34/c34_original_deferred_progression_authority_pg17.sql","blob":"32101fe64c47730ccdad1cfa85ae2842c6cfd578"},{"path":"scripts/integration/c34/c34_original_eladrin_season_pg17.sql","blob":"9cfb0450eef3dade90b4df51be3cbd2eea051fb2"},{"path":"scripts/integration/c34/c34_original_fighter_subclass_choice_pg17.sql","blob":"a0d4aa8cf4b71cd6f70725bc1e579f6626d326f6"},{"path":"scripts/integration/c34/c34_original_khoravar_skill_with_legacy_mirror_pg17.sql","blob":"2d09610c87398d0324efbf18da491ca9b6283cd5"},{"path":"scripts/integration/c34/c34_original_nested_choice_dependency_pg17.sql","blob":"308c539c4fb90fdb52cb93d6a79c432bdad409b2"},{"path":"scripts/integration/c34/c34_original_source_magic_materializer_pg17.sql","blob":"320605bfabe634287603a1cb341859b884b1621b"},{"path":"scripts/integration/c34/c34_original_species_replaceable_cantrip_pg17.sql","blob":"97a5130812af079c79fec1505d6c3381f79062db"},{"path":"scripts/integration/c34/c34_original_starting_magic_exactness_pg17.sql","blob":"cf2e5c7189cca27f1e43f90d0f003dcc21e27e43"},{"path":"scripts/integration/c34/c34_original_starting_spells_joint_pg17.sql","blob":"559125f9eacc0c048f01c6b996df365a3c2af4fe"},{"path":"scripts/integration/c34/c34_original_warlock_acquisition_three_triggers_pg17.sql","blob":"40e7bb0e44912306bd30d34fd546d67936e75200"},{"path":"scripts/integration/c34/c34_original_wizard_finalizer_with_legacy_mirror_pg17.sql","blob":"4657223db4dab6b8c078944b20bebfec2a4b3d3e"},{"path":"scripts/integration/c34/c34_source_magic_astral_elf_specimen_pg17.sql","blob":"b62f68c93a2daf67fcd23faf7dd8ba5f143c8e9a"},{"path":"scripts/integration/c34/c34_species_replaceable_cantrip_source_specimen_pg17.sql","blob":"d95a0a34ea9ed827b02de31880defad82cdce1fb"},{"path":"scripts/integration/c34/c34_warlock_source_and_original_two_guards_pg17.sql","blob":"6cfcf70aa601cf1445ace65de0a54bb3ee0ccef0"},{"path":"scripts/integration/c34/c34_wizard_option_a_character_scoped_signature_candidate_pg17.sql","blob":"5dd9e87bf281bda31e1d0d38ef1d8f4b0cfa1c21"},{"path":"scripts/integration/c34/c34_wizard_source_savant_signature_specimen_pg17.sql","blob":"8750730e2cda5ab2b784844d13296a19d7a3d8ee"},{"path":"scripts/integration/c34/sources/07_i1i_original_eladrin_season_pg17.sql","blob":"323ef20258d8b3a7c7bc96e0b1d279ba755fcce5"},{"path":"scripts/integration/c34/sources/08_i1j_original_khoravar_skill_pg17.sql","blob":"d84d149b5bc4ef0e62f69a048ab77620f472a94a"},{"path":"scripts/integration/c34/sources/09_i1f_original_battle_master_functions_pg17.sql","blob":"fbda236e3c1b96ef9a93c44f0a2f99a6cd77adf9"},{"path":"scripts/integration/c34/sources/10_i1f_original_battle_master_setup_pg17.sql","blob":"c5ae0b31605d9374b295eee01eefdda0718afb80"},{"path":"scripts/integration/c34/sources/11_i1e_original_wizard_functions_pg17.sql","blob":"c0322578db9e848b20a476b32681c07e316f0870"},{"path":"scripts/integration/c34/sources/12_i1e_original_wizard_setup_pg17.sql","blob":"0b833150367ce01297acf82d750de3f01be66044"},{"path":"scripts/integration/c34/sources/13_i1l_original_artificer_plans_pg17.sql","blob":"975d92fa5fef8f77e4fb690921ebba84113dfa41"},{"path":"scripts/integration/c34/sources/14_i1g_original_warlock_functions_pg17.sql","blob":"7a1cb66a17552b11e52c391563d0cf5aba52829a"},{"path":"scripts/integration/c34/sources/15_i1g_original_warlock_acquisition_pg17.sql","blob":"7ec34da724bb22ed5d299ff27a5e07e0f0373180"},{"path":"scripts/integration/c34/sources/16_i1g_original_warlock_safeguard_triggers_pg17.sql","blob":"90fd7a3f7dc81fd146605de131747755312b4aa9"},{"path":"scripts/integration/c34/sources/17_i1h_original_warlock_joint_install_pg17.sql","blob":"c8c22cafa567f986d8049060d02e687fd040601e"},{"path":"sql/20260808_44_runtime_feature_choices_spell_mastery.sql","blob":"0d9ec7d003eca7589cce2f77f09f71432f7d8961"},{"path":"sql/20260809_67_species_replaceable_cantrip_runtime.sql","blob":"3116cb96d9d812d4540ff8210c24e0a0af0cbd30"},{"path":"sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql","blob":"01e48823ac3a46aa5880e98200e97c2595501ce7"},{"path":"sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql","blob":"ecddcd514917a4d379d14b02477dfb41dbf44f29"}];
 const bytes=new Map();
 for(const pin of [validator,...pins]){
   const r=spawnSync('git',['show',commit+':'+pin.path],{maxBuffer:32*1024*1024});
   assert.equal(r.status,0);
   const h=spawnSync('git',['hash-object','--stdin'],{input:r.stdout});
   assert.equal(h.status,0);
   assert.equal(h.stdout.toString().trim(),pin.blob);
   bytes.set(pin.path,r.stdout);
 }
 const dir=mkdtempSync(join(tmpdir(),'c34-trigger-reader-'));
 try{
   const target=join(dir,validator.path);
   mkdirSync(dirname(target),{recursive:true});
   writeFileSync(target,bytes.get(validator.path));
   const {auditTriggerCoverage}=await import(pathToFileURL(target).href);
   const seen=new Set();
   const read=file=>{
     assert.ok(pins.some(p=>p.path===file),'Unresolved trigger audit read: '+file);
     seen.add(file);
     return Buffer.from(bytes.get(file));
   };
   const result=auditTriggerCoverage(read);
   assert.equal(result.stagedOriginalCount,29);
   assert.equal(result.originalMissingCount,2);
   assert.equal(result.assurance,'SOURCE_DDL_ONLY_NOT_ALL_BRANCHES_TESTED');
   assert.ok(seen.size>23);
   // Consolidate candidate identities without promoting observed reads to closure.
   const groups=[defaultReaderPins,jointDeclaredPins,pins,observedSourceRoots];
   function consolidate(groups){
     const merged=new Map();
     for(const group of groups) for(const pin of group){
       if(typeof pin.path!=='string'||!pin.path||pin.path.includes('\\')||
          pin.path.split('/').some(p=>!p||p==='.'||p==='..')||
          !/^[0-9a-f]{40}$/.test(pin.blob)||/^0+$/.test(pin.blob)) throw Error('invalid dependency pin');
       if(merged.has(pin.path)&&merged.get(pin.path)!==pin.blob) throw Error('conflicting dependency identity');
       merged.set(pin.path,pin.blob);
     }
     return [...merged].sort(([a],[b])=>a<b?-1:a>b?1:0);
   }
   const merged=consolidate(groups);
   assert.deepEqual(merged,consolidate([...groups].reverse()));
   assert.deepEqual(merged,consolidate([...groups,defaultReaderPins]));
   assert.throws(()=>consolidate([...groups,[{...pins[0],blob:'1'.repeat(40)}]]),/conflicting/);
   assert.throws(()=>consolidate([[{path:'../outside',blob:pins[0].blob}]]),/invalid/);
   const inventory=new Map(merged);
   for(const file of seen) assert.equal(inventory.get(file),pins.find(p=>p.path===file).blob);
   // Research-only candidate gate: observed reads are not exhaustive closure.
   function candidateRecommendation({expected, actual, unresolved, complete, trustedDiff, statusPreserved, changed}) {
     if (complete !== true || trustedDiff !== true || statusPreserved !== true ||
         !Array.isArray(unresolved) || unresolved.length !== 0 ||
         !(actual instanceof Map) || actual.size !== expected.size ||
         !Array.isArray(changed) || changed.length === 0) return 'full';
     for (const [path, blob] of expected) if (actual.get(path) !== blob) return 'full';
     // Only an explicitly reviewed synthetic documentation candidate is modeled here.
     if (changed.some(path => path !== 'docs/synthetic-candidate.md' || expected.has(path))) return 'full';
     return 'lightweight-candidate';
   }
   const syntheticEvidence={expected:inventory,actual:new Map(inventory),unresolved:[],
     complete:true,trustedDiff:true,statusPreserved:true,changed:['docs/synthetic-candidate.md']};
   assert.equal(candidateRecommendation(syntheticEvidence),'lightweight-candidate');
   for (const override of [
     {complete:false},{trustedDiff:false},{statusPreserved:false},
     {unresolved:['dynamic-reader']},{unresolved:undefined},
     {actual:new Map(merged.slice(1))},
     {actual:new Map([...merged,[merged[0][0],'1'.repeat(40)]])},
     {changed:[pins[0].path]},{changed:[]},{changed:['docs/unknown.md']}
   ]) assert.equal(candidateRecommendation({...syntheticEvidence,...override}),'full');
   // Actual evidence still has unresolved runtime inputs and unknown required status.
   assert.equal(candidateRecommendation({...syntheticEvidence,complete:false,
     unresolved:['injected-reader','runtime-inputs'],statusPreserved:false}),'full');
   console.log('Candidate evidence gate: synthetic positive and fail-closed negatives; no bypass authorization');
   console.log('Consolidated candidate inventory: '+merged.length+' unique paths; observed trigger reads: '+seen.size+'; closure unresolved');

   for(const missing of seen){
     assert.throws(()=>auditTriggerCoverage(file=>{
       if(file===missing)throw Error('missing synthetic dependency');
       return read(file);
     }),/missing synthetic dependency/);
   }
   assert.throws(()=>auditTriggerCoverage(file=>file.endsWith('.md')?Buffer.from('synthetic drift'):read(file)));
   console.log('Pinned trigger audit observed '+seen.size+' unique callback reads; runtime closure unresolved');
 }finally{rmSync(dir,{recursive:true,force:true});}
}

 // Synthetic event-diff envelope validation; not an authentication mechanism.
 // Only a separately authenticated collector may supply the expected endpoints.
 {
   const {strict: a}=await import('node:assert');
   function validateDiffEnvelope(event, receipt) {
     const sha=x=>typeof x==='string' && /^[0-9a-f]{40}$/.test(x) && !/^0+$/.test(x);
     if (!event || !receipt || event.kind!=='push' || event.forced!==false ||
         !sha(event.before) || !sha(event.after) || event.before===event.after ||
         receipt.base!==event.before || receipt.head!==event.after ||
         receipt.truncated!==false || receipt.complete!==true ||
         !Array.isArray(receipt.files) || receipt.files.length===0 ||
         receipt.files.length>=300 || receipt.total!==receipt.files.length) return false;
     const seen=new Set();
     for(const row of receipt.files) {
       if (!row || row.status!=='modified' || typeof row.path!=='string' ||
           row.path.includes(String.fromCharCode(92)) || /[\x00-\x1f\x7f]/.test(row.path) ||
           row.path.split('/').some(p=>!p||p==='.'||p==='..') ||
           seen.has(row.path) || Object.hasOwn(row,'previousPath')) return false;
       seen.add(row.path);
     }
     return true;
   }
   const event={kind:'push',forced:false,before:'1'.repeat(40),after:'2'.repeat(40)};
   const row={path:'docs/synthetic-candidate.md',status:'modified'};
   const receipt={base:event.before,head:event.after,truncated:false,complete:true,total:1,files:[row]};
   a.equal(validateDiffEnvelope(event,receipt),true);
   for(const bad of [{kind:'pull_request'},{forced:true},{forced:undefined},{before:'0'.repeat(40)},{after:event.before}])
     a.equal(validateDiffEnvelope({...event,...bad},receipt),false);
   for(const bad of [{base:'3'.repeat(40)},{head:'3'.repeat(40)},{truncated:true},{complete:false},
     {total:2},{files:[]},{files:[{...row,status:'renamed'}]},{files:[{...row,status:'removed'}]},
     {files:[{...row,previousPath:'old.md'}]},{files:[{...row,path:'../outside'}]},
     {files:[row,row],total:2},{files:Array.from({length:300},(_,i)=>({...row,path:'docs/'+i})),total:300}])
     a.equal(validateDiffEnvelope(event,{...receipt,...bad}),false);
   console.log('Synthetic push diff envelope: endpoint, completeness, cap and ambiguity checks; authentication and PR merge-base unresolved');
 }

 // Synthetic PR comparison identity model; not authenticated GitHub evidence.
 {
   function prComparisonMatches(event, receipt) {
     const sha=x=>typeof x==='string' && /^[0-9a-f]{40}$/.test(x) && !/^0+$/.test(x);
     return !!(event && receipt && event.kind==='pull_request' &&
       event.baseRepo==='bob8675309/DNDNEXT' && event.headRepo===event.baseRepo &&
       sha(event.base) && sha(event.head) && event.base!==event.head &&
       receipt.base===event.base && receipt.head===event.head &&
       receipt.complete===true && receipt.truncated===false &&
       Array.isArray(receipt.mergeBases) && receipt.mergeBases.length===1 &&
       sha(receipt.mergeBases[0]) && receipt.diffFrom===receipt.mergeBases[0] &&
       receipt.diffTo===event.head);
   }
   const event={kind:'pull_request',baseRepo:'bob8675309/DNDNEXT',
     headRepo:'bob8675309/DNDNEXT',base:'1'.repeat(40),head:'2'.repeat(40)};
   const ancestor='3'.repeat(40);
   const receipt={base:event.base,head:event.head,complete:true,truncated:false,
     mergeBases:[ancestor],diffFrom:ancestor,diffTo:event.head};
   assert.equal(prComparisonMatches(event,receipt),true);
   for(const bad of [{base:'4'.repeat(40)},{head:'4'.repeat(40)},
     {headRepo:'fork/DNDNEXT'},{kind:'push'},{base:'0'.repeat(40)}])
     assert.equal(prComparisonMatches({...event,...bad},receipt),false);
   for(const bad of [{base:ancestor},{head:ancestor},{complete:false},{truncated:true},
     {mergeBases:[]},{mergeBases:[ancestor,event.base]},{mergeBases:undefined},
     {diffFrom:event.base},{diffTo:event.base},{mergeBases:['0'.repeat(40)],diffFrom:'0'.repeat(40)}])
     assert.equal(prComparisonMatches(event,{...receipt,...bad}),false);
   console.log('Synthetic PR comparison identity checks; ancestry and provenance not proven');
 }
