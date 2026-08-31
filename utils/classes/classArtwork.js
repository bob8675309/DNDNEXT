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

// Purpose-built class paintings that have been explicitly accepted for the Forge.
// Keeping the override here makes the approved Artificer composition the shared
// visual authority for its hero and catalogue portrait without changing the
// catalogue/guide component contracts.
const APPROVED_CLASS_ARTWORK = Object.freeze({
  artificer: "/media/classes/artificer-approved.webp",
});

// Core classes keep their dedicated class paintings. Special/non-core catalogue
// entries use distinct paintings that already exist in the repository so no two
// selectable classes intentionally share the same portrait. These can later be
// replaced by purpose-built class paintings without changing the catalogue API.
const SPECIAL_CLASS_ARTWORK = Object.freeze({
  civilian: "/media/species/human.webp",
  "monster-hunter": "/media/species/human-innistrad.webp",
  mystic: "/media/species/kalashtar.webp",
  "expert-sidekick": "/media/species/changeling.webp",
  "warrior-sidekick": "/media/species/human-zendikar.webp",
  "spellcaster-sidekick": "/media/species/half-elf.webp",
  sidekick: "/media/species/human-kaladesh.webp",
});

export function classArtworkFor(classKey = "") {
  const normalized = String(classKey || "").trim().toLowerCase();
  if (APPROVED_CLASS_ARTWORK[normalized]) return APPROVED_CLASS_ARTWORK[normalized];
  if (SPECIAL_CLASS_ARTWORK[normalized]) return SPECIAL_CLASS_ARTWORK[normalized];
  return CLASS_ARTWORK.has(normalized)
    ? `/media/classes/${normalized}.webp`
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