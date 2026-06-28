import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(process.cwd(), "pages", "npcs.js");
const source = fs.readFileSync(pagePath, "utf8");

function requireExact(token, label = token) {
  const count = source.split(token).length - 1;
  if (count !== 1) {
    throw new Error(`NPC page panel surface validation failed for ${label}: expected 1, found ${count}`);
  }
}

requireExact('import NpcPanel from "../components/NpcPanel";', "current NpcPanel import");
requireExact('{profilePanelOpen && selected ? (', "profile panel overlay gate");
requireExact('<div className="npc-page-profile-panel-shell">', "profile panel shell");
requireExact('<NpcPanel', "single NpcPanel JSX use");
requireExact('initialView={profilePanelInitialView}', "profile panel initial view prop");
requireExact('onClose={() => setProfilePanelOpen(false)}', "profile panel close prop");

const forbidden = [
  'import NpcPanel from "../components/character/CharacterInteractionPanel";',
  'useCharacterInteractionShell={true}',
  'CraftingWorkspace',
];

for (const token of forbidden) {
  if (source.includes(token)) {
    throw new Error(`NPC page panel surface is already beyond guarded baseline: ${token}`);
  }
}

console.log("NPC page panel surface validated.");
