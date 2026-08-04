"""Blender entrypoint for the DNDNext sprite exporter.

The core exporter supports both ordinary Blender Actions and deterministic pose
libraries. Blender reevaluates an assigned Action when a render begins, so a
deterministic direct pose can otherwise be overwritten by the current timeline
frame. This runner detaches the Action only for armatures carrying the
DNDNext deterministic pose library, then delegates to the core exporter.

The build pipeline performs a dedicated dry run before the full batch. The dry
run remains the authoritative transform-level pose preflight. During the full
render, this runner skips only that duplicate preflight to avoid a Blender 4.5
Windows dependency-graph crash. Rendered-frame hashing and static-row rejection
remain active in the core exporter.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import bpy


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


def main() -> int:
    core = _load_core()
    assign_action = core._assign_action

    def assign_action_without_render_override(armature, action) -> None:
        assign_action(armature, action)
        if armature.get(core.POSE_LIBRARY_PROPERTY) is None:
            return
        armature.animation_data.action = None
        bpy.context.view_layer.update()
        print("Detached Blender Action for deterministic pose rendering.")

    core._assign_action = assign_action_without_render_override

    if "--dry-run" not in _script_args():
        def skip_duplicate_pose_preflight(*_args, **_kwargs) -> None:
            print("Using pose preflight from the completed dry run; rendered-frame uniqueness QA remains active.")

        core._validate_distinct_pose_frames = skip_duplicate_pose_preflight

    return core.main()


if __name__ == "__main__":
    raise SystemExit(main())
