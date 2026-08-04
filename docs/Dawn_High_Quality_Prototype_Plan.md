# Dawn Whiteflame High-Quality Prototype Plan

Status: active production plan, 2026-08-04

This document controls the next Dawn milestone. It supersedes any older instruction to keep polishing the primitive procedural model into final art.

## Decision

The current procedural Dawn model is retained as technical R&D evidence but is rejected as the final visual source.

The project has already proved:

- deterministic pose sampling;
- Windows-safe Cycles CPU scene preparation;
- isolated per-cell rendering through fresh Blender processes;
- exact South-first atlas assembly;
- structural QA, static-row rejection, metadata, preview, and review-branch publishing.

The remaining blocker is source-asset quality. More incremental work on cubes, cones, cylinders, and rigidly parented blockout pieces is not expected to reach the requested visual standard efficiently.

## Binding visual target

Two user-provided references define the target together:

1. **Dawn concept sheet** — design fidelity:
   - adult silver-haired divine caster;
   - recognizable face and long detailed hair;
   - layered ivory cloth, pale-gold armor, dark leather, boots, belts, and cape;
   - ornate tall gold staff with a bright divine flame;
   - elegant grounded-fantasy identity.
2. **Small chibi tactical sprite reference** — gameplay translation:
   - compact readable proportions;
   - clear face, hair, clothing layers, weapon, and silhouette at small size;
   - crisp edges and deliberate value grouping;
   - character identity that survives tactical-board scale.

The concept sheet controls character design. The chibi sample controls scale, simplification, and readability. A technically valid render that does not approach both references is not acceptable.

The reference images were supplied in chat and are not currently committed to the repository. A new session should ask the user to reattach them when direct visual comparison is required.

## Active milestone: South-facing prototype only

Do not begin another complete 32-cell atlas yet.

The next deliverable is one high-quality South-facing prototype containing:

- one approved idle frame;
- three compatible walk frames;
- the six-step playback `0 → 1 → 2 → 3 → 2 → 1`;
- a short animated preview at actual intended runtime scale;
- a larger review render for inspecting design fidelity.

Only after the user approves this South-facing prototype should the asset be expanded to Southwest, West, Northwest, North, Northeast, East, and Southeast.

## Source-asset strategy

Blender remains the preferred rigging, animation, camera, and rendering host because the existing DNDNext pipeline is already integrated with it. Blender primitives are no longer required as the visual source.

The source asset may come from:

- a substantially higher-quality modeled and textured Blender asset;
- a free or acceptably licensed character-creation program with Blender export or a dependable Blender plug-in;
- a controlled 2D/3D hybrid workflow;
- an externally generated base that can be legally stored, rigged, edited, and reproduced.

Before adopting another program or plug-in, verify:

- current availability and maintenance status;
- free or acceptable licensing for project use and redistribution;
- export format and Blender compatibility;
- whether the result can be rigged and posed consistently;
- whether one asset can produce all eight directions without identity drift;
- whether source files can be stored or reproducibly regenerated;
- whether the workflow reduces work for later body-family variants.

Potential support tools may include Krita or LibreSprite for controlled paintover and inspection, and optional local AI tooling for concept, texture, or cleanup assistance. These tools must not become a manual 32-cell repaint requirement for the user.

The exact external source program or plug-in has not yet been selected. Tool evaluation is part of the next phase, not a decision to assume silently.

## Quality requirements for the South prototype

The prototype must:

- look recognizably like Dawn rather than a generic mannequin;
- preserve the silver hair, divine staff, ivory/gold/dark palette, cape, boots, and layered outfit;
- use intentional chibi tactical proportions without becoming toy-like or blob-shaped;
- have a readable face and hair mass;
- separate armor, cloth, leather, legs, boots, staff, and flame through shape and value;
- keep the staff in the same hand and stable through the cycle;
- show visible grounded foot travel;
- avoid whole-sprite twitch, snapping, gliding, or post-render frame shifting;
- remain crisp at gameplay size;
- retain enough source resolution for later polish and downsampling.

## Recommended production sequence

### Phase A — select and prove the source workflow

1. Audit the current high-quality source options and plug-in paths.
2. Prefer a reusable humanoid source over a one-off image trick.
3. Produce one South-facing Dawn idle test before building a walk.
4. Reject the source route early if it cannot approach the references.

### Phase B — South idle and walk

1. Build or import the detailed source asset.
2. Establish the approved proportions, camera, lighting, and downsampling method.
3. Rig the asset using reusable humanoid conventions.
4. Create idle plus three restrained walk poses.
5. Render at a higher working resolution than the final 64-pixel cell.
6. Downsample using a controlled, repeatable method.
7. Review the large render and actual-size animation.
8. Refine until explicitly approved.

### Phase C — full eight-direction Dawn

1. Expand the approved asset to all eight canonical headings.
2. Preserve equipment handedness and asymmetric details.
3. Use the proven isolated renderer where appropriate.
4. Assemble the `256 × 512` South-first atlas.
5. Run automatic QA, Sprite Production Lab, and site-scale tests.
6. Register and assign only after explicit approval.

### Phase D — reuse

After Dawn is accepted:

- extract a reusable human/elf-like humanoid family;
- pause for the requested isolated UI quick fix;
- establish a small mechanical family for Leso Varen;
- establish a large brute-humanoid family for Varges;
- convert later characters into controlled variants rather than fresh R&D projects.

## Body-family plan

- **Humanoid family:** humans, elves, similar player and NPC bodies; Dawn is the first quality reference.
- **Small mechanical family:** Autognomes and compact constructed characters; Leso is the first reference.
- **Large brute family:** Bugbears, broad warriors, and long-arm silhouettes; Varges is the first reference.

Each family may share rig conventions, camera, animation timing, render isolation, QA, and publishing. Character identity, equipment, silhouette, and visual approval remain individual gates.

## Retained infrastructure

Do not discard or recreate these working systems:

- canonical `4 × 8`, South-first atlas contract;
- deterministic pose-library support;
- Action-detachment safeguards;
- `isolated_prepared_blend_per_cell_v1` rendering;
- exact 32-frame assembly and static-row QA;
- review artifact publishing to `sprite-review/dawn-whiteflame`;
- Sprite Production Lab and runtime metadata.

These systems become active again after the South-facing quality prototype is approved.

## Stop conditions

Stop and reconsider the source workflow when:

- the idle frame still reads as generic or primitive after one focused source pass;
- design fidelity depends on manually repainting every final cell;
- the tool cannot maintain identity across directions;
- licensing or source reproducibility is unclear;
- the workflow would require the user to manually adjust frames;
- later characters would repeat the same one-off labor.

## Completion definition

Dawn is not finished when automatic QA passes. Dawn is finished only when:

1. the South prototype is explicitly approved;
2. the approved design is expanded to eight unmistakable directions;
3. the final walk is smooth and grounded at runtime size;
4. the final atlas passes structural QA without frame shifting;
5. Sprite Production Lab and in-site checks pass;
6. the source asset, workflow, settings, accepted outputs, and failure history are documented;
7. the atlas is registered and assigned reversibly.

After that, the requested UI quick fix becomes the immediate next task.