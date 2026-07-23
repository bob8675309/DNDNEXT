import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const forge = read("components/NewNpcModalV2.js");
const context = read("components/NpcForgeContextPanel.js");
const catalog = read("utils/npcForgeCatalog.js");
const styles = read("styles/npc-forge-v2.css");
const backgrounds = read("utils/backgroundPresentation.js");
const speciesPreference = read("sql/20260721_01_prefer_playable_species_sources.sql");

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

for (const token of ["backgroundStoryDescription", "Before adventuring", "former allies, obligations, rivals"]) {
  if (!context.includes(token)) throw new Error(`NPC Forge background presentation validation failed: missing ${token}`);
}
if (context.includes('{ label: "Suggested abilities"') || context.includes("story, suggested abilities")) {
  throw new Error("NPC Forge background presentation validation failed: suggested abilities returned to the Background panel.");
}
for (const token of ["BACKGROUND_LORE", "importedNarrative", "thematicFallback"]) {
  if (!backgrounds.includes(token)) throw new Error(`NPC Forge background description validation failed: missing ${token}`);
}
if (!styles.includes(".npc-forge-background-story")) throw new Error("NPC Forge background styling validation failed.");

for (const token of ["security_invoker = true", "o.option_type = 'species'", "upper(o.source) = 'XPHB'", "upper(o.source) = 'MPMM'"]) {
  if (!speciesPreference.includes(token)) throw new Error(`NPC Forge species source preference validation failed: missing ${token}`);
}

for (const name of ["aarakocra", "aasimar", "aetherborn", "astral-elf", "autognome", "aven", "adventurer", "bugbear", "bullywug", "centaur", "changeling", "dhampir", "dragonborn", "dwarf", "elf", "fairy", "firbolg", "genasi", "giff", "gith", "gnoll", "gnome", "goblin", "goliath", "grimlock", "grung", "hadozee", "halfling", "harengon", "hexblood", "hobgoblin", "human", "kalashtar", "kender", "kenku", "khenra", "kobold", "kuo-toa", "leonin", "lizardfolk", "locathah", "loxodon", "merfolk", "minotaur", "naga", "orc", "owlin", "plasmoid", "satyr", "tabaxi", "thri-kreen", "tiefling", "tortle", "triton", "warforged"]) {
  const file = path.join(root, "public", "media", "species", `${name}.webp`);
  if (!fs.existsSync(file) || fs.statSync(file).size < 10_000) throw new Error(`NPC Forge species artwork validation failed: ${name}.webp is missing or invalid.`);
}

console.log("NPC Forge V2 split origin and species presentation validation passed.");
