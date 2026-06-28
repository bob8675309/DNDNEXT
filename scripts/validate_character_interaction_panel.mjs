import fs from "node:fs";
import path from "node:path";

const rel = path.join("components", "character", "CharacterInteractionPanel.js");
const source = fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const required = [
  'import React from "react";',
  'import dynamic from "next/dynamic";',
  'import NpcPanel from "../NpcPanel";',
  'import { resolveCraftProfession } from "../../utils/craftProfession";',
  'const CraftingWorkspace = dynamic(() => import("../CraftingWorkspace"), { ssr: false });',
  'CHARACTER_INTERACTION_VIEWS',
  '"profile"',
  '"sheet"',
  '"inventory"',
  '"shop"',
  '"craft"',
  'normalizeCharacterInteractionView',
  'sheetForCraftResolution',
  'isMerchantCharacter',
  'characterInteractionLabel',
  'CharacterInteractionTabs',
  'character-interaction-tabs',
  'buildCharacterInteractionTabs',
  'hasShopCapability',
  'interactionTabs',
  'CharacterCraftShell',
  'character-craft-shell',
  'CharacterInteractionShell',
  'character-interaction-shell',
  'character-craft-workspace-shell',
  'useCharacterInteractionShell',
  'renderTabs',
  'craftProfession',
  'hasCraftCapability',
  'interactionView',
  'setInteractionView',
  'setSafeInteractionView',
  'safeInitialView',
  'renderInteractionTabs',
  'renderCraftView',
  'React.createElement(CraftingWorkspace',
  'mode: "panel"',
  'disciplineLock: craftProfession',
  'crafterId: panelCharacterId',
  'crafter: panelCharacter',
  'startView: "recipes"',
  'showDisciplineSwitcher: false',
  'React.useMemo',
  'React.useState',
  'React.useEffect',
  'React.useCallback',
  'React.createElement(NpcPanel',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`CharacterInteractionPanel validation failed: ${token}`);
}

console.log("CharacterInteractionPanel wrapper validation passed.");
