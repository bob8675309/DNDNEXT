// Synthetic source-custody contract only. No database, private definitions or runtime claims.
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const digest = text => createHash('sha256').update(text, 'utf8').digest('hex');
const valid = row => row && typeof row.id === 'string' && row.id.length > 0 &&
  ['historical', 'recovered'].includes(row.origin) &&
  typeof row.sha256 === 'string' && /^[a-f0-9]{64}$/.test(row.sha256);
export function verify(expected, observed) {
  if (!Array.isArray(expected) || !Array.isArray(observed) || !expected.length)
    throw new Error('invalid inventory');
  const index = rows => {
    const map = new Map();
    for (const row of rows) {
      if (!valid(row)) throw new Error('malformed source');
      if (map.has(row.id)) throw new Error('duplicate identity');
      map.set(row.id, row);
    }
    return map;
  };
  const trusted = index(expected), actual = index(observed);
  for (const [id, row] of actual) {
    const baseline = trusted.get(id);
    if (!baseline) throw new Error('unknown source');
    if (baseline.origin !== row.origin) throw new Error('origin mismatch');
    if (baseline.sha256 !== row.sha256) throw new Error('fingerprint mismatch');
  }
  for (const id of trusted.keys()) if (!actual.has(id)) throw new Error('missing source');
  return { matched: trusted.size, evidence: 'source-only', runtimeAccepted: false };
}
// Placeholder identities deliberately do not represent actual deployed adapters.
const baseline = Array.from({length:19}, (_,i) => ({
  id: 'synthetic-adapter-'+i, origin: 'recovered', sha256: digest('fixture-'+i)
}));
const copy = () => baseline.map(row => ({...row}));
test('complete inventory remains source-only', () => assert.deepEqual(verify(baseline, copy()), {
  matched:19, evidence:'source-only', runtimeAccepted:false
}));
test('changed fingerprint rejected', () => { const rows=copy(); rows[0].sha256=digest('changed'); assert.throws(()=>verify(baseline,rows),/fingerprint mismatch/); });
test('unknown identity rejected', () => { const rows=copy(); rows[0].id='unknown'; assert.throws(()=>verify(baseline,rows),/unknown source/); });
test('missing identity rejected', () => assert.throws(()=>verify(baseline,copy().slice(1)),/missing source/));
test('duplicate identity rejected', () => assert.throws(()=>verify(baseline,[...copy(),baseline[0]]),/duplicate identity/));
test('malformed fingerprint rejected', () => { const rows=copy(); rows[0].sha256='bad'; assert.throws(()=>verify(baseline,rows),/malformed source/); });
test('historical cannot substitute for recovered', () => { const rows=copy(); rows[0].origin='historical'; assert.throws(()=>verify(baseline,rows),/origin mismatch/); });
test('empty trust inventory rejected', () => assert.throws(()=>verify([],[]),/invalid inventory/));
