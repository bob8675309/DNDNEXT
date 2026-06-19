export const NPC_PORTRAIT_BUCKET = "npc-portraits";
export const NPC_PORTRAIT_RECOMMENDED_SIZE = "1536×2048 px";
export const NPC_PORTRAIT_MINIMUM_SIZE = "768×1024 px";
export const NPC_PORTRAIT_ASPECT_RATIO = "3:4";

const PROFESSION_DEFAULT_PATHS = Object.freeze({
  smithing: "defaults/smithing.webp",
  alchemy: "defaults/alchemy.webp",
  enchanting: "defaults/enchanting.webp",
  scribe: "defaults/scribe.webp",
});

export function publicPortraitUrl(supabase, storagePath, bucket = NPC_PORTRAIT_BUCKET) {
  if (!storagePath || !supabase?.storage?.from) return "";
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

export function defaultPortraitPathForCharacter(character = {}) {
  const profession = offeredProfessionKey(character);
  if (profession && PROFESSION_DEFAULT_PATHS[profession]) return PROFESSION_DEFAULT_PATHS[profession];
  if (String(character.kind || "").toLowerCase() === "merchant") return "defaults/merchant.webp";
  return "defaults/npc.webp";
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
  const defaultPath = defaultPortraitPathForCharacter(character);
  const defaultUrl = publicPortraitUrl(supabase, defaultPath);
  return { url: defaultUrl || options.fallbackUrl || "", source: "default", storagePath: defaultPath };
}

export function slugifyPortraitName(value = "portrait") {
  return String(value || "portrait")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "portrait";
}
