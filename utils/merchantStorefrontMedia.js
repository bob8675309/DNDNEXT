import { supabase } from "./supabaseClient";
import { themeFromMerchant } from "./merchantTheme";

function safe(value) {
  return String(value || "").trim();
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

const THEME_BACKDROPS = Object.freeze({
  smith: "/merchant-backgrounds/smith.jpg",
  weapons: "/merchant-backgrounds/smith.jpg",
  alchemy: "/merchant-backgrounds/alchemist.jpg",
  herbalist: "/merchant-backgrounds/alchemist.jpg",
  arcanist: "/merchant-backgrounds/arcane.jpg",
  jeweler: "/merchant-backgrounds/jeweler.jpg",
});

export function resolveMerchantPortrait(merchant = {}) {
  return safe(
    merchant.portrait_thumb_url
    || merchant.portrait_shop_url
    || merchant.portrait_url
    || merchant.image_url
    || storagePortraitUrl(merchant.portrait_storage_path)
  );
}

export function merchantInitials(merchant = {}) {
  const parts = safe(merchant.name || merchant.storefront_title || "Merchant")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "M";
}

export function resolveMerchantStorefrontMedia(merchant = {}) {
  const theme = themeFromMerchant(merchant);
  const explicitVideoUrl = safe(
    merchant.storefront_bg_video_url
    || merchant.bg_video_url
    || merchant.bgVideoUrl
  );
  const explicitImageUrl = safe(
    merchant.storefront_bg_image_url
    || merchant.storefront_bg_url
    || merchant.portrait_shop_url
    || merchant.bg_image_url
    || merchant.bg_url
    || merchant.bgImageUrl
    || merchant.bgUrl
    || merchant.portrait_url
    || merchant.image_url
    || storagePortraitUrl(merchant.portrait_storage_path)
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
  return safe(merchant.storefront_title || merchant.role || "Merchant");
}

export function merchantTagline(merchant = {}) {
  return safe(merchant.storefront_tagline);
}
