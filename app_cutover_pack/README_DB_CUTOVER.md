# DnDNext DB cleanup plan (Characters unification)

This pack complements `dndnext_migration_pack_characters.sql`.
It gives a cutover path that keeps legacy tables intact while you migrate page-by-page.

## Target outcome
- A single **characters** record backs NPCs, merchants, and store-enabled NPCs.
- Movement (x,y,roaming_speed) is available for every character.
- Storefront is a **toggle** (store_enabled) independent from character_type.
- Selectable map pills/icons come from a DB table (`map_icons`) so you can add more without code changes.

## Recommended migration sequence
1) Run the SQL pack
   - Run `dndnext_migration_pack_characters.sql` in Supabase SQL editor.
   - Safe to re-run.

2) Validate the migrated views
   - `select * from public.v_character_roster limit 25;`
   - `select * from public.v_character_store limit 25;`

3) App cutover (minimal-change approach)
   - Update pages/components to read from views first:
     - NPC roster: `v_character_roster`
     - Storefront: `v_character_store` + `store_stock`
     - Notes: `v_character_notes`
   - Keep legacy read paths in place until confirmed.

## Where the app currently hits redundant tables
From a repo scan (DNDNEXT-main(7).zip), these are common duplication hotspots:
- `npcs` + `npc_sheets` + `npc_notes`
- `merchants` + `merchant_profiles` + `merchant_notes`
- `merchant_stock` (store inventory) vs `inventory_items` (equipment/gear)

And these tables appear unused (safe candidates for later deprecation once you confirm data):
- `item_assignments`
- `map_pins`
- `player_items`
- `routes` + `route_points` (your code uses `map_routes/*`)

## Conversion rules you requested
The SQL pack provides RPC functions:
- `convert_character_type(character_id, 'npc'|'merchant')`
  - If converting to NPC: store_enabled => false; `store_stock` wiped; storefront meta cleared.
  - If converting to Merchant: store_enabled => true; `store_stock` wiped; storefront created.

- `set_character_store_enabled(character_id, boolean)`
  - Separate toggle, independent of type.

Gear / character sheet stay attached to the character (inventory_items / character_sheets).

## App-side "single edit" goal
Use `utils/dbTables.js` and `utils/charactersDb.js`.
All future renames should be handled by updating TABLES in `dbTables.js`.

