"""Apply Dawn Whiteflame visual refinement v2 to the generated Blender model.

This pass is intentionally procedural. It enlarges Dawn in the runtime frame via the
manifest, shortens the robe/cape silhouette, exposes the boots, strengthens the four
walk poses, and increases material/value separation. No rendered frame is edited by
hand.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ARMATURE_NAME = "Dawn_Rig"
ACTION_NAME = "Dawn_Walk"
COLLECTION_NAME = "DawnWhiteflame_Sprite"
POSE_LIBRARY_PROPERTY = "dndnext_pose_library_json"
REFINEMENT_PROPERTY = "dndnext_visual_refinement"
REFINEMENT_VERSION = "dawn_grounded_walk_v2"
POSE_FRAMES = (1, 7, 13, 19)

# Strong tactical poses are deliberate: movement must remain legible after reduction
# to a 64x64 cell while Dawn's right-hand staff stays stable.
REFINED_POSES = {
    1: {
        "root_location": (0.0, 0.0, 0.0),
        "rotations_degrees": {
            "pelvis": (0, 0, 0), "chest": (0, 0, 0),
            "upper_arm.L": (4, -2, -8), "forearm.L": (6, 0, 5),
            "upper_arm.R": (-2, 1, 4), "forearm.R": (-4, 0, -2),
            "thigh.L": (6, 0, 1), "shin.L": (-4, 0, 0), "foot.L": (2, 0, 0),
            "thigh.R": (-6, 0, -1), "shin.R": (4, 0, 0), "foot.R": (-2, 0, 0),
        },
    },
    7: {
        "root_location": (0.0, 0.0, -0.060),
        "rotations_degrees": {
            "pelvis": (2, 3, -7), "chest": (-2, -2, 5),
            "upper_arm.L": (-24, -4, -8), "forearm.L": (15, 0, 7),
            "upper_arm.R": (6, 1, 4), "forearm.R": (-2, 0, -2),
            "thigh.L": (42, 3, 4), "shin.L": (-28, 0, 0), "foot.L": (16, 0, 0),
            "thigh.R": (-34, -3, -4), "shin.R": (30, 0, 0), "foot.R": (-13, 0, 0),
        },
    },
    13: {
        "root_location": (0.0, 0.0, 0.038),
        "rotations_degrees": {
            "pelvis": (-2, 0, 3), "chest": (2, 0, -3),
            "upper_arm.L": (7, 1, -5), "forearm.L": (5, 0, 4),
            "upper_arm.R": (-4, -1, 3), "forearm.R": (-4, 0, -2),
            "thigh.L": (-11, 0, -2), "shin.L": (29, 0, 0), "foot.L": (-8, 0, 0),
            "thigh.R": (13, 0, 2), "shin.R": (8, 0, 0), "foot.R": (-3, 0, 0),
        },
    },
    19: {
        "root_location": (0.0, 0.0, -0.060),
        "rotations_degrees": {
            "pelvis": (-2, -3, 7), "chest": (2, 2, -5),
            "upper_arm.L": (24, 4, -8), "forearm.L": (-15, 0, 7),
            "upper_arm.R": (-6, -1, 4), "forearm.R": (2, 0, -2),
            "thigh.L": (-34, -3, 4), "shin.L": (30, 0, 0), "foot.L": (-13, 0, 0),
            "thigh.R": (42, 3, -4), "shin.R": (-28, 0, 0), "foot.R": (16, 0, 0),
        },
    },
}


class RefinementError(RuntimeError):
    pass


def _script_args() -> list[str]:
    argv = sys.argv
    return argv[argv.index("--") + 1 :] if "--" in argv else []


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply Dawn Whiteflame visual refinement v2.")
    parser.add_argument("--output", required=True, help="Blend file to overwrite after refinement.")
    return parser.parse_args(_script_args())


def _object(name: str, expected_type: str | None = None) -> bpy.types.Object:
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise RefinementError(f"Required object missing: {name}")
    if expected_type and obj.type != expected_type:
        raise RefinementError(f"Object {name} must be {expected_type}; found {obj.type}")
    return obj


def _adjust_world(name: str, scale: tuple[float, float, float], translate: tuple[float, float, float]) -> None:
    obj = _object(name)
    location, rotation, current_scale = obj.matrix_world.decompose()
    next_location = location + Vector(translate)
    next_scale = Vector((
        current_scale.x * scale[0],
        current_scale.y * scale[1],
        current_scale.z * scale[2],
    ))
    obj.matrix_world = Matrix.LocRotScale(next_location, rotation, next_scale)


def _principled(material_name: str):
    material = bpy.data.materials.get(material_name)
    if material is None or not material.use_nodes:
        raise RefinementError(f"Required material missing or has no nodes: {material_name}")
    node = material.node_tree.nodes.get("Principled BSDF")
    if node is None:
        raise RefinementError(f"Material has no Principled BSDF: {material_name}")
    return node


def _tune_materials() -> None:
    ivory = _principled("Dawn_Ivory")
    ivory.inputs["Base Color"].default_value = (0.84, 0.81, 0.72, 1.0)
    ivory.inputs["Roughness"].default_value = 0.66

    shadow = _principled("Dawn_IvoryShadow")
    shadow.inputs["Base Color"].default_value = (0.29, 0.28, 0.27, 1.0)
    shadow.inputs["Roughness"].default_value = 0.82

    gold = _principled("Dawn_PaleGold")
    gold.inputs["Base Color"].default_value = (0.64, 0.39, 0.09, 1.0)
    gold.inputs["Metallic"].default_value = 0.76
    gold.inputs["Roughness"].default_value = 0.24

    bright_gold = _principled("Dawn_GoldHighlight")
    bright_gold.inputs["Base Color"].default_value = (0.95, 0.68, 0.22, 1.0)
    bright_gold.inputs["Metallic"].default_value = 0.80
    bright_gold.inputs["Roughness"].default_value = 0.18

    hair = _principled("Dawn_SilverHair")
    hair.inputs["Base Color"].default_value = (0.79, 0.82, 0.85, 1.0)
    hair.inputs["Roughness"].default_value = 0.42

    dark = _principled("Dawn_DarkMetal")
    dark.inputs["Base Color"].default_value = (0.025, 0.030, 0.040, 1.0)
    dark.inputs["Metallic"].default_value = 0.46
    dark.inputs["Roughness"].default_value = 0.42


def _parent_to_bone(obj: bpy.types.Object, armature: bpy.types.Object, bone_name: str) -> None:
    if armature.pose.bones.get(bone_name) is None:
        raise RefinementError(f"Missing bone for refinement object: {bone_name}")
    world = obj.matrix_world.copy()
    obj.parent = armature
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world


def _ensure_robe_split(armature: bpy.types.Object) -> None:
    existing = bpy.data.objects.get("Dawn_RobeSplitShadow")
    if existing is not None:
        bpy.data.objects.remove(existing, do_unlink=True)

    collection = bpy.data.collections.get(COLLECTION_NAME)
    material = bpy.data.materials.get("Dawn_IvoryShadow")
    if collection is None or material is None:
        raise RefinementError("Cannot create robe split without Dawn collection/material")

    bpy.ops.mesh.primitive_cube_add(location=(0.0, -0.455, 0.49))
    split = bpy.context.object
    split.name = "Dawn_RobeSplitShadow"
    split.scale = (0.050, 0.020, 0.205)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for current in list(split.users_collection):
        current.objects.unlink(split)
    collection.objects.link(split)
    split.data.materials.append(material)
    _parent_to_bone(split, armature, "pelvis")


def _set_pose(armature: bpy.types.Object, pose: dict) -> None:
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.location = (0.0, 0.0, 0.0)
    armature.pose.bones["root"].location = pose["root_location"]
    for bone_name, values in pose["rotations_degrees"].items():
        bone = armature.pose.bones.get(bone_name)
        if bone is None:
            raise RefinementError(f"Refined pose references missing bone: {bone_name}")
        bone.rotation_euler = tuple(math.radians(value) for value in values)


def _update_pose_library(armature: bpy.types.Object) -> None:
    action = bpy.data.actions.get(ACTION_NAME)
    if action is None:
        raise RefinementError(f"Required action missing: {ACTION_NAME}")
    armature.animation_data_create()
    armature.animation_data.action = action

    for frame in POSE_FRAMES:
        bpy.context.scene.frame_set(frame)
        _set_pose(armature, REFINED_POSES[frame])
        for bone in armature.pose.bones:
            bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone.name)
            bone.keyframe_insert(data_path="location", frame=frame, group=bone.name)

    payload = {
        "schemaVersion": 1,
        "refinementVersion": REFINEMENT_VERSION,
        "frames": {
            str(frame): {
                "root_location": list(REFINED_POSES[frame]["root_location"]),
                "rotations_degrees": {
                    bone: list(values)
                    for bone, values in REFINED_POSES[frame]["rotations_degrees"].items()
                },
            }
            for frame in POSE_FRAMES
        },
    }
    armature[POSE_LIBRARY_PROPERTY] = json.dumps(payload, sort_keys=True)
    armature[REFINEMENT_PROPERTY] = REFINEMENT_VERSION

    for fcurve in action.fcurves:
        for point in fcurve.keyframe_points:
            point.interpolation = "BEZIER"
            point.handle_left_type = "AUTO_CLAMPED"
            point.handle_right_type = "AUTO_CLAMPED"

    bpy.context.scene.frame_set(POSE_FRAMES[0])
    _set_pose(armature, REFINED_POSES[POSE_FRAMES[0]])
    bpy.context.view_layer.update()


def _apply_geometry_refinement(armature: bpy.types.Object) -> None:
    # Shorter, narrower robe and cape expose the lower legs while preserving class identity.
    _adjust_world("Dawn_Robe", (0.90, 0.90, 0.80), (0.0, 0.0, 0.14))
    _adjust_world("Dawn_RobeShadow", (0.88, 0.88, 0.76), (0.0, 0.0, 0.15))
    _adjust_world("Dawn_RobeFrontTrim", (0.95, 1.00, 0.78), (0.0, 0.0, 0.14))
    _adjust_world("Dawn_Cape", (0.92, 0.90, 0.82), (0.0, 0.0, 0.10))

    # Larger, slightly separated boots and shins make contact poses visible at 1x.
    _adjust_world("Dawn_Shin.L", (1.10, 1.10, 1.02), (0.020, 0.0, 0.0))
    _adjust_world("Dawn_Shin.R", (1.10, 1.10, 1.02), (-0.020, 0.0, 0.0))
    _adjust_world("Dawn_Boot.L", (1.18, 1.12, 1.15), (0.030, -0.025, 0.015))
    _adjust_world("Dawn_Boot.R", (1.18, 1.12, 1.15), (-0.030, -0.025, 0.015))

    # Strengthen the face/hair/armor value blocks without adding micro-detail.
    _adjust_world("Dawn_HairCap", (1.04, 1.04, 1.03), (0.0, 0.0, 0.0))
    for index in range(5):
        _adjust_world(f"Dawn_HairLock.{index:02d}", (1.04, 1.04, 1.02), (0.0, 0.0, 0.0))
    _adjust_world("Dawn_ChestPlate", (1.08, 1.10, 1.05), (0.0, -0.010, 0.0))
    _adjust_world("Dawn_Pauldron.L", (1.08, 1.08, 1.05), (0.010, 0.0, 0.0))
    _adjust_world("Dawn_Pauldron.R", (1.08, 1.08, 1.05), (-0.010, 0.0, 0.0))

    _ensure_robe_split(armature)


def _verify(armature: bpy.types.Object) -> None:
    if armature.get(REFINEMENT_PROPERTY) != REFINEMENT_VERSION:
        raise RefinementError("Dawn refinement marker was not stored")
    if bpy.data.objects.get("Dawn_RobeSplitShadow") is None:
        raise RefinementError("Dawn robe split geometry was not created")
    payload = json.loads(str(armature[POSE_LIBRARY_PROPERTY]))
    if payload.get("refinementVersion") != REFINEMENT_VERSION:
        raise RefinementError("Pose library refinement version drifted")
    if sorted(int(frame) for frame in payload.get("frames", {})) != list(POSE_FRAMES):
        raise RefinementError("Refined pose frame contract drifted")


def main() -> int:
    try:
        args = _parse_args()
        output = Path(args.output).expanduser().resolve()
        armature = _object(ARMATURE_NAME, "ARMATURE")
        _tune_materials()
        _apply_geometry_refinement(armature)
        _update_pose_library(armature)
        _verify(armature)
        output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(output))
        print(f"Applied Dawn visual refinement: {REFINEMENT_VERSION}")
        print(f"Saved refined Dawn model: {output}")
        return 0
    except RefinementError as exc:
        print(f"Dawn visual refinement failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
