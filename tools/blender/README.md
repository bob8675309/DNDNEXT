# DNDNext Blender Sprite Export Kit

This kit converts one rigged, animated Blender character into the exact atlas accepted by DNDNext.
It is the precision stage of the sprite workflow; generative image tools are not used to lay out frames.

## Canonical output

- transparent PNG
- 256 × 512 pixels
- 64 × 64 pixel cells
- 4 columns × 8 rows
- rows: **S, SW, W, NW, N, NE, E, SE**
- columns: **idle, walk A, walk B, walk C**
- playback: `0 → 1 → 2 → 3 → 2 → 1`

## Requirements

- Blender 4.2 or later is recommended.
- One armature and one walk action.
- A non-animated rotation root whose origin is the character's ground pivot.
- Every rendered character mesh parented beneath that root.
- One orthographic camera.
- The model must face South/front toward the camera at the manifest's base yaw.

The first manifest is `manifests/dawn_whiteflame.sprite.json`.
Its expected scene names are:

- collection: `DawnWhiteflame_Sprite`
- rotation root: `DNDNext_SpriteRoot`
- camera: `DNDNext_OrthoCamera`
- armature: `Dawn_Rig`
- action: `Dawn_Walk`

The armature and action names can be changed in the manifest to match the actual model.

## 1. Prepare a safe working copy

Open the character model and immediately save a new `.blend` copy for sprite production.
Do not run setup against the only copy of a production model.

Set the character at the world origin with both feet on Z=0. The intended ground-contact point should be
at the origin of `DNDNext_SpriteRoot`. Keep translation and scale stable across the whole action.

## 2. Build the standard scene

Select the top-level objects belonging to Dawn, then run:

```bash
blender DawnWhiteflame.blend \
  --python tools/blender/dndnext_sprite_scene_setup.py -- \
  --manifest tools/blender/manifests/dawn_whiteflame.sprite.json \
  --parent-selected
```

The setup script creates the render collection, rotation root, pivot marker, orthographic camera, and
three-light studio rig. It links selected objects into the render collection and, when `--parent-selected`
is present, parents only selected top-level objects to the rotation root while preserving world transforms.
It does not create, retarget, or modify animation data.

After setup:

1. Confirm the armature is named `Dawn_Rig`, or update the manifest.
2. Confirm the walk action is named `Dawn_Walk`, or update the manifest.
3. Confirm the four requested pose frames are idle, walk A, walk B, and walk C.
4. Confirm all character geometry and the armature are beneath `DNDNext_SpriteRoot`.
5. Confirm South is a full front view at yaw 0.
6. Save the `.blend` file.

## 3. Validate without rendering

```bash
blender --background DawnWhiteflame.blend \
  --python tools/blender/dndnext_sprite_export.py -- \
  --manifest tools/blender/manifests/dawn_whiteflame.sprite.json \
  --output-dir build/sprites/dawn-whiteflame \
  --dry-run
```

Dry run fails when a required object, collection, armature, action, camera type, hierarchy, or manifest
contract is wrong.

## 4. Render and assemble

```bash
blender --background DawnWhiteflame.blend \
  --python tools/blender/dndnext_sprite_export.py -- \
  --manifest tools/blender/manifests/dawn_whiteflame.sprite.json \
  --output-dir build/sprites/dawn-whiteflame \
  --keep-frames
```

The exporter writes:

- `dawn-whiteflame.png` — canonical 4×8 atlas
- `dawn-whiteflame.metadata.json` — runtime metadata
- `dawn-whiteflame.qa.json` — alpha bounds and automatic QA results
- `dawn-whiteflame.qa.html` — animated eight-row and idle-spin browser preview
- `frames/` — the 32 source cells when `--keep-frames` is used

## Automatic rejection rules

The export fails when:

- any cell is not 64 × 64
- any frame has no visible alpha
- character or effects touch the configured cell-edge margin
- fewer than the configured number of visible pixels are present
- the foot baseline drifts too far within one directional row
- horizontal pivot, silhouette height, or silhouette width changes beyond configured tolerances
- the atlas or direction order differs from the DNDNext runtime contract

Automatic checks cannot determine whether a character is truly facing the named direction. Open the generated
HTML preview and then upload the atlas to `/admin/sprite-lab` for the manual direction, handedness, foot-slide,
loop, silhouette, and small-size gates.

## Direction troubleshooting

The Dawn manifest assumes a Blender character whose forward vector is **-Y** and a camera placed on the
negative-Y side looking toward the origin. Its yaw table is:

- S: `0`
- SW: `-45`
- W: `-90`
- NW: `-135`
- N: `180`
- NE: `135`
- E: `90`
- SE: `45`

If East and West are reversed, do not mirror the atlas. Correct `direction_yaws_degrees` in the manifest,
render again, and verify the idle-spin preview. Mirroring is prohibited for asymmetric equipment.

## Dawn Whiteflame acceptance notes

- adult silver-haired divine caster
- ivory robe mass stays readable at 64px
- pale-gold armor remains a broad accent, not micro-detail
- staff remains in the same hand for all eight directions
- white-gold flame remains compact and never crosses a cell boundary
- no hair, robe, staff, or body-scale popping between frames
- no planted-foot sliding in the six-step playback loop

Only an atlas that passes both automatic export QA and `/admin/sprite-lab` should be registered in the
Sprite Library.
