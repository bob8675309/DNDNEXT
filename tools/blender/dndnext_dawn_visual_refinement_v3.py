"""Rebuild Dawn Whiteflame's tactical silhouette and walk without frame editing.

This v3 pass replaces the cone-robed blockout with a split tabard/cape silhouette,
keeps both legs visible, reduces oversized head/shoulder forms, and installs a
restrained zero-bob four-pose walk. The right-hand staff pose remains fixed across
all frames so the equipment cannot twitch independently of the body.
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
REFINEMENT_VERSION = "dawn_humanoid_walk_v3"
POSE_FRAMES = (1, 7, 13, 19)

# Root height is intentionally identical in all four frames. At 64x64, a tiny
# procedural bob becomes a visible whole-sprite snap after projection/rounding.
REFINED_POSES = {
    1: {
        "root_location": (0.0, 0.0, 0.0),
        "rotations_degrees": {
            "pelvis": (0, 0, 0), "chest": (0, 0, 0),
            "upper_arm.L": (2, -1, -6), "forearm.L": (5, 0, 4),
            "upper_arm.R": (-2, 1, 4), "forearm.R": (-4, 0, -2),
            "thigh.L": (3, 0, 1), "shin.L": (-2, 0, 0), "foot.L": (1, 0, 0),
            "thigh.R": (-3, 0, -1), "shin.R": (2, 0, 0), "foot.R": (-1, 0, 0),
        },
    },
    7: {
        "root_location": (0.0, 0.0, 0.0),
        "rotations_degrees": {
            "pelvis": (0, 1, -2), "chest": (0, -1, 2),
            "upper_arm.L": (-11, -2, -6), "forearm.L": (9, 0, 5),
            "upper_arm.R": (-2, 1, 4), "forearm.R": (-4, 0, -2),
            "thigh.L": (19, 1, 2), "shin.L": (-10, 0, 0), "foot.L": (6, 0, 0),
            "thigh.R": (-16, -1, -2), "shin.R": (17, 0, 0), "foot.R": (-7, 0, 0),
        },
    },
    13: {
        "root_location": (0.0, 0.0, 0.0),
        "rotations_degrees": {
            "pelvis": (0, 0, 1), "chest": (0, 0, -1),
            "upper_arm.L": (1, 0, -5), "forearm.L": (5, 0, 4),
            "upper_arm.R": (-2, 1, 4), "forearm.R": (-4, 0, -2),
            "thigh.L": (-6, 0, -1), "shin.L": (18, 0, 0), "foot.L": (-5, 0, 0),
            "thigh.R": (8, 0, 1), "shin.R": (8, 0, 0), "foot.R": (-2, 0, 0),
        },
    },
    19: {
        "root_location": (0.0, 0.0, 0.0),
        "rotations_degrees": {
            "pelvis": (0, -1, 2), "chest": (0, 1, -2),
            "upper_arm.L": (11, 2, -6), "forearm.L": (-9, 0, 5),
            "upper_arm.R": (-2, 1, 4), "forearm.R": (-4, 0, -2),
            "thigh.L": (-16, -1, 2), "shin.L": (17, 0, 0), "foot.L": (-7, 0, 0),
            "thigh.R": (19, 1, -2), "shin.R": (-10, 0, 0), "foot.R": (6, 0, 0),
        },
    },
}


class RefinementError(RuntimeError):
    pass


def _script_args() -> list[str]:
    argv = sys.argv
    return argv[argv.index("--") + 1 :] if "--" in argv else []


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply Dawn Whiteflame visual refinement v3.")
    parser.add_argument("--output", required=True)
    return parser.parse_args(_script_args())


def _object(name: str, expected_type: str | None = None) -> bpy.types.Object:
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise RefinementError(f"Required object missing: {name}")
    if expected_type and obj.type != expected_type:
        raise RefinementError(f"Object {name} must be {expected_type}; found {obj.type}")
    return obj


def _collection() -> bpy.types.Collection:
    collection = bpy.data.collections.get(COLLECTION_NAME)
    if collection is None:
        raise RefinementError(f"Required collection missing: {COLLECTION_NAME}")
    return collection


def _material(name: str) -> bpy.types.Material:
    material = bpy.data.materials.get(name)
    if material is None:
        raise RefinementError(f"Required material missing: {name}")
    return material


def _principled(name: str):
    material = _material(name)
    if not material.use_nodes:
        raise RefinementError(f"Material has no nodes: {name}")
    node = material.node_tree.nodes.get("Principled BSDF")
    if node is None:
        raise RefinementError(f"Material has no Principled BSDF: {name}")
    return node


def _link_only(collection: bpy.types.Collection, obj: bpy.types.Object) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def _parent_to_bone(obj: bpy.types.Object, armature: bpy.types.Object, bone_name: str) -> None:
    if armature.pose.bones.get(bone_name) is None:
        raise RefinementError(f"Missing bone for refinement object: {bone_name}")
    world = obj.matrix_world.copy()
    obj.parent = armature
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world


def _assign_material(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(material)


def _bevel(obj: bpy.types.Object, width: float = 0.025) -> None:
    modifier = obj.modifiers.new(name="DawnV3Bevel", type="BEVEL")
    modifier.width = width
    modifier.segments = 2
    modifier.limit_method = "ANGLE"


def _cube(name: str, location, scale, material_name: str, *, rotation=(0.0, 0.0, 0.0), bevel=0.025):
    existing = bpy.data.objects.get(name)
    if existing is not None:
        bpy.data.objects.remove(existing, do_unlink=True)
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    _link_only(_collection(), obj)
    _assign_material(obj, _material(material_name))
    _bevel(obj, bevel)
    return obj


def _cone(name: str, location, radius1: float, radius2: float, depth: float, material_name: str):
    existing = bpy.data.objects.get(name)
    if existing is not None:
        bpy.data.objects.remove(existing, do_unlink=True)
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=radius1, radius2=radius2, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    _link_only(_collection(), obj)
    _assign_material(obj, _material(material_name))
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def _cylinder_between(name: str, start: Vector, end: Vector, radius: float, material_name: str):
    existing = bpy.data.objects.get(name)
    if existing is not None:
        bpy.data.objects.remove(existing, do_unlink=True)
    direction = end - start
    length = direction.length
    midpoint = (start + end) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=radius, depth=length, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    _link_only(_collection(), obj)
    _assign_material(obj, _material(material_name))
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def _scale_world(name: str, scale, translate=(0.0, 0.0, 0.0)) -> None:
    obj = _object(name)
    location, rotation, current_scale = obj.matrix_world.decompose()
    obj.matrix_world = Matrix.LocRotScale(
        location + Vector(translate),
        rotation,
        Vector((current_scale.x * scale[0], current_scale.y * scale[1], current_scale.z * scale[2])),
    )


def _hide_legacy_cone_silhouette() -> None:
    for name in (
        "Dawn_Robe", "Dawn_RobeShadow", "Dawn_Cape", "Dawn_RobeFrontTrim",
        "Dawn_RobeSplitShadow", "Dawn_CapeSigil",
    ):
        obj = bpy.data.objects.get(name)
        if obj is not None:
            obj.hide_render = True
            obj.hide_viewport = True


def _tune_materials() -> None:
    ivory = _principled("Dawn_Ivory")
    ivory.inputs["Base Color"].default_value = (0.70, 0.67, 0.59, 1.0)
    ivory.inputs["Roughness"].default_value = 0.76
    shadow = _principled("Dawn_IvoryShadow")
    shadow.inputs["Base Color"].default_value = (0.18, 0.18, 0.19, 1.0)
    shadow.inputs["Roughness"].default_value = 0.86
    gold = _principled("Dawn_PaleGold")
    gold.inputs["Base Color"].default_value = (0.54, 0.31, 0.07, 1.0)
    gold.inputs["Metallic"].default_value = 0.64
    gold.inputs["Roughness"].default_value = 0.34
    bright = _principled("Dawn_GoldHighlight")
    bright.inputs["Base Color"].default_value = (0.88, 0.57, 0.16, 1.0)
    bright.inputs["Metallic"].default_value = 0.70
    bright.inputs["Roughness"].default_value = 0.25
    hair = _principled("Dawn_SilverHair")
    hair.inputs["Base Color"].default_value = (0.62, 0.65, 0.68, 1.0)
    hair.inputs["Roughness"].default_value = 0.58


def _rebuild_humanoid_silhouette(armature: bpy.types.Object) -> None:
    _hide_legacy_cone_silhouette()

    # Correct the oversized blockout proportions before adding readable clothing.
    _scale_world("Dawn_Head", (0.88, 0.88, 0.90), (0.0, 0.0, -0.015))
    _scale_world("Dawn_HairCap", (0.90, 0.90, 0.88), (0.0, 0.0, -0.020))
    for index in range(5):
        _scale_world(f"Dawn_HairLock.{index:02d}", (0.86, 0.86, 0.82), (0.0, 0.0, 0.035))
    _scale_world("Dawn_Pauldron.L", (0.82, 0.82, 0.86))
    _scale_world("Dawn_Pauldron.R", (0.82, 0.82, 0.86))
    _scale_world("Dawn_ChestPlate", (0.94, 0.92, 1.02), (0.0, 0.015, 0.0))
    _scale_world("Dawn_Shin.L", (1.08, 1.08, 1.02), (0.018, 0.0, 0.0))
    _scale_world("Dawn_Shin.R", (1.08, 1.08, 1.02), (-0.018, 0.0, 0.0))
    _scale_world("Dawn_Boot.L", (1.08, 1.05, 1.04), (0.018, 0.0, 0.0))
    _scale_world("Dawn_Boot.R", (1.08, 1.05, 1.04), (-0.018, 0.0, 0.0))

    tunic = _cone("DawnV3_Tunic", (0.0, 0.0, 1.18), 0.35, 0.27, 0.62, "Dawn_Ivory")
    _parent_to_bone(tunic, armature, "pelvis")

    # Four short skirt panels replace the single bell-shaped robe and leave both legs visible.
    panel_specs = (
        ("DawnV3_FrontPanel.L", (0.145, -0.095, 0.67), (0.125, 0.070, 0.31), (0.0, math.radians(-3), math.radians(-3))),
        ("DawnV3_FrontPanel.R", (-0.145, -0.095, 0.67), (0.125, 0.070, 0.31), (0.0, math.radians(3), math.radians(3))),
        ("DawnV3_BackPanel.L", (0.145, 0.105, 0.69), (0.125, 0.055, 0.29), (0.0, math.radians(-2), math.radians(-2))),
        ("DawnV3_BackPanel.R", (-0.145, 0.105, 0.69), (0.125, 0.055, 0.29), (0.0, math.radians(2), math.radians(2))),
    )
    for name, location, scale, rotation in panel_specs:
        panel = _cube(name, location, scale, "Dawn_Ivory", rotation=rotation, bevel=0.035)
        _parent_to_bone(panel, armature, "pelvis")

    for side, x in (("L", 0.17), ("R", -0.17)):
        thigh = _cylinder_between(
            f"DawnV3_Thigh.{side}", Vector((x, 0.0, 0.82)), Vector((x, 0.0, 0.47)), 0.105,
            "Dawn_DarkMetal",
        )
        _parent_to_bone(thigh, armature, f"thigh.{side}")

    for side, x, tilt in (("L", 0.13, -2), ("R", -0.13, 2)):
        trim = _cube(
            f"DawnV3_Trim.{side}", (x, -0.171, 0.69), (0.022, 0.016, 0.27),
            "Dawn_GoldHighlight", rotation=(0.0, math.radians(tilt), 0.0), bevel=0.010,
        )
        _parent_to_bone(trim, armature, "pelvis")

    for side, x, tilt in (("L", 0.16, -3), ("R", -0.16, 3)):
        cape = _cube(
            f"DawnV3_Cape.{side}", (x, 0.215, 1.18), (0.145, 0.030, 0.43),
            "Dawn_IvoryShadow", rotation=(math.radians(5), math.radians(tilt), 0.0), bevel=0.035,
        )
        _parent_to_bone(cape, armature, "chest")


def _set_pose(armature: bpy.types.Object, pose: dict) -> None:
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.location = (0.0, 0.0, 0.0)
    armature.pose.bones["root"].location = pose["root_location"]
    for bone_name, degrees in pose["rotations_degrees"].items():
        bone = armature.pose.bones.get(bone_name)
        if bone is None:
            raise RefinementError(f"Refined pose references missing bone: {bone_name}")
        bone.rotation_euler = tuple(math.radians(value) for value in degrees)


def _install_walk(armature: bpy.types.Object) -> None:
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
                    bone: list(values) for bone, values in REFINED_POSES[frame]["rotations_degrees"].items()
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


def _verify(armature: bpy.types.Object) -> None:
    if armature.get(REFINEMENT_PROPERTY) != REFINEMENT_VERSION:
        raise RefinementError("Dawn v3 refinement marker was not stored")
    payload = json.loads(str(armature[POSE_LIBRARY_PROPERTY]))
    if payload.get("refinementVersion") != REFINEMENT_VERSION:
        raise RefinementError("Dawn v3 pose library version drifted")
    if any(tuple(payload["frames"][str(frame)]["root_location"]) != (0.0, 0.0, 0.0) for frame in POSE_FRAMES):
        raise RefinementError("Dawn v3 root height must remain identical in every pose")
    for required in ("DawnV3_Tunic", "DawnV3_FrontPanel.L", "DawnV3_FrontPanel.R", "DawnV3_Thigh.L", "DawnV3_Thigh.R"):
        if bpy.data.objects.get(required) is None:
            raise RefinementError(f"Dawn v3 geometry missing: {required}")


def main() -> int:
    try:
        args = _parse_args()
        output = Path(args.output).expanduser().resolve()
        armature = _object(ARMATURE_NAME, "ARMATURE")
        _tune_materials()
        _rebuild_humanoid_silhouette(armature)
        _install_walk(armature)
        _verify(armature)
        output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(output))
        print(f"Applied Dawn visual refinement: {REFINEMENT_VERSION}")
        return 0
    except Exception as exc:
        print(f"Dawn v3 refinement failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
