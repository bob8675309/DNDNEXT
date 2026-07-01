import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
const source = fs.readFileSync(panelPath, "utf8");

const required = [
  'typeof renderInteractionTabs === "function" ? renderInteractionTabs() : (',
  'aria-label="NPC profile views"',
  'onClick={() => setPanelView("profile")}',
  'onClick={() => setPanelView("sheet")}',
  'onClick={() => setPanelView("inventory")}',
  'onClick={() => setPanelView("shop")}',
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Baked NpcPanel wrapper tabs validation failed: ${token}`);
  }
}

if (source.includes('typeof renderInteractionTabs === "function" && !hasCraftCapability ? renderInteractionTabs() : (')) {
  throw new Error("Baked NpcPanel wrapper tabs regression: old craft fallback guard is still present.");
}

console.log("Baked NpcPanel wrapper tabs validated.");
