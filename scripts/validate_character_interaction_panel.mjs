import fs from "node:fs";
import path from "node:path";

const rel = path.join("components", "character", "CharacterInteractionPanel.js");
const source = fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const required = [
  'import React from "react";',
  'import NpcPanel from "../NpcPanel";',
  'import { resolveCraftProfession } from "../../utils/craftProfession";',
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
  'React.useMemo',
  'React.useState',
  'React.useEffect',
  'React.useCallback',
  'React.createElement(NpcPanel',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`CharacterInteractionPanel validation failed: ${token}`);
}

if (source.includes("CraftingWorkspace")) {
  throw new Error("CharacterInteractionPanel should not import CraftingWorkspace until the wrapper path is intentionally wired.");
}

console.log("CharacterInteractionPanel wrapper validation passed.");
