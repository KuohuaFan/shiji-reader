#!/usr/bin/env python3
"""Deterministically complete volume 17's sparse chronological table.

Volume 17 consists mostly of numeric year cells and empty placeholders. This
fallback preserves every cell exactly, while expanding recurring event verbs
into modern Traditional Chinese wording. It never invents dates or identities.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CHAPTER = ROOT / "client" / "src" / "content" / "chapters" / "017.json"
EDITORIAL = ROOT / "client" / "src" / "content" / "editorial" / "017.json"


def vernacular(cell: str) -> str:
    if not cell or re.fullmatch(r"[〇一二三四五六七八九十百千萬億0-9、．。]+", cell):
        return cell
    text = cell
    replacements = [
        (r"初王([^，。；]+)元年", r"\1最初被立為王，此為元年"),
        (r"初侯([^，。；]+)元年", r"\1最初受封為侯，此為元年"),
        (r"初封([^，。；]+)", r"\1最初受封"),
        (r"徙([^，。；]+)", r"改封至\1"),
        (r"國除", "封國被撤除"),
        (r"除國", "撤除封國"),
        (r"薨", "去世"),
        (r"卒", "去世"),
        (r"誅", "被誅殺"),
        (r"坐([^，。；]+)", r"因\1獲罪"),
    ]
    for pattern, replacement in replacements:
        text = re.sub(pattern, replacement, text)
    return text


def key(item: dict[str, Any]) -> tuple[int, int, int]:
    return int(item["sectionIndex"]), int(item["blockIndex"]), int(item["rowIndex"])


def main() -> None:
    chapter = json.loads(CHAPTER.read_text(encoding="utf-8"))
    editorial = json.loads(EDITORIAL.read_text(encoding="utf-8"))
    translated = {key(item): item["cells"] for item in editorial.get("tableTranslations", [])}
    expected: list[tuple[tuple[int, int, int], list[str]]] = []
    for section_index, section in enumerate(chapter["sections"]):
        for block_index, block in enumerate(section["blocks"]):
            if block["type"] != "table":
                continue
            for row_index, cells in enumerate(block["rows"]):
                expected.append(((section_index, block_index, row_index), cells))
    for item_key, cells in expected:
        if item_key not in translated:
            translated[item_key] = [vernacular(cell) for cell in cells]
    if set(translated) != {item_key for item_key, _ in expected}:
        raise SystemExit("volume 17 table key mismatch")
    output = []
    source_lengths = {item_key: len(cells) for item_key, cells in expected}
    for item_key, cells in sorted(translated.items()):
        if len(cells) != source_lengths[item_key]:
            raise SystemExit(f"volume 17 cell count mismatch at {item_key}")
        output.append({
            "sectionIndex": item_key[0],
            "blockIndex": item_key[1],
            "rowIndex": item_key[2],
            "cells": cells,
        })
    editorial["tableTranslations"] = output
    editorial["tableTranslationMethod"] = (
        "卷十七以年數、空欄與短紀事為主；模型完成列予以保留，其餘列採確定性詞語展開，"
        "完整保留原欄位、數字、人名、封爵與紀年，不增補原表未載史實。"
    )
    temporary = EDITORIAL.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(editorial, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(EDITORIAL)
    print(json.dumps({"volume": 17, "rows": len(output), "modelRows": 19, "deterministicRows": len(output) - 19}, ensure_ascii=False))


if __name__ == "__main__":
    main()
