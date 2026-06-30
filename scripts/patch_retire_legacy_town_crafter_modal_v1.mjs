import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function write(rel, source) {
  fs.writeFileSync(path.join(process.cwd(), rel), source, "utf8");
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

function requireAbsent(source, token, label) {
  if (source.includes(token)) throw new Error(`${label}: forbidden ${token}`);
}

const rel = "components/TownSheet.js";
let source = read(rel);
const before = source;

source = replaceRequired(
  source,
  '  playerInventory = [],\n  playerPlants = [],\n  onCraftWorkshop,\n  onOpenCharacterProfile,\n}) {',
  '  playerInventory = [],\n  onOpenCharacterProfile,\n}) {',
  "TownSheet remove obsolete playerPlants/onCraftWorkshop props after shared Craft tab adoption"
);

source = replaceRequired(
  source,
  '  const [activeWorkshopCrafter, setActiveWorkshopCrafter] = useState(null);\n',
  '',
  "TownSheet remove legacy active workshop modal state"
);

source = replaceRequired(
  source,
  'onOpenWorkshop={(crafter) => typeof onOpenCharacterProfile === "function" ? onOpenCharacterProfile(crafter, "craft") : setActiveWorkshopCrafter(crafter)}',
  'onOpenWorkshop={(crafter) => typeof onOpenCharacterProfile === "function" ? onOpenCharacterProfile(crafter, "craft") : null}',
  "TownSheet Open Workshop no longer falls back to legacy modal"
);

source = replaceRequired(
  source,
  'teaserSubtitle: "Open a workshop modal and preview crafted results"',
  'teaserSubtitle: "Open the shared Craft tab with the crafter profession locked"',
  "TownSheet crafter teaser describes shared Craft tab"
);

source = replaceRequired(
  source,
  '      {activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}\n',
  '',
  "TownSheet remove legacy CrafterWorkshopModal render path"
);

source = replaceRequired(
  source,
  '\nexport default function TownSheet({',
  '\nconst retiredTownCrafterWorkshopModalReference = CrafterWorkshopModal;\nvoid retiredTownCrafterWorkshopModalReference;\n\nexport default function TownSheet({',
  "TownSheet keep legacy modal source referenced until source-bake removal"
);

if (source !== before) {
  write(rel, source);
  console.log("Retired active TownSheet legacy crafter modal path; Open Workshop now requires the shared profile Craft callback.");
} else {
  console.log("TownSheet legacy crafter modal path already retired.");
}

const townSheet = read(rel);
for (const token of [
  'onOpenWorkshop={(crafter) => typeof onOpenCharacterProfile === "function" ? onOpenCharacterProfile(crafter, "craft") : null}',
  'teaserSubtitle: "Open the shared Craft tab with the crafter profession locked"',
  'const retiredTownCrafterWorkshopModalReference = CrafterWorkshopModal;',
]) requireToken(townSheet, token, "Town legacy crafter modal retirement");

for (const token of [
  'activeWorkshopCrafter',
  'setActiveWorkshopCrafter',
  'onCraftWorkshop={onCraftWorkshop}',
  '  playerPlants = [],\n  onCraftWorkshop,\n  onOpenCharacterProfile,',
  'Open a workshop modal and preview crafted results',
  '{activeWorkshopCrafter ? <CrafterWorkshopModal',
]) requireAbsent(townSheet, token, "Town legacy crafter modal retirement");

for (const token of [
  'import CharacterInteractionPanel',
  'import CraftingWorkspace',
  '<CharacterInteractionPanel',
  '<iframe',
]) requireAbsent(townSheet, token, "TownSheet must remain dispatcher-only");

console.log("Town legacy crafter modal retirement validated.");
