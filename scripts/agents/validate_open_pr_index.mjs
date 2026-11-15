#!/usr/bin/env node
import assert from 'node:assert/strict';
import {normalizeOpenPrs,renderOpenPrs} from './render_open_pr_index.mjs';
const sha=x=>x.repeat(40);
const meta={mainSha:sha('a'),sourceSha:sha('b'),sourceBranch:'research/current',generatedAt:'2026-11-15T14:20:00Z'};
const make=n=>({number:n,title:'PR <untrusted> | inherited '+n,state:'open',draft:n%2===0,
  head:{sha:sha('c'),ref:'research/task-'+n},base:{sha:sha('d'),ref:n%3===0?'research/parent':'main'},
  created_at:'2026-11-10T10:00:00Z',updated_at:'2026-11-15T14:10:00Z'});
const many=Array.from({length:215},(_,i)=>make(i+1));
const actual=normalizeOpenPrs(many,meta);
const md=renderOpenPrs(actual);
assert.equal(actual.pulls.length,215,'retain every item from paginated collection');
assert.equal(actual.pulls[0].number,215);
assert.equal(actual.pulls[214].number,1);
assert.equal((md.match(/\]\(https:\/\/github\.com\/bob8675309\/DNDNEXT\/pull\//g)||[]).length,215);
assert.ok(!md.includes('<untrusted>') && !md.includes('| inherited '),'untrusted fields must be escaped');
assert.match(md,/not continuously/);
assert.match(md,/all.*open PRs/i);
assert.match(md,/four historical anchor PRs/);
assert.throws(()=>normalizeOpenPrs([...many,make(1)],meta),/duplicate PR/);
assert.throws(()=>normalizeOpenPrs([{...make(1),state:'merged'}],meta),/open/);
assert.throws(()=>normalizeOpenPrs([{...make(1),head:{sha:'broken',ref:'test'}}],meta),/SHA/);
assert.throws(()=>normalizeOpenPrs([{...make(1),draft:null}],meta),/draft/);
assert.throws(()=>normalizeOpenPrs(many,{...meta,sourceSha:'bad'}),/SHA/);
console.log('PASS free open PR catalogue: >100 paginated items, exact refs, invalid/duplicate fail closed, sanitized text and no false CI claim');
