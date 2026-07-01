import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
const source = fs.readFileSync(panelPath, "utf8");

for (const token of [
  'return ["profile", "sheet", "inventory", "shop", "craft"].includes(v) ? v : "profile";',
  'typeof renderInteractionTabs === "function" ? renderInteractionTabs() : (',
  'activeView === "craft" && hasCraftCapability',
]) {
  if (!source.includes(token)) {
    throw new Error(`Baked NpcPanel craft tab validation failed: ${token}`);
  }
}

if (source.includes('typeof renderInteractionTabs === "function" && !hasCraftCapability ? renderInteractionTabs() : (')) {
  throw new Error("Baked NpcPanel craft tab regression: wrapper tab guard still blocks crafters.");
}

console.log("Baked NpcPanel craft tab path validated.");
