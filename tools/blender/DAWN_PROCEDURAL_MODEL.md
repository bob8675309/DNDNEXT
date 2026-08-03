# Dawn Whiteflame Procedural Blender Prototype

Status: first functional 3D production prototype.

This workflow creates a rigged, animated Dawn Whiteflame model from Blender primitives, prepares the canonical orthographic sprite scene, validates the exporter hierarchy, renders all 32 cells, assembles the South-first atlas, and writes the animated QA report.

The approved Dawn character-design sheet is the visual reference:

- adult silver-haired divine caster
- ivory layered robes
- pale-gold shoulder and chest armor
- dark boots and leather details
- tall gold staff held consistently in the right hand
- compact white-gold divine flame
- serious grounded-fantasy treatment with tactics-game readability

The generated model is a **functional stylized blockout**, not the final sculpt. It establishes the rig, silhouette, materials, equipment handedness, walk timing, camera, lighting, and export contract. Hair, robe topology, facial sculpting, armor ornament, and textures can be refined later without replacing the pipeline.

## Requirements

- Windows PowerShell
- Blender 4.2 or later
- repository checked out locally

The build script searches common Blender installation directories. You can also supply the exact executable path.

## One-command build

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File tools/blender/build_dawn_whiteflame.ps1
```

With an explicit Blender path:

```powershell
powershell -ExecutionPolicy Bypass -File tools/blender/build_dawn_whiteflame.ps1 `
  -BlenderPath "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
```

Build and validate the `.blend` without rendering all 32 cells:

```powershell
powershell -ExecutionPolicy Bypass -File tools/blender/build_dawn_whiteflame.ps1 -SkipRender
```

## Pipeline stages

1. `dndnext_dawn_model_builder.py`
   - clears a working Blender scene
   - creates `DawnWhiteflame_Sprite`
   - creates `DNDNext_SpriteRoot`
   - creates the 18-bone `Dawn_Rig`
   - builds the stylized Dawn geometry and materials
   - keeps the staff and flame parented to `hand.R`
   - creates the `Dawn_Walk` action at frames `1, 7, 13, 19`
   - saves `dawn_whiteflame_model.blend`

2. `dndnext_dawn_prepare_scene.py`
   - validates the armature and action
   - creates the orthographic camera
   - creates key, fill, and rim lights
   - enables transparent RGBA rendering
   - saves the prepared `.blend`

3. `dndnext_sprite_export.py --dry-run`
   - verifies all exporter object names and hierarchy
   - verifies the South-first manifest
   - performs no rendering

4. `dndnext_sprite_export.py --keep-frames`
   - renders idle, walk A, walk B, and walk C from all eight headings
   - assembles the 256 × 512 atlas
   - writes automatic QA metrics and the animated browser preview

## Outputs

Default output directory:

`build/sprites/dawn-whiteflame/`

Expected files:

- `dawn_whiteflame_model.blend`
- `dawn-whiteflame.png`
- `dawn-whiteflame.metadata.json`
- `dawn-whiteflame.qa.json`
- `dawn-whiteflame.qa.html`
- `frames/` with the 32 rendered cells

## Model contents

The prototype includes:

- ivory robe mass and darker under-robe
- chest plate, pauldrons, belt, buckle, gauntlets, and holy emblem
- silver hair cap and five broad hair locks
- head, eyes, pointed ears, hands, lower legs, and boots
- cape, mantle, front robe trim, and rear sigil
- gold staff shaft, ring, four crown prongs, outer flame, and bright flame core
- tactical materials for ivory cloth, pale gold, leather, dark metal, skin, eyes, silver hair, and divine emission

The model uses rigid bone parenting intentionally. At 64px this gives stable silhouettes and avoids unpredictable automatic skin weights during the first prototype. A later refinement can replace individual meshes with sculpted and weight-painted geometry while retaining the same bone names, action, root, camera, manifest, and exporter.

## Walk action

Pose frames:

- frame 1: idle
- frame 7: left contact
- frame 13: passing/high point
- frame 19: right contact

Runtime playback:

`0 → 1 → 2 → 3 → 2 → 1`

The staff arm uses restrained counter-swing so the flame remains inside the 64px cell and the staff does not appear to change hands.

## Required visual inspection

After the script completes:

1. Open `dawn-whiteflame.qa.html`.
2. Confirm the idle spin reads:
   `S, SW, W, NW, N, NE, E, SE`.
3. Confirm the staff stays in Dawn's right hand in all eight headings.
4. Confirm the front robe trim appears only on front-facing views and the cape sigil identifies rear-facing views.
5. Confirm feet remain on one baseline and no planted foot slides.
6. Confirm the flame does not touch a cell edge.
7. Confirm no hair, staff, armor, or body part changes size between frames.
8. Upload `dawn-whiteflame.png` to `/admin/sprite-lab` for the final manual gates.

## Refinement priorities after the first render

Use the first real atlas to determine which changes are visible at runtime size. Refine in this order:

1. silhouette and camera scale
2. staff/flame size and placement
3. robe and cape separation
4. hair mass readability
5. walk-cycle foot contact
6. gold/ivory value separation
7. facial and ornamental detail

Do not spend time on micro-detail that disappears at 64px.

## Protected boundaries

This tooling is offline and scene-local. It does not connect to Supabase, change sprite assignments, modify world-map movement, alter town maps, or write encounter state.
