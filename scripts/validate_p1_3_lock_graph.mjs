/** P1.3 source-class inversion consistency, NOT a PostgreSQL deadlock test. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const g=JSON.parse(fs.readFileSync('scripts/fixtures/p1_3_lock_order_graph.json','utf8'));
const d=fs.readFileSync('docs/archive/p1_3_source_evidence_2026-11-07/P1_3_Global_Lock_Order_Research_2026-11-01.md','utf8');
assert.equal(g.schema_version,1);
assert.equal(g.paths.length,14);
assert.equal(new Set(g.paths.map(x=>x.id)).size,g.paths.length);
const byId=new Map(g.paths.map(x=>[x.id,x]));
const before=(seq,a,b)=>seq.some((v,i)=>v===a&&seq.slice(i+1).includes(b));
for(const p of g.paths){
 assert.match(p.source,/^(public|private)\./);
 assert.match(p.md5,/^[a-f0-9]{32}$/);
 assert(['first-lock','schematic','partial'].includes(p.confidence));
 assert(p.order.every(x=>Object.hasOwn(g.legend,x)));
}
for(const c of g.candidate_inversions){
 const a=byId.get(c.a),b=byId.get(c.b);
 assert(a&&b,'Unknown function path '+c.name);
 assert.equal(c.a_edge[0],c.b_edge[1]);assert.equal(c.a_edge[1],c.b_edge[0]);
 assert(before(a.order,...c.a_edge),'Missing left edge '+c.name);
 assert(before(b.order,...c.b_edge),'Missing right edge '+c.name);
 assert(c.note.length>12);
}
assert.equal(g.candidate_inversions.length,4);
for(const phrase of ['NOT observed deadlocks','P1.5','One next action','Not run for this proposal','Leave P1.3 unchecked']) assert(d.includes(phrase),'Missing caveat: '+phrase);
const owner = fs.readFileSync('docs/archive/p1_3_source_evidence_2026-11-07/TACTICAL_ENCOUNTER_OWNER_DECISIONS.md','utf8');
assert(owner.includes('TC1 / Option A'),'Missing owner TC1 policy');
assert(owner.includes('at most one `public.encounters.status = \'active\'` encounter'),'Owner policy not precise');
assert(owner.includes('Do not automatically delete'),'Historical overlap preservation rule missing');
assert(owner.includes('P1.5 implementation/enforcement remains incomplete'),'Owner policy confused with deployment');
assert(d.includes('Owner policy TC1 (Option A, 2026-11-01)'),'P1.3 graph not linked to approved policy');
console.log('P1.3 STATIC graph checks OK: '+g.paths.length+' source paths, '+g.candidate_inversions.length+' hypothetical class-order inversions. NO database concurrency test performed.');
