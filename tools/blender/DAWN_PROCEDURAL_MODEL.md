# Dawn Whiteflame Procedural Blender Prototype

Status: functional 3D prototype with deterministic animation correction, 2026-08-04.

The complete project sequence and remaining work are tracked in `docs/Sprite_Production_Work_Map.md`.

This workflow creates a rigged, animated Dawn Whiteflame model from Blender primitives, prepares the canonical orthographic sprite scene, validates the exporter hierarchy, renders all 32 cells, assembles the South-first atlas, and writes the animated QA report.

The approved Dawn character design remains the visual reference:

- adult silver-haired divine caster;
- ivory layered robes;
- pale-gold shoulder and chest armor;
- dark boots and leather details;
- tall gold staff held consistently in the right hand;
- compact white-gold divine flame;
- serious grounded-fantasy treatment with tactics-game readability.

The generated model is a **functional stylized blockout**, not the final sculpt. It establishes the rig, silhouette, materials, equipment handedness, walk timing, camera, lighting, and export contract. Hair, robe topology, facial sculpting, armor ornament, and textures can be refined later without replacing the pipeline.

## Verified local evidence

The **first complete local Blender render** was completed on Blender 4.5 LTS after the pipeline was changed from EEVEE GPU rendering to Cycles CPU rendering.

That run successfully produced:

- `dawn_whiteflame_model.blend`;
- all 32 individual frame PNGs;
- `dawn-whiteflame.png` at 256 × 512;
- runtime metadata;
- QA JSON;
- the animated QA HTML preview.

It proved that model construction, rig creation, scene preparation, Cycles CPU rendering, transparency, South-first rotation, frame output, atlas assembly, and report generation work end to end.

The review also found that every idle/walk image in each direction row was pixel-identical. The previous QA checked alpha bounds and framing, but it did not prove that the walk Action produced visible movement. That first atlas is therefore a pipeline proof only; it is not production-approved.

## Deterministic animation correction

Dawn now uses two parallel animation representations:

1. `Dawn_Walk` remains an editable Blender Action at frames `1, 7, 13, 19`.
2. The armature stores an explicit JSON tactical pose library in `dndnext_pose_library_json`.

The exporter prefers the deterministic pose library when it is present. Before rendering each cell it resets the pose bones, applies the exact root location and bone rotations for the requested pose, updates the view layer, and then renders. Imported models without this property continue to use normal Blender Action sampling.

Automatic QA now requires:

- four distinct pose signatures before rendering;
- a **minimum of three unique rendered frames** per direction row;
- all existing crop, transparency, visible-pixel, baseline, pivot, height, and width checks.

A static atlas can no longer report success merely because its dimensions and alpha bounds are valid.

## Requirements

- Windows PowerShell;
- Blender 4.2 or later; Blender 4.5 LTS is the validated local version;
- repository checked out locally;
- current `main` pulled before each production run.

The build script searches common Blender installation directories. An exact executable path can also be supplied.

## One-command build

From the repository root:

```powershell
& ".\tools\blender\build_dawn_whiteflame.ps1" `
  -BlenderPath "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
```

Build and validate the `.blend` without rendering all 32 cells:

```powershell
& ".\tools\blender\build_dawn_whiteflame.ps1" `
  -BlenderPath "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" `
  -SkipRender
```

The CurrentUser execution policy may be set to `RemoteSigned`; permanent `Unrestricted` or machine-wide policy changes are not required.

## Pipeline stages

### 1. Procedural model build

`dndnext_dawn_model_builder.py`:

- clears a working Blender scene;
- creates `DawnWhiteflame_Sprite`;
- creates `DNDNext_SpriteRoot`;
- creates the 18-bone `Dawn_Rig`;
- builds the stylized Dawn geometry and materials;
- keeps the staff and flame parented to `hand.R`;
- creates the editable `Dawn_Walk` Action at frames `1, 7, 13, 19`;
- stores the deterministic four-pose tactical library on the armature;
- saves `dawn_whiteflame_model.blend`.

### 2. Scene preparation

`dndnext_dawn_prepare_scene.py`:

- validates the armature and Action;
- creates the orthographic camera;
- creates key, fill, and rim lights;
- enables transparent RGBA rendering;
- configures deterministic Cycles CPU rendering;
- saves the prepared `.blend`.

### 3. Dry-run hierarchy and pose validation

`dndnext_sprite_export.py --dry-run`:

- verifies all exporter object names and hierarchy;
- verifies the South-first manifest;
- loads the deterministic pose library when present;
- rejects missing or duplicate pose snapshots;
- performs no full 32-frame render.

### 4. Render probe

The PowerShell pipeline renders one test frame before the batch. Any Blender termination copies the newest crash file to:

`build/sprites/dawn-whiteflame/blender-last-crash.txt`

### 5. Full render and QA

`dndnext_sprite_export.py --keep-frames`:

- applies Idle, Walk A, Walk B, and Walk C directly from the deterministic pose library;
- renders all eight headings;
- checks pose uniqueness and rendered-pixel uniqueness;
- assembles the 256 × 512 atlas;
- writes automatic QA metrics and the animated browser preview;
- fails when any direction row contains fewer than three unique images.

## Output directory

Default output directory:

`build/sprites/dawn-whiteflame/`

Expected files:

- `dawn_whiteflame_model.blend`;
- `dawn-whiteflame.png`;
- `dawn-whiteflame.metadata.json`;
- `dawn-whiteflame.qa.json`;
- `dawn-whiteflame.qa.html`;
- `frames/` with all 32 rendered cells;
- optional `blender-last-crash.txt` only when Blender fails.

## Create the review archive

After a successful build:

```powershell
Compress-Archive -Force `
  -Path ".\build\sprites\dawn-whiteflame\*" `
  -DestinationPath ".\dawn-whiteflame-review.zip"
```

The archive is created at:

`C:\dnd\dndnext\dawn-whiteflame-review.zip`

## Model contents

The prototype includes:

- ivory robe mass and darker under-robe;
- chest plate, pauldrons, belt, buckle, gauntlets, and holy emblem;
- silver hair cap and five broad hair locks;
- head, eyes, pointed ears, hands, lower legs, and boots;
- cape, mantle, front robe trim, and rear sigil;
- gold staff shaft, ring, four crown prongs, outer flame, and bright flame core;
- tactical materials for ivory cloth, pale gold, leather, dark metal, skin, eyes, silver hair, and divine emission.

The model uses rigid bone parenting intentionally. At 64 pixels this provides stable silhouettes and avoids unpredictable automatic skin weights during the first prototype. A later refinement can replace individual meshes with sculpted and weight-painted geometry while retaining the same bone names, Action, root, pose-library property, camera, manifest, and exporter.

## Four tactical poses

- Frame 1 — restrained idle/contact-neutral pose.
- Frame 7 — left contact with readable opposing arm and leg motion.
- Frame 13 — passing/high pose with slight body rise.
- Frame 19 — right contact with mirrored locomotion but unchanged equipment handedness.

Runtime playback:

`0 → 1 → 2 → 3 → 2 → 1`

The poses are intentionally stronger than a full-resolution realistic walk so motion survives the 64 × 64 downscale. The staff arm remains restrained so the staff does not appear to switch hands or leave the cell.

## Required visual inspection

After the corrected script completes:

1. Read the terminal result. `DNDNext sprite export passed automatic QA` must appear.
2. Open `dawn-whiteflame.qa.json`; `passed` must be `true` and `errors` must be empty.
3. Open `dawn-whiteflame.qa.html`.
4. Confirm the idle spin reads `S, SW, W, NW, N, NE, E, SE`.
5. Confirm each direction visibly moves through at least three different images.
6. Confirm the staff stays in Dawn's right hand in all eight headings.
7. Confirm the front robe trim identifies front-facing views and the cape sigil identifies rear-facing views.
8. Confirm feet remain on one baseline and no planted foot slides.
9. Confirm the flame does not touch a cell edge.
10. Confirm no hair, staff, armor, or body part changes size or identity between frames.
11. Upload `dawn-whiteflame.png` to `/admin/sprite-lab` for final manual gates.
12. Create and upload the review ZIP before Sprite Library registration.

## Refinement priorities after corrected motion is proven

Use the corrected real atlas to determine which changes are visible at runtime size. Refine in this order:

1. silhouette and direction readability;
2. camera scale and anchor;
3. walk-cycle foot contact;
4. staff/flame size and placement;
5. robe and cape separation;
6. hair-mass readability;
7. gold/ivory value separation;
8. facial and ornamental detail.

Do not spend time on micro-detail that disappears at 64 pixels.

## Approval state

Current state:

- model pipeline: complete;
- Windows render stability: complete;
- structural 32-frame render: proven;
- static-frame defect: diagnosed;
- deterministic source correction: complete;
- corrected local rerender: pending;
- Sprite Production Lab approval: pending;
- Sprite Library registration: pending;
- Dawn character assignment: pending.

## Protected boundaries

This tooling is offline and scene-local. It does not connect to Supabase, change sprite assignments, modify world-map movement, alter town maps, write encounter state, or change inventory, crafting, equipment, spells, or progression.
