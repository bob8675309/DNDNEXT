# DNDNext Sprite Production Run Log

Status date: 2026-08-03

This log records real local Blender evidence. It supplements `Sprite_Production_Work_Map.md`; it does not replace the canonical atlas contract or the manual approval gates in Sprite Production Lab.

## Dawn Whiteflame — first complete render

The first Cycles CPU run completed:

- procedural model creation;
- orthographic scene preparation;
- hierarchy validation;
- first-frame safety probe;
- all 32 frame renders;
- atlas assembly;
- metadata, QA JSON, and HTML preview creation.

Review then showed that every four-frame direction row was static. The original automatic QA measured dimensions, alpha bounds, baseline, pivot, width, and height, but did not compare rendered-frame identity.

## Dawn Whiteflame — static-row QA rerun

After deterministic pose data and rendered-pixel hashing were added, the next local run rendered all 32 files and correctly failed automatic QA:

- all eight rows contained only one unique rendered frame;
- the required threshold was three unique frames per row;
- no atlas was accepted or registered.

This failure proved that the new static-row gate works.

## Root cause

The exporter directly applied a deterministic pose snapshot while the editable `Dawn_Walk` Action remained assigned to `Dawn_Rig`. Blender reevaluated the current timeline frame when each render began. That render-time evaluation overwrote the direct snapshot with frame 1, so every column rendered the idle pose even though pre-render pose signatures were distinct.

## Source correction

The one-command Dawn pipeline now invokes `tools/blender/dndnext_sprite_export_runner.py`.

The runner:

1. loads the canonical core exporter;
2. assigns the requested Action normally;
3. detects the DNDNext deterministic pose library;
4. detaches the Action in memory before pose validation and rendering;
5. delegates atlas rendering and automatic QA to the unchanged core exporter.

Imported models without a deterministic pose library continue using normal Action sampling. The prepared `.blend` file is not resaved during export, so its editable `Dawn_Walk` Action remains intact on disk.

## Next evidence required

Run the current `main` build again. Acceptance requires:

- the console message `Detached Blender Action for deterministic pose rendering.` during dry-run and render stages;
- at least three unique rendered frames in every direction row;
- automatic QA success;
- visual review of the HTML preview;
- `/admin/sprite-lab` approval for direction, pivot, baseline, handedness, crop, blur, and loop quality.

Dawn remains unapproved and unassigned until all of those gates pass.
