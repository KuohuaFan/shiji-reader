#!/usr/bin/env python3
"""Validate scholarly, critical, translation and guide layers for all 130 chapters."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "client" / "src" / "content"


def load(folder: str, volume: int) -> dict[str, Any]:
    return json.loads((CONTENT / folder / f"{volume:03d}.json").read_text(encoding="utf-8"))


def main() -> None:
    errors: list[str] = []
    counts = {
        "chapters": 0,
        "scholiaFiles": 0,
        "editorialFiles": 0,
        "annotationAnchors": 0,
        "criticalNotes": 0,
        "textParagraphs": 0,
        "translatedParagraphs": 0,
        "tableRows": 0,
        "translatedTableRows": 0,
        "people": 0,
    }
    source_notes = {"集解": 0, "索隱": 0, "正義": 0}

    for volume in range(1, 131):
        try:
            chapter = load("chapters", volume)
            counts["chapters"] += 1
        except (FileNotFoundError, json.JSONDecodeError) as error:
            errors.append(f"{volume:03d}: missing/invalid chapter: {error}")
            continue

        try:
            scholia = load("scholia", volume)
            counts["scholiaFiles"] += 1
            if scholia.get("volume") != volume:
                errors.append(f"{volume:03d}: scholia volume mismatch")
            counts["annotationAnchors"] += len(scholia.get("annotations", []))
            counts["criticalNotes"] += len(scholia.get("criticalNotes", []))
            seen_annotation_ids: set[str] = set()
            for entry in scholia.get("annotations", []):
                entry_id = entry.get("id")
                if not entry_id or entry_id in seen_annotation_ids:
                    errors.append(f"{volume:03d}: duplicate/empty annotation id {entry_id}")
                seen_annotation_ids.add(entry_id)
                if not entry.get("notes"):
                    errors.append(f"{volume:03d}: empty annotation entry")
                for note in entry.get("notes", []):
                    source = note.get("source")
                    if source not in source_notes or not isinstance(note.get("text"), str) or not note["text"].strip():
                        errors.append(f"{volume:03d}: invalid scholium")
                    else:
                        source_notes[source] += 1
            note_ids = [note.get("id") for note in scholia.get("criticalNotes", [])]
            if len(note_ids) != len(set(note_ids)):
                errors.append(f"{volume:03d}: duplicate critical note id")
        except (FileNotFoundError, json.JSONDecodeError) as error:
            errors.append(f"{volume:03d}: missing/invalid scholia: {error}")

        expected_text: list[tuple[int, int]] = []
        original_text: dict[tuple[int, int], str] = {}
        expected_rows: list[tuple[tuple[int, int, int], int]] = []
        for section_index, section in enumerate(chapter.get("sections", [])):
            for block_index, block in enumerate(section.get("blocks", [])):
                if block.get("type") == "text":
                    expected_text.append((section_index, block_index))
                    original_text[(section_index, block_index)] = block.get("text", "")
                elif block.get("type") == "table":
                    rows = block.get("rows", [])
                    if not rows or any(not isinstance(row, list) or not row for row in rows):
                        errors.append(f"{volume:03d}: empty/invalid table")
                    for row_index, cells in enumerate(rows):
                        expected_rows.append(((section_index, block_index, row_index), len(cells)))
                else:
                    errors.append(f"{volume:03d}: unknown block type")
        counts["textParagraphs"] += len(expected_text)
        counts["tableRows"] += len(expected_rows)

        try:
            editorial = load("editorial", volume)
            counts["editorialFiles"] += 1
        except (FileNotFoundError, json.JSONDecodeError) as error:
            errors.append(f"{volume:03d}: missing/invalid editorial: {error}")
            continue

        if editorial.get("volume") != volume or chapter.get("title") != editorial.get("title"):
            errors.append(f"{volume:03d}: editorial metadata mismatch")
        if editorial.get("model") != "gpt-5-mini" or not editorial.get("editorialNotice"):
            errors.append(f"{volume:03d}: model/editorial notice missing")
        for key in ["purpose", "overview", "historicalContext"]:
            if not isinstance(editorial.get(key), str) or len(editorial[key].strip()) < 20:
                errors.append(f"{volume:03d}: {key} too short")
        if not (3 <= len(editorial.get("themes", [])) <= 8):
            errors.append(f"{volume:03d}: invalid theme count")
        if not editorial.get("people"):
            errors.append(f"{volume:03d}: no people")
        counts["people"] += len(editorial.get("people", []))

        translation_items = editorial.get("translations", [])
        actual_text = [(item.get("sectionIndex"), item.get("blockIndex")) for item in translation_items]
        counts["translatedParagraphs"] += len(actual_text)
        if actual_text != expected_text:
            errors.append(f"{volume:03d}: paragraph translation keys/order mismatch ({len(actual_text)}/{len(expected_text)})")
        if len(actual_text) != len(set(actual_text)):
            errors.append(f"{volume:03d}: duplicate paragraph translation key")
        if any(not isinstance(item.get("text"), str) or not item["text"].strip() for item in translation_items):
            errors.append(f"{volume:03d}: empty paragraph translation")
        for item in translation_items:
            key = (item.get("sectionIndex"), item.get("blockIndex"))
            source_text = original_text.get(key, "")
            translated_text = item.get("text", "")
            if len(source_text) >= 20 and isinstance(translated_text, str):
                ratio = len(translated_text) / len(source_text)
                if ratio < 0.28 or ratio > 6:
                    errors.append(f"{volume:03d}: suspicious translation length ratio {ratio:.2f} at {key}")

        table_items = editorial.get("tableTranslations", [])
        actual_rows = [
            ((item.get("sectionIndex"), item.get("blockIndex"), item.get("rowIndex")), len(item.get("cells", [])))
            for item in table_items
        ]
        counts["translatedTableRows"] += len(actual_rows)
        if actual_rows != expected_rows:
            errors.append(f"{volume:03d}: table translation keys/cell counts mismatch ({len(actual_rows)}/{len(expected_rows)})")
        keys = [key for key, _ in actual_rows]
        if len(keys) != len(set(keys)):
            errors.append(f"{volume:03d}: duplicate table translation key")
        if any(not all(isinstance(cell, str) for cell in item.get("cells", [])) for item in table_items):
            errors.append(f"{volume:03d}: non-string translated table cell")

    if counts["chapters"] != 130 or counts["scholiaFiles"] != 130 or counts["editorialFiles"] != 130:
        errors.append(f"layer file counts incomplete: {counts['chapters']}/{counts['scholiaFiles']}/{counts['editorialFiles']}")
    if counts["annotationAnchors"] != 14_315:
        errors.append(f"annotation anchor count {counts['annotationAnchors']} != 14315")
    if counts["criticalNotes"] != 29:
        errors.append(f"critical note count {counts['criticalNotes']} != 29")
    if source_notes != {"集解": 6778, "索隱": 6247, "正義": 5080}:
        errors.append(f"unexpected source note counts: {source_notes}")

    report = {**counts, "sourceNotes": source_notes, "errors": errors}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)
    print("LAYER_VALIDATION_OK")


if __name__ == "__main__":
    main()
