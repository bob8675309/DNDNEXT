import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
const source = fs.readFileSync(panelPath, "utf8");

const required = [
  'activeView === "craft" && hasCraftCapability && typeof renderCraftView === "function"',
  '<div className="npc-panel-body d-block">\n          {renderCraftView()}\n        </div>',
  ') : activeView === "sheet" ? (',
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Baked NpcPanel craft body validation failed: ${token}`);
  }
}

if (!source.includes('return ["profile", "sheet", "inventory", "shop", "craft"].includes(v) ? v : "profile";')) {
  throw new Error("Baked NpcPanel craft body validation failed: craft view is not normalized.");
}

console.log("Baked NpcPanel craft body validated.");
