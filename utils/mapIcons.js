// /utils/mapIcons.js
import { supabase } from "./supabaseClient";

export const MAP_ICONS_BUCKET = "map-icons";
export const LOCAL_FALLBACK_ICON = "/map-icons/fallback/camel_trader.png";

function safeJson(meta) {
  if (!meta) return null;
  if (typeof meta === "object") return meta;
  if (typeof meta === "string") {
    try { return JSON.parse(meta); } catch { return null; }
  }
  return null;
}

export function publicIconUrl(storagePath, bucket = MAP_ICONS_BUCKET) {
  if (!storagePath) return null;
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

/**
 * Normalize a map_icons row into a display model.
 *
 * Supports both:
 *  - image icons (storage_path)
 *  - emoji icons (metadata.type='emoji')
 */
export function mapIconDisplay(iconRow, opts = {}) {
  const bucket = opts.bucket || MAP_ICONS_BUCKET;
  const fallbackSrc = opts.fallbackSrc || LOCAL_FALLBACK_ICON;

  const meta = safeJson(iconRow?.metadata);

  if (meta?.type === "emoji" && meta?.emoji) {
    return { type: "emoji", emoji: String(meta.emoji), name: iconRow?.name || "" };
  }

  const sp = iconRow?.storage_path;
  if (sp) {
    return {
      type: "image",
      src: publicIconUrl(sp, bucket) || fallbackSrc,
      name: iconRow?.name || "",
      storage_path: sp,
    };
  }

  return { type: "image", src: fallbackSrc, name: iconRow?.name || "" };
}

export function iconLabel(iconRow) {
  if (!iconRow) return "";
  const meta = safeJson(iconRow?.metadata);
  if (meta?.type === "emoji" && meta?.theme) return String(meta.theme);
  return String(iconRow.name || "");
}
