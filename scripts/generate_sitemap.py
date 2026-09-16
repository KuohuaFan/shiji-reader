#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
base = "https://shijiread.manus.space/"
urls = [base] + [f"{base}?chapter={volume}" for volume in range(1, 131)]
xml = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for url in urls:
    xml.extend(["  <url>", f"    <loc>{url.replace('&', '&amp;')}</loc>", "  </url>"])
xml.append("</urlset>")
(ROOT / "client" / "public" / "sitemap.xml").write_text("\n".join(xml) + "\n", encoding="utf-8")
