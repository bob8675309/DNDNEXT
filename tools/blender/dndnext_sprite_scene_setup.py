"""Create the standard DNDNext orthographic sprite-render scene around selected objects.

Run inside Blender's Scripting workspace or from the command line:

blender DawnWhiteflame.blend --python tools/blender/dndnext_sprite_scene_setup.py -- \
  --manifest tools/blender/manifests/dawn_whiteflame.sprite.json

The script is intentionally conservative: it creates named camera/light/root objects,
links selected character objects to the render collection, and parents top-level selected
objects to the rotation root while preserving world transforms. It never creates or alters
animation data.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import bpy
from mathutils import Vector


class SetupError(RuntimeError):
    pass


def _script_args() -> list[str]:
    argv = sys.argv
    return argv[argv.index("--") + 1 :] if "--" in argv else []


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create DNDNext sprite camera, lights, root, and collection.")
    parser.add_argument("--manifest", required=True)
    parser.add_argument(
        "--parent-selected",
        action="store_true",
        help="Parent selected top-level character objects beneath the sprite rotation root.",
    )
    return parser.parse_args(_script_args())


def _read_manifest(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SetupError(f"Could not read manifest {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise SetupError("Manifest root must be an object.")
    return data


def _required(data: dict[str, Any], key: str) -> str:
    value = str(data.get(key, "")).strip()
    if not value:
        raise SetupError(f"Manifest field '{key}' is required.")
    return value


def _ensure_collection(name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def _link_object(collection: bpy.types.Collection, obj: bpy.types.Object) -> None:
    if obj.name not in collection.objects:
        collection.objects.link(obj)


def _ensure_empty(name: str, collection: bpy.types.Collection, location: tuple[float, float, float]) -> bpy.types.Object:
    obj = bpy.data.objects.get(name)
    if obj is None:
        obj = bpy.data.objects.new(name, None)
        collection.objects.link(obj)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.35
    obj.location = location
    return obj


def _point_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def _ensure_camera(name: str, collection: bpy.types.Collection, manifest: dict[str, Any]) -> bpy.types.Object:
    camera = bpy.data.objects.get(name)
    if camera is None:
        data = bpy.data.cameras.new(f"{name}_Data")
        camera = bpy.data.objects.new(name, data)
        collection.objects.link(camera)
    if camera.type != "CAMERA":
        raise SetupError(f"Existing object '{name}' is not a camera.")
    position = manifest.get("camera_position") or [0.0, -8.5, 6.8]
    target = manifest.get("camera_target") or [0.0, 0.0, 1.1]
    camera.location = tuple(float(value) for value in position)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = float(manifest.get("orthographic_scale", 4.4))
    _point_at(camera, Vector(tuple(float(value) for value in target)))
    bpy.context.scene.camera = camera
    return camera


def _ensure_area_light(
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
        raise SetupError(f"Existing object '{name}' is not a light.")
    light.data.type = "AREA"
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    light.data.color = color
    light.location = location
    _point_at(light, Vector(target))
    return light


def _parent_keep_transform(child: bpy.types.Object, parent: bpy.types.Object) -> None:
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world


def _configure_scene(scene: bpy.types.Scene) -> None:
    scene.render.resolution_x = 64
    scene.render.resolution_y = 64
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    if scene.world:
        scene.world.color = (0.015, 0.012, 0.02)


def main() -> int:
    try:
        args = _parse_args()
        manifest = _read_manifest(Path(args.manifest).expanduser().resolve())
        collection = _ensure_collection(_required(manifest, "render_collection"))
        root = _ensure_empty(_required(manifest, "rotation_root"), collection, (0.0, 0.0, 0.0))
        _ensure_empty("DNDNext_SpritePivot", collection, (0.0, 0.0, 0.0))
        _ensure_camera(_required(manifest, "camera_object"), collection, manifest)
        _ensure_area_light(
            "DNDNext_Key",
            collection,
            (-4.5, -5.5, 7.0),
            (0.0, 0.0, 1.2),
            850.0,
            4.0,
            (1.0, 0.82, 0.64),
        )
        _ensure_area_light(
            "DNDNext_Fill",
            collection,
            (4.5, -3.0, 4.5),
            (0.0, 0.0, 1.0),
            420.0,
            5.0,
            (0.58, 0.68, 1.0),
        )
        _ensure_area_light(
            "DNDNext_Rim",
            collection,
            (0.5, 4.5, 6.0),
            (0.0, 0.0, 1.4),
            650.0,
            3.0,
            (1.0, 0.88, 0.68),
        )

        selected = [obj for obj in bpy.context.selected_objects if obj != root]
        for obj in selected:
            _link_object(collection, obj)
        if args.parent_selected:
            selected_set = set(selected)
            for obj in selected:
                if obj.parent not in selected_set:
                    _parent_keep_transform(obj, root)

        _configure_scene(bpy.context.scene)
        print("DNDNext sprite scene template is ready.")
        print(f"Render collection: {collection.name}")
        print(f"Rotation root: {root.name}")
        print("The setup script does not create or modify the armature action.")
        print("Save a new .blend copy before running the exporter.")
        return 0
    except SetupError as exc:
        print(f"DNDNext sprite scene setup failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
