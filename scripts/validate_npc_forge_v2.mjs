import fs from "node:fs";
import path from "node:path";
import { speciesArtworkFor } from "../utils/speciesArtwork.js";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const forge = read("components/NewNpcModalV2.js");
const context = read("components/NpcForgeContextPanel.js");
const catalog = read("utils/npcForgeCatalog.js");
const styles = read("styles/npc-forge-v2.css");
const backgrounds = read("utils/backgroundPresentation.js");
const speciesPreference = [
  read("sql/20260721_01_prefer_playable_species_sources.sql"),
  read("sql/20260723_01_consolidate_species_catalog.sql"),
  read("sql/20260724_01_remove_gith_parent_species.sql"),
].join("\n");

for (const token of [
  '"Species",\n  "Background",\n  "Class"',
  "Choose ancestry and innate traits",
  "Choose a formative background",
  "step === 7",
  'supabase.rpc("create_character_v1"',
  "speciesSource: selectedSpecies?.source",
  "backgroundSource: selectedBackground?.source",
  "size: speciesDefaultCharacterSize(option)",
]) {
  if (!forge.includes(token)) throw new Error(`NPC Forge V2 validation failed: missing ${token}`);
}

if (forge.includes("Species and formative background") || forge.includes("species and ${backgroundOptions.length} backgrounds")) {
  throw new Error("NPC Forge V2 validation failed: Species and Background must remain separate steps.");
}

for (const token of [
  "speciesArtworkFor",
  "hasDedicatedSpeciesArtwork",
  "SpeciesTraitDetails",
  "Original ${option.name} species reference artwork",
  "speciesFlavorLore(option)",
  "activeBackground",
  "step === 6",
]) {
  if (!context.includes(token)) throw new Error(`NPC Forge species presentation validation failed: missing ${token}`);
}

if (context.includes('eyebrow="Species" title={option.name}') || context.includes("npc-forge-species-rules")) {
  throw new Error("NPC Forge species presentation validation failed: duplicate species rules overview returned.");
}

for (const token of ["traitDetails", "creatureTypes", "darkvision", "lore:", "formatPlayerFacingText"]) {
  if (!catalog.includes(token)) throw new Error(`NPC Forge catalog validation failed: missing ${token}`);
}

for (const token of [".npc-forge-species-artwork", ".npc-forge-species-feature-list"]) {
  if (!styles.includes(token)) throw new Error(`NPC Forge species styling validation failed: missing ${token}`);
}

for (const token of ["backgroundStoryDescription", "Before adventuring", "former allies, obligations, rivals", "backgroundMechanicDetails", "Hover for details", "originFeatValue"]) {
  if (!context.includes(token)) throw new Error(`NPC Forge background presentation validation failed: missing ${token}`);
}
for (const token of ["backgroundMechanicDetails", "toolProficiencyDescription", "prerequisite_text", "backgroundFeatId", "backgroundSpellList", "backgroundExpandedSpells"]) {
  if (!forge.includes(token)) throw new Error(`NPC Forge background hover validation failed: missing ${token}`);
}
if (context.includes('{ label: "Suggested abilities"') || context.includes("story, suggested abilities")) {
  throw new Error("NPC Forge background presentation validation failed: suggested abilities returned to the Background panel.");
}
for (const token of ["BACKGROUND_LORE", "BACKGROUND_LORE_CATALOG", "importedNarrative", "neutralizeBackgroundLore", "genericBackgroundLore"]) {
  if (!backgrounds.includes(token)) throw new Error(`NPC Forge background description validation failed: missing ${token}`);
}
for (const token of [".npc-forge-background-story", ".npc-forge-context-row.is-interactive:hover", ".npc-forge-context-row-details"]) {
  if (!styles.includes(token)) throw new Error(`NPC Forge background styling validation failed: missing ${token}`);
}

for (const token of [
  "security_invoker = true",
  "o.option_type = 'species'",
  "upper(o.source) = 'XPHB'",
  "upper(o.source) = 'MPMM'",
  "when o.option_type = 'species' and lower(btrim(o.name)) = 'faerie' then 'Fairy'",
  "lower(btrim(o.name)) in ('fairy', 'gnome (deep)', 'gith')",
]) {
  if (!speciesPreference.includes(token)) throw new Error(`NPC Forge species source preference validation failed: missing ${token}`);
}

const preferredSpeciesNames = [
  "Aarakocra", "Aasimar", "Aetherborn", "Astral Elf", "Autognome", "Aven",
  "Boggart", "Bugbear", "Bullywug", "Centaur", "Changeling", "Custom Lineage",
  "Deep Gnome", "Dhampir", "Dragonborn", "Dragonborn (Chromatic)", "Dragonborn (Gem)",
  "Dragonborn (Metallic)", "Duergar", "Dwarf", "Dwarf (Kaladesh)", "Eladrin", "Elf",
  "Elf (Kaladesh)", "Elf (Zendikar)", "Fairy", "Firbolg", "Flamekin",
  "Genasi", "Giff", "Githyanki", "Githzerai", "Gnoll", "Gnome",
  "Goblin", "Goblin (Dankwood)", "Goliath", "Grimlock", "Grung",
  "Hadozee", "Half-Elf", "Half-Orc", "Halfling", "Harengon", "Hexblood", "Hobgoblin",
  "Human", "Human (Innistrad)", "Human (Ixalan)", "Human (Kaladesh)", "Human (Zendikar)",
  "Kalashtar", "Kender", "Kenku", "Khenra", "Khoravar", "Kithkin", "Kobold", "Kor",
  "Kuo-Toa", "Leonin", "Lizardfolk", "Locathah", "Lorwyn Changeling", "Loxodon",
  "Lupin", "Merfolk", "Minotaur", "Minotaur (Amonkhet)", "Naga", "Orc",
  "Orc (Ixalan)", "Owlin", "Plasmoid", "Reborn", "Rimekin", "Satyr", "Sea Elf",
  "Shadar-Kai", "Shifter", "Simic Hybrid", "Siren", "Skeleton", "Tabaxi", "Thri-kreen",
  "Tiefling", "Tortle", "Triton", "Troglodyte", "Vampire", "Vedalken", "Verdan",
  "Warforged", "Yuan-Ti", "Yuan-ti Pureblood", "Zombie",
];

if (preferredSpeciesNames.length !== 96) throw new Error(`NPC Forge species artwork validation failed: expected 96 preferred species, found ${preferredSpeciesNames.length}.`);

for (const speciesName of preferredSpeciesNames) {
  const artworkPath = speciesArtworkFor(speciesName);
  if (artworkPath === "/media/species/adventurer.webp") {
    throw new Error(`NPC Forge species artwork validation failed: ${speciesName} still uses neutral fallback artwork.`);
  }
  const file = path.join(root, "public", artworkPath.replace(/^\/+/, ""));
  if (!fs.existsSync(file) || fs.statSync(file).size < 10_000) {
    throw new Error(`NPC Forge species artwork validation failed: ${speciesName} maps to missing or invalid ${artworkPath}.`);
  }
}

console.log("NPC Forge V2 split origin and species presentation validation passed.");
