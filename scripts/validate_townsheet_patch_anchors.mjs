import fs from "node:fs";
import path from "node:path";

const townSheetPath = path.join(process.cwd(), "components", "TownSheet.js");
const patchPath = path.join(process.cwd(), "scripts", "patch_town_profile_crafter_ui_v1.mjs");
const townSheet = fs.readFileSync(townSheetPath, "utf8");
const patch = fs.readFileSync(patchPath, "utf8");

const patchRequired = [
  'function ensureImportAfter(source, anchorImport, addedImport, label) {',
  'throw new Error(`${label}: expected one anchor import, found ${count}`);',
  'import { supabase } from "../utils/supabaseClient";',
  'portrait_thumb_url',
];

for (const token of patchRequired) {
  if (!patch.includes(token)) throw new Error(`TownSheet patch anchor validation failed in patch script: ${token}`);
}

const townRequired = [
  'import { buildTownData } from "../utils/townData";',
  'import { supabase } from "../utils/supabaseClient";',
  'import styles from "./TownSheet.module.scss";',
  'function townCrafterPortraitUrl(crafter) {',
  'crafter?.portrait_shop_url || crafter?.portrait_thumb_url || crafter?.portrait_url || crafter?.image_url || ""',
  'return supabase.storage.from("npc-portraits").getPublicUrl(storagePath).data?.publicUrl || "";',
  'const enrichedResident = resident.filter((m) => !presentIds.has(m.id)).map((m) => ({ ...m, isResident: true, isPresent: false }));',
  'className={cls(styles.crafterModal, styles.crafterModalBuilder, "town-crafter-storefront")}',
  '{activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}',
];

for (const token of townRequired) {
  if (!townSheet.includes(token)) throw new Error(`TownSheet patch anchor validation failed in TownSheet: ${token}`);
}

const forbidden = [
  'import CharacterInteractionPanel',
  '<CharacterInteractionPanel',
  'import CraftingWorkspace',
  '<CraftingWorkspace',
  '<iframe',
  'TownCrafterImportProbe',
];

for (const token of forbidden) {
  if (townSheet.includes(token)) throw new Error(`TownSheet should not include direct shared-panel/import-probe token: ${token}`);
}

console.log("TownSheet patch anchors validated.");
