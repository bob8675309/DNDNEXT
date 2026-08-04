"""Assemble and validate a DNDNext atlas from 32 isolated frame renders.

This script performs no character rendering. It requires every canonical frame PNG
to already exist, runs the same alpha-bound and non-static-row checks as the core
exporter, assembles the atlas, and writes metadata, QA JSON, and the animated HTML
preview. Missing or invalid cells are a hard failure.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path


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
    parser = argparse.ArgumentParser(description="Assemble isolated DNDNext sprite frames.")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output-dir", required=True)
    return parser.parse_args(_script_args())


def _add_provenance(path: Path, key: str, value: str) -> None:
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload[key] = value
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def _assemble(args: argparse.Namespace) -> None:
    core = _load_core()
    manifest = core._read_json(Path(args.manifest).expanduser().resolve())
    core._validate_manifest(manifest)
    output_dir = Path(args.output_dir).expanduser().resolve()
    frames_dir = output_dir / "frames"
    output_dir.mkdir(parents=True, exist_ok=True)

    if not frames_dir.is_dir():
        raise core.ExportError(f"Isolated frames directory is missing: {frames_dir}")

    frame_paths: list[list[Path]] = []
    metrics = []
    alpha_threshold = float((manifest.get("qa") or {}).get("alpha_threshold", 0.01))

    for row_index, (direction_key, _direction_label) in enumerate(core.DIRECTIONS):
        row: list[Path] = []
        for column_index, frame_label in enumerate(core.FRAME_LABELS):
            filename = (
                f"row-{row_index + 1:02d}_{direction_key}_"
                f"col-{column_index + 1:02d}_{frame_label}.png"
            )
            frame_path = frames_dir / filename
            if not frame_path.is_file():
                raise core.ExportError(f"Required isolated frame is missing: {frame_path}")
            row.append(frame_path)
            metrics.append(core._alpha_metrics(frame_path, direction_key, frame_label, alpha_threshold))
        frame_paths.append(row)

    expected_names = {path.name for row in frame_paths for path in row}
    actual_names = {path.name for path in frames_dir.glob("*.png")}
    extras = sorted(actual_names - expected_names)
    if extras:
        raise core.ExportError("Unexpected PNG files remain in the isolated frames directory: " + ", ".join(extras))

    errors = core._validate_metrics(metrics, manifest)
    errors.extend(
        core._validate_non_static_rows(
            frame_paths,
            int((manifest.get("qa") or {}).get("minimum_unique_rendered_frames_per_row", 3)),
        )
    )

    atlas_path = output_dir / str(manifest.get("atlas_filename") or "dawn-whiteflame.png")
    core._assemble_atlas(frame_paths, atlas_path)
    metadata_path = core._write_metadata(manifest, atlas_path, output_dir)
    preview_path = core._write_preview(atlas_path, output_dir, int(manifest.get("fps", 7)))
    report_path = core._write_report(manifest, metrics, errors, output_dir, atlas_path)

    strategy = str(manifest.get("render_strategy") or "isolated_prepared_blend_per_cell_v1")
    _add_provenance(metadata_path, "render_strategy", strategy)
    _add_provenance(report_path, "renderStrategy", strategy)

    if errors:
        raise core.ExportError("Sprite QA failed:\n- " + "\n- ".join(errors))

    print(f"Atlas: {atlas_path}")
    print(f"Metadata: {metadata_path}")
    print(f"QA report: {report_path}")
    print(f"Animated preview: {preview_path}")
    print("DNDNext isolated frame assembly passed automatic QA.")


def main() -> int:
    try:
        _assemble(_parse_args())
        return 0
    except Exception as exc:
        print(f"DNDNext isolated frame assembly failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
