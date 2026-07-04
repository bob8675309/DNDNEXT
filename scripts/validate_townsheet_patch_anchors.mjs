import fs from "node:fs";
import path from "node:path";

const townSheetPath = path.join(process.cwd(), "components", "TownSheet.js");
const patchPath = path.join(process.cwd(), "scripts", "patch_town_profile_crafter_ui_v1.mjs");
const townSheet = fs.readFileSync(townSheetPath, "utf8");
const patch = fs.existsSync(patchPath) ? fs.readFileSync(patchPath, "utf8") : "";

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

function requireAbsent(source, token, label) {
  if (source.includes(token)) throw new Error(`${label}: forbidden ${token}`);
}

for (const token of [
  'import { buildTownData } from "../utils/townData";',
  'import { supabase } from "../utils/supabaseClient";',
  'import styles from "./TownSheet.module.scss";',
  'function townCrafterPortraitUrl(crafter) {',
  'crafter?.portrait_shop_url || crafter?.portrait_thumb_url || crafter?.portrait_url || crafter?.image_url || ""',
  'return supabase.storage.from("npc-portraits").getPublicUrl(storagePath).data?.publicUrl || "";',
  'const enrichedResident = resident.filter((m) => !presentIds.has(m.id)).map((m) => ({ ...m, isResident: true, isPresent: false }));',
  'className={cls(styles.crafterModal, styles.crafterModalBuilder, "town-crafter-storefront")}',
]) {
  requireToken(townSheet, token, "TownSheet source-baked profile/crafter anchors");
}

const finalSharedCraftState = townSheet.includes('onOpenWorkshop={(crafter) => onOpenCharacterProfile?.(crafter, "craft")}')
  && townSheet.includes("Legacy CrafterWorkshopModal retired")
  && !townSheet.includes("activeWorkshopCrafter ? <CrafterWorkshopModal");

if (finalSharedCraftState) {
  requireToken(
    townSheet,
    '{null /* Legacy CrafterWorkshopModal retired: town Open Workshop now uses the shared profile Craft tab. */}',
    "TownSheet final shared Craft handoff"
  );
} else {
  requireToken(
    townSheet,
    '{activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}',
    "TownSheet intermediate parent profile handoff"
  );
}

for (const token of [
  'import CharacterInteractionPanel',
  '<CharacterInteractionPanel',
  'import CraftingWorkspace',
  '<CraftingWorkspace',
  '<iframe',
  'TownCrafterImportProbe',
]) {
  requireAbsent(townSheet, token, "TownSheet dispatcher/import boundary");
}

if (patch) {
  for (const token of [
    'function ensureImportAfter(source, anchorImport, addedImport, label) {',
    'import { supabase } from "../utils/supabaseClient";',
    'portrait_thumb_url',
  ]) {
    requireToken(patch, token, "TownSheet patch script reference");
  }
}

console.log(finalSharedCraftState
  ? "TownSheet patch anchors validated for final shared Craft source-bake."
  : "TownSheet patch anchors validated for intermediate parent-profile source-bake.");
