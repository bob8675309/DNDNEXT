#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessHandoff, isMaterialPath, isLegacyPr, ENFORCEMENT_START_UTC } from './check_handoff_continuity.mjs';

const thisDir = resolve(fileURLToPath(import.meta.url), '..');
const script = join(thisDir, 'check_handoff_continuity.mjs');
const initial = '# History\n\n## 2026-11-14 — Previous decision\nRetained intact.\n';
const receipt = '\n## 2026-11-15 — Continuity proof\nDecision: preserve original systems. Evidence: exact test fixture only. No production changes or releases. Next task: source-review the integration scope and exact-head CI.\n';
assert.equal(ENFORCEMENT_START_UTC, '2026-11-16T00:00:00Z');
assert.equal(isLegacyPr('2026-11-07T19:23:08Z'), true);
assert.equal(isLegacyPr('2026-11-13T06:05:25Z'), true);
assert.equal(isLegacyPr('2026-11-16T00:00:00Z'), false);
assert.throws(() => isLegacyPr('invalid'), /timestamp/);
assert.equal(isMaterialPath('components/NpcPanel.js'), true);
assert.equal(isMaterialPath('sql/candidates/auth.sql'), true);
assert.equal(isMaterialPath('.github/workflows/build.yml'), true);
assert.equal(isMaterialPath('docs/ACTIVE_WORK.md'), false);
assert.equal(assessHandoff({ paths: ['docs/README.md'], sourceIndex: -1, receiptIndex: -1 }).ok, true);
assert.equal(assessHandoff({ paths: ['pages/npcs.js'], sourceIndex: 0, receiptIndex: -1 }).ok, false);
assert.equal(assessHandoff({ paths: ['pages/npcs.js', 'docs/ACTIVE_WORK.md', 'docs/HANDOFF_LOG.md'], oldLog: initial, newLog: initial + receipt, sourceIndex: 1, receiptIndex: 2 }).ok, true);
assert.equal(assessHandoff({ paths: ['pages/npcs.js', 'docs/ACTIVE_WORK.md', 'docs/HANDOFF_LOG.md'], oldLog: initial, newLog: initial + receipt, sourceIndex: 3, receiptIndex: 2 }).ok, false);
assert.equal(assessHandoff({ paths: ['pages/npcs.js', 'docs/ACTIVE_WORK.md', 'docs/HANDOFF_LOG.md'], oldLog: initial, newLog: 'rewritten\n' + receipt, sourceIndex: 1, receiptIndex: 2 }).ok, false);

function git(cwd, ...args) { return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim(); }
function write(cwd, name, body) { const path = join(cwd, name); mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, body); }
function commit(cwd, message) { git(cwd, 'add', '.'); git(cwd, 'commit', '-qm', message); return git(cwd, 'rev-parse', 'HEAD'); }
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'dndnext-handoff-'));
  git(cwd, 'init', '-q', '-b', 'main');
  git(cwd, 'config', 'user.email', 'test@example.invalid');
  git(cwd, 'config', 'user.name', 'Handoff Test');
  write(cwd, 'docs/ACTIVE_WORK.md', 'Historical task\n');
  write(cwd, 'docs/HANDOFF_LOG.md', initial);
  write(cwd, 'components/NpcPanel.js', 'old\n');
  const base = commit(cwd, 'base');
  git(cwd, 'checkout', '-qb', 'research/test');
  return { cwd, base };
}
function audit(cwd, base, createdAt='2026-11-16T00:00:00Z') {
  const child = spawnSync(process.execPath, [script], {
    cwd, encoding: 'utf8', env: { ...process.env, PR_BASE_SHA: base, PR_HEAD_SHA: git(cwd, 'rev-parse', 'HEAD'), PR_CREATED_AT: createdAt },
  });
  return { code: child.status, output: (child.stdout || '') + (child.stderr || '') };
}
function runCase(fn, expected, name, createdAt='2026-11-16T00:00:00Z') {
  const { cwd, base } = fixture();
  try {
    fn(cwd);
    const result = audit(cwd, base, createdAt);
    assert.equal(result.code, expected, `${name}: ${result.output}`);
    console.log(`PASS ${name}: ${expected === 0 ? 'accepted' : 'rejected'}`);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
}
runCase(cwd => { write(cwd, 'components/NpcPanel.js', 'new\n'); commit(cwd, 'implementation'); }, 1, 'source without handoff');
runCase(cwd => { write(cwd, 'components/NpcPanel.js', 'new\n'); commit(cwd, 'source'); write(cwd, 'docs/ACTIVE_WORK.md', 'Next source review\n'); appendFileSync(join(cwd, 'docs/HANDOFF_LOG.md'), receipt); commit(cwd, 'closeout'); }, 0, 'source followed by both docs');
runCase(cwd => { write(cwd, 'docs/ACTIVE_WORK.md', 'Next review\n'); appendFileSync(join(cwd, 'docs/HANDOFF_LOG.md'), receipt); commit(cwd, 'outdated receipt'); write(cwd, 'components/NpcPanel.js', 'new\n'); commit(cwd, 'unrecorded later code'); }, 1, 'new code after receipt');
runCase(cwd => { write(cwd, 'components/NpcPanel.js', 'new\n'); write(cwd, 'docs/ACTIVE_WORK.md', 'Next review\n'); write(cwd, 'docs/HANDOFF_LOG.md', '# overwritten\n' + receipt); commit(cwd, 'rewritten history'); }, 1, 'rewritten original log');
runCase(cwd => { write(cwd, 'docs/README.md', 'docs only\n'); commit(cwd, 'docs'); }, 0, 'documentation-only change');
runCase(cwd => { write(cwd, 'scripts/new_validator.mjs', 'new\n'); write(cwd, 'docs/ACTIVE_WORK.md', 'Next review\n'); commit(cwd, 'script without receipt'); }, 1, 'one handoff document missing');
runCase(cwd => { write(cwd, 'components/NpcPanel.js', 'new\n'); commit(cwd, 'legacy source without docs'); },
  0, 'existing held PR gives advisory rather than a retroactive block', '2026-11-13T06:05:25Z');
// A held, stacked research PR compares against its moving parent, not main.
{
  const { cwd, base } = fixture();
  try {
    git(cwd, 'checkout', '-qb', 'research/parent', 'main');
    write(cwd, 'docs/ACTIVE_WORK.md', 'Parent next task\n');
    appendFileSync(join(cwd, 'docs/HANDOFF_LOG.md'), receipt);
    const parent = commit(cwd, 'parent handoff');
    git(cwd, 'checkout', '-qb', 'research/child');
    write(cwd, 'components/NpcPanel.js', 'child source\n');
    write(cwd, 'docs/ACTIVE_WORK.md', 'Child next task\n');
    appendFileSync(join(cwd, 'docs/HANDOFF_LOG.md'), receipt);
    commit(cwd, 'child source and authored closeout');
    const result = audit(cwd, parent);
    assert.equal(result.code, 0, 'stacked research PR: ' + result.output);
    console.log('PASS newly created PR stacked on a research base');
  } finally { rmSync(cwd, {recursive:true,force:true}); }
}

import { readFileSync } from 'node:fs';
const wf = readFileSync('.github/workflows/validate-handoff-continuity.yml', 'utf8');
for (const term of [
  'pull_request_target:', 'ref: ${{ github.event.repository.default_branch }}',
  'PR_BASE_REF: ${{ github.event.pull_request.base.ref }}',
  'PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}',
  'PR_CREATED_AT: ${{ github.event.pull_request.created_at }}',
  'test "$(git rev-parse refs/remotes/origin/continuity-pr-base)" = "$PR_BASE_SHA"',
  'persist-credentials: false', 'contents: read',
]) assert.ok(wf.includes(term), 'Missing trusted-workflow safety contract: ' + term);
for (const unsafe of [
  'ref: ${{ github.event.pull_request.base.sha }}',
  'ref: ${{ github.event.pull_request.head.sha }}',
  'contents: write',
  'secrets.SUPABASE', 'secrets.VERCEL', 'secrets.OPENAI',
]) assert.ok(!wf.includes(unsafe), 'Unsafe trusted-workflow configuration: '+unsafe);

console.log('PASS all continuity behavioral and trusted-workflow contract fixtures');
