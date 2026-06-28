import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

const townSheet = read("components/TownSheet.js");
const townPage = read("pages/town/[id].js");
const css = read("styles/npc-profile-panel.css");

const townSheetRequired = [
  'function MerchantLinkRow({ merchant, onOpenProfile, onOpenShop })',
  'onClick={() => onOpenProfile(merchant, "profile")}',
  'onClick={() => onOpenShop(merchant, "shop")}',
  'function MarketDrawer({ marketData, townName, onOpenProfile, onOpenShop })',
  '<MarketDrawer marketData={marketData} townName={townName} onOpenProfile={onOpenCharacterProfile} onOpenShop={onOpenCharacterProfile} />',
  'function CrafterRow({ crafter, onOpenWorkshop, onOpenProfile })',
  'onClick={() => onOpenProfile(crafter, "profile")}',
  'function CrafterDrawer({ crafters, townName, inventoryItems, onOpenWorkshop, onOpenProfile })',
  '<CrafterDrawer crafters={crafterData} townName={townName} inventoryItems={playerInventory} onOpenWorkshop={onOpenWorkshop} onOpenProfile={onOpenCharacterProfile} />',
  'onOpenCharacterProfile,',
  'onOpenCharacterProfile={onOpenCharacterProfile}',
];

for (const token of townSheetRequired) {
  if (!townSheet.includes(token)) throw new Error(`Town profile side panel validation failed in TownSheet: ${token}`);
}

const townSheetForbidden = [
  'href={profileHref}>Open Profile',
  'href={shopHref}>Browse Wares',
  'const profileHref =',
  'const shopHref =',
  '<iframe',
  'import CharacterInteractionPanel',
  'import CraftingWorkspace',
];

for (const token of townSheetForbidden) {
  if (townSheet.includes(token)) throw new Error(`TownSheet still contains redirect/heavy import token: ${token}`);
}

const townPageRequired = [
  'import dynamic from "next/dynamic";',
  'const NpcPanel = dynamic(() => import("../../components/NpcPanel"), { ssr: false });',
  'const [activeProfileCharacter, setActiveProfileCharacter] = useState(null);',
  'const [activeProfileView, setActiveProfileView] = useState("profile");',
  'function handleOpenTownProfile(character, initialView = "profile") {',
  'onOpenCharacterProfile={handleOpenTownProfile}',
  'className="town-profile-sidepanel-backdrop"',
  'className="town-profile-sidepanel"',
  'initialView={activeProfileView}',
  'onClose={() => setActiveProfileCharacter(null)}',
];

for (const token of townPageRequired) {
  if (!townPage.includes(token)) throw new Error(`Town profile side panel validation failed in town page: ${token}`);
}

const townPageForbidden = [
  'router.push(`/npcs',
  'router.replace(`/npcs',
  '<iframe',
];

for (const token of townPageForbidden) {
  if (townPage.includes(token)) throw new Error(`Town page should not redirect to NPC page for town profile panel: ${token}`);
}

const cssRequired = [
  '/* ===== Town route profile side panel v1 ===== */',
  '.town-profile-sidepanel-backdrop',
  '.town-profile-sidepanel',
  '.town-profile-sidepanel .npc-panel-inner',
];

for (const token of cssRequired) {
  if (!css.includes(token)) throw new Error(`Town profile side panel CSS validation failed: ${token}`);
}

console.log("Town profile side panel validated.");
