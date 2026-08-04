# DNDNext Tactical Sprite Production Art Bible

Status: production contract, reconciled 2026-08-04

The implementation sequence, evidence, active blocker, and remaining work are mapped in `Sprite_Production_Work_Map.md`.

## Canonical atlas

DNDNext uses one sprite-sheet layout for authoring, quality assurance, storage, and runtime rendering.

- PNG with transparency
- 256 × 512 pixels
- 4 columns × 8 rows
- 64 × 64 pixels per cell
- Column 1: idle/facing frame
- Columns 2–4: walk frames A, B, and C
- Playback: `idle → A → B → C → B → A`
- Target frame rate: 7 FPS

### Row order

1. South
2. Southwest
3. West
4. Northwest
5. North
6. Northeast
7. East
8. Southeast

The authoring sheet and runtime sheet use the same order. No row conversion, mirroring, or hidden remapping is permitted.

## Verified Dawn pipeline status

The first complete local Blender run proved that the procedural model, rig, camera, Cycles CPU renderer, 32-frame export, atlas assembly, transparency, metadata, QA JSON, and HTML preview operate end to end.

That review also found that all four columns in every direction row were pixel-identical. The old automatic checks verified framing but did not prove movement. Dawn therefore remains a prototype and is not approved for Sprite Library registration or permanent character assignment.

The corrected source uses a **Deterministic pose library** stored on Dawn's armature. The exporter applies each of the four tactical poses directly before rendering while retaining the editable `Dawn_Walk` Action. Generic imported models without this property continue to use normal Action sampling.

**Static rows are a build failure.** Every direction row must now contain at least three unique rendered frames. Pose signatures are checked before rendering, rendered pixel data are hashed afterward, and either form of duplication prevents automatic QA from passing.

## Visual direction

The tactical model should combine grounded dark-fantasy materials with clean tactical readability.

- approximately 5.5–6 heads tall
- slightly enlarged head, hands, feet, weapon thickness, and signature equipment
- broad, readable hair and cloth shapes
- restrained color palette with one strong character accent
- limited idle motion and controlled walk-cycle body bob
- no photoreal micro-detail, heavy bloom, dense particles, or fragile dangling geometry

Dawn Whiteflame is the first production prototype:

- adult silver-haired divine caster
- ivory robes and pale-gold armor accents
- dark boots and restrained leather details
- tall gold staff with compact white-gold flame
- staff stays in the same hand across all eight directions
- upright, controlled posture
- warm radiant focal point against a muted palette

## Directional requirements

Direction must be communicated by torso, pelvis, feet, head, and equipment—not only by face or eye direction.

- South: full front
- Southwest: front-left three-quarter
- West: clean left profile
- Northwest: back-left three-quarter
- North: full back
- Northeast: back-right three-quarter
- East: clean right profile
- Southeast: front-right three-quarter

Mirroring is forbidden for asymmetric characters unless the result is manually corrected. Mirroring must never reverse weapon hand, shield side, staff position, scars, mechanical limbs, cape fasteners, or pouches.

## Animation requirements

- exactly four sampled poses: idle, walk A, walk B, and walk C
- at least three unique rendered images per direction row
- identical cell dimensions and pivot in all 32 frames
- feet share one baseline
- planted foot does not slide
- body scale does not change between frames
- weapon length and staff height remain constant
- equipment never changes hands
- cloak and hair follow body motion rather than leading it
- first and last playback positions transition without a snap
- motion must remain visible at actual 64 × 64 runtime scale

A valid Action name or four keyframe numbers is not proof of animation. The sampled pose transforms and rendered pixels must differ.

## Required QA

Use `/admin/sprite-lab` before registering a sprite.

Automatic gates:

- exact 256 × 512 dimensions
- PNG format
- transparency detected
- four distinct sampled pose signatures for deterministic models
- at least three unique rendered images per direction row
- alpha remains within cell-edge tolerances
- baseline, pivot, height, and width drift remain within the manifest limits

### Bounded baseline normalization

Projection and pixel rounding can produce a small baseline discrepancy even when the rigged walk is otherwise valid. A bounded baseline normalizer is permitted only under all of these conditions:

- the full render completed all 32 cells;
- the generated QA report failed exclusively on baseline drift;
- affected cells are aligned to their own direction row's idle-frame baseline;
- no frame moves more than the manifest safety cap, currently `4px`;
- no correction violates cell-edge margins;
- the final strict baseline gate remains `2px` and is not relaxed;
- every metric and static-row check is rerun after normalization;
- every pixel shift is written to QA and metadata JSON;
- the normalized result receives the same visual and in-site review as an unshifted render.

This is deterministic frame registration, not manual repainting. Non-baseline QA errors, large corrections, clipping risk, or remaining failures must still stop publication.

Manual gates:

- idle column reads S, SW, W, NW, N, NE, E, SE
- no duplicate facing rows
- stable pivot and foot baseline
- readable silhouette at 1× runtime size
- clean six-step loop
- consistent handedness and equipment
- no blur, detail flicker, frame crop, glow bleed, or visible foot sliding

Only a sheet that passes every gate should be uploaded through `/admin/sprite-assets`.

## 3D-assisted production workflow

1. Approve a multi-view character design sheet.
2. Build or obtain one rigged character model.
3. Apply one approved four-pose walk cycle: idle plus three unique walking poses.
4. For procedural production models, store explicit deterministic pose snapshots alongside the editable Action.
5. Use an orthographic camera at a fixed elevation and distance.
6. Rotate the character or camera to the eight canonical headings.
7. Render all 32 frames with identical lighting, scale, pivot, and transparent background.
8. Reject any direction row with fewer than three unique rendered images.
9. Apply bounded idle-anchored baseline normalization only when the completed QA failure is baseline-only and within the manifest cap.
10. Rerun all automatic checks and assemble the atlas in canonical South-first order.
11. Inspect and animate it in Sprite Production Lab.
12. Register the approved sheet in Sprite Library.
13. Test it at both overworld and tactical scales before permanent assignment.

## Dawn procedural prototype

The first real model stage is source-controlled and repeatable:

- `tools/blender/dndnext_dawn_model_builder.py` creates the stylized Dawn geometry, materials, 18-bone rig, right-hand staff, divine flame, editable four-pose `Dawn_Walk` Action, and deterministic tactical pose library.
- `tools/blender/dndnext_dawn_visual_refinement_v2.py` improves scale, pose readability, boots, robe, materials, and staff stability.
- `tools/blender/dndnext_dawn_baseline_correction_v2_1.py` preserves the editable model while reducing large procedural root-height excursion.
- `tools/blender/dndnext_dawn_prepare_scene.py` creates and saves the orthographic camera and three-light Cycles CPU sprite scene.
- `tools/blender/dndnext_sprite_export.py` applies deterministic poses when present, falls back to Action sampling for generic models, renders all cells, rejects static rows, assembles the atlas, and generates QA output.
- `tools/blender/dndnext_sprite_baseline_normalize.py` performs the bounded, report-driven baseline-only fallback and regenerates all artifacts and QA.
- `tools/blender/build_dawn_whiteflame.ps1` runs the complete Windows pipeline, including native-crash retry and bounded QA fallback.
- `tools/blender/DAWN_PROCEDURAL_MODEL.md` is the operator and refinement handoff.

This generated model is intentionally a functional tactical blockout. It proves silhouette, handedness, rig, pose timing, camera, lighting, exporter compatibility, and deterministic frame registration. Later sculpting, topology, texture, hair, robe, and armor refinements should preserve the established object names, bone names, action, root, pose-library schema, manifest, and exporter contract.

## Blender export kit

- `tools/blender/dndnext_sprite_scene_setup.py` creates the standard root, orthographic camera, and three-light rig around an existing model.
- `tools/blender/dndnext_sprite_export.py` renders the 32 frames, assembles the atlas, measures alpha bounds, proves pose/frame uniqueness, and writes the animated QA report.
- `tools/blender/dndnext_sprite_baseline_normalize.py` permits only bounded, documented, baseline-only frame registration and reruns full QA.
- `tools/blender/manifests/dawn_whiteflame.sprite.json` locks Dawn's South-first yaws, scene object names, pose frames, Cycles CPU settings, minimum unique-frame threshold, strict QA tolerances, and normalization cap.
- `tools/blender/README.md` contains the generic operator workflow for imported or manually sculpted models.

## Production sequence after Dawn

Do not begin a three-character batch until Dawn passes a corrected real render and Sprite Production Lab review.

Approved order:

1. Dawn Whiteflame
2. Leso Varen — Autognome mechanical silhouette
3. Varges — Bugbear long-arm and greataxe silhouette
4. reusable class/species model families
5. broader NPC batches

Every character is produced and approved independently. Shared tooling does not waive per-character direction, motion, silhouette, handedness, or normalization review.

## Protected boundaries

Sprite production work must not change world-map movement, route advancement, weather, camps, town-map behavior, encounter movement legality, combat state, inventory, crafting, spells, or progression. The sprite renderer is visual-only; movement engines continue to supply position, facing, and moving state.
