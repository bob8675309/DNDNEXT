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
const characterPanel = read("components/character/CharacterInteractionPanel.js");

for (const token of [
  'const CharacterInteractionPanel = dynamic(() => import("../../components/character/CharacterInteractionPanel"), { ssr: false });',
  'function townCrafterDisciplineFor(character) {',
  'if (types.includes("blacksmith")) return "Smithing";',
  'if (types.includes("alchemist")) return "Alchemy";',
  'if (types.includes("enchanter")) return "Enchanting";',
  'craft_profession: craftProfession',
  '<CharacterInteractionPanel',
  'character={activeTownProfileCharacter}',
  'initialView={activeTownProfileView}',
]) requireToken(townPage, token, "Town route shared crafter Craft panel");

for (const token of [
  'const NpcPanel = dynamic(() => import("../../components/NpcPanel"), { ssr: false });',
  '<NpcPanel',
  'router.push(`/npcs',
  'router.replace(`/npcs',
  '<iframe',
]) requireAbsent(townPage, token, "Town route shared crafter Craft panel");

requireToken(
  townSheet,
  'onOpenWorkshop={(crafter) => onOpenCharacterProfile?.(crafter, "craft")}',
  "TownSheet shared crafter Craft dispatch"
);

for (const token of [
  'activeWorkshopCrafter ? <CrafterWorkshopModal',
  'typeof onOpenCharacterProfile === "function" ? onOpenCharacterProfile(crafter, "craft") : setActiveWorkshopCrafter(crafter)',
  '<iframe',
]) requireAbsent(townSheet, token, "TownSheet retired legacy crafter modal fallback");

for (const token of [
  'import CharacterInteractionPanel',
  'import CraftingWorkspace',
  '<CharacterInteractionPanel',
]) requireAbsent(townSheet, token, "TownSheet must remain dispatcher-only");

for (const token of [
  'const CraftingWorkspace = dynamic(() => import("../CraftingWorkspace"), { ssr: false });',
  'React.createElement(CraftingWorkspace, {',
  'disciplineLock: craftProfession',
  'showDisciplineSwitcher: false',
]) requireToken(characterPanel, token, "CharacterInteractionPanel real Craft workspace handoff");

console.log("Town crafter shared Craft panel validated.");
