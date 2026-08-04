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

A bundled procedural refinement is ready for the next real render:

- orthographic scale reduced from `4.4` to `4.0` for about 10% more in-cell presence;
- robe and cape shortened and narrowed to expose the lower legs;
- boots and shins enlarged and separated;
- a small front robe split added to improve lower-body readability;
- contact poses strengthened to 42-degree lead-leg swings with larger knee and foot articulation;
- passing pose given a higher root position and clearer bent-knee silhouette;
- staff-side arm motion kept restrained;
- material values separated more strongly for ivory, gold, silver hair, armor, and boots;
- refinement version recorded as `dawn_grounded_walk_v2`.

This is source status, not render evidence. It must not be described as visually successful until the Windows Blender run publishes a passing candidate.

## Next run

Run the one-line build/publish command. Automatic QA must pass before artifacts are published. Review then determines whether v2 is final or whether one more procedural adjustment is required. Dawn remains unregistered and unassigned until visual and site-level gates pass.
