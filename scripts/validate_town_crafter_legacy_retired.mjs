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

const townSheet = read("components/TownSheet.js");
const townPage = read("pages/town/[id].js");
const characterPanel = read("components/character/CharacterInteractionPanel.js");

for (const token of [
  'onOpenWorkshop={(crafter) => typeof onOpenCharacterProfile === "function" ? onOpenCharacterProfile(crafter, "craft") : null}',
  'teaserSubtitle: "Open the shared Craft tab with the crafter profession locked"',
  'const retiredTownCrafterWorkshopModalReference = CrafterWorkshopModal;',
]) requireToken(townSheet, token, "Town legacy crafter modal retired");

for (const token of [
  'activeWorkshopCrafter',
  'setActiveWorkshopCrafter',
  'onCraftWorkshop={onCraftWorkshop}',
  '  playerPlants = [],\n  onCraftWorkshop,\n  onOpenCharacterProfile,',
  '{activeWorkshopCrafter ? <CrafterWorkshopModal',
  'Open a workshop modal and preview crafted results',
  'import CharacterInteractionPanel',
  'import CraftingWorkspace',
  '<CharacterInteractionPanel',
  '<iframe',
]) requireAbsent(townSheet, token, "Town legacy crafter modal retired");

for (const token of [
  'const CharacterInteractionPanel = dynamic(() => import("../../components/character/CharacterInteractionPanel"), { ssr: false });',
  '<CharacterInteractionPanel',
  'initialView={activeTownProfileView}',
  'craft_profession: craftProfession',
]) requireToken(townPage, token, "Town route shared profile Craft path still active");

for (const token of [
  'const CraftingWorkspace = dynamic(() => import("../CraftingWorkspace"), { ssr: false });',
  'React.createElement(CraftingWorkspace, {',
  'disciplineLock: craftProfession',
  'showDisciplineSwitcher: false',
]) requireToken(characterPanel, token, "CharacterInteractionPanel real Craft workspace handoff still active");

console.log("Town legacy crafter modal retirement validated.");
