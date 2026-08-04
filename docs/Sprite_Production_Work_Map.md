# DNDNext Sprite Production Work Map

Status date: 2026-08-04

This is the authoritative map for sprite-production status. Older concept notes do not override verified build output.

## Canonical target

- transparent 256 × 512 PNG atlas;
- 4 columns × 8 rows of 64 × 64 cells;
- South-first rows: `S, SW, W, NW, N, NE, E, SE`;
- columns: Idle, Walk A, Walk B, Walk C;
- playback: `0 → 1 → 2 → 3 → 2 → 1` at 7 FPS;
- stable baseline, pivot, scale, handedness, and silhouette.

Dawn Whiteflame is the first start-to-finish production reference. The requested UI quick fix begins only after Dawn is visually approved and fully documented. Leso Varen and Varges follow afterward.

## Completed work

### Runtime and QA infrastructure

- Unified eight-direction runtime metadata is deployed.
- Four-direction sprite production is retired.
- `/admin/sprite-lab` validates dimensions, transparency, facings, animation, pivot, baseline, handedness, crop, blur, and silhouette.
- The artist sheet and runtime atlas use the same South-first order.

### Blender production pipeline

- Procedural Dawn model, materials, 18-bone rig, staff, flame, and editable walk Action.
- Fixed orthographic camera and three-light setup.
- Windows-safe Cycles CPU rendering with a first-frame probe and crash capture.
- Deterministic four-pose library at frames `1, 7, 13, 19`.
- Action-detachment runner preventing render-time timeline override.
- Automatic atlas assembly, metadata, QA JSON, and HTML animation preview.
- Static-row rejection requiring at least three unique rendered frames per direction.

### Verified real render evidence

The corrected local Blender run:

- rendered all 32 cells;
- passed automatic QA;
- produced four distinct images per direction;
- preserved South-first order, transparency, handedness, and cell bounds;
- maintained approximately 0–1 pixel pivot drift and acceptable baseline drift.

This proves the model-generation, animation-sampling, rendering, atlas, and QA pipeline.

### Review automation

`tools/blender/build_and_publish_dawn_whiteflame.ps1` now provides one-command iteration:

1. build and render Dawn;
2. refuse publication unless automatic QA passes;
3. collect the `.blend`, atlas, 32 frames, metadata, QA JSON, and HTML preview;
4. publish the current candidate to branch `sprite-review/dawn-whiteflame`;
5. record the exact source commit in `publish.json`.

The user does not edit frames. Source adjustments are made in the repository; the local Windows machine only executes the one-line build/publish command. Generated output remains off `main` until final approval.

## Current blocking work

Dawn is technically valid but not yet the final visual standard.

The current candidate needs:

- roughly 10–15% stronger in-cell presence;
- clearer leg and boot separation below the robe;
- stronger contact and passing poses so movement reads as walking rather than gliding;
- cleaner robe, armor, hair, and face separation at actual 64 × 64 runtime size;
- preserved right-hand staff, compact flame, direction order, pivot, and QA tolerances.

All adjustments must be made procedurally in `tools/blender/dndnext_dawn_model_builder.py` or shared render configuration. No manual frame editing is part of the production workflow.

## Acceptance gates

Dawn is complete only after all of the following:

1. automatic QA passes;
2. every direction has at least three unique rendered frames;
3. all eight idle facings are unmistakable;
4. the walk reads as grounded movement at 1× size;
5. feet do not visibly slide;
6. robe, hair, armor, staff, and flame remain consistent;
7. Sprite Production Lab passes every manual checkbox;
8. battle-board and small-map previews remain readable;
9. final source, accepted artifacts, settings, failures, and fixes are documented;
10. the approved atlas is registered and assigned in a reversible test context.

## Remaining work

### Phase A — finish Dawn

1. Patch procedural scale, robe geometry, and pose strength.
2. Run the automated build/publish command.
3. Inspect the artifact branch directly.
4. Repeat until visual acceptance passes.
5. Run Sprite Production Lab and in-site preview checks.
6. Store the approved final source and runtime artifacts.
7. Mark Dawn complete start to finish.

### Phase B — requested UI interruption

After Dawn is complete and documented, pause sprite production for the user's quick UI fix. Keep that patch isolated from sprite and map behavior.

### Phase C — next characters

1. Extract reusable conventions from accepted Dawn.
2. Build Leso Varen with a readable Autognome silhouette.
3. Build Varges with Bugbear proportions, long arms, and greataxe readability.
4. Reuse the same camera, row order, QA gates, artifact publishing, and approval process.

### Phase D — scale-up

- add approved presets to character and NPC creation;
- finish legacy sprite-path cleanup only after replacement coverage is verified;
- add batch manifests without weakening individual QA;
- validate caching and rendering performance with a representative sprite set;
- define archive rules for source `.blend`, accepted atlas, metadata, QA, and superseded candidates.

## Dependency map

```text
Canonical 8-direction contract
        ↓
Sprite Lab + Art Bible
        ↓
Procedural model + deterministic poses
        ↓
Cycles CPU render + static-row QA
        ↓
Automated artifact publishing
        ↓
Dawn visual refinement                 ← CURRENT
        ↓
Sprite Lab + site preview approval
        ↓
Dawn final registration and documentation
        ↓
Requested UI quick fix
        ↓
Leso → Varges → repeatable sprite batches
```

## Protected boundaries

Sprite production remains visual-only. It must not alter world-map travel, town-map behavior, tactical legality, combat, encounters, inventory, crafting, spells, progression, or Supabase schema/data unless a later separately reviewed integration explicitly requires it.
