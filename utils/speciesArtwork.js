const SPECIES_ARTWORK = new Set([
  "aarakocra",
  "aasimar",
  "aetherborn",
  "astral-elf",
  "autognome",
  "aven",
  "bugbear",
  "changeling",
  "dragonborn",
  "dwarf",
  "elf",
  "gnome",
  "goliath",
  "halfling",
  "harengon",
  "human",
  "orc",
  "tiefling",
  "warforged",
]);

// Source-book variants share the same ancestry reference until they receive a
// distinct illustration. This is intentionally preferable to showing the
// unrelated neutral adventurer for an otherwise recognisable species family.
const SPECIES_ARTWORK_ALIASES = {
  "deep-gnome": "gnome",
  "dragonborn-chromatic": "dragonborn",
  "dragonborn-gem": "dragonborn",
  "dragonborn-metallic": "dragonborn",
  "dwarf-kaladesh": "dwarf",
  duergar: "dwarf",
  eladrin: "elf",
  "elf-kaladesh": "elf",
  "elf-zendikar": "elf",
  "gnome-deep": "gnome",
  "half-elf": "elf",
  "half-orc": "orc",
  "human-innistrad": "human",
  "human-ixalan": "human",
  "human-kaladesh": "human",
  "human-zendikar": "human",
  khoravar: "elf",
  "orc-ixalan": "orc",
  "sea-elf": "elf",
  "shadar-kai": "elf",
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
