import fs from "node:fs";
import path from "node:path";

const wrapperPath = path.join(process.cwd(), "components", "character", "CharacterInteractionPanel.js");
const source = fs.readFileSync(wrapperPath, "utf8");

const required = [
  'import dynamic from "next/dynamic";',
  'const CraftingWorkspace = dynamic(() => import("../CraftingWorkspace"), { ssr: false });',
  'function characterCraftPortraitUrl(character) {',
  'className: "character-craft-workspace-shell"',
  'className: "character-craft-workspace-frame"',
  'className: "character-craft-crafter-card"',
  'React.createElement(CraftingWorkspace, {',
  'mode: "panel"',
  'disciplineLock: craftProfession',
  'crafterId: panelCharacterId',
  'crafter: panelCharacter',
  'isAdmin: !!props?.isAdmin',
  'showDisciplineSwitcher: false',
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Baked CharacterInteractionPanel craft renderer validation failed: ${token}`);
  }
}

if (source.includes('return React.createElement(CharacterCraftShell, { craftProfession });')) {
  throw new Error("Baked CharacterInteractionPanel still uses placeholder CharacterCraftShell renderer.");
}

console.log("Baked CharacterInteractionPanel craft renderer validated.");
