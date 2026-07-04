import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "components", "TownSheet.js"), "utf8");

function requireToken(token, label = "Town crafter panel surface") {
  if (!source.includes(token)) throw new Error(`${label} validation failed: ${token}`);
}

function requireAbsent(token, label = "Town crafter panel surface") {
  if (source.includes(token)) throw new Error(`${label} should not include token: ${token}`);
}

const finalSharedCraftState = source.includes('onOpenWorkshop={(crafter) => onOpenCharacterProfile?.(crafter, "craft")}')
  && source.includes("Legacy CrafterWorkshopModal retired")
  && !source.includes("activeWorkshopCrafter ? <CrafterWorkshopModal");

if (finalSharedCraftState) {
  for (const token of [
    'function inferCrafterTypes(crafter) {',
    'function humanizeCraftType(type) {',
    'availableProfessionsForCharacter(crafter)',
    'const PROFESSION_TO_CRAFT_TYPE = Object.freeze({',
    'function CrafterRow({ crafter, onOpenWorkshop, onOpenProfile })',
    'onClick={() => onOpenProfile(crafter, "profile")}',
    'function CrafterDrawer({ crafters, townName, inventoryItems, onOpenWorkshop, onOpenProfile })',
    'onOpenWorkshop={(crafter) => onOpenCharacterProfile?.(crafter, "craft")}',
    '{null /* Legacy CrafterWorkshopModal retired: town Open Workshop now uses the shared profile Craft tab. */}',
  ]) {
    requireToken(token, "Town crafter final shared Craft panel surface");
  }

  for (const token of [
    'activeWorkshopCrafter ? <CrafterWorkshopModal',
    'typeof onOpenCharacterProfile === "function" ? onOpenCharacterProfile(crafter, "craft") : setActiveWorkshopCrafter(crafter)',
    'import CharacterInteractionPanel',
    'import CraftingWorkspace',
    '<CharacterInteractionPanel',
    'townCrafterInteractionCharacter',
    '<iframe',
  ]) {
    requireAbsent(token, "Town crafter final shared Craft panel surface");
  }

  console.log("Town crafter panel surface validated for final shared Craft source-bake.");
} else {
  for (const token of [
    'function CrafterWorkshopModal({ crafter, inventoryItems, playerPlants = [], onClose, onCraftWorkshop })',
    'const [activeWorkshopCrafter, setActiveWorkshopCrafter] = useState(null);',
    'onOpenWorkshop={setActiveWorkshopCrafter}',
    '{activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}',
    'function inferCrafterTypes(crafter) {',
    'function humanizeCraftType(type) {',
  ]) {
    requireToken(token, "Town crafter intermediate panel surface");
  }

  for (const token of [
    'import CharacterInteractionPanel from "./character/CharacterInteractionPanel";',
    '<CharacterInteractionPanel',
    'townCrafterInteractionCharacter',
    '<iframe',
  ]) {
    requireAbsent(token, "Town crafter intermediate panel surface");
  }

  console.log("Town crafter panel surface validated for intermediate modal surface.");
}
