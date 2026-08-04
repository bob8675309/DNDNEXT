# DNDNext Sprite Production Run Log

Status date: 2026-08-04

This log records real Blender evidence. It supplements `Sprite_Production_Work_Map.md` and does not replace Sprite Production Lab or user visual approval.

## Run 1 — complete render, static animation discovered

The first Cycles CPU run completed all 32 renders and generated an atlas, but every frame in each direction row was pixel-identical. The original QA did not prove rendered motion.

## Run 2 — static-row gate proved

After deterministic pose data and rendered-pixel hashing were added, all eight static rows were correctly rejected. Blender had been reevaluating the assigned Action and replacing every direct pose with frame 1.

## Source correction — deterministic Action detachment

`dndnext_sprite_export_runner.py` now detaches the Action in memory when a DNDNext deterministic pose library is present. Imported Action-based models retain their normal path and the saved `.blend` remains editable.

## Run 3 — technically successful animated prototype

The corrected run rendered all 32 cells, passed automatic QA, produced distinct frames, preserved South-first order and handedness, and proved the end-to-end model/render/atlas pipeline.

Manual review rejected it as final art because the blockout was too small, soft, robe-heavy, and glide-like.

## Source pass 4 — visual refinement v2

The v2 pass enlarged Dawn, shortened the robe/cape, exposed more boots, strengthened contact poses, and increased material contrast.

## Run 4 — native batch crash

The v2 model, dry run, and first-frame probe succeeded, but the separate batch process exited with Blender `EXCEPTION_ACCESS_VIOLATION` before frame 1.

The pipeline was hardened with:

- one fresh-process retry for native exit code `11`;
- crash-report capture;
- no duplicate transform preflight inside the batch process;
- retained rendered-frame hashing and static-row rejection.

## Run 5 — full render, strict baseline failure

All 32 frames rendered. QA blocked only:

- Southwest baseline drift: `4px`;
- Northeast baseline drift: `3px`;
- strict limit: `2px`.

## Run 6 — procedural baseline correction insufficient

Root-height correction improved both failing rows to `3px`, but did not clear the strict `2px` gate.

## Source pass 6 — bounded rendered baseline normalizer

A post-render normalizer was added for baseline-only failures. It limited each shift to `4px`, reran full QA, recorded every adjustment, and refused non-baseline failures.

## Run 7 — automatic QA passed, visual candidate rejected

The bounded fallback passed and published a complete review package. Recorded shifts were:

- Southwest Walk A: `-3px`;
- Southwest Walk C: `-1px`;
- Northeast Walk B: `+1px`;
- Northeast Walk C: `+3px`.

The user-provided video exposed defects that the numeric QA did not catch:

- individual frame shifts created visible vertical twitch;
- the six-step loop snapped between exaggerated poses;
- the cone robe/cape produced a bell-shaped, non-humanoid silhouette;
- oversized head and shoulder forms read as a rough mannequin;
- boots and legs still did not communicate a grounded walk;
- the result was explicitly rejected as visually unacceptable.

This candidate is **rejected**. It must not be registered, assigned, or treated as Dawn's finished reference.

## Source pass 7 — Dawn v3 prepared

`tools/blender/dndnext_dawn_visual_refinement_v3.py` replaces the rejected approach with:

- no rendered-frame baseline shifting;
- identical root height in every pose;
- six FPS playback instead of seven;
- moderate leg articulation rather than 42-degree contact poses;
- a fixed right-arm/staff pose across the whole walk;
- hidden legacy cone robe and cape;
- split front/back tabard panels;
- visible thigh, shin, and boot forms;
- split restrained cape panels;
- reduced head, hair, and pauldron proportions;
- stronger humanoid silhouette and darker internal separation.

The v3 build treats any automatic QA failure as a hard stop. The old v2/v2.1 files remain only as historical evidence and are no longer in Dawn's active build path.

## Run 8 — Dawn v3 monolithic batch crashed twice before cell 1

The v3 model build, refinement, scene preparation, deterministic dry run, and native first-frame probe all passed. The long-lived 32-frame Python render process then exited with Blender `EXCEPTION_ACCESS_VIOLATION` immediately after Action detachment. The one clean-process retry failed at the same point.

This confirms the remaining failure is process architecture, not a specific pose, direction, or atlas QA defect. Repeating the same monolithic batch is not an efficient production method.

## Source pass 8 — isolated prepared-blend rendering

The active pipeline now separates each cell into two short-lived Blender processes:

1. `dndnext_sprite_prepare_isolated_cell.py` opens the prepared master model, applies one canonical direction and deterministic pose, detaches the Action, freezes visibility, and saves a temporary one-frame `.blend`.
2. Blender's native `--render-frame 1` command renders that temporary blend into one canonical PNG.

Each preparation and render step receives its own exit-code `11` retry. A native failure therefore retries only the affected cell instead of discarding the entire 32-frame run.

After all 32 PNGs exist, `dndnext_sprite_assemble_isolated_frames.py`:

- requires the exact canonical file set;
- rejects missing or unexpected PNGs;
- runs the existing alpha, crop, baseline, pivot, size, and static-row checks;
- assembles the atlas;
- writes metadata, QA JSON, and animated preview;
- records `isolated_prepared_blend_per_cell_v1` as render provenance.

Temporary cell blends are deleted after successful renders and again in a final cleanup block. The visual v3 model and strict no-shift QA policy are unchanged.

## Next run

Render and publish Dawn v3 through the isolated-cell pipeline. The run may take longer because Blender starts fresh for each cell, but it should be fault-contained and reusable for later sprites. Automatic QA remains necessary but not sufficient; the candidate must still pass video review for smooth motion, human proportions, visible foot travel, stable staff, and acceptable appearance before registration or the requested UI pivot.
