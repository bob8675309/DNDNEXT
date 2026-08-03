"""DNDNext Blender sprite exporter.

Run from Blender:

blender --background DawnWhiteflame.blend \
  --python tools/blender/dndnext_sprite_export.py -- \
  --manifest tools/blender/manifests/dawn_whiteflame.sprite.json \
  --output-dir build/sprites/dawn-whiteflame

The exporter renders a canonical South-first 4x8 atlas:
S, SW, W, NW, N, NE, E, SE. Each row contains idle, walk A,
walk B, and walk C. It also writes runtime metadata, a QA report,
and a browser animation preview.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import sys
from dataclasses import dataclass, asdict
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


class ExportError(RuntimeError):
    """Raised when the scene or rendered output violates the sprite contract."""


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
    argv = sys.argv
    return argv[argv.index("--") + 1 :] if "--" in argv else []


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render and validate a DNDNext 8-direction sprite atlas.")
    parser.add_argument("--manifest", required=True, help="Path to a sprite export manifest JSON file.")
    parser.add_argument("--output-dir", required=True, help="Directory for frames, atlas, metadata, and QA files.")
    parser.add_argument("--dry-run", action="store_true", help="Validate scene objects and manifest without rendering.")
    parser.add_argument("--keep-frames", action="store_true", help="Keep the 32 rendered cell PNGs after assembly.")
    return parser.parse_args(_script_args())


def _read_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ExportError(f"Manifest not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ExportError(f"Manifest is not valid JSON: {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ExportError("Manifest root must be an object.")
    return data


def _required_text(data: dict[str, Any], key: str) -> str:
    value = str(data.get(key, "")).strip()
    if not value:
        raise ExportError(f"Manifest field '{key}' is required.")
    return value


def _required_int_list(data: dict[str, Any], key: str, count: int) -> list[int]:
    raw = data.get(key)
    if not isinstance(raw, list) or len(raw) != count:
        raise ExportError(f"Manifest field '{key}' must contain exactly {count} integers.")
    values = []
    for item in raw:
        if isinstance(item, bool) or not isinstance(item, (int, float)) or int(item) != item:
            raise ExportError(f"Manifest field '{key}' must contain only integers.")
        values.append(int(item))
    return values


def _required_number_list(data: dict[str, Any], key: str, count: int) -> list[float]:
    raw = data.get(key)
    if not isinstance(raw, list) or len(raw) != count:
        raise ExportError(f"Manifest field '{key}' must contain exactly {count} numbers.")
    values = []
    for item in raw:
        if isinstance(item, bool) or not isinstance(item, (int, float)):
            raise ExportError(f"Manifest field '{key}' must contain only numbers.")
        values.append(float(item))
    return values


def _object(name: str, expected_type: str | None = None) -> bpy.types.Object:
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise ExportError(f"Required Blender object is missing: {name}")
    if expected_type and obj.type != expected_type:
        raise ExportError(f"Object '{name}' must be type {expected_type}; found {obj.type}.")
    return obj


def _collection(name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.get(name)
    if collection is None:
        raise ExportError(f"Required Blender collection is missing: {name}")
    return collection


def _action(name: str) -> bpy.types.Action:
    action = bpy.data.actions.get(name)
    if action is None:
        raise ExportError(f"Required Blender action is missing: {name}")
    return action


def _validate_manifest(manifest: dict[str, Any]) -> None:
    expected_order = [key for key, _label in DIRECTIONS]
    if manifest.get("direction_order") != expected_order:
        raise ExportError(
            "Manifest direction_order must be exactly South-first runtime order: " + ", ".join(expected_order)
        )
    if manifest.get("frame_labels") != list(FRAME_LABELS):
        raise ExportError("Manifest frame_labels must be exactly idle, walk-a, walk-b, walk-c.")
    if manifest.get("sprite_format") != "eight_direction_idle_walk_v1":
        raise ExportError("Manifest sprite_format must be eight_direction_idle_walk_v1.")
    if int(manifest.get("frame_width", 0)) != 64 or int(manifest.get("frame_height", 0)) != 64:
        raise ExportError("DNDNext runtime cells must be exactly 64x64 pixels.")
    if int(manifest.get("columns", 0)) != 4 or int(manifest.get("rows", 0)) != 8:
        raise ExportError("DNDNext runtime atlas must be exactly 4 columns x 8 rows.")
    if manifest.get("walk_sequence") != list(WALK_SEQUENCE):
        raise ExportError("Manifest walk_sequence must be exactly [0,1,2,3,2,1].")
    _required_int_list(manifest, "pose_frames", 4)
    _required_number_list(manifest, "direction_yaws_degrees", 8)


def _set_color_management(scene: bpy.types.Scene, manifest: dict[str, Any]) -> None:
    config = manifest.get("color_management") or {}
    if not isinstance(config, dict):
        raise ExportError("color_management must be an object.")
    view_settings = scene.view_settings
    for attr, key in (("view_transform", "view_transform"), ("look", "look")):
        value = config.get(key)
        if value:
            try:
                setattr(view_settings, attr, value)
            except TypeError as exc:
                raise ExportError(f"Unsupported Blender color-management {key}: {value}") from exc
    if "exposure" in config:
        view_settings.exposure = float(config["exposure"])
    if "gamma" in config:
        view_settings.gamma = float(config["gamma"])


def _configure_render(scene: bpy.types.Scene, camera: bpy.types.Object, manifest: dict[str, Any]) -> None:
    render = scene.render
    render.engine = str(manifest.get("render_engine") or "BLENDER_EEVEE_NEXT")
    render.resolution_x = 64
    render.resolution_y = 64
    render.resolution_percentage = 100
    render.film_transparent = True
    render.image_settings.file_format = "PNG"
    render.image_settings.color_mode = "RGBA"
    render.image_settings.color_depth = "8"
    render.image_settings.compression = int(manifest.get("png_compression", 15))
    scene.camera = camera
    if camera.data.type != "ORTHO":
        raise ExportError(f"Camera '{camera.name}' must be orthographic.")
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
    if root.name not in names:
        raise ExportError(f"Rotation root '{root.name}' must belong to collection '{collection.name}'.")
    if armature.name not in names:
        raise ExportError(f"Armature '{armature.name}' must belong to collection '{collection.name}'.")
    if armature != root and not _is_descendant_of(armature, root):
        raise ExportError(f"Armature '{armature.name}' must be parented beneath rotation root '{root.name}'.")
    geometry = [obj for obj in collection.all_objects if _is_renderable_geometry(obj)]
    if not geometry:
        raise ExportError(f"Collection '{collection.name}' contains no renderable character geometry.")
    for obj in geometry:
        if not _is_descendant_of(obj, root):
            raise ExportError(f"Renderable object '{obj.name}' must be parented beneath '{root.name}'.")


def _assign_action(armature: bpy.types.Object, action: bpy.types.Action) -> None:
    armature.animation_data_create()
    armature.animation_data.action = action


def _alpha_metrics(image_path: Path, direction: str, frame_label: str, alpha_threshold: float) -> AlphaMetrics:
    image = bpy.data.images.load(str(image_path), check_existing=False)
    try:
        width, height = int(image.size[0]), int(image.size[1])
        if width != 64 or height != 64:
            raise ExportError(f"Rendered frame must be 64x64: {image_path.name} is {width}x{height}.")
        pixels = list(image.pixels[:])
        visible: list[tuple[int, int]] = []
        for y in range(height):
            for x in range(width):
                alpha = pixels[(y * width + x) * 4 + 3]
                if alpha > alpha_threshold:
                    visible.append((x, y))
        if not visible:
            raise ExportError(f"Rendered frame has no visible pixels: {image_path.name}")
        xs = [point[0] for point in visible]
        ys = [point[1] for point in visible]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        return AlphaMetrics(
            file=image_path.name,
            direction=direction,
            frame_label=frame_label,
            width=width,
            height=height,
            visible_pixels=len(visible),
            min_x=min_x,
            max_x=max_x,
            min_y=min_y,
            max_y=max_y,
            bbox_width=max_x - min_x + 1,
            bbox_height=max_y - min_y + 1,
            center_x=(min_x + max_x) / 2.0,
            center_y=(min_y + max_y) / 2.0,
            bottom_margin=min_y,
            top_margin=height - 1 - max_y,
            left_margin=min_x,
            right_margin=width - 1 - max_x,
        )
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
    max_baseline_delta = float(qa.get("max_baseline_delta_px", 2))
    max_center_delta = float(qa.get("max_center_x_delta_px", 3))
    max_height_delta = float(qa.get("max_bbox_height_delta_px", 5))
    max_width_delta = float(qa.get("max_bbox_width_delta_px", 12))
    errors: list[str] = []

    for metric in metrics:
        if metric.visible_pixels < min_visible:
            errors.append(f"{metric.file}: only {metric.visible_pixels} visible pixels; expected at least {min_visible}.")
        if min(metric.bottom_margin, metric.top_margin, metric.left_margin, metric.right_margin) < edge_margin:
            errors.append(
                f"{metric.file}: alpha bounds approach a cell edge; margins are "
                f"L{metric.left_margin}/R{metric.right_margin}/B{metric.bottom_margin}/T{metric.top_margin}."
            )

    for direction_key, _label in DIRECTIONS:
        group = [metric for metric in metrics if metric.direction == direction_key]
        if len(group) != 4:
            errors.append(f"{direction_key}: expected four frame metrics; found {len(group)}.")
            continue
        baseline_delta = _range(metric.min_y for metric in group)
        center_delta = _range(metric.center_x for metric in group)
        height_delta = _range(metric.bbox_height for metric in group)
        width_delta = _range(metric.bbox_width for metric in group)
        if baseline_delta > max_baseline_delta:
            errors.append(f"{direction_key}: baseline drift {baseline_delta:.2f}px exceeds {max_baseline_delta}px.")
        if center_delta > max_center_delta:
            errors.append(f"{direction_key}: horizontal pivot drift {center_delta:.2f}px exceeds {max_center_delta}px.")
        if height_delta > max_height_delta:
            errors.append(f"{direction_key}: height drift {height_delta:.2f}px exceeds {max_height_delta}px.")
        if width_delta > max_width_delta:
            errors.append(f"{direction_key}: width drift {width_delta:.2f}px exceeds {max_width_delta}px.")
    return errors


def _assemble_atlas(frame_paths: list[list[Path]], atlas_path: Path) -> None:
    atlas_width, atlas_height = 256, 512
    atlas_pixels = [0.0] * (atlas_width * atlas_height * 4)
    loaded_images: list[bpy.types.Image] = []
    try:
        for row_index, row in enumerate(frame_paths):
            for column_index, image_path in enumerate(row):
                image = bpy.data.images.load(str(image_path), check_existing=False)
                loaded_images.append(image)
                source = list(image.pixels[:])
                destination_x = column_index * 64
                destination_y = (7 - row_index) * 64
                for y in range(64):
                    source_start = y * 64 * 4
                    destination_start = ((destination_y + y) * atlas_width + destination_x) * 4
                    atlas_pixels[destination_start : destination_start + 64 * 4] = source[source_start : source_start + 64 * 4]

        atlas = bpy.data.images.new("DNDNext_SpriteAtlas", width=atlas_width, height=atlas_height, alpha=True)
        atlas.pixels.foreach_set(atlas_pixels)
        atlas.file_format = "PNG"
        atlas.filepath_raw = str(atlas_path)
        atlas.save()
        bpy.data.images.remove(atlas)
    finally:
        for image in loaded_images:
            if image.name in bpy.data.images:
                bpy.data.images.remove(image)


def _write_metadata(manifest: dict[str, Any], atlas_path: Path, output_dir: Path) -> Path:
    metadata = {
        "schemaVersion": 1,
        "name": _required_text(manifest, "character_name"),
        "sprite_format": "eight_direction_idle_walk_v1",
        "frame_width": 64,
        "frame_height": 64,
        "columns": 4,
        "rows": 8,
        "direction_order": [key for key, _label in DIRECTIONS],
        "direction_labels": [label for _key, label in DIRECTIONS],
        "idle_frame": 0,
        "walk_frames": [1, 2, 3],
        "walk_sequence": list(WALK_SEQUENCE),
        "fps": int(manifest.get("fps", 7)),
        "atlas_file": atlas_path.name,
        "source": "blender_orthographic_eight_direction",
        "render_engine": str(manifest.get("render_engine") or "BLENDER_EEVEE_NEXT"),
        "orthographic_scale": float(manifest.get("orthographic_scale", 4.4)),
    }
    path = output_dir / f"{atlas_path.stem}.metadata.json"
    path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    return path


def _write_preview(atlas_path: Path, output_dir: Path, fps: int) -> Path:
    direction_rows = "\n".join(
        f'<div class="direction"><strong>{label}</strong><div class="sprite" data-row="{row}"></div></div>'
        for row, (_key, label) in enumerate(DIRECTIONS)
    )
    spin_cells = "\n".join(
        f'<div class="spin-cell"><strong>{label}</strong><div class="sprite idle" data-row="{row}"></div></div>'
        for row, (_key, label) in enumerate(DIRECTIONS)
    )
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DNDNext Sprite QA — {atlas_path.stem}</title>
<style>
:root {{ color-scheme: dark; font-family: system-ui, sans-serif; }}
body {{ margin: 0; padding: 24px; background: #111019; color: #f6f1ff; }}
h1, h2 {{ margin: 0 0 12px; }}
p {{ color: #c7bed4; max-width: 76ch; }}
.grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin: 16px 0 28px; }}
.direction, .spin-cell {{ border: 1px solid #584d6d; border-radius: 12px; padding: 12px; background: #1b1725; display: grid; gap: 8px; justify-items: center; }}
.sprite {{ width: 64px; height: 64px; background-image: url('{atlas_path.name}'); background-size: 256px 512px; image-rendering: pixelated; transform: scale(2); transform-origin: center; margin: 36px; }}
.note {{ padding: 12px; border-left: 4px solid #e0b75f; background: #211c2c; }}
</style>
</head>
<body>
<h1>DNDNext Sprite QA</h1>
<p>Canonical South-first atlas. The animation loop is 0 → 1 → 2 → 3 → 2 → 1 at {fps} FPS. Confirm each row faces the named direction and that feet, scale, equipment, and pivot remain stable.</p>
<h2>Eight-row walk test</h2>
<div class="grid">{direction_rows}</div>
<h2>Idle-direction spin test</h2>
<div class="grid">{spin_cells}</div>
<div class="note">This preview is a visual QA aid, not an automatic proof of correct direction. Final approval still happens in /admin/sprite-lab.</div>
<script>
const sequence = [0, 1, 2, 3, 2, 1];
let step = 0;
const animated = [...document.querySelectorAll('.direction .sprite')];
const idle = [...document.querySelectorAll('.idle')];
function place(node, frame) {{
  const row = Number(node.dataset.row || 0);
  node.style.backgroundPosition = `${{-frame * 64}}px ${{-row * 64}}px`;
}}
animated.forEach(node => place(node, 0));
idle.forEach(node => place(node, 0));
setInterval(() => {{
  step = (step + 1) % sequence.length;
  animated.forEach(node => place(node, sequence[step]));
}}, {max(1, round(1000 / max(1, fps)))});
</script>
</body>
</html>
"""
    path = output_dir / f"{atlas_path.stem}.qa.html"
    path.write_text(html, encoding="utf-8")
    return path


def _write_report(
    manifest: dict[str, Any],
    metrics: list[AlphaMetrics],
    errors: list[str],
    output_dir: Path,
    atlas_path: Path,
) -> Path:
    report = {
        "schemaVersion": 1,
        "character": _required_text(manifest, "character_name"),
        "passed": not errors,
        "atlas": atlas_path.name,
        "directionOrder": [key for key, _label in DIRECTIONS],
        "frameLabels": list(FRAME_LABELS),
        "errors": errors,
        "frames": [asdict(metric) for metric in metrics],
    }
    path = output_dir / f"{atlas_path.stem}.qa.json"
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
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
    base_yaw = float(manifest.get("base_yaw_degrees", 0.0))
    alpha_threshold = float((manifest.get("qa") or {}).get("alpha_threshold", 0.01))
    atlas_filename = str(manifest.get("atlas_filename") or "dawn-whiteflame.png").strip()
    if not atlas_filename.lower().endswith(".png"):
        raise ExportError("atlas_filename must end in .png")

    if dry_run:
        print("DNDNext sprite export dry run passed.")
        return

    output_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = output_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    atlas_path = output_dir / atlas_filename

    renderable_names = _collection_object_names(collection)
    original_hide_render = {obj.name: bool(obj.hide_render) for obj in scene.objects}
    original_rotation = root.rotation_euler.copy()
    original_frame = scene.frame_current
    original_filepath = scene.render.filepath
    frame_paths: list[list[Path]] = []
    metrics: list[AlphaMetrics] = []

    try:
        for obj in scene.objects:
            if _is_renderable_geometry(obj):
                obj.hide_render = obj.name not in renderable_names
        for obj in collection.all_objects:
            if _is_renderable_geometry(obj):
                obj.hide_render = False

        for row_index, ((direction_key, direction_label), yaw_degrees) in enumerate(zip(DIRECTIONS, yaws)):
            row_paths: list[Path] = []
            root.rotation_euler.z = math.radians(base_yaw + yaw_degrees)
            for column_index, (frame_number, frame_label) in enumerate(zip(pose_frames, FRAME_LABELS)):
                scene.frame_set(frame_number)
                bpy.context.view_layer.update()
                filename = f"row-{row_index + 1:02d}_{direction_key}_col-{column_index + 1:02d}_{frame_label}.png"
                frame_path = frames_dir / filename
                scene.render.filepath = str(frame_path)
                bpy.ops.render.render(write_still=True)
                row_paths.append(frame_path)
                metrics.append(_alpha_metrics(frame_path, direction_key, frame_label, alpha_threshold))
                print(f"Rendered {direction_label} / {frame_label}: {frame_path}")
            frame_paths.append(row_paths)

        errors = _validate_metrics(metrics, manifest)
        _assemble_atlas(frame_paths, atlas_path)
        metadata_path = _write_metadata(manifest, atlas_path, output_dir)
        preview_path = _write_preview(atlas_path, output_dir, int(manifest.get("fps", 7)))
        report_path = _write_report(manifest, metrics, errors, output_dir, atlas_path)
        if errors:
            raise ExportError("Sprite QA failed:\n- " + "\n- ".join(errors))
        print(f"Atlas: {atlas_path}")
        print(f"Metadata: {metadata_path}")
        print(f"QA report: {report_path}")
        print(f"Animated preview: {preview_path}")
        print("DNDNext sprite export passed automatic QA.")
    finally:
        root.rotation_euler = original_rotation
        scene.frame_set(original_frame)
        scene.render.filepath = original_filepath
        for obj_name, hidden in original_hide_render.items():
            obj = bpy.data.objects.get(obj_name)
            if obj is not None:
                obj.hide_render = hidden
        if not keep_frames and frames_dir.exists():
            shutil.rmtree(frames_dir)


def main() -> int:
    try:
        args = _parse_args()
        manifest_path = Path(args.manifest).expanduser().resolve()
        output_dir = Path(args.output_dir).expanduser().resolve()
        manifest = _read_json(manifest_path)
        _render(manifest, output_dir, args.keep_frames, args.dry_run)
        return 0
    except ExportError as exc:
        print(f"DNDNext sprite export failed: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"DNDNext sprite export crashed: {exc}", file=sys.stderr)
        raise


if __name__ == "__main__":
    raise SystemExit(main())
