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

requireTokens("components/character/CharacterInteractionPanel.js", [
  '"spells"',
  'case "spells": return "Spellbook";',
  'const CharacterSpellbookPanel = dynamic(() => import("../CharacterSpellbookPanel"), { ssr: false });',
  'function CharacterSpellbookShell',
  'if (interactionView === "spells")',
  'React.createElement(CharacterSpellbookPanel, { character, isAdmin })',
]);

requireTokens("components/CharacterSpellbookPanel.js", [
  'export default function CharacterSpellbookPanel({ character = null, isAdmin = false })',
  '.from("character_sheets")',
  '.from("spells_catalog")',
  '.from("character_spells")',
  'resolveCharacterSpellProfile',
  'spellMatchesClass',
  'isSpellUnlockedForCharacter',
  'catalogHasClassMetadata',
  'classFilterReady',
  'preferredSpellRows',
  'SPELL_SOURCE_PRIORITY = { XPHB: 0, PHB: 1 }',
  'has2024Catalog',
  '2024 versions are preferred',
  'Known / Granted Spells',
  'Add from Class Spell List',
]);

requireTokens("utils/spells/classSpellbookRules.js", [
  'import classProgression from "../../public/spells/class-progression.json";',
  'export function normalizeClassKey',
  'export function resolveCharacterSpellProfile',
  'export function spellMatchesClass',
  'export function spellUnlockLevel',
  'export function isSpellUnlockedForCharacter',
  'export function highestUnlockedSpellLevel',
]);

requireTokens("scripts/import_5etools_spells.mjs", [
  'loadClassProgressions',
  'mergeExternalSpellAccess',
  'sources.json',
  'class_progressions',
]);

requireTokens("scripts/lib/5etoolsSpellMetadata.mjs", [
  'external.classVariant',
  'mergeExternalSpellAccess',
  'normalizeClassProgression',
  'loadClassProgressions',
]);

const navbar = read("components/AppNavbar.js");
if (navbar.includes('/admin/spellbooks')) throw new Error("Standalone Spellbooks navbar link must remain removed.");
if (fs.existsSync(path.join(process.cwd(), "pages/admin/spellbooks.js"))) throw new Error("Standalone spellbooks admin page must remain removed.");

console.log("Character profile spellbook validation passed.");
