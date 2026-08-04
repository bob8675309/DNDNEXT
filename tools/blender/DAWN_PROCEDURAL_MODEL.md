# Dawn Whiteflame Procedural Blender R&D Handoff

Status: technical pipeline reference; primitive visual source rejected, 2026-08-04

The active production plan is `docs/Dawn_High_Quality_Prototype_Plan.md`. Current status and sequence are tracked in `docs/Sprite_Production_Work_Map.md`. Real attempt evidence is recorded in `docs/Sprite_Production_Run_Log.md`.

## Current conclusion

The procedural Dawn model successfully proved the DNDNext sprite pipeline but is not an acceptable final visual source.

The model uses Blender primitives, rigid bone parenting, simplified materials, and blockout anatomy. It was valuable for validating rig names, equipment handedness, deterministic pose sampling, camera, rendering, atlas assembly, and QA. Direct comparison with the user's detailed Dawn concept sheet and high-quality chibi tactical sprite reference showed that incremental primitive-model polishing is not an efficient route to the required art quality.

Do not describe this model as nearly finished. Do not begin another full 32-cell production pass from it unless the task is explicitly a pipeline regression test.

## What the prototype proved

The **first complete local Blender render** proved that the repository can generate:

- a rigged `.blend` source;
- transparent frame PNGs;
- the canonical `256 × 512` South-first atlas;
- runtime metadata;
- QA JSON;
- an animated HTML preview.

Subsequent work proved:

- explicit deterministic pose snapshots;
- Action detachment preventing timeline override;
- rendered-pixel hashing and static-row rejection;
- strict crop, baseline, pivot, width, and height checks;
- Windows Cycles CPU rendering;
- review artifact publication;
- `isolated_prepared_blend_per_cell_v1` fault isolation.

PR #165 merged as `f91949006ebbee994ca5fc532f4210eeaddf6d40`. Its local run rendered all 32 cells in fresh Blender processes, assembled the atlas, passed automatic QA, and published the review package.

That run validates the technical pipeline only. The Dawn v3 visual asset remains rejected.

## Retained infrastructure

Keep and reuse:

- `dndnext_dawn_prepare_scene.py` — camera, lighting, transparency, and Cycles CPU scene setup;
- `dndnext_sprite_export.py` — shared deterministic pose and QA primitives;
- `dndnext_sprite_export_runner.py` — Action-detachment safeguard;
- `dndnext_sprite_prepare_isolated_cell.py` — one-cell pose freezing and temporary blend creation;
- `dndnext_sprite_assemble_isolated_frames.py` — exact-frame validation, atlas, metadata, QA, and preview;
- `build_dawn_whiteflame.ps1` — current isolated-cell orchestration and cleanup;
- `build_and_publish_dawn_whiteflame.ps1` — QA-gated review publication;
- `tools/blender/manifests/dawn_whiteflame.sprite.json` — canonical direction, timing, camera, render, and QA contract.

These systems should accept a substantially better Dawn source asset rather than being rebuilt.

## Historical procedural source

The following files remain as reproducible R&D evidence:

- `dndnext_dawn_model_builder.py`;
- `dndnext_dawn_visual_refinement_v2.py`;
- `dndnext_dawn_baseline_correction_v2_1.py`;
- `dndnext_dawn_visual_refinement_v3.py`;
- diagnostic baseline-normalization tooling.

They record lessons about static frames, Action evaluation, baseline rounding, post-render twitch, primitive silhouette limits, and Blender process instability.

The v2/v2.1 normalizer path is not permitted for final art. The v3 primitive source is not the active quality path.

## Active replacement path

The next deliverable is not a full atlas. It is one high-quality South-facing prototype:

- one idle frame;
- three compatible walk frames;
- a large review render;
- an actual-size six-step animation.

The source should approach both:

- the detailed Dawn concept design;
- the user's high-quality chibi tactical sprite sample.

Blender remains the preferred rigging, animation, camera, and render host. The visual source may come from a better modeled asset, a free or acceptably licensed character program, a Blender plug-in, or a controlled 2D/3D hybrid workflow.

Before adopting an external source tool, verify licensing, Blender export, riggability, multi-angle consistency, source reproducibility, and usefulness for later humanoid variants.

## Quality gate before eight directions

Do not expand the source asset to eight directions until the South prototype:

- clearly resembles Dawn;
- has readable face and silver hair;
- shows layered ivory cloth, gold armor, dark leather, legs, boots, cape, staff, and flame;
- uses deliberate chibi tactical proportions;
- animates without twitch, snapping, gliding, or frame shifting;
- remains crisp at gameplay size;
- receives explicit user approval.

After approval, connect the new source to the retained isolated renderer and canonical atlas pipeline.

## Pipeline regression command

The current primitive pipeline can still be run for technical regression evidence. The user prefers one-line PowerShell commands:

```powershell
cd C:\dnd\dndnext; git switch main; git pull --ff-only origin main; & ".\tools\blender\build_and_publish_dawn_whiteflame.ps1" -BlenderPath "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
```

Do not ask the user to run this again merely to produce another visually similar primitive atlas.

## Expected technical outputs

`build/sprites/dawn-whiteflame/` may contain:

- `dawn_whiteflame_model.blend`;
- `dawn-whiteflame.png`;
- `dawn-whiteflame.metadata.json`;
- `dawn-whiteflame.qa.json`;
- `dawn-whiteflame.qa.html`;
- `frames/` with 32 canonical PNGs;
- optional Blender crash evidence.

Approved outputs publish under `sprite-review/dawn-whiteflame`. Publication is not visual approval.

## Approval state

- canonical runtime contract: proven;
- deterministic animation and static-row QA: proven;
- isolated cell rendering: proven;
- review publishing: proven;
- procedural primitive source as final art: rejected;
- high-quality South prototype: not started;
- full high-quality eight-direction atlas: blocked on South approval;
- Sprite Production Lab final approval: pending;
- Sprite Library registration: pending;
- Dawn assignment: pending;
- requested quick UI fix: queued after Dawn completion.

## Protected boundaries

This tooling is offline and visual-only. It does not connect to Supabase, change sprite assignments, modify world-map movement, alter town maps, write encounter state, or change inventory, crafting, equipment, spells, or progression.