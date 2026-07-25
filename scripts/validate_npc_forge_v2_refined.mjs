import fs from "node:fs";
import path from "node:path";
import { speciesArtworkFor } from "../utils/speciesArtwork.js";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const wrapper = read("components/NewNpcModalV2.js");
const forge = read("components/NewNpcModalV2Refined.js");
const contextWrapper = read("components/NpcForgeContextPanel.js");
const context = read("components/NpcForgeContextPanelRefined.js");
const catalog = read("utils/npcForgeCatalogRefined.js");
const mechanics = read("utils/backgroundMechanicsRefined.js");
const importer = read("scripts/import_5etools_character_options_refined.mjs");
const styles = read("styles/npc-forge-v2.css");
const backgrounds = read("utils/backgroundPresentation.js");
const migration = read("sql/20260724_04_resolve_background_copy_catalog.sql");
const speciesPreference = [
  read("sql/20260721_01_prefer_playable_species_sources.sql"),
  read("sql/20260723_01_consolidate_species_catalog.sql"),
  read("sql/20260724_01_remove_gith_parent_species.sql"),
].join("\n");

function requireTokens(text, tokens, label) {
  for (const token of tokens) if (!text.includes(token)) throw new Error(`${label} validation failed: missing ${token}`);
}

requireTokens(wrapper, ["NewNpcModalV2Refined"], "NPC Forge wrapper");
requireTokens(contextWrapper, ["NpcForgeContextPanelRefined"], "NPC Forge context wrapper");
requireTokens(forge, [
  '"Species", "Background", "Class", "Abilities"',
  "backgroundSkillChoices",
  "toggleBackgroundSkill",
  "backgroundFeatOptions",
  "onToggleBackgroundSkill",
  "onSelectBackgroundFeat",
  "Die Roll {index + 1}",
  'draggable className={`npc-forge-roll-card refined',
  'event.dataTransfer.setData("text/npc-forge-roll"',
  "npc-forge-ability-drop-grid",
  'supabase.rpc("create_character_v1"',
  "backgroundExpandedSpells",
  "backgroundSpellList",
  "speciesSource: selectedSpecies?.source",
  "backgroundSource: selectedBackground?.source",
], "NPC Forge refined creator");

for (const forbidden of ["npc-forge-background-mechanics", "npc-forge-background-spell-list"]) {
  if (forge.includes(forbidden)) throw new Error(`NPC Forge refined creator validation failed: left-column ${forbidden} returned.`);
}

requireTokens(context, [
  "BackgroundFeatureList",
  "BackgroundSkillChooser",
  "BackgroundFeatChooser",
  "ExpandedSpellList",
  "Background feature",
  "Choose ${group.count} skill",
  "npc-forge-context-choice-grid",
  "npc-forge-background-spells",
  "Before adventuring",
  "former allies, obligations, rivals",
], "NPC Forge context");
if (context.includes("Suggested Characteristics")) throw new Error("NPC Forge context validation failed: Suggested Characteristics returned to player-facing background UI.");

requireTokens(mechanics, [
  "backgroundSkillRule",
  "backgroundFeatureDetails",
  '/^Suggested Characteristics$/i',
  "data?.isFeature",
  "neutralizeBackgroundLore",
  "extractBackgroundSpellList",
], "background mechanics");
requireTokens(catalog, ["skillRule", "features: backgroundFeatureDetails", "anyGamingSet", "backgroundSkills: skillRule.fixedKeys"], "NPC Forge catalog");
requireTokens(importer, ["resolveCopies", '"background"', 'mode === "insertArr"', "copy_resolution: \"backgrounds-and-species\""], "character-option importer");
requireTokens(migration, ["apply_background_entry_mods_v1", "copyResolvedFrom", "Cobalt Scholar did not inherit", "Preferred background count changed unexpectedly"], "background copy migration");

requireTokens(backgrounds, ["BACKGROUND_LORE", "BACKGROUND_LORE_CATALOG", "importedNarrative", "neutralizeBackgroundLore", "genericBackgroundLore"], "background descriptions");
requireTokens(styles, [".npc-forge-species-artwork", ".npc-forge-species-feature-list"], "species styling");
requireTokens(speciesPreference, [
  "security_invoker = true",
  "o.option_type = 'species'",
  "upper(o.source) = 'XPHB'",
  "upper(o.source) = 'MPMM'",
  "when o.option_type = 'species' and lower(btrim(o.name)) = 'faerie' then 'Fairy'",
  "lower(btrim(o.name)) in ('fairy', 'gnome (deep)', 'gith')",
], "species source preference");

const preferredSpeciesNames = [
  "Aarakocra", "Aasimar", "Aetherborn", "Astral Elf", "Autognome", "Aven", "Boggart", "Bugbear", "Bullywug", "Centaur", "Changeling", "Custom Lineage", "Deep Gnome", "Dhampir", "Dragonborn", "Dragonborn (Chromatic)", "Dragonborn (Gem)", "Dragonborn (Metallic)", "Duergar", "Dwarf", "Dwarf (Kaladesh)", "Eladrin", "Elf", "Elf (Kaladesh)", "Elf (Zendikar)", "Fairy", "Firbolg", "Flamekin", "Genasi", "Giff", "Githyanki", "Githzerai", "Gnoll", "Gnome", "Goblin", "Goblin (Dankwood)", "Goliath", "Grimlock", "Grung", "Hadozee", "Half-Elf", "Half-Orc", "Halfling", "Harengon", "Hexblood", "Hobgoblin", "Human", "Human (Innistrad)", "Human (Ixalan)", "Human (Kaladesh)", "Human (Zendikar)", "Kalashtar", "Kender", "Kenku", "Khenra", "Khoravar", "Kithkin", "Kobold", "Kor", "Kuo-Toa", "Leonin", "Lizardfolk", "Locathah", "Lorwyn Changeling", "Loxodon", "Lupin", "Merfolk", "Minotaur", "Minotaur (Amonkhet)", "Naga", "Orc", "Orc (Ixalan)", "Owlin", "Plasmoid", "Reborn", "Rimekin", "Satyr", "Sea Elf", "Shadar-Kai", "Shifter", "Simic Hybrid", "Siren", "Skeleton", "Tabaxi", "Thri-kreen", "Tiefling", "Tortle", "Triton", "Troglodyte", "Vampire", "Vedalken", "Verdan", "Warforged", "Yuan-Ti", "Yuan-ti Pureblood", "Zombie",
];
if (preferredSpeciesNames.length !== 96) throw new Error(`NPC Forge species artwork validation failed: expected 96 preferred species, found ${preferredSpeciesNames.length}.`);
for (const speciesName of preferredSpeciesNames) {
  const artworkPath = speciesArtworkFor(speciesName);
  if (artworkPath === "/media/species/adventurer.webp") throw new Error(`NPC Forge species artwork validation failed: ${speciesName} still uses neutral fallback artwork.`);
  const file = path.join(root, "public", artworkPath.replace(/^\/+/, ""));
  if (!fs.existsSync(file) || fs.statSync(file).size < 10_000) throw new Error(`NPC Forge species artwork validation failed: ${speciesName} maps to missing or invalid ${artworkPath}.`);
}

console.log("NPC Forge background decisions, source features, inherited mechanics, and drag allocation validation passed.");
