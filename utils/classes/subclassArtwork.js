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

export function subclassArtworkFor(classKey = "", option = {}) {
  const normalizedClass = key(classKey);
  const normalizedSubclass = key(option?.name || option?.key);
  if (normalizedClass === "wizard") {
    const family = WIZARD_SUBCLASS_ART_FAMILY[normalizedSubclass];
    if (family) return `/media/subclasses/wizard/wizard-${family}.webp`;
  }
  return classMenuArtworkFor(normalizedClass);
}

export function handleSubclassArtworkError(event, classKey = "") {
  const image = event?.currentTarget;
  if (!image) return;
  if (image.dataset.subclassFallbackApplied === "true") {
    image.hidden = true;
    return;
  }
  image.dataset.subclassFallbackApplied = "true";
  image.src = classMenuArtworkFor(key(classKey));
}
