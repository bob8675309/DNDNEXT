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
  piece = piece.replace(/^\s*"(background|motivation|quirk|mannerism|voice)",\n/gm, "");
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
    '  const actorRef = useRef(null);',
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
  changeRoster(state,
    "  const loadNpcs = useCallback(async () => {",
    "  const loadMerchants = useCallback(async () => {", "npc");
  changeRoster(state,
    "  const loadMerchantProfiles = useCallback(async () => {",
    "  /* ------------------- roster merge ------------------- */", "merchant-profile");
  replaceOnce(state,
    '  // Resolve the selected character\'s map icon record (for showing next to the name).',
    '  const selectedCharPerm = selectedManagerDisplayRights(charPerm, selected?.id, userId);\n' +
    '  const selectedPrivateResult = selectedPrivate?.actorId === userId &&\n' +
    '    String(selectedPrivate?.characterId || "") === String(selected?.id || "")\n' +
    '    ? selectedPrivate.result : null;\n\n' +
    '  // Resolve the selected character\'s map icon record (for showing next to the name).',
    "bind selected rights and narrative to actor and character");
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
