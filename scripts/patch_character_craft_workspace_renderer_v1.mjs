import fs from "node:fs";
import path from "node:path";

const wrapperPath = path.join(process.cwd(), "components", "character", "CharacterInteractionPanel.js");
let source = fs.readFileSync(wrapperPath, "utf8");

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import React from "react";\nimport NpcPanel from "../NpcPanel";',
  'import React from "react";\nimport dynamic from "next/dynamic";\nimport NpcPanel from "../NpcPanel";',
  "CharacterInteractionPanel dynamic import"
);

replaceOnce(
  'import { resolveCraftProfession } from "../../utils/craftProfession";\n\nexport const CHARACTER_INTERACTION_VIEWS = ["profile", "sheet", "inventory", "shop", "craft"];',
  'import { resolveCraftProfession } from "../../utils/craftProfession";\n\nconst CraftingWorkspace = dynamic(() => import("../CraftingWorkspace"), { ssr: false });\n\nexport const CHARACTER_INTERACTION_VIEWS = ["profile", "sheet", "inventory", "shop", "craft"];',
  "CharacterInteractionPanel CraftingWorkspace dynamic component"
);

replaceOnce(
  `  const renderCraftView = React.useCallback(() => {
    if (!hasCraftCapability) return null;
    return React.createElement(CharacterCraftShell, { craftProfession });
  }, [craftProfession, hasCraftCapability]);`,
  `  const renderCraftView = React.useCallback(() => {
    if (!hasCraftCapability) return null;
    return React.createElement(
      "div",
      { className: "character-craft-workspace-shell", "data-craft-profession": craftProfession || "" },
      React.createElement(CraftingWorkspace, {
        mode: "panel",
        disciplineLock: craftProfession,
        crafterId: panelCharacterId,
        crafter: panelCharacter,
        startView: "recipes",
        showDisciplineSwitcher: false,
      })
    );
  }, [craftProfession, hasCraftCapability, panelCharacter, panelCharacterId]);`,
  "CharacterInteractionPanel real CraftingWorkspace renderer"
);

fs.writeFileSync(wrapperPath, source, "utf8");
console.log("Patched CharacterInteractionPanel to render locked CraftingWorkspace in Craft view.");
