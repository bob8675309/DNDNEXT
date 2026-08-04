import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const path='scripts/validate_npc_sheet_selection_reconciliation.mjs';
let s=fs.readFileSync(path,'utf8');
const start=s.indexOf('for (const token of [\n  \'import { useCallback, useEffect, useMemo, useRef, useState } from "react";\',');
const end=s.indexOf(']) expect(page.includes(token), `NPC selection reconciliation missing ${JSON.stringify(token)}`);',start);
if(start<0||end<0)throw new Error('validator token block missing');
const block=`for (const token of [
  'import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
  'const selectCharacterKey = useCallback((nextKey) => {',
  'const retrySelectedSheet = useCallback(() => {',
  'const sheetCacheRef = useRef(new Map());',
  'const [sheetCacheReady, setSheetCacheReady] = useState(false);',
  '.from("character_sheets")',
  '.select("character_id,sheet")',
  'sheetCacheRef.current = cache;',
  'sheetCacheRef.current.has(String(selectedId))',
  'const cachedSheet = hasCachedSheet ? deepClone(',
  'sheetCacheRef.current.set(cacheKey, deepClone(next));',
  'if (!sheetCacheReady) return;',
  'void loadSelectedSheet(requestedKey, { force: sheetReloadToken > 0 });',
  'sheetCacheRef.current.delete(String(id));',
  'const isCurrentRequest = () => isCurrentNpcSelectionRequest({',
  'sheetRequestRef.current += 1;',
  'equipmentRequestRef.current += 1;',
  'notesRequestRef.current += 1;',
  'setSheet(cachedSheet);',
  'setSheetDraft(cachedSheet ? deepClone(cachedSheet) : {});',
  'setEquippedRows([]);',
  'setNotes([]);',
  'setSheetLoadError("");',
  'setSheetLoading(Boolean(normalized) && !hasCachedSheet);',
  'activeKey: selectedKeyRef.current,',
  'activeRequestId: sheetRequestRef.current,',
  'activeRequestId: equipmentRequestRef.current,',
  'activeRequestId: notesRequestRef.current,',
  'key={selectedKey || "no-selection"}',
  'Loading the selected character sheet…',
  'Retry sheet',
]) expect(page.includes(token), \`NPC selection reconciliation missing \${JSON.stringify(token)}\`);`;
s=s.slice(0,start)+block+s.slice(end+' ]) expect(page.includes(token), `NPC selection reconciliation missing ${JSON.stringify(token)}`);'.length);
s=s.replace('expect(!page.includes("let timedOut = false;"),\n  "sheet deadline must not depend on an aborted request reaching finally");','expect(!page.includes("sheetAbortRef"),\n  "ordinary NPC switching must not churn AbortController-backed sheet requests");\nexpect(!page.includes(".abortSignal("),\n  "ordinary NPC switching must use cached snapshots instead of abortable per-click reads");\nexpect(!page.includes("settleWithDeadline(request"),\n  "ordinary NPC switching must not depend on a request deadline");');
s=s.replace('expect((page.match(/isCurrentNpcSelectionRequest\\(\\{/g) || []).length >= 3,\n  "sheet, equipment, and notes must all use request/identity guards; the sheet reuses one centralized guard helper");','expect((page.match(/isCurrentNpcSelectionRequest\\(\\{/g) || []).length >= 3,\n  "explicit sheet refresh, equipment, and notes must retain request/identity guards");\nexpect((page.match(/select\\(\\"character_id,sheet\\"\\)/g) || []).length === 1,\n  "NPC sheets must be preloaded through one page-level snapshot query");');
fs.writeFileSync(path,s);
const doc='docs/NPC_Character_Sheet_Selection_Reconciliation.md';
let d=fs.readFileSync(doc,'utf8');
d += `\n\n## Snapshot-cache amendment (2026-08-04)\n\nNormal roster switching no longer starts a character-sheet request. The page preloads accessible \`character_sheets\` rows once into a \`Map<character_id, sheet>\` and switches synchronously from deep-cloned snapshots. This removes tab suspension and rapid-click network timing from ordinary selection.\n\nA guarded single-record query remains only for explicit Retry/refresh. Accepted sheet state is written back into the cache, so saves remain current when switching away and back. Equipped-item and notes reads retain their independent identity/request guards. Do not reintroduce per-click abort/deadline churn for sheet switching.\n`;
fs.writeFileSync(doc,d);
fs.rmSync('scripts/bake_npc_sheet_cache_validator_once.mjs');
fs.rmSync('.github/workflows/bake-npc-sheet-cache-validator-once.yml');
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','scripts/validate_npc_sheet_selection_reconciliation.mjs','docs/NPC_Character_Sheet_Selection_Reconciliation.md','scripts/bake_npc_sheet_cache_validator_once.mjs','.github/workflows/bake-npc-sheet-cache-validator-once.yml']);
execFileSync('git',['commit','-m','Validate cached NPC sheet switching']);
execFileSync('git',['push']);
