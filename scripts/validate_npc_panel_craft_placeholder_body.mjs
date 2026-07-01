import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
const source = fs.readFileSync(panelPath, "utf8");

const required = [
  'activeView === "craft" && hasCraftCapability && typeof renderCraftView === "function" ? (',
  '<div className="npc-panel-body d-block">',
  '{renderCraftView()}',
  ') : activeView === "sheet" ? (',
  'typeof renderInteractionTabs === "function" ? renderInteractionTabs() : (',
  'return ["profile", "sheet", "inventory", "shop", "craft"].includes(v) ? v : "profile";',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`NpcPanel craft body validation failed: ${token}`);
}

const forbidden = [
  'typeof renderInteractionTabs === "function" && !hasCraftCapability ? renderInteractionTabs() : (',
  'onClick={() => setActiveView("shop")}',
];

for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`NpcPanel craft body stale token remains: ${token}`);
}

console.log("NpcPanel baked craft body validated.");
