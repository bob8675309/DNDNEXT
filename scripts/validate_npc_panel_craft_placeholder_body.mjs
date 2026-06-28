import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
const source = fs.readFileSync(panelPath, "utf8");

const required = [
  'activeView === "craft" && hasCraftCapability && typeof renderCraftView === "function" ? (',
  '<div className="npc-panel-body d-block">',
  '{renderCraftView()}',
  ') : activeView === "sheet" ? (',
  'typeof renderInteractionTabs === "function" && !hasCraftCapability ? renderInteractionTabs() : (',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`NpcPanel craft placeholder body validation failed: ${token}`);
}

const forbidden = [
  'CraftingWorkspace',
  'import("./CraftingWorkspace")',
  'import CraftingWorkspace',
];

for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`NpcPanel craft placeholder must not import real workspace yet; found ${token}`);
}

console.log("NpcPanel guarded craft placeholder body validated.");
