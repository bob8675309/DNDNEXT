"""Build a stylized, rigged Dawn Whiteflame prototype in Blender.

Run in Blender 4.x:

    blender --background --python tools/blender/dndnext_dawn_model_builder.py -- \
      --output build/dawn_whiteflame_model.blend

The script creates the exact object names required by the DNDNext sprite exporter:

- render collection: DawnWhiteflame_Sprite
- rotation root: DNDNext_SpriteRoot
- armature: Dawn_Rig
- action: Dawn_Walk

The approved character sheet remains the visual reference. This generator creates a
functional tactics-readable blockout from simple rigidly bone-parented meshes so the
first real 32-frame atlas can be rendered without external modeling add-ons.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


COLLECTION_NAME = "DawnWhiteflame_Sprite"
ROOT_NAME = "DNDNext_SpriteRoot"
ARMATURE_NAME = "Dawn_Rig"
ACTION_NAME = "Dawn_Walk"


class BuildError(RuntimeError):
    pass


def _script_args() -> list[str]:
    argv = sys.argv
    return argv[argv.index("--") + 1 :] if "--" in argv else []


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the procedural Dawn Whiteflame Blender prototype.")
    parser.add_argument("--output", default="build/dawn_whiteflame_model.blend")
    parser.add_argument("--no-save", action="store_true")
    parser.add_argument("--keep-scene", action="store_true", help="Do not clear the current scene before building.")
    return parser.parse_args(_script_args())


def _remove_object(obj: bpy.types.Object) -> None:
    bpy.data.objects.remove(obj, do_unlink=True)


def clear_scene() -> None:
    for obj in list(bpy.data.objects):
        _remove_object(obj)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.armatures,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def ensure_collection(name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def link_only(collection: bpy.types.Collection, obj: bpy.types.Object) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def material(
    name: str,
    base_color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.55,
    emission_color: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    if principled is None:
        raise BuildError(f"Material {name} has no Principled BSDF node")
    principled.inputs["Base Color"].default_value = base_color
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    if "Emission Color" in principled.inputs:
        principled.inputs["Emission Color"].default_value = emission_color or (0.0, 0.0, 0.0, 1.0)
        principled.inputs["Emission Strength"].default_value = emission_strength
    elif "Emission" in principled.inputs:
        principled.inputs["Emission"].default_value = emission_color or (0.0, 0.0, 0.0, 1.0)
        principled.inputs["Emission Strength"].default_value = emission_strength
    return mat


def assign_material(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(mat)


def apply_bevel(obj: bpy.types.Object, width: float = 0.025, segments: int = 2) -> None:
    modifier = obj.modifiers.new(name="TacticalBevel", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"


def smooth_mesh(obj: bpy.types.Object) -> None:
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


def primitive_uv_sphere(
    collection: bpy.types.Collection,
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    segments: int = 32,
    rings: int = 16,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    link_only(collection, obj)
    assign_material(obj, mat)
    smooth_mesh(obj)
    return obj


def primitive_ico_sphere(
    collection: bpy.types.Collection,
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    subdivisions: int = 2,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    link_only(collection, obj)
    assign_material(obj, mat)
    smooth_mesh(obj)
    return obj


def primitive_cube(
    collection: bpy.types.Collection,
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.025,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    link_only(collection, obj)
    assign_material(obj, mat)
    if bevel > 0:
        apply_bevel(obj, bevel)
    smooth_mesh(obj)
    return obj


def primitive_cone(
    collection: bpy.types.Collection,
    name: str,
    location: tuple[float, float, float],
    radius1: float,
    radius2: float,
    depth: float,
    mat: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    vertices: int = 32,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    link_only(collection, obj)
    assign_material(obj, mat)
    smooth_mesh(obj)
    return obj


def cylinder_between(
    collection: bpy.types.Collection,
    name: str,
    start: Vector,
    end: Vector,
    radius: float,
    mat: bpy.types.Material,
    vertices: int = 20,
) -> bpy.types.Object:
    direction = end - start
    length = direction.length
    if length <= 1e-5:
        raise BuildError(f"Cannot create zero-length cylinder {name}")
    midpoint = (start + end) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    link_only(collection, obj)
    assign_material(obj, mat)
    smooth_mesh(obj)
    return obj


def torus(
    collection: bpy.types.Collection,
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    mat: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=24,
        minor_segments=8,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    link_only(collection, obj)
    assign_material(obj, mat)
    smooth_mesh(obj)
    return obj


def parent_to_bone(obj: bpy.types.Object, armature: bpy.types.Object, bone_name: str) -> None:
    if armature.pose.bones.get(bone_name) is None:
        raise BuildError(f"Missing pose bone {bone_name}")
    world = obj.matrix_world.copy()
    obj.parent = armature
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world


def create_armature(collection: bpy.types.Collection) -> bpy.types.Object:
    arm_data = bpy.data.armatures.new(f"{ARMATURE_NAME}_Data")
    arm = bpy.data.objects.new(ARMATURE_NAME, arm_data)
    collection.objects.link(arm)
    arm.show_in_front = True

    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    def bone(name: str, head: tuple[float, float, float], tail: tuple[float, float, float], parent: str | None = None) -> None:
        edit_bone = arm.data.edit_bones.new(name)
        edit_bone.head = head
        edit_bone.tail = tail
        if parent:
            edit_bone.parent = arm.data.edit_bones[parent]

    bone("root", (0, 0, 0), (0, 0, 0.35))
    bone("pelvis", (0, 0, 0.72), (0, 0, 1.03), "root")
    bone("spine", (0, 0, 1.03), (0, 0, 1.42), "pelvis")
    bone("chest", (0, 0, 1.42), (0, 0, 1.74), "spine")
    bone("neck", (0, 0, 1.74), (0, 0, 1.88), "chest")
    bone("head", (0, 0, 1.88), (0, 0, 2.18), "neck")

    bone("upper_arm.L", (0.18, 0, 1.67), (0.52, 0, 1.54), "chest")
    bone("forearm.L", (0.52, 0, 1.54), (0.73, 0, 1.26), "upper_arm.L")
    bone("hand.L", (0.73, 0, 1.26), (0.82, 0, 1.14), "forearm.L")
    bone("upper_arm.R", (-0.18, 0, 1.67), (-0.52, 0, 1.54), "chest")
    bone("forearm.R", (-0.52, 0, 1.54), (-0.73, 0, 1.27), "upper_arm.R")
    bone("hand.R", (-0.73, 0, 1.27), (-0.82, 0, 1.14), "forearm.R")

    bone("thigh.L", (0.16, 0, 0.85), (0.17, 0, 0.47), "pelvis")
    bone("shin.L", (0.17, 0, 0.47), (0.17, 0, 0.12), "thigh.L")
    bone("foot.L", (0.17, 0, 0.12), (0.17, -0.22, 0.08), "shin.L")
    bone("thigh.R", (-0.16, 0, 0.85), (-0.17, 0, 0.47), "pelvis")
    bone("shin.R", (-0.17, 0, 0.47), (-0.17, 0, 0.12), "thigh.R")
    bone("foot.R", (-0.17, 0, 0.12), (-0.17, -0.22, 0.08), "shin.R")

    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in arm.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    arm.select_set(False)
    return arm


def build_materials() -> dict[str, bpy.types.Material]:
    return {
        "skin": material("Dawn_Skin", (0.62, 0.50, 0.44, 1.0), roughness=0.72),
        "ivory": material("Dawn_Ivory", (0.74, 0.71, 0.62, 1.0), roughness=0.72),
        "ivory_dark": material("Dawn_IvoryShadow", (0.39, 0.37, 0.34, 1.0), roughness=0.82),
        "gold": material("Dawn_PaleGold", (0.52, 0.31, 0.08, 1.0), metallic=0.72, roughness=0.28),
        "gold_bright": material("Dawn_GoldHighlight", (0.88, 0.60, 0.18, 1.0), metallic=0.76, roughness=0.20),
        "leather": material("Dawn_Leather", (0.12, 0.07, 0.035, 1.0), roughness=0.76),
        "dark": material("Dawn_DarkMetal", (0.045, 0.05, 0.06, 1.0), metallic=0.38, roughness=0.48),
        "hair": material("Dawn_SilverHair", (0.67, 0.70, 0.72, 1.0), roughness=0.48),
        "eye": material("Dawn_Eyes", (0.10, 0.22, 0.28, 1.0), roughness=0.25),
        "flame": material(
            "Dawn_DivineFlame",
            (1.0, 0.68, 0.20, 1.0),
            roughness=0.20,
            emission_color=(1.0, 0.52, 0.08, 1.0),
            emission_strength=4.0,
        ),
        "flame_core": material(
            "Dawn_DivineFlameCore",
            (1.0, 0.95, 0.72, 1.0),
            roughness=0.15,
            emission_color=(1.0, 0.90, 0.48, 1.0),
            emission_strength=7.0,
        ),
    }


def build_character(collection: bpy.types.Collection, arm: bpy.types.Object, mats: dict[str, bpy.types.Material]) -> list[bpy.types.Object]:
    created: list[bpy.types.Object] = []

    def add(obj: bpy.types.Object, bone_name: str | None = None) -> bpy.types.Object:
        created.append(obj)
        if bone_name:
            parent_to_bone(obj, arm, bone_name)
        return obj

    add(primitive_cone(collection, "Dawn_Robe", (0, 0, 0.78), 0.52, 0.28, 1.35, mats["ivory"]), "pelvis")
    add(primitive_cone(collection, "Dawn_RobeShadow", (0, 0.04, 0.76), 0.40, 0.23, 1.25, mats["ivory_dark"]), "pelvis")
    add(primitive_uv_sphere(collection, "Dawn_Torso", (0, 0, 1.42), (0.30, 0.21, 0.34), mats["ivory"]), "chest")
    add(primitive_cube(collection, "Dawn_ChestPlate", (0, -0.19, 1.50), (0.24, 0.06, 0.24), mats["gold"], bevel=0.035), "chest")
    add(torus(collection, "Dawn_Belt", (0, 0, 0.98), 0.31, 0.035, mats["leather"]), "pelvis")
    add(primitive_cube(collection, "Dawn_BeltBuckle", (0, -0.31, 0.98), (0.07, 0.035, 0.07), mats["gold_bright"], bevel=0.02), "pelvis")

    add(primitive_uv_sphere(collection, "Dawn_Head", (0, -0.01, 2.05), (0.21, 0.19, 0.26), mats["skin"]), "head")
    add(primitive_ico_sphere(collection, "Dawn_Eye.L", (0.075, -0.185, 2.08), (0.023, 0.012, 0.018), mats["eye"], subdivisions=2), "head")
    add(primitive_ico_sphere(collection, "Dawn_Eye.R", (-0.075, -0.185, 2.08), (0.023, 0.012, 0.018), mats["eye"], subdivisions=2), "head")
    add(primitive_cone(collection, "Dawn_Ear.L", (0.22, -0.01, 2.05), 0.035, 0.0, 0.18, mats["skin"], rotation=(0, math.radians(80), 0), vertices=12), "head")
    add(primitive_cone(collection, "Dawn_Ear.R", (-0.22, -0.01, 2.05), 0.035, 0.0, 0.18, mats["skin"], rotation=(0, math.radians(-80), 0), vertices=12), "head")
    add(primitive_uv_sphere(collection, "Dawn_HairCap", (0, 0.04, 2.15), (0.235, 0.21, 0.22), mats["hair"]), "head")
    for index, (x, y, z, sx, sy, sz, rz) in enumerate([
        (-0.16, 0.08, 1.95, 0.10, 0.08, 0.34, -12),
        (0.16, 0.08, 1.95, 0.10, 0.08, 0.34, 12),
        (-0.10, 0.16, 1.78, 0.11, 0.08, 0.42, -8),
        (0.10, 0.16, 1.78, 0.11, 0.08, 0.42, 8),
        (0.0, 0.19, 1.67, 0.13, 0.09, 0.46, 0),
    ]):
        strand = primitive_uv_sphere(collection, f"Dawn_HairLock.{index:02d}", (x, y, z), (sx, sy, sz), mats["hair"], segments=20, rings=12)
        strand.rotation_euler.z = math.radians(rz)
        add(strand, "head")

    add(primitive_uv_sphere(collection, "Dawn_Pauldron.L", (0.34, 0, 1.64), (0.17, 0.19, 0.12), mats["gold"]), "chest")
    add(primitive_uv_sphere(collection, "Dawn_Pauldron.R", (-0.34, 0, 1.64), (0.17, 0.19, 0.12), mats["gold"]), "chest")
    add(primitive_cube(collection, "Dawn_Mantle", (0, 0.16, 1.52), (0.35, 0.06, 0.22), mats["ivory"], bevel=0.04), "chest")
    add(primitive_cone(collection, "Dawn_Cape", (0, 0.20, 1.05), 0.48, 0.30, 1.32, mats["ivory"], rotation=(math.radians(4), 0, 0)), "chest")

    bone_points = {
        "upper_arm.L": (Vector((0.18, 0, 1.67)), Vector((0.52, 0, 1.54))),
        "forearm.L": (Vector((0.52, 0, 1.54)), Vector((0.73, 0, 1.26))),
        "upper_arm.R": (Vector((-0.18, 0, 1.67)), Vector((-0.52, 0, 1.54))),
        "forearm.R": (Vector((-0.52, 0, 1.54)), Vector((-0.73, 0, 1.27))),
    }
    for bone_name, (start, end) in bone_points.items():
        side = bone_name[-1]
        segment = "UpperArm" if bone_name.startswith("upper") else "Forearm"
        add(cylinder_between(collection, f"Dawn_{segment}.{side}", start, end, 0.09, mats["ivory"]), bone_name)
    add(primitive_uv_sphere(collection, "Dawn_Hand.L", (0.82, 0, 1.14), (0.075, 0.06, 0.10), mats["skin"]), "hand.L")
    add(primitive_uv_sphere(collection, "Dawn_Hand.R", (-0.82, 0, 1.14), (0.075, 0.06, 0.10), mats["skin"]), "hand.R")
    add(torus(collection, "Dawn_Gauntlet.L", (0.73, 0, 1.27), 0.085, 0.025, mats["gold"], rotation=(0, math.radians(90), 0)), "forearm.L")
    add(torus(collection, "Dawn_Gauntlet.R", (-0.73, 0, 1.28), 0.085, 0.025, mats["gold"], rotation=(0, math.radians(90), 0)), "forearm.R")

    for side, x in (("L", 0.17), ("R", -0.17)):
        add(cylinder_between(collection, f"Dawn_Shin.{side}", Vector((x, 0, 0.47)), Vector((x, 0, 0.12)), 0.095, mats["dark"]), f"shin.{side}")
        add(primitive_cube(collection, f"Dawn_Boot.{side}", (x, -0.10, 0.10), (0.11, 0.18, 0.10), mats["dark"], bevel=0.035), f"foot.{side}")

    staff_x = -0.86
    staff_bottom = Vector((staff_x, 0.0, 0.10))
    staff_top = Vector((staff_x, 0.0, 2.38))
    add(cylinder_between(collection, "Dawn_StaffShaft", staff_bottom, staff_top, 0.035, mats["gold"], vertices=24), "hand.R")
    add(torus(collection, "Dawn_StaffRing", (staff_x, 0, 2.30), 0.15, 0.025, mats["gold_bright"], rotation=(math.radians(90), 0, 0)), "hand.R")
    for index, angle in enumerate((-55, -25, 25, 55)):
        radians = math.radians(angle)
        start = Vector((staff_x, 0.0, 2.27))
        end = Vector((staff_x + math.sin(radians) * 0.18, 0.0, 2.46 + math.cos(radians) * 0.05))
        add(cylinder_between(collection, f"Dawn_StaffProng.{index}", start, end, 0.018, mats["gold_bright"], vertices=12), "hand.R")
    add(primitive_ico_sphere(collection, "Dawn_FlameOuter", (staff_x, 0, 2.48), (0.12, 0.10, 0.19), mats["flame"], subdivisions=3), "hand.R")
    add(primitive_ico_sphere(collection, "Dawn_FlameCore", (staff_x, -0.01, 2.46), (0.065, 0.055, 0.13), mats["flame_core"], subdivisions=3), "hand.R")

    add(torus(collection, "Dawn_HolyEmblem", (0, -0.25, 1.46), 0.10, 0.018, mats["gold_bright"], rotation=(math.radians(90), 0, 0)), "chest")
    add(primitive_cube(collection, "Dawn_RobeFrontTrim", (0, -0.36, 0.78), (0.055, 0.025, 0.58), mats["gold_bright"], bevel=0.012), "pelvis")
    add(primitive_cube(collection, "Dawn_CapeSigil", (0, 0.51, 1.12), (0.12, 0.025, 0.18), mats["gold"], rotation=(math.radians(8), 0, 0), bevel=0.018), "chest")

    return created


def set_pose(arm: bpy.types.Object, rotations: dict[str, tuple[float, float, float]], root_location: tuple[float, float, float]) -> None:
    for pose_bone in arm.pose.bones:
        pose_bone.rotation_mode = "XYZ"
        pose_bone.rotation_euler = (0.0, 0.0, 0.0)
        pose_bone.location = (0.0, 0.0, 0.0)
    arm.pose.bones["root"].location = root_location
    for bone_name, degrees in rotations.items():
        bone = arm.pose.bones.get(bone_name)
        if bone is None:
            raise BuildError(f"Animation references missing bone {bone_name}")
        bone.rotation_euler = tuple(math.radians(value) for value in degrees)


def insert_pose(arm: bpy.types.Object, frame: int) -> None:
    bpy.context.scene.frame_set(frame)
    for bone in arm.pose.bones:
        bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone.name)
        bone.keyframe_insert(data_path="location", frame=frame, group=bone.name)


def create_walk_action(arm: bpy.types.Object) -> bpy.types.Action:
    action = bpy.data.actions.get(ACTION_NAME) or bpy.data.actions.new(ACTION_NAME)
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action

    poses = {
        1: ({"upper_arm.L": (2, 0, -5), "upper_arm.R": (-2, 0, 4), "forearm.L": (4, 0, 3), "forearm.R": (-5, 0, -2)}, (0.0, 0.0, 0.0)),
        7: ({
            "pelvis": (0, 0, -3), "chest": (0, 0, 2),
            "thigh.L": (24, 0, 0), "shin.L": (-12, 0, 0), "foot.L": (7, 0, 0),
            "thigh.R": (-20, 0, 0), "shin.R": (18, 0, 0), "foot.R": (-6, 0, 0),
            "upper_arm.L": (-15, 0, -4), "forearm.L": (8, 0, 4),
            "upper_arm.R": (8, 0, 3), "forearm.R": (-4, 0, -2),
        }, (0.0, 0.0, -0.025)),
        13: ({
            "pelvis": (0, 0, 2), "chest": (0, 0, -1),
            "thigh.L": (-3, 0, 0), "shin.L": (10, 0, 0),
            "thigh.R": (4, 0, 0), "shin.R": (8, 0, 0),
            "upper_arm.L": (2, 0, -2), "upper_arm.R": (-2, 0, 2),
        }, (0.0, 0.0, 0.018)),
        19: ({
            "pelvis": (0, 0, 3), "chest": (0, 0, -2),
            "thigh.L": (-20, 0, 0), "shin.L": (18, 0, 0), "foot.L": (-6, 0, 0),
            "thigh.R": (24, 0, 0), "shin.R": (-12, 0, 0), "foot.R": (7, 0, 0),
            "upper_arm.L": (15, 0, -4), "forearm.L": (-8, 0, 4),
            "upper_arm.R": (-8, 0, 3), "forearm.R": (4, 0, -2),
        }, (0.0, 0.0, -0.025)),
    }

    for frame, (rotations, root_location) in poses.items():
        set_pose(arm, rotations, root_location)
        insert_pose(arm, frame)

    for fcurve in action.fcurves:
        for point in fcurve.keyframe_points:
            point.interpolation = "BEZIER"
            point.handle_left_type = "AUTO_CLAMPED"
            point.handle_right_type = "AUTO_CLAMPED"

    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 19
    bpy.context.scene.frame_set(1)
    return action


def ensure_rotation_root(collection: bpy.types.Collection) -> bpy.types.Object:
    root = bpy.data.objects.get(ROOT_NAME)
    if root is None:
        root = bpy.data.objects.new(ROOT_NAME, None)
        collection.objects.link(root)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.35
    root.location = (0.0, 0.0, 0.0)
    return root


def parent_armature_to_root(arm: bpy.types.Object, root: bpy.types.Object) -> None:
    world = arm.matrix_world.copy()
    arm.parent = root
    arm.matrix_world = world


def configure_scene() -> None:
    scene = bpy.context.scene
    scene.render.resolution_x = 64
    scene.render.resolution_y = 64
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.image_settings.compression = 15
    if scene.world:
        scene.world.color = (0.012, 0.010, 0.018)
    available_looks = {item.name for item in scene.bl_rna.properties["view_settings"].fixed_type.properties["look"].enum_items} if False else set()
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass


def verify_contract(collection: bpy.types.Collection, arm: bpy.types.Object, action: bpy.types.Action) -> None:
    required_bones = {
        "root", "pelvis", "spine", "chest", "neck", "head",
        "upper_arm.L", "forearm.L", "hand.L", "upper_arm.R", "forearm.R", "hand.R",
        "thigh.L", "shin.L", "foot.L", "thigh.R", "shin.R", "foot.R",
    }
    missing = sorted(required_bones.difference(arm.pose.bones.keys()))
    if missing:
        raise BuildError(f"Rig missing required bones: {missing}")
    if collection.name != COLLECTION_NAME or arm.name != ARMATURE_NAME or action.name != ACTION_NAME:
        raise BuildError("Exporter naming contract drifted")
    for required_object in ("Dawn_StaffShaft", "Dawn_FlameCore", "Dawn_Robe", "Dawn_Head"):
        if bpy.data.objects.get(required_object) is None:
            raise BuildError(f"Required object missing: {required_object}")


def save_blend(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path))


def main() -> int:
    try:
        args = _parse_args()
        if not args.keep_scene:
            clear_scene()
        collection = ensure_collection(COLLECTION_NAME)
        root = ensure_rotation_root(collection)
        arm = create_armature(collection)
        mats = build_materials()
        build_character(collection, arm, mats)
        parent_armature_to_root(arm, root)
        action = create_walk_action(arm)
        configure_scene()
        verify_contract(collection, arm, action)

        output_path = Path(args.output).expanduser().resolve()
        if not args.no_save:
            save_blend(output_path)
            print(f"Saved Dawn Whiteflame prototype: {output_path}")
        else:
            print("Dawn Whiteflame prototype built in memory; --no-save requested.")
        print(f"Armature: {arm.name}")
        print(f"Action: {action.name}")
        print(f"Render collection: {collection.name}")
        print("Next: run dndnext_sprite_scene_setup.py, then dndnext_sprite_export.py.")
        return 0
    except BuildError as exc:
        print(f"Dawn Whiteflame model build failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
