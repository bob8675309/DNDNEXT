import fs from "node:fs";
import path from "node:path";

const townSheetPath = path.join(process.cwd(), "components", "TownSheet.js");
const probePath = path.join(process.cwd(), "components", "town", "TownCrafterImportProbe.js");
const townSheet = fs.readFileSync(townSheetPath, "utf8");
const probe = fs.readFileSync(probePath, "utf8");

const requiredTown = [
  'import TownCrafterImportProbe from "./town/TownCrafterImportProbe";',
  'function CrafterWorkshopModal({ crafter, inventoryItems, playerPlants = [], onClose, onCraftWorkshop })',
  '{activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}',
];

for (const token of requiredTown) {
  if (!townSheet.includes(token)) throw new Error(`Town crafter import probe validation failed: ${token}`);
}

if (!probe.includes('export default function TownCrafterImportProbe()')) {
  throw new Error("Town crafter import probe component missing expected export.");
}

const forbidden = [
  '<TownCrafterImportProbe',
  '<TownCrafterInteractionPanel',
  '<CharacterInteractionPanel',
  '<iframe',
];

for (const token of forbidden) {
  if (townSheet.includes(token)) throw new Error(`Town crafter import probe should not render yet: ${token}`);
}

console.log("Town crafter import probe validated.");
