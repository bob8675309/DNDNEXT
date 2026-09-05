const SPECIES_ARTWORK = new Set([
  "aarakocra",
  "aasimar",
  "aetherborn",
  "astral-elf",
  "autognome",
  "aven",
  "bugbear",
  "boggart",
  "bullywug",
  "centaur",
  "changeling",
  "custom-lineage",
  "deep-gnome",
  "dhampir",
  "dragonborn",
  "dragonborn-chromatic",
  "dragonborn-gem",
  "dragonborn-metallic",
  "dwarf",
  "duergar",
  "eladrin",
  "elf",
  "elf-kaladesh",
  "elf-zendikar",
  "fairy",
  "firbolg",
  "flamekin",
  "genasi",
  "giff",
  "gith",
  "gnoll",
  "gnome",
  "goblin",
  "goliath",
  "grimlock",
  "grung",
  "halfling",
  "hadozee",
  "harengon",
  "half-elf",
  "hexblood",
  "hobgoblin",
  "human",
  "human-innistrad",
  "human-ixalan",
  "human-kaladesh",
  "human-zendikar",
  "kenku",
  "kobold",
  "kuo-toa",
  "kalashtar",
  "kender",
  "kithkin",
  "khoravar",
  "khenra",
  "kor",
  "leonin",
  "lizardfolk",
  "locathah",
  "loxodon",
  "lupin",
  "merfolk",
  "minotaur",
  "minotaur-amonkhet",
  "naga",
  "orc",
  "owlin",
  "plasmoid",
  "reborn",
  "rimekin",
  "satyr",
  "sea-elf",
  "shadar-kai",
  "shifter",
  "simic-hybrid",
  "siren",
  "skeleton",
  "tabaxi",
  "thri-kreen",
  "tiefling",
  "tortle",
  "triton",
  "troglodyte",
  "vampire",
  "vedalken",
  "verdan",
  "warforged",
  "yuan-ti",
  "yuan-ti-pureblood",
  "zombie",
]);

const SPECIES_ARTWORK_ALIASES = {
  "dwarf-kaladesh": "dwarf", faerie: "fairy", githyanki: "gith", githzerai: "gith", "gnome-deep": "deep-gnome", "goblin-dankwood": "goblin", "half-orc": "orc", "lorwyn-changeling": "changeling", "orc-ixalan": "orc",
  "air-genasi": "genasi", "earth-genasi": "genasi", "fire-genasi": "genasi", "water-genasi": "genasi",
  "black-dragonborn": "dragonborn-chromatic", "blue-dragonborn": "dragonborn-chromatic", "green-dragonborn": "dragonborn-chromatic", "red-dragonborn": "dragonborn-chromatic", "white-dragonborn": "dragonborn-chromatic",
  "brass-dragonborn": "dragonborn-metallic", "bronze-dragonborn": "dragonborn-metallic", "copper-dragonborn": "dragonborn-metallic", "gold-dragonborn": "dragonborn-metallic", "silver-dragonborn": "dragonborn-metallic",
  "amethyst-gem-dragonborn": "dragonborn-gem", "crystal-gem-dragonborn": "dragonborn-gem", "emerald-gem-dragonborn": "dragonborn-gem", "sapphire-gem-dragonborn": "dragonborn-gem", "topaz-gem-dragonborn": "dragonborn-gem",
  "hawk-headed-aven": "aven", "ibis-headed-aven": "aven", drow: "elf", "high-elf": "elf", "wood-elf": "elf", "forest-gnome": "gnome", "rock-gnome": "gnome",
  "beasthide-shifter": "shifter", "longtooth-shifter": "shifter", "swiftstride-shifter": "shifter", "wildhunt-shifter": "shifter", "lorwyn-fairy": "fairy", "shadowmoor-fairy": "fairy", "lorwyn-kithkin": "kithkin", "shadowmoor-kithkin": "kithkin",
};

const SPECIES_DEDICATED_VARIANT_ARTWORK = new Set([
  "air-genasi", "earth-genasi", "fire-genasi", "water-genasi", "black-dragonborn", "blue-dragonborn", "green-dragonborn", "red-dragonborn", "white-dragonborn", "brass-dragonborn", "bronze-dragonborn", "copper-dragonborn", "gold-dragonborn", "silver-dragonborn", "amethyst-gem-dragonborn", "crystal-gem-dragonborn", "emerald-gem-dragonborn", "sapphire-gem-dragonborn", "topaz-gem-dragonborn", "hawk-headed-aven", "ibis-headed-aven", "drow", "high-elf", "wood-elf", "forest-gnome", "rock-gnome", "beasthide-shifter", "longtooth-shifter", "swiftstride-shifter", "wildhunt-shifter", "lorwyn-fairy", "shadowmoor-fairy", "lorwyn-kithkin", "shadowmoor-kithkin", "dwarf-kaladesh", "goblin-dankwood", "orc-ixalan",
]);

const CINEMATIC_SPECIES_HERO_ARTWORK = Object.freeze({
  aarakocra: "/media/species/cinematic-aarakocra.webp",
  aasimar: "/media/species/cinematic-aasimar.webp",
  bugbear: "/media/species/cinematic-bugbear.webp",
  elf: "/media/species/cinematic-elf.webp",
  firbolg: "/media/species/cinematic-firbolg.webp",
  goblin: "/media/species/cinematic-goblin.webp",
  "half-orc": "/media/species/cinematic-half-orc.webp",
  halfling: "/media/species/cinematic-halfling.webp",
  kenku: "/media/species/cinematic-kenku.webp",
  kobold: "/media/species/cinematic-kobold.webp",
  orc: "/media/species/cinematic-orc.webp",
  tabaxi: "/media/species/cinematic-tabaxi.webp",
  tiefling: "/media/species/cinematic-tiefling.webp",
});
const SPECIES_RAW_NAME_ALIASES = { "genasi-air": "air-genasi", "genasi-earth": "earth-genasi", "genasi-fire": "fire-genasi", "genasi-water": "water-genasi", "aven-hawk-headed": "hawk-headed-aven", "aven-ibis-headed": "ibis-headed-aven" };

export function normalizeSpeciesArtworkKey(value = "") {
  const key = String(value || "").trim().toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return SPECIES_RAW_NAME_ALIASES[key] || key;
}
export function speciesArtworkFor(species = "") {
  const key = normalizeSpeciesArtworkKey(species);
  const artworkKey = SPECIES_ARTWORK.has(key) ? key : SPECIES_ARTWORK_ALIASES[key];
  return artworkKey ? `/media/species/${artworkKey}.webp` : "/media/species/adventurer.webp";
}
export function speciesPortraitArtworkFor(species = "") {
  const key = normalizeSpeciesArtworkKey(species);
  if (CINEMATIC_SPECIES_HERO_ARTWORK[key]) return CINEMATIC_SPECIES_HERO_ARTWORK[key];
  if (SPECIES_DEDICATED_VARIANT_ARTWORK.has(key)) return `/media/species/${key}.webp`;
  return speciesArtworkFor(species);
}
export function speciesHeroArtworkFor(species = "") {
  const key = normalizeSpeciesArtworkKey(species);
  return CINEMATIC_SPECIES_HERO_ARTWORK[key] || speciesPortraitArtworkFor(species);
}
export function hasDedicatedSpeciesArtwork(species = "") {
  const key = normalizeSpeciesArtworkKey(species);
  return SPECIES_ARTWORK.has(key) || Boolean(SPECIES_ARTWORK_ALIASES[key]);
}
export function hasSpeciesPortraitArtwork(species = "") {
  const key = normalizeSpeciesArtworkKey(species);
  return hasDedicatedSpeciesArtwork(species) || SPECIES_DEDICATED_VARIANT_ARTWORK.has(key) || Boolean(CINEMATIC_SPECIES_HERO_ARTWORK[key]);
}
export function handleSpeciesArtworkError(event) {
  const image = event?.currentTarget;
  if (!image) return;
  if (image.dataset.fallbackApplied === "true") { image.hidden = true; return; }
  image.dataset.fallbackApplied = "true";
  image.src = "/media/species/adventurer.webp";
}