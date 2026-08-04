# DNDNext Sprite Production Work Map

Status date: 2026-08-04

This is the authoritative sprite-production status map. Automatic QA is necessary but does not override direct visual rejection.

The detailed active plan is `Dawn_High_Quality_Prototype_Plan.md`.

## Canonical target

- transparent `256 × 512` PNG atlas;
- 4 columns × 8 rows of `64 × 64` cells;
- South-first rows: `S, SW, W, NW, N, NE, E, SE`;
- columns: Idle, Walk A, Walk B, Walk C;
- playback: `0 → 1 → 2 → 3 → 2 → 1`;
- stable baseline, pivot, scale, handedness, silhouette, and motion;
- concept-faithful character identity with crisp chibi tactical readability.

Dawn Whiteflame remains the first start-to-finish quality reference. The requested quick UI fix begins only after Dawn is visually approved and fully documented.

## Completed work

### Runtime, authoring, QA, and publishing infrastructure

- Unified eight-direction runtime metadata is deployed.
- Four-direction production is retired.
- `/admin/sprite-lab` supports atlas, direction, animation, pivot, baseline, crop, and handedness review.
- Fixed orthographic camera and Windows-safe Cycles CPU scene exist.
- Deterministic pose sampling, Action detachment, rendered-frame hashing, and static-row rejection work.
- Atlas, metadata, QA JSON, HTML preview, and source-linked review-branch publishing work.
- Final-candidate output prohibits post-render frame shifting.

### Isolated cell rendering — proven

The active technical strategy is `isolated_prepared_blend_per_cell_v1`:

1. prepare one direction/pose in a short-lived Blender process;
2. save a temporary pose-frozen `.blend` with the Action detached;
3. render that cell through Blender's native `--render-frame` path in a fresh process;
4. retry only the failed cell after native exit code `11`;
5. delete temporary blends;
6. assemble and validate only after all 32 canonical PNGs exist.

PR #165 merged as `f91949006ebbee994ca5fc532f4210eeaddf6d40`. The local run rendered all 32 cells, passed automatic assembly QA, published the review package, and proved that one native Blender failure no longer discards the whole atlas.

### Technical pipeline conclusion

The project has proved:

- canonical South-first direction order;
- exact frame naming and atlas assembly;
- deterministic movement sampling;
- static-row and metric QA;
- isolated native rendering;
- automated review publication.

These systems are retained. They are no longer the active blocker.

### Rejected procedural candidates

The earlier v2.2 candidate passed numeric QA but was rejected because per-frame shifts caused visible twitch and the cone-robed mannequin silhouette was unacceptable.

Dawn v3 removed frame shifting, stabilized the staff, used zero root bob, replaced the legacy robe with split panels, and successfully completed isolated rendering. It was still rejected as final art because:

- the procedural primitive model looked crude and generic;
- face, hair, armor, cloth, belts, boots, cape, staff ornament, and material detail were far below the concept reference;
- the result did not approach the supplied high-quality chibi tactical sprite reference;
- incremental polishing of primitives is not expected to close the quality gap efficiently.

All procedural candidates remain unregistered and unassigned.

## Current blocking work

The blocker is **source-asset quality**, not exporter reliability.

The active milestone is one high-quality South-facing Dawn idle and walk prototype. Do not generate another complete 32-cell atlas until the South prototype is explicitly approved.

Current gate:

1. evaluate a substantially better source-asset workflow;
2. keep Blender as the rig/animation/render host unless evidence supports a better integration;
3. consider free or acceptably licensed external character tools and Blender plug-ins;
4. verify licensing, Blender export, riggability, identity consistency, reproducibility, and later body-family reuse before adoption;
5. create one South-facing idle plus three walk frames at a higher working resolution;
6. review a large render and the actual-size six-step animation against the concept and chibi references;
7. refine or reject the source route before any eight-direction expansion.

The user must not be asked to manually edit individual frames.

## Acceptance gates

### South-facing prototype gate

The South prototype must:

1. look recognizably like Dawn rather than a generic mannequin;
2. preserve detailed silver hair, face, layered ivory/gold/dark clothing, cape, boots, staff, and flame;
3. use readable chibi tactical proportions;
4. separate cloth, armor, leather, legs, boots, staff, and flame through shape and value;
5. animate smoothly without whole-sprite twitch, gliding, snapping, or frame shifting;
6. keep the staff stable in the same hand;
7. remain crisp and readable at gameplay size;
8. receive explicit user approval.

### Final Dawn gate

Dawn is complete only when:

1. the South prototype has passed its visual gate;
2. all eight idle facings are unmistakable;
3. each direction contains at least three unique walk images;
4. the walk is smooth and grounded at 1× runtime size;
5. no post-render frame movement is used;
6. automatic QA passes;
7. Sprite Production Lab passes every manual check;
8. battle-board and small-map previews remain readable;
9. final source, settings, accepted artifacts, tool chain, failures, and fixes are documented;
10. the atlas is registered and assigned reversibly.

## Remaining work

### Phase A — select the quality source route

1. Compare viable free or acceptable source programs and Blender plug-ins.
2. Confirm licensing, export, rigging, consistency, and reproducibility.
3. Reject any route that requires manual per-cell production or cannot maintain Dawn's identity.

### Phase B — South prototype

1. Create the detailed source asset.
2. Establish approved proportions, camera, lighting, and downsampling.
3. Rig idle plus three restrained walk poses.
4. Produce a large review render and actual-size animation.
5. Iterate until explicitly approved.

### Phase C — finish Dawn

1. Expand the approved source to eight directions.
2. Reuse isolated rendering, exact atlas assembly, QA, publishing, and Sprite Lab.
3. Complete site tests, registration, reversible assignment, and documentation.

### Phase D — requested UI interruption

After Dawn is complete, pause sprite production for the user's quick UI fix. Keep that patch isolated from sprite, tactical, and map behavior.

### Phase E — next characters

1. Extract a reusable human/elf-like family from accepted Dawn.
2. Build Leso Varen as the first small mechanical/Autognome family reference.
3. Build Varges as the first large brute-humanoid/Bugbear family reference.
4. Reuse animation, camera, isolated rendering, QA, and publishing without waiving character-specific visual approval.

### Phase F — scale-up

- add approved presets to character and NPC creation;
- replace legacy sprite paths only after coverage is verified;
- optimize isolated Blender startup only after multiple quality assets prove the workflow;
- define archive rules for source models, accepted atlases, metadata, QA, and rejected candidates.

## Dependency map

```text
Canonical 8-direction runtime + QA
        ↓
Isolated cell rendering and publishing — PROVEN
        ↓
High-quality source-asset/tool evaluation        ← CURRENT
        ↓
South idle + walk prototype visual approval
        ↓
Eight-direction expansion + strict QA
        ↓
Sprite Lab + site test + registration
        ↓
Dawn final documentation
        ↓
Requested UI quick fix
        ↓
Leso → Varges → reusable body families
```

## Protected boundaries

Sprite production remains visual-only. It must not alter world-map travel, town-map behavior, tactical legality, combat, encounters, inventory, crafting, spells, progression, or Supabase schema/data unless a later separately reviewed integration explicitly requires it.