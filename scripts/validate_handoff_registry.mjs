/**
 * Read-only DNDNext documentation registry validator.
 * Run from repository root: node scripts/validate_handoff_registry.mjs
 * This checks local source paths and document structure only. It never connects
 * to Supabase, GitHub or Vercel and must not be called a browser/gameplay test.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const here = (p) => path.join(root, p);
const registryPath = here('docs/SYSTEM_REGISTRY.json');
assert(fs.existsSync(registryPath), 'SYSTEM_REGISTRY.json is missing');
const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const failures = [];
const fail = (message) => failures.push(message);
const statuses = new Set([
  'source-deployed', 'source-db-deployed', 'partial-feature-deployed',
  'downstream-gap', 'research-only', 'planned',
  'visual-acceptance-pending', 'protected-production', 'security-review-needed',
]);
function pathCheck(p, id, role) {
  if (typeof p !== 'string' || !p || p.includes('..') || path.isAbsolute(p)) {
    fail(`${id}: invalid ${role} path ${JSON.stringify(p)}`);
    return;
  }
  if (!fs.existsSync(here(p))) fail(`${id}: missing ${role}: ${p}`);
}
if (reg.schema_version !== 2) fail('expected schema_version 2');
if (!Array.isArray(reg.systems) || !reg.systems.length) fail('systems must be nonempty array');
const seen = new Set();
for (const item of reg.systems || []) {
  if (!item || typeof item !== 'object') { fail('invalid system item'); continue; }
  const id = item.id;
  if (!/^[a-z][a-z0-9-]*$/.test(id || '')) fail(`invalid system id: ${id}`);
  if (seen.has(id)) fail(`duplicate system: ${id}`);
  seen.add(id);
  if (!statuses.has(item.status)) fail(`${id}: invalid status: ${item.status}`);
  if (!item.label || !item.scope_note || !/^\d{4}-\d{2}-\d{2}$/.test(item.last_checked || '')) fail(`${id}: missing label, scope_note or ISO last_checked`);
  if (!Array.isArray(item.code_paths) || !item.code_paths.length) fail(`${id}: code_paths required`);
  else item.code_paths.forEach((p) => pathCheck(p,id,'code'));
  if (!Array.isArray(item.tests)) fail(`${id}: tests must be an array (empty allowed)`);
  else item.tests.forEach((p) => pathCheck(p,id,'test'));
  if (!Array.isArray(item.open_gaps)) fail(`${id}: open_gaps must be an array`);
  if (!Array.isArray(item.protected_boundaries) || !item.protected_boundaries.length) fail(`${id}: protected_boundaries required`);
  const ev = item.verification;
  for (const k of ['source','live_database','deployed_sha','test_status','browser_acceptance','owner_approval']) {
    if (!ev || typeof ev[k] !== 'string' || !ev[k].trim()) fail(`${id}: missing verification.${k}`);
  }
  if (item.status === 'research-only' && ev?.deployed_sha?.includes('main-sha-matches')) fail(`${id}: research-only item must not claim a production implementation`);
  if (ev?.browser_acceptance?.includes('accepted') && !ev?.browser_acceptance?.includes('unverified') && !item.acceptance_evidence_url) {
    fail(`${id}: browser acceptance claimed without acceptance_evidence_url`);
  }
}
const required = ['PHASED_DEVELOPMENT_CHECKLIST.md','PROJECT_STATE.md','ACTIVE_WORK.md','HANDOFF_LOG.md','DOCUMENT_LIFECYCLE.md','HANDOFF_RECEIPT_TEMPLATE.md','START_HERE_ACTIVE_HANDOFF.md','SPELL_ENGINE_DECISIONS.md','README.md'];
required.forEach((p)=>pathCheck(`docs/${p}`,'navigation','document'));
pathCheck('AGENTS.md','navigation','instructions');
const state = fs.readFileSync(here('docs/PROJECT_STATE.md'),'utf8');
const active = fs.readFileSync(here('docs/ACTIVE_WORK.md'),'utf8');
const handoff = fs.readFileSync(here('docs/START_HERE_ACTIVE_HANDOFF.md'),'utf8');
const phases = fs.readFileSync(here('docs/PHASED_DEVELOPMENT_CHECKLIST.md'),'utf8');
const receipts = fs.readFileSync(here('docs/HANDOFF_RECEIPT_TEMPLATE.md'),'utf8');
const agents = fs.readFileSync(here('AGENTS.md'),'utf8');
for (const token of ['SYSTEM_REGISTRY.json','ACTIVE_WORK.md','HANDOFF_LOG.md']) {
  if (!state.includes(token)) fail(`PROJECT_STATE missing ${token}`);
  if (!handoff.includes(token)) fail(`START_HERE_ACTIVE_HANDOFF missing ${token}`);
}
for (const page of [{name:'AGENTS.md',value:agents}, {name:'PROJECT_STATE.md',value:state}, {name:'ACTIVE_WORK.md',value:active}, {name:'START_HERE_ACTIVE_HANDOFF.md',value:handoff}]) {
  if (!page.value.includes('PHASED_DEVELOPMENT_CHECKLIST.md')) fail(`${page.name} must link the phased checklist`);
}
for (let i = 0; i <= 7; i++) if (!phases.includes(`### S${i} —`)) fail(`phased checklist missing S${i} session gate`);
for (let i = 0; i <= 6; i++) if (!phases.includes(`### P${i} —`)) fail(`phased checklist missing P${i} product phase`);
for (const token of ['**S0 exit:**','**S7 exit:**','**P0 exit:**','**P6 exit:**','No automatic']) {
  // 'No automatic' is a deletion-policy phrase in DOCUMENT_LIFECYCLE, not a phase requirement.
  if (token === 'No automatic') continue;
  if (!phases.includes(token)) fail(`phased checklist missing exit gate: ${token}`);
}
for (const token of ['Active product phase', 'S0–S7 gates', 'Phase exit conditions']) if (!receipts.includes(token)) fail(`handoff receipt missing ${token}`);
if (!/\*\*Active phase \/ subphase:\*\* `P\d \/ P\d\.\d/.test(active)) fail('ACTIVE_WORK must provide a single current P# / P#.# identifier');
if (!active.includes('Next single action:') && !active.includes('**Next single action:**')) fail('ACTIVE_WORK needs one explicit next action');
if (!reg.snapshot?.main_sha || !reg.snapshot?.production_deployment_id) fail('registry missing dated production baseline');
if (failures.length) {
  for (const f of failures) console.error('HANDOFF REGISTRY ERROR:',f);
  process.exitCode=1;
} else {
  console.log(`DNDNext handoff registry validated: ${seen.size} systems, all referenced local source/test files, current docs and evidence fields; no network or gameplay action.`);
}