import { supabase } from "./supabaseClient";
import { themeFromMerchant } from "./merchantTheme";

function safe(value) {
  return String(value || "").trim();
}

function asMerchantRecord(value) {
  return value && typeof value === "object" ? value : {};
}

function storagePortraitUrl(path) {
  const key = safe(path);
  if (!key) return "";
  try {
    return supabase.storage.from("npc-portraits").getPublicUrl(key).data?.publicUrl || "";
  } catch {
    return "";
  }
}

// Legacy theme-image paths were never backed by committed assets. Keep the
// resolver explicit-only so missing merchant art falls through to the shared
// themed neutral backdrop instead of producing a broken/black image surface.
const THEME_BACKDROPS = Object.freeze({});

export function resolveMerchantPortrait(merchant = {}) {
  const record = asMerchantRecord(merchant);
  return safe(
    record.portrait_thumb_url
    || record.portrait_shop_url
    || record.portrait_url
    || record.image_url
    || storagePortraitUrl(record.portrait_storage_path)
  );
}

export function merchantInitials(merchant = {}) {
  const record = asMerchantRecord(merchant);
  const parts = safe(record.name || record.storefront_title || "Merchant")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "M";
}

export function resolveMerchantStorefrontMedia(merchant = {}) {
  const record = asMerchantRecord(merchant);
  const theme = themeFromMerchant(record);
  const explicitVideoUrl = safe(
    record.storefront_bg_video_url
    || record.bg_video_url
    || record.bgVideoUrl
  );
  const explicitImageUrl = safe(
    record.storefront_bg_image_url
    || record.storefront_bg_url
    || record.portrait_shop_url
    || record.bg_image_url
    || record.bg_url
    || record.bgImageUrl
    || record.bgUrl
    || record.portrait_url
    || record.image_url
    || storagePortraitUrl(record.portrait_storage_path)
  );
  const themeImageUrl = explicitImageUrl ? "" : safe(THEME_BACKDROPS[theme]);

  return {
    videoUrl: explicitVideoUrl,
    imageUrl: explicitImageUrl || themeImageUrl,
    hasDedicatedImage: Boolean(explicitImageUrl),
    hasDedicatedVideo: Boolean(explicitVideoUrl),
    isThemeFallback: Boolean(!explicitImageUrl && themeImageUrl),
    theme,
  };
}

export function merchantShopLabel(merchant = {}) {
  const record = asMerchantRecord(merchant);
  return safe(record.storefront_title || record.role || "Merchant");
}

export function merchantTagline(merchant = {}) {
  return safe(asMerchantRecord(merchant).storefront_tagline);
}
