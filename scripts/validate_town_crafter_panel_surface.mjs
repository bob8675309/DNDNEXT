import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "components", "TownSheet.js");
const source = fs.readFileSync(target, "utf8");

const required = [
  'function CrafterWorkshopModal({ crafter, inventoryItems, playerPlants = [], onClose, onCraftWorkshop })',
  'const [activeWorkshopCrafter, setActiveWorkshopCrafter] = useState(null);',
  'onOpenWorkshop={setActiveWorkshopCrafter}',
  '{activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}',
  'function inferCrafterTypes(crafter) {',
  'function humanizeCraftType(type) {',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`Town crafter panel surface validation failed: ${token}`);
}

const forbidden = [
  'import CharacterInteractionPanel from "./character/CharacterInteractionPanel";',
  '<CharacterInteractionPanel',
  'townCrafterInteractionCharacter',
  '<iframe',
];

for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`Town crafter panel surface is beyond guarded baseline: ${token}`);
}

console.log("Town crafter panel surface validated.");
