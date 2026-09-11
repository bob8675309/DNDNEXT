import { classMenuArtworkFor } from "./classArtwork";

const text = (value) => String(value ?? "").trim();
const key = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const WIZARD_SUBCLASS_ART_FAMILY = Object.freeze({
  abjuration: "abjuration",
  abjurer: "abjurer",
  bladesinger: "bladesinger",
  bladesinging: "bladesinging",
  chronurgy: "chronurgy",
  conjuration: "conjuration",
  divination: "divination",
  diviner: "diviner",
  enchantment: "enchantment",
  evocation: "evocation",
  evoker: "evoker",
  graviturgy: "graviturgy",
  illusion: "illusion",
  illusionist: "illusionist",
  necromancy: "necromancy",
  scribes: "scribes",
  transmutation: "transmutation",
  war: "war",
});

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
    "ancestral-guardian": "ancestral-guardian",
    berserker: "berserker",
    giant: "giant",
    "totem-warrior": "totem-warrior",
    "wild-magic": "wild-magic",
    "wild-heart": "wild-heart",
    "world-tree": "world-tree",
    zealot: "zealot",
  }),
  bard: Object.freeze({
    creation: "creation",
    dance: "dance",
    glamour: "glamour",
    lore: "lore",
    moon: "moon",
    spirits: "spirits",
    swords: "swords",
    valor: "valor",
    whispers: "whispers",
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
    tempest: "tempest",
    trickery: "trickery",
    war: "war",
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
    "arcane-archer": "arcane-archer",
    banneret: "banneret",
    "purple-dragon-knight-banneret": "banneret",
    "battle-master": "battle-master",
    cavalier: "cavalier",
    champion: "champion",
    "echo-knight": "echo-knight",
    "eldritch-knight": "eldritch-knight",
    "psi-warrior": "psi-warrior",
  }),
  monk: Object.freeze({
    "astral-self": "astral-self",
    "drunken-master": "drunken-master",
    elements: "elements",
    "four-elements": "elements",
    kensei: "kensei",
    mercy: "mercy",
    "open-hand": "open-hand",
    shadow: "shadow",
  }),
  "monster-hunter": Object.freeze({
    carver: "carver",
    "carver-guild": "carver",
    devourer: "devourer",
    "devourer-guild": "devourer",
    occultist: "occultist",
    "occultist-guild": "occultist",
    trapper: "trapper",
    "trapper-guild": "trapper",
  }),
  mystic: Object.freeze({
    avatar: "avatar",
    awakened: "awakened",
    immortal: "immortal",
    nomad: "nomad",
    "soul-knife": "soul-knife",
    "wu-jen": "wu-jen",
  }),
  paladin: Object.freeze({
    ancients: "ancients",
    conquest: "conquest",
    crown: "crown",
    devotion: "devotion",
    glory: "glory",
    "noble-genies": "noble-genies",
    vengeance: "vengeance",
  }),
  ranger: Object.freeze({
    "beast-master": "beast-master",
    drakewarden: "drakewarden",
    "fey-wanderer": "fey-wanderer",
    "gloom-stalker": "gloom-stalker",
    "hollow-warden": "hollow-warden",
    "horizon-walker": "horizon-walker",
    hunter: "hunter",
    "winter-walker": "winter-walker",
  }),
  rogue: Object.freeze({
    "arcane-trickster": "arcane-trickster",
    assassin: "assassin",
    phantom: "phantom",
    "scion-of-the-three": "scion-of-the-three",
    soulknife: "soulknife",
    swashbuckler: "swashbuckler",
    thief: "thief",
  }),
  sorcerer: Object.freeze({
    aberrant: "aberrant",
    "aberrant-mind": "aberrant",
    clockwork: "clockwork",
    "clockwork-soul": "clockwork",
    "divine-soul": "divine-soul",
    draconic: "draconic",
    lunar: "lunar",
    pyromancer: "pyromancer",
    "pyromancer-psk": "pyromancer",
    shadow: "shadow",
    spellfire: "spellfire",
    storm: "storm",
    wild: "wild-magic",
    "wild-magic": "wild-magic",
  }),
  warlock: Object.freeze({
    archfey: "archfey",
    celestial: "celestial",
    fathomless: "fathomless",
    fiend: "fiend",
    genie: "genie",
    "great-old-one": "great-old-one",
    hexblade: "hexblade",
    undead: "undead",
    undying: "undying",
  }),
});

function approvedSubclassArtworkFor(normalizedClass = "", normalizedSubclass = "") {
  const family = APPROVED_SUBCLASS_ART_FAMILIES[normalizedClass]?.[normalizedSubclass];
  return family ? `/media/subclasses/${normalizedClass}/${normalizedClass}-${family}.webp` : "";
}

function fallbackSubclassArtworkFor(normalizedClass = "") {
  return classMenuArtworkFor(normalizedClass);
}

export function subclassArtworkFor(classKey = "", option = {}) {
  const normalizedClass = key(classKey);
  const normalizedSubclass = key(option?.name || option?.key);
  if (normalizedClass === "wizard") {
    const family = WIZARD_SUBCLASS_ART_FAMILY[normalizedSubclass];
    if (family) return `/media/subclasses/wizard/wizard-${family}.webp`;
  }
  return approvedSubclassArtworkFor(normalizedClass, normalizedSubclass)
    || classMenuArtworkFor(normalizedClass);
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
