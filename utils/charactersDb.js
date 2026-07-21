import { fromTable } from "./dbTables";

// These helpers assume you pass an already-configured Supabase client.

export async function listMapIcons(supabase) {
  const { data, error } = await fromTable(supabase, "mapIcons")
    .select("code,label,glyph,category,sort,is_active")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("sort", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchCharacterRoster(supabase, {
  search = "",
  types = [],
  statuses = [],
} = {}) {
  let q = fromTable(supabase, "characterRoster").select("*");
  if (search) q = q.ilike("name", `%${search}%`);
  if (types.length) q = q.in("character_type", types);
  if (statuses.length) q = q.in("status", statuses);
  const { data, error } = await q.order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchCharacterById(supabase, characterId) {
  const { data, error } = await fromTable(supabase, "characters")
    .select([
      "id", "name", "race", "role", "description", "motivation", "quirk",
      "mannerism", "voice", "affiliation", "status", "background", "tags",
      "kind", "storefront_enabled", "map_icon_id", "x", "y", "location_id",
      "last_known_location_id", "projected_destination_id", "roaming_speed",
      "is_hidden", "state", "rest_until", "route_id", "route_point_seq",
      "prev_point_seq", "route_segment_progress", "last_moved_at", "route_mode",
      "current_point_seq", "next_point_seq", "segment_started_at", "segment_ends_at",
      "storefront_title", "storefront_tagline", "storefront_bg_url",
      "storefront_bg_video_url", "storefront_bg_image_url", "updated_at",
      "home_location_id", "sprite_key", "map_scale", "sprite_path", "sprite_scale",
      "move_speed_units_per_hour", "dwell_hours", "dwell_started_at", "dwell_ends_at",
      "next_action_at", "tick_jitter_seconds", "paused_state",
      "paused_remaining_seconds", "camp_reason", "camp_started_at", "camp_sprite_path",
      "portrait_url", "portrait_storage_path", "portrait_thumb_url", "portrait_shop_url",
      "portrait_source", "portrait_prompt", "image_url",
    ].join(","))
    .eq("id", characterId)
    .single();
  if (error) throw error;
  return data;
}

export async function setCharacterIcon(supabase, characterId, iconCode) {
  const { error } = await fromTable(supabase, "characters")
    .update({ icon_code: iconCode })
    .eq("id", characterId);
  if (error) throw error;
}

export async function setStoreEnabled(supabase, characterId, enabled) {
  const { error } = await supabase.rpc("set_character_store_enabled", {
    p_character_id: characterId,
    p_enabled: enabled,
  });
  if (error) throw error;
}

export async function convertCharacterType(supabase, characterId, targetType) {
  // targetType: "npc" | "merchant"
  const { error } = await supabase.rpc("convert_character_type", {
    p_character_id: characterId,
    p_target_type: targetType,
  });
  if (error) throw error;
}

export async function fetchStorefront(supabase, characterId) {
  const { data, error } = await fromTable(supabase, "characterStore")
    .select("*")
    .eq("character_id", characterId)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchStoreStock(supabase, characterId) {
  const { data, error } = await fromTable(supabase, "storeStock")
    .select("id,item_name,quantity,price_cp,card_payload,created_at")
    .eq("character_id", characterId)
    // characters table uses updated_at (no created_at)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
