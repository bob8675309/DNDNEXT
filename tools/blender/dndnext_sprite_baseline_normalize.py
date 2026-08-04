"""Normalize bounded baseline-only QA drift in rendered DNDNext sprite frames.

This script runs only after the normal exporter has rendered all 32 cells and failed
exclusively on baseline drift. It reuses the existing PNGs, aligns affected rows to
their idle-frame baseline, reruns every existing QA check, rebuilds the atlas, and
records each pixel shift. It never masks non-baseline failures and never applies a
shift larger than the manifest safety cap.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

import bpy


class NormalizationError(RuntimeError):
    pass


def _script_args() -> list[str]:
    argv = sys.argv
    return argv[argv.index("--") + 1 :] if "--" in argv else []


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normalize bounded sprite baseline drift.")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output-dir", required=True)
    return parser.parse_args(_script_args())


def _load_core():
    path = Path(__file__).with_name("dndnext_sprite_export.py")
    spec = importlib.util.spec_from_file_location("dndnext_sprite_export_core", path)
    if spec is None or spec.loader is None:
        raise NormalizationError(f"Could not load DNDNext sprite exporter: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise NormalizationError(f"Could not read JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise NormalizationError(f"JSON root must be an object: {path}")
    return value


def _require_baseline_only_failure(report: dict[str, Any]) -> None:
    errors = report.get("errors")
    if report.get("passed") is not False or not isinstance(errors, list) or not errors:
        raise NormalizationError("Baseline normalization requires an existing failed QA report.")
    non_baseline = [str(error) for error in errors if "baseline drift" not in str(error)]
    if non_baseline:
        raise NormalizationError(
            "Automatic baseline normalization refused non-baseline QA errors: "
            + "; ".join(non_baseline)
        )


def _frame_rows(core, output_dir: Path) -> list[list[Path]]:
    frames_dir = output_dir / "frames"
    rows: list[list[Path]] = []
    for row_index, (direction, _label) in enumerate(core.DIRECTIONS):
        row: list[Path] = []
        for column_index, frame_label in enumerate(core.FRAME_LABELS):
            path = frames_dir / (
                f"row-{row_index + 1:02d}_{direction}_"
                f"col-{column_index + 1:02d}_{frame_label}.png"
            )
            if not path.is_file():
                raise NormalizationError(f"Rendered frame is missing: {path}")
            row.append(path)
        rows.append(row)
    return rows


def _shift_png_vertical(path: Path, shift_y: int) -> None:
    if shift_y == 0:
        return
    image = bpy.data.images.load(str(path), check_existing=False)
    try:
        width, height = map(int, image.size)
        if (width, height) != (64, 64):
            raise NormalizationError(f"Frame must remain 64x64: {path.name}")
        source = list(image.pixels[:])
        shifted = [0.0] * len(source)
        row_span = width * 4
        for source_y in range(height):
            destination_y = source_y + shift_y
            if destination_y < 0 or destination_y >= height:
                continue
            source_start = source_y * row_span
            destination_start = destination_y * row_span
            shifted[destination_start : destination_start + row_span] = source[
                source_start : source_start + row_span
            ]
        image.pixels.foreach_set(shifted)
        image.update()
        image.file_format = "PNG"
        image.filepath_raw = str(path)
        image.save()
    finally:
        if image.name in bpy.data.images:
            bpy.data.images.remove(image)


def _collect_metrics(core, rows: list[list[Path]], alpha_threshold: float):
    metrics = []
    for row, (direction, _label) in zip(rows, core.DIRECTIONS):
        for path, frame_label in zip(row, core.FRAME_LABELS):
            metrics.append(core._alpha_metrics(path, direction, frame_label, alpha_threshold))
    return metrics


def _augment_json(path: Path, key: str, value: Any) -> None:
    data = _read_json(path)
    data[key] = value
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def _normalize(core, manifest: dict[str, Any], output_dir: Path) -> None:
    qa = manifest.get("qa") or {}
    if not isinstance(qa, dict):
        raise NormalizationError("Manifest qa must be an object.")
    if qa.get("auto_normalize_baseline") is not True:
        raise NormalizationError("Manifest does not enable bounded baseline normalization.")

    atlas_name = str(manifest.get("atlas_filename") or "dawn-whiteflame.png")
    atlas_path = output_dir / atlas_name
    report_path = output_dir / f"{atlas_path.stem}.qa.json"
    _require_baseline_only_failure(_read_json(report_path))

    maximum_shift = int(qa.get("max_auto_baseline_shift_px", 0))
    baseline_limit = float(qa.get("max_baseline_delta_px", 2))
    edge_margin = int(qa.get("minimum_edge_margin_px", 2))
    alpha_threshold = float(qa.get("alpha_threshold", 0.01))
    if maximum_shift < 1 or maximum_shift > 4:
        raise NormalizationError("qa.max_auto_baseline_shift_px must be between 1 and 4.")

    rows = _frame_rows(core, output_dir)
    before_metrics = _collect_metrics(core, rows, alpha_threshold)
    adjustments: list[dict[str, Any]] = []

    for row, (direction, _label) in zip(rows, core.DIRECTIONS):
        group = [metric for metric in before_metrics if metric.direction == direction]
        if len(group) != 4:
            raise NormalizationError(f"{direction}: expected four frame metrics before normalization.")
        baseline_delta = max(metric.min_y for metric in group) - min(metric.min_y for metric in group)
        if baseline_delta <= baseline_limit:
            continue

        idle_baseline = group[0].min_y
        for path, metric in zip(row, group):
            shift = int(idle_baseline - metric.min_y)
            if abs(shift) > maximum_shift:
                raise NormalizationError(
                    f"{metric.file}: required baseline shift {shift}px exceeds {maximum_shift}px cap."
                )
            predicted_min_y = metric.min_y + shift
            predicted_max_y = metric.max_y + shift
            if predicted_min_y < edge_margin or (63 - predicted_max_y) < edge_margin:
                raise NormalizationError(
                    f"{metric.file}: bounded baseline shift would violate the {edge_margin}px edge margin."
                )
            if shift == 0:
                continue
            _shift_png_vertical(path, shift)
            adjustments.append(
                {
                    "file": metric.file,
                    "direction": direction,
                    "frameLabel": metric.frame_label,
                    "shiftYPixels": shift,
                    "baselineBefore": metric.min_y,
                    "baselineAfter": predicted_min_y,
                }
            )
            print(f"Baseline-normalized {metric.file}: {shift:+d}px")

    if not adjustments:
        raise NormalizationError("Baseline-only QA failed, but no bounded frame adjustment was required.")

    metrics = _collect_metrics(core, rows, alpha_threshold)
    errors = core._validate_metrics(metrics, manifest)
    errors.extend(
        core._validate_non_static_rows(
            rows,
            int(qa.get("minimum_unique_rendered_frames_per_row", 3)),
        )
    )

    core._assemble_atlas(rows, atlas_path)
    metadata_path = core._write_metadata(manifest, atlas_path, output_dir)
    core._write_preview(atlas_path, output_dir, int(manifest.get("fps", 7)))
    report_path = core._write_report(manifest, metrics, errors, output_dir, atlas_path)

    normalization = {
        "mode": "bounded_idle_anchor",
        "maximumShiftPixels": maximum_shift,
        "strictBaselineLimitPixels": baseline_limit,
        "adjustments": adjustments,
    }
    _augment_json(report_path, "baselineNormalization", normalization)
    _augment_json(metadata_path, "baseline_normalization", normalization)

    if errors:
        raise NormalizationError("QA still failed after bounded baseline normalization: " + "; ".join(errors))

    print("DNDNext bounded baseline normalization passed automatic QA.")
    print(f"Atlas: {atlas_path}")
    print(f"QA report: {report_path}")


def main() -> int:
    try:
        args = _parse_args()
        core = _load_core()
        manifest_path = Path(args.manifest).expanduser().resolve()
        output_dir = Path(args.output_dir).expanduser().resolve()
        manifest = _read_json(manifest_path)
        _normalize(core, manifest, output_dir)
        return 0
    except (RuntimeError, OSError, ValueError) as exc:
        print(f"DNDNext baseline normalization failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
