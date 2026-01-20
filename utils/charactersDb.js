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
    .select("*")
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
