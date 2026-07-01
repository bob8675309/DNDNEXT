import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
const resolverPath = path.join(process.cwd(), "utils", "craftProfession.js");
const workspacePath = path.join(process.cwd(), "components", "CraftingWorkspace.js");

const panel = fs.readFileSync(panelPath, "utf8");
const resolver = fs.readFileSync(resolverPath, "utf8");
const workspace = fs.readFileSync(workspacePath, "utf8");

const panelAnchors = [
  'function normalizePanelView(value) {',
  'return ["profile", "sheet", "inventory", "shop", "craft"].includes(v) ? v : "profile";',
  'const MerchantPanel = dynamic(() => import("./MerchantPanel"), { ssr: false });',
  'const sheetMetaLine = [view.race, role, affiliation].filter(Boolean).join(" • ");',
  'typeof renderInteractionTabs === "function" ? renderInteractionTabs() : (',
  'onClick={() => setPanelView("shop")}',
  'activeView === "craft" && hasCraftCapability && typeof renderCraftView === "function"',
  ') : activeView === "shop" ? (',
  'function renderShopPanel() {',
  'function renderInventoryPanel() {',
];

for (const anchor of panelAnchors) {
  if (!panel.includes(anchor)) {
    throw new Error(`NpcPanel baked craft integration anchor missing: ${anchor}`);
  }
}

if (!resolver.includes("export function resolveCraftProfession")) {
  throw new Error("Craft profession resolver export missing.");
}

if (!workspace.includes("CraftingWorkspace")) {
  throw new Error("CraftingWorkspace component file missing expected marker.");
}

if (panel.includes('return ["profile", "sheet", "inventory", "shop"].includes(v) ? v : "profile";')) {
  throw new Error("NpcPanel craft surface regression: old panel view normalization remains.");
}

if (panel.includes('onClick={() => setActiveView("shop")}')) {
  throw new Error("NpcPanel craft surface regression: stale setActiveView shop handler remains.");
}

console.log("NPC panel baked craft integration surface validated.");
