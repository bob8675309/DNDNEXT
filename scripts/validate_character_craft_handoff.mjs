import fs from "node:fs";
import path from "node:path";

const wrapperPath = path.join(process.cwd(), "components", "character", "CharacterInteractionPanel.js");
const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");

const wrapper = fs.readFileSync(wrapperPath, "utf8");
const panel = fs.readFileSync(panelPath, "utf8");

const wrapperRequired = [
  'const hasCraftCapability = !!craftProfession && craftProfession !== "Scribe";',
  '() => buildCharacterInteractionTabs({ hasCraftCapability, hasShopCapability })',
  'const safeInitialView = interactionTabs.includes(requestedView) ? requestedView : "profile";',
  'const safeView = interactionTabs.includes(normalized) ? normalized : "profile";',
  'renderInteractionTabs',
  'renderCraftView',
  'return React.createElement(CharacterCraftShell, { craftProfession });',
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
  'dynamic(() => import("../CraftingWorkspace")',
];

for (const token of forbidden) {
  if (wrapper.includes(token) || panel.includes(token)) {
    throw new Error(`Character craft handoff should still be placeholder-only; found ${token}`);
  }
}

console.log("Character craft handoff placeholder path validated.");
