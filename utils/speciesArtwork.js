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
  "hexblood",
  "hobgoblin",
  "human",
  "kenku",
  "kobold",
  "kuo-toa",
  "kalashtar",
  "kender",
  "kithkin",
  "khenra",
  "kor",
  "leonin",
  "lizardfolk",
  "locathah",
  "loxodon",
  "lupin",
  "merfolk",
  "minotaur",
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
  "elf-kaladesh": "elf",
  "elf-zendikar": "elf",
  faerie: "fairy",
  githyanki: "gith",
  githzerai: "gith",
  "gnome-deep": "gnome",
  "goblin-dankwood": "goblin",
  "half-elf": "elf",
  "half-orc": "orc",
  "human-innistrad": "human",
  "human-ixalan": "human",
  "human-kaladesh": "human",
  "human-zendikar": "human",
  khoravar: "elf",
  "lorwyn-changeling": "changeling",
  "minotaur-amonkhet": "minotaur",
  "orc-ixalan": "orc",
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
