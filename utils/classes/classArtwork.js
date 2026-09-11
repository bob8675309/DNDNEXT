import artificerHero from "../forgeGeneratedArt/artificerHero.js";
import barbarianHero from "../forgeGeneratedArt/barbarianHero.js";
import artificerMenu from "../forgeGeneratedArt/artificerMenu.js";
import barbarianMenu from "../forgeGeneratedArt/barbarianMenu.js";

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

const APPROVED_CLASS_ARTWORK = Object.freeze({
  artificer: "/media/classes/artificer-approved.webp",
});

/*
 * Public cinematic hero/menu maps are intentionally separate. New Class artwork is
 * promoted here only after browser approval and binary validation. Hero images are
 * composed for the full-height right-side Class presentation; menu images are compact
 * catalogue portraits and must not be destructive crops of the hero asset.
 */
const PUBLIC_CINEMATIC_CLASS_HERO_ARTWORK = Object.freeze({
  civilian: "/media/classes/cinematic-civilian.webp",
  artificer: "/media/classes/cinematic-artificer.webp",
  barbarian: "/media/classes/cinematic-barbarian.webp",
  bard: "/media/classes/cinematic-bard.webp",
  cleric: "/media/classes/cinematic-cleric.webp",
  druid: "/media/classes/cinematic-druid.webp",
  fighter: "/media/classes/cinematic-fighter.webp",
  monk: "/media/classes/cinematic-monk.webp",
  paladin: "/media/classes/cinematic-paladin.webp",
  ranger: "/media/classes/cinematic-ranger.webp",
  rogue: "/media/classes/cinematic-rogue.webp",
  sorcerer: "/media/classes/cinematic-sorcerer.webp",
  warlock: "/media/classes/cinematic-warlock.webp",
  wizard: "/media/classes/cinematic-wizard.webp",
  mystic: "/media/classes/cinematic-mystic.webp",
  "monster-hunter": "/media/classes/cinematic-monster-hunter.webp",
  "expert-sidekick": "/media/classes/cinematic-sidekick.webp",
  "warrior-sidekick": "/media/classes/cinematic-sidekick.webp",
  "spellcaster-sidekick": "/media/classes/cinematic-sidekick.webp",
  sidekick: "/media/classes/cinematic-sidekick.webp",
});
const PUBLIC_CINEMATIC_CLASS_MENU_ARTWORK = Object.freeze({
  civilian: "/media/classes/menu-civilian.webp",
  artificer: "/media/classes/menu-artificer.webp",
  barbarian: "/media/classes/menu-barbarian.webp",
  bard: "/media/classes/menu-bard.webp",
  cleric: "/media/classes/menu-cleric.webp",
  druid: "/media/classes/menu-druid.webp",
  fighter: "/media/classes/menu-fighter.webp",
  monk: "/media/classes/menu-monk.webp",
  paladin: "/media/classes/menu-paladin.webp",
  ranger: "/media/classes/menu-ranger.webp",
  rogue: "/media/classes/menu-rogue.webp",
  sorcerer: "/media/classes/menu-sorcerer.webp",
  warlock: "/media/classes/menu-warlock.webp",
  wizard: "/media/classes/menu-wizard.webp",
  mystic: "/media/classes/menu-mystic.webp",
  "monster-hunter": "/media/classes/menu-monster-hunter.webp",
  "expert-sidekick": "/media/classes/menu-sidekick.webp",
  "warrior-sidekick": "/media/classes/menu-sidekick.webp",
  "spellcaster-sidekick": "/media/classes/menu-sidekick.webp",
  sidekick: "/media/classes/menu-sidekick.webp",
});

const GENERATED_CINEMATIC_CLASS_HERO_ARTWORK = Object.freeze({
  artificer: artificerHero,
  barbarian: barbarianHero,
});

const GENERATED_CINEMATIC_CLASS_MENU_ARTWORK = Object.freeze({
  artificer: artificerMenu,
  barbarian: barbarianMenu,
});

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
  return PUBLIC_CINEMATIC_CLASS_HERO_ARTWORK[normalized]
    || GENERATED_CINEMATIC_CLASS_HERO_ARTWORK[normalized]
    || fallbackClassArtwork(normalized);
}

export function classMenuArtworkFor(classKey = "") {
  const normalized = normalizedClassKey(classKey);
  return PUBLIC_CINEMATIC_CLASS_MENU_ARTWORK[normalized]
    || GENERATED_CINEMATIC_CLASS_MENU_ARTWORK[normalized]
    || fallbackClassArtwork(normalized);
}

export function classHasPublicCinematicHero(classKey = "") {
  return Boolean(PUBLIC_CINEMATIC_CLASS_HERO_ARTWORK[normalizedClassKey(classKey)]);
}

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
