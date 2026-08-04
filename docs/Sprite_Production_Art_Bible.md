# DNDNext Tactical Sprite Production Art Bible

Status: production contract, revised 2026-08-04

The active Dawn milestone is defined in `Dawn_High_Quality_Prototype_Plan.md`. Implementation status and remaining work are tracked in `Sprite_Production_Work_Map.md`.

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

## Proven technical pipeline

The pipeline supports a **Deterministic pose library**, Action detachment, exact canonical file naming, isolated native rendering, atlas assembly, metadata, automatic QA, HTML animation preview, and review-branch publishing.

**Static rows are a build failure.** Every direction must contain at least three unique rendered frames. Transform signatures are checked before rendering and rendered pixels are hashed afterward.

The technical pipeline is retained. It does not define the minimum art quality.

## Visual approval is separate from automatic QA

Numeric QA proves format and structural consistency. It cannot prove that a character looks good, matches the concept, or moves naturally.

A candidate that passes automatic QA must still be rejected when direct review shows:

- vertical twitch, snapping, or foot sliding;
- awkward pose interpolation;
- weak or generic character identity;
- primitive mannequin anatomy;
- muddy, bell-shaped, or unreadable silhouette;
- poor face or hair readability;
- missing cloth, armor, leather, or equipment separation;
- unstable equipment;
- motion that reads as gliding rather than walking;
- a large quality gap from the approved references.

The rejected Dawn v2.2 and v3 procedural candidates are controlling examples. Passing QA did not make them production art.

## Reference hierarchy

For Dawn and later named characters, references have explicit roles:

1. **Approved character concept** controls identity, costume, equipment, palette, materials, and important asymmetric details.
2. **Approved tactical/chibi sample** controls proportion, simplification, edge clarity, and small-scale readability.
3. **Runtime constraints** control cell size, anchor, direction order, animation timing, and equipment consistency.

Do not simplify a character until the result becomes generic. Do not preserve concept micro-detail that creates noise at runtime size. The final asset must translate the concept, not merely copy or ignore it.

## Source-asset quality standard

A final named-character source should provide:

- recognizable face and hair silhouette;
- deliberate body proportions;
- layered clothing and armor rather than one undifferentiated mass;
- readable hands, legs, and boots;
- stable signature equipment;
- clean material/value grouping;
- sufficient working resolution for controlled downsampling;
- consistent identity across all eight directions;
- editable or reproducible source files.

The primitive Dawn builder is retained as pipeline R&D, not as the final source standard.

## South-prototype-first rule

Do not produce a full eight-direction atlas from an unapproved source asset.

For a new visual family or major named character:

1. create one South-facing idle;
2. create the three compatible South walk frames;
3. review a large render and the actual-size six-step animation;
4. correct the source, pose, lighting, or downsampling method;
5. expand to eight directions only after explicit approval.

This rule prevents 32-cell production from multiplying a source-quality failure.

## Final-frame registration rule

Per-frame post-render movement is prohibited for final production candidates. Baseline and pivot defects must be fixed in the source, rig, pose library, geometry, camera, or controlled downsampling before final output.

Diagnostic image processing may be used to investigate a problem, but it cannot convert an otherwise rejected candidate into approved final art.

## Isolated cell rendering

`isolated_prepared_blend_per_cell_v1` is the proven reliability path:

1. apply one canonical direction and pose;
2. save a temporary pose-frozen `.blend`;
3. render through Blender's native frame command in a fresh process;
4. retry only that cell after a native crash;
5. delete temporary blends;
6. assemble and validate only after all canonical frames exist.

This is fault isolation, not visual post-processing. It must not repaint, shift, normalize, or otherwise alter final frame content.

The isolated renderer becomes active after the South-facing source prototype is approved.

## Tool and plug-in policy

Blender remains the preferred rigging, animation, camera, and render host because the DNDNext pipeline already integrates with it. The visual source does not have to be built from Blender primitives.

A free or acceptably licensed external program, Blender plug-in, 2D/3D hybrid, or assisted source workflow may be adopted when it improves quality and reuse. Before adoption, verify:

- current availability and maintenance;
- licensing and redistribution rights;
- Blender export compatibility;
- riggability and pose consistency;
- multi-angle identity stability;
- source reproducibility;
- usefulness for later body-family variants.

Krita, LibreSprite, or optional local AI tooling may assist concept, texture, paintover, downsampling, and cleanup. The user must not be required to manually edit every frame.

## Visual direction

Sprites should combine grounded dark-fantasy identity with clean tactical readability.

- concept-faithful silhouette and equipment;
- compact chibi tactical proportions chosen deliberately;
- slightly enlarged hands, feet, weapon thickness, and signature features where needed;
- broad readable hair and cloth shapes;
- clear ivory/gold/dark or equivalent value grouping;
- controlled motion with little whole-sprite bob;
- crisp edges at actual gameplay size;
- no photoreal micro-noise, heavy bloom, dense particles, or fragile dangling geometry.

Dawn Whiteflame should read as:

- adult silver-haired divine caster;
- recognizable face and long silver hair;
- layered ivory cloth and pale-gold armor;
- dark leather, leggings, belts, and boots;
- elegant cape or mantle structure;
- tall ornate gold staff with a compact divine flame;
- upright controlled posture;
- detailed identity translated into readable chibi tactical form.

## Directional requirements

Direction must be communicated by torso, pelvis, feet, head, hair, clothing, and equipment.

- South: full front
- Southwest: front-left three-quarter
- West: clean left profile
- Northwest: back-left three-quarter
- North: full back
- Northeast: back-right three-quarter
- East: clean right profile
- Southeast: front-right three-quarter

Mirroring is forbidden for asymmetric characters unless manually corrected in the source. It must never reverse weapon hand, shield side, scars, mechanical limbs, cape fasteners, or pouches.

## Animation requirements

- exactly four sampled poses: idle, Walk A, Walk B, Walk C;
- at least three unique rendered images per row;
- stable cell anchor, body scale, and equipment size;
- visible grounded foot travel;
- planted foot does not visibly slide;
- equipment never changes hands;
- first and last playback positions transition cleanly;
- motion remains visible but restrained at actual size;
- no whole-sprite pixel jump from root-height changes or post-render shifting.

A valid Action name or four keyframes is not proof of acceptable animation.

## Required QA

Use `/admin/sprite-lab` before registration.

Automatic gates:

- exact dimensions and transparency;
- correct South-first order;
- distinct pose signatures;
- at least three unique rendered images per row;
- safe alpha margins;
- baseline, pivot, height, and width within limits;
- exact canonical isolated-frame set;
- no post-render frame shift.

Manual gates:

- unmistakable facings;
- stable pivot and baseline;
- concept fidelity;
- readable face, hair, silhouette, outfit layers, equipment, and feet at runtime size;
- clean six-step loop;
- consistent handedness;
- no blur, flicker, crop, glow bleed, twitch, sliding, or gliding;
- explicit user approval.

Only a sheet that passes every gate may be uploaded through `/admin/sprite-assets`.

## Production workflow

1. Approve the concept and tactical/chibi quality references.
2. Select a source workflow capable of reaching them.
3. Create and approve the South idle and walk prototype.
4. Build or finalize the reusable rigged source asset.
5. Expand to eight canonical headings.
6. Render at sufficient working resolution and downsample repeatably.
7. Use isolated cell rendering when producing the final atlas.
8. Reject missing cells, static rows, or strict QA failures.
9. Inspect at actual runtime size.
10. Validate in Sprite Production Lab and the site.
11. Register only after explicit approval.

## Body-family strategy

- human/elf-like humanoids: Dawn is the first quality reference;
- small mechanical/constructed bodies: Leso is the first reference;
- large brute humanoids: Varges is the first reference.

Shared rigs, camera, timing, render isolation, and QA should reduce later production cost. Visual identity and approval remain per-character requirements.

## Protected boundaries

Sprite production must not alter world-map movement, routes, weather, camps, town-map behavior, encounter legality, combat, inventory, crafting, spells, progression, or Supabase schema/data. The renderer is visual-only.