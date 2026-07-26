# Tactical Encounter Phase 0 — Visual Asset Status

Last updated: 2026-07-26  
Parent roadmap: [`Tactical_Encounter_Combat_Roadmap_Blueprint.md`](./Tactical_Encounter_Combat_Roadmap_Blueprint.md)

This is the working status ledger for Phase 0 of the tactical encounter roadmap. The master roadmap remains the source of truth for the end-state architecture; this file tracks the narrow visual-identity migration while it is being implemented.

## Current target

DNDNext is standardizing on one rich sprite contract for new production assets:

- 8 directions: `down`, `down-left`, `left`, `up-left`, `up`, `up-right`, `right`, `down-right`;
- 64×64 master frames by default;
- 4 columns × 8 rows = exact 256×512 production PNG;
- frame 0 = idle;
- frames 1, 2, 3 = walking cycle;
- default animation rate 7 FPS;
- transparent background;
- independent overworld and tactical display scales;
- portrait and sprite are independent selections;
- portrait-to-sprite links are recommendations only, never creation constraints.

The user approved retiring the old 4-direction art format once the world renderer migration is verified. No old sprite art needs to be preserved as a product requirement. Compatibility is retained temporarily only to keep the current map stable during the migration.

The existing world/town movement and route systems are not part of this migration. Only visual selection/rendering may change in Phase 0.

## Completed

### Visual identity foundation

- [x] Added `npc_visual_assets` metadata foundation.
- [x] Added character `portrait_library_id`, `visual_asset_id`, and idempotent `creation_request_id` support.
- [x] Added portrait selection to NPC Forge Identity.
- [x] Defined the 8-direction idle/walk metadata contract.
- [x] Added separate `overworld_scale` and `tactical_scale` metadata.
- [x] Made sprite assets independent of portraits.
- [x] Added `portrait_sprite_suggestions` as an optional many-to-many recommendation layer.
- [x] Kept authenticated suggestion access read-only.
- [x] Added separate portrait and sprite search/selection surfaces in the Forge visual picker.
- [x] Added suggested-match ordering/badges.
- [x] Added metadata-driven animated sprite preview with facing selection.
- [x] Verified through a rolled-back `create_character_v1` test that a character can persist an independently selected portrait and sprite.

### Sprite library and editing

- [x] Added admin-authorized sprite registration, archive, and portrait-suggestion RPCs.
- [x] Added `/admin/sprite-assets` as the curated 8-direction sprite-library manager.
- [x] Added exact PNG validation for the production 256×512 / 64×64 / 8×4 packing contract.
- [x] Added transparency validation before a newly uploaded sprite enters the curated catalogue.
- [x] Added searchable species, role, and theme tags to sprite assets.
- [x] Added per-character `set_character_visual_asset_v1` with the same admin/`can_edit` authorization boundary used by portrait editing.
- [x] Added `/admin/character-visuals` and `CharacterVisualsPanel` for independent portrait and sprite assignment after character creation.
- [x] Added protected synchronization of `portrait_library_id` when an existing character changes to another library portrait, so suggested sprite matches remain usable.
- [x] Preserved legacy `/npcs` path-only sprite picker behavior as an isolated compatibility mode; rich assets cannot pass through that old caller.

### Renderer primitives

- [x] Added `utils/spriteAnimation.js` as shared visual-only sprite math.
- [x] Added 8-direction facing quantization from existing render velocity.
- [x] Added metadata-driven idle/walk frame selection.
- [x] Upgraded the small shared `MapSprite` renderer to understand rich metadata while retaining temporary legacy props.
- [x] Preserved the database guard that prevents an 8-direction asset from being handed to the current inline 4-direction world renderer before `MapPageClient` is migrated.

## In progress / next

- [ ] Replace the inline world-map 4-direction sprite slicing in `MapPageClient` with metadata-driven 8-direction rendering **without changing movement/pathing/travel behavior**.
- [ ] Load active `npc_visual_assets` metadata for characters carrying `visual_asset_id`.
- [ ] Update world-map hit testing to use sprite frame/scale metadata rather than a hard-coded 32×32 assumption.
- [ ] Migrate the remaining `/npcs` raw-path sprite caller to `visual_asset_id` and the protected rich picker.
- [ ] Remove the temporary rich-asset-to-legacy-renderer guard only after the new renderer is verified in production.
- [ ] Remove/retire legacy 4-direction selection and constants after all active callers use the rich asset contract.
- [ ] Produce a small curated production-ready sprite batch.
- [ ] Validate exact packing, alpha background, anchor point, silhouette consistency, and walk-cycle consistency on each generated production candidate.
- [ ] Register approved sprites in `npc_visual_assets`.
- [ ] Add curated portrait recommendations only after sprite art is approved.

## Accepted art direction from review samples

The initial review examples established the desired broad aesthetic:

- readable classic-JRPG/fantasy proportions rather than super-deformed/chibi characters;
- clear silhouettes at small map scale;
- equipment and clothing remain recognizable;
- enough detail for the future tactical board while still reading at overworld scale;
- 8 directional views with idle and walking animation.

The generated review images are **style references, not production sprite sheets yet**. Production assets must pass exact frame packing and consistency checks before registration.

## Database migrations in this phase

### `20260726_01_decouple_portrait_sprite_selection.sql`

- makes the old portrait provenance field nullable;
- adds overworld/tactical scale and sprite tagging fields;
- sets the new 8-direction metadata defaults;
- creates `portrait_sprite_suggestions`;
- keeps direct authenticated writes disabled.

Applied live as `decouple_portrait_sprite_selection`.

### `20260726_02_enforce_independent_sprite_registry.sql`

- retires the old one-to-one portrait relationship without replacing the proven create RPC;
- keeps the compatibility column NULL;
- establishes the suggestion table as the only portrait↔sprite relationship.

Applied live as `enforce_independent_sprite_registry`.

### `20260726_03_sprite_library_admin_rpc.sql`

- adds admin-authorized sprite registration/update/archive operations;
- validates the DNDNext 8-direction metadata contract server-side;
- adds admin-authorized portrait/sprite suggestion curation;
- keeps anonymous execution disabled and avoids direct browser writes to the registry tables.

Applied live as `sprite_library_admin_rpc`.

### `20260726_04_character_sprite_picker.sql`

- adds `set_character_visual_asset_v1`;
- allows administrators and characters with `can_edit` permission to select/clear a sprite;
- updates `character_sheets.visualAsset` metadata;
- leaves rich sprite paths guarded from the still-legacy world renderer.

Applied live as `character_sprite_picker`.

### `20260726_05_sync_portrait_library_identity.sql`

- keeps `characters.portrait_library_id` aligned when portrait paths/URLs change through existing portrait controls;
- backfills resolvable library portraits;
- does not couple portrait selection to sprite selection.

Applied live as `sync_portrait_library_identity`.

## Verification completed

- migration 01 transaction dry-run: passed;
- migration 02 transaction dry-run: passed;
- migration 03 transaction dry-run: passed;
- migration 04 transaction dry-run: passed;
- migration 05 transaction dry-run: passed;
- live schema/RPC postconditions: passed;
- authenticated can read suggestions: yes;
- authenticated direct INSERT to suggestions: no;
- anonymous sprite-library admin RPC execution: denied;
- current registered rich sprite assets: 0;
- current curated portrait/sprite suggestions: 0;
- end-to-end rolled-back independent portrait + sprite character creation: passed;
- end-to-end rolled-back sprite registration + suggestion + existing-character assignment: passed;
- rollback postcheck confirmed no temporary test asset/suggestion rows remained;
- rich sprite remained out of legacy `sprite_path` during compatibility test;
- Vercel preview builds for the Forge picker, sprite admin, character visuals, and shared renderer primitives: passed before this ledger update.

## Guardrails for the renderer migration

Before editing `MapPageClient`:

1. inventory all sprite rendering/hit-test callers;
2. preserve `useInterpolatedPoses` and route/travel state transitions;
3. derive 8-direction facing from existing rendered velocity only;
4. store no new movement authority in the sprite component;
5. idle animation must not change character state;
6. render metadata must come from `npc_visual_assets`, not duplicated constants;
7. map fallback behavior must remain safe when no sprite is selected;
8. verify merchants and NPCs separately;
9. compare route/character/location counts before and after;
10. keep raw-path legacy callers fenced until they are migrated to `visual_asset_id`;
11. merge only after the preview build and movement regression checks are green.
