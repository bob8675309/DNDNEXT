#!/usr/bin/env node
// Read-only PR metadata catalogue; pagination is performed by gh api outside
// this script. No credentials, API calls, repository writes, SQL or AI.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const URL = 'https://github.com/bob8675309/DNDNEXT';
const safe = value => String(value ?? '').replace(/[\u0000-\u001f|<>\x60\[\]\\]/g, ' ').slice(0, 150);

export function normalizeOpenPrs(raw, meta) {
  assert.ok(Array.isArray(raw), 'GitHub PR collection must be a paginated array');
  assert.match(String(meta.mainSha || ''), SHA);
  assert.match(String(meta.sourceSha || ''), SHA);
  assert.match(String(meta.generatedAt || ''), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/);
  const seen = new Set();
  const pulls = raw.map(pr => {
    assert.ok(Number.isSafeInteger(pr.number) && pr.number > 0, 'invalid PR number');
    assert.ok(!seen.has(pr.number), 'duplicate PR number: ' + pr.number);
    seen.add(pr.number);
    assert.equal(pr.state, 'open', 'only open PRs may be represented as live');
    assert.match(String(pr.head?.sha || ''), SHA, 'missing exact head SHA for #'+pr.number);
    assert.match(String(pr.base?.sha || ''), SHA, 'missing base SHA for #'+pr.number);
    assert.ok(pr.head?.ref && pr.base?.ref, 'missing head/base branch for #'+pr.number);
    assert.equal(typeof pr.draft, 'boolean', 'missing draft status for #'+pr.number);
    assert.match(String(pr.updated_at || ''), /^\d{4}-\d\d-\d\dT/, 'missing updated timestamp');
    return { number:pr.number, title:safe(pr.title), draft:pr.draft,
      head:pr.head.sha, branch:safe(pr.head.ref), base:safe(pr.base.ref),
      baseSha:pr.base.sha, updatedAt:pr.updated_at };
  }).sort((a,b) => b.number - a.number);
  return { mainSha:meta.mainSha, sourceSha:meta.sourceSha,
    sourceBranch:safe(meta.sourceBranch), generatedAt:meta.generatedAt, pulls };
}

export function renderOpenPrs(index) {
  const out = [
    '# DNDNext — complete open pull request index (generated)',
    '',
    '**Point-in-time GitHub metadata only.** This is not a review of file completeness, feature status, acceptance, author decisions or production release. No AI or paid services were used.',
    '',
    '| Captured UTC | GitHub main (not deployment verified) | Trigger source SHA | Open PRs |',
    '|---|---|---|---|',
    '| '+index.generatedAt+' | `'+index.mainSha+'` | `'+index.sourceSha+'` | '+index.pulls.length+' |',
    '',
    'Every open PR returned by **all pages** of the GitHub open-pulls API at capture time appears below, including draft and stacked research PRs. **Closed/merged PRs, unassociated branches and later PR activity are not included.**',
    '',
    '| PR / title | Exact HEAD | Branch → base | Draft? | GitHub updated UTC |',
    '|---|---|---|---|---|',
  ];
  for (const p of index.pulls) {
    out.push('| [#'+p.number+' — '+p.title+']('+URL+'/pull/'+p.number+') | `'+p.head+'` | `'+p.branch+'` → `'+p.base+'` | '+(p.draft?'yes':'no')+' | '+safe(p.updatedAt)+' |');
  }
  out.push('',
    '## Important trust boundaries',
    '',
    '- Do not infer a PR is safe, merged, production deployed, feature-complete or passing CI from this index. Verify exact-head checks and full inherited source separately.',
    '- The existing `PROJECT_HEALTH.generated.md` includes more detailed CI metadata for four historical anchor PRs (#317/#321/#324/#325). This new catalogue lists **all** open PRs without fabricating their test conclusions.',
    '- Historical source/negative tests, owner decisions, branch-only docs and current scope still require the canonical authored handoff and the source-preservation register.',
    '- The source branch/commit, captured time and GitHub main SHA are evidence of this snapshot only. The report updates on qualifying owner research/agent pushes, not continuously.',
    '- No cleanup, branch deletion, release, hosted SQL, world map change or paid research agent activation is authorized by this index.',
    '',
    '## Continue from the authoritative handoff',
    '',
    '[NEXT_CHAT_START_HERE.md]('+URL+'/blob/main/docs/NEXT_CHAT_START_HERE.md) and the **active task branch** `docs/ACTIVE_WORK.md` and latest `docs/HANDOFF_LOG.md` remain owner-authored sources of the next task; validate exact source/CI and discrepancies before relying on either.');
  return out.join('\n')+'\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const raw = JSON.parse(readFileSync(resolve(process.argv[2] || ''),'utf8'));
    const meta = JSON.parse(readFileSync(resolve(process.argv[3] || ''),'utf8'));
    const output = resolve(process.argv[4] || '');
    assert.ok(output.endsWith('/OPEN_PRS.generated.md'), 'output must be standalone generated archive index');
    const indexed = normalizeOpenPrs(raw, meta);
    writeFileSync(output,renderOpenPrs(indexed),'utf8');
    console.log('PASS paginated open PR inventory: '+indexed.pulls.length+' unique open PRs, no CI or release claims');
  } catch(error) {
    console.error('FAIL open PR index (closed): '+error.message);
    process.exitCode=1;
  }
}
