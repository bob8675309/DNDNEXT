import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
let source = fs.readFileSync(panelPath, "utf8");

const viewBefore = 'return ["profile", "sheet", "inventory", "shop"].includes(v) ? v : "profile";';
const viewAfter = 'return ["profile", "sheet", "inventory", "shop", "craft"].includes(v) ? v : "profile";';

if (!source.includes(viewAfter)) {
  const count = source.split(viewBefore).length - 1;
  if (count !== 1) {
    throw new Error(`NpcPanel craft placeholder tab patch expected one normalize match, found ${count}`);
  }
  source = source.replace(viewBefore, viewAfter);
}

const tabsBefore = 'typeof renderInteractionTabs === "function" && !hasCraftCapability ? renderInteractionTabs() : (';
const tabsAfter = 'typeof renderInteractionTabs === "function" ? renderInteractionTabs() : (';

if (!source.includes(tabsAfter)) {
  const count = source.split(tabsBefore).length - 1;
  if (count !== 1) {
    throw new Error(`NpcPanel craft placeholder tab patch expected one wrapper tab guard match, found ${count}`);
  }
  source = source.replace(tabsBefore, tabsAfter);
}

fs.writeFileSync(panelPath, source, "utf8");
console.log("Enabled wrapper Craft placeholder tab path in NpcPanel.");
