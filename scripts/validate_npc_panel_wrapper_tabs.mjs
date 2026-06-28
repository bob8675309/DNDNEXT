import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
const source = fs.readFileSync(panelPath, "utf8");

const required = [
  'typeof renderInteractionTabs === "function" && !hasCraftCapability ? renderInteractionTabs() : (',
  '<div className="btn-group btn-group-sm" role="tablist" aria-label="NPC profile views">',
  '<button type="button" className={`btn ${activeView === "profile" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("profile")}>Profile</button>',
  '<button type="button" className={`btn ${activeView === "sheet" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("sheet")}>Sheet & Rolls</button>',
  '<button type="button" className={`btn ${activeView === "inventory" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("inventory")}>Inventory</button>',
  '{isMerchantView ? <button type="button" className={`btn ${activeView === "shop" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("shop")}>Shop</button> : null}',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`NpcPanel wrapper tab validation failed: ${token}`);
}

const forbidden = [
  'CraftingWorkspace',
  'activeView === "craft"',
  'renderCraftView()',
];

for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`NpcPanel wrapper tabs should not expose Craft yet; found ${token}`);
}

console.log("NpcPanel guarded wrapper tabs validated.");
