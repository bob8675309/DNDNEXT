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
  'return ["profile", "sheet", "inventory", "shop"].includes(v) ? v : "profile";',
  'const MerchantPanel = dynamic(() => import("./MerchantPanel"), { ssr: false });',
  'const sheetMetaLine = [view.race, role, affiliation].filter(Boolean).join(" • ");',
  '{isMerchantView ? <button type="button" className={`btn ${activeView === "shop" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("shop")}>Shop</button> : null}',
  ') : activeView === "shop" ? (',
  'function renderShopPanel() {',
  'function renderInventoryPanel() {',
];

for (const anchor of panelAnchors) {
  if (!panel.includes(anchor)) {
    throw new Error(`NpcPanel craft integration anchor missing after active transforms: ${anchor}`);
  }
}

if (!resolver.includes("export function resolveCraftProfession")) {
  throw new Error("Craft profession resolver export missing.");
}

if (!workspace.includes("CraftingWorkspace")) {
  throw new Error("CraftingWorkspace component file missing expected marker.");
}

if (panel.includes("CraftingWorkspace") || panel.includes("activeView === \"craft\"")) {
  throw new Error("NpcPanel already contains active Craft tab wiring; validate before adding another craft transform.");
}

console.log("NPC panel craft integration surface validated.");
