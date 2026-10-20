import { formatPlayerFacingText } from "./playerFacingText.js";

const clean = (value) => String(value ?? "").trim();

export function isGrimHollowHeritageSpecies(species = null) {
  return clean(species?.source).toUpperCase() === "GRIMHOLLOWPG24"
    && Boolean(species?.metadata?.heritageOnly);
}

export function grimHollowLorePresentation(lore = "") {
  const full = formatPlayerFacingText(lore).replace(/\n{3,}/g, "\n\n").trim();
  if (!full) return { preview: "", full: "", hasMore: false };
  const sentences = full.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+(?:[”"']|$)?|[^.!?]+$/g) || [];
  const preview = sentences.slice(0, 2).join(" ").trim();
  const compact = preview && preview.length <= 440 ? preview : full.slice(0, 360).replace(/\s+\S*$/, "").trim() + "…";
  return { preview: compact, full, hasMore: full.replace(/\s+/g, " ").length > compact.length + 10 };
}

export function heritageChoiceGroupForSpecies(species = null, registeredGroups = [], buildGroups = null) {
  if (!isGrimHollowHeritageSpecies(species)) return null;
  const registered = (registeredGroups || []).find((group) => group?.metadata?.heritageTraitGroup
    && (String(group.ownerKey || "") === String(species?.id || "")
      || group.source === species?.source && String(group.label || "") === "Heritage Traits"));
  if (registered) return registered;
  if (typeof buildGroups !== "function") return null;
  return (buildGroups({ species }) || []).find((group) => group?.metadata?.heritageTraitGroup) || null;
}

export function traditionalHeritageLabels(species = {}) {
  return (Array.isArray(species?.metadata?.traditionalHeritageSelections)
    ? species.metadata.traditionalHeritageSelections : [])
    .map((entry) => clean(entry?.name))
    .filter(Boolean);
}
