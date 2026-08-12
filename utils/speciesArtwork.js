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

// These entries intentionally use the repository's existing source-family art
// as their base image, but receive a child-specific query key. The Forge CSS
// uses that key for a distinct crop/tone treatment, giving each catalogue child
// its own portrait presentation without inventing false source-art provenance.
const SPECIES_VARIANT_PORTRAITS = Object.freeze({
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
  "hawk-headed-aven": "aven",
  "ibis-headed-aven": "aven",
  drow: "elf",
  "high-elf": "elf",
  "wood-elf": "elf",
  "forest-gnome": "gnome",
  "rock-gnome": "gnome",
  "beasthide-shifter": "shifter",
  "longtooth-shifter": "shifter",
  "swiftstride-shifter": "shifter",
  "wildhunt-shifter": "shifter",
  "lorwyn-fairy": "fairy",
  "shadowmoor-fairy": "fairy",
  "lorwyn-kithkin": "kithkin",
  "shadowmoor-kithkin": "kithkin",
  "dwarf-kaladesh": "dwarf",
  "goblin-dankwood": "goblin",
  "orc-ixalan": "orc",
});

const SPECIES_ARTWORK_ALIASES = {
  faerie: "fairy",
  githyanki: "gith",
  githzerai: "gith",
  "gnome-deep": "deep-gnome",
  "half-orc": "orc",
  "lorwyn-changeling": "changeling",
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
  if (SPECIES_ARTWORK.has(key)) return `/media/species/${key}.webp`;
  const portraitBase = SPECIES_VARIANT_PORTRAITS[key];
  if (portraitBase) return `/media/species/${portraitBase}.webp?portrait=${encodeURIComponent(key)}`;
  const artworkKey = SPECIES_ARTWORK_ALIASES[key];
  return artworkKey ? `/media/species/${artworkKey}.webp` : "/media/species/adventurer.webp";
}

export function hasDedicatedSpeciesArtwork(species = "") {
  const key = normalizeSpeciesArtworkKey(species);
  return SPECIES_ARTWORK.has(key) || Boolean(SPECIES_VARIANT_PORTRAITS[key]) || Boolean(SPECIES_ARTWORK_ALIASES[key]);
}

export function isSpeciesVariantPortrait(species = "") {
  return Boolean(SPECIES_VARIANT_PORTRAITS[normalizeSpeciesArtworkKey(species)]);
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
