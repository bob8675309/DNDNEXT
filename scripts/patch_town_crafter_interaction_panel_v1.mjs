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
  'import Link from "next/link";\nimport CharacterInteractionPanel from "./character/CharacterInteractionPanel";\nimport { buildTownData } from "../utils/townData";',
  "TownSheet CharacterInteractionPanel import"
);

replaceOnce(
  `function humanizeCraftType(type) {
  switch (type) {
    case "blacksmith": return "Blacksmith";
    case "alchemist": return "Alchemist";
    case "enchanter": return "Enchanter";
    case "scribe": return "Scribe";
    case "jeweler": return "Jeweler";
    default: return "Artisan";
  }
}
`,
  `function humanizeCraftType(type) {
  switch (type) {
    case "blacksmith": return "Blacksmith";
    case "alchemist": return "Alchemist";
    case "enchanter": return "Enchanter";
    case "scribe": return "Scribe";
    case "jeweler": return "Jeweler";
    default: return "Artisan";
  }
}

function townCrafterProfessionFor(crafter) {
  const types = Array.isArray(crafter?.crafterTypes) && crafter.crafterTypes.length ? crafter.crafterTypes : inferCrafterTypes(crafter);
  if (types.includes("blacksmith")) return "Smithing";
  if (types.includes("alchemist")) return "Alchemy";
  if (types.includes("enchanter")) return "Enchanting";
  if (types.includes("scribe")) return "Scribe";
  return "";
}

function townCrafterInteractionCharacter(crafter) {
  const craftProfession = townCrafterProfessionFor(crafter);
  return {
    ...(crafter || {}),
    craft_profession: craftProfession,
    profession: craftProfession || crafter?.profession || "",
    role: crafter?.role || craftProfession || (Array.isArray(crafter?.crafterTypes) ? crafter.crafterTypes.map(humanizeCraftType).join(" / ") : "Crafter"),
  };
}
`,
  "TownSheet crafter interaction helpers"
);

replaceOnce(
  '      {activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}',
  '      {activeWorkshopCrafter ? (\n        <div className={styles.modalBackdrop} onClick={() => setActiveWorkshopCrafter(null)}>\n          <div className={styles.crafterModal} onClick={(event) => event.stopPropagation()}>\n            <CharacterInteractionPanel\n              npc={townCrafterInteractionCharacter(activeWorkshopCrafter)}\n              isAdmin={isAdmin}\n              initialView="craft"\n              onClose={() => setActiveWorkshopCrafter(null)}\n            />\n          </div>\n        </div>\n      ) : null}',
  "TownSheet crafter shared interaction panel render"
);

fs.writeFileSync(target, source, "utf8");
console.log("Patched town crafter entry path to CharacterInteractionPanel Craft view.");
