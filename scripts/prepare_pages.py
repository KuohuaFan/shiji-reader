#!/usr/bin/env python3
"""Finalize the static output for the KuohuaFan/shiji-reader GitHub Pages site."""

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist" / "public"
BASE = "https://kuohuafan.github.io/shiji-reader/"

index = OUTPUT / "index.html"
if not index.exists():
    raise SystemExit("Run the Vite pages build before prepare_pages.py")

shutil.rmtree(OUTPUT / "__manus__", ignore_errors=True)
shutil.copy2(ROOT / "docs" / "assets" / "logo.png", OUTPUT / "logo.png")
html = index.read_text(encoding="utf-8").replace(
    "https://shijiread.manus.space/",
    BASE,
)
index.write_text(html, encoding="utf-8")
shutil.copy2(index, OUTPUT / "404.html")
(OUTPUT / ".nojekyll").touch()

urls = [BASE] + [f"{BASE}?chapter={volume}" for volume in range(1, 131)]
xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
]
for url in urls:
    xml.extend(["  <url>", f"    <loc>{url.replace('&', '&amp;')}</loc>", "  </url>"])
xml.append("</urlset>")
(OUTPUT / "sitemap.xml").write_text("\n".join(xml) + "\n", encoding="utf-8")
(OUTPUT / "robots.txt").write_text(
    "User-agent: *\nAllow: /\nDisallow: /review\n\n"
    f"Sitemap: {BASE}sitemap.xml\n",
    encoding="utf-8",
)

print({"base": BASE, "urls": len(urls), "output": str(OUTPUT)})
