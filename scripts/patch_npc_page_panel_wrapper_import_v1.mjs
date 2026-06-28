import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(process.cwd(), "pages", "npcs.js");
let source = fs.readFileSync(pagePath, "utf8");

const before = 'import NpcPanel from "../components/NpcPanel";';
const after = 'import NpcPanel from "../components/character/CharacterInteractionPanel";';

if (source.includes(after)) {
  console.log("NPC page profile panel already routes through CharacterInteractionPanel.");
  process.exit(0);
}

const count = source.split(before).length - 1;
if (count !== 1) {
  throw new Error(`NPC page panel wrapper import patch expected one import match, found ${count}`);
}

source = source.replace(before, after);
fs.writeFileSync(pagePath, source, "utf8");
console.log("Patched NPC page profile panel import to CharacterInteractionPanel wrapper.");
