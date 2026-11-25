// Issue #389 review-only model. Exact-byte fixture pinned; dependency closure pending.
// Never use this model to authorize a live skip or infer signed acceptance.
import assert from 'node:assert/strict';
export const blob = '7343fcffdca0ee76c0785b6e9e341b48a7951d2e';
export const job = 'signed-real-original-research';
const pushRef = 'refs/heads/research/c34-clean-main-privacy-forge-joint-source-20261112';
const census = 'scripts/integration/c34/test_t46_p3_p4b_c2b13_merchant_writer_census.mjs';
export function classify(e = {}) {
  const full = {recommendation:'full', signedAcceptance:false, job};
  if (e.event === 'pull_request' && e.sameRepo !== true)
    return {...full, recommendation:'preserve-trust-restriction', eligible:false};
  if (e.event === 'push' && e.ref !== pushRef)
    return {...full, recommendation:'preserve-trigger-restriction', eligible:false};
  if (!['push','pull_request','workflow_dispatch'].includes(e.event))
    return {...full, eligible:false};
  const result = {...full, eligible:true};
  if (e.event === 'workflow_dispatch' || e.attempt !== 1 || e.cancelled !== false ||
      e.forcePush !== false || e.baseStable !== true || e.complete !== true ||
      e.workflowBlob !== blob || !Array.isArray(e.files) || !e.files.length ||
      e.files.length >= 300 || e.total !== e.files.length) return result;
  if (!e.files.every(f => f && f.status === 'modified' &&
      (f.path === census || /^docs\/[A-Za-z0-9_/-]+\.md$/.test(f.path)))) return result;
  // No dependency closure or required-check authorization established yet.
  return {...result, sourceOnlyCandidate:true};
}
const base = {event:'pull_request',sameRepo:true,attempt:1,cancelled:false,
 forcePush:false,baseStable:true,complete:true,workflowBlob:blob,total:1,
 files:[{path:census,status:'modified'}]};
const cases = [
 ['census',{},'full',true],['docs',{files:[{path:'docs/a.md',status:'modified'}]},'full',true],
 ['fork',{sameRepo:false},'preserve-trust-restriction'],['unknown trust',{sameRepo:undefined},'preserve-trust-restriction'],
 ['push',{event:'push',ref:pushRef},'full',true],['other push',{event:'push',ref:'refs/heads/main'},'preserve-trigger-restriction'],
 ['manual',{event:'workflow_dispatch'},'full'],['rerun',{attempt:2},'full'],
 ['cancelled',{cancelled:true},'full'],['missing',{files:undefined},'full'],
 ['truncated',{complete:false},'full'],['count mismatch',{total:2},'full'],
 ['oversized',{files:Array(300).fill(base.files[0]),total:300},'full'],
 ['base drift',{baseStable:false},'full'],['force push',{forcePush:true},'full'],
 ['blob drift',{workflowBlob:'old'},'full'],['unknown event',{event:'pull_request_target'},'full'],
 ['rename',{files:[{path:census,status:'renamed'}]},'full'],
 ['delete',{files:[{path:census,status:'removed'}]},'full'],
 ...['sql/a.sql','scripts/fixtures/a.sql','.github/workflows/validate-c34-joint-local-auth.yml','package-lock.json','scripts/integration/c34/test_joint_pg17_local_auth.mjs'].map(path=>[path,{files:[{path,status:'modified'}]},'full']),
 ['mixed',{files:[...base.files,{path:'sql/a.sql',status:'modified'}],total:2},'full'],
 ['same-name success',{checkName:job,conclusion:'success'},'full',true]
];
for (const [name,patch,want,candidate] of cases) {
 const got=classify({...base,...patch});
 assert.equal(got.recommendation,want,name);
 assert.equal(got.signedAcceptance,false,name);
 assert.equal(Boolean(got.sourceOnlyCandidate),Boolean(candidate),name);
 assert.equal(got.job,job,name);
}
console.log(cases.length+' review-only cases passed; signed acceptance NOT RUN');

import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
function gitBlob(bytes) {
  return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
const bytes=readFileSync(new URL('./fixtures/c34-current-signed-workflow.yml.txt',import.meta.url));
assert.equal(gitBlob(bytes),blob,'exact signed workflow fixture');
assert.notEqual(gitBlob(Buffer.concat([bytes,Buffer.from('\n')])),blob,'modified bytes must invalidate lock');
console.log('2 exact-byte source lock assertions passed; signed acceptance NOT RUN');

// Literal inventory is a lower bound, not a shell parser or transitive graph.
export function inventory(source) {
  const paths = [...new Set(source.match(/(?:scripts|sql|supabase|pages|components|lib|utils|docs|\.github)\/[A-Za-z0-9_./-]+\.(?:mjs|cjs|js|jsx|ts|tsx|sql|json|md|yml|yaml|sh|html|css|scss)\b/g) || [])].sort();
  const dynamicLines = source.split('\n').flatMap((line,i) =>
    /\$\{|\$\(|\b(?:eval|source|find|xargs|npm|npx|docker)\b/.test(line) ? [i+1] : []);
  return {paths, dynamicLines, closureProven:false, bypassAuthorized:false};
}
const inv = inventory(bytes.toString('utf8'));
for (const p of [
 'scripts/integration/c34/validate_source_contract.mjs',
 'scripts/integration/c34/validate_joint_fixture_blobs.mjs',
 'scripts/integration/c34/test_joint_pg17_local_auth.mjs',
 'scripts/browser/verify_c33_creator_backstory_dom.mjs'
]) assert.ok(inv.paths.includes(p), p);
assert.ok(inv.paths.some(p=>p.endsWith('.sql')), 'SQL references');
assert.ok(inv.dynamicLines.length>0, 'dynamic commands remain unresolved');
assert.equal(inv.closureProven,false);
assert.equal(inv.bypassAuthorized,false);
assert.equal(inventory('node $SCRIPT').bypassAuthorized,false);
assert.equal(inventory('').closureProven,false);
assert.deepEqual(inventory('node scripts/a.mjs\nnode scripts/a.mjs').paths,['scripts/a.mjs']);
console.log('11 literal inventory assertions passed; '+inv.paths.length+' literal paths; closure NOT PROVEN');

// Checkout provenance is a conservative literal inventory, not shell resolution.
export function checkoutInventory(source) {
  const historical = [];
  const currentOrUnresolved = [];
  const checkoutBlocks = [...source.matchAll(/^[ \t]*uses: actions\/checkout@[^\n]+/gm)];
  // Explicit historical path/ref pair is pinned by the exact-byte fixture.
  const pinned = /ref: ([0-9a-f]{40})\s*\n\s*path: held345\b/.exec(source);
  for (const line of source.split('\n')) {
    const paths = inventory(line).paths;
    for (const path of paths) {
      // Only explicit held345/ prefixes qualify; cwd, variables and copies remain unresolved.
      if (pinned && line.includes('held345/'+path))
        historical.push({path,ref:pinned[1]});
      else currentOrUnresolved.push(path);
    }
  }
  return {historical,currentOrUnresolved,checkoutCount:checkoutBlocks.length,
    historicalRef:pinned?.[1] ?? null,closureProven:false,bypassAuthorized:false};
}
const provenance = checkoutInventory(bytes.toString('utf8'));
assert.equal(provenance.historicalRef,'4f5f8ff7587aff1a68f21581ad68a4752789f54a');
assert.equal(provenance.checkoutCount,2);
assert.ok(provenance.currentOrUnresolved.includes('scripts/integration/c34/test_joint_pg17_local_auth.mjs'));
const synthetic = 'ref: '+provenance.historicalRef+'\n  path: held345\nnode held345/scripts/a.mjs\nnode scripts/b.mjs';
assert.deepEqual(checkoutInventory(synthetic).historical,[{path:'scripts/a.mjs',ref:provenance.historicalRef}]);
assert.deepEqual(checkoutInventory(synthetic).currentOrUnresolved,['scripts/b.mjs']);
assert.equal(checkoutInventory('node held345/scripts/a.mjs').historical.length,0);
assert.equal(checkoutInventory(synthetic).bypassAuthorized,false);
assert.equal(provenance.closureProven,false);
console.log('8 checkout provenance assertions passed; closure NOT PROVEN');

// Record cwd and variable evidence without pretending to resolve shell execution.
export function checkoutContextEvidence(source) {
  const historicalCwd = [], unresolved = [];
  for (const [i,line] of source.split('\n').entries()) {
    if (/\bcd\s+held345\s*&&/.test(line))
      historicalCwd.push({line:i+1,paths:inventory(line).paths});
    if (/\b(?:cd|source|eval)\b|\bworking-directory:|\$[A-Za-z_{(]/.test(line))
      unresolved.push(i+1);
  }
  return {historicalCwd,unresolved,closureProven:false,bypassAuthorized:false};
}
const cwdEvidence=checkoutContextEvidence(bytes.toString('utf8'));
assert.ok(cwdEvidence.historicalCwd.some(x=>x.paths.includes('scripts/browser/verify_c33_creator_backstory_dom.mjs')));
assert.ok(cwdEvidence.historicalCwd.some(x=>x.paths.includes('scripts/browser/verify_c33_next_town_route.mjs')));
assert.ok(cwdEvidence.unresolved.length>0);
const cwdSynthetic=checkoutContextEvidence('(cd held345 && node scripts/a.mjs)\nnode "$SCRIPT"\nworking-directory: held345\nnode scripts/b.mjs');
assert.deepEqual(cwdSynthetic.historicalCwd,[{line:1,paths:['scripts/a.mjs']}]);
assert.deepEqual(cwdSynthetic.unresolved,[1,2,3]);
assert.equal(cwdSynthetic.closureProven,false);
assert.equal(cwdSynthetic.bypassAuthorized,false);
assert.equal(checkoutContextEvidence('').bypassAuthorized,false);
console.log('8 checkout context evidence assertions passed; closure NOT PROVEN');


// Historical source pin manifest: evidence only, not proof of transitive closure.
export function historicalSourcePins(source) {
  const blocks = [...source.matchAll(/done <<'SOURCEPINS'\s*\n([\s\S]*?)^\s*SOURCEPINS\s*$/gm)];
  const pins = new Map();
  const ref = checkoutInventory(source).historicalRef;
  let valid = blocks.length === 1 && Boolean(ref);
  if (valid) for (const line of blocks[0][1].trim().split('\n')) {
    const m = /^([A-Za-z0-9_./-]+) ([0-9a-f]{40})$/.exec(line.trim());
    if (!m || m[1].startsWith('/') || m[1].split('/').some(p=>!p || p==='.' || p==='..') || pins.has(m[1])) { valid=false; break; }
    pins.set(m[1],m[2]);
  }
  return {ref,pins:valid?[...pins].map(([path,sha])=>({path,sha})):[],valid:valid&&pins.size>0,closureProven:false,bypassAuthorized:false};
}
const sourcePins=historicalSourcePins(bytes.toString('utf8'));
assert.equal(sourcePins.valid,true);
assert.equal(sourcePins.pins.length,8);
assert.equal(sourcePins.ref,provenance.historicalRef);
assert.ok(sourcePins.pins.some(p=>p.path==='scripts/browser/verify_c33_npc_pdf_visual.mjs'&&p.sha==='1ee0f29a5c017906f2029eff25a9b1c1b88c5760'));
const pinPrefix="ref: "+provenance.historicalRef+"\n path: held345\n done <<'SOURCEPINS'\n";
const pinRow='scripts/a.mjs '+ 'a'.repeat(40);
const pinBlock=rows=>pinPrefix+rows+'\n SOURCEPINS\n';
assert.equal(historicalSourcePins(pinBlock(pinRow)).valid,true);
assert.equal(historicalSourcePins(pinBlock(pinRow+'\n'+pinRow)).valid,false);
assert.equal(historicalSourcePins(pinBlock('../a.mjs '+'a'.repeat(40))).valid,false);
assert.equal(historicalSourcePins(pinBlock('scripts/a.mjs bad')).valid,false);
assert.equal(historicalSourcePins('').valid,false);
assert.equal(sourcePins.bypassAuthorized,false);
assert.equal(sourcePins.closureProven,false);
console.log('11 historical source manifest assertions passed; actual historical bytes and closure NOT PROVEN');

 // Adapter dependency receipt: source inspection only; never import or execute adapter.
 export const adapterReceipt = {"path":"scripts/integration/c34/t20_adapt_held345_browser_fixture.mjs","sha":"d9c9557bcf16d24a09594c962a0c411cc7036573","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a","targets":[{"path":"scripts/browser/verify_c33_creator_backstory_dom.mjs","sha":"7b3a813d11d4b9e0fcd1ba8aef9d4e8463f58aa4"},{"path":"scripts/browser/verify_c33_next_town_route.mjs","sha":"d19b134fdb4e4b58833fe339f918c027959eae02"}]};
 export function adapterDependencyEvidence(workflow, receipt) {
   const pins = historicalSourcePins(workflow);
   const modes = workflow.split('\n').map(l=>l.trim()).filter(l=>l.startsWith('node '+adapterReceipt.path));
   const valid = pins.valid && receipt?.sha === adapterReceipt.sha &&
     receipt.ref === pins.ref && Array.isArray(receipt.targets) &&
     receipt.targets.length === 2 &&
     adapterReceipt.targets.every(expected=>receipt.targets.some(t=>t.path===expected.path && t.sha===expected.sha) &&
       pins.pins.some(p=>p.path===expected.path && p.sha===expected.sha)) &&
     modes.length===2 && modes.includes('node '+adapterReceipt.path) &&
     modes.includes('node '+adapterReceipt.path+' town-port');
   return {valid:Boolean(valid),scratchWrites:valid?receipt.targets.map(t=>({path:'held345/'+t.path,originalBlob:t.sha})):[],
     closureProven:false,bypassAuthorized:false};
 }
 const adapterWorkflow=bytes.toString('utf8');
 const adapterEvidence=adapterDependencyEvidence(adapterWorkflow,adapterReceipt);
 assert.equal(adapterEvidence.valid,true);
 assert.equal(adapterEvidence.scratchWrites.length,2);
 assert.equal(adapterDependencyEvidence(adapterWorkflow,{...adapterReceipt,sha:'0'.repeat(40)}).valid,false);
 assert.equal(adapterDependencyEvidence(adapterWorkflow,{...adapterReceipt,targets:[]}).valid,false);
 assert.equal(adapterDependencyEvidence(adapterWorkflow.replace('node '+adapterReceipt.path+' town-port','node '+adapterReceipt.path+' unknown'),adapterReceipt).valid,false);
 assert.equal(adapterDependencyEvidence(adapterWorkflow,{...adapterReceipt,ref:'0'.repeat(40)}).valid,false);
 assert.equal(adapterEvidence.closureProven,false);
 assert.equal(adapterEvidence.bypassAuthorized,false);
 console.log('Adapter dependency receipt assertions passed; runtime and closure NOT PROVEN');

 // Historical GitHub blob metadata receipts; not a transitive closure proof.
 const historicalReceipts = [{"path":"components/GlobalNpcProfileOverlay.js","sha":"a0e133a7c2446cba3f8c672a1df78f6a5aa73763","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a"},{"path":"utils/npcProfileOverlay.js","sha":"3d809c47a9aaae18d0e7e5ec6500199a9266baac","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a"},{"path":"components/CreatorBackstoryPanel.js","sha":"23b0e86aab7a80b7243365ba107c1d37a5ec5812","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a"},{"path":"styles/npc-profile-centered.css","sha":"150eb9ad78aeba268be955e63c8451e3c0ed0e14","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a"},{"path":"scripts/browser/verify_c33_creator_backstory_dom.mjs","sha":"7b3a813d11d4b9e0fcd1ba8aef9d4e8463f58aa4","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a"},{"path":"scripts/browser/verify_c33_next_town_route.mjs","sha":"d19b134fdb4e4b58833fe339f918c027959eae02","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a"},{"path":"scripts/browser/verify_c33_npc_pdf_visual.mjs","sha":"1ee0f29a5c017906f2029eff25a9b1c1b88c5760","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a"},{"path":"scripts/fixtures/c33_next_town_route_pg17.sql","sha":"0d3f1b261b7600944121c9be6f808fa190e8dddc","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a"}];
 export function verifyHistoricalReceipts(manifest, receipts) {
   return Boolean(manifest.valid && Array.isArray(receipts) &&
     receipts.length === manifest.pins.length &&
     new Set(receipts.map(r=>r.path)).size === receipts.length &&
     manifest.pins.every(p=>receipts.some(r=>r.path===p.path && r.sha===p.sha && r.ref===manifest.ref)));
 }
 assert.equal(verifyHistoricalReceipts(sourcePins,historicalReceipts),true);
 assert.equal(verifyHistoricalReceipts(sourcePins,[]),false);
 assert.equal(verifyHistoricalReceipts(sourcePins,historicalReceipts.slice(1)),false);
 assert.equal(verifyHistoricalReceipts(sourcePins,historicalReceipts.map(r=>({...r,ref:'wrong'}))),false);
 assert.equal(verifyHistoricalReceipts(sourcePins,historicalReceipts.map(r=>({...r,sha:'0'.repeat(40)}))),false);
 assert.equal(verifyHistoricalReceipts(sourcePins,[...historicalReceipts.slice(1),historicalReceipts[1]]),false);
 console.log('6 historical metadata receipt assertions passed; closure NOT PROVEN');

 // Historical import evidence: selected source lines, not a parser or full source fixture.
 const historicalImportReceipts = [{"path":"components/GlobalNpcProfileOverlay.js","sha":"a0e133a7c2446cba3f8c672a1df78f6a5aa73763","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a","lines":["import { useCallback, useEffect, useRef, useState } from \"react\";","import dynamic from \"next/dynamic\";","import { useRouter } from \"next/router\";","import { supabase } from \"../utils/supabaseClient\";","import { OPEN_NPC_PROFILE_EVENT } from \"../utils/npcProfileOverlay\";","  () => import(\"./character/CharacterInteractionPanel\"), { ssr: false }"]},{"path":"utils/npcProfileOverlay.js","sha":"3d809c47a9aaae18d0e7e5ec6500199a9266baac","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a","lines":[]},{"path":"components/CreatorBackstoryPanel.js","sha":"23b0e86aab7a80b7243365ba107c1d37a5ec5812","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a","lines":["import { useEffect, useState } from \"react\";","import { supabase } from \"../utils/supabaseClient\";"]},{"path":"styles/npc-profile-centered.css","sha":"150eb9ad78aeba268be955e63c8451e3c0ed0e14","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a","lines":[]},{"path":"scripts/browser/verify_c33_creator_backstory_dom.mjs","sha":"7b3a813d11d4b9e0fcd1ba8aef9d4e8463f58aa4","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a","lines":["import assert from \"node:assert/strict\";","import { randomUUID } from \"node:crypto\";","import { execFileSync, spawnSync } from \"node:child_process\";","import { createServer } from \"node:http\";","import { mkdtempSync, readFileSync, rmSync } from \"node:fs\";","import { tmpdir } from \"node:os\";","import path from \"node:path\";","import { createRequire } from \"node:module\";","import { createClient } from \"@supabase/supabase-js\";","import { PDFDocument } from \"pdf-lib\";","const required=createRequire(path.join(toolsRoot,\"c33-playwright-anchor.cjs\"));"]},{"path":"scripts/browser/verify_c33_next_town_route.mjs","sha":"d19b134fdb4e4b58833fe339f918c027959eae02","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a","lines":["import assert from \"node:assert/strict\";","import {randomUUID} from \"node:crypto\";","import {spawn,spawnSync} from \"node:child_process\";","import {createRequire} from \"node:module\";","import path from \"node:path\";","import {createClient} from \"@supabase/supabase-js\";","const {chromium}=createRequire(path.join(e.C33_BROWSER_TOOL_ROOT,\"c33-playwright-anchor.cjs\"))(\"playwright-core\");"]},{"path":"scripts/browser/verify_c33_npc_pdf_visual.mjs","sha":"1ee0f29a5c017906f2029eff25a9b1c1b88c5760","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a","lines":["import assert from \"node:assert/strict\";","import fs from \"node:fs\";","import os from \"node:os\";","import path from \"node:path\";","import { execFileSync } from \"node:child_process\";","import { PDFDocument } from \"pdf-lib\";","import { buildPrintableCharacterSheetModel } from \"../../utils/printableCharacterSheet.js\";","import { buildOfficialCharacterSheetPdf } from \"../../utils/officialCharacterSheetPdf.js\";"]},{"path":"scripts/fixtures/c33_next_town_route_pg17.sql","sha":"0d3f1b261b7600944121c9be6f808fa190e8dddc","ref":"4f5f8ff7587aff1a68f21581ad68a4752789f54a","lines":[]}];
 export function historicalImportInventory(lines) {
   const local=new Set(), external=new Set(), builtin=new Set(), unresolved=[];
   for(const line of lines) {
     const m=/^\s*(?:import|export)\s+.*?\bfrom\s*["']([^"']+)["']/.exec(line)
       || /^\s*import\s*["']([^"']+)["']/.exec(line);
     if(m) {
       const s=m[1];
       if(s.startsWith('.')) local.add(s);
       else if(s.startsWith('node:')) builtin.add(s);
       else if(/^(?:@[^/]+\/)?[A-Za-z0-9_-]/.test(s)) external.add(s);
       else unresolved.push(line);
     } else unresolved.push(line);
   }
   return {local:[...local].sort(),external:[...external].sort(),builtin:[...builtin].sort(),unresolved,closureProven:false,bypassAuthorized:false};
 }
 assert.equal(verifyHistoricalReceipts(sourcePins,historicalImportReceipts),true);
 const importEvidence=historicalImportReceipts.map(r=>({path:r.path,...historicalImportInventory(r.lines)}));
 const overlayImports=importEvidence.find(r=>r.path==='components/GlobalNpcProfileOverlay.js');
 assert.ok(overlayImports.local.includes('../utils/supabaseClient'));
 assert.ok(overlayImports.external.includes('next/dynamic'));
 assert.ok(overlayImports.unresolved.some(l=>l.includes('CharacterInteractionPanel')));
 assert.ok(importEvidence.some(r=>r.builtin.includes('node:fs')));
 assert.ok(importEvidence.some(r=>r.external.includes('pdf-lib')));
 assert.deepEqual(historicalImportInventory(['import(target)']).unresolved,['import(target)']);
 assert.equal(historicalImportInventory([]).closureProven,false);
 assert.equal(historicalImportInventory([]).bypassAuthorized,false);
 console.log('Historical import evidence assertions passed; selected lines only; closure NOT PROVEN');
