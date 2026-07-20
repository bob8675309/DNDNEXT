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
  'Known Spells',
  'Spell Catalogue',
  'profile-catalogue-workspace',
  'profile-catalogue-toolbar',
  'catalogueClasses',
  'classFilter',
  'spellMatchesClass(spell, classFilter)',
  'levelFilter',
  'schoolFilter',
  'catalogueSort',
  'Showing',
  'statusFilter',
  'adminSpells',
  'Remove Spell',
]);

const spellbookSource = read("components/CharacterSpellbookPanel.js");
if (/function\s+(CatalogueList|KnownList)\s*\(/.test(spellbookSource)) {
  throw new Error("Character spellbook search focus validation failed: render helpers must not be nested React component types.");
}
if (spellbookSource.includes('setView("admin")') || spellbookSource.includes('view === "admin"')) {
  throw new Error("Character spellbook validation failed: admin actions must remain integrated into Catalogue.");
}
if (spellbookSource.includes("sourceFilter") || /<span>Source<\/span><select/.test(spellbookSource)) {
  throw new Error("Character spellbook validation failed: Source must not return as a catalogue filter.");
}
if (spellbookSource.lastIndexOf("{renderSpellFilters(") > spellbookSource.lastIndexOf('<div className="profile-catalogue-workspace">')) {
  throw new Error("Character spellbook validation failed: the filter toolbar must remain above the list/detail workspace.");
}

requireTokens("styles/profile-catalogue-workspace.css", [
  '.profile-catalogue-workspace',
  '.profile-catalogue-toolbar',
  '.profile-catalogue__filters--spells',
  '.profile-catalogue__list',
  '.profile-catalogue__preview',
  ':focus-visible',
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
