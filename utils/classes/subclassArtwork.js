import { classMenuArtworkFor } from "./classArtwork";

const text = (value) => String(value ?? "").trim();
const key = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const APPROVED_SUBCLASS_ART_FAMILIES = Object.freeze({
  artificer: Object.freeze({
    alchemist: "alchemist",
    armorer: "armorer",
    artillerist: "artillerist",
    "battle-smith": "battle-smith",
    cartographer: "cartographer",
    reanimator: "reanimator",
  }),
  barbarian: Object.freeze({
    berserker: "berserker",
    "wild-heart": "wild-heart",
    "world-tree": "world-tree",
    zealot: "zealot",
  }),
  bard: Object.freeze({
    dance: "dance",
    glamour: "glamour",
    lore: "lore",
    moon: "moon",
    spirits: "spirits",
    valor: "valor",
  }),
  cleric: Object.freeze({
    ambition: "ambition",
    "ambition-psa": "ambition",
    arcana: "arcana",
    death: "death",
    forge: "forge",
    grave: "grave",
    knowledge: "knowledge",
    "knowledge-psa": "knowledge",
    life: "life",
    light: "light",
    nature: "nature",
    order: "order",
    peace: "peace",
    "solidarity-psa": "solidarity",
    "strength-psa": "strength",
    tempest: "tempest",
    trickery: "trickery",
    twilight: "twilight",
    war: "war",
    "zeal-psa": "zeal",
  }),
  druid: Object.freeze({
    dreams: "dreams",
    land: "land",
    moon: "moon",
    sea: "sea",
    shepherd: "shepherd",
    spores: "spores",
    stars: "stars",
    wildfire: "wildfire",
  }),
  fighter: Object.freeze({
    banneret: "banneret",
    "battle-master": "battle-master",
    champion: "champion",
    "eldritch-knight": "eldritch-knight",
  }),
  monk: Object.freeze({
    elements: "elements",
    mercy: "mercy",
    "open-hand": "open-hand",
    shadow: "shadow",
  }),
  "monster-hunter": Object.freeze({
    "carver-guild": "carver-guild",
    "devourer-guild": "devourer-guild",
    "occultist-guild": "occultist-guild",
    "trapper-guild": "trapper-guild",
  }),
});

function approvedSubclassArtworkFor(normalizedClass = "", normalizedSubclass = "") {
  const family = APPROVED_SUBCLASS_ART_FAMILIES[normalizedClass]?.[normalizedSubclass];
  return family ? `/media/subclasses/${normalizedClass}/${normalizedClass}-${family}.webp` : "";
}

function fallbackSubclassArtworkFor(normalizedClass = "") {
  return classMenuArtworkFor(normalizedClass);
}

// Only Paul-approved normalized tarot cards are mapped here. Subclasses still in
// production continue to use the class-menu artwork fallback until individually
// approved, installed, and added to this resolver.
export function subclassArtworkFor(classKey = "", option = {}) {
  const normalizedClass = key(classKey);
  const normalizedSubclass = key(option?.name || option?.key);
  return approvedSubclassArtworkFor(normalizedClass, normalizedSubclass)
    || fallbackSubclassArtworkFor(normalizedClass);
}

export function handleSubclassArtworkError(event, classKey = "") {
  const image = event?.currentTarget;
  if (!image) return;
  if (image.dataset.subclassFallbackApplied === "true") {
    image.hidden = true;
    return;
  }
  image.dataset.subclassFallbackApplied = "true";
  image.src = fallbackSubclassArtworkFor(key(classKey));
}
