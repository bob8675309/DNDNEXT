# Tactical Encounter Phase 0 — Visual Asset Status

Last updated: 2026-07-26  
Parent roadmap: [`Tactical_Encounter_Combat_Roadmap_Blueprint.md`](./Tactical_Encounter_Combat_Roadmap_Blueprint.md)

This is the working status ledger for Phase 0 of the tactical encounter roadmap. The master roadmap remains the source of truth for the end-state architecture; this file tracks the narrow visual-identity migration while it is being implemented.

## Current target

DNDNext is standardizing on one rich sprite contract for new production assets:

- 8 directions: `down`, `down-left`, `left`, `up-left`, `up`, `up-right`, `right`, `down-right`;
- 64×64 master frames by default;
- frame 0 = idle;
- frames 1, 2, 3 = walking cycle;
- default animation rate 7 FPS;
- independent overworld and tactical display scales;
- portrait and sprite are independent selections;
- portrait-to-sprite links are recommendations only, never creation constraints.

The existing world/town movement and route systems are not part of this migration. Only visual selection/rendering may change in Phase 0.

## Completed

- [x] Added `npc_visual_assets` metadata foundation.
- [x] Added character `portrait_library_id`, `visual_asset_id`, and idempotent `creation_request_id` support.
- [x] Added portrait selection to NPC Forge Identity.
- [x] Defined 8-direction idle/walk metadata.
- [x] Added separate `overworld_scale` and `tactical_scale` metadata.
- [x] Made sprite assets independent of portraits.
- [x] Added `portrait_sprite_suggestions` as an optional many-to-many recommendation layer.
- [x] Kept authenticated suggestion access read-only.
- [x] Added separate portrait and sprite search/selection surfaces in the Forge visual picker.
- [x] Added suggested-match ordering/badges.
- [x] Added metadata-driven animated sprite preview with facing selection.
- [x] Verified through a rolled-back `create_character_v1` test that a character can persist an independently selected portrait and sprite.
- [x] Preserved the guard that prevents an 8-direction asset from being handed to the current 4-direction world renderer before that renderer is migrated.

## In progress / next

- [ ] Replace the world-map 4-direction sprite renderer with the metadata-driven 8-direction renderer **without changing movement/pathing/travel behavior**.
- [ ] Update world-map hit testing to use sprite metadata rather than a hard-coded 32×32 frame assumption.
- [ ] Remove the temporary rich-asset-to-legacy-renderer guard after the new renderer is verified.
- [ ] Make sprite selection a first-class editable visual choice outside initial character creation as well.
- [ ] Produce a small curated production-ready sprite batch.
- [ ] Validate exact 8×4 packing, transparent background, anchor point, silhouette consistency, and walk-cycle consistency.
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

## Verification completed

- migration 01 transaction dry-run: passed;
- migration 02 transaction dry-run: passed;
- live schema postconditions: passed;
- authenticated can read suggestions: yes;
- authenticated direct INSERT to suggestions: no;
- current registered rich sprite assets at migration time: 0;
- end-to-end rolled-back independent portrait + sprite character creation: passed;
- Vercel preview after picker/schema changes: passed.

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
10. merge only after the preview build and movement regression checks are green.
