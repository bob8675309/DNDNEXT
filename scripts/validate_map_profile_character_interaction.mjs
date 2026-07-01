import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "components/MapPageClient.js"), "utf8");

function requireToken(token) {
  if (!source.includes(token)) throw new Error(`Map profile CharacterInteractionPanel: missing ${token}`);
}

function requireAbsent(token) {
  if (source.includes(token)) throw new Error(`Map profile CharacterInteractionPanel: forbidden ${token}`);
}

for (const token of [
  'const CharacterInteractionPanel = dynamic(() => import("./character/CharacterInteractionPanel"), { ssr: false });',
  '<CharacterInteractionPanel',
  'character={{',
  'kind: selNpc?.kind || selNpc?.type || (selNpc?.inventory || selNpc?.storefront_enabled ? "merchant" : undefined)',
  'onClose={() => {',
  'onOpenDrawer={(id) => {',
  'onBrowseWares={(row) => {',
  'showExclusiveOffcanvas("merchantPanel");',
  'showExclusiveOffcanvas("npcPanel");',
]) requireToken(token);

for (const token of [
  'const NpcPanel = dynamic(() => import("./NpcPanel"), { ssr: false });',
  '<NpcPanel\n              key={selNpc?.id || "npc"}',
]) requireAbsent(token);

console.log("Map profile CharacterInteractionPanel handoff validated.");
