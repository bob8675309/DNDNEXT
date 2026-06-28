import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "components", "TownSheet.js");
let source = fs.readFileSync(target, "utf8");

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import Link from "next/link";\nimport { buildTownData } from "../utils/townData";',
  'import Link from "next/link";\nimport TownCrafterImportProbe from "./town/TownCrafterImportProbe";\nimport { buildTownData } from "../utils/townData";',
  "TownSheet import probe import"
);

replaceOnce(
  '      {activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}',
  '      <TownCrafterImportProbe />\n      {activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}',
  "TownSheet import probe usage"
);

fs.writeFileSync(target, source, "utf8");
console.log("Patched TownSheet with rendered null town crafter import probe.");
