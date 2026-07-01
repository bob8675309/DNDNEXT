import fs from "node:fs";
import path from "node:path";

const rel = "components/MapPageClient.js";
const file = path.join(process.cwd(), rel);
let source = fs.readFileSync(file, "utf8");
const before = source;

function replaceExact(beforeText, afterText, label) {
  if (source.includes(afterText)) return;
  const count = source.split(beforeText).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected one source anchor, found ${count}`);
  }
  source = source.replace(beforeText, afterText);
}

replaceExact(
  `  const showExclusiveOffcanvas = useCallback(\n    (id) => {\n      if (!window.bootstrap) return;\n      for (const other of OFFCANVAS_IDS) {\n        if (other !== id) hideOffcanvas(other);\n      }\n      const el = document.getElementById(id);\n      if (!el) return;\n      window.bootstrap.Offcanvas.getOrCreateInstance(el).show();\n    },\n    [OFFCANVAS_IDS, hideOffcanvas]\n  );`,
  `  const showExclusiveOffcanvas = useCallback(\n    (id) => {\n      const tryOpen = (remaining = 10) => {\n        if (typeof window === "undefined") return;\n        const offcanvasApi = window.bootstrap?.Offcanvas || null;\n        if (!offcanvasApi) {\n          if (remaining > 0) window.setTimeout(() => tryOpen(remaining - 1), 60);\n          return;\n        }\n        for (const other of OFFCANVAS_IDS) {\n          if (other !== id) hideOffcanvas(other);\n        }\n        const el = document.getElementById(id);\n        if (!el) {\n          if (remaining > 0) window.setTimeout(() => tryOpen(remaining - 1), 60);\n          return;\n        }\n        offcanvasApi.getOrCreateInstance(el).show();\n      };\n      tryOpen();\n    },\n    [OFFCANVAS_IDS, hideOffcanvas]\n  );`,
  "MapPageClient retry-safe offcanvas open"
);

replaceExact(
  `          if (npcRow) setSelNpc(npcRow);\n          setSelMerchant(null);\n          setSelLoc(null);\n          setDebugOpen(true);`,
  `          if (npcRow) {\n            setSelNpc(npcRow);\n            showExclusiveOffcanvas("npcPanel");\n          }\n          setSelMerchant(null);\n          setSelLoc(null);\n          setDebugOpen(true);`,
  "MapPageClient NPC drawer opens profile panel"
);

if (source === before) {
  console.log("MapPageClient profile offcanvas source bake already applied.");
} else {
  fs.writeFileSync(file, source, "utf8");
  console.log("Applied MapPageClient profile offcanvas source bake.");
}
