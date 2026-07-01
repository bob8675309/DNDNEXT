import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
const source = fs.readFileSync(panelPath, "utf8");

const required = [
  'const setPanelView = useCallback((nextView) => {',
  'if (typeof setInteractionView === "function") setInteractionView(normalized);',
  'onClick={() => setPanelView("profile")}',
  'onClick={() => setPanelView("sheet")}',
  'onClick={() => setPanelView("inventory")}',
  'onClick={() => setPanelView("shop")}',
  'onOpenStore={isMerchantView ? () => setPanelView("shop") : null}',
  'onBackToProfile={() => setPanelView("profile")}',
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Baked NpcPanel view-state bridge validation failed: ${token}`);
  }
}

for (const token of [
  'onClick={() => setActiveView("profile")}',
  'onClick={() => setActiveView("sheet")}',
  'onClick={() => setActiveView("inventory")}',
  'onClick={() => setActiveView("shop")}',
  'onOpenStore={isMerchantView ? () => setActiveView("shop") : null}',
]) {
  if (source.includes(token)) {
    throw new Error(`Baked NpcPanel view-state bridge regression: ${token}`);
  }
}

console.log("Baked NpcPanel view-state bridge validated.");
