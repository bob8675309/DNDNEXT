import fs from "node:fs";
import path from "node:path";

const targets = [
  "components/TownSheet.js",
  "pages/town/[id].js",
  "pages/npcs.js",
  "pages/items.js",
  "components/MapPageClient.js",
];

for (const rel of targets) {
  const filePath = path.join(process.cwd(), rel);
  if (!fs.existsSync(filePath)) continue;
  const source = fs.readFileSync(filePath, "utf8");
  const normalized = source.replace(/\r\n/g, "\n");
  if (normalized !== source) {
    fs.writeFileSync(filePath, normalized, "utf8");
    console.log(`Normalized line endings for ${rel}`);
  }
}

console.log("Build patch target line endings normalized.");
