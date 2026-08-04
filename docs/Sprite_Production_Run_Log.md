# DNDNext Sprite Production Run Log

Status date: 2026-08-04

This log records real Blender evidence. It supplements `Sprite_Production_Work_Map.md` and does not replace Sprite Production Lab approval.

## Run 1 — complete render, static animation discovered

The first Cycles CPU run completed model creation, scene preparation, hierarchy validation, safety probe, all 32 renders, atlas assembly, metadata, QA JSON, and HTML preview.

Independent review found that all four images within each direction row were pixel-identical. The original QA measured dimensions, alpha bounds, baseline, pivot, width, and height but did not prove that the animation moved.

## Run 2 — static-row gate proved

After deterministic pose data and pixel hashing were added, the next run correctly failed all eight rows for containing only one unique image. No atlas was accepted.

Root cause: Blender reevaluated the assigned `Dawn_Walk` Action when each render began and replaced the direct pose snapshot with timeline frame 1.

## Source correction

`dndnext_sprite_export_runner.py` now detaches the Action in memory only when the armature contains the DNDNext deterministic pose library. Imported Action-based models retain normal sampling, and the saved `.blend` remains editable.

## Run 3 — technically successful animated Dawn

The corrected run:

- printed the deterministic Action-detachment message;
- rendered all 32 cells;
- passed automatic QA;
- produced four distinct images in each direction;
- preserved the South-first row order;
- maintained transparency and safe cell margins;
- kept the staff in Dawn's right hand;
- held horizontal pivot drift to approximately 0–1 pixel;
- stayed within configured baseline and silhouette tolerances.

This run proves the complete technical pipeline.

## Visual review result

The candidate is a valid functional prototype but is not the final accepted Dawn sprite.

Observed refinement needs:

- increase character presence within the cell by roughly 10–15%;
- reveal more boot and leg movement below the robe;
- strengthen contact and passing poses;
- reduce the impression of gliding;
- improve robe, armor, hair, and face separation at 1× runtime size.

The staff, flame, palette, directional rotation, and overall identity are working.

## Automated iteration path

`tools/blender/build_and_publish_dawn_whiteflame.ps1` builds, validates, and publishes the current candidate to branch `sprite-review/dawn-whiteflame`.

Publication is blocked unless automatic QA passes. The branch contains the generated `.blend`, atlas, 32 frames, metadata, QA JSON, HTML preview, and `publish.json` identifying the exact source commit.

Going forward:

- source and pose changes are made in the repository;
- the user runs one one-line PowerShell command;
- the generated result is pushed automatically;
- review and further adjustments happen directly from GitHub;
- no manual per-frame editing or repeated chat ZIP upload is required.

## Source pass 4 — Dawn visual refinement v2 prepared

A bundled procedural refinement was prepared with:

- orthographic scale reduced from `4.4` to `4.0` for about 10% more in-cell presence;
- robe and cape shortened and narrowed to expose the lower legs;
- boots and shins enlarged and separated;
- a small front robe split added to improve lower-body readability;
- contact poses strengthened to 42-degree lead-leg swings with larger knee and foot articulation;
- passing pose given a higher root position and clearer bent-knee silhouette;
- staff-side arm motion kept restrained;
- material values separated more strongly for ivory, gold, silver hair, armor, and boots;
- refinement version recorded as `dawn_grounded_walk_v2`.

## Run 4 — refinement v2 batch process crashed before frame 1

The v2 local run completed:

- procedural model creation;
- visual refinement application;
- Cycles CPU scene preparation;
- deterministic exporter dry-run validation;
- native first-frame Cycles probe.

The separate 32-frame Blender process then exited with Windows `EXCEPTION_ACCESS_VIOLATION`, reported to PowerShell as exit code `11`, immediately after detaching the Action and before rendering the first batch cell. No QA result or review artifact was published.

The batch path was hardened to:

- keep the dry run as the authoritative distinct-pose preflight;
- skip only the duplicate preflight inside the full-render process;
- retain rendered-pixel hashing and static-row rejection after rendering;
- retry native Blender exit code `11` once in a fresh process;
- preserve crash-report capture if both attempts fail.

## Run 5 — refinement v2 completed all frames; baseline QA blocked publication

The next local run proved the crash hardening:

- all 32 cells rendered successfully;
- rendered-frame uniqueness checks completed;
- atlas assembly reached automatic QA;
- no native Blender crash occurred.

Automatic QA correctly blocked publication for only two errors:

- Southwest (`down-left`) baseline drift: `4.00px`, limit `2.00px`;
- Northeast (`up-right`) baseline drift: `3.00px`, limit `2.00px`.

No static-row, crop, width, pivot, hierarchy, or render-completion error was reported in the terminal output. The larger v2 poses therefore work structurally, but their root-height excursion is too large in two opposite diagonal projections.

## Source pass 5 — baseline correction v2.1 prepared

The QA tolerance remained at two pixels. `dndnext_dawn_baseline_correction_v2_1.py` reduced only root-height excursion after the v2 visual refinement:

- frame 1 idle: `0.000`;
- frame 7 contact: `-0.020` instead of `-0.060`;
- frame 13 passing: `0.018` instead of `0.038`;
- frame 19 contact: `-0.020` instead of `-0.060`.

The script updates both the editable `Dawn_Walk` Action and the deterministic pose library while preserving stronger articulation and v2 geometry/material work.

## Run 6 — v2.1 improved but did not fully clear diagonal baseline QA

The v2.1 local run again rendered all 32 cells and reached automatic QA without a native crash. Both affected diagonal rows improved, but publication remained blocked:

- Southwest (`down-left`) baseline drift: `3.00px`, limit `2.00px`;
- Northeast (`up-right`) baseline drift: `3.00px`, limit `2.00px`.

The evidence shows that root-height adjustment alone cannot reliably absorb projection-dependent one-pixel rounding across all eight headings without iterative guessing.

## Source pass 6 — bounded rendered baseline normalization prepared

`tools/blender/dndnext_sprite_baseline_normalize.py` is a deterministic post-render fallback. It runs only when the completed exporter report failed exclusively on baseline drift.

The bounded baseline normalizer:

- reuses the already-rendered 32 PNGs; it does not rerender or manually repaint frames;
- touches only rows whose baseline drift exceeds the existing two-pixel limit;
- aligns affected walk cells to that row's idle-frame baseline;
- refuses any per-frame vertical shift larger than four pixels;
- refuses a shift that would violate the existing edge-margin requirement;
- reruns baseline, pivot, size, crop, visible-pixel, and static-row QA;
- rebuilds the atlas and preview from normalized frames;
- records every shift in both QA and metadata JSON;
- still blocks publication if any QA error remains.

PowerShell exit code `2` is handled only as this QA fallback. Native Blender exit code `11` retains its separate retry and crash-report behavior. The strict manifest baseline tolerance remains `2px`.

## Next run

Pull the bounded-normalizer source and rerun the one-line build/publish command. A qualifying baseline-only failure should be corrected automatically, rerun through full QA, and published only when the regenerated report says `passed: true`. The published candidate must then receive direct visual, Sprite Production Lab, and in-site review before Dawn is accepted.
