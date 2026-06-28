import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const target = path.join(process.cwd(), "components", "NpcPanel.js");
let source = fs.readFileSync(target, "utf8");

source = replaceOnce(
  source,
  'import { resolveCharacterPortrait } from "../utils/characterPortraits";',
  'import { resolveCharacterPortrait } from "../utils/characterPortraits";\nimport { resolveCraftProfession } from "../utils/craftProfession";',
  "NpcPanel craft resolver import"
);

source = replaceOnce(
  source,
  'const MerchantPanel = dynamic(() => import("./MerchantPanel"), { ssr: false });',
  'const MerchantPanel = dynamic(() => import("./MerchantPanel"), { ssr: false });\nconst CraftingWorkspace = dynamic(() => import("./CraftingWorkspace"), {\n  ssr: false,\n  loading: () => <div className="npc-card"><div className="text-muted">Loading crafting workspace…</div></div>,\n});',
  "NpcPanel CraftingWorkspace dynamic import"
);

source = replaceOnce(
  source,
  '  return ["profile", "sheet", "inventory", "shop"].includes(v) ? v : "profile";',
  '  return ["profile", "sheet", "inventory", "shop", "craft"].includes(v) ? v : "profile";',
  "NpcPanel normalize craft view"
);

source = replaceOnce(
  source,
  '  const sheetMetaLine = [view.race, role, affiliation].filter(Boolean).join(" • ");',
  '  const sheetMetaLine = [view.race, role, affiliation].filter(Boolean).join(" • ");\n  const craftProfession = useMemo(() => resolveCraftProfession(view, sheet), [view, sheet]);\n  const canCraft = !!craftProfession && craftProfession !== "Scribe";',
  "NpcPanel craft profession memo"
);

source = replaceOnce(
  source,
  '  function renderInventoryPanel() {',
  '  function renderCraftPanel() {\n    if (!craftProfession) {\n      return <div className="npc-card"><div className="text-muted">This character does not offer crafting services.</div></div>;\n    }\n    if (craftProfession === "Scribe") {\n      return <div className="npc-card"><div className="text-muted">Scribe support is reserved for the spell-list phase.</div></div>;\n    }\n\n    return (\n      <div className="npc-panel-craft-view">\n        <CraftingWorkspace\n          mode="panel"\n          disciplineLock={craftProfession}\n          crafterId={npcId}\n          crafter={view}\n          startView="recipes"\n          showDisciplineSwitcher={false}\n        />\n      </div>\n    );\n  }\n\n  function renderInventoryPanel() {',
  "NpcPanel craft panel renderer"
);

source = replaceOnce(
  source,
  '               {isMerchantView ? <button type="button" className={`btn ${activeView === "shop" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("shop")}>Shop</button> : null}',
  '               {isMerchantView ? <button type="button" className={`btn ${activeView === "shop" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("shop")}>Shop</button> : null}\n               {canCraft ? <button type="button" className={`btn ${activeView === "craft" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("craft")}>Craft</button> : null}',
  "NpcPanel craft tab button"
);

source = replaceOnce(
  source,
  '      ) : activeView === "shop" ? (\n        <div className="npc-panel-body d-block">\n          {renderShopPanel()}\n        </div>\n      ) : (',
  '      ) : activeView === "shop" ? (\n        <div className="npc-panel-body d-block">\n          {renderShopPanel()}\n        </div>\n      ) : activeView === "craft" ? (\n        <div className="npc-panel-body d-block">\n          {renderCraftPanel()}\n        </div>\n      ) : (',
  "NpcPanel craft body branch"
);

source = replaceOnce(
  source,
  '                 {isMerchantView ? (\n                  <button type="button" className="btn btn-sm btn-warning" onClick={() => setActiveView("shop")}>Let me browse your wares.</button>\n                ) : null}',
  '                 {isMerchantView ? (\n                  <button type="button" className="btn btn-sm btn-warning" onClick={() => setActiveView("shop")}>Let me browse your wares.</button>\n                ) : null}\n                {canCraft ? (\n                  <button type="button" className="btn btn-sm btn-warning" onClick={() => setActiveView("craft")}>Show me your workshop.</button>\n                ) : null}',
  "NpcPanel craft dialogue action"
);

fs.writeFileSync(target, source, "utf8");

const cssPath = path.join(process.cwd(), "styles", "npc-profile-panel.css");
let css = fs.readFileSync(cssPath, "utf8");
const cssMarker = "/* ===== NPC panel craft tab v1 ===== */";
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.npc-panel-craft-view {\n  min-width: 0;\n  height: calc(100vh - 126px);\n  min-height: min(820px, calc(100vh - 150px));\n  overflow: auto;\n  border-radius: 1rem;\n  background: rgba(9, 6, 15, 0.84);\n}\n.npc-panel-craft-view .craft-page {\n  min-height: auto !important;\n  padding-bottom: 1rem !important;\n  background: transparent !important;\n}\n.npc-panel-craft-view .craft-page > .container,\n.npc-panel-craft-view .craft-page > .container-fluid {\n  width: 100% !important;\n  max-width: none !important;\n  margin: 0 !important;\n  padding: 0.85rem !important;\n}\n.npc-panel-craft-view .craft-hero {\n  margin-top: 0 !important;\n}\n.npc-panel-craft-view .craft-crafting-preview-column,\n.npc-panel-craft-view .craft-preview-summary-card,\n.npc-panel-craft-view .craft-bench-plan-card,\n.npc-panel-craft-view .craft-plan-review-card {\n  top: 12px !important;\n}\n@media (max-width: 980px) {\n  .npc-panel-craft-view {\n    height: auto;\n    min-height: calc(100vh - 140px);\n  }\n}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
}

const sourceRequired = [
  'import { resolveCraftProfession } from "../utils/craftProfession";',
  "CraftingWorkspace",
  "craftProfession",
  "activeView === \"craft\"",
  "Show me your workshop",
];
for (const token of sourceRequired) {
  if (!source.includes(token)) throw new Error(`NPC craft tab patch validation failed: ${token}`);
}
if (!css.includes("NPC panel craft tab v1")) throw new Error("NPC craft tab CSS validation failed");
console.log("Patched NPC panel craft tab support.");
