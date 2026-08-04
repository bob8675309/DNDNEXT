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

## Isolated cell rendering

Long-lived Blender render processes are not a production requirement. When a platform or Blender version is unstable across repeated dependency-graph updates, final candidates use `isolated_prepared_blend_per_cell_v1`:

1. open the prepared master model in a short-lived process;
2. apply one canonical direction and deterministic pose;
3. detach the Action and save a temporary pose-frozen `.blend`;
4. render that blend through Blender's native `--render-frame` command in a fresh process;
5. retry only that cell after a native crash;
6. delete the temporary blend after success;
7. assemble and validate only after all 32 canonical PNGs exist.

This is fault isolation, not visual post-processing. It must not move, repaint, normalize, or otherwise alter rendered PNGs. The assembler must reject missing files, unexpected files, static rows, bad bounds, and metric drift using the same QA contract as the core exporter.

The first isolated implementation may be slower because Blender starts repeatedly. Reliability is the priority; startup optimization comes only after the path is proven across Dawn, Leso, and Varges.

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
- exact canonical frame file set for isolated rendering;
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
7. Prepare and render all 32 cells without per-frame post-processing shifts.
8. Reject missing cells, static rows, or strict QA failures.
9. Assemble the canonical atlas only after every frame passes file-level checks.
10. Inspect the animation at actual runtime size.
11. Correct the model, rig, poses, or camera and rerender where needed.
12. Validate in Sprite Production Lab and the site.
13. Register only after explicit visual approval.

## Dawn active source path

- `tools/blender/dndnext_dawn_model_builder.py`: base geometry, materials, rig, staff, flame, Action, and pose library.
- `tools/blender/dndnext_dawn_visual_refinement_v3.py`: humanoid proportions, split tabard/cape, visible legs, stable staff arm, and zero-bob walk.
- `tools/blender/dndnext_dawn_prepare_scene.py`: fixed orthographic Cycles CPU scene.
- `tools/blender/dndnext_sprite_prepare_isolated_cell.py`: one-cell pose freezing and temporary blend creation.
- `tools/blender/dndnext_sprite_assemble_isolated_frames.py`: exact-frame validation, atlas assembly, metadata, QA, and preview.
- `tools/blender/dndnext_sprite_export.py`: shared deterministic pose and QA primitives.
- `tools/blender/build_dawn_whiteflame.ps1`: build, dry run, probe, isolated cell orchestration, cleanup, and QA.
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
