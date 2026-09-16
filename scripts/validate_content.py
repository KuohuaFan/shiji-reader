#!/usr/bin/env python3
"""Validate the generated Shiji content bundle before deployment."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "client" / "src" / "content"
CHAPTERS = CONTENT / "chapters"

EXPECTED_CATEGORIES = {
    "本紀": 12,
    "表": 10,
    "書": 8,
    "世家": 30,
    "列傳": 70,
}


def block_length(block: dict) -> int:
    if block["type"] == "text":
        return len(block["text"])
    return sum(len(cell) for row in block["rows"] for cell in row)


def main() -> None:
    manifest = json.loads((CONTENT / "manifest.json").read_text(encoding="utf-8"))
    files = sorted(CHAPTERS.glob("*.json"))
    assert manifest["chapterCount"] == 130, manifest["chapterCount"]
    assert len(files) == 130, len(files)
    assert [item["volume"] for item in manifest["chapters"]] == list(range(1, 131))

    category_counts = {name: 0 for name in EXPECTED_CATEGORIES}
    total_chars = 0
    table_volumes: set[int] = set()

    for expected_volume, path in enumerate(files, start=1):
        chapter = json.loads(path.read_text(encoding="utf-8"))
        assert chapter["volume"] == expected_volume, path
        assert chapter["id"] == f"{expected_volume:03d}", path
        assert chapter["sections"], f"empty chapter: {path.name}"
        assert all(section["heading"] != "校勘記" for section in chapter["sections"])
        measured = sum(
            block_length(block)
            for section in chapter["sections"]
            for block in section["blocks"]
        )
        assert measured == chapter["charCount"], (path.name, measured, chapter["charCount"])
        assert measured >= 500, (path.name, measured)
        total_chars += measured
        category_counts[chapter["category"]] += 1
        if any(
            block["type"] == "table"
            for section in chapter["sections"]
            for block in section["blocks"]
        ):
            table_volumes.add(expected_volume)

    assert category_counts == EXPECTED_CATEGORIES, category_counts
    assert total_chars == manifest["totalChars"], (total_chars, manifest["totalChars"])
    assert set(range(13, 23)).issubset(table_volumes), sorted(table_volumes)
    assert manifest["chapters"][0]["title"] == "五帝本紀第一"
    assert manifest["chapters"][-1]["title"] == "太史公自序第七十"

    print(
        json.dumps(
            {
                "chapters": len(files),
                "characters": total_chars,
                "categories": category_counts,
                "tableVolumes": sorted(table_volumes),
                "status": "ok",
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
