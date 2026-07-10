import fs from "node:fs";
import path from "node:path";

const requiredFiles = [
  "sql/20260710_02_character_progression_foundation.sql",
  "sql/20260710_03_character_progression_rpc_grants.sql",
  "components/CharacterClassPanel.js",
  "components/character/CharacterInteractionPanel.js",
  "pages/admin/spells.js",
  "scripts/lib/5etoolsSpellMetadata.mjs",
  "docs/Character_Progression_Foundation.md",
];

for (const rel of requiredFiles) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Character class progression validation failed: missing ${rel}`);
  const stats = fs.statSync(absolute);
  if (!stats.isFile() || stats.size === 0) throw new Error(`Character class progression validation failed: empty ${rel}`);
}

const interactionSource = fs.readFileSync(path.join(process.cwd(), "components/character/CharacterInteractionPanel.js"), "utf8");
if (!interactionSource.includes("CharacterClassPanel") || !interactionSource.includes("CharacterClassShell")) {
  throw new Error("Character class progression validation failed: shared profile Class shell is missing");
}

const migrationSource = fs.readFileSync(path.join(process.cwd(), "sql/20260710_02_character_progression_foundation.sql"), "utf8");
for (const contract of ["class_catalog", "character_progression", "get_character_progression_v1", "set_character_progression_v1"]) {
  if (!migrationSource.includes(contract)) throw new Error(`Character class progression validation failed: missing database contract ${contract}`);
}

console.log("Character class progression file contracts validated.");
