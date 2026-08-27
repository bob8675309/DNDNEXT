const CLASS_ARTWORK = new Set([
  "adventurer",
  "artificer",
  "barbarian",
  "bard",
  "cleric",
  "druid",
  "fighter",
  "monk",
  "paladin",
  "ranger",
  "rogue",
  "sorcerer",
  "warlock",
  "wizard",
]);

// These classes do not yet have dedicated paintings in the repository. Give each
// a deliberate visual identity using an existing class composition instead of
// allowing every unsupported class to collapse to the same adventurer fallback.
const CLASS_ARTWORK_ALIASES = Object.freeze({
  civilian: "adventurer",
  "monster-hunter": "ranger",
  mystic: "sorcerer",
  "expert-sidekick": "rogue",
  "warrior-sidekick": "fighter",
  "spellcaster-sidekick": "wizard",
  sidekick: "adventurer",
});

export function classArtworkFor(classKey = "") {
  const normalized = String(classKey || "").trim().toLowerCase();
  const artworkKey = CLASS_ARTWORK_ALIASES[normalized] || normalized;
  return CLASS_ARTWORK.has(artworkKey)
    ? `/media/classes/${artworkKey}.webp`
    : "/media/classes/adventurer.webp";
}

export function handleClassArtworkError(event) {
  const image = event?.currentTarget;
  if (!image) return;
  if (image.dataset.fallbackApplied === "true") {
    image.hidden = true;
    return;
  }
  image.dataset.fallbackApplied = "true";
  image.src = "/media/classes/adventurer.webp";
}
