import fs from "node:fs";
import path from "node:path";

function requireSource(rel, tokens) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`${rel} validation failed: file is missing`);
  const source = fs.readFileSync(absolute, "utf8");
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${rel} validation failed: ${token}`);
  }
  return source;
}

requireSource("sql/20260710_02_character_progression_foundation.sql", [
  "class_catalog",
  "class_level_progression",
  "character_progression",
  "character_level_events",
  "xp_threshold_for_level_v1",
  "get_character_progression_v1",
  "set_character_progression_v1",
  "add_character_xp_v1",
  "import_class_progression_batch_v1",
  "sync_character_progression_from_sheet_v1",
  "enable row level security",
]);

requireSource("sql/20260710_03_character_progression_rpc_grants.sql", [
  "get_character_progression_v1",
  "set_character_progression_v1",
  "add_character_xp_v1",
  "import_class_progression_batch_v1",
  "from public, anon",
  "to authenticated",
]);

requireSource("components/CharacterClassPanel.js", [
  "CharacterClassPanel",
  "get_character_progression_v1",
  "set_character_progression_v1",
  "class_catalog",
  "Class Progression",
  "Admin Progression Setup",
  "Experience",
  "Spellcasting Progression",
  "Progression History",
]);

requireSource("components/character/CharacterInteractionPanel.js", [
  "CharacterClassPanel",
  "CharacterClassShell",
  '"class"',
  "Class",
]);

requireSource("pages/admin/spells.js", [
  "class_progressions",
  "import_class_progression_batch_v1",
  "importedClasses",
]);

requireSource("scripts/lib/5etoolsSpellMetadata.mjs", [
  "groupClassFeaturesByLevel",
  "class_features_by_level",
  "hit_die",
  "saving_throws",
  "findSpellSlotProgression",
  "loadClassProgressions",
]);

console.log("Character class progression validation passed.");
