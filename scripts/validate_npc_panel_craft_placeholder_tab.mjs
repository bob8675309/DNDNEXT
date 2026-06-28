import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
const source = fs.readFileSync(panelPath, "utf8");

const required = [
  'return ["profile", "sheet", "inventory", "shop", "craft"].includes(v) ? v : "profile";',
  'typeof renderInteractionTabs === "function" ? renderInteractionTabs() : (',
  'activeView === "craft" && hasCraftCapability && typeof renderCraftView === "function" ? (',
  '{renderCraftView()}',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`NpcPanel craft placeholder tab validation failed: ${token}`);
}

const forbidden = [
  'typeof renderInteractionTabs === "function" && !hasCraftCapability ? renderInteractionTabs() : (',
  'CraftingWorkspace',
  'import("./CraftingWorkspace")',
  'import CraftingWorkspace',
];

for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`NpcPanel Craft placeholder tab step should not include token: ${token}`);
}

console.log("NpcPanel Craft placeholder tab path validated.");
