import { supabase } from "./supabaseClient";

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

export function resolveMerchantPortrait(merchant = {}) {
  return safe(
    merchant.portrait_thumb_url
    || merchant.portrait_shop_url
    || merchant.portrait_url
    || merchant.image_url
    || storagePortraitUrl(merchant.portrait_storage_path)
    || "/images/merchants/default.jpg"
  );
}

export function resolveMerchantStorefrontMedia(merchant = {}) {
  const videoUrl = safe(
    merchant.storefront_bg_video_url
    || merchant.bg_video_url
    || merchant.bgVideoUrl
  );
  const imageUrl = safe(
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
    || "/parchment.jpg"
  );
  return { videoUrl, imageUrl };
}

export function merchantShopLabel(merchant = {}) {
  return safe(merchant.storefront_title || merchant.role || "Merchant");
}

export function merchantTagline(merchant = {}) {
  return safe(merchant.storefront_tagline || merchant.description || "");
}
