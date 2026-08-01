import fs from "node:fs";
import path from "node:path";
import {
  isCurrentNpcSelectionRequest,
  normalizeNpcSelectionKey,
} from "../utils/npcSelectionGuard.js";
import { settleWithDeadline } from "../utils/settleWithDeadline.js";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "pages/npcs.js"), "utf8");
const navbar = fs.readFileSync(path.join(root, "components/AppNavbar.js"), "utf8");
const adminBuildBadge = fs.readFileSync(path.join(root, "components/AdminBuildBadge.js"), "utf8");
const playerProfile = fs.readFileSync(path.join(root, "components/PlayerCharacterProfilePanel.js"), "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function extractAuthCallbackBody(source, label) {
  const listenerIndex = source.indexOf("onAuthStateChange");
  const arrowIndex = source.indexOf("=>", listenerIndex);
  const bodyStart = source.indexOf("{", arrowIndex);
  if (listenerIndex < 0 || arrowIndex < 0 || bodyStart < 0) {
    failures.push(`${label} auth callback could not be inspected`);
    return "";
  }

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }

  failures.push(`${label} auth callback is not balanced`);
  return "";
}

const dawn = "merchant:4bbde13d-403f-4541-b5e7-56494fd84d5f";
const pip = "npc:6b1254e9-38d6-45a6-b252-14a68157704a";
const raska = "npc:d0fe10d3-741c-44cb-93d7-49ed3d05a42b";

expect(normalizeNpcSelectionKey(`  ${pip}  `) === pip, "selection-key normalization");
expect(!isCurrentNpcSelectionRequest({
  activeKey: pip,
  requestedKey: dawn,
  activeRequestId: 12,
  requestId: 11,
}), "late previous-character response must be rejected");
expect(!isCurrentNpcSelectionRequest({
  activeKey: raska,
  requestedKey: pip,
  activeRequestId: 12,
  requestId: 12,
}), "matching request ID cannot attach to a different character");
expect(isCurrentNpcSelectionRequest({
  activeKey: raska,
  requestedKey: raska,
  activeRequestId: 13,
  requestId: 13,
}), "current character/current request must be accepted");

let timeoutCallbackCount = 0;
const deadlineStartedAt = Date.now();
const deadlineOutcome = await settleWithDeadline(new Promise(() => {}), {
  timeoutMs: 15,
  onTimeout: () => { timeoutCallbackCount += 1; },
});
expect(deadlineOutcome.status === "timeout", "never-settling sheet request must resolve through the deadline race");
expect(timeoutCallbackCount === 1, "deadline callback must run exactly once");
expect(Date.now() - deadlineStartedAt < 1000, "deadline helper must not wait for the underlying request to settle");

const fulfilledOutcome = await settleWithDeadline(Promise.resolve({ sheet: { level: 2 } }), {
  timeoutMs: 100,
});
expect(fulfilledOutcome.status === "fulfilled", "completed sheet request must win the deadline race");
expect(fulfilledOutcome.value?.sheet?.level === 2, "completed sheet result must be preserved");

for (const token of [
  'import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
  'import { settleWithDeadline } from "../utils/settleWithDeadline";',
  'const selectCharacterKey = useCallback((nextKey) => {',
  'const retrySelectedSheet = useCallback(() => {',
  'const sheetAbortRef = useRef(null);',
  'const [sheetLoadError, setSheetLoadError] = useState("");',
  'const [sheetReloadToken, setSheetReloadToken] = useState(0);',
  'const isCurrentRequest = () => isCurrentNpcSelectionRequest({',
  'sheetRequestRef.current += 1;',
  'equipmentRequestRef.current += 1;',
  'notesRequestRef.current += 1;',
  'sheetAbortRef.current?.abort();',
  '.abortSignal(controller.signal)',
  'const outcome = await settleWithDeadline(request, {',
  'timeoutMs: 8000,',
  'onTimeout: () => controller.abort(),',
  'outcome.status === "timeout"',
  'outcome.status === "rejected"',
  'setSheet(null);',
  'setSheetDraft({});',
  'setEquippedRows([]);',
  'setNotes([]);',
  'setSheetLoadError("");',
  'setSheetLoading(Boolean(normalized));',
  'isCurrentNpcSelectionRequest({',
  'activeKey: selectedKeyRef.current,',
  'requestedKey,',
  'activeRequestId: sheetRequestRef.current,',
  'activeRequestId: equipmentRequestRef.current,',
  'activeRequestId: notesRequestRef.current,',
  '}, [selectedKey, sheetReloadToken, loadSelectedSheet]);',
  '}, [selectedKey, loadSelectedNotes]);',
  'if (active && (sheetLoading || sheetLoadError)) retrySelectedSheet();',
  'key={selectedKey || "no-selection"}',
  'Loading the selected character sheet…',
  'Retry sheet',
  '{!sheetLoading && !sheetLoadError ? (',
]) expect(page.includes(token), `NPC selection reconciliation missing ${JSON.stringify(token)}`);

expect(!page.includes('}, [sheet, selectedKey]);'),
  "selection changes must not copy the previous sheet into the next character's draft");
expect(!page.includes('void Promise.allSettled([\n      loadSelectedSheet(requestedKey),\n      loadSelectedNotes(requestedKey),'),
  "sheet loading must remain independent from notes availability and callback identity");
expect(!page.includes("let timedOut = false;"),
  "sheet deadline must not depend on an aborted request reaching finally");
expect((page.match(/setSelectedKey\(/g) || []).length === 1,
  "all NPC selection changes must pass through selectCharacterKey");
expect((page.match(/isCurrentNpcSelectionRequest\(\{/g) || []).length >= 3,
  "sheet, equipment, and notes must all use request/identity guards; the sheet reuses one centralized guard helper");
expect((page.match(/retrySelectedSheet/g) || []).length >= 3,
  "selected-row and explicit retry paths must both reach retrySelectedSheet");

expect(navbar.includes('import { supabase } from "../utils/supabaseClient";'),
  "AppNavbar must use the shared Supabase singleton");
expect(!navbar.includes('createClient'),
  "AppNavbar must not instantiate a second GoTrueClient under the shared storage key");

for (const subscriber of [
  { label: "AppNavbar", source: navbar, scheduleCall: "scheduleSessionWork(session);" },
  { label: "AdminBuildBadge", source: adminBuildBadge, scheduleCall: "scheduleAdminCheck(session);" },
  { label: "PlayerCharacterProfilePanel", source: playerProfile, scheduleCall: "scheduleSessionWork(session);" },
]) {
  const callbackBody = extractAuthCallbackBody(subscriber.source, subscriber.label);
  expect(callbackBody.includes(subscriber.scheduleCall),
    `${subscriber.label} auth callback must only schedule post-lock work`);
  for (const forbidden of ["supabase.", "getSession(", ".rpc(", ".from(", "loadLinkedCharacter(", "checkAdmin(", "applySession("]) {
    expect(!callbackBody.includes(forbidden),
      `${subscriber.label} auth callback must not execute ${forbidden} while the auth lock is held`);
  }
  expect(subscriber.source.includes("deferredAuthTimer = setTimeout(() => {"),
    `${subscriber.label} must defer Supabase work to a macrotask`);
  expect(subscriber.source.includes("if (deferredAuthTimer !== null) clearTimeout(deferredAuthTimer);"),
    `${subscriber.label} must cancel deferred auth work during supersession and cleanup`);
}

if (failures.length) {
  console.error("NPC sheet selection reconciliation validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("NPC sheet selection reconciliation validation passed.");
