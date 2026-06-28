import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "components", "TownSheet.js");
let source = fs.readFileSync(target, "utf8");

const before = 'import Link from "next/link";\nimport { buildTownData } from "../utils/townData";';
const after = 'import Link from "next/link";\nimport TownCrafterInteractionPanel from "./town/TownCrafterInteractionPanel";\nimport { buildTownData } from "../utils/townData";';

if (source.includes(after)) {
  console.log("TownSheet already imports TownCrafterInteractionPanel.");
  process.exit(0);
}

const count = source.split(before).length - 1;
if (count !== 1) {
  throw new Error(`TownSheet crafter component import patch expected one import anchor, found ${count}`);
}

source = source.replace(before, after);
fs.writeFileSync(target, source, "utf8");
console.log("Patched TownSheet to import isolated town crafter interaction component.");
