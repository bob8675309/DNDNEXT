import fs from "node:fs";
import path from "node:path";

const requiredFiles = [
  "sql/20260710_02_character_progression_foundation.sql",
  "sql/20260710_03_character_progression_rpc_grants.sql",
  "sql/20260710_04_character_xp_level_up_review.sql",
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

const foundationSource = fs.readFileSync(path.join(process.cwd(), "sql/20260710_02_character_progression_foundation.sql"), "utf8");
for (const contract of ["class_catalog", "character_progression", "get_character_progression_v1", "set_character_progression_v1"]) {
  if (!foundationSource.includes(contract)) throw new Error(`Character class progression validation failed: missing database contract ${contract}`);
}

const reviewMigration = fs.readFileSync(path.join(process.cwd(), "sql/20260710_04_character_xp_level_up_review.sql"), "utf8");
for (const contract of [
  "character_level_up_sessions",
  "can_manage_character_progression_v1",
  "get_character_level_up_review_v1",
  "begin_character_level_up_v1",
  "cancel_character_level_up_v1",
  "metadata_ready",
  "source = 'XPHB'",
]) {
  if (!reviewMigration.includes(contract)) throw new Error(`Character class progression validation failed: missing review contract ${contract}`);
}

const classPanel = fs.readFileSync(path.join(process.cwd(), "components/CharacterClassPanel.js"), "utf8");
for (const token of [
  "preferredClassRows",
  'supabase.rpc("can_manage_character_progression_v1"',
  'supabase.rpc("add_character_xp_v1"',
  'supabase.rpc("begin_character_level_up_v1"',
  'supabase.rpc("cancel_character_level_up_v1"',
  "2024 rules are canonical",
  "Review Level Up",
  "Apply Level (not yet enabled)",
]) {
  if (!classPanel.includes(token)) throw new Error(`Character class progression validation failed: missing Class panel token ${token}`);
}

console.log("Character class progression file contracts validated.");
