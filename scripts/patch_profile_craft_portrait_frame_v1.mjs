import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "character", "CharacterInteractionPanel.js");
const appPath = path.join(process.cwd(), "pages", "_app.js");
const panelSource = fs.readFileSync(panelPath, "utf8");
const appSource = fs.readFileSync(appPath, "utf8");

for (const token of [
  "function characterCraftPortraitUrl(character) {",
  "character-craft-workspace-frame",
  "character-craft-crafter-card",
  "character-craft-crafter-card__image",
  "character-craft-workspace-main",
  "isAdmin: !!props?.isAdmin",
]) {
  if (!panelSource.includes(token)) {
    throw new Error(`Baked profile Craft portrait frame validation failed: ${token}`);
  }
}

if (!appSource.includes('import "../styles/profile-craft-crafter-frame.css";')) {
  throw new Error("Baked profile Craft portrait frame CSS import is missing from pages/_app.js.");
}

if (panelSource.includes('return React.createElement(CharacterCraftShell, { craftProfession });')) {
  throw new Error("Profile Craft portrait frame bake regression: placeholder craft shell is still active.");
}

console.log("Baked profile Craft portrait frame validated.");
