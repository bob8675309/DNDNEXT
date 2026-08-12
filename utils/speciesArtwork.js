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

// Source-book variants share the same ancestry reference until they receive a
// distinct illustration. This is intentionally preferable to showing the
// unrelated neutral adventurer for an otherwise recognisable species family.
const SPECIES_ARTWORK_ALIASES = {
  "dwarf-kaladesh": "dwarf",
  faerie: "fairy",
  githyanki: "gith",
  githzerai: "gith",
  "gnome-deep": "deep-gnome",
  "goblin-dankwood": "goblin",
  "half-orc": "orc",
  "lorwyn-changeling": "changeling",
  "orc-ixalan": "orc",
  "air-genasi": "genasi",
  "earth-genasi": "genasi",
  "fire-genasi": "genasi",
  "water-genasi": "genasi",
  "black-dragonborn": "dragonborn-chromatic",
  "blue-dragonborn": "dragonborn-chromatic",
  "green-dragonborn": "dragonborn-chromatic",
  "red-dragonborn": "dragonborn-chromatic",
  "white-dragonborn": "dragonborn-chromatic",
  "brass-dragonborn": "dragonborn-metallic",
  "bronze-dragonborn": "dragonborn-metallic",
  "copper-dragonborn": "dragonborn-metallic",
  "gold-dragonborn": "dragonborn-metallic",
  "silver-dragonborn": "dragonborn-metallic",
  "amethyst-gem-dragonborn": "dragonborn-gem",
  "crystal-gem-dragonborn": "dragonborn-gem",
  "emerald-gem-dragonborn": "dragonborn-gem",
  "sapphire-gem-dragonborn": "dragonborn-gem",
  "topaz-gem-dragonborn": "dragonborn-gem",
};

export function normalizeSpeciesArtworkKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function speciesArtworkFor(species = "") {
  const key = normalizeSpeciesArtworkKey(species);
  const artworkKey = SPECIES_ARTWORK.has(key) ? key : SPECIES_ARTWORK_ALIASES[key];
  return artworkKey
    ? `/media/species/${artworkKey}.webp`
    : "/media/species/adventurer.webp";
}

export function hasDedicatedSpeciesArtwork(species = "") {
  const key = normalizeSpeciesArtworkKey(species);
  return SPECIES_ARTWORK.has(key) || Boolean(SPECIES_ARTWORK_ALIASES[key]);
}

export function handleSpeciesArtworkError(event) {
  const image = event?.currentTarget;
  if (!image) return;
  if (image.dataset.fallbackApplied === "true") {
    image.hidden = true;
    return;
  }
  image.dataset.fallbackApplied = "true";
  image.src = "/media/species/adventurer.webp";
}
