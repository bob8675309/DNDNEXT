"""DNDNext Blender sprite exporter.

Renders the canonical South-first 4×8 atlas:
S, SW, W, NW, N, NE, E, SE. Each row contains idle, walk A,
walk B, and walk C. It writes metadata, automatic QA, and an HTML preview.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable

import bpy

DIRECTIONS = (
    ("down", "South"),
    ("down-left", "Southwest"),
    ("left", "West"),
    ("up-left", "Northwest"),
    ("up", "North"),
    ("up-right", "Northeast"),
    ("right", "East"),
    ("down-right", "Southeast"),
)
FRAME_LABELS = ("idle", "walk-a", "walk-b", "walk-c")
WALK_SEQUENCE = (0, 1, 2, 3, 2, 1)
POSE_LIBRARY_PROPERTY = "dndnext_pose_library_json"


class ExportError(RuntimeError):
    """Raised when the scene or output violates the sprite contract."""


@dataclass(frozen=True)
class AlphaMetrics:
    file: str
    direction: str
    frame_label: str
    width: int
    height: int
    visible_pixels: int
    min_x: int
    max_x: int
    min_y: int
    max_y: int
    bbox_width: int
    bbox_height: int
    center_x: float
    center_y: float
    bottom_margin: int
    top_margin: int
    left_margin: int
    right_margin: int


def _script_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render and validate a DNDNext 8-direction sprite atlas.")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--keep-frames", action="store_true")
    return parser.parse_args(_script_args())


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ExportError(f"Could not read manifest {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ExportError("Manifest root must be an object.")
    return value


def _required_text(data: dict[str, Any], key: str) -> str:
    value = str(data.get(key, "")).strip()
    if not value:
        raise ExportError(f"Manifest field {key!r} is required.")
    return value


def _required_int_list(data: dict[str, Any], key: str, count: int) -> list[int]:
    value = data.get(key)
    if not isinstance(value, list) or len(value) != count:
        raise ExportError(f"Manifest field {key!r} must contain exactly {count} integers.")
    result = [int(item) for item in value]
    if any(isinstance(item, bool) or converted != item for item, converted in zip(value, result)):
        raise ExportError(f"Manifest field {key!r} must contain only integers.")
    return result


def _required_number_list(data: dict[str, Any], key: str, count: int) -> list[float]:
    value = data.get(key)
    if not isinstance(value, list) or len(value) != count or any(isinstance(item, bool) or not isinstance(item, (int, float)) for item in value):
        raise ExportError(f"Manifest field {key!r} must contain exactly {count} numbers.")
    return [float(item) for item in value]


def _object(name: str, expected_type: str | None = None) -> bpy.types.Object:
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise ExportError(f"Required Blender object is missing: {name}")
    if expected_type and obj.type != expected_type:
        raise ExportError(f"Object {name!r} must be type {expected_type}; found {obj.type}.")
    return obj


def _collection(name: str) -> bpy.types.Collection:
    value = bpy.data.collections.get(name)
    if value is None:
        raise ExportError(f"Required Blender collection is missing: {name}")
    return value


def _action(name: str) -> bpy.types.Action:
    value = bpy.data.actions.get(name)
    if value is None:
        raise ExportError(f"Required Blender action is missing: {name}")
    return value


def _validate_manifest(manifest: dict[str, Any]) -> None:
    order = [key for key, _label in DIRECTIONS]
    if manifest.get("direction_order") != order:
        raise ExportError("Manifest direction_order must be exactly South-first runtime order: " + ", ".join(order))
    if manifest.get("frame_labels") != list(FRAME_LABELS):
        raise ExportError("Manifest frame_labels must be exactly idle, walk-a, walk-b, walk-c.")
    if manifest.get("sprite_format") != "eight_direction_idle_walk_v1":
        raise ExportError("Manifest sprite_format must be eight_direction_idle_walk_v1.")
    if (int(manifest.get("frame_width", 0)), int(manifest.get("frame_height", 0))) != (64, 64):
        raise ExportError("DNDNext runtime cells must be exactly 64x64 pixels.")
    if (int(manifest.get("columns", 0)), int(manifest.get("rows", 0))) != (4, 8):
        raise ExportError("DNDNext runtime atlas must be exactly 4 columns x 8 rows.")
    if manifest.get("walk_sequence") != list(WALK_SEQUENCE):
        raise ExportError("Manifest walk_sequence must be exactly [0,1,2,3,2,1].")
    _required_int_list(manifest, "pose_frames", 4)
    _required_number_list(manifest, "direction_yaws_degrees", 8)


def _set_color_management(scene: bpy.types.Scene, manifest: dict[str, Any]) -> None:
    config = manifest.get("color_management") or {}
    if not isinstance(config, dict):
        raise ExportError("color_management must be an object.")
    for attr in ("view_transform", "look"):
        value = config.get(attr)
        if value:
            try:
                setattr(scene.view_settings, attr, value)
            except TypeError as exc:
                raise ExportError(f"Unsupported Blender color-management {attr}: {value}") from exc
    scene.view_settings.exposure = float(config.get("exposure", scene.view_settings.exposure))
    scene.view_settings.gamma = float(config.get("gamma", scene.view_settings.gamma))


def _configure_render(scene: bpy.types.Scene, camera: bpy.types.Object, manifest: dict[str, Any]) -> None:
    render = scene.render
    render.engine = str(manifest.get("render_engine") or "BLENDER_EEVEE_NEXT")
    render.resolution_x = render.resolution_y = 64
    render.resolution_percentage = 100
    render.film_transparent = True
    render.image_settings.file_format = "PNG"
    render.image_settings.color_mode = "RGBA"
    render.image_settings.color_depth = "8"
    render.image_settings.compression = int(manifest.get("png_compression", 15))
    scene.camera = camera
    if camera.data.type != "ORTHO":
        raise ExportError(f"Camera {camera.name!r} must be orthographic.")
    camera.data.ortho_scale = float(manifest.get("orthographic_scale", camera.data.ortho_scale))
    _set_color_management(scene, manifest)


def _collection_object_names(collection: bpy.types.Collection) -> set[str]:
    return {obj.name for obj in collection.all_objects}


def _is_renderable_geometry(obj: bpy.types.Object) -> bool:
    return obj.type in {"MESH", "CURVE", "SURFACE", "META", "FONT", "VOLUME", "GREASEPENCIL"}


def _is_descendant_of(obj: bpy.types.Object, ancestor: bpy.types.Object) -> bool:
    current = obj
    while current is not None:
        if current == ancestor:
            return True
        current = current.parent
    return False


def _validate_hierarchy(root: bpy.types.Object, collection: bpy.types.Collection, armature: bpy.types.Object) -> None:
    names = _collection_object_names(collection)
    if root.name not in names or armature.name not in names:
        raise ExportError("Rotation root and armature must belong to the render collection.")
    if armature != root and not _is_descendant_of(armature, root):
        raise ExportError(f"Armature {armature.name!r} must be beneath {root.name!r}.")
    geometry = [obj for obj in collection.all_objects if _is_renderable_geometry(obj)]
    if not geometry:
        raise ExportError(f"Collection {collection.name!r} contains no renderable geometry.")
    for obj in geometry:
        if not _is_descendant_of(obj, root):
            raise ExportError(f"Renderable object {obj.name!r} must be beneath {root.name!r}.")


def _assign_action(armature: bpy.types.Object, action: bpy.types.Action) -> None:
    armature.animation_data_create()
    armature.animation_data.action = action
    if hasattr(armature.animation_data, "action_blend_type"):
        armature.animation_data.action_blend_type = "REPLACE"
    if hasattr(armature.animation_data, "use_nla"):
        armature.animation_data.use_nla = False
    for track in getattr(armature.animation_data, "nla_tracks", []):
        track.mute = True


def _read_pose_library(armature: bpy.types.Object, pose_frames: list[int]) -> dict[int, dict[str, Any]] | None:
    raw = armature.get(POSE_LIBRARY_PROPERTY)
    if raw is None:
        return None
    try:
        payload = json.loads(str(raw))
    except json.JSONDecodeError as exc:
        raise ExportError(f"Armature property {POSE_LIBRARY_PROPERTY} is not valid JSON.") from exc
    if not isinstance(payload, dict) or int(payload.get("schemaVersion", 0)) != 1:
        raise ExportError(f"Armature property {POSE_LIBRARY_PROPERTY} must use schemaVersion 1.")
    frames_raw = payload.get("frames")
    if not isinstance(frames_raw, dict):
        raise ExportError(f"Armature property {POSE_LIBRARY_PROPERTY}.frames must be an object.")
    result: dict[int, dict[str, Any]] = {}
    for frame in pose_frames:
        pose = frames_raw.get(str(frame))
        if not isinstance(pose, dict):
            raise ExportError(f"Deterministic pose library is missing frame {frame}.")
        location, rotations = pose.get("root_location"), pose.get("rotations_degrees")
        if not isinstance(location, list) or len(location) != 3 or not all(isinstance(v, (int, float)) for v in location):
            raise ExportError(f"Pose frame {frame} has an invalid root_location.")
        if not isinstance(rotations, dict):
            raise ExportError(f"Pose frame {frame} has invalid rotations_degrees.")
        clean = {}
        for bone_name, values in rotations.items():
            if not isinstance(bone_name, str) or not isinstance(values, list) or len(values) != 3 or not all(isinstance(v, (int, float)) for v in values):
                raise ExportError(f"Pose frame {frame} has an invalid rotation for {bone_name!r}.")
            clean[bone_name] = [float(v) for v in values]
        result[frame] = {"root_location": [float(v) for v in location], "rotations_degrees": clean}
    return result


def _capture_pose_state(armature: bpy.types.Object) -> dict[str, tuple[Any, Any, str]]:
    return {bone.name: (bone.location.copy(), bone.rotation_euler.copy(), bone.rotation_mode) for bone in armature.pose.bones}


def _restore_pose_state(armature: bpy.types.Object, state: dict[str, tuple[Any, Any, str]]) -> None:
    for name, (location, rotation, mode) in state.items():
        bone = armature.pose.bones.get(name)
        if bone is not None:
            bone.rotation_mode = mode
            bone.location = location
            bone.rotation_euler = rotation
    bpy.context.view_layer.update()


def _apply_pose_snapshot(armature: bpy.types.Object, pose: dict[str, Any]) -> None:
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.location = (0.0, 0.0, 0.0)
        bone.rotation_euler = (0.0, 0.0, 0.0)
    root = armature.pose.bones.get("root")
    if root is None:
        raise ExportError("Deterministic pose library requires a root pose bone.")
    root.location = tuple(pose["root_location"])
    for name, degrees in pose["rotations_degrees"].items():
        bone = armature.pose.bones.get(name)
        if bone is None:
            raise ExportError(f"Deterministic pose references missing bone: {name}")
        bone.rotation_euler = tuple(math.radians(value) for value in degrees)
    bpy.context.view_layer.update()


def _pose_signature(armature: bpy.types.Object) -> tuple[Any, ...]:
    return tuple(
        (bone.name, tuple(round(value, 5) for row in bone.matrix for value in row))
        for bone in sorted(armature.pose.bones, key=lambda item: item.name)
    )


def _validate_distinct_pose_frames(scene, armature, pose_frames, pose_library) -> None:
    original_frame, original_pose = scene.frame_current, _capture_pose_state(armature)
    signatures = []
    try:
        for frame in pose_frames:
            if pose_library is not None:
                _apply_pose_snapshot(armature, pose_library[frame])
            else:
                scene.frame_set(frame, subframe=0.0)
                bpy.context.view_layer.update()
            signatures.append(_pose_signature(armature))
    finally:
        _restore_pose_state(armature, original_pose)
        scene.frame_set(original_frame, subframe=0.0)
    if len(set(signatures)) != len(pose_frames):
        source = "deterministic pose library" if pose_library is not None else "Blender Action"
        raise ExportError(f"{source} does not provide four distinct sampled poses at {pose_frames}.")


def _alpha_metrics(image_path: Path, direction: str, frame_label: str, alpha_threshold: float) -> AlphaMetrics:
    image = bpy.data.images.load(str(image_path), check_existing=False)
    try:
        width, height = map(int, image.size)
        if (width, height) != (64, 64):
            raise ExportError(f"Rendered frame must be 64x64: {image_path.name} is {width}x{height}.")
        pixels = image.pixels[:]
        visible = [(x, y) for y in range(height) for x in range(width) if pixels[(y * width + x) * 4 + 3] > alpha_threshold]
        if not visible:
            raise ExportError(f"Rendered frame has no visible pixels: {image_path.name}")
        xs, ys = [p[0] for p in visible], [p[1] for p in visible]
        min_x, max_x, min_y, max_y = min(xs), max(xs), min(ys), max(ys)
        return AlphaMetrics(image_path.name, direction, frame_label, width, height, len(visible), min_x, max_x, min_y, max_y, max_x-min_x+1, max_y-min_y+1, (min_x+max_x)/2, (min_y+max_y)/2, min_y, height-1-max_y, min_x, width-1-max_x)
    finally:
        bpy.data.images.remove(image)


def _rendered_pixel_hash(path: Path) -> str:
    image = bpy.data.images.load(str(path), check_existing=False)
    try:
        values = bytes(max(0, min(255, round(float(value) * 255))) for value in image.pixels[:])
        return hashlib.sha256(values).hexdigest()
    finally:
        bpy.data.images.remove(image)


def _range(values: Iterable[float]) -> float:
    values = list(values)
    return max(values) - min(values) if values else 0.0


def _validate_metrics(metrics: list[AlphaMetrics], manifest: dict[str, Any]) -> list[str]:
    qa = manifest.get("qa") or {}
    if not isinstance(qa, dict):
        raise ExportError("qa must be an object.")
    edge_margin = int(qa.get("minimum_edge_margin_px", 2))
    min_visible = int(qa.get("minimum_visible_pixels", 80))
    errors = []
    for metric in metrics:
        if metric.visible_pixels < min_visible:
            errors.append(f"{metric.file}: only {metric.visible_pixels} visible pixels; expected at least {min_visible}.")
        if min(metric.bottom_margin, metric.top_margin, metric.left_margin, metric.right_margin) < edge_margin:
            errors.append(f"{metric.file}: alpha bounds approach a cell edge; margins L{metric.left_margin}/R{metric.right_margin}/B{metric.bottom_margin}/T{metric.top_margin}.")
    limits = (
        ("baseline", lambda m: m.min_y, float(qa.get("max_baseline_delta_px", 2))),
        ("horizontal pivot", lambda m: m.center_x, float(qa.get("max_center_x_delta_px", 3))),
        ("height", lambda m: m.bbox_height, float(qa.get("max_bbox_height_delta_px", 5))),
        ("width", lambda m: m.bbox_width, float(qa.get("max_bbox_width_delta_px", 12))),
    )
    for direction, _label in DIRECTIONS:
        group = [metric for metric in metrics if metric.direction == direction]
        if len(group) != 4:
            errors.append(f"{direction}: expected four frame metrics; found {len(group)}.")
            continue
        for label, selector, limit in limits:
            delta = _range(selector(metric) for metric in group)
            if delta > limit:
                errors.append(f"{direction}: {label} drift {delta:.2f}px exceeds {limit}px.")
    return errors


def _validate_non_static_rows(frame_paths: list[list[Path]], minimum_unique_frames: int) -> list[str]:
    if minimum_unique_frames < 2 or minimum_unique_frames > 4:
        raise ExportError("qa.minimum_unique_rendered_frames_per_row must be between 2 and 4.")
    errors = []
    for row in frame_paths:
        unique = len({_rendered_pixel_hash(path) for path in row})
        if unique < minimum_unique_frames:
            errors.append(f"{row[0].name.split('_col-')[0]}: only {unique} unique rendered frames; expected at least {minimum_unique_frames}.")
    return errors


def _assemble_atlas(frame_paths: list[list[Path]], atlas_path: Path) -> None:
    atlas_width, atlas_height = 256, 512
    pixels = [0.0] * (atlas_width * atlas_height * 4)
    loaded = []
    try:
        for row_index, row in enumerate(frame_paths):
            for column_index, path in enumerate(row):
                image = bpy.data.images.load(str(path), check_existing=False)
                loaded.append(image)
                source = image.pixels[:]
                destination_x = column_index * 64
                destination_y = (7 - row_index) * 64
                for y in range(64):
                    source_start = y * 64 * 4
                    destination_start = ((destination_y + y) * atlas_width + destination_x) * 4
                    pixels[destination_start:destination_start + 256] = source[source_start:source_start + 256]
        atlas = bpy.data.images.new("DNDNext_SpriteAtlas", width=atlas_width, height=atlas_height, alpha=True)
        atlas.pixels.foreach_set(pixels)
        atlas.file_format = "PNG"
        atlas.filepath_raw = str(atlas_path)
        atlas.save()
        bpy.data.images.remove(atlas)
    finally:
        for image in loaded:
            if image.name in bpy.data.images:
                bpy.data.images.remove(image)


def _write_metadata(manifest, atlas_path, output_dir):
    data = {
        "schemaVersion": 1, "name": _required_text(manifest, "character_name"),
        "sprite_format": "eight_direction_idle_walk_v1", "frame_width": 64, "frame_height": 64,
        "columns": 4, "rows": 8, "direction_order": [key for key, _ in DIRECTIONS],
        "direction_labels": [label for _, label in DIRECTIONS], "idle_frame": 0,
        "walk_frames": [1, 2, 3], "walk_sequence": list(WALK_SEQUENCE), "fps": int(manifest.get("fps", 7)),
        "atlas_file": atlas_path.name, "source": "blender_orthographic_eight_direction",
        "render_engine": str(manifest.get("render_engine") or "BLENDER_EEVEE_NEXT"),
        "orthographic_scale": float(manifest.get("orthographic_scale", 4.4)),
    }
    path = output_dir / f"{atlas_path.stem}.metadata.json"
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return path


def _write_preview(atlas_path, output_dir, fps):
    rows = "\n".join(f'<div><strong>{label}</strong><i class="sprite" data-row="{row}"></i></div>' for row, (_, label) in enumerate(DIRECTIONS))
    idle = "\n".join(f'<div><strong>{label}</strong><i class="sprite idle" data-row="{row}"></i></div>' for row, (_, label) in enumerate(DIRECTIONS))
    delay = max(1, round(1000 / max(1, fps)))
    html = f"""<!doctype html><meta charset="utf-8"><title>DNDNext Sprite QA</title>
<style>body{{background:#111019;color:#f6f1ff;font-family:system-ui;padding:24px}}section{{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px}}section div{{display:grid;justify-items:center;border:1px solid #584d6d;padding:12px}}.sprite{{display:block;width:64px;height:64px;background-image:url('{atlas_path.name}');background-size:256px 512px;image-rendering:pixelated;transform:scale(2);margin:36px}}</style>
<h1>DNDNext Sprite QA</h1><p>South-first. Loop: 0 → 1 → 2 → 3 → 2 → 1 at {fps} FPS.</p>
<h2>Eight-row walk test</h2><section>{rows}</section><h2>Idle-direction spin test</h2><section>{idle}</section>
<script>const sequence=[0,1,2,3,2,1];let step=0;const moving=[...document.querySelectorAll('.sprite:not(.idle)')];const place=(n,f)=>{{const r=Number(n.dataset.row);n.style.backgroundPosition=`${{-f*64}}px ${{-r*64}}px`}};document.querySelectorAll('.sprite').forEach(n=>place(n,0));setInterval(()=>{{step=(step+1)%sequence.length;moving.forEach(n=>place(n,sequence[step]))}},{delay});</script>"""
    path = output_dir / f"{atlas_path.stem}.qa.html"
    path.write_text(html, encoding="utf-8")
    return path


def _write_report(manifest, metrics, errors, output_dir, atlas_path):
    data = {"schemaVersion": 1, "character": _required_text(manifest, "character_name"), "passed": not errors, "atlas": atlas_path.name, "directionOrder": [key for key, _ in DIRECTIONS], "frameLabels": list(FRAME_LABELS), "errors": errors, "frames": [asdict(metric) for metric in metrics]}
    path = output_dir / f"{atlas_path.stem}.qa.json"
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return path


def _render(manifest: dict[str, Any], output_dir: Path, keep_frames: bool, dry_run: bool) -> None:
    _validate_manifest(manifest)
    scene = bpy.context.scene
    root = _object(_required_text(manifest, "rotation_root"))
    camera = _object(_required_text(manifest, "camera_object"), "CAMERA")
    armature = _object(_required_text(manifest, "armature_object"), "ARMATURE")
    collection = _collection(_required_text(manifest, "render_collection"))
    action = _action(_required_text(manifest, "action_name"))
    _validate_hierarchy(root, collection, armature)
    _assign_action(armature, action)
    _configure_render(scene, camera, manifest)

    pose_frames = _required_int_list(manifest, "pose_frames", 4)
    yaws = _required_number_list(manifest, "direction_yaws_degrees", 8)
    pose_library = _read_pose_library(armature, pose_frames)
    _validate_distinct_pose_frames(scene, armature, pose_frames, pose_library)

    if dry_run:
        print("DNDNext sprite export dry run passed.")
        return

    output_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = output_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    atlas_path = output_dir / str(manifest.get("atlas_filename") or "dawn-whiteflame.png")
    alpha_threshold = float((manifest.get("qa") or {}).get("alpha_threshold", 0.01))
    renderable_names = _collection_object_names(collection)
    original_hidden = {obj.name: bool(obj.hide_render) for obj in scene.objects}
    original_rotation, original_frame = root.rotation_euler.copy(), scene.frame_current
    original_filepath, original_pose = scene.render.filepath, _capture_pose_state(armature)
    frame_paths, metrics = [], []

    try:
        for obj in scene.objects:
            if _is_renderable_geometry(obj):
                obj.hide_render = obj.name not in renderable_names
        for obj in collection.all_objects:
            if _is_renderable_geometry(obj):
                obj.hide_render = False

        for row_index, ((direction_key, direction_label), yaw) in enumerate(zip(DIRECTIONS, yaws)):
            root.rotation_euler.z = math.radians(float(manifest.get("base_yaw_degrees", 0)) + yaw)
            bpy.context.view_layer.update()
            row = []
            for column_index, (frame, frame_label) in enumerate(zip(pose_frames, FRAME_LABELS)):
                if pose_library is not None:
                    _apply_pose_snapshot(armature, pose_library[frame])
                else:
                    scene.frame_set(frame, subframe=0.0)
                    bpy.context.view_layer.update()
                filename = f"row-{row_index + 1:02d}_{direction_key}_col-{column_index + 1:02d}_{frame_label}.png"
                frame_path = frames_dir / filename
                scene.render.filepath = str(frame_path)
                bpy.ops.render.render(write_still=True)
                row.append(frame_path)
                metrics.append(_alpha_metrics(frame_path, direction_key, frame_label, alpha_threshold))
                print(f"Rendered {direction_label} / {frame_label}: {frame_path}")
            frame_paths.append(row)

        errors = _validate_metrics(metrics, manifest)
        errors.extend(_validate_non_static_rows(frame_paths, int((manifest.get("qa") or {}).get("minimum_unique_rendered_frames_per_row", 3))))
        _assemble_atlas(frame_paths, atlas_path)
        metadata = _write_metadata(manifest, atlas_path, output_dir)
        preview = _write_preview(atlas_path, output_dir, int(manifest.get("fps", 7)))
        report = _write_report(manifest, metrics, errors, output_dir, atlas_path)
        if errors:
            raise ExportError("Sprite QA failed:\n- " + "\n- ".join(errors))
        print(f"Atlas: {atlas_path}\nMetadata: {metadata}\nQA report: {report}\nAnimated preview: {preview}")
        print("DNDNext sprite export passed automatic QA.")
    finally:
        root.rotation_euler = original_rotation
        _restore_pose_state(armature, original_pose)
        scene.frame_set(original_frame, subframe=0.0)
        scene.render.filepath = original_filepath
        for name, hidden in original_hidden.items():
            obj = bpy.data.objects.get(name)
            if obj is not None:
                obj.hide_render = hidden
        if not keep_frames and frames_dir.exists():
            shutil.rmtree(frames_dir)


def main() -> int:
    try:
        args = _parse_args()
        _render(_read_json(Path(args.manifest).expanduser().resolve()), Path(args.output_dir).expanduser().resolve(), args.keep_frames, args.dry_run)
        return 0
    except ExportError as exc:
        print(f"DNDNext sprite export failed: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"DNDNext sprite export crashed: {exc}", file=sys.stderr)
        raise


if __name__ == "__main__":
    raise SystemExit(main())
