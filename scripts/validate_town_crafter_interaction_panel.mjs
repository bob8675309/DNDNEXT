import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "components", "TownSheet.js");
const source = fs.readFileSync(target, "utf8");

const required = [
  'import CharacterInteractionPanel from "./character/CharacterInteractionPanel";',
  'function townCrafterProfessionFor(crafter) {',
  'function townCrafterInteractionCharacter(crafter) {',
  'craft_profession: craftProfession,',
  'profession: craftProfession || crafter?.profession || "",',
  '<CharacterInteractionPanel',
  'npc={townCrafterInteractionCharacter(activeWorkshopCrafter)}',
  'initialView="craft"',
  'onClose={() => setActiveWorkshopCrafter(null)}',
  'CrafterWorkshopModal({ crafter, inventoryItems, playerPlants = [], onClose, onCraftWorkshop })',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`Town crafter interaction panel validation failed: ${token}`);
}

const forbidden = [
  'activeWorkshopCrafter ? <CrafterWorkshopModal',
  'iframe',
  'patch_town_crafter_full_workshop_frame',
];

for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`Town crafter interaction panel should not include token: ${token}`);
}

console.log("Town crafter interaction panel validated.");
