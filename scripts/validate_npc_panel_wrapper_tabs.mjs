import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
const source = fs.readFileSync(panelPath, "utf8");

const required = [
  'typeof renderInteractionTabs === "function" ? renderInteractionTabs() : (',
  '<div className="btn-group btn-group-sm" role="tablist" aria-label="NPC profile views">',
  '<button type="button" className={`btn ${activeView === "profile" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setPanelView("profile")}>Profile</button>',
  '<button type="button" className={`btn ${activeView === "sheet" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setPanelView("sheet")}>Sheet & Rolls</button>',
  '<button type="button" className={`btn ${activeView === "inventory" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setPanelView("inventory")}>Inventory</button>',
  '{isMerchantView ? <button type="button" className={`btn ${activeView === "shop" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setPanelView("shop")}>Shop</button> : null}',
  'activeView === "craft" && hasCraftCapability && typeof renderCraftView === "function"',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`NpcPanel wrapper tab validation failed: ${token}`);
}

for (const token of [
  'typeof renderInteractionTabs === "function" && !hasCraftCapability ? renderInteractionTabs() : (',
  'onClick={() => setActiveView("profile")}',
  'onClick={() => setActiveView("shop")}',
]) {
  if (source.includes(token)) throw new Error(`NpcPanel wrapper tabs stale token remains: ${token}`);
}

console.log("NpcPanel baked wrapper tabs validated.");
