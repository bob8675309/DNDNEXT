import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
let source = fs.readFileSync(panelPath, "utf8");

const before = 'export default function NpcPanel({ npc, isAdmin = false, locations = [], onClose, onOpenDrawer, initialView = "profile" }) {';
const after = 'export default function NpcPanel({ npc, isAdmin = false, locations = [], onClose, onOpenDrawer, initialView = "profile", interactionView = null, interactionTabs = null, setInteractionView = null, renderInteractionTabs = null, renderCraftView = null, craftProfession = "", hasCraftCapability = false }) {';

if (source.includes(after)) {
  console.log("NpcPanel wrapper props already available.");
  process.exit(0);
}

const count = source.split(before).length - 1;
if (count !== 1) {
  throw new Error(`NpcPanel wrapper props patch expected one signature match, found ${count}`);
}

source = source.replace(before, after);
fs.writeFileSync(panelPath, source, "utf8");
console.log("Patched NpcPanel to accept wrapper-owned inert props.");
