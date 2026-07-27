# Tactical Encounter Phase 0 — Visual Asset Status

Last updated: 2026-07-26  
Parent roadmap: [`Tactical_Encounter_Combat_Roadmap_Blueprint.md`](./Tactical_Encounter_Combat_Roadmap_Blueprint.md)

This is the working status ledger for Phase 0 of the tactical encounter roadmap. The master roadmap remains the source of truth for the end-state architecture; this file tracks the narrow visual-identity migration while it is being implemented.

> **Phase 0 amendment:** the campaign owner explicitly approved retiring the old 4-direction sprite standard after the live dependency audit found no character using old sprite art. Where the master roadmap still says that 4-direction compatibility must be retained, this Phase 0 decision supersedes that legacy requirement. World movement/travel behavior is still protected; only the visual sprite contract changed.

## Current target

DNDNext now standardizes on one production sprite contract for both overworld presentation and future tactical combat:

- 8 directions: `down`, `down-left`, `left`, `up-left`, `up`, `up-right`, `right`, `down-right`;
- 64×64 master frames;
- 4 columns × 8 rows = exact 256×512 production PNG;
- frame 0 = idle;
- frames 1, 2, 3 = walking cycle;
- default animation rate 7 FPS;
- transparent background;
- `overworld_scale` controls small world-map presentation;
- `tactical_scale` controls future encounter-board presentation;
- portrait and sprite are independent selections;
- portrait-to-sprite links are recommendations only, never creation constraints.

The old 4-direction runtime is no longer a product requirement. New active sprite assets must satisfy the unified 8-direction contract.

The existing world/town movement, travel, route, weather, camp, and world-clock systems are not part of this migration. Phase 0 changes visual selection/rendering only.

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

### Unified world renderer

- [x] Added `utils/spriteAnimation.js` as shared visual-only sprite math.
- [x] Added 8-direction facing quantization from existing rendered velocity.
- [x] Added metadata-driven idle/walk frame selection.
- [x] Added shared `MapSprite` rendering primitive.
- [x] Replaced `MapPageClient`'s hard-coded 32×32 / 4-direction / 3-frame slicing with the unified 64×64 8-direction contract.
- [x] Added `visual_asset_id` to the NPC/merchant map projections used by the renderer.
- [x] World-map NPC and merchant sprites now render only from an explicitly selected `visual_asset_id` plus its projected sprite path.
- [x] Updated map sprite hit testing from the old hard-coded 32×32 assumption to the unified frame size and overworld scale.
- [x] Preserved `useInterpolatedPoses`; facing is derived only from the existing rendered velocity.
- [x] Did not change route progression, travel, weather, camp, world-clock, or movement authority.
- [x] Added permanent source validation that rejects restoration of the old inline 4-direction renderer.
- [x] Updated the NPC Forge validator so it no longer requires the retired 4-direction compatibility boundary.

## In progress / next

- [ ] Migrate the remaining `/npcs` raw-path sprite caller to `visual_asset_id` and the protected rich picker.
- [ ] Remove the legacy path-only mode from `SpritePickerModal` after its last caller is migrated.
- [ ] Remove legacy fallback props/format construction from `MapSprite` once caller audit confirms no remaining dependency.
- [ ] Remove stale legacy-only sprite-path logic/default scale remnants from NPC Forge V3.
- [ ] Produce a small curated production-ready sprite batch.
- [ ] Validate exact packing, alpha background, anchor point, silhouette consistency, and walk-cycle consistency on each production candidate.
- [ ] Register approved sprites in `npc_visual_assets`.
- [ ] Add curated portrait recommendations only after sprite art is approved.
- [ ] Lock exact transparent-padding/foot-anchor guidance from the first accepted production batch.

## Accepted art direction from review samples

The initial review examples established the desired broad aesthetic:

- readable classic-JRPG/fantasy proportions rather than super-deformed/chibi characters;
- clear silhouettes at small map scale;
- equipment and clothing remain recognizable;
- enough detail for the future tactical board while still reading at overworld scale;
- 8 directional views with idle and walking animation.

The generated review images are **style references, not registered production sprite sheets yet**. Production assets must pass exact frame packing and consistency checks before registration.

## Database migrations in this phase

### `20260726_01_decouple_portrait_sprite_selection.sql`

- makes the old portrait provenance field nullable;
- adds overworld/tactical scale and sprite tagging fields;
- sets the new 8-direction metadata defaults;
- creates `portrait_sprite_suggestions`;
- keeps direct authenticated writes disabled.

Applied live as `decouple_portrait_sprite_selection`.

### `20260726_02_enforce_independent_sprite_registry.sql`

- retires the old one-to-one portrait relationship;
- establishes the suggestion table as the portrait↔sprite relationship;
- preserves the proven create-character boundary.

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
- updates `character_sheets.visualAsset` metadata.

Applied live as `character_sprite_picker`.

### `20260726_05_sync_portrait_library_identity.sql`

- keeps `characters.portrait_library_id` aligned when portrait paths/URLs change through existing portrait controls;
- backfills resolvable library portraits;
- does not couple portrait selection to sprite selection.

Applied live as `sync_portrait_library_identity`.

### `20260726_06_eight_direction_runtime_projection.sql`

- establishes the unified active-asset runtime constraint;
- requires active sprites to use `eight_direction_idle_walk_v1`, bucket `map-icons`, 64×64 frames, the approved eight-row order, idle frame 0, walk frames `[1,2,3]`, and 7 FPS;
- updates the character visual-asset trigger so a selected active asset projects its `sprite_key`, `sprite_path`, and overworld scale to the character;
- rejects inactive/missing or format-invalid selected visual assets;
- reprojects already-linked characters through the updated guard without changing route or location state.

Applied live as `eight_direction_runtime_projection` after a transaction rollback rehearsal and postcondition checks.

## Verification completed

- migrations 01–05 transaction dry-runs: passed;
- migration 06 transaction dry-run: passed and rolled back cleanly;
- migration 06 live apply: passed;
- live schema/RPC/constraint postconditions: passed;
- authenticated can read suggestions: yes;
- authenticated direct INSERT to suggestions: no;
- anonymous sprite-library admin RPC execution: denied;
- live inventory immediately before cutover: 0 active rich sprite assets, 0 portrait/sprite suggestions, 0 characters with `visual_asset_id`, 0 characters with `sprite_path`;
- live counts before/after runtime migration remained 2 characters, 20 locations, 4 routes, and 9 route points;
- end-to-end rolled-back independent portrait + sprite character creation: passed;
- end-to-end rolled-back sprite registration + suggestion + existing-character assignment: passed;
- rollback postcheck confirmed no temporary test asset/suggestion rows remained;
- unified `MapPageClient` Next.js compile: passed;
- unified 8-direction large-file readiness validation: passed;
- complete canonical Vercel preview build after source-bake and validator updates: passed.

## Guardrails after the renderer cutover

1. `useInterpolatedPoses` remains the visual-position source for world sprites.
2. Sprite facing may read existing rendered velocity but must not become movement authority.
3. Route/travel/weather/camp/world-clock behavior stays outside sprite rendering.
4. Active production sprite assets must satisfy the database-enforced unified 8-direction contract.
5. `MapPageClient` must not reintroduce `SPRITE_FRAME_W`, `SPRITE_FRAME_H`, `SPRITE_FRAMES_PER_DIR`, `SPRITE_DIR_ORDER`, or the old four-direction `spriteDirFromVelocity` implementation.
6. Sprite selection should use `visual_asset_id`; raw `sprite_path` editing is transitional debt to remove, not a supported new workflow.
7. Portrait selection and sprite selection remain independent; suggestions never force a pairing.
8. World and future tactical presentation use the same master asset and separate display scales.
9. Every tactical phase continues to keep tactical coordinates/movement separate from world route movement.
10. Merge only after the full canonical preview build and live DB postconditions are green.

## Phase 0 exit status

The visual runtime cutover is complete. Remaining Phase 0 work is asset/caller cleanup and production-art standardization:

- migrate the final legacy picker caller;
- remove unused compatibility code;
- approve/register the first production sprite batch;
- finalize anchor/padding guidance from those accepted assets.

After those items, Phase 0 can be marked complete and Phase 1 can begin with the separate encounter-map/hex-renderer shell.
