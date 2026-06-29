import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "components", "character", "CharacterInteractionPanel.js");
let source = fs.readFileSync(target, "utf8");

function patch(before, after, label) {
  if (source.includes(after)) return;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

patch(
  'const CraftingWorkspace = dynamic(() => import("../CraftingWorkspace"), { ssr: false });\n',
  'const CraftingWorkspace = dynamic(() => import("../CraftingWorkspace"), { ssr: false });\n\nfunction characterCraftPortraitUrl(character) {\n  return character?.portrait_shop_url || character?.portrait_thumb_url || character?.portrait_url || character?.image_url || "";\n}\n',
  "portrait helper"
);

patch(
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
  `  const renderCraftView = React.useCallback(() => {
    if (!hasCraftCapability) return null;
    const portraitUrl = characterCraftPortraitUrl(panelCharacter);
    return React.createElement(
      "div",
      { className: "character-craft-workspace-shell", "data-craft-profession": craftProfession || "" },
      React.createElement(
        "div",
        { className: "character-craft-workspace-frame", "data-has-portrait": portraitUrl ? "true" : "false" },
        portraitUrl ? React.createElement(
          "aside",
          { className: "character-craft-crafter-card" },
          React.createElement("img", { className: "character-craft-crafter-card__image", src: portraitUrl, alt: "" }),
          React.createElement("div", { className: "character-craft-crafter-card__name" }, panelCharacter?.name || "Crafter"),
          React.createElement("div", { className: "character-craft-crafter-card__discipline" }, craftProfession || "Craft")
        ) : null,
        React.createElement(
          "div",
          { className: "character-craft-workspace-main" },
          React.createElement(CraftingWorkspace, {
            mode: "panel",
            disciplineLock: craftProfession,
            crafterId: panelCharacterId,
            crafter: panelCharacter,
            startView: "recipes",
            showDisciplineSwitcher: false,
          })
        )
      )
    );
  }, [craftProfession, hasCraftCapability, panelCharacter, panelCharacterId]);`,
  "portrait frame render"
);

fs.writeFileSync(target, source, "utf8");
console.log("Patched profile Craft portrait frame.");
