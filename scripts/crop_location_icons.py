"""Crop transparent padding from PNG icons.

This implements the "B1" approach you chose: pre-crop the PNGs so the transparent
padding around the glyph is removed.

Features
- Recursively scans an input directory for .png files
- Finds the bounding box of non-transparent pixels using the alpha channel
- Crops to that bounding box + optional margin (default 4px)
- Preserves the folder structure in the output directory

Usage
  # 1) Put a copy of your bucket files into a local folder, e.g. ./icons_raw
  # 2) Run:
  python scripts/crop_location_icons.py --in ./icons_raw --out ./icons_cropped --margin 4
  # 3) Upload the cropped set back to Supabase Storage (same bucket paths)

Notes
- If a PNG has no alpha channel, it is treated as opaque and is copied unchanged.
- If a PNG is fully transparent, it is copied unchanged.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Optional, Tuple

from PIL import Image


def _alpha_bbox(im: Image.Image) -> Optional[Tuple[int, int, int, int]]:
    """Return bbox (left, upper, right, lower) of non-transparent pixels."""
    if im.mode in ("RGBA", "LA"):
        alpha = im.getchannel("A")
        return alpha.getbbox()
    if im.mode == "P":
        # Palette image might have transparency info
        if "transparency" in im.info:
            rgba = im.convert("RGBA")
            alpha = rgba.getchannel("A")
            return alpha.getbbox()
        # No transparency info; treat as fully opaque
        return (0, 0, im.width, im.height)
    # No alpha channel; treat as fully opaque
    return (0, 0, im.width, im.height)


def crop_png(in_path: Path, out_path: Path, margin: int) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(in_path) as im:
        bbox = _alpha_bbox(im)
        if not bbox:
            # Fully transparent or empty bbox
            im.save(out_path)
            return

        left, top, right, bottom = bbox
        left = max(0, left - margin)
        top = max(0, top - margin)
        right = min(im.width, right + margin)
        bottom = min(im.height, bottom + margin)

        cropped = im.crop((left, top, right, bottom))
        # Preserve original mode where possible
        cropped.save(out_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Crop transparent padding from PNG icons")
    parser.add_argument("--in", dest="in_dir", required=True, help="Input directory containing PNGs")
    parser.add_argument("--out", dest="out_dir", required=True, help="Output directory for cropped PNGs")
    parser.add_argument("--margin", dest="margin", type=int, default=4, help="Extra pixels to keep around the glyph")
    args = parser.parse_args()

    in_dir = Path(args.in_dir).resolve()
    out_dir = Path(args.out_dir).resolve()
    margin = max(0, int(args.margin))

    if not in_dir.exists() or not in_dir.is_dir():
        raise SystemExit(f"Input dir does not exist or is not a directory: {in_dir}")

    count = 0
    for root, _, files in os.walk(in_dir):
        root_path = Path(root)
        for filename in files:
            if not filename.lower().endswith(".png"):
                continue
            src = root_path / filename
            rel = src.relative_to(in_dir)
            dst = out_dir / rel
            crop_png(src, dst, margin)
            count += 1

    print(f"Cropped {count} PNG(s). Output: {out_dir}")


if __name__ == "__main__":
    main()
