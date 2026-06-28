import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
const source = fs.readFileSync(panelPath, "utf8");

const required = [
  'export default function NpcPanel({ npc, isAdmin = false, locations = [], onClose, onOpenDrawer, initialView = "profile", interactionView = null, interactionTabs = null, setInteractionView = null, renderInteractionTabs = null, renderCraftView = null, craftProfession = "", hasCraftCapability = false }) {',
  'const [activeView, setActiveView] = useState(() => normalizePanelView(initialView));',
  'setActiveView(normalizePanelView(initialView));',
  '<div className="btn-group btn-group-sm" role="tablist" aria-label="NPC profile views">',
  '{isMerchantView ? <button type="button" className={`btn ${activeView === "shop" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("shop")}>Shop</button> : null}',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`NpcPanel wrapper props validation failed: ${token}`);
}

const forbidden = [
  'CraftingWorkspace',
  'activeView === "craft"',
  'typeof renderInteractionTabs === "function" ? renderInteractionTabs()',
];

for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`NpcPanel wrapper props step should still be inert; found ${token}`);
}

console.log("NpcPanel wrapper props validated.");
