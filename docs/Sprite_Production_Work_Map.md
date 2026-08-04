# DNDNext Sprite Production Work Map

Status date: 2026-08-04

This document maps what has been completed, what has been proven by a real Blender run, what is currently blocking acceptance, and what remains before production sprites are assigned to characters. It controls sprite-production status when older discussion or concept-sheet notes conflict with verified output.

## Target outcome

Produce reusable, tactics-readable character sprites with one canonical runtime contract:

- transparent PNG;
- 256 × 512 atlas;
- 4 columns × 8 rows;
- 64 × 64 cells;
- South-first rows: `S, SW, W, NW, N, NE, E, SE`;
- columns: Idle, Walk A, Walk B, Walk C;
- playback: `0 → 1 → 2 → 3 → 2 → 1` at 7 FPS;
- stable pivot, baseline, scale, equipment handedness, and silhouette.

Dawn Whiteflame is the first production prototype. Leso Varen and Varges follow only after Dawn passes every acceptance gate.

## Completed work

### 1. Runtime and authoring contract — complete

- Unified eight-direction metadata and runtime support are deployed.
- Four-direction sprite production is retired.
- The authoring sheet and runtime atlas use the same South-first row order.
- Portrait selection and sprite selection remain independent.
- Existing map and battle-board movement continue to own position, direction, and moving state; sprites are visual assets only.

### 2. Sprite Production Lab — complete

`/admin/sprite-lab` provides:

- exact PNG, transparency, and 256 × 512 dimension checks;
- idle-column direction inspection;
- simultaneous eight-row walk playback;
- 1×, 2×, and 3× inspection scales;
- manual gates for duplicate facings, pivot drift, foot sliding, handedness, crop, blur, and silhouette readability;
- runtime metadata download after approval.

### 3. Art direction and production rules — complete

`docs/Sprite_Production_Art_Bible.md` defines:

- grounded dark-fantasy materials with tactics-game readability;
- slightly stylized proportions and enlarged signature equipment;
- orthographic camera and stable studio lighting;
- no mirroring of asymmetric characters;
- consistent South-first direction semantics;
- animation, export, and manual QA requirements.

### 4. Reusable Blender export kit — complete

The repository contains:

- `tools/blender/dndnext_sprite_scene_setup.py`;
- `tools/blender/dndnext_sprite_export.py`;
- `tools/blender/manifests/dawn_whiteflame.sprite.json`;
- `tools/blender/README.md`;
- production-build validation in `scripts/validate_blender_sprite_export_kit.mjs`.

The exporter assembles the atlas, writes metadata, measures alpha bounds, generates an animated HTML preview, and restores the working scene after export.

### 5. Dawn procedural model pipeline — complete as a functional prototype

The repository contains:

- a procedural stylized Dawn model builder;
- an 18-bone `Dawn_Rig`;
- an editable `Dawn_Walk` Action;
- ivory/gold materials, silver hair, armor, robe, cape, staff, and divine flame;
- a right-hand staff/equipment contract;
- fixed camera and three-light scene preparation;
- a one-command Windows PowerShell build;
- crash-report capture and a first-frame render probe.

This is a functional tactical blockout, not the final sculpt or texture pass.

### 6. Windows rendering stabilization — complete

The first production attempt reached Blender rendering but EEVEE terminated with an access violation. The pipeline was hardened to:

- Blender 4.2+ / 4.5 LTS;
- Cycles CPU rendering;
- 32 samples;
- adaptive sampling and denoising disabled;
- factory startup, OpenGL backend, and Blender GPU workarounds;
- one-frame probe before the 32-frame batch;
- `blender-last-crash.txt` capture on failure.

A subsequent local run completed all 32 renders, atlas assembly, metadata, QA JSON, and HTML preview.

### 7. First real output audit — complete

The uploaded review package proved:

- all 32 frame files existed;
- atlas dimensions and transparency were correct;
- South-first row order was correct;
- the model remained inside every 64 × 64 cell;
- metadata and QA files were generated;
- Cycles CPU rendering completed reliably.

The same audit found a release-blocking defect: every frame within a direction row was pixel-identical. The old QA measured crop, pivot, and alpha bounds but did not prove that an animation was actually moving.

### 8. Deterministic animation correction — source complete

The corrected pipeline now:

- stores four explicit Dawn tactical pose snapshots on the armature alongside the editable Action;
- applies those snapshots directly before each render;
- validates that all four sampled pose signatures differ before rendering;
- hashes rendered pixel data for every cell;
- requires a minimum of three unique rendered frames in each direction row;
- fails the build instead of producing a false-positive static walk cycle;
- preserves ordinary Blender Action sampling as the fallback for future imported models without a deterministic pose library.

## Current blocking work

Dawn is **not yet production-approved**. Source correction is complete, but one real local rerender is required to verify the resulting motion.

Current blocking sequence:

1. Pull the corrected source on the Windows Blender machine.
2. Rebuild Dawn and render all 32 frames.
3. Confirm automatic QA reports at least three unique frames per direction row.
4. Review `dawn-whiteflame.qa.html` for direction and motion.
5. Upload a new review ZIP for independent frame-by-frame inspection.
6. Run the atlas through `/admin/sprite-lab`.
7. Approve or return it for targeted model/animation refinement.

No database sprite registration or character assignment should occur before these gates pass.

## Acceptance gates

### Automatic build gates

A Dawn build must fail when any of the following occurs:

- missing model, armature, Action, camera, root, collection, or required equipment;
- wrong atlas dimensions, row order, frame labels, or pose frames;
- invalid or duplicate deterministic pose snapshots;
- fewer than three unique rendered images in any direction row;
- missing alpha, insufficient visible pixels, or cell-edge collision;
- baseline, center, height, or width drift beyond manifest tolerances;
- Blender render probe or batch-render failure.

### Manual visual gates

The final reviewer must confirm:

- idle rows visibly read `S, SW, W, NW, N, NE, E, SE`;
- South is front-facing and North is back-facing;
- diagonal rows are true quarter-turns, not repeated cardinals;
- staff remains in Dawn's right hand in all directions;
- planted feet do not visibly slide;
- the loop does not snap between its last and first playback positions;
- robe, cape, hair, staff, and flame do not change size or identity;
- character remains readable at actual 1× board size;
- no crop, blur, glow bleed, or detail flicker occurs.

### Site integration gates

Before permanent assignment:

- Sprite Production Lab passes every checkbox;
- Sprite Library registration records canonical `eight_direction_idle_walk_v1` metadata;
- preview assignment is tested on the battle board and small map scale;
- no movement, facing, occupancy, or combat logic changes are needed;
- legacy sprite fallbacks remain untouched until the new asset is independently verified.

## Remaining work

### Phase A — finish Dawn prototype

1. Complete the corrected rerender and review package.
2. Tune pose strength, foot contact, robe/cape separation, or camera scale only where the runtime preview shows a real deficiency.
3. Repeat QA until all automatic and manual gates pass.
4. Register the approved atlas in Sprite Library.
5. Assign Dawn in a reversible preview/test context.
6. Test idle rotation and movement on the tactical board.
7. Confirm the asset at the smaller map scale.
8. Record final anchor, padding, and orthographic-scale guidance from the accepted asset.

### Phase B — visual refinement after motion is proven

Refine in this order:

1. silhouette and direction readability;
2. walk timing and foot contact;
3. staff/flame size and placement;
4. robe/cape separation;
5. silver-hair mass readability;
6. ivory/gold value separation;
7. face and ornament detail that remains visible at 64 pixels.

Do not spend time on micro-detail that disappears at runtime size.

### Phase C — repeatable character production

After Dawn is accepted:

1. extract reusable model/rig conventions from the accepted prototype;
2. create Leso Varen's Autognome model and mechanical silhouette;
3. create Varges's Bugbear model with long-arm and greataxe readability;
4. reuse the same camera, lighting, manifest, direction order, and QA gates;
5. produce one character at a time and approve each independently;
6. expand into class/species silhouette families and NPC batches only after the first three are stable.

### Phase D — site cleanup and scale-up

- migrate the last raw-path sprite caller;
- verify and then remove obsolete legacy picker/fallback code;
- add batch/manifest scaffolding without weakening per-character QA;
- add approved sprite presets to NPC and character creation flows;
- test asset loading, caching, and rendering performance with a representative batch;
- document archive/version rules for source `.blend`, master atlas, runtime atlas, metadata, QA JSON, and QA HTML.

## Work dependency map

```text
Canonical 8-direction contract
        ↓
Sprite Production Lab + Art Bible
        ↓
Blender scene/export kit
        ↓
Dawn procedural model + rig + four poses
        ↓
Windows-safe Cycles CPU render
        ↓
Deterministic pose application + static-row rejection
        ↓
Corrected real render and review ZIP          ← CURRENT GATE
        ↓
Sprite Lab approval
        ↓
Sprite Library registration
        ↓
Battle-board and small-map preview tests
        ↓
Dawn production approval
        ↓
Leso → Varges → repeatable character batches
        ↓
Legacy cleanup, performance, and content scale-up
```

## Protected boundaries

Sprite production is visual-only. This work must not modify:

- world-map travel, routes, weather, camps, or clock state;
- town/city-map behavior;
- tactical movement legality, turns, actions, reactions, combat, or encounter versions;
- character inventory, crafting, equipment, spells, or progression;
- Supabase data or schema unless a later, separately reviewed sprite-registration change explicitly requires it.
