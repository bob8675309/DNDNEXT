import { classMenuArtworkFor } from "./classArtwork";

const text = (value) => String(value ?? "").trim();
const key = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function fallbackSubclassArtworkFor(normalizedClass = "") {
  return classMenuArtworkFor(normalizedClass);
}

// Tarot subclass artwork was intentionally reset on 2026-09-12 so the deck can be
// rebuilt against one canonical card standard. Until a newly approved card is
// explicitly wired here, the gallery uses the existing class-menu artwork fallback.
export function subclassArtworkFor(classKey = "", option = {}) {
  void option;
  return fallbackSubclassArtworkFor(key(classKey));
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
