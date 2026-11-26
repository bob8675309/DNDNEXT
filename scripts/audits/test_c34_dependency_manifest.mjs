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
    if(!e||!safe(e.path)||!oid(e.blob)||e.mode!=='100644') return null;
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
