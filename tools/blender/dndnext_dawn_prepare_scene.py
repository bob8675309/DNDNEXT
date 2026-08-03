"""Finalize the procedural Dawn model for the DNDNext sprite exporter.

This script opens the generated blend, creates or updates the canonical camera and light
rig, validates the Dawn armature/action hierarchy, and saves the prepared blend in place.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


class PrepareError(RuntimeError):
    pass


def script_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare Dawn Whiteflame's generated blend for sprite export.")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(script_args())


def read_manifest(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PrepareError(f"Could not read manifest {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise PrepareError("Manifest root must be an object")
    return value


def required(manifest: dict, key: str) -> str:
    value = str(manifest.get(key, "")).strip()
    if not value:
        raise PrepareError(f"Manifest field {key!r} is required")
    return value


def ensure_collection(name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def ensure_camera(name: str, collection: bpy.types.Collection, manifest: dict) -> bpy.types.Object:
    camera = bpy.data.objects.get(name)
    if camera is None:
        data = bpy.data.cameras.new(f"{name}_Data")
        camera = bpy.data.objects.new(name, data)
        collection.objects.link(camera)
    if camera.type != "CAMERA":
        raise PrepareError(f"Existing object {name!r} is not a camera")
    camera.location = tuple(float(value) for value in manifest.get("camera_position", [0.0, -8.5, 6.8]))
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = float(manifest.get("orthographic_scale", 4.4))
    target = Vector(tuple(float(value) for value in manifest.get("camera_target", [0.0, 0.0, 1.1])))
    point_at(camera, target)
    bpy.context.scene.camera = camera
    return camera


def ensure_area_light(
    name: str,
    collection: bpy.types.Collection,
    location: tuple[float, float, float],
    target: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
) -> bpy.types.Object:
    light = bpy.data.objects.get(name)
    if light is None:
        data = bpy.data.lights.new(f"{name}_Data", type="AREA")
        light = bpy.data.objects.new(name, data)
        collection.objects.link(light)
    if light.type != "LIGHT":
        raise PrepareError(f"Existing object {name!r} is not a light")
    light.data.type = "AREA"
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    light.data.color = color
    light.location = location
    point_at(light, Vector(target))
    return light


def ensure_root(name: str, collection: bpy.types.Collection) -> bpy.types.Object:
    root = bpy.data.objects.get(name)
    if root is None:
        root = bpy.data.objects.new(name, None)
        collection.objects.link(root)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.35
    root.location = (0.0, 0.0, 0.0)
    return root


def configure_scene(manifest: dict) -> None:
    scene = bpy.context.scene
    scene.render.resolution_x = int(manifest.get("frame_width", 64))
    scene.render.resolution_y = int(manifest.get("frame_height", 64))
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.compression = int(manifest.get("png_compression", 15))
    try:
        scene.render.engine = str(manifest.get("render_engine", "BLENDER_EEVEE_NEXT"))
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    if scene.world:
        scene.world.color = (0.012, 0.010, 0.018)
    color = manifest.get("color_management") or {}
    for attr, key in (("view_transform", "view_transform"), ("look", "look")):
        value = str(color.get(key, "")).strip()
        if value:
            try:
                setattr(scene.view_settings, attr, value)
            except TypeError:
                pass
    scene.view_settings.exposure = float(color.get("exposure", 0.0))
    scene.view_settings.gamma = float(color.get("gamma", 1.0))


def validate_hierarchy(manifest: dict, collection: bpy.types.Collection, root: bpy.types.Object) -> None:
    armature_name = required(manifest, "armature_object")
    action_name = required(manifest, "action_name")
    armature = bpy.data.objects.get(armature_name)
    if armature is None or armature.type != "ARMATURE":
        raise PrepareError(f"Armature {armature_name!r} is missing")
    if bpy.data.actions.get(action_name) is None:
        raise PrepareError(f"Action {action_name!r} is missing")
    if armature.parent != root:
        world = armature.matrix_world.copy()
        armature.parent = root
        armature.matrix_world = world
    if armature.name not in collection.objects:
        collection.objects.link(armature)


def main() -> int:
    try:
        args = parse_args()
        manifest = read_manifest(Path(args.manifest).expanduser().resolve())
        collection = ensure_collection(required(manifest, "render_collection"))
        root = ensure_root(required(manifest, "rotation_root"), collection)
        validate_hierarchy(manifest, collection, root)
        ensure_camera(required(manifest, "camera_object"), collection, manifest)
        ensure_area_light("DNDNext_Key", collection, (-4.5, -5.5, 7.0), (0.0, 0.0, 1.2), 850.0, 4.0, (1.0, 0.82, 0.64))
        ensure_area_light("DNDNext_Fill", collection, (4.5, -3.0, 4.5), (0.0, 0.0, 1.0), 420.0, 5.0, (0.58, 0.68, 1.0))
        ensure_area_light("DNDNext_Rim", collection, (0.5, 4.5, 6.0), (0.0, 0.0, 1.4), 650.0, 3.0, (1.0, 0.88, 0.68))
        configure_scene(manifest)
        output = Path(args.output).expanduser().resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(output))
        print(f"Prepared Dawn sprite scene: {output}")
        return 0
    except PrepareError as exc:
        print(f"Dawn scene preparation failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
