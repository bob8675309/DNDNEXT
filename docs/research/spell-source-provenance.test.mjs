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

// Historical repository inventory, not a live deployment or recovered-function hash.
// Pinned from scripts/data/tactical_spell_preservation_20261107.json
// at 2b0c340f1f9cf5b2de36098d87692e163e2b7b87, Git blob f843976924897aff8aa75f4f53245269bcc1f745.
import { readFileSync } from 'node:fs';
const pinnedAdapters = [
  {
    "key": "fire-bolt|xphb",
    "rpc": "public.encounter_cast_spell_v1",
    "source": "XPHB"
  },
  {
    "key": "cure-wounds|xphb",
    "rpc": "public.encounter_cast_spell_v1",
    "source": "XPHB"
  },
  {
    "key": "sacred-flame|xphb",
    "rpc": "public.encounter_cast_spell_v2",
    "source": "XPHB"
  },
  {
    "key": "toll-the-dead|xphb",
    "rpc": "public.encounter_cast_spell_v3",
    "source": "XPHB"
  },
  {
    "key": "poison-spray|xphb",
    "rpc": "public.encounter_cast_spell_v4",
    "source": "XPHB"
  },
  {
    "key": "false-life|xphb",
    "rpc": "public.encounter_cast_spell_v5",
    "source": "XPHB"
  },
  {
    "key": "inflict-wounds|xphb",
    "rpc": "public.encounter_cast_spell_v6",
    "source": "XPHB"
  },
  {
    "key": "shocking-grasp|xphb",
    "rpc": "public.encounter_cast_spell_v7",
    "source": "XPHB"
  },
  {
    "key": "ray-of-frost|xphb",
    "rpc": "public.encounter_cast_spell_v8",
    "source": "XPHB"
  },
  {
    "key": "chill-touch|xphb",
    "rpc": "public.encounter_cast_spell_v9",
    "source": "XPHB"
  },
  {
    "key": "mind-sliver|xphb",
    "rpc": "public.encounter_cast_spell_v10",
    "source": "XPHB"
  },
  {
    "key": "word-of-radiance|xphb",
    "rpc": "public.encounter_cast_area_spell_v1",
    "source": "XPHB"
  },
  {
    "key": "guiding-bolt|xphb",
    "rpc": "public.encounter_cast_spell_v11",
    "source": "XPHB"
  },
  {
    "key": "vicious-mockery|xphb",
    "rpc": "public.encounter_cast_spell_v12",
    "source": "XPHB"
  },
  {
    "key": "healing-word|xphb",
    "rpc": "public.encounter_cast_spell_v13",
    "source": "XPHB"
  },
  {
    "key": "acid-splash|xphb",
    "rpc": "public.encounter_cast_point_area_spell_v1",
    "source": "XPHB"
  },
  {
    "key": "magic-missile|xphb",
    "rpc": "public.encounter_cast_allocated_spell_v1",
    "source": "XPHB"
  },
  {
    "key": "burning-hands|xphb",
    "rpc": "public.encounter_cast_directional_area_spell_v1",
    "source": "XPHB"
  },
  {
    "key": "lightning-bolt|xphb",
    "rpc": "public.encounter_cast_directional_area_spell_v2",
    "source": "XPHB"
  }
];
const manifest = JSON.parse(readFileSync(new URL('../../scripts/data/tactical_spell_preservation_20261107.json', import.meta.url), 'utf8'));
const adapterRows = rows => rows.map(({key,rpc,source}) => ({
  id:key, origin:'historical', sha256:digest(JSON.stringify([key,rpc,source]))
}));
const checkAdapters = rows => verify(adapterRows(pinnedAdapters), adapterRows(rows));
test('historical adapter identity and RPC inventory matches pinned 19', () => {
  assert.equal(new Set(pinnedAdapters.map(r=>r.rpc)).size,18);
  assert.deepEqual(checkAdapters(manifest.spells), {matched:19,evidence:'source-only',runtimeAccepted:false});
});
test('historical adapter substitution rejected', () => {
  const rows=manifest.spells.map(r=>({...r})); rows[0].key='unknown|xphb';
  assert.throws(()=>checkAdapters(rows),/unknown source/);
});
test('historical adapter route drift rejected', () => {
  const rows=manifest.spells.map(r=>({...r})); rows[0].rpc='synthetic_changed_rpc';
  assert.throws(()=>checkAdapters(rows),/fingerprint mismatch/);
});
test('historical adapter omission rejected', () => assert.throws(()=>checkAdapters(manifest.spells.slice(1)),/missing source/));
test('historical adapter source edition drift rejected', () => {
  const rows=manifest.spells.map(r=>({...r})); rows[0].source='PHB';
  assert.throws(()=>checkAdapters(rows),/fingerprint mismatch/);
});

 // Shared RPC custody: recovered inventory contains one exact-name signature.
 // Private function fingerprints remain offline; these fixtures are synthetic.
 const sharedRpc = 'public.encounter_cast_spell_v1';
 const sharedSignature = sharedRpc + '(uuid,uuid,uuid,integer,uuid)';
 const sharedFixture = [{id:sharedSignature,origin:'recovered',sha256:digest('synthetic shared function body')}];
 test('two historical adapters map to one recovered function identity', () => {
   assert.deepEqual(manifest.spells.filter(r=>r.rpc===sharedRpc).map(r=>r.key).sort(),
     ['cure-wounds|xphb','fire-bolt|xphb']);
   assert.deepEqual(verify(sharedFixture,sharedFixture.map(r=>({...r}))),
     {matched:1,evidence:'source-only',runtimeAccepted:false});
 });
 test('shared RPC predecessor cannot substitute for exact function identity', () => {
   const rows=sharedFixture.map(r=>({...r,id:r.id.replace('spell_v1(', 'spell_v1_pre_1v(')}));
   assert.throws(()=>verify(sharedFixture,rows),/unknown source/);
 });
 test('shared RPC cannot be counted twice for its two adapters', () => {
   assert.throws(()=>verify(sharedFixture,[...sharedFixture,...sharedFixture]),/duplicate identity/);
 });
