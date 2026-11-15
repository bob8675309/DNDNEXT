#!/usr/bin/env node
// C34 T25: source-locked, OFFLINE derivation of the actual current NPC manager.
// NOT a production route and NOT a security acceptance claim. The caller must
// mount the result only on a disposable localhost Next.js route, then remove it.
// Original #345 and C34 T21-T24 remain independent preservation authorities.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const T25_BASE_BLOB = "7fc00b9b3ace6233d1648a3d017f8a05e072d722";
export const T25_TEMP_ROUTE = "pages/__c34_t25_probe.jsx";
const gitBlobHash = input => createHash("sha1").update(
  "blob " + Buffer.byteLength(input) + "\0" + input
).digest("hex");

function replaceOnce(state, before, after, purpose) {
  const count = state.text.split(before).length - 1;
  assert.equal(count, 1, "T25 source drift (" + purpose + "): " + count);
  state.text = state.text.replace(before, after);
  state.edits.push(purpose);
}
function replaceSection(state, start, end, body, purpose) {
  const from = state.text.indexOf(start);
  assert.ok(from >= 0, "T25 missing start for " + purpose);
  assert.equal(state.text.indexOf(start, from + 1), -1, "T25 ambiguous " + purpose);
  const to = state.text.indexOf(end, from + start.length);
  assert.ok(to > from, "T25 missing end for " + purpose);
  state.text = state.text.slice(0, from) + body + state.text.slice(to);
  state.edits.push(purpose);
}
function changeRoster(state, start, end, kind) {
  const from = state.text.indexOf(start), to = state.text.indexOf(end, from);
  assert.ok(from >= 0 && to > from, "T25 " + kind + " roster anchors");
  let piece = state.text.slice(from, to);
  // Stage2 intentionally revokes broad authenticated characters SELECT, even
  // for GMs. Reuse the T24 signed-tested BASIC public projection for every
  // roster; obtain richer/secret fields ONLY through selected stage1/2 RPCs.
  const broadProjection = /\.select\(\s*\[[\s\S]*?\]\.join\(","\)\s*\)/g;
  const projections = [...piece.matchAll(broadProjection)];
  assert.equal(projections.length, 1, "T25 expects one source roster SELECT in " + kind);
  piece = piece.replace(broadProjection, '.select(C34_T25_PUBLIC_ROSTER_FIELDS)');
  assert.doesNotMatch(piece, /\.select\(\s*\[/, "T25 leaked source roster projection in " + kind);
  if (kind === "npc") {
    const old = /    let secretById = new Map\(\);[\s\S]*?    setNpcs\(rows\);/;
    assert.match(piece, old);
    piece = piece.replace(old, [
      '    const rows = (data || []).map(row => projectNonMapManagerRosterRow(row, "npc")).filter(Boolean);',
      '    setNpcs(rows);'
    ].join("\n"));
  } else if (kind === "merchant-profile") {
    const old = /    let secretById = new Map\(\);[\s\S]*?    setMerchantProfiles\(m\);/;
    assert.match(piece, old);
    piece = piece.replace(old, [
      "    const m = new Map();",
      '    for (const row of data || []) {',
      '      const safe = projectNonMapManagerRosterRow({ ...row, kind: "merchant" }, "merchant");',
      "      if (safe) m.set(String(safe.id), safe);",
      "    }",
      "    setMerchantProfiles(m);"
    ].join("\n"));
  }
  state.text = state.text.slice(0, from) + piece + state.text.slice(to);
  state.edits.push(kind + " roster: no bulk protected narrative or secret query");
}
// Actor-bound roster transport: permission-specific rosters must never
// persist on GM -> outsider switches or accept late prior-actor results.
function guardManagerLoader(state, start, end, clearMethod, mode = "roster") {
  const first = state.text.indexOf(start);
  const last = state.text.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, "T25 actor loader source drift " + start);
  let segment = state.text.slice(first, last);
  assert.ok(segment.startsWith(start));
  segment = segment.replace(start, start +
    "\n    const requestActor = actorRef.current;" +
    "\n    const requestEpoch = rosterEpochRef.current;" +
    "\n    if (!requestActor) { " + clearMethod + "; return; }");
  if (mode === "roster" || mode === "map-icons") {
    const marker = "    const { data, error } = res;";
    assert.equal(segment.split(marker).length - 1, 1, "T25 read response anchor drift " + start);
    segment = segment.replace(marker, marker +
      "\n    if (actorRef.current !== requestActor || rosterEpochRef.current !== requestEpoch) return;");
  } else {
    const marker = "    if (!res.error)";
    assert.equal(segment.split(marker).length - 1, 1, "T25 list response anchor drift " + start);
    segment = segment.replace(marker,
      "    if (actorRef.current !== requestActor || rosterEpochRef.current !== requestEpoch) return;\n" + marker);
  }
  state.text = state.text.slice(0, first) + segment + state.text.slice(last);
  state.edits.push("actor-bound and immediately cleared read " + start.trim());
}

export function deriveT25CurrentManager(source) {
  assert.equal(gitBlobHash(source), T25_BASE_BLOB, "T25 refuses stale/mismatched active manager");
  const state = { text: source, edits: [] };
  replaceOnce(state,
    'import { loadCharacterSecrets, saveCharacterSecret } from "../utils/characterSecrets";',
    'import { saveCharacterSecret } from "../utils/characterSecrets";\n' +
    'import { projectNonMapManagerRosterRow, selectedManagerDisplayRights } from "../utils/c34/nonMapNpcManagerCandidate.mjs";\n' +
    'import { readNonMapNpcProfileCandidate } from "../utils/c34/readNonMapNpcProfileCandidate.mjs";',
    "import existing server-authorized C34 readers and allowlists");
  replaceOnce(state,
    '  const [charPerm, setCharPerm] = useState(null);',
    '  const [charPerm, setCharPerm] = useState(null);\n' +
    '  const [selectedPrivate, setSelectedPrivate] = useState(null);\n' +
    '  const [permissionEpoch, setPermissionEpoch] = useState(0);\n' +
    '  const actorRef = useRef(null);\n  const rosterEpochRef = useRef(0);',
    "add selected-actor private-state boundary");
  replaceOnce(state,
    '  const [sheetCacheReady, setSheetCacheReady] = useState(false);',
    '  const [sheetCacheReady] = useState(true);',
    "disable bulk sheet preload gate");
  replaceSection(state,
    '  useEffect(() => {\n    let cancelled = false;\n    (async () => {\n      const { data, error } = await supabase\n        .from("character_sheets")\n        .select("character_id,sheet");',
    '  // Keep the editable draft in sync only when a validated sheet response is',
    '  // T25: the all-character sheet preload is forbidden.\n\n',
    "remove page-wide character_sheets cache");
  replaceOnce(state,
    '    selectedKeyRef.current = normalized;\n    sheetRequestRef.current += 1;',
    '    selectedKeyRef.current = normalized;\n' +
    '    sheetCacheRef.current.clear();\n' +
    '    setSelectedPrivate(null);\n' +
    '    setCharPerm(null);\n' +
    '    setDetailsBase(null);\n' +
    '    setDetailsDraft(null);\n' +
    '    sheetRequestRef.current += 1;',
    "clear private caches and grants synchronously on selection");
  replaceOnce(state,
    '    const hasCachedSheet = Boolean(selectedId) && sheetCacheRef.current.has(String(selectedId));',
    '    const hasCachedSheet = false; // Never display cached sheet prior to role re-authorization.',
    "prevent speculative sheet reuse");
  replaceOnce(state,
    'const NPC_SPRITE_BUCKET = "map-icons";',
    'const NPC_SPRITE_BUCKET = "map-icons";\n' +
    '// Original T24 successful signed PostgREST roster projection. All other\n' +
    '// characters data is selected-only, via original stage1/2/3 authority.\n' +
    'const C34_T25_PUBLIC_ROSTER_FIELDS = "id,name,kind,role,description,location_id,storefront_enabled,is_hidden,portrait_url";',
    "use sole source-tested role-safe roster column allowlist");
  changeRoster(state,
    "  const loadNpcs = useCallback(async () => {",
    "  const loadMerchants = useCallback(async () => {", "npc");
  changeRoster(state,
    "  const loadMerchants = useCallback(async () => {",
    "  const loadMerchantProfiles = useCallback(async () => {",
    "merchant");
  changeRoster(state,
    "  const loadMerchantProfiles = useCallback(async () => {",
    "  /* ------------------- roster merge ------------------- */", "merchant-profile");
  // None of the NPC/merchant roster or supporting list requests may accept
  // a response after actor identity changes. Not even GM-hidden roster names.
  guardManagerLoader(state,
    "  const loadNpcs = useCallback(async () => {",
    "  const loadMerchants = useCallback(async () => {", "setNpcs([])");
  guardManagerLoader(state,
    "  const loadMerchants = useCallback(async () => {",
    "  const loadMerchantProfiles = useCallback(async () => {", "setMerchants([])");
  guardManagerLoader(state,
    "  const loadMerchantProfiles = useCallback(async () => {",
    "  /* ------------------- roster merge ------------------- */", "setMerchantProfiles(new Map())");
  guardManagerLoader(state,
    "  const loadPlayers = useCallback(async () => {",
    "  const loadLocations = useCallback(async () => {", "setPlayers([])", "basic");
  guardManagerLoader(state,
    "  const loadLocations = useCallback(async () => {",
    "  const loadMapIcons = useCallback(async () => {", "setLocations([])", "basic");
  guardManagerLoader(state,
    "  const loadMapIcons = useCallback(async () => {",
    "  const loadNpcs = useCallback(async () => {", "setMapIcons([])", "map-icons");
  // The existing mount-time load can race auth hydration; re-fetch after
  // every authenticated actor transition in addition to invalidating caches.
  replaceOnce(state,
    "  /* ------------------- roster merge ------------------- */",
    [
      "  useEffect(() => {",
      "    if (!userId) return;",
      "    void Promise.all([",
      "      loadNpcs(), loadMerchants(), loadMerchantProfiles(),",
      "      loadPlayers(), loadLocations(), loadMapIcons()",
      "    ]);",
      "  }, [userId,permissionEpoch,loadNpcs,loadMerchants,loadMerchantProfiles,loadPlayers,loadLocations,loadMapIcons]);",
      "",
      "  /* ------------------- roster merge ------------------- */"
    ].join("\n"),
    "refetch all authenticated rosters after account changes");

  replaceOnce(state,
    "  const selected = useMemo(() => {\n    if (!selectedKey) return null;\n    const { type, id } = parseKey(selectedKey);\n    return roster.find((r) => r.type === type && String(r.id) === String(id)) || null;\n  }, [selectedKey, roster]);",
    "  const selected = useMemo(() => {\n    if (!selectedKey) return null;\n    const { type, id } = parseKey(selectedKey);\n    const row = roster.find((r) => r.type === type && String(r.id) === String(id)) || null;\n    if (!row) return null;\n    // Restore only selected character's PUBLIC, stage1 allowlisted metadata,\n    // including race, affiliation and portrait variants stripped from roster.\n    // Never spread raw dossier/editor narrative or prior-actor data into roster.\n    const profile = selectedPrivate?.actorId === userId &&\n      String(selectedPrivate?.characterId || \"\") === String(id)\n      ? selectedPrivate?.result?.profile : null;\n    if (!profile || String(profile.id) !== String(row.id) ||\n        String(profile.kind) !== String(row.type)) return row;\n    return { ...row, ...profile, id: row.id, type: row.type, kind: row.kind };\n  }, [selectedKey, roster, selectedPrivate, userId]);",
    "restore public selected Profile metadata from source-authenticated stage1");
  replaceOnce(state,
    '  // Resolve the selected character\'s map icon record (for showing next to the name).',
    '  const selectedCharPerm = selectedManagerDisplayRights(charPerm, selected?.id, userId);\n' +
    '  const selectedPrivateResult = selectedPrivate?.actorId === userId &&\n' +
    '    String(selectedPrivate?.characterId || "") === String(selected?.id || "")\n' +
    '    ? selectedPrivate.result : null;\n\n' +
    '  // Resolve the selected character\'s map icon record (for showing next to the name).',
    "bind selected rights and narrative to actor and character");

  // All sensitive detail/sheet reads below are from the selected server-authorized
  // T21 reader. No manager-wide sheet read or raw private-column fallback.
  const nextAuth = [
    '  const loadAuth = useCallback(async () => {',
    '    const { data: auth } = await supabase.auth.getUser();',
    '    const actor = auth?.user?.id || null;',
    '    if (actorRef.current !== actor) {',
    '      actorRef.current = actor;',
    '      sheetCacheRef.current.clear();',
    '      sheetRequestRef.current += 1;',
    '      equipmentRequestRef.current += 1;',
    '      notesRequestRef.current += 1;',
    '      setSelectedPrivate(null); setCharPerm(null); setIsAdmin(false);',
    '      rosterEpochRef.current += 1;',
    '      setNpcs([]); setMerchants([]); setMerchantProfiles(new Map());',
    '      setPlayers([]); setLocations([]); setMapIcons([]);',

    '      setSheet(null); setSheetDraft({}); setNotes([]); setEquippedRows([]);',
    '      setDetailsBase(null); setDetailsDraft(null);',
    '    }',
    '    setUserId(actor);',
    '    if (!actor) { setIsAdmin(false); return; }',
    '    const { data: admin, error } = await supabase.rpc("is_admin", { uid: actor });',
    '    if (actorRef.current !== actor) return;',
    '    if (!error) { setIsAdmin(admin === true); return; }',
    '    const { data: profile, error: fallback } = await supabase.from("user_profiles")',
    '      .select("role").eq("id", actor).maybeSingle();',
    '    if (actorRef.current === actor) setIsAdmin(!fallback && profile?.role === "admin");',
    '  }, []);',
    '',
    '  // Account transition clears everything synchronously before next actor render.',
    '  // Never await a Supabase call directly within the auth-state callback.',
    '  useEffect(() => {',
    '    const { data } = supabase.auth.onAuthStateChange((event, session) => {',
    '      const actor = session?.user?.id || null;',
    '      if (actorRef.current === actor && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;',
    '      actorRef.current = actor;',
    '      setUserId(actor); setIsAdmin(false); setCharPerm(null);',
    '      setSelectedPrivate(null); sheetCacheRef.current.clear();',
    '      rosterEpochRef.current += 1;',
    '      setNpcs([]); setMerchants([]); setMerchantProfiles(new Map());',
    '      setPlayers([]); setLocations([]); setMapIcons([]);',

    '      sheetRequestRef.current += 1;',
    '      equipmentRequestRef.current += 1;',
    '      notesRequestRef.current += 1;',
    '      selectedKeyRef.current = ""; setSelectedKey(null);',
    '      setSheet(null); setSheetDraft({}); setSheetEditMode(false);',
    '      setSheetLoadError(""); setDetailsBase(null); setDetailsDraft(null);',
    '      setNotes([]); setEquippedRows([]); setLastRoll(null);',
    '      if (actor) setTimeout(() => { void loadAuth(); }, 0);',
    '    });',
    '    return () => data?.subscription?.unsubscribe();',
    '  }, [loadAuth]);',
    ''
  ].join("\n");
  replaceSection(state, '  const loadAuth = useCallback(async () => {',
    '  /* ------------------- load basics ------------------- */', nextAuth + "\n",
    "account-bound auth, sign-out and role refresh");

  const nextPermission = [
    '  // Only the signed actor and selected character can own an active edit grant.',
    '  useEffect(() => {',
    '    let cancelled = false;',
    '    const actor = userId, id = selected?.id;',
    '    setCharPerm(null);',
    '    if (!actor || !id) return;',
    '    if (isAdmin) {',
    '      setCharPerm({ user_id: actor, character_id: id,',
    '        can_inventory: true, can_edit: true, can_convert: true });',
    '      return;',
    '    }',
    '    (async () => {',
    '      const { data, error } = await supabase.from("character_permissions")',
    '        .select("user_id,character_id,can_inventory,can_edit,can_convert")',
    '        .eq("character_id", id).eq("user_id", actor).maybeSingle();',
    '      if (cancelled || actorRef.current !== actor ||',
    '          String(parseKey(selectedKeyRef.current)?.id) !== String(id)) return;',
    '      if (error) { console.error(error); setCharPerm(null); }',
    '      else setCharPerm(data || null);',
    '    })();',
    '    return () => { cancelled = true; };',
    '  }, [userId, isAdmin, selected?.id, permissionEpoch]);',
    '',
    '  const refreshManagerPermissions = () => {',
    '    setSelectedPrivate(null); setCharPerm(null);',
    '    rosterEpochRef.current += 1;',
    '    setNpcs([]); setMerchants([]); setMerchantProfiles(new Map());',
    '    setPlayers([]); setLocations([]); setMapIcons([]);',
    '    setIsAdmin(false);',
    '    void loadAuth();',
    '    sheetCacheRef.current.clear(); sheetRequestRef.current += 1;',
    '    notesRequestRef.current += 1; equipmentRequestRef.current += 1;',
    '    setSheet(null); setSheetDraft({}); setSheetEditMode(false);',
    '    setSheetLoadError(""); setNotes([]); setEquippedRows([]);',
    '    setDetailsBase(null); setDetailsDraft(null);',
    '    setPermissionEpoch(previous => previous + 1);',
    '  };',
    ''
  ].join("\n");
  replaceSection(state,
    '  // Load character-level permissions for non-admins (enables store toggle, editing, conversions)',
    '  /* ------------------- sheet + notes loaders ------------------- */',
    nextPermission + "\n", "selected actor-character permission and explicit refresh");

  const nextSheet = [
    '  const loadSelectedSheet = useCallback(async (key, { force = false } = {}) => {',
    '    const requestKey = normalizeNpcSelectionKey(key);',
    '    const id = parseKey(requestKey)?.id || null;',
    '    const actor = userId;',
    '    const requestId = ++sheetRequestRef.current;',
    '    const current = () => isCurrentNpcSelectionRequest({',
    '      activeKey: selectedKeyRef.current, requestedKey: requestKey,',
    '      activeRequestId: sheetRequestRef.current, requestId',
    '    }) && actorRef.current === actor;',
    '    if (!requestKey || !id || !actor) {',
    '      setSelectedPrivate(null); setSheet(null); setSheetDraft({});',
    '      setSheetLoadError(""); setSheetLoading(false);',
    '      return null;',
    '    }',
    '    const permitted = !!isAdmin || selectedCharPerm.can_edit;',
    '    setSheetLoading(true);',
    '    try {',
    '      const result = await readNonMapNpcProfileCandidate(supabase, id, {',
    '        withDossier: !!isAdmin, withSheet: permitted,',
    '        withPrivateBackstory: false',
    '      });',
    '      if (!current()) return null;',
    '      if (result.status !== "ok") {',
    '        setSelectedPrivate(null); setSheet(null); setSheetDraft({});',
    '        setSheetLoadError(result.status === "unauthenticated" ? "" :',
    '          "Selected Profile is unavailable under current server permissions.");',
    '        return null;',
    '      }',
    '      setSelectedPrivate({ actorId: actor, characterId: id, result });',
    '      const authorized = permitted && result.capabilities.canPrint &&',
    '        result.sheet && typeof result.sheet === "object" && !Array.isArray(result.sheet);',
    '      if (!authorized) {',
    '        setSheet(null); setSheetDraft({});',
    '        setSheetLoadError(permitted ? "Selected sheet is not authorized." : "");',
    '        return null;',
    '      }',
    '      const next = deepClone(result.sheet);',
    '      sheetCacheRef.current.clear();',
    '      sheetCacheRef.current.set(String(id), deepClone(next));',
    '      setSheet(next); setSheetDraft(deepClone(next));',
    '      setSheetEditMode(false); setSheetLoadError("");',
    '      return next;',
    '    } catch (error) {',
    '      if (!current()) return null;',
    '      setSelectedPrivate(null); setSheet(null); setSheetDraft({});',
    '      setSheetLoadError("Selected Profile load failed.");',
    '      return null;',
    '    } finally {',
    '      if (current()) setSheetLoading(false);',
    '    }',
    '  }, [userId, isAdmin, selectedCharPerm.can_edit, permissionEpoch]);',
    ''
  ].join("\n");
  replaceSection(state,
    '  const loadSelectedSheet = useCallback(async (key, { force = false } = {}) => {',
    '  // Load equipped items for NPC/merchant when selection changes.',
    nextSheet + "\n",
    "selected sheet uses signed actor-scoped stage1/2/3 RPC reader");
  replaceOnce(state,
    '  }, [selectedKey, sheetReloadToken, sheetCacheReady, loadSelectedSheet]);',
    '  }, [selectedKey, sheetReloadToken, sheetCacheReady, loadSelectedSheet, permissionEpoch]);',
    "re-fetch sheet after auth/grant change");

  replaceSection(state,
    "  const buildDetailsBase = useCallback(",
    "  useEffect(() => {\n    if (!selected) {",
    [
      "  const buildDetailsBase = useCallback(",
      "    (sel) => {",
      "      if (!sel) return null;",
      "      const base = sel.type === \"merchant\" ?",
      "        (merchantProfiles.get(String(sel.id)) || sel) :",
      "        ((npcs || []).find(row => String(row.id) === String(sel.id)) || sel);",
      "      const lore = selectedPrivateResult?.profile?.lore || {};",
      "      const privateRow = isAdmin ? selectedPrivateResult?.dossier :",
      "        (selectedCharPerm.can_edit ? selectedPrivateResult?.editorNarrative : null);",
      "      const row = { ...base, ...lore, ...(privateRow || {}) };",
      "      return {",
      "        role: safeStr(row.role), affiliation: safeStr(row.affiliation),",
      "        description: safeStr(row.description), background: safeStr(row.background),",
      "        motivation: privateRow ? safeStr(row.motivation) : \"\",",
      "        quirk: privateRow ? safeStr(row.quirk) : \"\",",
      "        mannerism: privateRow ? safeStr(row.mannerism) : \"\",",
      "        voice: privateRow ? safeStr(row.voice) : \"\",",
      "        secret: isAdmin && selectedPrivateResult?.dossier ? safeStr(row.secret) : \"\"",
      "      };",
      "    },",
      "    [npcs, merchantProfiles, selectedPrivateResult, isAdmin, selectedCharPerm.can_edit]",
      "  );",
      ""
    ].join("\n") + "\n",
    "selected-only authorized private narrative projection");
  replaceOnce(state,
    "  const canEditCharacter = !!isAdmin || !!charPerm?.can_edit;\n  const canStoreToggle = !!isAdmin || !!charPerm?.can_inventory || !!charPerm?.can_edit;\n  const canConvertKind = !!isAdmin || !!charPerm?.can_convert;",
    "  const canEditCharacter = !!userId && (!!isAdmin || !!selectedCharPerm.can_edit);\n" +
    "  const canStoreToggle = !!userId && (!!isAdmin || !!selectedCharPerm.can_inventory || !!selectedCharPerm.can_edit);\n" +
    "  const canConvertKind = !!userId && (!!isAdmin || !!selectedCharPerm.can_convert);",
    "never use unbound grants for manager editing");
  replaceOnce(state,
    "    if (!(isAdmin || charPerm?.can_edit)) return;",
    "    if (!(isAdmin || selectedCharPerm.can_edit)) return;",
    "selected-character delete guard");
  replaceOnce(state,
    "    enabled: !!selected?.id && (!!isAdmin || !!charPerm?.can_inventory || !!charPerm?.can_edit),\n    canCommand: !!isAdmin || !!charPerm?.can_edit,",
    "    enabled: !!selected?.id && !!userId && (!!isAdmin || selectedCharPerm.can_edit),\n    canCommand: !!userId && (!!isAdmin || selectedCharPerm.can_edit),",
    "guard sheet-action hook against inventory-only sheet reads");
  replaceOnce(state,
    "  const backgroundText = canEditNarrative ? details.background : safeStr(selected?.background || sheetDraft?.background || \"\");",
    "  const backgroundText = (isAdmin || selectedCharPerm.can_edit) && selectedPrivateResult\n" +
    "    ? safeStr(details.background) : safeStr(selectedPrivateResult?.profile?.lore?.background || \"\");",
    "remove unsafe roster and sheet background fallback");
  replaceOnce(state,
    "    background: backgroundText,\n    motivation: safeStr(details?.motivation || selected?.motivation),\n    quirk: safeStr(details?.quirk || selected?.quirk),\n    mannerism: safeStr(details?.mannerism || selected?.mannerism),\n    voice: safeStr(details?.voice || selected?.voice),\n    secret: safeStr(details?.secret || selected?.secret),",
    "    background: safeStr(selectedPrivateResult?.profile?.lore?.background || \"\"),\n" +
    "    motivation: \"\", quirk: \"\", mannerism: \"\", voice: \"\", secret: \"\",",
    "public PDF profile excludes elevated lore and GM secret");
  replaceOnce(state,
    "                      printNotes={notes}",
    "                      printNotes={(notes || []).filter(canSeeNote)}",
    "PDF receives only visible notes");
  replaceOnce(state,
    "                          await saveCharacterSecret(supabase, selected.id, detailsDraft.secret);",
    "                          if (isAdmin && selectedPrivateResult?.dossier) {\n" +
    "                            await saveCharacterSecret(supabase, selected.id, detailsDraft.secret);\n" +
    "                          }",
    "editor save never overwrites GM secret");
  replaceOnce(state,
    "            isAdmin={isAdmin || canEditCharacter}",
    "            isAdmin={!!userId && isAdmin}",
    "edit grant never masquerades as GM in shared Profile");
  replaceOnce(state,
    "        <h1 className=\"h4 mb-0\">NPCs</h1>",
    "        <h1 className=\"h4 mb-0\">NPCs</h1>\n" +
    "        <button type=\"button\" className=\"btn btn-sm btn-outline-secondary ms-3\"\n" +
    "          data-testid=\"t25-refresh-permissions\" onClick={refreshManagerPermissions}>\n" +
    "          Refresh permissions\n" +
    "        </button>",
    "explicit revocation refresh surface");
  replaceOnce(state,
    "                    ) : (\n                    <CharacterSheetPanel",
    "                    ) : !selectedPrivateResult?.capabilities?.canPrint ? (\n" +
    "                      <div className=\"p-3\" data-testid=\"t25-sheet-restricted\">\n" +
    "                        The selected character sheet requires authorization.\n" +
    "                        {selectedCharPerm.can_inventory && inventoryHref ? (\n" +
    "                          <a href={inventoryHref} className=\"btn btn-sm btn-outline-light ms-2\">Open inventory</a>\n" +
    "                        ) : null}\n" +
    "                      </div>\n" +
    "                    ) : (\n                    <CharacterSheetPanel",
    "deny unauthorized sheet/print while preserving inventory-only link");
  replaceOnce(state,
    "                    {!sheetLoading && !sheetLoadError ? (",
    "                    {!sheetLoading && !sheetLoadError && selectedPrivateResult?.capabilities?.canPrint ? (",
    "no unauthenticated or stale raw sheet JSON surface");
  replaceOnce(state,
    "                        if (!selected) return;\n\n                        const updated_at = new Date().toISOString();",
    "                        if (!selected || !canEditCharacter || !selectedPrivateResult?.capabilities?.canEdit) return;\n\n" +
    "                        const updated_at = new Date().toISOString();",
    "sheet and private narrative writes require current server authorization");
  assert.ok(!state.text.includes("charPerm?."),
    "T25 refuses any unbound permission consumers");
  assert.ok(state.text.includes("readNonMapNpcProfileCandidate(supabase, id"),
    "selected private reader must be active");

  const preface = [
    "// C34 T25 generated from current pages/npcs.js at exact blob " + T25_BASE_BLOB,
    "// TEMPORARY LOCALHOST-ONLY SCRATCH PROBE. Never check in under pages/.",
    "// This first source-derivation slice is NOT a full mounted privacy release."
  ].join("\n");
  const output = preface + "\n" + state.text;
  assert.doesNotMatch(output, /loadCharacterSecrets|\.select\("character_id,sheet"\)/);
  const rosterOnly = output.slice(output.indexOf("  const loadNpcs = "),
    output.indexOf("  /* ------------------- roster merge ------------------- */"));
  assert.doesNotMatch(rosterOnly, /"(background|motivation|quirk|mannerism|voice)"/);
  assert.equal(rosterOnly.match(/\.select\(C34_T25_PUBLIC_ROSTER_FIELDS\)/g)?.length, 3);
  assert.doesNotMatch(rosterOnly, /\.select\(\s*\[/);
  assert.match(output, /function NpcsPage/);
  assert.match(output, /function handleDeleteNpc/);
  assert.match(output, /\/npcs\?focus|focusRaw/);
  return { output, edits: state.edits };
}
const sourcePath = path.join(root, "pages/npcs.js");
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { output, edits } = deriveT25CurrentManager(readFileSync(sourcePath, "utf8"));
  const target = process.argv[2] || "";
  assert.ok(target === "--verify" || target === "--write", "Use --verify or --write");
  if (target === "--write") {
    const destination = path.join(root, T25_TEMP_ROUTE);
    writeFileSync(destination, output, { flag: "wx" });
    console.log("T25 created UNTRACKED disposable route: " + destination);
  } else console.log("T25 verified " + edits.length + " source-scoped edits without touching pages/");
}
