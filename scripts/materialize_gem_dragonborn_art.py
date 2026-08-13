from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps
import hashlib
import math
import random

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public" / "media" / "species"
SIZE = (220, 308)

CASES = {
    "amethyst-gem-dragonborn": {
        "source": "black-dragonborn.webp",
        "shadow": (72, 24, 112),
        "highlight": (214, 120, 255),
        "effect": "force",
    },
    "crystal-gem-dragonborn": {
        "source": "white-dragonborn.webp",
        "shadow": (160, 196, 214),
        "highlight": (255, 255, 250),
        "effect": "radiant",
    },
    "emerald-gem-dragonborn": {
        "source": "green-dragonborn.webp",
        "shadow": (12, 86, 54),
        "highlight": (72, 232, 166),
        "effect": "psychic",
    },
    "sapphire-gem-dragonborn": {
        "source": "blue-dragonborn.webp",
        "shadow": (14, 42, 118),
        "highlight": (74, 166, 255),
        "effect": "thunder",
    },
    "topaz-gem-dragonborn": {
        "source": "copper-dragonborn.webp",
        "shadow": (136, 72, 22),
        "highlight": (250, 182, 72),
        "effect": "necrotic",
    },
}


def git_blob_sha(data: bytes) -> str:
    payload = b"blob " + str(len(data)).encode() + b"\0" + data
    return hashlib.sha1(payload).hexdigest()


def body_mask(size: tuple[int, int]) -> Image.Image:
    w, h = size
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((int(w * 0.23), int(h * 0.03), int(w * 0.77), int(h * 0.38)), fill=145)
    draw.polygon(
        [
            (int(w * 0.20), int(h * 0.20)),
            (int(w * 0.80), int(h * 0.20)),
            (int(w * 0.87), int(h * 0.84)),
            (int(w * 0.67), int(h * 0.99)),
            (int(w * 0.33), int(h * 0.99)),
            (int(w * 0.13), int(h * 0.84)),
        ],
        fill=205,
    )
    return mask.filter(ImageFilter.GaussianBlur(radius=3))


def color_grade(image: Image.Image, shadow: tuple[int, int, int], highlight: tuple[int, int, int]) -> Image.Image:
    gray = ImageOps.grayscale(image)
    graded = ImageOps.colorize(gray, black=shadow, white=highlight)
    merged = Image.blend(image.convert("RGB"), graded.convert("RGB"), 0.62)
    merged = ImageEnhance.Contrast(merged).enhance(1.08)
    return ImageEnhance.Color(merged).enhance(1.08)


def add_facets(image: Image.Image, highlight: tuple[int, int, int], seed: int) -> Image.Image:
    random.seed(seed)
    w, h = image.size
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    for _ in range(42):
        y = random.uniform(h * 0.16, h * 0.91)
        spread = 0.18 + 0.14 * (1 - abs(y / h - 0.5))
        x = random.uniform(w * (0.5 - spread), w * (0.5 + spread))
        size = random.uniform(w * 0.018, w * 0.046)
        points = [
            (x, y - size),
            (x + size * 0.8, y - size * 0.12),
            (x + size * 0.35, y + size),
            (x - size * 0.55, y + size * 0.42),
            (x - size * 0.72, y - size * 0.2),
        ]
        alpha = random.randint(18, 50)
        draw.polygon(points, fill=(*highlight, alpha))
        if random.random() < 0.55:
            draw.line(points + [points[0]], fill=(245, 250, 255, min(72, alpha + 20)), width=1)

    mask = body_mask(image.size)
    overlay.putalpha(ImageChops.multiply(overlay.getchannel("A"), mask))
    return Image.alpha_composite(image.convert("RGBA"), overlay)


def add_effect(image: Image.Image, highlight: tuple[int, int, int], effect: str) -> Image.Image:
    w, h = image.size
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")

    if effect == "force":
        x, y = w * 0.72, h * 0.42
        for radius, alpha in ((16, 80), (27, 44), (38, 22)):
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline=(*highlight, alpha), width=2)
    elif effect == "radiant":
        for x, y in ((w * 0.72, h * 0.37), (w * 0.31, h * 0.30)):
            for angle in range(0, 360, 60):
                radians = math.radians(angle)
                length = w * 0.11
                draw.line((x, y, x + math.cos(radians) * length, y + math.sin(radians) * length), fill=(255, 255, 248, 56), width=2)
    elif effect == "psychic":
        for k in range(3):
            points = []
            for t in range(20):
                x = w * (0.20 + 0.22 * k) + math.sin(t * 0.5 + k) * w * 0.018
                y = h * (0.33 + t * 0.018)
                points.append((x, y))
            draw.line(points, fill=(230, 80, 255, 48), width=2)
    elif effect == "thunder":
        for k in range(3):
            y = h * (0.32 + 0.13 * k)
            points = [(w * 0.12, y), (w * 0.30, y - h * 0.02), (w * 0.49, y + h * 0.012), (w * 0.68, y - h * 0.02), (w * 0.88, y)]
            draw.line(points, fill=(*highlight, 54), width=2)
    elif effect == "necrotic":
        for k in range(8):
            x = w * (0.08 + 0.12 * k)
            y = h * (0.58 + 0.05 * (k % 3))
            radius = w * (0.04 + 0.012 * (k % 3))
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(80, 20, 90, 26))

    glow = layer.filter(ImageFilter.GaussianBlur(radius=4))
    return Image.alpha_composite(Image.alpha_composite(image.convert("RGBA"), glow), layer)


def render(name: str, spec: dict, index: int) -> Path:
    source = ART / spec["source"]
    if not source.exists():
        raise SystemExit(f"Missing Gem Dragonborn source art: {source}")

    image = Image.open(source).convert("RGB").resize(SIZE, Image.Resampling.LANCZOS)
    image = color_grade(image, spec["shadow"], spec["highlight"])
    image = add_facets(image, spec["highlight"], 900 + index)
    image = add_effect(image, spec["highlight"], spec["effect"])
    image = image.convert("RGB").filter(ImageFilter.UnsharpMask(radius=1.0, percent=120, threshold=3))

    target = ART / f"{name}.webp"
    image.save(target, "WEBP", quality=68, method=6)
    data = target.read_bytes()
    if len(data) < 7000 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise SystemExit(f"Generated Gem Dragonborn asset failed validation: {target} ({len(data)} bytes)")
    print(f"{target.relative_to(ROOT)} {len(data)} bytes git_blob={git_blob_sha(data)}")
    return target


def main() -> None:
    for index, (name, spec) in enumerate(CASES.items()):
        render(name, spec, index)


if __name__ == "__main__":
    main()
