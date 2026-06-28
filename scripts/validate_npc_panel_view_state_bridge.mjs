import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
const source = fs.readFileSync(panelPath, "utf8");

for (const token of [
  'const setPanelView = useCallback((nextView) => {',
  'const normalized = normalizePanelView(nextView);',
  'if (typeof setInteractionView === "function") setInteractionView(normalized);',
  'onClick={() => setPanelView("profile")}',
  'onClick={() => setPanelView("sheet")}',
  'onClick={() => setPanelView("inventory")}',
  'onClick={() => setPanelView("shop")}',
  'onOpenStore={isMerchantView ? () => setPanelView("shop") : null}',
  'activeView === "craft" && hasCraftCapability && typeof renderCraftView === "function" ? (',
]) {
  if (!source.includes(token)) throw new Error(`NpcPanel view-state bridge validation failed: ${token}`);
}

for (const token of [
  'onClick={() => setActiveView("profile")}',
  'onClick={() => setActiveView("sheet")}',
  'onClick={() => setActiveView("inventory")}',
  'onClick={() => setActiveView("shop")}',
]) {
  if (source.includes(token)) throw new Error(`NpcPanel view-state bridge stale handler remains: ${token}`);
}

console.log("NpcPanel view-state bridge validated.");
