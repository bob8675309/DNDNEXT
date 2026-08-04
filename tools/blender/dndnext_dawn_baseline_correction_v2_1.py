"""Normalize Dawn Whiteflame's refined walk baseline without weakening QA.

The v2 visual refinement produced a valid 32-frame render, but two opposite diagonal
rows exceeded the strict two-pixel baseline tolerance. This pass keeps the stronger
leg articulation and corrects only the root-height excursion used by the four
procedural poses.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy

ARMATURE_NAME = "Dawn_Rig"
ACTION_NAME = "Dawn_Walk"
POSE_LIBRARY_PROPERTY = "dndnext_pose_library_json"
REFINEMENT_PROPERTY = "dndnext_visual_refinement"
CORRECTION_VERSION = "dawn_grounded_walk_v2_1_baseline"
ROOT_HEIGHTS = {
    1: 0.000,
    7: -0.020,
    13: 0.018,
    19: -0.020,
}


class CorrectionError(RuntimeError):
    pass


def _script_args() -> list[str]:
    argv = sys.argv
    return argv[argv.index("--") + 1 :] if "--" in argv else []


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Correct Dawn v2 walk baseline.")
    parser.add_argument("--output", required=True, help="Blend file to overwrite after correction.")
    return parser.parse_args(_script_args())


def _require_armature() -> bpy.types.Object:
    armature = bpy.data.objects.get(ARMATURE_NAME)
    if armature is None or armature.type != "ARMATURE":
        raise CorrectionError(f"Required armature missing: {ARMATURE_NAME}")
    return armature


def _read_pose_library(armature: bpy.types.Object) -> dict:
    raw = armature.get(POSE_LIBRARY_PROPERTY)
    if raw is None:
        raise CorrectionError(f"Armature is missing {POSE_LIBRARY_PROPERTY}")
    try:
        payload = json.loads(str(raw))
    except json.JSONDecodeError as exc:
        raise CorrectionError("Dawn pose library is not valid JSON") from exc
    frames = payload.get("frames")
    if not isinstance(frames, dict):
        raise CorrectionError("Dawn pose library frames are missing")
    for frame in ROOT_HEIGHTS:
        pose = frames.get(str(frame))
        if not isinstance(pose, dict):
            raise CorrectionError(f"Dawn pose library is missing frame {frame}")
        location = pose.get("root_location")
        if not isinstance(location, list) or len(location) != 3:
            raise CorrectionError(f"Dawn frame {frame} has an invalid root location")
    return payload


def _update_action_and_library(armature: bpy.types.Object, payload: dict) -> None:
    action = bpy.data.actions.get(ACTION_NAME)
    if action is None:
        raise CorrectionError(f"Required action missing: {ACTION_NAME}")

    armature.animation_data_create()
    armature.animation_data.action = action
    root = armature.pose.bones.get("root")
    if root is None:
        raise CorrectionError("Dawn rig is missing the root pose bone")

    for frame, height in ROOT_HEIGHTS.items():
        pose = payload["frames"][str(frame)]
        pose["root_location"] = [0.0, 0.0, height]
        bpy.context.scene.frame_set(frame)
        root.location = (0.0, 0.0, height)
        root.keyframe_insert(data_path="location", frame=frame, group="root")

    payload["refinementVersion"] = CORRECTION_VERSION
    payload["baselineCorrection"] = {
        "reason": "diagonal baseline QA drift",
        "maxAllowedPixels": 2,
        "rootHeights": {str(frame): height for frame, height in ROOT_HEIGHTS.items()},
    }
    armature[POSE_LIBRARY_PROPERTY] = json.dumps(payload, sort_keys=True)
    armature[REFINEMENT_PROPERTY] = CORRECTION_VERSION

    for fcurve in action.fcurves:
        for point in fcurve.keyframe_points:
            point.interpolation = "BEZIER"
            point.handle_left_type = "AUTO_CLAMPED"
            point.handle_right_type = "AUTO_CLAMPED"

    bpy.context.scene.frame_set(1)
    root.location = (0.0, 0.0, ROOT_HEIGHTS[1])
    bpy.context.view_layer.update()


def _verify(armature: bpy.types.Object) -> None:
    if armature.get(REFINEMENT_PROPERTY) != CORRECTION_VERSION:
        raise CorrectionError("Dawn baseline correction marker was not stored")
    payload = _read_pose_library(armature)
    if payload.get("refinementVersion") != CORRECTION_VERSION:
        raise CorrectionError("Dawn pose-library correction version drifted")
    for frame, expected in ROOT_HEIGHTS.items():
        actual = float(payload["frames"][str(frame)]["root_location"][2])
        if abs(actual - expected) > 1e-6:
            raise CorrectionError(f"Dawn root height drifted at frame {frame}: {actual}")


def main() -> int:
    try:
        args = _parse_args()
        output = Path(args.output).expanduser().resolve()
        armature = _require_armature()
        payload = _read_pose_library(armature)
        _update_action_and_library(armature, payload)
        _verify(armature)
        output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(output))
        print(f"Applied Dawn baseline correction: {CORRECTION_VERSION}")
        print(f"Saved baseline-corrected Dawn model: {output}")
        return 0
    except CorrectionError as exc:
        print(f"Dawn baseline correction failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
