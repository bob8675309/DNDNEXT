import artificerHero from "../forgeGeneratedArt/artificerHero";
import barbarianHero from "../forgeGeneratedArt/barbarianHero";
import artificerMenu from "../forgeGeneratedArt/artificerMenu";
import barbarianMenu from "../forgeGeneratedArt/barbarianMenu";

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

// Existing accepted repository painting remains as a stable fallback so older
// consumers and guards do not lose their established artwork authority.
const APPROVED_CLASS_ARTWORK = Object.freeze({
  artificer: "/media/classes/artificer-approved.webp",
});

// The cinematic Forge deliberately separates wide hero compositions from tight
// catalogue crops. A single image cannot serve both jobs without the stretching
// and poor thumbnail framing seen during browser review.
const CINEMATIC_CLASS_HERO_ARTWORK = Object.freeze({
  artificer: artificerHero,
  barbarian: barbarianHero,
});

const CINEMATIC_CLASS_MENU_ARTWORK = Object.freeze({
  artificer: artificerMenu,
  barbarian: barbarianMenu,
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

function normalizedClassKey(classKey = "") {
  return String(classKey || "").trim().toLowerCase();
}

function fallbackClassArtwork(normalized = "") {
  if (APPROVED_CLASS_ARTWORK[normalized]) return APPROVED_CLASS_ARTWORK[normalized];
  if (SPECIAL_CLASS_ARTWORK[normalized]) return SPECIAL_CLASS_ARTWORK[normalized];
  return CLASS_ARTWORK.has(normalized)
    ? `/media/classes/${normalized}.webp`
    : "/media/classes/adventurer.webp";
}

export function classHeroArtworkFor(classKey = "") {
  const normalized = normalizedClassKey(classKey);
  return CINEMATIC_CLASS_HERO_ARTWORK[normalized] || fallbackClassArtwork(normalized);
}

export function classMenuArtworkFor(classKey = "") {
  const normalized = normalizedClassKey(classKey);
  return CINEMATIC_CLASS_MENU_ARTWORK[normalized] || fallbackClassArtwork(normalized);
}

// Backward-compatible default authority for older non-Forge consumers. The Class
// catalogue and Class guide opt into their purpose-specific functions above.
export function classArtworkFor(classKey = "") {
  return fallbackClassArtwork(normalizedClassKey(classKey));
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
