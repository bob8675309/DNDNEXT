import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
const source = fs.readFileSync(panelPath, "utf8");

const required = [
  'export default function NpcPanel({ npc, isAdmin = false, locations = [], onClose, onOpenDrawer, initialView = "profile", interactionView = null, interactionTabs = null, setInteractionView = null, renderInteractionTabs = null, renderCraftView = null, craftProfession = "", hasCraftCapability = false }) {',
  'const [activeView, setActiveView] = useState(() => normalizePanelView(initialView));',
  'setActiveView(normalizePanelView(initialView));',
  'const setPanelView = useCallback((nextView) => {',
  'typeof renderInteractionTabs === "function" ? renderInteractionTabs() : (',
  'activeView === "craft" && hasCraftCapability && typeof renderCraftView === "function"',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`NpcPanel wrapper props validation failed: ${token}`);
}

const forbidden = [
  'export default function NpcPanel({ npc, isAdmin = false, locations = [], onClose, onOpenDrawer, initialView = "profile" }) {',
  'typeof renderInteractionTabs === "function" && !hasCraftCapability ? renderInteractionTabs() : (',
  'onClick={() => setActiveView("shop")}',
];

for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`NpcPanel wrapper props stale token found: ${token}`);
}

console.log("NpcPanel baked wrapper props validated.");
