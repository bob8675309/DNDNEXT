// Centralized table/view names for Supabase access.
// Later renames become one-file edits.

export const TABLES = {
  // New canonical tables/views
  characters: "characters",
  characterRoster: "v_character_roster",
  characterStore: "v_character_store",
  characterNotes: "v_character_notes",
  mapIcons: "map_icons",
  storefronts: "storefronts",
  storeStock: "store_stock",
  characterSheets: "character_sheets",
  characterPermissions: "character_permissions",
  legacyCharacterMap: "legacy_character_map",

  // Legacy tables (keep for rollback / reference)
  npcs: "npcs",
  npcSheets: "npc_sheets",
  npcNotes: "npc_notes",
  npcPermissions: "npc_permissions",
  merchants: "merchants",
  merchantProfiles: "merchant_profiles",
  merchantNotes: "merchant_notes",
  merchantStock: "merchant_stock",
};

// Helper to reduce typos in .from("table") calls.
export function fromTable(supabase, keyOrName) {
  const name = TABLES[keyOrName] || keyOrName;
  return supabase.from(name);
}
