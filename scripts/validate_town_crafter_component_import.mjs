import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "components", "TownSheet.js");
const source = fs.readFileSync(target, "utf8");

const required = [
  'import TownCrafterInteractionPanel from "./town/TownCrafterInteractionPanel";',
  'function CrafterWorkshopModal({ crafter, inventoryItems, playerPlants = [], onClose, onCraftWorkshop })',
  '{activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`Town crafter component import validation failed: ${token}`);
}

const forbidden = [
  '<TownCrafterInteractionPanel',
  '<CharacterInteractionPanel',
  '<iframe',
];

for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`Town crafter component import should not render yet: ${token}`);
}

console.log("Town crafter component import validated.");
