import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

function requireAbsent(source, token, label) {
  if (source.includes(token)) throw new Error(`${label}: forbidden ${token}`);
}

const source = read("components/MapPageClient.js");

for (const token of [
  'const showExclusiveOffcanvas = useCallback(',
  'const tryOpen = (remaining = 10) => {',
  'if (typeof window === "undefined") return;',
  'const offcanvasApi = window.bootstrap?.Offcanvas || null;',
  'if (!offcanvasApi) {',
  'window.setTimeout(() => tryOpen(remaining - 1), 60);',
  'for (const other of OFFCANVAS_IDS) {',
  'if (other !== id) hideOffcanvas(other);',
  'const el = document.getElementById(id);',
  'offcanvasApi.getOrCreateInstance(el).show();',
  'tryOpen();',
]) requireToken(source, token, "Map profile offcanvas readiness handoff");

requireToken(
  source,
  `          if (npcRow) {\n            setSelNpc(npcRow);\n            showExclusiveOffcanvas("npcPanel");\n          }\n          setSelMerchant(null);\n          setSelLoc(null);\n          setDebugOpen(true);`,
  "Map NPC drawer profile panel handoff"
);

for (const token of [
  'if (!window.bootstrap) return;',
  'window.bootstrap.Offcanvas.getOrCreateInstance(el).show();',
  `          if (npcRow) setSelNpc(npcRow);\n          setSelMerchant(null);\n          setSelLoc(null);\n          setDebugOpen(true);`,
]) requireAbsent(source, token, "Map profile offcanvas readiness handoff");

console.log("Map profile offcanvas and NPC drawer profile handoff validated.");
