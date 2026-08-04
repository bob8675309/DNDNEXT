# DNDNext Sprite Production Run Log

Status date: 2026-08-04

This log records real Blender and visual-review evidence. It supplements `Sprite_Production_Work_Map.md` and does not replace Sprite Production Lab or user approval.

## Run 1 — complete render, static animation discovered

The first Cycles CPU run completed all 32 renders and generated an atlas, but every frame in each direction row was pixel-identical. The original QA did not prove rendered motion.

## Run 2 — static-row gate proved

After deterministic pose data and rendered-pixel hashing were added, all eight static rows were correctly rejected. Blender had been reevaluating the assigned Action and replacing every direct pose with frame 1.

## Source correction — deterministic Action detachment

`dndnext_sprite_export_runner.py` detaches the Action in memory when a DNDNext deterministic pose library is present. Imported Action-based models retain their normal path and the saved `.blend` remains editable.

## Run 3 — technically successful animated prototype

The corrected run rendered all 32 cells, passed automatic QA, produced distinct frames, preserved South-first order and handedness, and proved the end-to-end model/render/atlas pipeline.

Manual review rejected it as final art because the blockout was too small, soft, robe-heavy, and glide-like.

## Source pass 4 — visual refinement v2

The v2 pass enlarged Dawn, shortened the robe/cape, exposed more boots, strengthened contact poses, and increased material contrast.

## Run 4 — native batch crash

The v2 model, dry run, and first-frame probe succeeded, but the separate batch process exited with Blender `EXCEPTION_ACCESS_VIOLATION` before frame 1.

The pipeline added one clean-process retry, crash capture, and preserved rendered-frame QA.

## Run 5 — full render, strict baseline failure

All 32 frames rendered. QA blocked only:

- Southwest baseline drift: `4px`;
- Northeast baseline drift: `3px`;
- strict limit: `2px`.

## Run 6 — procedural baseline correction insufficient

Root-height correction improved both failing rows to `3px`, but did not clear the strict `2px` gate.

## Source pass 6 — bounded rendered baseline normalizer

A diagnostic post-render normalizer was added for baseline-only failures. It limited shifts, reran QA, and recorded adjustments.

## Run 7 — automatic QA passed, visual candidate rejected

The bounded fallback passed and published a complete review package. Recorded per-frame shifts produced visible vertical twitch. The exaggerated poses snapped, the cone robe created a bell-shaped silhouette, and the model read as a rough mannequin.

This candidate is **rejected** and must not be registered or assigned.

## Source pass 7 — Dawn v3 prepared

Dawn v3 removed rendered-frame shifting, used identical root height, lowered playback to six FPS, moderated leg articulation, fixed the staff arm, hid the cone robe/cape, added split panels and visible legs, and reduced oversized head/shoulder forms.

## Run 8 — Dawn v3 monolithic batch crashed twice before cell 1

The v3 model build, refinement, scene preparation, deterministic dry run, and native first-frame probe passed. The long-lived 32-frame Python render process then exited with Blender `EXCEPTION_ACCESS_VIOLATION` immediately after Action detachment. The clean-process retry failed at the same point.

This confirmed that the remaining technical failure was process architecture, not a specific pose or direction.

## Source pass 8 — isolated prepared-blend rendering

The active pipeline separated each cell into short-lived preparation and native-render processes:

1. apply one canonical direction and deterministic pose;
2. detach the Action and save a temporary pose-frozen `.blend`;
3. render that blend through native `--render-frame 1`;
4. retry only that cell after native exit code `11`;
5. assemble and validate after all 32 canonical PNGs exist.

The assembler requires the exact file set, runs alpha/crop/baseline/pivot/size/static-row QA, creates the atlas and reports, and records `isolated_prepared_blend_per_cell_v1` provenance.

## Run 9 — isolated pipeline passed; Dawn v3 art rejected

The local run from source commit `f91949006ebbee994ca5fc532f4210eeaddf6d40` completed successfully:

- all 32 cells were prepared and rendered through fresh Blender processes;
- temporary cell blends were cleaned up;
- atlas assembly passed automatic QA with no errors;
- the review package published to `sprite-review/dawn-whiteflame`;
- source provenance matched the merged commit.

This proves the reliability pipeline.

Direct visual review still rejected Dawn v3 as final art. Compared with the user-supplied multi-view concept sheet and high-quality chibi tactical sprite sample, the procedural model remained far below the expected standard:

- face and hair were generic and underdeveloped;
- armor, cloth, leather, belts, boots, cape, and staff lacked layered detail;
- proportions and silhouette still read as a crude technical blockout;
- character identity did not survive at the desired quality level;
- incremental primitive-model polish was unlikely to close the gap efficiently.

The technical run is accepted as pipeline evidence. The visual asset is rejected.

## Decision record — retire procedural primitives as final source

The project will not continue treating the procedural primitive Dawn model as a near-final asset.

Retained:

- Blender scene and rigging host;
- deterministic pose support;
- isolated cell renderer;
- atlas assembly and QA;
- review publishing;
- runtime and Sprite Lab contracts.

Retired as the active visual path:

- incremental polishing of the primitive/ridgid-parented blockout into final Dawn art;
- full 32-cell production before source quality is approved;
- automatic QA as evidence of acceptable art quality.

## Active next phase — high-quality South prototype

The controlling plan is `Dawn_High_Quality_Prototype_Plan.md`.

Next steps:

1. evaluate a higher-quality source-asset workflow, including free or acceptably licensed tools or Blender plug-ins;
2. verify licensing, Blender export, riggability, identity consistency, reproducibility, and body-family reuse;
3. create one South-facing idle plus three walk frames at a higher working resolution;
4. compare a large render and actual-size animation against the concept and chibi references;
5. expand to eight directions only after explicit approval.

The user must not be required to manually edit frames. Dawn remains unregistered, unassigned, and incomplete.