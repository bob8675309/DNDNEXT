# DNDNext Tactical Sprite Production Art Bible

Status: production contract, 2026-08-03

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

- identical cell dimensions and pivot in all 32 frames
- feet share one baseline
- planted foot does not slide
- body scale does not change between frames
- weapon length and staff height remain constant
- equipment never changes hands
- cloak and hair follow body motion rather than leading it
- first and last playback positions transition without a snap

## Required QA

Use `/admin/sprite-lab` before registering a sprite.

Automatic gates:

- exact 256 × 512 dimensions
- PNG format
- transparency detected

Manual gates:

- idle column reads S, SW, W, NW, N, NE, E, SE
- no duplicate facing rows
- stable pivot and foot baseline
- readable silhouette at 1× runtime size
- clean six-step loop
- consistent handedness and equipment
- no blur, detail flicker, frame crop, or glow bleed

Only a sheet that passes every gate should be uploaded through `/admin/sprite-assets`.

## 3D-assisted production workflow

1. Approve a multi-view character design sheet.
2. Build or obtain one rigged character model.
3. Apply one approved four-pose walk cycle: idle plus three unique walking poses.
4. Use an orthographic camera at a fixed elevation and distance.
5. Rotate the character or camera to the eight canonical headings.
6. Render all 32 frames with identical lighting, scale, pivot, and transparent background.
7. Assemble the atlas in the canonical South-first row order.
8. Inspect and animate it in Sprite Production Lab.
9. Register the approved sheet in Sprite Library.
10. Test it at both overworld and tactical scales before assigning it to a character.

## Dawn procedural prototype

The first real model stage is source-controlled and repeatable:

- `tools/blender/dndnext_dawn_model_builder.py` creates the stylized Dawn geometry, materials, 18-bone rig, right-hand staff, divine flame, and four-pose `Dawn_Walk` action.
- `tools/blender/dndnext_dawn_prepare_scene.py` creates and saves the orthographic camera and three-light sprite scene.
- `tools/blender/build_dawn_whiteflame.ps1` runs model creation, scene preparation, dry-run validation, the 32-frame render, atlas assembly, and QA generation in one Windows command.
- `tools/blender/DAWN_PROCEDURAL_MODEL.md` is the operator and refinement handoff.

This generated model is intentionally a functional tactical blockout. It proves silhouette, handedness, rig, pose timing, camera, lighting, and exporter compatibility. Later sculpting, topology, texture, hair, robe, and armor refinements should preserve the established object names, bone names, action, root, manifest, and exporter contract.

## Blender export kit

- `tools/blender/dndnext_sprite_scene_setup.py` creates the standard root, orthographic camera, and three-light rig around an existing model.
- `tools/blender/dndnext_sprite_export.py` renders the 32 frames, assembles the atlas, measures alpha bounds, and writes the animated QA report.
- `tools/blender/manifests/dawn_whiteflame.sprite.json` locks Dawn's South-first yaws, scene object names, pose frames, render settings, and QA tolerances.
- `tools/blender/README.md` contains the generic operator workflow for imported or manually sculpted models.

## Protected boundaries

Sprite production work must not change world-map movement, route advancement, weather, camps, town-map behavior, encounter movement legality, or combat state. The sprite renderer is visual-only; movement engines continue to supply position, facing, and moving state.
