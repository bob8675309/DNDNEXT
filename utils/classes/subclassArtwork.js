import { classMenuArtworkFor } from "./classArtwork";

const text = (value) => String(value ?? "").trim();
const key = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const WIZARD_SUBCLASS_ART_FAMILY = Object.freeze({
  abjuration: "abjuration",
  abjurer: "abjuration",
  bladesinger: "abjuration",
  bladesinging: "abjuration",
  conjuration: "conjuration",
  divination: "divination",
  diviner: "divination",
  chronurgy: "divination",
  scribes: "divination",
  enchantment: "enchantment",
  evocation: "evocation",
  evoker: "evocation",
  war: "evocation",
  illusion: "illusion",
  illusionist: "illusion",
  necromancy: "necromancy",
  transmutation: "transmutation",
  graviturgy: "transmutation",
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
