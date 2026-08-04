# DNDNext Sprite Production Work Map

Status date: 2026-08-04

This is the authoritative sprite-production status map. Automatic QA is necessary but does not override direct visual rejection.

## Canonical target

- transparent `256 × 512` PNG atlas;
- 4 columns × 8 rows of `64 × 64` cells;
- South-first rows: `S, SW, W, NW, N, NE, E, SE`;
- columns: Idle, Walk A, Walk B, Walk C;
- playback: `0 → 1 → 2 → 3 → 2 → 1`;
- stable baseline, pivot, scale, handedness, silhouette, and motion.

Dawn Whiteflame remains the first start-to-finish reference. The requested UI quick fix begins only after Dawn is visually approved and fully documented.

## Completed work

### Runtime, authoring, and QA infrastructure

- Unified eight-direction runtime metadata is deployed.
- Four-direction production is retired.
- `/admin/sprite-lab` supports atlas, direction, animation, pivot, baseline, crop, and handedness review.
- Procedural Dawn model, materials, 18-bone rig, staff, flame, and editable Action exist in source control.
- Fixed orthographic camera and Windows-safe Cycles CPU scene exist.
- Deterministic pose sampling, Action detachment, rendered-frame hashing, and static-row rejection work.
- Atlas, metadata, QA JSON, HTML preview, and automated review-branch publishing work.
- Native Blender exit code `11` receives clean-process retry and crash capture.

### Verified technical evidence

The pipeline has repeatedly:

- rendered all 32 cells;
- preserved South-first row order;
- produced distinct frames;
- maintained transparency and safe cell bounds;
- preserved the staff in Dawn's right hand;
- published source-linked review artifacts.

This proves the technical contracts, not final art quality or long-process stability.

### Rejected v2.2 candidate

The bounded baseline-normalized candidate passed numeric QA but was rejected after video review because:

- per-frame PNG shifts caused visible twitch;
- exaggerated poses snapped in the six-step loop;
- the cone robe/cape created a bell-shaped silhouette;
- proportions read as a rough mannequin rather than Dawn;
- foot movement remained unclear.

The candidate is unapproved, unregistered, and unassigned.

### Dawn v3 source prepared

`tools/blender/dndnext_dawn_visual_refinement_v3.py`:

- removes the legacy cone robe/cape from rendering;
- builds a split tabard, visible thighs, and split cape panels;
- reduces head, hair, and pauldron scale;
- uses moderate leg articulation;
- keeps root height identical in all four poses;
- fixes the staff arm across every walk frame;
- lowers playback to six FPS;
- prohibits post-render baseline shifting.

The strict `2px` baseline gate remains. A QA failure stops publication instead of moving rendered frames.

### Isolated cell rendering — implemented

The monolithic Python batch crashed twice before rendering cell 1 even though model build, dry run, and native probe passed. The active render strategy is now `isolated_prepared_blend_per_cell_v1`:

1. prepare one direction/pose in a short-lived Blender process;
2. save a temporary pose-frozen `.blend` with the Action detached;
3. render that cell through Blender's native `--render-frame` path in another fresh process;
4. retry only the failed cell on native exit code `11`;
5. delete the temporary blend after success;
6. assemble and validate only after all 32 canonical PNGs exist.

`dndnext_sprite_assemble_isolated_frames.py` rejects missing, extra, static, cropped, drifting, or otherwise invalid frames and records the render strategy in QA metadata.

## Current blocking work

Run and inspect Dawn v3 through isolated cell rendering.

Current gate:

1. pull the isolated-render source;
2. run the one-line build/publish command;
3. confirm all 32 isolated cells render and the temporary blends are cleaned up;
4. require automatic QA to pass without frame normalization;
5. inspect the published atlas and video at actual runtime size;
6. reject or refine based on motion and appearance, not QA alone;
7. test the accepted candidate in `/admin/sprite-lab` and the site;
8. register and assign Dawn only after explicit approval.

## Acceptance gates

Dawn is complete only when all are true:

1. automatic QA passes with no rendered-frame shifting;
2. every direction has at least three unique rendered frames;
3. all eight idle facings are unmistakable;
4. motion is smooth and grounded at 1× size;
5. no visible vertical twitch or foot sliding;
6. proportions read as a humanoid divine caster;
7. tabard, cape, hair, armor, staff, and flame remain coherent;
8. the staff stays stable in the same hand;
9. isolated rendering completes without unrecovered native crashes;
10. Sprite Production Lab passes every manual check;
11. battle-board and small-map previews remain readable;
12. final source, accepted artifacts, settings, failures, and fixes are documented;
13. the atlas is registered and assigned reversibly.

## Remaining work

### Phase A — finish Dawn

1. Render Dawn v3 with the isolated-cell pipeline.
2. Review the animated result directly.
3. Make evidence-driven procedural adjustments only.
4. Complete Sprite Lab and in-site tests.
5. Store the approved source and runtime artifacts.
6. Mark Dawn complete start to finish.

### Phase B — requested UI interruption

After Dawn is complete and documented, pause sprite work for the user's quick UI fix. Keep that patch isolated from sprite and map behavior.

### Phase C — next characters

1. Extract reusable conventions from accepted Dawn.
2. Build Leso Varen with a readable Autognome silhouette.
3. Build Varges with Bugbear proportions, long arms, and greataxe readability.
4. Reuse the same camera, row order, isolated rendering, QA, publishing, and approval process.

### Phase D — scale-up

- add approved presets to character and NPC creation;
- replace legacy sprite paths only after coverage is verified;
- add batch manifests without weakening individual approval;
- optimize isolated startup cost only after reliability is proven;
- test caching and rendering performance;
- define archive rules for `.blend`, atlas, metadata, QA, and rejected candidates.

## Dependency map

```text
Canonical 8-direction contract
        ↓
Procedural model + deterministic poses
        ↓
Pose-frozen temporary cell blends
        ↓
Native one-cell Blender renders             ← CURRENT
        ↓
Strict atlas assembly + static-row QA
        ↓
Animated visual review + Sprite Lab + site test
        ↓
Dawn final registration and documentation
        ↓
Requested UI quick fix
        ↓
Leso → Varges → repeatable sprite batches
```

## Protected boundaries

Sprite production remains visual-only. It must not alter world-map travel, town-map behavior, tactical legality, combat, encounters, inventory, crafting, spells, progression, or Supabase schema/data unless a later separately reviewed integration explicitly requires it.
