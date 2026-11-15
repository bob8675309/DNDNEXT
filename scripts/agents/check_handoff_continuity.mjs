#!/usr/bin/env node
// Read-only git-history gate. Execute only the trusted default-branch copy in
// pull_request_target; never run an incoming PR's version with elevated access.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const HANDOFF = 'docs/HANDOFF_LOG.md';
const ACTIVE = 'docs/ACTIVE_WORK.md';
const MATERIAL = /^(?:pages\/|components\/|lib\/|utils\/|hooks\/|styles\/|sql\/|supabase\/|scripts\/|public\/|\.github\/workflows\/|\.github\/actions\/|next\.config\.|package(?:-lock)?\.json$|vercel\.json$)/;

export function isMaterialPath(path) {
  return MATERIAL.test(path) && !path.startsWith('docs/');
}

export function assessHandoff({ paths, oldLog, newLog, sourceIndex, receiptIndex }) {
  const changed = new Set(paths);
  const material = paths.filter(isMaterialPath);
  if (!material.length) return { ok: true, note: 'Documentation-only or non-runtime PR; no mechanical handoff gate.', material: [] };
  const errors = [];
  if (!changed.has(ACTIVE)) errors.push(`Missing ${ACTIVE} update in this PR.`);
  if (!changed.has(HANDOFF)) errors.push(`Missing ${HANDOFF} update in this PR.`);
  if (changed.has(HANDOFF)) {
    if (typeof oldLog !== 'string' || typeof newLog !== 'string' || !newLog.startsWith(oldLog)) {
      errors.push(`${HANDOFF} must append to the merge-base content; historical entries cannot be rewritten.`);
    } else {
      const appended = newLog.slice(oldLog.length);
      if (appended.trim().length < 100 || !/##\s+20\d{2}-\d{2}-\d{2}/.test(appended) || !/next (?:task|action)/i.test(appended)) {
        errors.push(`${HANDOFF} needs a substantive dated appended receipt and an explicit next task/action.`);
      }
    }
  }
  if (sourceIndex < 0 || receiptIndex < sourceIndex) {
    errors.push('The latest substantive source change is newer than the last HANDOFF_LOG update; append an exact-source closeout receipt.');
  }
  return { ok: errors.length === 0, errors, material };
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}
function pathsBetween(base, head) {
  return git('diff', '--name-only', '-z', base, head).split('\0').filter(Boolean);
}
function fileAt(commit, path) {
  return git('show', `${commit}:${path}`);
}
export function checkRepository(baseSha, headSha) {
  if (!SHA.test(baseSha || '') || !SHA.test(headSha || '')) throw new Error('base/head must be 40-character lowercase Git SHAs');
  const ancestor = git('merge-base', baseSha, headSha).trim();
  if (!SHA.test(ancestor)) throw new Error('Unable to resolve PR merge base');
  const paths = pathsBetween(ancestor, headSha);
  if (!paths.some(isMaterialPath)) return assessHandoff({ paths, sourceIndex: -1, receiptIndex: -1 });
  const commits = git('rev-list', '--reverse', '--topo-order', `${ancestor}..${headSha}`).trim().split('\n').filter(Boolean);
  let sourceIndex = -1, receiptIndex = -1;
  for (const [index, commit] of commits.entries()) {
    const parent = git('rev-parse', `${commit}^1`).trim();
    const changed = pathsBetween(parent, commit);
    if (changed.some(isMaterialPath)) sourceIndex = index;
    if (changed.includes(HANDOFF)) receiptIndex = index;
  }
  return assessHandoff({
    paths, oldLog: fileAt(ancestor, HANDOFF), newLog: fileAt(headSha, HANDOFF),
    sourceIndex, receiptIndex,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const outcome = checkRepository(process.env.PR_BASE_SHA, process.env.PR_HEAD_SHA);
    for (const item of outcome.errors || []) console.error(`HANDOFF CONTINUITY: ${item}`);
    console.log(outcome.ok
      ? `PASS: ${outcome.note || `${outcome.material.length} material paths and authored, appended, source-fresh handoff.`}`
      : `FAIL: ${outcome.material.length} material paths; do not accept a stale handoff.`);
    if (!outcome.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`HANDOFF CONTINUITY: unable to verify PR safely: ${error.message}`);
    process.exitCode = 1;
  }
}
