# DNDNext Tactical Sprite Production Art Bible

Status: production contract, revised 2026-08-04

The implementation sequence and active blocker are tracked in `Sprite_Production_Work_Map.md`.

## Canonical atlas

- transparent PNG;
- `256 × 512` pixels;
- 4 columns × 8 rows;
- `64 × 64` pixels per cell;
- column 1: idle/facing;
- columns 2–4: Walk A, Walk B, Walk C;
- playback: `idle → A → B → C → B → A`;
- target speed: 6–7 FPS, selected per character after visual review.

### Row order

1. South
2. Southwest
3. West
4. Northwest
5. North
6. Northeast
7. East
8. Southeast

The authoring and runtime sheets use this exact order. No mirroring, hidden remapping, or row conversion is permitted.

## Proven pipeline

The first complete local Blender render proved that the procedural model, rig, camera, Cycles CPU renderer, 32-frame export, atlas assembly, transparency, metadata, QA JSON, and HTML preview operate end to end.

The corrected source uses a **Deterministic pose library** stored on the armature. The exporter applies each tactical pose directly while preserving the editable Action. Generic imported models without this property continue to use Action sampling.

**Static rows are a build failure.** Every direction must contain at least three unique rendered frames. Transform signatures are checked before rendering and rendered pixels are hashed afterward.

## Visual approval is separate from automatic QA

Numeric QA proves format and structural consistency. It cannot prove that a character looks good or moves naturally.

A candidate that passes automatic QA must still be rejected when direct animation review shows:

- vertical twitch or snapping;
- foot sliding;
- awkward pose interpolation;
- non-humanoid proportions where a humanoid is intended;
- weak character identity;
- muddy or bell-shaped silhouette;
- unstable equipment;
- motion that reads as gliding rather than walking.

The rejected Dawn v2.2 candidate is the controlling example: individual PNG shifts produced acceptable baseline numbers but visible twitch.

## Final-frame registration rule

Per-frame post-render movement is prohibited for final production candidates. Baseline and pivot defects must be fixed in the rig, pose library, geometry, or camera before rendering.

A diagnostic normalizer may remain available for investigation, but normalized output cannot be registered or assigned as final art. Dawn's active manifest therefore sets automatic baseline normalization to `false` with a zero-pixel allowance.

## Visual direction

Sprites should combine grounded dark-fantasy materials with clean tactical readability.

- approximately 5.5–6 heads tall;
- slightly enlarged hands, feet, weapon thickness, and signature equipment;
- broad readable hair and cloth shapes;
- restrained palette with one strong accent;
- controlled body motion and little or no whole-sprite bob;
- no photoreal micro-detail, heavy bloom, dense particles, or fragile dangling geometry.

Dawn Whiteflame should read as:

- adult silver-haired divine caster;
- ivory split tabard and restrained cape;
- pale-gold armor accents;
- visible dark leggings and boots;
- tall gold staff with compact white-gold flame;
- staff fixed in the same hand across all directions and frames;
- upright, controlled posture;
- human proportions rather than a cone-robed mannequin.

## Directional requirements

Direction must be communicated by torso, pelvis, feet, head, and equipment.

- South: full front
- Southwest: front-left three-quarter
- West: clean left profile
- Northwest: back-left three-quarter
- North: full back
- Northeast: back-right three-quarter
- East: clean right profile
- Southeast: front-right three-quarter

Mirroring is forbidden for asymmetric characters unless manually corrected. It must never reverse weapon hand, shield side, scars, mechanical limbs, cape fasteners, or pouches.

## Animation requirements

- exactly four sampled poses: idle, Walk A, Walk B, Walk C;
- at least three unique rendered images per row;
- identical cell dimensions and stable pivot;
- feet share one baseline;
- planted foot does not slide;
- body scale does not change;
- weapon length and staff height remain constant;
- equipment never changes hands;
- first and last playback positions transition without a snap;
- motion remains visible but restrained at actual `64 × 64` size;
- root-height changes must not create whole-sprite pixel jumps.

A valid Action name or four keyframes is not proof of acceptable animation.

## Required QA

Use `/admin/sprite-lab` before registering a sprite.

Automatic gates:

- exact dimensions and PNG transparency;
- correct South-first order;
- distinct deterministic pose signatures;
- at least three unique rendered images per row;
- safe alpha edge margins;
- baseline, pivot, height, and width within manifest limits;
- no post-render frame shift for final candidates.

Manual gates:

- unmistakable eight facings;
- stable pivot and baseline;
- readable silhouette at 1× size;
- clean six-step loop;
- consistent handedness and equipment;
- no blur, flicker, crop, glow bleed, vertical twitch, or foot sliding;
- character is visually acceptable to the user.

Only a sheet that passes every gate may be uploaded through `/admin/sprite-assets`.

## 3D-assisted production workflow

1. Approve a character design target.
2. Build one rigged model.
3. Apply idle plus three restrained walk poses.
4. Store deterministic pose snapshots alongside the editable Action.
5. Use the fixed orthographic camera and lighting rig.
6. Rotate through the eight canonical headings.
7. Render all 32 frames without per-frame post-processing shifts.
8. Reject static rows or strict QA failures.
9. Inspect the animation at actual runtime size.
10. Correct the model, rig, poses, or camera and rerender where needed.
11. Validate in Sprite Production Lab and the site.
12. Register only after explicit visual approval.

## Dawn active source path

- `tools/blender/dndnext_dawn_model_builder.py`: base geometry, materials, rig, staff, flame, Action, and pose library.
- `tools/blender/dndnext_dawn_visual_refinement_v3.py`: humanoid proportions, split tabard/cape, visible legs, stable staff arm, and zero-bob walk.
- `tools/blender/dndnext_dawn_prepare_scene.py`: fixed orthographic Cycles CPU scene.
- `tools/blender/dndnext_sprite_export.py`: deterministic rendering, static-row rejection, atlas, and QA.
- `tools/blender/build_dawn_whiteflame.ps1`: build, dry run, probe, full render, crash retry, and QA.
- `tools/blender/DAWN_PROCEDURAL_MODEL.md`: operator handoff.

Older v2 geometry, root-height correction, and frame-normalization files remain only as reproducible failure history. They are not in Dawn's active final-candidate path.

## Production sequence after Dawn

1. Dawn Whiteflame
2. requested isolated UI quick fix
3. Leso Varen — Autognome mechanical silhouette
4. Varges — Bugbear long-arm and greataxe silhouette
5. reusable model families
6. broader NPC batches

Every character is approved independently. Shared tooling does not waive visual review.

## Protected boundaries

Sprite production must not alter world-map movement, routes, weather, camps, town-map behavior, encounter legality, combat, inventory, crafting, spells, progression, or Supabase schema/data. The renderer is visual-only.
