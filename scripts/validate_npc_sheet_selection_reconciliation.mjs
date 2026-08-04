import fs from "node:fs";
import path from "node:path";
import {
  isCurrentNpcSelectionRequest,
  normalizeNpcSelectionKey,
} from "../utils/npcSelectionGuard.js";
import { settleWithDeadline } from "../utils/settleWithDeadline.js";
import {
  shouldAutoOpenPlayerCharacterForge,
  shouldAutoOpenPlayerCharacterPanel,
} from "../utils/playerCharacterForgeGuard.js";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "pages/npcs.js"), "utf8");
const navbar = fs.readFileSync(path.join(root, "components/AppNavbar.js"), "utf8");
const adminBuildBadge = fs.readFileSync(path.join(root, "components/AdminBuildBadge.js"), "utf8");
const playerProfileEntry = fs.readFileSync(path.join(root, "components/PlayerCharacterProfilePanel.js"), "utf8");
const playerProfile = fs.readFileSync(path.join(root, "components/PlayerCharacterProfilePanelUnified.js"), "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function extractAuthCallbackBody(source, label) {
  const listenerIndex = source.indexOf("onAuthStateChange");
  const arrowIndex = source.indexOf("=>", listenerIndex);
  if (listenerIndex < 0 || arrowIndex < 0) {
    failures.push(`${label} auth callback could not be inspected`);
    return "";
  }

  let bodyStart = arrowIndex + 2;
  while (/\s/.test(source[bodyStart] || "")) bodyStart += 1;
  if (source[bodyStart] !== "{") {
    const expressionEnd = source.indexOf(";", bodyStart);
    if (expressionEnd < 0) {
      failures.push(`${label} auth callback expression could not be inspected`);
      return "";
    }
    return source.slice(bodyStart, expressionEnd + 1);
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

function isCurrentProfileLoadRequest({ activeUserId, requestedUserId, activeRequestId, requestId }) {
  return Boolean(requestedUserId)
    && String(activeUserId || "") === String(requestedUserId)
    && Number(activeRequestId) === Number(requestId);
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
]) expect(page.includes(token), `NPC selection reconciliation missing ${JSON.stringify(token)}`);
expect(!page.includes('}, [sheet, selectedKey]);'),
  "selection changes must not copy the previous sheet into the next character's draft");
expect(!page.includes('void Promise.allSettled([\n      loadSelectedSheet(requestedKey),\n      loadSelectedNotes(requestedKey),'),
  "sheet loading must remain independent from notes availability and callback identity");
expect(!page.includes("sheetAbortRef"),
  "ordinary NPC switching must not churn AbortController-backed sheet requests");
expect(!page.includes(".abortSignal("),
  "ordinary NPC switching must use cached snapshots instead of abortable per-click reads");
expect(!page.includes("settleWithDeadline(request"),
  "ordinary NPC switching must not depend on a request deadline");
expect((page.match(/setSelectedKey\(/g) || []).length === 1,
  "all NPC selection changes must pass through selectCharacterKey");
expect((page.match(/isCurrentNpcSelectionRequest\(\{/g) || []).length >= 3,
  "explicit sheet refresh, equipment, and notes must retain request/identity guards");
expect((page.match(/select\(\"character_id,sheet\"\)/g) || []).length === 1,
  "NPC sheets must be preloaded through one page-level snapshot query");
expect((page.match(/retrySelectedSheet/g) || []).length >= 3,
  "selected-row and explicit retry paths must both reach retrySelectedSheet");

let activeProfileUserId = "old-user";
let activeProfileRequestId = 1;
let committedProfile = null;
const commitProfileAfter = async ({ userId, requestId, delayMs, value }) => {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  if (!isCurrentProfileLoadRequest({
    activeUserId: activeProfileUserId,
    requestedUserId: userId,
    activeRequestId: activeProfileRequestId,
    requestId,
  })) return;
  committedProfile = value;
};
const oldProfileLoad = commitProfileAfter({
  userId: "old-user",
  requestId: 1,
  delayMs: 20,
  value: "old-character",
});
activeProfileUserId = "new-user";
activeProfileRequestId = 2;
const newProfileLoad = commitProfileAfter({
  userId: "new-user",
  requestId: 2,
  delayMs: 1,
  value: "new-character",
});
await Promise.all([oldProfileLoad, newProfileLoad]);
expect(committedProfile === "new-character",
  "a delayed old-user profile load must not overwrite the current user's profile");

expect(shouldAutoOpenPlayerCharacterForge({
  routerReady: true,
  pathname: "/profile",
  isLoggedIn: true,
  loading: false,
  needsCharacter: true,
}), "a verified missing character on the first profile route must open the Forge");
expect(!shouldAutoOpenPlayerCharacterForge({
  routerReady: true,
  pathname: "/map",
  isLoggedIn: true,
  loading: false,
  needsCharacter: true,
}), "a missing character must not interrupt another route");
expect(!shouldAutoOpenPlayerCharacterForge({
  routerReady: true,
  pathname: "/profile",
  isLoggedIn: true,
  loading: true,
  needsCharacter: true,
}), "the Forge must not open before the linked-character lookup settles");
expect(!shouldAutoOpenPlayerCharacterForge({
  routerReady: true,
  pathname: "/profile",
  isLoggedIn: true,
  loading: false,
  needsCharacter: false,
}), "load failures and existing characters must not auto-open the Forge");

expect(shouldAutoOpenPlayerCharacterPanel({
  routerReady: true,
  pathname: "/profile",
  isLoggedIn: true,
  loading: false,
  hasCharacter: true,
  needsCharacter: false,
}), "an existing character must auto-open the profile panel after a successful lookup");
expect(shouldAutoOpenPlayerCharacterPanel({
  routerReady: true,
  pathname: "/profile",
  isLoggedIn: true,
  loading: false,
  hasCharacter: false,
  needsCharacter: true,
}), "a verified missing character must auto-open the panel and Forge");
expect(!shouldAutoOpenPlayerCharacterPanel({
  routerReady: true,
  pathname: "/profile",
  isLoggedIn: true,
  loading: false,
  hasCharacter: false,
  needsCharacter: false,
}), "a failed or unresolved lookup must not masquerade as a new account");

expect(playerProfileEntry.includes('import PlayerCharacterProfilePanelUnified from "./PlayerCharacterProfilePanelUnified";'),
  "Player profile entry must delegate to the unified implementation");
expect(playerProfileEntry.includes("export default PlayerCharacterProfilePanelUnified;"),
  "Player profile entry must export the unified implementation");

for (const token of [
  'import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
  "const activeProfileUserIdRef = useRef(null);",
  "const profileLoadRequestRef = useRef(0);",
  'import { shouldAutoOpenPlayerCharacterPanel } from "../utils/playerCharacterForgeGuard";',
  "shouldAutoOpenPlayerCharacterPanel({",
  "const requestId = ++profileLoadRequestRef.current;",
  "const isCurrentRequest = () => isCurrentProfileLoadRequest({",
  "activeUserId: activeProfileUserIdRef.current,",
  "requestedUserId,",
  "activeRequestId: profileLoadRequestRef.current,",
  "activeProfileUserIdRef.current = requestedUserId;",
  "activeProfileUserIdRef.current = null;",
]) expect(playerProfile.includes(token), `Player profile stale-load guard missing ${JSON.stringify(token)}`);
expect((playerProfile.match(/if \(!isCurrentRequest\(\)\) return null;/g) || []).length >= 4,
  "Player profile results must be guarded after every asynchronous query boundary and in failure handling");
expect((playerProfile.match(/profileLoadRequestRef\.current \+= 1;/g) || []).length >= 2,
  "Player profile loads must be invalidated on session replacement and component cleanup");

expect(navbar.includes('import { supabase } from "../utils/supabaseClient";'),
  "AppNavbar must use the shared Supabase singleton");
expect(!navbar.includes('createClient'),
  "AppNavbar must not instantiate a second GoTrueClient under the shared storage key");

for (const subscriber of [
  { label: "AppNavbar", source: navbar, scheduleCall: "scheduleSessionWork(session)" },
  { label: "AdminBuildBadge", source: adminBuildBadge, scheduleCall: "scheduleAdminCheck(session)" },
  { label: "PlayerCharacterProfilePanel", source: playerProfile, scheduleCall: "scheduleSessionWork(session)" },
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
