#!/usr/bin/env python3
"""Prepare the user-provided project logo for web, README, and favicon use."""

from pathlib import Path
from PIL import Image, ImageOps

SOURCE = Path("/home/ubuntu/upload/IMG_8468.JPG")
ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs" / "assets"
PUBLIC_DIR = ROOT / "client" / "public"
WEBDEV_DIR = Path("/home/ubuntu/webdev-static-assets")

for directory in (DOCS_DIR, PUBLIC_DIR, WEBDEV_DIR):
    directory.mkdir(parents=True, exist_ok=True)

with Image.open(SOURCE) as source:
    image = ImageOps.exif_transpose(source).convert("RGB")
    width, height = image.size
    edge = min(width, height)
    left = (width - edge) // 2
    top = (height - edge) // 2
    square = image.crop((left, top, left + edge, top + edge))

    logo = square.resize((512, 512), Image.Resampling.LANCZOS)
    logo.save(DOCS_DIR / "logo.png", format="PNG", optimize=True)
    logo.save(WEBDEV_DIR / "shiji-logo-512.png", format="PNG", optimize=True)

    favicon = square.resize((64, 64), Image.Resampling.LANCZOS)
    favicon.save(PUBLIC_DIR / "favicon.png", format="PNG", optimize=True)
    favicon.save(
        PUBLIC_DIR / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
    )

print({
    "source": str(SOURCE),
    "source_size": [width, height],
    "crop": [left, top, edge, edge],
    "logo": str(DOCS_DIR / "logo.png"),
    "favicon": str(PUBLIC_DIR / "favicon.ico"),
})
