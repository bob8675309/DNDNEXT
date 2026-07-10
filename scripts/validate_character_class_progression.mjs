import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function requireTokens(rel, tokens) {
  const source = read(rel);
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${rel} validation failed: ${token}`);
  }
  return source;
}

requireTokens("sql/20260710_02_character_progression_foundation.sql", [
  "create table if not exists public.class_catalog",
  "create table if not exists public.class_level_progression",
  "create table if not exists public.character_progression",
  "create table if not exists public.character_level_events",
  "public.xp_threshold_for_level_v1",
  "public.get_character_progression_v1",
  "public.set_character_progression_v1",
  "public.add_character_xp_v1",
  "public.import_class_progression_batch_v1",
  "private.sync_character_progression_from_sheet_v1",
  "sync_character_progression_from_sheet_v1 on public.character_sheets",
  "alter table public.character_progression enable row level security",
]);

requireTokens("components/CharacterClassPanel.js", [
  "export default function CharacterClassPanel({ character = null, isAdmin = false })",
  'supabase.rpc("get_character_progression_v1"',
  'supabase.rpc("set_character_progression_v1"',
  '.from("class_catalog")',
  "Class Progression",
  "Admin Progression Setup",
  "Experience",
  "Current Level Features",
  "Spellcasting Progression",
  "Next Level",
  "Progression History",
]);

requireTokens("components/character/CharacterInteractionPanel.js", [
  'const CharacterClassPanel = dynamic(() => import("../CharacterClassPanel"), { ssr: false });',
  '"profile", "class", "sheet"',
  'case "class": return "Class";',
  "function CharacterClassShell",
  'if (interactionView === "class")',
  "React.createElement(CharacterClassPanel, { character, isAdmin })",
]);

requireTokens("pages/admin/spells.js", [
  "class_progressions",
  'supabase.rpc("import_class_progression_batch_v1"',
  "importedClasses",
  "class progressions",
]);

requireTokens("scripts/lib/5etoolsSpellMetadata.mjs", [
  "function groupClassFeaturesByLevel",
  "class_features_by_level",
  "hit_die",
  "saving_throws",
  "findSpellSlotProgression",
  "loadClassProgressions",
]);

console.log("Character class progression validation passed.");
