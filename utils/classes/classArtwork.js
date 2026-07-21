const CLASS_ARTWORK = new Set([
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

export function classArtworkFor(classKey = "") {
  const normalized = String(classKey || "").trim().toLowerCase();
  return CLASS_ARTWORK.has(normalized)
    ? `/media/classes/${normalized}.webp`
    : "/media/classes/adventurer.webp";
}
