import fs from "node:fs";
import path from "node:path";

const wrapperPath = path.join(process.cwd(), "components", "character", "CharacterInteractionPanel.js");
const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");

const wrapper = fs.readFileSync(wrapperPath, "utf8");
const panel = fs.readFileSync(panelPath, "utf8");

const wrapperRequired = [
  'const CraftingWorkspace = dynamic(() => import("../CraftingWorkspace"), { ssr: false });',
  'const hasCraftCapability = !!craftProfession && craftProfession !== "Scribe";',
  '() => buildCharacterInteractionTabs({ hasCraftCapability, hasShopCapability })',
  'const safeInitialView = interactionTabs.includes(requestedView) ? requestedView : "profile";',
  'const safeView = interactionTabs.includes(normalized) ? normalized : "profile";',
  'renderInteractionTabs',
  'renderCraftView',
  'character-craft-workspace-shell',
  'React.createElement(CraftingWorkspace',
  'mode: "panel"',
  'disciplineLock: craftProfession',
  'crafterId: panelCharacterId',
  'crafter: panelCharacter',
  'showDisciplineSwitcher: false',
  'craftProfession,',
  'hasCraftCapability,',
  'renderCraftView,',
];

for (const token of wrapperRequired) {
  if (!wrapper.includes(token)) throw new Error(`Character craft handoff wrapper validation failed: ${token}`);
}

const panelRequired = [
  'interactionView = null',
  'interactionTabs = null',
  'setInteractionView = null',
  'renderInteractionTabs = null',
  'renderCraftView = null',
  'craftProfession = ""',
  'hasCraftCapability = false',
  'return ["profile", "sheet", "inventory", "shop", "craft"].includes(v) ? v : "profile";',
  'typeof renderInteractionTabs === "function" ? renderInteractionTabs() : (',
  'activeView === "craft" && hasCraftCapability && typeof renderCraftView === "function" ? (',
  '{renderCraftView()}',
];

for (const token of panelRequired) {
  if (!panel.includes(token)) throw new Error(`Character craft handoff panel validation failed: ${token}`);
}

const forbidden = [
  'import CraftingWorkspace',
  'dynamic(() => import("./CraftingWorkspace")',
];

for (const token of forbidden) {
  if (wrapper.includes(token) || panel.includes(token)) {
    throw new Error(`Character craft handoff found forbidden token: ${token}`);
  }
}

console.log("Character craft handoff real workspace path validated.");
