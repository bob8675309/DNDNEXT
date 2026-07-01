import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
const source = fs.readFileSync(panelPath, "utf8");

const required = [
  'interactionView = null',
  'interactionTabs = null',
  'setInteractionView = null',
  'renderInteractionTabs = null',
  'renderCraftView = null',
  'craftProfession = ""',
  'hasCraftCapability = false',
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Baked NpcPanel wrapper props validation failed: ${token}`);
  }
}

if (source.includes('export default function NpcPanel({ npc, isAdmin = false, locations = [], onClose, onOpenDrawer, initialView = "profile" }) {')) {
  throw new Error("Baked NpcPanel wrapper props regression: old function signature is still present.");
}

console.log("Baked NpcPanel wrapper props validated.");
