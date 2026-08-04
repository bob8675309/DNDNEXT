"""Prepare one deterministic DNDNext sprite cell as a pose-frozen blend.

The main sprite model is opened by Blender before this script runs. The script
selects one canonical direction and one deterministic pose, detaches the Action,
applies the pose directly, preserves intentional render visibility, and saves a
temporary blend. A separate fresh Blender process renders that blend through the
native ``--render-frame`` path. This avoids keeping the dependency graph alive
across 32 renders and prevents one native crash from invalidating the complete
atlas.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy


def _load_core():
    path = Path(__file__).with_name("dndnext_sprite_export.py")
    spec = importlib.util.spec_from_file_location("dndnext_sprite_export_core", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load DNDNext sprite exporter: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _script_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare one isolated DNDNext sprite cell blend.")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output-blend", required=True)
    parser.add_argument("--row-index", required=True, type=int)
    parser.add_argument("--column-index", required=True, type=int)
    return parser.parse_args(_script_args())


def _prepare(args: argparse.Namespace) -> None:
    core = _load_core()
    manifest_path = Path(args.manifest).expanduser().resolve()
    output_blend = Path(args.output_blend).expanduser().resolve()
    manifest = core._read_json(manifest_path)
    core._validate_manifest(manifest)

    if not 0 <= args.row_index < len(core.DIRECTIONS):
        raise core.ExportError(f"row-index must be between 0 and {len(core.DIRECTIONS) - 1}.")
    if not 0 <= args.column_index < len(core.FRAME_LABELS):
        raise core.ExportError(f"column-index must be between 0 and {len(core.FRAME_LABELS) - 1}.")

    scene = bpy.context.scene
    root = core._object(core._required_text(manifest, "rotation_root"))
    camera = core._object(core._required_text(manifest, "camera_object"), "CAMERA")
    armature = core._object(core._required_text(manifest, "armature_object"), "ARMATURE")
    collection = core._collection(core._required_text(manifest, "render_collection"))
    action = core._action(core._required_text(manifest, "action_name"))

    core._validate_hierarchy(root, collection, armature)
    core._assign_action(armature, action)
    core._configure_render(scene, camera, manifest)

    pose_frames = core._required_int_list(manifest, "pose_frames", 4)
    yaws = core._required_number_list(manifest, "direction_yaws_degrees", 8)
    pose_library = core._read_pose_library(armature, pose_frames)
    if pose_library is None:
        raise core.ExportError("Isolated cell preparation requires a deterministic pose library.")

    direction_key, direction_label = core.DIRECTIONS[args.row_index]
    frame_label = core.FRAME_LABELS[args.column_index]
    pose_frame = pose_frames[args.column_index]
    yaw = yaws[args.row_index]

    renderable_names = core._collection_object_names(collection)
    for obj in scene.objects:
        if core._is_renderable_geometry(obj) and obj.name not in renderable_names:
            obj.hide_render = True

    visible_renderables = [
        obj for obj in collection.all_objects
        if core._is_renderable_geometry(obj) and not obj.hide_render
    ]
    if not visible_renderables:
        raise core.ExportError("Render collection has no intentionally visible geometry.")

    scene.frame_set(1, subframe=0.0)
    if armature.animation_data is None:
        raise core.ExportError("Armature animation data was not created.")
    armature.animation_data.action = None
    if hasattr(armature.animation_data, "use_nla"):
        armature.animation_data.use_nla = False
    for track in getattr(armature.animation_data, "nla_tracks", []):
        track.mute = True

    root.rotation_mode = "XYZ"
    root.rotation_euler.z = math.radians(float(manifest.get("base_yaw_degrees", 0)) + yaw)
    core._apply_pose_snapshot(armature, pose_library[pose_frame])
    bpy.context.view_layer.update()

    scene.frame_start = 1
    scene.frame_end = 1
    scene["dndnext_isolated_sprite_cell"] = json.dumps(
        {
            "renderStrategy": str(manifest.get("render_strategy") or "isolated_prepared_blend_per_cell_v1"),
            "rowIndex": args.row_index,
            "columnIndex": args.column_index,
            "direction": direction_key,
            "directionLabel": direction_label,
            "frameLabel": frame_label,
            "poseFrame": pose_frame,
            "visibleRenderableCount": len(visible_renderables),
        },
        sort_keys=True,
    )

    output_blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))
    print(
        f"Prepared isolated sprite cell {direction_label} / {frame_label}: "
        f"{output_blend}"
    )


def main() -> int:
    try:
        _prepare(_parse_args())
        return 0
    except Exception as exc:
        print(f"DNDNext isolated cell preparation failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
