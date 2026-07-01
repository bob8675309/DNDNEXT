import fs from "node:fs";
import path from "node:path";

const rel = "components/NpcPanel.js";
const file = path.join(process.cwd(), rel);
let source = fs.readFileSync(file, "utf8");
const before = source;

function replaceRequired(beforeText, afterText, label) {
  if (source.includes(afterText)) return;
  const count = source.split(beforeText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(beforeText, afterText);
}

function requireToken(token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

replaceRequired(
  'import { deriveEquippedItemEffects, hashEquippedRowsForKey } from "../utils/equipmentEffects";',
  'import { deriveEquippedItemEffects, hashEquippedRowsForKey } from "../utils/equipmentEffects";\nimport { resolveCraftProfession } from "../utils/craftProfession";',
  "NpcPanel craft profession resolver import"
);

replaceRequired(
  'const MerchantPanel = dynamic(() => import("./MerchantPanel"), { ssr: false });',
  'const MerchantPanel = dynamic(() => import("./MerchantPanel"), { ssr: false });\nconst CraftingWorkspace = dynamic(() => import("./CraftingWorkspace"), { ssr: false });',
  "NpcPanel CraftingWorkspace dynamic import"
);

replaceRequired(
  '  const view = fullNpc || npc || {};\n\n  const status = safeStr(view.status).toLowerCase() || "unknown";',
  '  const view = fullNpc || npc || {};\n  const fallbackCraftProfession = useMemo(() => resolveCraftProfession(view, sheet || {}), [view, sheet]);\n  const effectiveCraftProfession = craftProfession || fallbackCraftProfession || "";\n  const effectiveHasCraftCapability = !!hasCraftCapability || (!!effectiveCraftProfession && effectiveCraftProfession !== "Scribe");\n\n  const status = safeStr(view.status).toLowerCase() || "unknown";',
  "NpcPanel standalone craft capability resolution"
);

replaceRequired(
  '  function renderShopPanel() {',
  '  function renderStandaloneCraftPanel() {\n    if (!effectiveHasCraftCapability) {\n      return <div className="npc-card"><div className="text-muted">This character does not have a crafting profession.</div></div>;\n    }\n\n    return (\n      <div className="character-craft-workspace-shell" data-craft-profession={effectiveCraftProfession || ""}>\n        <CraftingWorkspace\n          mode="panel"\n          disciplineLock={effectiveCraftProfession}\n          crafterId={npcId}\n          crafter={view}\n          isAdmin={!!isAdmin}\n          startView="recipes"\n          showDisciplineSwitcher={false}\n        />\n      </div>\n    );\n  }\n\n  function renderShopPanel() {',
  "NpcPanel standalone craft renderer"
);

replaceRequired(
  '                {isMerchantView ? <button type="button" className={`btn ${activeView === "shop" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setPanelView("shop")}>Shop</button> : null}\n              </div>',
  '                {isMerchantView ? <button type="button" className={`btn ${activeView === "shop" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setPanelView("shop")}>Shop</button> : null}\n                {effectiveHasCraftCapability ? <button type="button" className={`btn ${activeView === "craft" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setPanelView("craft")}>Craft</button> : null}\n              </div>',
  "NpcPanel standalone craft tab"
);

replaceRequired(
  '      {activeView === "craft" && hasCraftCapability && typeof renderCraftView === "function" ? (\n        <div className="npc-panel-body d-block">\n          {renderCraftView()}\n        </div>',
  '      {activeView === "craft" && effectiveHasCraftCapability ? (\n        <div className="npc-panel-body d-block">\n          {typeof renderCraftView === "function" ? renderCraftView() : renderStandaloneCraftPanel()}\n        </div>',
  "NpcPanel standalone craft body"
);

for (const token of [
  'import { resolveCraftProfession } from "../utils/craftProfession";',
  'const CraftingWorkspace = dynamic(() => import("./CraftingWorkspace"), { ssr: false });',
  'const fallbackCraftProfession = useMemo(() => resolveCraftProfession(view, sheet || {}), [view, sheet]);',
  'const effectiveHasCraftCapability = !!hasCraftCapability || (!!effectiveCraftProfession && effectiveCraftProfession !== "Scribe");',
  'function renderStandaloneCraftPanel() {',
  'disciplineLock={effectiveCraftProfession}',
  'showDisciplineSwitcher={false}',
  'effectiveHasCraftCapability ? <button type="button" className={`btn ${activeView === "craft" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setPanelView("craft")}>Craft</button> : null',
  'typeof renderCraftView === "function" ? renderCraftView() : renderStandaloneCraftPanel()',
]) requireToken(token, "NpcPanel standalone craft patch");

if (source !== before) {
  fs.writeFileSync(file, source, "utf8");
  console.log("Patched NpcPanel standalone craft capability for map/traveling crafters.");
} else {
  console.log("NpcPanel standalone craft capability patch already applied.");
}
