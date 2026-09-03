from __future__ import annotations

import base64
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRANSFER_ROOT = ROOT / ".asset-transfer" / "cinematic-species"
OUTPUT_ROOT = ROOT / "public" / "media" / "species"

EXPECTED = {
    "human": ("f5a6d8a26a12f7c424f78051996fe2186f557781c08e08616eb07a16db90a775", 76734),
    "aarakocra": ("0df89b8625dcbe6f935af3ce16c34f7b50683a1a0863dea5e036302d5b2e2d5c", 121114),
    "elf": ("662fa892aaca6295cdfca2c59726cb73313ddf9ef39661d84c39bf8b819639d6", 93128),
    "half-orc": ("ae1aef8160f162e31f10558bb7b88a6dd1882e7c4e7de0eeb50ae05f56945bb6", 76170),
    "halfling": ("cc19a1d42ef02fb9a8c5d3bbc87fc5e632afecb5aea4be05639907ef071adf47", 83722),
}


def materialize(name: str) -> Path:
    source = TRANSFER_ROOT / name
    parts = sorted(source.glob("part-*.b64"))
    if not parts:
        raise SystemExit(f"No transfer chunks found for {name}")

    encoded = "".join(part.read_text(encoding="ascii").strip() for part in parts)
    payload = base64.b64decode(encoded, validate=True)
    expected_sha, expected_size = EXPECTED[name]
    actual_sha = hashlib.sha256(payload).hexdigest()

    if len(payload) != expected_size:
        raise SystemExit(f"{name}: expected {expected_size} bytes, got {len(payload)}")
    if actual_sha != expected_sha:
        raise SystemExit(f"{name}: sha256 mismatch: {actual_sha}")
    if payload[:4] != b"RIFF" or payload[8:12] != b"WEBP":
        raise SystemExit(f"{name}: decoded payload is not a RIFF/WebP image")

    target = OUTPUT_ROOT / f"cinematic-{name}.webp"
    target.write_bytes(payload)
    print(f"materialized {target.relative_to(ROOT)} ({len(payload)} bytes, {actual_sha})")
    return target


def main() -> None:
    ready = sorted(path.stem for path in TRANSFER_ROOT.glob("*.ready"))
    if not ready:
        raise SystemExit("No ready markers found")

    unknown = [name for name in ready if name not in EXPECTED]
    if unknown:
        raise SystemExit(f"Unknown ready markers: {', '.join(unknown)}")

    for name in ready:
        materialize(name)


if __name__ == "__main__":
    main()
