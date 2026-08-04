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

## Next run

Render and publish Dawn v3. Automatic QA is necessary but not sufficient. The candidate must also pass video review for smooth motion, human proportions, visible foot travel, stable staff, and acceptable appearance before any registration or UI pivot.
