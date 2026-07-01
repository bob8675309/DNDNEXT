import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

function requireAbsent(source, token, label) {
  if (source.includes(token)) throw new Error(`${label}: forbidden ${token}`);
}

const townPage = read("pages/town/[id].js");
const townSheet = read("components/TownSheet.js");
const mapPage = read("components/MapPageClient.js");
const locationSideBar = read("components/LocationSideBar.js");
const css = read("styles/npc-profile-panel.css");

for (const token of [
  'import dynamic from "next/dynamic";',
  'const NpcPanel = dynamic(() => import("../../components/NpcPanel"), { ssr: false });',
  'const [activeTownProfileCharacter, setActiveTownProfileCharacter] = useState(null);',
  'const [activeTownProfileView, setActiveTownProfileView] = useState("profile");',
  'function handleOpenTownProfile(character, initialView = "profile") {',
  'onOpenCharacterProfile={handleOpenTownProfile}',
  'className="town-profile-sidepanel-backdrop"',
  'className="town-profile-sidepanel"',
  '<NpcPanel',
  'initialView={activeTownProfileView}',
]) requireToken(townPage, token, "Town route parent-owned profile panel");

for (const token of [
  'const CharacterInteractionPanel = dynamic(() => import("../../components/character/CharacterInteractionPanel"), { ssr: false });',
  '<CharacterInteractionPanel',
  'router.push(`/npcs',
  'router.replace(`/npcs',
  '<iframe',
]) requireAbsent(townPage, token, "Town route pre-Craft handoff boundary");

for (const token of [
  'import { supabase } from "../utils/supabaseClient";',
  'function townCrafterPortraitUrl(crafter) {',
  'function MerchantLinkRow({ merchant, onBrowseWares, onOpenProfile, onOpenShop })',
  'onClick={() => onOpenProfile(merchant, "profile")}',
  'onClick={() => onOpenShop(merchant, "shop")}',
  'function CrafterRow({ crafter, onOpenWorkshop, onOpenProfile })',
  'onClick={() => onOpenProfile(crafter, "profile")}',
  'function SharedDrawer({ panel, openPanel, setOpenPanel, adminToolsVisible, adminDrawerProps, marketData, townName, crafterData, playerInventory, onOpenWorkshop, onBrowseWares, onOpenCharacterProfile })',
  'onOpenWorkshop={setActiveWorkshopCrafter} onBrowseWares={setActiveMerchant} onOpenCharacterProfile={onOpenCharacterProfile}',
  '{activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}',
]) requireToken(townSheet, token, "TownSheet parent-profile dispatcher boundary");

for (const token of [
  'href={profileHref}>Open Profile',
  'href={shopHref}>Browse Wares',
  'const profileHref =',
  'const shopHref =',
  'onClick={() => onBrowseWares?.(merchant)}',
  'import CharacterInteractionPanel',
  'import CraftingWorkspace',
  '<CharacterInteractionPanel',
  '<iframe',
]) requireAbsent(townSheet, token, "TownSheet parent-profile dispatcher boundary");

for (const token of [
  'onOpenMerchant,',
  'const presentPeople = (rosterChars || []).slice(0, 8);',
  'className="town-quick-profile-link"',
]) requireToken(locationSideBar, token, "LocationSideBar town profile links");

for (const token of [
  'const tryOpen = (remaining = 10) => {',
  'const offcanvasApi = window.bootstrap?.Offcanvas || null;',
  'window.setTimeout(() => tryOpen(remaining - 1), 60);',
  'offcanvasApi.getOrCreateInstance(el).show();',
]) requireToken(mapPage, token, "Map offcanvas readiness guard");

for (const token of [
  '/* ===== Town NPC profile and crafter storefront v1 ===== */',
  '.town-quick-profile-link',
  '.town-crafter-storefront',
  '/* ===== Town route profile side panel v1 ===== */',
  '.town-profile-sidepanel-backdrop',
  '.town-profile-sidepanel',
]) requireToken(css, token, "Town profile side panel CSS");

console.log("Town parent-owned profile panel handoff validated.");
