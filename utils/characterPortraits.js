export const NPC_PORTRAIT_BUCKET = "npc-portraits";
export const NPC_PORTRAIT_RECOMMENDED_SIZE = "1536×2048 px";
export const NPC_PORTRAIT_MINIMUM_SIZE = "768×1024 px";
export const NPC_PORTRAIT_ASPECT_RATIO = "3:4";

const PROFESSION_DEFAULT_URLS = Object.freeze({
  smithing: "/parchment.jpg",
  alchemy: "/parchment.jpg",
  enchanting: "/parchment3.jpg",
  scribe: "/parchment3.jpg",
});

const GENERIC_DEFAULT_URLS = Object.freeze({
  merchant: "/parchment3.jpg",
  npc: "/parchment3.jpg",
});

export function publicPortraitUrl(supabase, storagePath, bucket = NPC_PORTRAIT_BUCKET) {
  if (!storagePath) return "";
  if (!supabase?.storage?.from) return "";
  try {
    return supabase.storage.from(bucket).getPublicUrl(storagePath).data?.publicUrl || "";
  } catch {
    return "";
  }
}

function sheetPortrait(character = {}) {
  const sheet = character.character_sheet || character.sheet || {};
  const portrait = sheet?.portrait && typeof sheet.portrait === "object" ? sheet.portrait : {};
  return portrait;
}

export function offeredProfessionKey(character = {}) {
  const sheet = character.character_sheet || character.sheet || {};
  const professions = sheet?.professions && typeof sheet.professions === "object" ? sheet.professions : {};
  for (const key of ["smithing", "alchemy", "enchanting", "scribe"]) {
    const entry = professions[key] || {};
    if (Number(entry.rank || 0) > 0 && Boolean(entry.offersService || entry.offers_service)) return key;
  }
  const tags = Array.isArray(character.tags) ? character.tags.map((tag) => String(tag).toLowerCase()) : [];
  if (tags.includes("blacksmith") || tags.includes("smith")) return "smithing";
  if (tags.includes("alchemist") || tags.includes("alchemy")) return "alchemy";
  if (tags.includes("enchanter") || tags.includes("enchanting")) return "enchanting";
  if (tags.includes("scribe")) return "scribe";
  return "";
}

export function defaultPortraitUrlForCharacter(character = {}) {
  const profession = offeredProfessionKey(character);
  if (profession && PROFESSION_DEFAULT_URLS[profession]) return PROFESSION_DEFAULT_URLS[profession];
  if (String(character.kind || "").toLowerCase() === "merchant") return GENERIC_DEFAULT_URLS.merchant;
  return GENERIC_DEFAULT_URLS.npc;
}

// Retained as a compatibility export for callers that only understand storage-backed
// portraits. Raster fallbacks are local URLs and intentionally have no fake storage path.
export function defaultPortraitPathForCharacter() {
  return "";
}

export function resolveCharacterPortrait(character = {}, supabase, options = {}) {
  const portrait = sheetPortrait(character);
  const directUrl =
    character.portrait_shop_url ||
    portrait.shopUrl ||
    portrait.shop_url ||
    character.portrait_url ||
    portrait.url ||
    character.image_url ||
    character.bg_image_url ||
    character.storefront_bg_image_url ||
    "";
  if (directUrl) {
    return { url: directUrl, source: character.portrait_source || portrait.source || "direct", storagePath: character.portrait_storage_path || portrait.storagePath || "" };
  }

  const storagePath = character.portrait_storage_path || portrait.storagePath || portrait.storage_path || "";
  const storageUrl = publicPortraitUrl(supabase, storagePath);
  if (storageUrl) return { url: storageUrl, source: character.portrait_source || portrait.source || "storage", storagePath };

  if (options.includeDefault === false) return { url: "", source: "none", storagePath: "" };
  return {
    url: defaultPortraitUrlForCharacter(character) || options.fallbackUrl || "",
    source: "default",
    storagePath: "",
  };
}

export function slugifyPortraitName(value = "portrait") {
  return String(value || "portrait")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "portrait";
}
