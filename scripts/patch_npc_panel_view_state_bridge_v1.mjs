import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
let source = fs.readFileSync(panelPath, "utf8");

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  `  useEffect(() => {
    setActiveView(normalizePanelView(initialView));
  }, [npcId, initialView]);`,
  `  useEffect(() => {
    setActiveView(normalizePanelView(initialView));
  }, [npcId, initialView]);

  const setPanelView = useCallback((nextView) => {
    const normalized = normalizePanelView(nextView);
    setActiveView(normalized);
    if (typeof setInteractionView === "function") setInteractionView(normalized);
  }, [setInteractionView]);`,
  "NpcPanel wrapper view-state bridge helper"
);

const replacements = [
  ['onClick={() => setActiveView("profile")}', 'onClick={() => setPanelView("profile")}', "profile tab handler"],
  ['onClick={() => setActiveView("sheet")}', 'onClick={() => setPanelView("sheet")}', "sheet tab handler"],
  ['onClick={() => setActiveView("inventory")}', 'onClick={() => setPanelView("inventory")}', "inventory tab handler"],
  ['onClick={() => setActiveView("shop")}', 'onClick={() => setPanelView("shop")}', "shop handlers"],
  ['onOpenStore={isMerchantView ? () => setActiveView("shop") : null}', 'onOpenStore={isMerchantView ? () => setPanelView("shop") : null}', "sheet store handler"],
];

for (const [before, after, label] of replacements) {
  if (source.includes(after)) continue;
  const count = source.split(before).length - 1;
  if (count < 1) throw new Error(`${label}: expected at least one match, found ${count}`);
  source = source.split(before).join(after);
}

fs.writeFileSync(panelPath, source, "utf8");
console.log("Patched NpcPanel view changes to bridge wrapper and panel state.");
