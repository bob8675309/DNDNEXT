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

The corrected prototype run:

- rendered all 32 cells;
- passed automatic QA;
- produced four distinct images per direction;
- preserved South-first order, transparency, handedness, and cell bounds;
- maintained approximately 0–1 pixel pivot drift and acceptable baseline drift.

This proves the model-generation, animation-sampling, rendering, atlas, and QA pipeline.

### Review automation

`tools/blender/build_and_publish_dawn_whiteflame.ps1` provides one-command iteration:

1. build and render Dawn;
2. refuse publication unless automatic QA passes;
3. collect the `.blend`, atlas, 32 frames, metadata, QA JSON, and HTML preview;
4. publish the current candidate to branch `sprite-review/dawn-whiteflame`;
5. record the exact source commit in `publish.json`.

The user does not edit frames. Source adjustments are made in the repository; the local Windows machine only executes the one-line build/publish command. Generated output remains off `main` until final approval.

### Dawn visual refinement v2 — implemented

The bundled refinement pass:

- shortens and narrows the robe and cape to expose the lower legs;
- enlarges and separates the boots and shins;
- adds a restrained front robe split for silhouette separation;
- strengthens contact and passing poses while stabilizing the right-hand staff;
- increases ivory, gold, silver-hair, dark-metal, and armor value separation;
- reduces orthographic scale from `4.4` to `4.0`, increasing runtime presence by about 10%.

No rendered frame is manually edited.

### Batch crash hardening — verified

The first v2 render attempt ended with a Blender 4.5 `EXCEPTION_ACCESS_VIOLATION` before the first batch cell. The hardened path:

- keeps dry-run transform validation authoritative;
- skips only the duplicate preflight in the batch process;
- retains rendered-frame hashing and static-row rejection;
- retries native exit code `11` once in a fresh process;
- copies crash evidence only for a native crash.

Subsequent runs rendered all 32 cells and reached automatic QA.

### Baseline evidence and correction v2.1 — verified

The first completed v2 render failed only Southwest `4px` and Northeast `3px` baseline drift against the strict `2px` limit. Procedural root-height correction v2.1 improved both diagonals to `3px`, but did not fully clear projection-dependent rounding.

This evidence rules out further blind root-height guessing as the efficient production method.

### Bounded baseline normalizer — source prepared

`tools/blender/dndnext_sprite_baseline_normalize.py` handles only a completed render whose QA report contains baseline-drift errors and no other failure type. It:

- reuses existing PNG frames rather than rerendering;
- normalizes only failing rows to each row's idle-frame anchor;
- limits each vertical shift to at most `4px`;
- preserves the strict final baseline gate of `2px`;
- refuses edge-margin violations;
- reruns every existing metric and static-row check;
- rebuilds the atlas, metadata, QA JSON, and preview;
- records all applied shifts in generated reports;
- leaves any non-baseline QA failure blocked.

PowerShell exit code `2` invokes this bounded QA fallback. Exit code `11` remains reserved for native Blender retry/crash handling.

## Current blocking work

Dawn refinement v2.2 requires one rerun through the bounded baseline normalizer and automatic artifact publication.

Current gate:

1. pull the merged bounded-normalizer source;
2. run the one-line build/publish command;
3. confirm all 32 cells render;
4. confirm any baseline-only correction remains within the `4px` cap;
5. confirm regenerated automatic QA reports `passed: true` under the unchanged `2px` baseline limit;
6. inspect the published `.blend`, atlas, frames, QA JSON, metadata, and HTML preview;
7. run `/admin/sprite-lab` and in-site scale checks;
8. approve or make one final evidence-driven visual adjustment.

Dawn remains unregistered and unassigned until these gates pass.

## Acceptance gates

Dawn is complete only after all of the following:

1. automatic QA passes;
2. every direction has at least three unique rendered frames;
3. all eight idle facings are unmistakable;
4. the walk reads as grounded movement at 1× size;
5. feet do not visibly slide;
6. robe, hair, armor, staff, and flame remain consistent;
7. any automatic pixel shift is bounded, documented, and independently reviewed;
8. Sprite Production Lab passes every manual checkbox;
9. battle-board and small-map previews remain readable;
10. final source, accepted artifacts, settings, failures, and fixes are documented;
11. the approved atlas is registered and assigned in a reversible test context.

## Remaining work

### Phase A — finish Dawn

1. Render and publish refinement v2.2 through the bounded baseline path.
2. Inspect the artifact branch directly, including recorded frame shifts.
3. Make another procedural pass only where the actual result demonstrates a visual deficiency.
4. Run Sprite Production Lab and in-site preview checks.
5. Store the approved final source and runtime artifacts.
6. Mark Dawn complete start to finish.

### Phase B — requested UI interruption

After Dawn is complete and documented, pause sprite production for the user's quick UI fix. Keep that patch isolated from sprite and map behavior.

### Phase C — next characters

1. Extract reusable conventions from accepted Dawn.
2. Build Leso Varen with a readable Autognome silhouette.
3. Build Varges with Bugbear proportions, long arms, and greataxe readability.
4. Reuse the same camera, row order, QA gates, bounded normalization, artifact publishing, and approval process.

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
Bounded baseline-only normalization      ← CURRENT
        ↓
Automated artifact publishing
        ↓
Direct artifact + Sprite Lab + site review
        ↓
Dawn final registration and documentation
        ↓
Requested UI quick fix
        ↓
Leso → Varges → repeatable sprite batches
```

## Protected boundaries

Sprite production remains visual-only. It must not alter world-map travel, town-map behavior, tactical legality, combat, encounters, inventory, crafting, spells, progression, or Supabase schema/data unless a later separately reviewed integration explicitly requires it.
